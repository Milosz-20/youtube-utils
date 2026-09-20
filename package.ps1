# Bumps the version in manifest.json and builds a zip ready to upload to addons.mozilla.org.
#
#   .\package.ps1          -> 1.0.0 becomes 1.0.1 (patch)
#   .\package.ps1 minor    -> 1.0.1 becomes 1.1.0
#   .\package.ps1 major    -> 1.1.0 becomes 2.0.0
#   .\package.ps1 -Version 1.4.2   -> exact version
#   .\package.ps1 -NoBump  -> keep the current version, just rebuild the zip

param(
  [ValidateSet('patch', 'minor', 'major')]
  [string]$Part = 'patch',
  [string]$Version,
  [switch]$NoBump
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem

$root = $PSScriptRoot
$manifestPath = Join-Path $root 'manifest.json'
$raw = Get-Content $manifestPath -Raw
$current = ([regex]'"version"\s*:\s*"([^"]+)"').Match($raw).Groups[1].Value
if (-not $current) { throw "No version found in manifest.json" }

if ($Version) {
  $new = $Version
} elseif ($NoBump) {
  $new = $current
} else {
  $n = $current.Split('.')
  switch ($Part) {
    'major' { $new = "$([int]$n[0] + 1).0.0" }
    'minor' { $new = "$($n[0]).$([int]$n[1] + 1).0" }
    default { $new = "$($n[0]).$($n[1]).$([int]$n[2] + 1)" }
  }
}

if ($new -ne $current) {
  # Replace only the top-level "version" line, not any other occurrence.
  $updated = [regex]::Replace($raw, '"version"\s*:\s*"[^"]+"', """version"": ""$new""", 1)
  Set-Content $manifestPath $updated -Encoding utf8 -NoNewline
  Write-Host "manifest.json: $current -> $new"
} else {
  Write-Host "version stays $new"
}

# Fail early if the edit broke the JSON.
Get-Content $manifestPath -Raw | ConvertFrom-Json | Out-Null

$zip = Join-Path (Split-Path $root -Parent) "youtube-utils-$new.zip"
if (Test-Path $zip) { Remove-Item $zip }
$archive = [System.IO.Compression.ZipFile]::Open($zip, 'Create')
try {
  Get-ChildItem -Path $root -Recurse -File -Force |
    Where-Object { $_.FullName -notmatch '\\\.git\\' -and $_.Name -notin @('.gitignore', 'package.ps1') -and $_.Extension -ne '.zip' -and $_.Extension -ne '.xpi' } |
    ForEach-Object {
      # Zip entries must use forward slashes or Firefox/AMO may reject the package.
      $name = $_.FullName.Substring($root.Length + 1).Replace('\', '/')
      [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $_.FullName, $name)
    }
} finally {
  $archive.Dispose()
}

Write-Host "built: $zip"
Write-Host "upload it at https://addons.mozilla.org/developers/addon/youtube-utils/versions/submit/ (choose: On your own)"
