#!/usr/bin/env pwsh
# ============================================================================
# Rebuild the published video with the new v5 narration audio.
# ============================================================================
# Takes the original backup video + the new v5 master voiceover and produces
# a re-encoded version at public/videos/ with:
#   - 30 fps (down from 60 fps in the original)
#   - H.264 CRF 22 (high quality, smaller file)
#   - AAC 128 kbps mono 48 kHz audio (from the new v5 voiceover)
#   - faststart flag (for instant web playback - first byte plays immediately)
#
# Run AFTER concat-v5-narration.ps1 has produced the master VO.
#
# Requires: ffmpeg in PATH
# ============================================================================

$ErrorActionPreference = "Stop"
$ProjectRoot = "C:\Users\Amita\Downloads\Scan-Master-16-12-25-main\Scan-Master-16-12-25-main"
$VideoDir    = "$ProjectRoot\public\videos"
$AudioDir    = "$ProjectRoot\training-videos\assets\tube-scan-plan\audio"

$sourceVideo = "$VideoDir\tube-scan-plan-tcg-calibration-original-backup.mp4"
$sourceAudio = "$AudioDir\voiceover-tube-scan-plan-v5-master.mp3"
$outputVideo = "$VideoDir\tube-scan-plan-tcg-calibration-v5.mp4"

# Validate inputs
if (-not (Test-Path $sourceVideo)) {
    Write-Error "Source video not found: $sourceVideo"
    exit 1
}
if (-not (Test-Path $sourceAudio)) {
    Write-Error "Master VO not found - run concat-v5-narration.ps1 first"
    exit 1
}

Write-Host "Source video: $sourceVideo"
Write-Host "Source audio: $sourceAudio"
Write-Host "Output:       $outputVideo"
Write-Host ""

# Get durations to verify they match
$vidDur = [double]((ffprobe -v error -show_entries format=duration -of csv=p=0 $sourceVideo).Trim())
$audDur = [double]((ffprobe -v error -show_entries format=duration -of csv=p=0 $sourceAudio).Trim())
Write-Host "Video duration: $([math]::Round($vidDur, 2))s"
Write-Host "Audio duration: $([math]::Round($audDur, 2))s"
$drift = [math]::Round($audDur - $vidDur, 2)
Write-Host "Drift:          $drift s (audio - video)"
Write-Host ""

if ([math]::Abs($drift) -gt 10) {
    Write-Warning "Audio and video durations differ by more than 10 s."
    Write-Warning "The new v5 narration is likely a different length than the original visuals."
    Write-Warning "Consider re-cutting the video to match the new VO timing."
    $confirm = Read-Host "Continue anyway? (y/N)"
    if ($confirm -ne "y") { exit 0 }
}

# Re-encode: drop original audio, mux in new audio, downscale fps
Write-Host "Re-encoding... (this may take 1-3 minutes)"
ffmpeg -y `
    -i $sourceVideo `
    -i $sourceAudio `
    -map 0:v:0 -map 1:a:0 `
    -c:v libx264 -preset medium -crf 22 -r 30 -pix_fmt yuv420p `
    -c:a aac -b:a 128k -ar 48000 -ac 1 `
    -movflags +faststart `
    -shortest `
    $outputVideo

if (-not (Test-Path $outputVideo)) {
    Write-Error "Re-encode failed"
    exit 1
}

$origSize = (Get-Item $sourceVideo).Length / 1MB
$newSize  = (Get-Item $outputVideo).Length / 1MB
Write-Host ""
Write-Host "✅ Re-encoded video:"
Write-Host "   $outputVideo"
Write-Host "   $([math]::Round($origSize, 2)) MB → $([math]::Round($newSize, 2)) MB ($([math]::Round(100 - ($newSize / $origSize * 100)))% smaller)"
Write-Host ""
Write-Host "To replace the live video:"
Write-Host "   Move-Item '$outputVideo' '$VideoDir\tube-scan-plan-tcg-calibration.mp4' -Force"
