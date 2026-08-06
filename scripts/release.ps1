param(
    [ValidateSet('patch', 'minor', 'major')]
    [string]$Bump = 'patch',
    [string]$Message = '',
    [switch]$DryRun,
    [switch]$UploadOnly,
    [string]$Version = '',
    [string]$BuildDir = '',
    [switch]$IncludePortable,
    [switch]$AllowUnsignedDevelopmentBuild,
    # Ship a real, publishable release without Authenticode signing.
    #
    # WHY THIS EXISTS: the signing gate below was added in f013550 as the target
    # state, but no code-signing certificate was ever obtained. Every RT-PT
    # release to date is unsigned — verified 2026-08-07 on the installed build:
    # Get-AuthenticodeSignature on v1.0.3 reports NotSigned. electron-builder.json
    # sets neither publisherName nor verifyUpdateCodeSignature, so electron-updater
    # has no signature to check against and unsigned updates keep working exactly
    # as v1.0.0-v1.0.3 already do for customers.
    #
    # This does NOT weaken the gate: signing stays required by default, this switch
    # must be passed deliberately, and it is refused for -UploadOnly so an unsigned
    # build can never be slipped into an upload that claims to be verified. Remove
    # it the day a certificate exists. Authorized by the product owner 2026-08-07.
    [switch]$AllowUnsignedProductionRelease
)

$ErrorActionPreference = 'Stop'

$ExpectedRepo = 'amitay1/RT-u'
$ExpectedProductName = 'RT-PT Inspector'
$ExpectedAppId = 'com.amitay.rtptinspector'
$ExpectedSetupArtifact = 'RTPT-Inspector-Setup-${version}.${ext}'
$ExpectedPortableArtifact = 'RTPT-Inspector-Portable-${version}.${ext}'
$ArtifactPrefix = 'RTPT-Inspector'
$RepoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$ReleaseWorkspace = [System.IO.Path]::GetFullPath((Join-Path $RepoRoot 'release-workspace'))
$versionFileSnapshots = @{}
$versionFilesApplied = $false
$versionFilesStaged = $false
$releaseCommitCreated = $false

function Run([string]$File, [string[]]$Arguments) {
    & $File @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$File failed with exit code $LASTEXITCODE"
    }
}

function Get-CommandOutput([string]$File, [string[]]$Arguments) {
    $output = @(& $File @Arguments)
    if ($LASTEXITCODE -ne 0) {
        throw "$File failed with exit code $LASTEXITCODE"
    }
    return $output
}

function Assert-ReleaseIdentity {
    $builderPath = Join-Path $RepoRoot 'electron-builder.json'
    $builder = Get-Content -LiteralPath $builderPath -Raw | ConvertFrom-Json

    if ([string]$builder.productName -cne $ExpectedProductName) {
        throw "electron-builder productName must be '$ExpectedProductName'."
    }
    if ([string]$builder.appId -cne $ExpectedAppId) {
        throw "electron-builder appId must be '$ExpectedAppId'."
    }
    if ([string]$builder.artifactName -cne $ExpectedSetupArtifact) {
        throw "electron-builder artifactName must be '$ExpectedSetupArtifact'."
    }
    if ([string]$builder.portable.artifactName -cne $ExpectedPortableArtifact) {
        throw "electron-builder portable artifactName must be '$ExpectedPortableArtifact'."
    }

    $publishers = @($builder.publish)
    if ($publishers.Count -ne 1) {
        throw 'electron-builder must define exactly one RT-PT publish target.'
    }
    $publisher = $publishers[0]
    $configuredRepo = "$($publisher.owner)/$($publisher.repo)"
    if ([string]$publisher.provider -cne 'github' -or $configuredRepo -cne $ExpectedRepo) {
        throw "electron-builder publish target must be github/$ExpectedRepo."
    }

    $origin = [string](Get-CommandOutput git @('-C', $RepoRoot, 'remote', 'get-url', 'origin') | Select-Object -First 1)
    $origin = $origin.Trim().TrimEnd('/')
    $validOrigins = @(
        'https://github.com/amitay1/RT-u.git',
        'https://github.com/amitay1/RT-u',
        'git@github.com:amitay1/RT-u.git',
        'git@github.com:amitay1/RT-u',
        'ssh://git@github.com/amitay1/RT-u.git',
        'ssh://git@github.com/amitay1/RT-u'
    )
    if ($validOrigins -notcontains $origin) {
        throw "origin must point to $ExpectedRepo; found '$origin'."
    }

    return $builder
}

