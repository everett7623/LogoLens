# 生成 dist/chrome-mv3（可加载目录）与 dist/logolens-<version>-chrome.zip
# 用法：在仓库根目录执行  .\pack.ps1
$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
Set-Location $root

$version = (Get-Content (Join-Path $root "manifest.json") -Raw -Encoding UTF8 | ConvertFrom-Json).version
$dist = Join-Path $root "dist"
$chrome = Join-Path $dist "chrome-mv3"
$zipName = "logolens-$version-chrome.zip"
$zipPath = Join-Path $dist $zipName

$items = @(
  "manifest.json",
  "popup.html",
  "popup.css",
  "popup.js",
  "extractor.js",
  "options.html",
  "privacy.html",
  "PRIVACY.md",
  "LICENSE",
  "icons"
)

Remove-Item $dist -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $chrome | Out-Null

foreach ($item in $items) {
  $src = Join-Path $root $item
  if (-not (Test-Path $src)) {
    throw "缺少打包文件: $item"
  }
  Copy-Item -Path $src -Destination (Join-Path $chrome $item) -Recurse -Force
}

Compress-Archive -Path (Join-Path $chrome "*") -DestinationPath $zipPath -CompressionLevel Optimal

Write-Host "OK  dist/chrome-mv3"
Write-Host "OK  dist/$zipName"
Get-Item $chrome, $zipPath | Format-Table Name, Mode, Length, LastWriteTime
