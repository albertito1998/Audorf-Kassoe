param(
  [switch]$SkipStatus,
  [switch]$UpdateCatastro,
  [switch]$ConvertDxf,
  [switch]$SkipGit,
  [string]$CommitMessage = "Update WebGIS data",
  [string]$DxfPath = "02_CAD/export_autocad.dxf"
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
  Write-Step "Converting DXF WBK layers to web GeoJSON"

  $Ogr2Ogr = "ogr2ogr"
  if (-not (Get-Command $Ogr2Ogr -ErrorAction SilentlyContinue)) {
    $QgisOgr2Ogr = @(
      "C:\Program Files\QGIS 3.40.13\bin\ogr2ogr.exe",
      "C:\Program Files\QGIS 3.34.15\bin\ogr2ogr.exe"
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1

    if (-not $QgisOgr2Ogr) {
      throw "ogr2ogr not found. Install QGIS/GDAL or add ogr2ogr to PATH."
    }
    $Ogr2Ogr = $QgisOgr2Ogr
  }

  $ResolvedDxf = Resolve-Path $DxfPath

  $LayerMap = [ordered]@{
    "WBK_WEG_BEST"       = "05_WEB/data/wbk_weg_best.geojson"
    "WBK_WEG_TEMP"       = "05_WEB/data/wbk_weg_temp.geojson"
    "WBK_ARBEITSFLAECHE" = "05_WEB/data/wbk_arbeitsflaeche.geojson"
    "WBK_GERUEST"        = "05_WEB/data/wbk_geruest.geojson"
    "WBK_AUSHOLZUNG"     = "05_WEB/data/wbk_ausholzung.geojson"
    "WBK_SCHUTZNETZ"     = "05_WEB/data/wbk_schutznetz.geojson"
    "WBK_SPERRUNG"       = "05_WEB/data/wbk_sperrung.geojson"
  }

  foreach ($LayerName in $LayerMap.Keys) {
    $OutputPath = Join-Path $RepoRoot $LayerMap[$LayerName]
    $OutputDir = Split-Path -Parent $OutputPath
    New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

    $TmpPath = "$OutputPath.tmp"
    if (Test-Path $TmpPath) {
      Remove-Item -LiteralPath $TmpPath -Force
    }

    Write-Host "Converting $LayerName -> $($LayerMap[$LayerName])"
    & $Ogr2Ogr `
      -f "GeoJSON" `
      -s_srs "EPSG:25832" `
      -t_srs "EPSG:4326" `
      -dim "XY" `
      -where "Layer='$LayerName'" `
      $TmpPath `
      $ResolvedDxf `
      "entities"

    if (-not (Test-Path $TmpPath)) {
      throw "DXF conversion did not create $TmpPath"
    }

    Move-Item -LiteralPath $TmpPath -Destination $OutputPath -Force
  }
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
