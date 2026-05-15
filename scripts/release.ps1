# ScanMaster Release Script
# Usage: .\scripts\release.ps1 [patch|minor|major] [message]
# Examples:
#   .\scripts\release.ps1                    -> v1.0.18 to v1.0.19 (patch)
#   .\scripts\release.ps1 minor              -> v1.0.18 to v1.1.0
#   .\scripts\release.ps1 major              -> v1.0.18 to v2.0.0
#   .\scripts\release.ps1 patch "Bug fixes"  -> v1.0.19: Bug fixes
#   .\scripts\release.ps1 -DryRun            -> show planned actions only
#   .\scripts\release.ps1 -UploadOnly -Version 1.1.76 -BuildDir .\release-build-20260511-233028
#   .\scripts\release.ps1 -CommitAll         -> include all current non-ignored changes in the release commit
#   .\scripts\release.ps1 -IncludePortable   -> also build/upload the optional portable EXE
#
# Access-gated distribution (default since v1.1.90+):
#   The .exe is pushed to Google Drive (behind the landing-page access code).
#   The .exe is NOT uploaded to the public GitHub Release.
#   Requires one-time setup: see download-gate\drive-uploader\SETUP.md
#
#   .\scripts\release.ps1 -SkipDriveUpload      -> release without touching Drive (landing page stays on old version)
#   .\scripts\release.ps1 -PublishExeToGitHub   -> also upload installer to public GitHub Release (BYPASSES THE GATE)

param(
    [string]$BumpType = "patch",
    [string]$Message = "",
    [switch]$SkipBuild = $false,
    [switch]$RequireClean = $false,
    [switch]$CommitAll = $false,
    [switch]$DryRun = $false,
    [switch]$UploadOnly = $false,
    [string]$Version = "",
    [string]$BuildDir = "",
    [switch]$IncludePortable = $false,
    # Drive / access-gate distribution
    [switch]$SkipDriveUpload = $false,
    # Legacy: also publish the .exe and .blockmap to the public GitHub Release.
    # Off by default because public assets bypass the landing-page access code.
    [switch]$PublishExeToGitHub = $false
)

# Stop on any error by default
$ErrorActionPreference = "Stop"

# Background jobs spawned during the release (parallel typecheck, tests,
# electron-builder, smoke, drive upload). On any kind of exit — graceful
# or aborted — make sure none of them keep running in the background.
Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action {
    Get-Job | Where-Object { $_.Name -like "rel-*" -and $_.State -eq "Running" } |
        ForEach-Object { Stop-Job -Job $_ -ErrorAction SilentlyContinue }
    Get-Job | Where-Object { $_.Name -like "rel-*" } |
        ForEach-Object { Remove-Job -Job $_ -Force -ErrorAction SilentlyContinue }
} | Out-Null

