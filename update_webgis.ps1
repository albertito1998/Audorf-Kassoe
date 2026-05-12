param(
  [switch]$SkipStatus,
  [switch]$UpdateCatastro,
  [switch]$ConvertDxf,
  [switch]$SkipGit,
  [string]$CommitMessage = "Update WebGIS data",
  [string]$DxfPath = "02_CAD/export_autocad.dxf",
  [string]$DxfOutput = "05_WEB/data/export_autocad.geojson"
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Require-Command {
  param([string]$CommandName, [string]$Help)
  if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
    throw "$CommandName not found. $Help"
  }
}

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RepoRoot

Write-Step "Using repository"
Write-Host $RepoRoot

$Python = $null
if (Get-Command py -ErrorAction SilentlyContinue) {
  $Python = "py"
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
  $Python = "python"
} else {
  throw "Python not found. Install Python or add it to PATH."
}

if (-not $SkipStatus) {
  Write-Step "Updating STATUS GENEHMIGUNG from Excel"
  & $Python "05_WEB/tools/build_status_genehmigung.py"
}

if ($UpdateCatastro) {
  Write-Step "Updating local Kataster WFS GeoJSON"
  & $Python "05_WEB/tools/build_catastro_wfs_geojson.py"
}

if ($ConvertDxf) {
  Write-Step "Converting DXF to GeoJSON"
  Require-Command "ogr2ogr" "Install QGIS/GDAL and make sure ogr2ogr is available in PATH."

  $ResolvedDxf = Resolve-Path $DxfPath
  $OutputPath = Join-Path $RepoRoot $DxfOutput
  $OutputDir = Split-Path -Parent $OutputPath
  New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

  if (Test-Path $OutputPath) {
    Remove-Item -LiteralPath $OutputPath -Force
  }

  & ogr2ogr `
    -f "GeoJSON" `
    -t_srs "EPSG:4326" `
    $OutputPath `
    $ResolvedDxf

  Write-Host "DXF converted to $DxfOutput"
}

Write-Step "Updating header date"
$IndexPath = Join-Path $RepoRoot "05_WEB/index.html"
$Today = Get-Date -Format "dd.MM.yyyy"
$IndexHtml = Get-Content -LiteralPath $IndexPath -Raw -Encoding UTF8
$IndexHtml = [regex]::Replace(
  $IndexHtml,
  "Estado actualizado:\s*\d{2}\.\d{2}\.\d{4}",
  "Estado actualizado: $Today"
)
$IndexHtml = $IndexHtml.TrimEnd() + [Environment]::NewLine
[System.IO.File]::WriteAllText($IndexPath, $IndexHtml, [System.Text.Encoding]::UTF8)
Write-Host "Estado actualizado: $Today"

Write-Step "Validating required web files"
$RequiredFiles = @(
  "05_WEB/index.html",
  "05_WEB/app.js",
  "05_WEB/style.css",
  "05_WEB/data/status_genehmigung.geojson",
  "05_WEB/data/catastro_flurstueck.geojson",
  "05_WEB/data/trassenachse_gesamt.geojson",
  "05_WEB/data/torres_masten.geojson"
)

foreach ($File in $RequiredFiles) {
  if (-not (Test-Path (Join-Path $RepoRoot $File))) {
    throw "Missing required file: $File"
  }
}

if ($SkipGit) {
  Write-Step "Skipping git commit/push"
  git status --short
  exit 0
}

Write-Step "Committing and pushing to GitHub"
Require-Command "git" "Install Git or run this script from Git Bash/PowerShell with Git in PATH."

git status --short
git add -A

$PendingChanges = git diff --cached --name-only
if (-not $PendingChanges) {
  Write-Host "No changes to commit."
} else {
  git commit -m $CommitMessage
}

git push origin main

Write-Step "Done"
Write-Host "GitHub Pages deploy will start from the main branch push."
