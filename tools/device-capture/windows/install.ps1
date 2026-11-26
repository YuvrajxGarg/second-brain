# One-time Windows setup. In PowerShell:
#   powershell -ExecutionPolicy Bypass -File install.ps1
# Copies the scripts to %LOCALAPPDATA%\BrainCapture, saves your capture key, makes the
# hotkeys (Start Menu shortcuts) and starts the tray icon now and at every login.

$ErrorActionPreference = "Stop"
$dest = Join-Path $env:LOCALAPPDATA "BrainCapture"
New-Item -ItemType Directory -Force -Path $dest | Out-Null
$raw = "https://raw.githubusercontent.com/YuvrajxGarg/second-brain/main/tools/device-capture/windows"
foreach ($f in "brain-capture.ps1", "brain-tray.ps1") {
  $src = if ($PSScriptRoot) { Join-Path $PSScriptRoot $f } else { "" }
  if ($src -and (Test-Path $src)) { Copy-Item $src (Join-Path $dest $f) -Force }
  else { Invoke-WebRequest "$raw/$f" -UseBasicParsing -OutFile (Join-Path $dest $f) }
}

$keyDir = Join-Path $env:USERPROFILE ".brain-capture"
New-Item -ItemType Directory -Force -Path $keyDir | Out-Null
$sec = Read-Host "Paste your capture key (the part after ?key= in the brain connector link)" -AsSecureString
$key = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)).Trim()
if (-not $key) { throw "No key given." }
Set-Content -Path (Join-Path $keyDir "key") -Value $key -NoNewline -Encoding ASCII

$ps = Join-Path $env:WINDIR "System32\WindowsPowerShell\v1.0\powershell.exe"
$shell = New-Object -ComObject WScript.Shell
function New-Link([string] $path, [string] $arguments, [string] $hotkey) {
  $l = $shell.CreateShortcut($path)
  $l.TargetPath = $ps
  $l.Arguments = "-NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden $arguments"
  $l.WorkingDirectory = $dest
  $l.WindowStyle = 7   # minimized, so no console flashes up
  if ($hotkey) { $l.Hotkey = $hotkey }
  $l.Save()
}
$start = Join-Path ([Environment]::GetFolderPath("Programs")) "Second Brain"
New-Item -ItemType Directory -Force -Path $start | Out-Null
New-Link (Join-Path $start "Brain - save clipboard.lnk") "-File `"$dest\brain-capture.ps1`" -Mode clip" "CTRL+ALT+B"
New-Link (Join-Path $start "Brain - snip.lnk") "-File `"$dest\brain-capture.ps1`" -Mode snip" "CTRL+ALT+SHIFT+B"
New-Link (Join-Path $start "Brain - tray.lnk") "-File `"$dest\brain-tray.ps1`"" ""
New-Link (Join-Path ([Environment]::GetFolderPath("Startup")) "Brain tray.lnk") "-File `"$dest\brain-tray.ps1`"" ""

Write-Host "Testing the key..."
& $ps -NoProfile -ExecutionPolicy Bypass -STA -File "$dest\brain-capture.ps1" -Mode test
Start-Process $ps -ArgumentList "-NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File `"$dest\brain-tray.ps1`"" -WindowStyle Hidden
Write-Host ""
Write-Host "Done. Ctrl+Alt+B saves the clipboard, Ctrl+Alt+Shift+B snips. The orange B tray icon has the rest."