# Colors for output
function Write-Success { param($msg) Write-Host $msg -ForegroundColor Green }
function Write-Info { param($msg) Write-Host $msg -ForegroundColor Cyan }
function Write-Warn { param($msg) Write-Host $msg -ForegroundColor Yellow }
function Write-Err { param($msg) Write-Host $msg -ForegroundColor Red }
$script:GitHubAuthTokenCache = $null
function Format-FileSize {
    param([long]$Bytes)
    if ($Bytes -ge 1GB) { return "{0:N1} GB" -f ($Bytes / 1GB) }
    if ($Bytes -ge 1MB) { return "{0:N1} MB" -f ($Bytes / 1MB) }
    if ($Bytes -ge 1KB) { return "{0:N1} KB" -f ($Bytes / 1KB) }
    return "$Bytes B"
}
function Format-TransferRate {
    param([double]$BytesPerSecond)
    if ($BytesPerSecond -ge 1GB) { return "{0:N1} GB/s" -f ($BytesPerSecond / 1GB) }
    if ($BytesPerSecond -ge 1MB) { return "{0:N1} MB/s" -f ($BytesPerSecond / 1MB) }
    if ($BytesPerSecond -ge 1KB) { return "{0:N1} KB/s" -f ($BytesPerSecond / 1KB) }
    return "{0:N0} B/s" -f $BytesPerSecond
}
function Get-FileSha256 {
    param([string]$Path)
    try {
        return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
    } catch {
        return $null
    }
}
function Invoke-GhCli {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,
        [switch]$SilentStdErr
    )

    $previousErrorActionPreference = $ErrorActionPreference
    $hasNativeErrorPreference = $null -ne (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue)
    if ($hasNativeErrorPreference) {
        $previousNativeErrorPreference = $PSNativeCommandUseErrorActionPreference
    }

    try {
        $ErrorActionPreference = "Continue"
        if ($hasNativeErrorPreference) {
            $PSNativeCommandUseErrorActionPreference = $false
        }

        if ($SilentStdErr) {
            $output = & gh @Arguments 2>$null
        } else {
            $output = & gh @Arguments 2>&1
        }

        return [PSCustomObject]@{
            ExitCode = $LASTEXITCODE
            Output = @($output)
        }
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
        if ($hasNativeErrorPreference) {
            $PSNativeCommandUseErrorActionPreference = $previousNativeErrorPreference
        }
    }
}
function Get-GitHubAuthToken {
    param([switch]$Refresh)

    if (-not $Refresh -and $script:GitHubAuthTokenCache) {
        return $script:GitHubAuthTokenCache
    }

    foreach ($envVarName in @("GH_TOKEN", "GITHUB_TOKEN")) {
        $envValue = [Environment]::GetEnvironmentVariable($envVarName)
        if (-not [string]::IsNullOrWhiteSpace($envValue)) {
            $script:GitHubAuthTokenCache = $envValue.Trim()
            return $script:GitHubAuthTokenCache
        }
    }

    $tokenResult = Invoke-GhCli -Arguments @("auth", "token") -SilentStdErr
    $token = (($tokenResult.Output | Select-Object -First 1) -as [string])
    if ($tokenResult.ExitCode -eq 0 -and -not [string]::IsNullOrWhiteSpace($token)) {
        $script:GitHubAuthTokenCache = $token.Trim()
        return $script:GitHubAuthTokenCache
    }

    return $null
}
function Get-GitHubApiHeaders {
    param([string]$Token)

    return @{
        Authorization = "Bearer $Token"
        Accept = "application/vnd.github+json"
        "User-Agent" = "ScanMaster-Release-Tool"
        "X-GitHub-Api-Version" = "2022-11-28"
    }
}
function Invoke-GitHubApiRequest {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet("GET", "POST", "DELETE", "PATCH")]
        [string]$Method,
        [Parameter(Mandatory = $true)]
        [string]$Uri,
        [Parameter(Mandatory = $true)]
        [string]$Token,
        [object]$Body = $null,
        [switch]$AllowNotFound
    )

    try {
        $requestParams = @{
            Uri = $Uri
            Method = $Method
            Headers = (Get-GitHubApiHeaders -Token $Token)
            ErrorAction = "Stop"
        }

        if ((Get-Command Invoke-WebRequest).Parameters.ContainsKey("UseBasicParsing")) {
            $requestParams.UseBasicParsing = $true
        }

        if ($null -ne $Body) {
            if ($Body -is [string]) {
                $requestParams.Body = $Body
            } else {
                $requestParams.Body = $Body | ConvertTo-Json -Depth 100
            }
            $requestParams.ContentType = "application/json; charset=utf-8"
        }

        $response = Invoke-WebRequest @requestParams
        $responseContent = [string]$response.Content
        $responseJson = $null
        if (-not [string]::IsNullOrWhiteSpace($responseContent)) {
            try {
                $responseJson = $responseContent | ConvertFrom-Json
            } catch {
                $responseJson = $null
            }
        }

        return [PSCustomObject]@{
            Success = $true
            StatusCode = [int]$response.StatusCode
            Content = $responseContent
            Json = $responseJson
            Error = $null
            NotFound = $false
        }
    } catch {
        $statusCode = $null
        $responseContent = $null
        $webResponse = $_.Exception.Response

        if ($webResponse) {
            try {
                $statusCode = [int]$webResponse.StatusCode
            } catch {
                $statusCode = $null
            }

            $responseStream = $webResponse.GetResponseStream()
            if ($responseStream) {
                $reader = New-Object System.IO.StreamReader($responseStream)
                try {
                    $responseContent = $reader.ReadToEnd()
                } finally {
                    $reader.Dispose()
                    $responseStream.Dispose()
                }
            }
        }

        if ($AllowNotFound -and $statusCode -eq 404) {
            return [PSCustomObject]@{
                Success = $false
                StatusCode = 404
                Content = $responseContent
                Json = $null
                Error = $_.Exception.Message
                NotFound = $true
            }
        }

        return [PSCustomObject]@{
            Success = $false
            StatusCode = $statusCode
            Content = $responseContent
            Json = $null
            Error = $_.Exception.Message
            NotFound = $false
        }
    }
}
function Get-GitHubReleaseInfo {
    param(
        [string]$TagName,
        [string]$Repo,
        [switch]$Quiet
    )

    if (-not $TagName -or -not $Repo) {
        return $null
    }

    $token = Get-GitHubAuthToken
    if (-not $token) {
        if (-not $Quiet) {
            Write-Warn "  GitHub auth token not available; falling back to gh for release lookup."
        }
        return $null
    }

    $uri = "https://api.github.com/repos/$Repo/releases/tags/$TagName"
    $releaseResponse = Invoke-GitHubApiRequest -Method "GET" -Uri $uri -Token $token -AllowNotFound
    if (-not $releaseResponse.Success) {
        if (-not $releaseResponse.NotFound -and -not $Quiet) {
            $detail = if ($releaseResponse.Content) { " $($releaseResponse.Content)" } else { "" }
            Write-Warn "  Could not fetch GitHub release details from API.$detail"
        }
        return $null
    }

    $assetMap = @{}
    foreach ($asset in @($releaseResponse.Json.assets)) {
        if ($asset.name) {
            $assetMap[$asset.name] = $asset
        }
    }

    return [PSCustomObject]@{
        ReleaseId = [int64]$releaseResponse.Json.id
        AssetMap = $assetMap
        UploadUrl = [string]$releaseResponse.Json.upload_url
    }
}
function Get-ReleaseAssetMap {
    param(
        [string]$TagName,
        [string]$Repo
    )

    $assetMap = @{}
    if (-not $TagName -or -not $Repo) {
        return $assetMap
    }

    $releaseInfo = Get-GitHubReleaseInfo -TagName $TagName -Repo $Repo -Quiet
    if ($releaseInfo) {
        return $releaseInfo.AssetMap
    }

    $assetsResult = Invoke-GhCli -Arguments @("release", "view", $TagName, "--repo", $Repo, "--json", "assets") -SilentStdErr
    $assetsJson = ($assetsResult.Output -join "`n").Trim()
    if ($assetsResult.ExitCode -ne 0 -or -not $assetsJson) {
        return $assetMap
    }

    try {
        $parsed = $assetsJson | ConvertFrom-Json
        foreach ($asset in @($parsed.assets)) {
            if ($asset.name) {
                $assetMap[$asset.name] = $asset
            }
        }
    } catch {
        Write-Warn "  Could not parse GitHub release assets for verification."
    }

    return $assetMap
}
function Test-ReleaseAssetMatchesLocal {
    param(
        [object]$Asset,
        [string]$LocalPath,
        [string]$KnownLocalHash = $null
    )

    if (-not $Asset -or -not (Test-Path -LiteralPath $LocalPath -PathType Leaf)) {
        return [PSCustomObject]@{
            Matches = $false
            LocalHash = $KnownLocalHash
        }
    }

    $localFile = Get-Item -LiteralPath $LocalPath
    $localHash = $KnownLocalHash
    $remoteDigest = "$($Asset.digest)" -replace '^sha256:', ''

    if ($remoteDigest) {
        if (-not $localHash) {
            $localHash = Get-FileSha256 -Path $LocalPath
        }

        return [PSCustomObject]@{
            Matches = ($localHash -and ($localHash -eq $remoteDigest.ToLowerInvariant()))
            LocalHash = $localHash
        }
    }

    return [PSCustomObject]@{
        Matches = ([int64]$Asset.size -eq $localFile.Length)
        LocalHash = $localHash
    }
}
function Get-PercentComplete {
    param(
        [long]$CompletedBytes,
        [long]$TotalBytes
    )

    if ($TotalBytes -le 0) {
        return 100
    }

    return [int][Math]::Min(100, [Math]::Floor(($CompletedBytes * 100.0) / $TotalBytes))
}
function Update-ReleaseUploadProgress {
    param(
        [string]$FileLabel,
        [int]$FileIndex,
        [int]$FileCount,
        [long]$FileBytesSent,
        [long]$FileTotalBytes,
        [long]$CompletedBytesBeforeFile,
        [long]$OverallTotalBytes,
        [datetime]$UploadStartedAt
    )

    $overallBytesSent = [Math]::Min($OverallTotalBytes, $CompletedBytesBeforeFile + $FileBytesSent)
    $filePercent = Get-PercentComplete -CompletedBytes $FileBytesSent -TotalBytes $FileTotalBytes
    $overallPercent = Get-PercentComplete -CompletedBytes $overallBytesSent -TotalBytes $OverallTotalBytes
    $elapsedSeconds = [Math]::Max(((Get-Date) - $UploadStartedAt).TotalSeconds, 0.001)
    $rateText = Format-TransferRate -BytesPerSecond ($FileBytesSent / $elapsedSeconds)

    $overallStatus = "{0}/{1} files | {2} / {3} ({4}%)" -f $FileIndex, $FileCount, (Format-FileSize $overallBytesSent), (Format-FileSize $OverallTotalBytes), $overallPercent
    $fileStatus = "{0} / {1} ({2}%) at {3}" -f (Format-FileSize $FileBytesSent), (Format-FileSize $FileTotalBytes), $filePercent, $rateText

    Write-Progress -Id 0 -Activity "Uploading release assets to GitHub" -Status $overallStatus -PercentComplete $overallPercent
    Write-Progress -Id 1 -ParentId 0 -Activity "Uploading $FileLabel" -Status $fileStatus -PercentComplete $filePercent
}
function Complete-ReleaseUploadProgress {
    Write-Progress -Id 1 -Activity "Uploading release asset" -Completed
    Write-Progress -Id 0 -Activity "Uploading release assets to GitHub" -Completed
}
function Resolve-ReleaseBuildDir {
    param(
        [Parameter(Mandatory = $true)]
        [string]$TargetVersion,
        [string]$RequestedBuildDir = ""
    )

    if (-not [string]::IsNullOrWhiteSpace($RequestedBuildDir)) {
        if (Test-Path -LiteralPath $RequestedBuildDir -PathType Container) {
            return (Resolve-Path -LiteralPath $RequestedBuildDir).Path
        }

        Write-Err "Build directory not found: $RequestedBuildDir"
        return $null
    }

    $candidateDirs = @(Get-ChildItem -Directory -Filter "release-build-*" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending)
    foreach ($dir in $candidateDirs) {
        $setupPath = Join-Path $dir.FullName "ScanMaster-Setup-$TargetVersion.exe"
        $latestYmlPath = Join-Path $dir.FullName "latest.yml"
        if ((Test-Path -LiteralPath $setupPath -PathType Leaf) -and (Test-Path -LiteralPath $latestYmlPath -PathType Leaf)) {
            return $dir.FullName
        }
    }

    return $null
}
function Get-ReleaseUploadFiles {
    param(
        [Parameter(Mandatory = $true)]
        [string]$OutputDir,
        [Parameter(Mandatory = $true)]
        [string]$TargetVersion,
        [bool]$WithPortable = $false
    )

    $files = @(
        [PSCustomObject]@{ Path = (Join-Path $OutputDir "ScanMaster-Setup-$TargetVersion.exe");          Name = "Setup EXE"; Required = $true; MinSizeMB = 50 },
        [PSCustomObject]@{ Path = (Join-Path $OutputDir "ScanMaster-Setup-$TargetVersion.exe.blockmap"); Name = "Blockmap"; Required = $true; MinSizeMB = 0 },
        [PSCustomObject]@{ Path = (Join-Path $OutputDir "latest.yml");                                  Name = "latest.yml"; Required = $true; MinSizeMB = 0 }
    )

    if ($WithPortable) {
        $files += [PSCustomObject]@{ Path = (Join-Path $OutputDir "ScanMaster-Portable-$TargetVersion.exe"); Name = "Portable EXE"; Required = $true; MinSizeMB = 50 }
    }

    return $files
}
function Test-ReleaseBuildOutput {
    param(
        [Parameter(Mandatory = $true)]
        [string]$OutputDir,
        [Parameter(Mandatory = $true)]
        [string]$TargetVersion,
        [bool]$WithPortable = $false
    )

    $buildOK = $true
    $filesToUpload = @(Get-ReleaseUploadFiles -OutputDir $OutputDir -TargetVersion $TargetVersion -WithPortable $WithPortable)

    foreach ($file in $filesToUpload) {
        if (Test-Path -LiteralPath $file.Path -PathType Leaf) {
            $fileInfo = Get-Item -LiteralPath $file.Path
            $sizeMB = $fileInfo.Length / 1MB

            if ($file.MinSizeMB -gt 0 -and $sizeMB -lt $file.MinSizeMB) {
                Write-Err "  $($file.Name) TOO SMALL: $([math]::Round($sizeMB, 1)) MB (expected >$($file.MinSizeMB) MB)"
                $buildOK = $false
            } elseif ($file.Name -eq "latest.yml") {
                $ymlContent = Get-Content -LiteralPath $file.Path -Raw
                if ($ymlContent -match "version:\s*$([regex]::Escape($TargetVersion))") {
                    Write-Success "  latest.yml OK: version $TargetVersion"
                } else {
                    Write-Err "  latest.yml has WRONG version (expected $TargetVersion)"
                    Write-Err "  Content: $($ymlContent.Substring(0, [Math]::Min(200, $ymlContent.Length)))"
                    $buildOK = $false
                }
            } else {
                Write-Success "  $($file.Name) OK: $([math]::Round($sizeMB, 1)) MB"
            }
        } elseif ($file.Required) {
            Write-Err "  $($file.Name) not found: $($file.Path)"
            $buildOK = $false
        } else {
            Write-Warn "  $($file.Name) not found (optional): $($file.Path)"
        }
    }

    return [PSCustomObject]@{
        BuildOK = $buildOK
        FilesToUpload = $filesToUpload
    }
}
function Remove-GitHubReleaseAsset {
    param(
        [string]$Repo,
        [int64]$AssetId,
        [string]$Token
    )

    if (-not $Repo -or -not $AssetId -or -not $Token) {
        return $false
    }

    $deleteUri = "https://api.github.com/repos/$Repo/releases/assets/$AssetId"
    $deleteResult = Invoke-GitHubApiRequest -Method "DELETE" -Uri $deleteUri -Token $Token
    return $deleteResult.Success
}
function Upload-GitHubReleaseAssetWithProgress {
    param(
        [Parameter(Mandatory = $true)]
        [int64]$ReleaseId,
        [Parameter(Mandatory = $true)]
        [string]$Repo,
        [Parameter(Mandatory = $true)]
        [string]$FilePath,
        [Parameter(Mandatory = $true)]
        [string]$AssetLabel,
        [Parameter(Mandatory = $true)]
        [string]$Token,
        [Parameter(Mandatory = $true)]
        [int]$FileIndex,
        [Parameter(Mandatory = $true)]
        [int]$FileCount,
        [Parameter(Mandatory = $true)]
        [long]$CompletedBytesBeforeFile,
        [Parameter(Mandatory = $true)]
        [long]$OverallTotalBytes
    )

    $localFile = Get-Item -LiteralPath $FilePath
    $uploadUri = "https://uploads.github.com/repos/$Repo/releases/$ReleaseId/assets?name=$([System.Uri]::EscapeDataString($localFile.Name))"
    $request = [System.Net.HttpWebRequest]::Create($uploadUri)
    $request.Method = "POST"
    $request.ContentType = "application/octet-stream"
    $request.ContentLength = $localFile.Length
    $request.UserAgent = "ScanMaster-Release-Tool"
    $request.Accept = "application/vnd.github+json"
    $request.AllowWriteStreamBuffering = $false
    $request.Timeout = 900000
    $request.ReadWriteTimeout = 900000
    $request.Headers["Authorization"] = "Bearer $Token"
    $request.Headers["X-GitHub-Api-Version"] = "2022-11-28"

    $buffer = New-Object byte[] (1024 * 1024)
    $fileStream = $null
    $requestStream = $null
    $response = $null
    $responseStream = $null
    $reader = $null
    $bytesSent = 0L
    $uploadStartedAt = Get-Date
    $lastProgressUpdateAt = $uploadStartedAt.AddSeconds(-1)

    try {
        $fileStream = [System.IO.File]::OpenRead($FilePath)
        $requestStream = $request.GetRequestStream()

        Update-ReleaseUploadProgress -FileLabel $AssetLabel -FileIndex $FileIndex -FileCount $FileCount -FileBytesSent 0 -FileTotalBytes $localFile.Length -CompletedBytesBeforeFile $CompletedBytesBeforeFile -OverallTotalBytes $OverallTotalBytes -UploadStartedAt $uploadStartedAt

        while (($bytesRead = $fileStream.Read($buffer, 0, $buffer.Length)) -gt 0) {
            $requestStream.Write($buffer, 0, $bytesRead)
            $bytesSent += $bytesRead

            $now = Get-Date
            if (($now - $lastProgressUpdateAt).TotalMilliseconds -ge 150 -or $bytesSent -eq $localFile.Length) {
                Update-ReleaseUploadProgress -FileLabel $AssetLabel -FileIndex $FileIndex -FileCount $FileCount -FileBytesSent $bytesSent -FileTotalBytes $localFile.Length -CompletedBytesBeforeFile $CompletedBytesBeforeFile -OverallTotalBytes $OverallTotalBytes -UploadStartedAt $uploadStartedAt
                $lastProgressUpdateAt = $now
            }
        }

        $requestStream.Flush()
        $response = $request.GetResponse()
        $responseStream = $response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($responseStream)
        try {
            $responseContent = $reader.ReadToEnd()
        } finally {
            $reader.Dispose()
            $responseStream.Dispose()
        }

        $responseJson = $null
        if (-not [string]::IsNullOrWhiteSpace($responseContent)) {
            try {
                $responseJson = $responseContent | ConvertFrom-Json
            } catch {
                $responseJson = $null
            }
        }

        return [PSCustomObject]@{
            Success = $true
            StatusCode = 201
            Content = $responseContent
            Json = $responseJson
            Error = $null
        }
    } catch {
        $statusCode = $null
        $responseContent = $null
        $webResponse = $_.Exception.Response

        if ($webResponse) {
            try {
                $statusCode = [int]$webResponse.StatusCode
            } catch {
                $statusCode = $null
            }

            $errorStream = $webResponse.GetResponseStream()
            if ($errorStream) {
                $reader = New-Object System.IO.StreamReader($errorStream)
                try {
                    $responseContent = $reader.ReadToEnd()
                } finally {
                    $reader.Dispose()
                    $errorStream.Dispose()
                }
            }
        }

        return [PSCustomObject]@{
            Success = $false
            StatusCode = $statusCode
            Content = $responseContent
            Json = $null
            Error = $_.Exception.Message
        }
    } finally {
        if ($requestStream) {
            try {
                $requestStream.Dispose()
            } catch {
                Write-Warn "  Upload request stream cleanup warning: $($_.Exception.Message)"
            }
        }
        if ($fileStream) {
            try {
                $fileStream.Dispose()
            } catch {
                Write-Warn "  Upload file stream cleanup warning: $($_.Exception.Message)"
            }
        }
        if ($reader) {
            try {
                $reader.Dispose()
            } catch {
                Write-Warn "  Upload response reader cleanup warning: $($_.Exception.Message)"
            }
        }
        if ($responseStream) {
            try {
                $responseStream.Dispose()
            } catch {
                Write-Warn "  Upload response stream cleanup warning: $($_.Exception.Message)"
            }
        }
        if ($response) {
            try {
                $response.Dispose()
            } catch {
                Write-Warn "  Upload response cleanup warning: $($_.Exception.Message)"
            }
        }
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "   ScanMaster Release Tool" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""

# ── Pre-flight checks ────────────────────────────────────────────────

# 1. Make sure we are in the repo root
if (-not (Test-Path "package.json")) {
    Write-Err "package.json not found – run this script from the repo root."
    exit 1
}

# 2. Guard against accidentally committing unrelated work.
$gitStatus = git -c core.quotePath=false status --porcelain 2>&1
if ($gitStatus) {
    Write-Warn "WARNING: You have uncommitted changes:"
    Write-Host $gitStatus
    Write-Host ""

    if ($UploadOnly) {
        Write-Warn "Upload-only mode: local changes will not be committed."
        Write-Host ""
    } elseif ($DryRun) {
        Write-Warn "Dry-run mode: local changes will not be committed."
        Write-Host ""
    } elseif ($RequireClean -or -not $CommitAll) {
        Write-Err "Aborted to avoid committing unrelated changes."
        Write-Err "Commit your work first, or run with -CommitAll if you intentionally want the release commit to include all current changes."
        exit 1
    } else {
        Write-Warn "CommitAll enabled. The release commit will include all non-ignored changes."
        Write-Host ""
    }
}

# 3. Make sure we can reach the remote
if (-not $DryRun) {
    Write-Info "Checking remote connectivity..."
    git ls-remote origin HEAD > $null 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Cannot reach remote 'origin'. Check your internet / credentials."
        exit 1
    }
} else {
    Write-Warn "Dry-run mode: skipping remote connectivity check."
}

# 4. Check GitHub CLI is available (needed for release)
$ghAvailable = $null -ne (Get-Command "gh" -ErrorAction SilentlyContinue)
if (-not $ghAvailable) {
    Write-Warn "GitHub CLI (gh) not installed – release upload will be skipped."
    Write-Warn "Install: winget install GitHub.cli && gh auth login"
    Write-Host ""
}

$githubRepo = "amitay1/Scan-Master-16-12-25"

# ── Version bump ─────────────────────────────────────────────────────

$packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
$currentVersion = $packageJson.version
Write-Info "Current version: v$currentVersion"

if ($UploadOnly) {
    $newVersion = if ([string]::IsNullOrWhiteSpace($Version)) { $currentVersion } else { $Version.Trim().TrimStart("v") }
    $commitMessage = "Upload release assets for v$newVersion"
    $releaseTitle = "v$newVersion"
    Write-Success "Upload-only target: v$newVersion"
} else {
    $versionParts = $currentVersion -split '\.'
    $major = [int]$versionParts[0]
    $minor = [int]$versionParts[1]
    $patch = [int]$versionParts[2]

    switch ($BumpType.ToLower()) {
        "major" { $major++; $minor = 0; $patch = 0 }
        "minor" { $minor++; $patch = 0 }
        "patch" { $patch++ }
        default {
            Write-Warn "Unknown bump type '$BumpType', using 'patch'"
            $patch++
        }
    }

    $newVersion = "$major.$minor.$patch"
    Write-Success "New version: v$newVersion"

    # Check if this tag already exists locally or remotely
    $existingTag = git tag -l "v$newVersion" 2>&1
    if ($existingTag) {
        Write-Err "Tag v$newVersion already exists locally! Aborting to prevent duplicate."
        Write-Err "Use -UploadOnly -Version $newVersion to upload assets for an existing release."
        exit 1
    }

    if (-not $DryRun) {
        $existingRemoteTag = git ls-remote --tags origin "refs/tags/v$newVersion" 2>$null
        if ($existingRemoteTag) {
            Write-Err "Tag v$newVersion already exists on origin! Aborting to prevent duplicate."
            Write-Err "Use -UploadOnly -Version $newVersion to upload assets for an existing release."
            exit 1
        }
    }
}

# Create commit message
if (-not $UploadOnly -and $Message -ne "") {
    $commitMessage = "v${newVersion}: $Message"
    $releaseTitle = "v${newVersion}: $Message"
} elseif (-not $UploadOnly) {
    $commitMessage = "v$newVersion"
    $releaseTitle = "v$newVersion"
}

Write-Host ""
Write-Info "Commit message: $commitMessage"
Write-Info "Release assets: Setup EXE, Blockmap, latest.yml$(if ($IncludePortable) { ', Portable EXE' } else { ' (portable skipped)' })"
Write-Host ""

if ($DryRun) {
    Write-Warn "DRY RUN - no files changed, no build, no commit, no tag, no upload."
    Write-Info "Would release: v$newVersion"
    Write-Info "Would build Windows target: $(if ($IncludePortable) { 'nsis + portable' } else { 'nsis only' })"
    if ($UploadOnly) {
        Write-Info "Would upload from: $(if ($BuildDir) { $BuildDir } else { 'latest matching release-build-* directory' })"
    } else {
        Write-Info "Would stage: $(if ($CommitAll) { 'all non-ignored changes' } else { 'package.json only' })"
    }
    if ($SkipDriveUpload) {
        Write-Info "Drive upload: SKIPPED via -SkipDriveUpload"
    } else {
        Write-Info "Drive upload: would push .exe to Drive (file ID from download-gate\drive-uploader\config.local.json)"
    }
    if ($PublishExeToGitHub) {
        Write-Warn "GitHub Release: would include installer (PUBLIC - bypasses access-code gate)"
    } else {
        Write-Info "GitHub Release: metadata only (installer goes to Drive only)"
    }
    exit 0
}

if (-not $UploadOnly) {
    # Update package.json (without BOM to prevent build errors)
    $packageJson.version = $newVersion
    $jsonContent = $packageJson | ConvertTo-Json -Depth 100
    $utf8NoBOM = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText((Resolve-Path "package.json").Path, $jsonContent, $utf8NoBOM)
    Write-Info "Package version updated locally. Git commit/tag/push will run after release validation passes."
}

# ── Electron build ───────────────────────────────────────────────────

$freshOutputDir = $null
$buildOK = $false
$filesToUpload = @()

if ($UploadOnly -or ($SkipBuild -and -not [string]::IsNullOrWhiteSpace($BuildDir))) {
    $freshOutputDir = Resolve-ReleaseBuildDir -TargetVersion $newVersion -RequestedBuildDir $BuildDir
    if (-not $freshOutputDir) {
        Write-Err "Could not find a build directory for v$newVersion."
        Write-Err "Pass -BuildDir .\release-build-YYYYMMDD-HHMMSS or run a full release build."
        exit 1
    }

    Write-Host ""
    Write-Info "Using existing build output: $freshOutputDir"
    Write-Info "Validating build output in: $freshOutputDir"
    $validation = Test-ReleaseBuildOutput -OutputDir $freshOutputDir -TargetVersion $newVersion -WithPortable ([bool]$IncludePortable)
    $buildOK = $validation.BuildOK
    $filesToUpload = @($validation.FilesToUpload)

    if (-not $buildOK) {
        Write-Host ""
        Write-Err "Build validation FAILED. Installer files will NOT be uploaded."
    }
} elseif (-not $SkipBuild) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Info "Validating and building Electron app for Windows..."
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host ""

    $buildExitCode = 0

    # ── Step 1: typecheck + tests in parallel ────────────────────────
    # Both are read-only against the source tree, so they're safe to run
    # concurrently. PowerShell jobs spin up new sessions so we capture
    # stdout/stderr and the exit code via the job's State + ChildJobs.
    Write-Info "Running TypeScript typecheck and unit tests in parallel..."
    $repoRoot = (Get-Location).Path
    $typecheckJob = Start-Job -Name "rel-typecheck" -ScriptBlock {
        param($cwd)
        Set-Location $cwd
        & npm run typecheck 2>&1
        exit $LASTEXITCODE
    } -ArgumentList $repoRoot

    $testJob = Start-Job -Name "rel-tests" -ScriptBlock {
        param($cwd)
        Set-Location $cwd
        & npm run test 2>&1
        exit $LASTEXITCODE
    } -ArgumentList $repoRoot

    $null = Wait-Job -Job $typecheckJob, $testJob

    $typecheckOutput = Receive-Job -Job $typecheckJob -ErrorAction SilentlyContinue
    $testOutput = Receive-Job -Job $testJob -ErrorAction SilentlyContinue
    # Each script-block ends with `exit $LASTEXITCODE`; a non-zero exit
    # leaves the job in "Failed" state, success leaves it "Completed".
    $typecheckExit = if ($typecheckJob.State -eq "Completed") { 0 } else { 1 }
    $testExit = if ($testJob.State -eq "Completed") { 0 } else { 1 }

    Remove-Job -Job $typecheckJob, $testJob -Force

    if ($typecheckExit -ne 0) {
        Write-Host ""
        Write-Err "TypeScript typecheck failed. Output:"
        $typecheckOutput | ForEach-Object { Write-Host "  $_" }
        $buildExitCode = 1
    } else {
        Write-Success "TypeScript typecheck passed."
    }

    if ($testExit -ne 0) {
        Write-Host ""
        Write-Err "Unit tests failed. Output:"
        $testOutput | ForEach-Object { Write-Host "  $_" }
        $buildExitCode = 1
    } else {
        Write-Success "Unit tests passed."
    }

    # ── Step 2: kill stale ScanMaster + clean ────────────────────────
    if ($buildExitCode -eq 0) {
        Write-Info "Closing ScanMaster if running..."
        Get-Process | Where-Object { $_.ProcessName -like "*Scan*Master*" -or $_.MainWindowTitle -like "*ScanMaster*" } | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2

        # Clean build folders to prevent stale artifacts
        Write-Info "Cleaning dist-electron..."
        if (Test-Path "dist-electron") {
            Remove-Item -Path "dist-electron" -Recurse -Force -ErrorAction SilentlyContinue
        }

        # Use a fresh timestamped output directory to avoid Windows file-lock issues
        $buildTimestamp = Get-Date -Format "yyyyMMdd-HHmmss"
        $freshOutputDir = "release-build-$buildTimestamp"
        Write-Info "  Build output directory: $freshOutputDir"

        # Temporarily update electron-builder.json with the fresh output dir
        $ebJsonPath = "electron-builder.json"
        $ebJsonRaw = Get-Content $ebJsonPath -Raw
        $ebJson = $ebJsonRaw | ConvertFrom-Json
        $originalOutputDir = $ebJson.directories.output
        $originalWinTarget = $ebJson.win.target
        $ebJson.directories.output = $freshOutputDir

        if (-not $IncludePortable) {
            Write-Info "  Windows targets: nsis only (portable skipped for faster release)"
            $ebJson.win.target = @(
                [PSCustomObject]@{
                    target = "nsis"
                    arch = @("x64")
                }
            )
        } else {
            Write-Info "  Windows targets: nsis + portable"
        }

        $ebJsonContent = $ebJson | ConvertTo-Json -Depth 100
        $utf8NoBOM2 = New-Object System.Text.UTF8Encoding $false
        [System.IO.File]::WriteAllText((Resolve-Path $ebJsonPath).Path, $ebJsonContent, $utf8NoBOM2)

        try {
            # ── Step 3a: vite build (frontend bundle) ──────────────────
            # Run this first by itself so dist/ exists before we kick off
            # the slow electron-builder step and the smoke test in parallel.
            Write-Info "Running vite build..."
            npm run build
            $buildExitCode = $LASTEXITCODE

            if ($buildExitCode -eq 0) {
                # ── Step 3b: electron-builder + smoke test in parallel ─
                # electron-builder reads dist/ but doesn't mutate it. The
                # smoke test serves dist/ over a local HTTP server and runs
                # Playwright. Both are independent so we run them at the
                # same time and gate the release on both succeeding.
                Write-Info "Running electron-builder (Windows) and smoke test in parallel..."
                $builderJob = Start-Job -Name "rel-builder" -ScriptBlock {
                    param($cwd)
                    Set-Location $cwd
                    & npm run dist:win:builder 2>&1
                    exit $LASTEXITCODE
                } -ArgumentList $repoRoot

                $smokeJob = Start-Job -Name "rel-smoke" -ScriptBlock {
                    param($cwd)
                    Set-Location $cwd
                    & npm run smoke:release 2>&1
                    exit $LASTEXITCODE
                } -ArgumentList $repoRoot

                $null = Wait-Job -Job $builderJob, $smokeJob

                $builderOutput = Receive-Job -Job $builderJob -ErrorAction SilentlyContinue
                $smokeOutput = Receive-Job -Job $smokeJob -ErrorAction SilentlyContinue
                $builderExit = if ($builderJob.State -eq "Completed") { 0 } else { 1 }
                $smokeExit = if ($smokeJob.State -eq "Completed") { 0 } else { 1 }
                Remove-Job -Job $builderJob, $smokeJob -Force

                if ($builderExit -ne 0) {
                    Write-Host ""
                    Write-Err "electron-builder failed. Tail of output:"
                    $builderOutput | Select-Object -Last 40 | ForEach-Object { Write-Host "  $_" }
                    $buildExitCode = 1
                } else {
                    Write-Success "electron-builder completed."
                }

                if ($smokeExit -ne 0) {
                    Write-Host ""
                    Write-Err "Production smoke test failed. Output:"
                    $smokeOutput | ForEach-Object { Write-Host "  $_" }
                    $buildExitCode = 1
                } else {
                    Write-Success "Smoke test passed."
                }
            } else {
                Write-Err "vite build failed (exit code $buildExitCode)."
            }
        } catch {
            Write-Err "Build threw an exception: $_"
            $buildExitCode = 1
        } finally {
            # ALWAYS restore the original output dir, even if build fails or is interrupted
            $ebJson.directories.output = $originalOutputDir
            $ebJson.win.target = $originalWinTarget
            $ebJsonRestored = $ebJson | ConvertTo-Json -Depth 100
            [System.IO.File]::WriteAllText((Resolve-Path $ebJsonPath).Path, $ebJsonRestored, $utf8NoBOM2)
            Write-Info "  electron-builder.json restored"
        }
    }

    if ($buildExitCode -ne 0) {
        Write-Err "Build failed (exit code $buildExitCode)!"
        Write-Warn "You can manually build later with: npm run dist:win"
    }

    if ($buildExitCode -eq 0 -and $freshOutputDir) {
        # ── Validate build output ────────────────────────────────────

        Write-Host ""
        Write-Info "Validating build output in: $freshOutputDir"

        $validation = Test-ReleaseBuildOutput -OutputDir $freshOutputDir -TargetVersion $newVersion -WithPortable ([bool]$IncludePortable)
        $buildOK = $validation.BuildOK
        $filesToUpload = @($validation.FilesToUpload)

        if (-not $buildOK) {
            Write-Host ""
            Write-Err "Build validation FAILED. Installer files will NOT be uploaded."
        }
    } else {
        $buildOK = $false
    }
} else {
    Write-Warn "Build was skipped and no -BuildDir was provided, so no installer files will be uploaded."
}