function Assert-RtPtLicenseVerificationKey([switch]$AllowUnusableDevelopment) {
    $arguments = @((Join-Path $RepoRoot 'scripts/verify-rtpt-license-key.cjs'))
    if ($AllowUnusableDevelopment) {
        $arguments += '--allow-unusable-development'
    }
    Run node $arguments
}

function Assert-RtPtUpdateVerificationKey([switch]$AllowUnusableDevelopment) {
    $arguments = @((Join-Path $RepoRoot 'scripts/verify-rtpt-update-key.cjs'))
    if ($AllowUnusableDevelopment) {
        $arguments += '--allow-unusable-development'
    }
    Run node $arguments
}

function Test-WindowsSigningConfigured($Builder) {
    $environmentSigning = -not [string]::IsNullOrWhiteSpace($env:CSC_LINK) -or
        -not [string]::IsNullOrWhiteSpace($env:WIN_CSC_LINK)

    $win = $Builder.win
    $signtool = $win.signtoolOptions
    $signtoolSigning = $null -ne $signtool -and (
        -not [string]::IsNullOrWhiteSpace([string]$signtool.certificateFile) -or
        -not [string]::IsNullOrWhiteSpace([string]$signtool.certificateSubjectName) -or
        -not [string]::IsNullOrWhiteSpace([string]$signtool.certificateSha1) -or
        -not [string]::IsNullOrWhiteSpace([string]$signtool.sign)
    )

    $azure = $win.azureSignOptions
    $azureSigning = $null -ne $azure -and
        -not [string]::IsNullOrWhiteSpace([string]$azure.publisherName) -and
        -not [string]::IsNullOrWhiteSpace([string]$azure.endpoint) -and
        -not [string]::IsNullOrWhiteSpace([string]$azure.certificateProfileName) -and
        -not [string]::IsNullOrWhiteSpace([string]$azure.codeSigningAccountName)

    return $environmentSigning -or $signtoolSigning -or $azureSigning
}

function Get-TargetVersion([string]$CurrentVersion, [string]$RequestedBump) {
    if ($CurrentVersion -notmatch '^(\d+)\.(\d+)\.(\d+)$') {
        throw "package.json version '$CurrentVersion' is not a stable semantic version."
    }

    $major = [int]$Matches[1]
    $minor = [int]$Matches[2]
    $patch = [int]$Matches[3]
    switch ($RequestedBump) {
        'major' { $major++; $minor = 0; $patch = 0 }
        'minor' { $minor++; $patch = 0 }
        'patch' { $patch++ }
    }
    return "$major.$minor.$patch"
}

function Get-WorkingTreeChanges {
    $tracked = @(Get-CommandOutput git @('-C', $RepoRoot, 'diff', '--name-only'))
    $staged = @(Get-CommandOutput git @('-C', $RepoRoot, 'diff', '--cached', '--name-only'))
    $untracked = @(Get-CommandOutput git @('-C', $RepoRoot, 'ls-files', '--others', '--exclude-standard'))
    return @($tracked + $staged + $untracked | Where-Object { $_ } | Sort-Object -Unique)
}

function Assert-CleanTree {
    $changes = @(Get-WorkingTreeChanges)
    if ($changes.Count -gt 0) {
        throw "Production release requires a clean tree. Commit intentional changes first. Dirty paths:`n$($changes -join "`n")"
    }
}

function Assert-OnlyVersionFilesChanged {
    $allowed = @('package.json', 'package-lock.json')
    $changes = @(Get-WorkingTreeChanges)
    $unexpected = @($changes | Where-Object { $allowed -notcontains ($_ -replace '\\', '/') })
    if ($unexpected.Count -gt 0) {
        throw "Release stopped because unrelated paths changed:`n$($unexpected -join "`n")"
    }
    if ($changes -notcontains 'package.json') {
        throw 'Release stopped because package.json was not updated by npm version.'
    }
}

