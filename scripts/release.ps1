# ScanMaster Release Script
# Usage: .\scripts\release.ps1 [patch|minor|major] [message]
# Examples:
#   .\scripts\release.ps1                    -> v1.0.18 to v1.0.19 (patch)
#   .\scripts\release.ps1 minor              -> v1.0.18 to v1.1.0
#   .\scripts\release.ps1 major              -> v1.0.18 to v2.0.0
#   .\scripts\release.ps1 patch "Bug fixes"  -> v1.0.19: Bug fixes

param(
    [string]$BumpType = "patch",
    [string]$Message = "",
    [switch]$SkipBuild = $false,
    [switch]$RequireClean = $false
)

# Stop on any error by default
$ErrorActionPreference = "Stop"

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
        return (Get-FileHash -Path $Path -Algorithm SHA256).Hash.ToLowerInvariant()
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

    if (-not $Asset -or -not (Test-Path $LocalPath)) {
        return [PSCustomObject]@{
            Matches = $false
            LocalHash = $KnownLocalHash
        }
    }

    $localFile = Get-Item $LocalPath
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

    $localFile = Get-Item $FilePath
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

# 2. Make sure git is clean only when explicitly requested.
# By default we continue and let the release commit capture current non-ignored changes.
$gitStatus = git status --porcelain 2>&1
if ($gitStatus) {
    Write-Warn "WARNING: You have uncommitted changes:"
    Write-Host $gitStatus
    Write-Host ""
    if ($RequireClean) {
        Write-Err "Aborted. Commit or stash your changes first."
        exit 1
    }
    Write-Warn "Continuing with dirty working tree. The release commit will include all non-ignored changes."
    Write-Host ""
}

# 3. Make sure we can reach the remote
Write-Info "Checking remote connectivity..."
git ls-remote origin HEAD > $null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Err "Cannot reach remote 'origin'. Check your internet / credentials."
    exit 1
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
    Write-Err "If you want to re-release, first delete the tag: git tag -d v$newVersion"
    exit 1
}

$existingRemoteTag = git ls-remote --tags origin "refs/tags/v$newVersion" 2>$null
if ($existingRemoteTag) {
    Write-Err "Tag v$newVersion already exists on origin! Aborting to prevent duplicate."
    Write-Err "If you want to re-release, delete the remote tag first: git push origin :refs/tags/v$newVersion"
    exit 1
}

# Update package.json (without BOM to prevent build errors)
$packageJson.version = $newVersion
$jsonContent = $packageJson | ConvertTo-Json -Depth 100
$utf8NoBOM = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText((Resolve-Path "package.json").Path, $jsonContent, $utf8NoBOM)

# Create commit message
if ($Message -eq "") {
    $commitMessage = "v$newVersion"
    $releaseTitle = "v$newVersion"
} else {
    $commitMessage = "v${newVersion}: $Message"
    $releaseTitle = "v${newVersion}: $Message"
}

Write-Host ""
Write-Info "Commit message: $commitMessage"
Write-Host ""

# ── Git: commit, tag, push ───────────────────────────────────────────

Write-Info "Staging changes..."
git add -A

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
    Write-Err "SAFETY: Large files (>90MB) detected in staging – GitHub will reject these!"
    $largeFiles | ForEach-Object { Write-Err "  $($_.Name) ($($_.SizeMB) MB)" }
    Write-Err "Aborting. Add these patterns to .gitignore and try again."
    # Revert the version bump
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
    exit 1
}
Write-Success "Push successful!"

# ── Electron build ───────────────────────────────────────────────────

$freshOutputDir = $null
$buildOK = $false

if (-not $SkipBuild) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Info "Building Electron app for Windows..."
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host ""

    # Try to close ScanMaster if running
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
    $ebJson.directories.output = $freshOutputDir
    $ebJsonContent = $ebJson | ConvertTo-Json -Depth 100
    $utf8NoBOM2 = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText((Resolve-Path $ebJsonPath).Path, $ebJsonContent, $utf8NoBOM2)

    try {
        npm run dist:win
        $buildExitCode = $LASTEXITCODE
    } catch {
        Write-Err "Build threw an exception: $_"
        $buildExitCode = 1
    } finally {
        # ALWAYS restore the original output dir, even if build fails or is interrupted
        $ebJson.directories.output = $originalOutputDir
        $ebJsonRestored = $ebJson | ConvertTo-Json -Depth 100
        [System.IO.File]::WriteAllText((Resolve-Path $ebJsonPath).Path, $ebJsonRestored, $utf8NoBOM2)
        Write-Info "  electron-builder.json restored to output: $originalOutputDir"
    }

    if ($buildExitCode -ne 0) {
        Write-Err "Build failed (exit code $buildExitCode)!"
        Write-Warn "You can manually build later with: npm run dist:win"
    }

    # ── Validate build output ────────────────────────────────────────

    Write-Host ""
    Write-Info "Validating build output in: $freshOutputDir"

    $installerPath = Join-Path $freshOutputDir "ScanMaster-Setup-$newVersion.exe"
    $portablePath  = Join-Path $freshOutputDir "ScanMaster-Portable-$newVersion.exe"
    $latestYmlPath = Join-Path $freshOutputDir "latest.yml"
    $buildOK = $true

    # Check installer exists and is reasonable size (>50MB)
    if (Test-Path $installerPath) {
        $installerSize = (Get-Item $installerPath).Length / 1MB
        if ($installerSize -lt 50) {
            Write-Err "  INSTALLER TOO SMALL: $([math]::Round($installerSize, 1)) MB (expected >50 MB)"
            $buildOK = $false
        } else {
            Write-Success "  Installer OK: $([math]::Round($installerSize, 1)) MB"
        }
    } else {
        Write-Err "  Installer not found: $installerPath"
        $buildOK = $false
    }

    # Check portable exists
    if (Test-Path $portablePath) {
        $portableSize = (Get-Item $portablePath).Length / 1MB
        Write-Success "  Portable OK: $([math]::Round($portableSize, 1)) MB"
    } else {
        Write-Warn "  Portable not found (optional): $portablePath"
    }

    # Check latest.yml exists and has correct version
    if (Test-Path $latestYmlPath) {
        $ymlContent = Get-Content $latestYmlPath -Raw
        if ($ymlContent -match "version:\s*$([regex]::Escape($newVersion))") {
            Write-Success "  latest.yml OK: version $newVersion"
        } else {
            Write-Err "  latest.yml has WRONG version (expected $newVersion)"
            Write-Err "  Content: $($ymlContent.Substring(0, [Math]::Min(200, $ymlContent.Length)))"
            $buildOK = $false
        }
    } else {
        Write-Err "  latest.yml not found: $latestYmlPath"
        $buildOK = $false
    }

    if (-not $buildOK) {
        Write-Host ""
        Write-Err "Build validation FAILED. Installer files will NOT be uploaded."
    }
}