# ── Drive upload (access-gated distribution) ─────────────────────────
# Started here as a BACKGROUND JOB and waited on right before the
# GitHub release upload step. While Drive uploads its ~280MB payload,
# git commit/tag/push runs in the foreground (cheap, ~5s). Net win:
# the Drive transfer overlaps the git work instead of blocking it.
#
# If Drive fails AFTER the tag has been pushed, we delete the remote
# tag + GitHub release as a rollback so the landing page never gets
# stuck pointing at a version that wasn't actually uploaded.

$driveUploaded = $false
$driveJob = $null
$driveStartTime = $null

if ($buildOK -and -not $SkipDriveUpload) {
    Write-Host ""
    Write-Info "Pushing installer to Drive (access-gated distribution) — in background..."

    $driveUploaderDir = Join-Path (Get-Location) "download-gate\drive-uploader"
    $driveConfigPath = Join-Path $driveUploaderDir "config.local.json"
    $driveUploadScript = Join-Path $driveUploaderDir "upload.mjs"

    if (-not (Test-Path -LiteralPath $driveUploadScript -PathType Leaf)) {
        Write-Err "  Drive uploader not found at $driveUploadScript"
        Write-Err "  Pull the latest code or pass -SkipDriveUpload to bypass."
        if (-not $UploadOnly) {
            $packageJson.version = $currentVersion
            $revertJson = $packageJson | ConvertTo-Json -Depth 100
            [System.IO.File]::WriteAllText((Resolve-Path "package.json").Path, $revertJson, $utf8NoBOM)
        }
        exit 1
    }

    if (-not (Test-Path -LiteralPath $driveConfigPath -PathType Leaf)) {
        Write-Err "  Drive uploader is not configured (config.local.json missing)."
        Write-Err "  Run the one-time setup first:"
        Write-Err "    node download-gate\drive-uploader\auth-setup.mjs"
        Write-Err "  See download-gate\drive-uploader\SETUP.md for the full walkthrough."
        Write-Err "  Or pass -SkipDriveUpload to release without updating the landing page."
        if (-not $UploadOnly) {
            $packageJson.version = $currentVersion
            $revertJson = $packageJson | ConvertTo-Json -Depth 100
            [System.IO.File]::WriteAllText((Resolve-Path "package.json").Path, $revertJson, $utf8NoBOM)
        }
        exit 1
    }

    $exePath = Join-Path $freshOutputDir "ScanMaster-Setup-$newVersion.exe"
    if (-not (Test-Path -LiteralPath $exePath -PathType Leaf)) {
        Write-Err "  Installer not found at $exePath - cannot push to Drive."
        if (-not $UploadOnly) {
            $packageJson.version = $currentVersion
            $revertJson = $packageJson | ConvertTo-Json -Depth 100
            [System.IO.File]::WriteAllText((Resolve-Path "package.json").Path, $revertJson, $utf8NoBOM)
        }
        exit 1
    }

    Write-Info "  Source: $exePath"
    $driveStartTime = Get-Date
    $driveJob = Start-Job -Name "rel-drive-upload" -ScriptBlock {
        param($cwd, $scriptPath, $exe, $assetName)
        Set-Location $cwd
        & node $scriptPath $exe --name $assetName 2>&1
        exit $LASTEXITCODE
    } -ArgumentList $repoRoot, $driveUploadScript, $exePath, "ScanMaster-Setup-$newVersion.exe"
    Write-Info "  Drive upload running in background (job id $($driveJob.Id)). Continuing with git push..."
} elseif ($SkipDriveUpload) {
    Write-Warn "Drive upload skipped via -SkipDriveUpload. Landing page will continue serving the previous version."
}

