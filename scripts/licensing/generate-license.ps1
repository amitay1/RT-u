# ScanMaster License Generator
# Usage from repo root: .\scripts\licensing\generate-license.ps1

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   ScanMaster License Generator" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get factory name
$factoryName = Read-Host "Enter factory name (e.g., 'Acme Corp')"
if ([string]::IsNullOrWhiteSpace($factoryName)) {
    $factoryName = "Default Factory"
}

Write-Host ""
Write-Host "Available Standards:" -ForegroundColor Yellow
Write-Host "  AMS  - Aerospace Material Specification ($500)"
Write-Host "  ASTM - Steel Forgings ($500)"
Write-Host "  BS3  - European Steel Standards Part 3 ($500)"
Write-Host "  BS4  - European Steel Standards Part 4 ($500)"
Write-Host "  MIL  - Military Standard ($800)"
Write-Host "  ALL  - All standards ($2800)"
Write-Host ""

$standardsInput = Read-Host "Enter standards (comma separated, or 'ALL')"
if ([string]::IsNullOrWhiteSpace($standardsInput) -or $standardsInput.ToUpper() -eq "ALL") {
    $standards = "AMS,ASTM,BS3,BS4,MIL"
} else {
    $standards = $standardsInput.ToUpper().Replace(" ", "")
}

Write-Host ""
$lifetimeChoice = Read-Host "Lifetime license? (Y/n)"
if ($lifetimeChoice.ToLower() -eq "n") {
    $expiryDate = Read-Host "Enter expiry date (YYYY-MM-DD)"
    $expiryArgs = @("--expiry", $expiryDate)
} else {
    $expiryArgs = @("--lifetime")
}

Write-Host ""
Write-Host "Generating license..." -ForegroundColor Green
Write-Host ""

# Run the generator from the repository root so relative output paths stay stable.
Push-Location $repoRoot
try {
    & node "scripts/license-generator.cjs" --factory $factoryName --standards $standards @expiryArgs
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "Done! Copy the LICENSE KEY above and give it to the customer." -ForegroundColor Green
Write-Host ""