# ── GitHub Release ───────────────────────────────────────────────────

if ($ghAvailable) {
    Write-Host ""
    Write-Info "Creating GitHub Release..."

    $releaseNotes = "## What's New`n`n"
    if ($Message -ne "") {
        $releaseNotes += "- $Message`n"
    } else {
        $releaseNotes += "- Version bump to v$newVersion`n"
    }
    $releaseNotes += "`n**Full Changelog**: https://github.com/amitay1/Scan-Master-16-12-25/compare/v$currentVersion...v$newVersion"

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

    # Upload installer files only if build validation passed
    if ($buildOK -and $freshOutputDir -and (Test-Path $freshOutputDir)) {
        Write-Info "Uploading installer files to release..."

        $filesToUpload = @(
            @{ Path = (Join-Path $freshOutputDir "ScanMaster-Setup-$newVersion.exe");           Name = "Setup EXE" },
            @{ Path = (Join-Path $freshOutputDir "ScanMaster-Setup-$newVersion.exe.blockmap");  Name = "Blockmap" },
            @{ Path = (Join-Path $freshOutputDir "ScanMaster-Portable-$newVersion.exe");        Name = "Portable EXE" },
            @{ Path = (Join-Path $freshOutputDir "latest.yml");                                 Name = "latest.yml" }
        )

        $overallUploadBytesTotal = 0L
        foreach ($candidateFile in $filesToUpload) {
            if (Test-Path $candidateFile.Path) {
                $overallUploadBytesTotal += (Get-Item $candidateFile.Path).Length
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

            if (Test-Path $file.Path) {
                $localFile = Get-Item $file.Path
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
        }

    } elseif (-not $SkipBuild -and -not $buildOK) {
        Write-Host ""
        Write-Err "================================================"
        Write-Err "  BUILD VALIDATION FAILED - No files uploaded!"
        Write-Err "  The GitHub release was created but is EMPTY."
        Write-Err "  Fix the build and run: npm run dist:win"
        Write-Err "  Then manually upload files with:"
        Write-Err "    gh release upload v$newVersion <build-dir>/latest.yml --repo $githubRepo --clobber"
        Write-Err "    gh release upload v$newVersion <build-dir>/ScanMaster-Setup-$newVersion.exe --repo $githubRepo --clobber"
        Write-Err "    gh release upload v$newVersion <build-dir>/ScanMaster-Setup-$newVersion.exe.blockmap --repo $githubRepo --clobber"
        Write-Err "    gh release upload v$newVersion <build-dir>/ScanMaster-Portable-$newVersion.exe --repo $githubRepo --clobber"
        Write-Err "================================================"
    } elseif ($SkipBuild) {
        Write-Warn "Build was skipped – no installer files uploaded."
        Write-Warn "Run the build manually and upload:"
        Write-Warn "  npm run dist:win"
        Write-Warn "  gh release upload v$newVersion release-build/latest.yml --repo $githubRepo --clobber"
        Write-Warn "  gh release upload v$newVersion release-build/ScanMaster-Setup-$newVersion.exe --repo $githubRepo --clobber"
    }
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
Write-Success "Released v$newVersion!"
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

if ($ghAvailable -and -not $SkipBuild -and $buildOK) {
    Write-Host "Auto-update: Other computers will update when they open the app!" -ForegroundColor Green
} elseif (-not $buildOK) {
    Write-Host "WARNING: Build failed – auto-update will NOT work until fixed!" -ForegroundColor Red
} elseif ($SkipBuild) {
    Write-Host "Build was skipped – remember to build and upload manually." -ForegroundColor Yellow
} else {
    Write-Host "To update other computers manually, run:" -ForegroundColor Yellow
    Write-Host "  git pull origin main" -ForegroundColor White
}
Write-Host ""