# ── Git: commit, tag, push ───────────────────────────────────────────

# Helper used if Drive upload fails AFTER we've already pushed the tag.
function Invoke-ReleaseRollback {
    param(
        [string]$Tag,
        [string]$Repo,
        [string]$Reason
    )
    Write-Err ""
    Write-Err "ROLLBACK: $Reason"
    Write-Err "Removing tag $Tag from origin and any GitHub release to keep state consistent..."

    # Delete remote tag (best-effort)
    git push --delete origin $Tag 2>&1 | Out-Null
    # Delete local tag (best-effort)
    git tag -d $Tag 2>&1 | Out-Null
    # Delete GitHub release if it was created (best-effort)
    if ($ghAvailable) {
        & gh release delete $Tag --repo $Repo --yes 2>&1 | Out-Null
    }
    Write-Err "Local tag, remote tag, and GitHub release have been cleaned up. Fix the issue and re-run release."
}

if (-not $UploadOnly) {
    if (-not $buildOK) {
        Write-Host ""
        Write-Err "Release validation failed. Git commit/tag/push will NOT run."
        Write-Err "No users will receive this version until typecheck, tests, build, smoke, and asset validation pass."

        # Revert only the automatic version bump; keep the user's real source changes intact.
        $packageJson.version = $currentVersion
        $revertJson = $packageJson | ConvertTo-Json -Depth 100
        [System.IO.File]::WriteAllText((Resolve-Path "package.json").Path, $revertJson, $utf8NoBOM)
        exit 1
    }

    if (-not $ghAvailable) {
        Write-Host ""
        Write-Err "GitHub CLI (gh) is required before publishing a customer release."
        Write-Err "Aborting before git commit/tag/push so an incomplete auto-update release is not created."
        Write-Err "Install: winget install GitHub.cli && gh auth login"

        # Revert only the automatic version bump; keep the user's real source changes intact.
        $packageJson.version = $currentVersion
        $revertJson = $packageJson | ConvertTo-Json -Depth 100
        [System.IO.File]::WriteAllText((Resolve-Path "package.json").Path, $revertJson, $utf8NoBOM)
        exit 1
    }

    Write-Info "Staging changes..."
    if ($CommitAll) {
        git add -A
    } else {
        git add -- package.json
    }

    # Safety check: make sure release artifacts are NOT staged.
    # core.quotePath=false avoids quoted octal paths that Test-Path cannot parse.
    $stagedPaths = @(git -c core.quotePath=false diff --cached --name-only)
    $stagedReleaseFiles = $stagedPaths | Where-Object { $_ -like "release-*" }
    if ($stagedReleaseFiles) {
        Write-Err "SAFETY: Release build files are staged for commit!"
        Write-Err "These files should be in .gitignore:"
        $stagedReleaseFiles | ForEach-Object { Write-Err "  $_" }
        Write-Err "Unstaging them now..."
        git reset HEAD -- release-*/ 2>$null
        git reset HEAD -- release-v*/ 2>$null
    }

    # Also make sure no file over 90MB is staged (GitHub limit is 100MB)
    $largeFilePaths = @(git -c core.quotePath=false diff --cached --name-only --diff-filter=ACMR)
    $largeFiles = $largeFilePaths | ForEach-Object {
        $path = $_
        if (-not [string]::IsNullOrWhiteSpace($path) -and (Test-Path -LiteralPath $path -PathType Leaf)) {
            $size = (Get-Item -LiteralPath $path).Length / 1MB
            if ($size -gt 90) {
                [PSCustomObject]@{ Name = $path; SizeMB = [math]::Round($size, 1) }
            }
        }
    }
    if ($largeFiles) {
        Write-Err "SAFETY: Large files (>90MB) detected in staging - GitHub will reject these!"
        $largeFiles | ForEach-Object { Write-Err "  $($_.Name) ($($_.SizeMB) MB)" }
        Write-Err "Aborting. Add these patterns to .gitignore and try again."

        # Revert only the automatic version bump; keep the user's real source changes intact.
        $packageJson.version = $currentVersion
        $revertJson = $packageJson | ConvertTo-Json -Depth 100
        [System.IO.File]::WriteAllText((Resolve-Path "package.json").Path, $revertJson, $utf8NoBOM)
        exit 1
    }

    Write-Info "Creating commit..."
    git commit -m $commitMessage
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Git commit failed. Aborting."
        exit 1
    }

    Write-Info "Creating tag v$newVersion..."
    git tag "v$newVersion"
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Git tag failed. Aborting."
        exit 1
    }

    Write-Info "Pushing to origin..."
    git push origin main --tags
    if ($LASTEXITCODE -ne 0) {
        Write-Err "============================================="
        Write-Err "  Git push FAILED!"
        Write-Err "  The commit and tag were created locally."
        Write-Err "  Fix the issue, then retry with:"
        Write-Err "    git push origin main --tags"
        Write-Err "============================================="
        Write-Err ""
        Write-Err "Common causes:"
        Write-Err "  - Large files in history (use git filter-repo to clean)"
        Write-Err "  - Network / auth issues"
        Write-Err "  - Remote branch is ahead (git pull --rebase first)"
        # If Drive was running in parallel, kill it — we don't want to
        # silently ship an EXE to Drive for a tag that never landed.
        if ($driveJob -and $driveJob.State -eq "Running") {
            Stop-Job -Job $driveJob -ErrorAction SilentlyContinue
            Remove-Job -Job $driveJob -Force -ErrorAction SilentlyContinue
        }
        exit 1
    }
    Write-Success "Push successful!"
}