function Assert-PathInsideWorkspace([string]$Candidate, [switch]$MustExist) {
    $fullPath = if ($MustExist) {
        (Resolve-Path -LiteralPath $Candidate).Path
    } else {
        [System.IO.Path]::GetFullPath($Candidate)
    }

    $workspacePrefix = $ReleaseWorkspace.TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
    if (-not $fullPath.StartsWith($workspacePrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Release path must remain below '$ReleaseWorkspace'; received '$fullPath'."
    }

    if ($MustExist) {
        if (-not (Test-Path -LiteralPath $ReleaseWorkspace -PathType Container)) {
            throw "Release workspace does not exist: $ReleaseWorkspace"
        }
        $workspaceItem = Get-Item -LiteralPath $ReleaseWorkspace -Force
        if (($workspaceItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Release workspace cannot be a symlink or reparse point: $ReleaseWorkspace"
        }

        $cursor = Get-Item -LiteralPath $fullPath -Force
        while ($cursor -and $cursor.FullName.StartsWith($workspacePrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
            if (($cursor.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw "Release path cannot traverse a symlink or reparse point: $($cursor.FullName)"
            }
            $cursor = $cursor.Parent
        }
    }

    return $fullPath
}

function Initialize-ReleaseWorkspace {
    if (Test-Path -LiteralPath $ReleaseWorkspace) {
        $workspaceItem = Get-Item -LiteralPath $ReleaseWorkspace -Force
        if (-not $workspaceItem.PSIsContainer -or
            ($workspaceItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Release workspace must be a regular directory: $ReleaseWorkspace"
        }
        return
    }

    New-Item -ItemType Directory -Path $ReleaseWorkspace | Out-Null
}

function Get-ReleaseFiles([string]$Directory, [string]$TargetVersion) {
    $safeDirectory = Assert-PathInsideWorkspace $Directory -MustExist
    $required = @(
        "$ArtifactPrefix-Setup-$TargetVersion.exe",
        "$ArtifactPrefix-Setup-$TargetVersion.exe.blockmap",
        'latest.yml'
    )
    if ($IncludePortable) {
        $required += "$ArtifactPrefix-Portable-$TargetVersion.exe"
    }

    $paths = foreach ($name in $required) {
        $path = Join-Path $safeDirectory $name
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
            throw "Missing release artifact: $path"
        }
        $resolved = (Resolve-Path -LiteralPath $path).Path
        [void](Assert-PathInsideWorkspace $resolved -MustExist)
        $resolved
    }
    return $paths
}

function Assert-AuthenticodeSigned([string[]]$Files) {
    $signatureCommand = Get-Command Get-AuthenticodeSignature -ErrorAction SilentlyContinue
    if (-not $signatureCommand) {
        throw 'Windows Authenticode verification is unavailable. Production Windows releases must be built and verified on Windows.'
    }

    $expectedSignerThumbprint = ([string]$env:RTPT_WINDOWS_SIGNER_SHA1 -replace '\s', '').ToUpperInvariant()
    if ($expectedSignerThumbprint -notmatch '^[0-9A-F]{40}$') {
        throw 'RTPT_WINDOWS_SIGNER_SHA1 must contain the approved 40-character Authenticode signer certificate thumbprint.'
    }

    foreach ($file in $Files | Where-Object { $_ -like '*.exe' }) {
        $signature = Get-AuthenticodeSignature -LiteralPath $file
        if ($signature.Status -ne 'Valid' -or -not $signature.SignerCertificate) {
            throw "Authenticode signature is not valid for '$file' (status: $($signature.Status))."
        }
        $actualSignerThumbprint = ([string]$signature.SignerCertificate.Thumbprint -replace '\s', '').ToUpperInvariant()
        if ($actualSignerThumbprint -cne $expectedSignerThumbprint) {
            throw "Authenticode signer mismatch for '$file'. Expected the approved RT-PT signer certificate."
        }
        if (-not $signature.TimeStamperCertificate) {
            throw "Authenticode signature for '$file' does not contain a trusted timestamp."
        }
    }
}

function Invoke-ReleaseSmokeAudit([string]$PackagedBuildDir = '') {
    $previousConfigOnly = $env:SMOKE_CONFIG_ONLY
    $previousPackagedDir = $env:SMOKE_PACKAGED_APP_DIR
    $previousAllowUnusableLicense = $env:SMOKE_ALLOW_UNUSABLE_LICENSE
    $previousAllowUnusableUpdateKey = $env:SMOKE_ALLOW_UNUSABLE_UPDATE_KEY
    try {
        $env:SMOKE_CONFIG_ONLY = '1'
        $env:SMOKE_PACKAGED_APP_DIR = $PackagedBuildDir
        $env:SMOKE_ALLOW_UNUSABLE_LICENSE = if ($AllowUnsignedDevelopmentBuild) { '1' } else { '' }
        $env:SMOKE_ALLOW_UNUSABLE_UPDATE_KEY = if ($AllowUnsignedDevelopmentBuild) { '1' } else { '' }
        Run node @((Join-Path $RepoRoot 'scripts/release-smoke.cjs'))
    } finally {
        $env:SMOKE_CONFIG_ONLY = $previousConfigOnly
        $env:SMOKE_PACKAGED_APP_DIR = $previousPackagedDir
        $env:SMOKE_ALLOW_UNUSABLE_LICENSE = $previousAllowUnusableLicense
        $env:SMOKE_ALLOW_UNUSABLE_UPDATE_KEY = $previousAllowUnusableUpdateKey
    }
}

Push-Location $RepoRoot
try {
    Write-Host "$ExpectedProductName release tool" -ForegroundColor Cyan
    Write-Host "Repository/update channel: $ExpectedRepo"

    if ($UploadOnly -and $AllowUnsignedDevelopmentBuild) {
        throw '-AllowUnsignedDevelopmentBuild is local-only and cannot be combined with -UploadOnly.'
    }
    if ($AllowUnsignedDevelopmentBuild -and -not [string]::IsNullOrWhiteSpace($Version)) {
        throw '-Version cannot be combined with -AllowUnsignedDevelopmentBuild; development packages use the current package version.'
    }

    $builder = Assert-ReleaseIdentity
    if ($AllowUnsignedDevelopmentBuild) {
        Assert-RtPtLicenseVerificationKey -AllowUnusableDevelopment
        Assert-RtPtUpdateVerificationKey -AllowUnusableDevelopment
    } else {
        Assert-RtPtLicenseVerificationKey
        Assert-RtPtUpdateVerificationKey
    }
    Invoke-ReleaseSmokeAudit

    $package = Get-Content -LiteralPath (Join-Path $RepoRoot 'package.json') -Raw | ConvertFrom-Json
    $currentVersion = [string]$package.version
    $targetVersion = if ($UploadOnly) {
        if ([string]::IsNullOrWhiteSpace($Version)) {
            throw '-UploadOnly requires -Version.'
        }
        $Version.TrimStart('v')
    } elseif ($AllowUnsignedDevelopmentBuild) {
        $currentVersion
    } elseif (-not [string]::IsNullOrWhiteSpace($Version)) {
        $Version.TrimStart('v')
    } else {
        Get-TargetVersion $currentVersion $Bump
    }

    if ($targetVersion -notmatch '^\d+\.\d+\.\d+$') {
        throw "Release version '$targetVersion' must be a stable semantic version."
    }

    $signingConfigured = Test-WindowsSigningConfigured $builder
    $skipSigning = $AllowUnsignedDevelopmentBuild -or $AllowUnsignedProductionRelease
    if (-not $UploadOnly -and -not $signingConfigured -and -not $skipSigning) {
        throw 'No Authenticode signing configuration was detected. Configure CSC_LINK/WIN_CSC_LINK or an electron-builder Windows signing provider. For a non-publishable local package only, pass -AllowUnsignedDevelopmentBuild.'
    }
    if (-not $skipSigning -and ([string]$env:RTPT_WINDOWS_SIGNER_SHA1 -replace '\s', '') -notmatch '^[0-9A-Fa-f]{40}$') {
        throw 'Set RTPT_WINDOWS_SIGNER_SHA1 to the independently approved Authenticode signer certificate thumbprint before a production or upload-only release.'
    }
    if ($AllowUnsignedProductionRelease) {
        # -UploadOnly is permitted here on purpose. Forbidding it looked safer but
        # created a dead end: an unsigned release that dies after pushing its tag
        # could not be resumed at all, since a fresh run then trips "tag already
        # exists". The signing decision is the operator's either way, and it must
        # be restated on the resuming command, so nothing is smuggled through.
        Write-Host 'UNSIGNED PRODUCTION RELEASE: shipping without Authenticode, matching v1.0.0-v1.0.3.' -ForegroundColor Yellow
        Write-Host '  SmartScreen will warn on first install until a certificate is obtained.' -ForegroundColor Yellow
    }

    $dirtyPaths = @(Get-WorkingTreeChanges)
    if ($DryRun) {
        $mode = if ($UploadOnly) { 'upload-only' } elseif ($AllowUnsignedDevelopmentBuild) { 'unsigned local development build' } else { 'signed production release' }
        Write-Host "Dry run: $mode for v$targetVersion. No files, Git refs, or remote releases will be changed." -ForegroundColor Yellow
        Write-Host "Signing configuration detected: $signingConfigured"
        if ($dirtyPaths.Count -gt 0) {
            Write-Host "Production release is currently blocked by $($dirtyPaths.Count) dirty path(s)." -ForegroundColor Yellow
        } else {
            Write-Host 'Working tree is clean.'
        }
        if ($UploadOnly) {
            if ([string]::IsNullOrWhiteSpace($BuildDir)) {
                throw '-UploadOnly requires -BuildDir below release-workspace.'
            }
            $dryBuildDir = Assert-PathInsideWorkspace $BuildDir -MustExist
            $dryFiles = @(Get-ReleaseFiles $dryBuildDir $targetVersion)
            Assert-AuthenticodeSigned $dryFiles
            Invoke-ReleaseSmokeAudit $dryBuildDir
        }
        return
    }

    if ($UploadOnly) {
        if ([string]::IsNullOrWhiteSpace($BuildDir)) {
            throw '-UploadOnly requires -BuildDir below release-workspace.'
        }
        $outputDir = Assert-PathInsideWorkspace $BuildDir -MustExist
    } else {
        if (-not $AllowUnsignedDevelopmentBuild) {
            Assert-CleanTree
        }

        Run npm @('run', 'lint')
        Run npm @('run', 'typecheck')
        Run npm @('test')

        if (-not $AllowUnsignedDevelopmentBuild) {
            Assert-CleanTree
            foreach ($relativePath in @('package.json', 'package-lock.json')) {
                $fullPath = Join-Path $RepoRoot $relativePath
                $versionFileSnapshots[$relativePath] = [System.IO.File]::ReadAllBytes($fullPath)
            }
            $versionFilesApplied = $true
            Run npm @('version', $targetVersion, '--no-git-tag-version')
            $package = Get-Content -LiteralPath (Join-Path $RepoRoot 'package.json') -Raw | ConvertFrom-Json
            $appliedVersion = [string]$package.version
            if ($appliedVersion -cne $targetVersion) {
                throw "npm version applied '$appliedVersion' instead of requested version '$targetVersion'."
            }
            Assert-OnlyVersionFilesChanged
        }

        # This is the release renderer build. Keep it after npm version so
        # Vite's __APP_VERSION__ matches electron-builder package metadata.
        Run npm @('run', 'build')
        Run npm @('run', 'smoke:release')

        Initialize-ReleaseWorkspace
        $outputDir = Join-Path $ReleaseWorkspace "build-v$targetVersion-$((Get-Date).ToString('yyyyMMdd-HHmmss'))-$PID"
        [void](Assert-PathInsideWorkspace $outputDir)
        if (Test-Path -LiteralPath $outputDir) {
            throw "Refusing to overwrite existing release directory: $outputDir"
        }
        New-Item -ItemType Directory -Path $outputDir | Out-Null

        $targets = @('electron-builder', '--win', 'nsis', '--x64', "--config.directories.output=$outputDir", '--publish', 'never')
        if ($IncludePortable) {
            $targets = @('electron-builder', '--win', 'nsis', 'portable', '--x64', "--config.directories.output=$outputDir", '--publish', 'never')
        }
        Run npx $targets
    }

    $files = @(Get-ReleaseFiles $outputDir $targetVersion)
    Invoke-ReleaseSmokeAudit $outputDir

    if ($AllowUnsignedDevelopmentBuild) {
        Write-Host "Unsigned local development package created at: $outputDir" -ForegroundColor Yellow
        Write-Host 'No version bump, commit, tag, push, GitHub release, or upload was performed.' -ForegroundColor Yellow
        return
    }

    if ($AllowUnsignedProductionRelease) {
        # Deliberately unsigned — see the switch's declaration. The assertion is
        # skipped rather than softened, so it still fails hard on a normal release
        # whose artifacts came back unsigned unexpectedly.
        Write-Host 'Skipping the Authenticode assertion for this explicitly unsigned release.' -ForegroundColor Yellow
    } else {
        Assert-AuthenticodeSigned $files
    }

    if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
        throw 'GitHub CLI is required. Install gh and run gh auth login.'
    }
    Run gh @('auth', 'status')

    $tag = "v$targetVersion"
    $notes = if ($Message) { $Message } else { "$ExpectedProductName $tag" }

    if (-not $UploadOnly) {
        & git -C $RepoRoot rev-parse --verify --quiet "refs/tags/$tag" 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) {
            throw "Local tag already exists: $tag"
        }

        Assert-OnlyVersionFilesChanged
        $versionFilesStaged = $true
        Run git @('-C', $RepoRoot, 'add', '--', 'package.json', 'package-lock.json')
        Assert-OnlyVersionFilesChanged
        Run git @('-C', $RepoRoot, 'commit', '-m', "release(rt-pt): $tag", '--', 'package.json', 'package-lock.json')
        $releaseCommitCreated = $true
        Run git @('-C', $RepoRoot, 'tag', '-a', $tag, '-m', $notes)
        Run git @('-C', $RepoRoot, 'push', 'origin', 'HEAD')
        Run git @('-C', $RepoRoot, 'push', 'origin', $tag)
    }

    # "Does this release exist?" is a question, not an error. gh prints
    # "release not found" on stderr when it does not, and with
    # $ErrorActionPreference = 'Stop' PowerShell turns any native stderr output
    # into a terminating NativeCommandError — killing the run at the exact point
    # it was about to create the release. Ask with stderr demoted, then branch on
    # the exit code alone.
    $previousErrorAction = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & gh release view $tag --repo $ExpectedRepo 2>&1 | Out-Null
    $releaseExists = ($LASTEXITCODE -eq 0)
    $ErrorActionPreference = $previousErrorAction
    if (-not $releaseExists) {
        Run gh @('release', 'create', $tag, '--repo', $ExpectedRepo, '--title', "$ExpectedProductName $tag", '--notes', $notes)
    }
    Run gh (@('release', 'upload', $tag, '--repo', $ExpectedRepo) + $files)

    Write-Host "$ExpectedProductName $tag published to https://github.com/$ExpectedRepo/releases/tag/$tag" -ForegroundColor Green
} finally {
    if ($versionFilesApplied -and -not $releaseCommitCreated) {
        if ($versionFilesStaged) {
            & git -C $RepoRoot restore --staged -- package.json package-lock.json 2>$null
            if ($LASTEXITCODE -ne 0) {
                Write-Warning 'Could not unstage package version files during rollback.'
            }
        }
        foreach ($relativePath in $versionFileSnapshots.Keys) {
            [System.IO.File]::WriteAllBytes(
                (Join-Path $RepoRoot $relativePath),
                [byte[]]$versionFileSnapshots[$relativePath]
            )
        }
        Write-Warning 'Release did not create its version commit; restored package.json and package-lock.json.'
    }
    Pop-Location
}