# ── Wait for parallel Drive upload to finish ─────────────────────────
# The git push above ran in parallel with Drive. By the time we're here,
# Drive is usually already done; if not, this Wait-Job is the short tail.
if ($driveJob) {
    Write-Info "Waiting for Drive upload to finish..."
    $null = Wait-Job -Job $driveJob
    $driveOutput = Receive-Job -Job $driveJob -ErrorAction SilentlyContinue
    $driveSuccess = $driveJob.State -eq "Completed"
    Remove-Job -Job $driveJob -Force

    if (-not $driveSuccess) {
        Write-Err "  Drive upload failed. Tail of output:"
        $driveOutput | Select-Object -Last 30 | ForEach-Object { Write-Host "  $_" }
        Write-Err "  The landing page still serves the PREVIOUS version."

        if (-not $UploadOnly) {
            # We already pushed the tag in parallel — roll it back so the
            # landing page and electron-updater don't try to serve a build
            # that wasn't actually uploaded to Drive.
            Invoke-ReleaseRollback -Tag "v$newVersion" -Repo $githubRepo -Reason "Drive upload failed after tag was pushed"
            $packageJson.version = $currentVersion
            $revertJson = $packageJson | ConvertTo-Json -Depth 100
            [System.IO.File]::WriteAllText((Resolve-Path "package.json").Path, $revertJson, $utf8NoBOM)
        }
        Write-Err "  Fix the issue, then re-run with -UploadOnly -Version $newVersion -BuildDir $freshOutputDir."
        exit 1
    }

    $driveUploaded = $true
    $driveDuration = (Get-Date) - $driveStartTime
    Write-Success "  Drive updated in $([math]::Round($driveDuration.TotalSeconds, 1))s. Anyone with the access code now gets v$newVersion."
}

# ── GitHub Release ───────────────────────────────────────────────────

$releaseAssetsUploaded = $false

if ($ghAvailable -and $buildOK) {
    Write-Host ""
    Write-Info "Creating or updating GitHub Release..."

    $releaseNotes = "## What's New`n`n"
    if ($UploadOnly) {
        $releaseNotes += "- Upload release assets for v$newVersion`n"
    } elseif ($Message -ne "") {
        $releaseNotes += "- $Message`n"
    } else {
        $releaseNotes += "- Version bump to v$newVersion`n"
    }
    if (-not $UploadOnly) {
        $releaseNotes += "`n**Full Changelog**: https://github.com/amitay1/Scan-Master-16-12-25/compare/v$currentVersion...v$newVersion"
    }

    $releaseTag = "v$newVersion"
    $existingRelease = Invoke-GhCli -Arguments @("release", "view", $releaseTag, "--repo", $githubRepo, "--json", "url") -SilentStdErr

    if ($existingRelease.ExitCode -eq 0) {
        Write-Warn "  Release $releaseTag already exists on GitHub – will upload files to existing release."
    } else {
        $releaseResult = Invoke-GhCli -Arguments @("release", "create", $releaseTag, "--repo", $githubRepo, "--title", $releaseTitle, "--notes", $releaseNotes)
        $releaseOutput = ($releaseResult.Output -join "`n").Trim()

        if ($releaseResult.ExitCode -ne 0) {
            if ($releaseOutput -match "already exists") {
                Write-Warn "  Release $releaseTag already exists on GitHub – will upload files to existing release."
            } elseif ($releaseOutput) {
                Write-Err "  Failed to create GitHub release: $releaseOutput"
                Write-Err "  You can create it manually: gh release create $releaseTag --title `"$releaseTitle`""
            } else {
                Write-Err "  Failed to create GitHub release with an unknown error."
                Write-Err "  You can create it manually: gh release create $releaseTag --title `"$releaseTitle`""
            }
        } else {
            Write-Success "  GitHub Release $releaseTag created!"
        }
    }

    # Filter out the installer binary unless explicitly publishing publicly.
    # The .exe and .blockmap go to Drive (gated), not GitHub Releases (public).
    # latest.yml stays so the release page still shows a manifest for archival.
    if (-not $PublishExeToGitHub) {
        $filesToUpload = @($filesToUpload | Where-Object {
            $name = [System.IO.Path]::GetFileName($_.Path)
            -not ($name -like "ScanMaster-Setup-*.exe" -or $name -like "ScanMaster-Setup-*.exe.blockmap" -or $name -like "ScanMaster-Portable-*.exe")
        })
        Write-Info "  Public GitHub Release will contain only metadata (latest.yml). Installer goes to Drive only."
    } else {
        Write-Warn "  -PublishExeToGitHub is SET: installer will be uploaded to the public GitHub Release."
        Write-Warn "  This makes the .exe downloadable without the access code. The landing-page gate is effectively bypassed."
    }

    # Upload installer files only if build validation passed
    if ($buildOK -and $freshOutputDir -and (Test-Path -LiteralPath $freshOutputDir -PathType Container) -and $filesToUpload.Count -gt 0) {
        Write-Info "Uploading installer files to release..."

        $overallUploadBytesTotal = 0L
        foreach ($candidateFile in $filesToUpload) {
            if (Test-Path -LiteralPath $candidateFile.Path -PathType Leaf) {
                $overallUploadBytesTotal += (Get-Item -LiteralPath $candidateFile.Path).Length
            }
        }

        $completedUploadBytes = 0L
        $releaseApiToken = Get-GitHubAuthToken
        $releaseApiInfo = Get-GitHubReleaseInfo -TagName $releaseTag -Repo $githubRepo -Quiet
        if (-not $releaseApiInfo) {
            Start-Sleep -Seconds 2
            $releaseApiInfo = Get-GitHubReleaseInfo -TagName $releaseTag -Repo $githubRepo -Quiet
        }

        $useApiUpload = $null -ne $releaseApiInfo -and -not [string]::IsNullOrWhiteSpace($releaseApiToken)
        if ($useApiUpload) {
            Write-Info "  Live upload progress enabled."
        } else {
            Write-Warn "  Live upload progress unavailable; falling back to gh upload output."
        }

        $remoteAssets = if ($releaseApiInfo) { $releaseApiInfo.AssetMap } else { Get-ReleaseAssetMap -TagName $releaseTag -Repo $githubRepo }
        $uploadFailed = $false
        $failedUploads = @()
        for ($fileIndex = 0; $fileIndex -lt $filesToUpload.Count; $fileIndex++) {
            $file = $filesToUpload[$fileIndex]
            $progressFileIndex = $fileIndex + 1

            if (Test-Path -LiteralPath $file.Path -PathType Leaf) {
                $localFile = Get-Item -LiteralPath $file.Path
                $assetName = $localFile.Name
                $sizeText = Format-FileSize $localFile.Length
                $localHash = $null

                $existingAsset = $null
                if ($remoteAssets.ContainsKey($assetName)) {
                    $existingAsset = $remoteAssets[$assetName]
                }

                if ($existingAsset) {
                    $remoteDigest = "$($existingAsset.digest)" -replace '^sha256:', ''
                    if ($remoteDigest) {
                        Write-Info "  Checking existing asset: $assetName"
                        $localHash = Get-FileSha256 -Path $file.Path
                        if ($localHash -and ($localHash -eq $remoteDigest.ToLowerInvariant())) {
                            Write-Success "  Already uploaded: $($file.Name) [$sizeText]"
                            $completedUploadBytes += $localFile.Length
                            $overallPercent = Get-PercentComplete -CompletedBytes $completedUploadBytes -TotalBytes $overallUploadBytesTotal
                            $overallStatus = "{0}/{1} files | {2} / {3} ({4}%)" -f $progressFileIndex, $filesToUpload.Count, (Format-FileSize $completedUploadBytes), (Format-FileSize $overallUploadBytesTotal), $overallPercent
                            Write-Progress -Id 0 -Activity "Uploading release assets to GitHub" -Status $overallStatus -PercentComplete $overallPercent
                            Write-Progress -Id 1 -ParentId 0 -Activity "Uploading $($file.Name)" -Status "Already uploaded on GitHub" -PercentComplete 100
                            continue
                        }
                    } elseif ([int64]$existingAsset.size -eq $localFile.Length) {
                        Write-Success "  Already uploaded: $($file.Name) [$sizeText]"
                        $completedUploadBytes += $localFile.Length
                        $overallPercent = Get-PercentComplete -CompletedBytes $completedUploadBytes -TotalBytes $overallUploadBytesTotal
                        $overallStatus = "{0}/{1} files | {2} / {3} ({4}%)" -f $progressFileIndex, $filesToUpload.Count, (Format-FileSize $completedUploadBytes), (Format-FileSize $overallUploadBytesTotal), $overallPercent
                        Write-Progress -Id 0 -Activity "Uploading release assets to GitHub" -Status $overallStatus -PercentComplete $overallPercent
                        Write-Progress -Id 1 -ParentId 0 -Activity "Uploading $($file.Name)" -Status "Already uploaded on GitHub" -PercentComplete 100
                        continue
                    }

                    Write-Warn "  Existing asset differs; re-uploading $($file.Name) with --clobber."
                }

                $uploadSucceeded = $false
                $maxUploadAttempts = 2
                for ($attempt = 1; $attempt -le $maxUploadAttempts; $attempt++) {
                    $useApiUploadForThisAttempt = $useApiUpload

                    if ($attempt -gt 1) {
                        Write-Warn "  Retrying $($file.Name) (attempt $attempt of $maxUploadAttempts)..."
                    }

                    if ($existingAsset -and $useApiUploadForThisAttempt) {
                        $deletedExistingAsset = Remove-GitHubReleaseAsset -Repo $githubRepo -AssetId ([int64]$existingAsset.id) -Token $releaseApiToken
                        if (-not $deletedExistingAsset) {
                            Write-Warn "  Could not delete existing asset via GitHub API; falling back to gh --clobber for $($file.Name)."
                            $useApiUploadForThisAttempt = $false
                        } else {
                            $existingAsset = $null
                        }
                    }

                    Write-Info "  Uploading: $($file.Name) [$sizeText]"
                    $uploadStarted = Get-Date
                    if ($useApiUploadForThisAttempt) {
                        try {
                            $uploadResult = Upload-GitHubReleaseAssetWithProgress -ReleaseId $releaseApiInfo.ReleaseId -Repo $githubRepo -FilePath $file.Path -AssetLabel $file.Name -Token $releaseApiToken -FileIndex $progressFileIndex -FileCount $filesToUpload.Count -CompletedBytesBeforeFile $completedUploadBytes -OverallTotalBytes $overallUploadBytesTotal
                        } catch {
                            $uploadResult = [PSCustomObject]@{
                                Success = $false
                                StatusCode = $null
                                Content = $null
                                Json = $null
                                Error = $_.Exception.Message
                            }
                        }
                        $uploadExitCode = if ($uploadResult.Success) { 0 } else { 1 }
                        if (-not $uploadResult.Success) {
                            Write-Warn "  GitHub API upload failed for $($file.Name): $($uploadResult.Error)"
                            if ($uploadResult.Content) {
                                Write-Warn "  GitHub API response: $($uploadResult.Content)"
                            }
                            if ($attempt -lt $maxUploadAttempts) {
                                Write-Warn "  Falling back to gh release upload on the next attempt for $($file.Name)."
                                $useApiUpload = $false
                            }
                        }
                    } else {
                        $uploadResult = Invoke-GhCli -Arguments @("release", "upload", $releaseTag, $file.Path, "--repo", $githubRepo, "--clobber")
                        $uploadExitCode = $uploadResult.ExitCode
                    }
                    $elapsed = (Get-Date) - $uploadStarted
                    $elapsedText = "{0:mm\:ss}" -f $elapsed

                    $releaseApiInfo = Get-GitHubReleaseInfo -TagName $releaseTag -Repo $githubRepo -Quiet
                    if ($releaseApiInfo) {
                        $remoteAssets = $releaseApiInfo.AssetMap
                    } else {
                        $remoteAssets = Get-ReleaseAssetMap -TagName $releaseTag -Repo $githubRepo
                    }

                    $verifiedAsset = $null
                    if ($remoteAssets.ContainsKey($assetName)) {
                        $verifiedAsset = $remoteAssets[$assetName]
                    }

                    if ($verifiedAsset) {
                        $verification = Test-ReleaseAssetMatchesLocal -Asset $verifiedAsset -LocalPath $file.Path -KnownLocalHash $localHash
                        $localHash = $verification.LocalHash

                        if ($verification.Matches) {
                            if ($uploadExitCode -ne 0) {
                                Write-Warn "  gh reported failure after $elapsedText, but GitHub shows a matching asset for $($file.Name). Treating as success."
                            } else {
                                Write-Success "  Uploaded: $($file.Name) in $elapsedText"
                            }
                            $completedUploadBytes += $localFile.Length
                            $uploadSucceeded = $true
                            break
                        }

                        if ($uploadExitCode -eq 0) {
                            Write-Warn "  Upload command finished for $($file.Name) in $elapsedText, but GitHub asset verification did not match yet."
                        } elseif ($attempt -lt $maxUploadAttempts) {
                            Write-Warn "  Upload attempt $attempt for $($file.Name) failed after $elapsedText and GitHub asset did not verify."
                        } else {
                            Write-Err "  FAILED to upload $($file.Name) after $elapsedText!"
                        }
                    } else {
                        if ($uploadExitCode -eq 0) {
                            Write-Warn "  Upload command finished for $($file.Name) in $elapsedText, but GitHub did not return the asset yet."
                        } elseif ($attempt -lt $maxUploadAttempts) {
                            Write-Warn "  Upload attempt $attempt for $($file.Name) failed after $elapsedText and no asset was returned by GitHub."
                        } else {
                            Write-Err "  FAILED to upload $($file.Name) after $elapsedText!"
                        }
                    }

                    if ($uploadExitCode -eq 0 -and $attempt -eq 1) {
                        Start-Sleep -Seconds 2
                    }

                    if ($attempt -lt $maxUploadAttempts) {
                        Start-Sleep -Seconds 3
                    }
                }

                if (-not $uploadSucceeded) {
                    $uploadFailed = $true
                    $failedUploads += $file
                }
            } else {
                Write-Warn "  Not found: $($file.Path) (skipping)"
            }
        }

        Complete-ReleaseUploadProgress

        if ($uploadFailed) {
            Write-Host ""
            Write-Err "Some uploads failed. Retry manually:"
            foreach ($failedFile in $failedUploads) {
                Write-Err "  gh release upload v$newVersion `"$($failedFile.Path)`" --repo $githubRepo --clobber"
            }
        } else {
            Write-Success "All files uploaded to GitHub Release!"
            $releaseAssetsUploaded = $true
        }

    }
} elseif ($ghAvailable -and -not $buildOK) {
    Write-Host ""
    Write-Err "================================================"
    Write-Err "  BUILD VALIDATION FAILED - GitHub release was not created/updated."
    Write-Err "  Fix the build or pass -BuildDir with an existing valid build."
    Write-Err "  Resume upload with:"
    Write-Err "    .\scripts\release.ps1 -UploadOnly -Version $newVersion -BuildDir <build-dir>"
    Write-Err "================================================"
} else {
    Write-Host ""
    Write-Warn "GitHub CLI (gh) not installed – skipping GitHub Release creation."
    Write-Warn "Auto-update won't work without a GitHub Release."
    Write-Warn "Install GitHub CLI: winget install GitHub.cli"
    Write-Warn "Then run: gh auth login"
}

# ── Cleanup old build dirs (keep last 3) ─────────────────────────────

$oldBuildDirs = Get-ChildItem -Directory -Filter "release-build-*" | Sort-Object Name -Descending | Select-Object -Skip 3
if ($oldBuildDirs) {
    Write-Host ""
    Write-Info "Cleaning up old build directories..."
    foreach ($dir in $oldBuildDirs) {
        Write-Info "  Removing: $($dir.Name)"
        Remove-Item -Path $dir.FullName -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# ── Summary ──────────────────────────────────────────────────────────

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
if ($releaseAssetsUploaded) {
    if ($UploadOnly) {
        Write-Success "Uploaded release assets for v$newVersion!"
    } else {
        Write-Success "Released v$newVersion!"
    }
} else {
    Write-Err "Release v$newVersion is incomplete."
}
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

if ($driveUploaded) {
    Write-Host "Landing page: Anyone using access code SM-2NDE-F3WG now downloads v$newVersion." -ForegroundColor Green
    Write-Host "  https://amitay1.github.io/Scan-Master-16-12-25/" -ForegroundColor Cyan
} elseif ($SkipDriveUpload) {
    Write-Host "Landing page: still serves the previous version (-SkipDriveUpload was set)." -ForegroundColor Yellow
}

if ($releaseAssetsUploaded -and $PublishExeToGitHub) {
    Write-Host "Auto-update: Other computers will update when they open the app!" -ForegroundColor Green
} elseif (-not $buildOK) {
    Write-Host "WARNING: Build/upload validation failed." -ForegroundColor Red
} elseif ($SkipBuild) {
    Write-Host "Build was skipped - remember to build and upload manually." -ForegroundColor Yellow
}
Write-Host ""
