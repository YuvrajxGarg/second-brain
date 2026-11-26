# Save the clipboard, a screen snip or typed text to the second brain's inbox/ (Windows).
#
#   brain-capture.ps1 -Mode clip     clipboard: text, a link, an image, or a copied image file
#   brain-capture.ps1 -Mode snip     opens the Snipping Tool overlay, sends the snip
#   brain-capture.ps1 -Mode type     a box to type a thought
#   brain-capture.ps1 -Mode test     check the key works
#   brain-capture.ps1 -Mode file <paths>   used by Explorer's "Send to > Second Brain":
#                                    images are sent as images, text files as text
# Add -NoNote to skip the "Add a note" box.
#
# Needs Windows PowerShell 5.1 (built in) in STA mode, which is its default. The key is
# read from $env:BRAIN_CAPTURE_KEY or %USERPROFILE%\.brain-capture\key (install.ps1
# writes it). The tray app (brain-tray.ps1) dot-sources this file and calls Send-Brain.

param(
  [ValidateSet("clip", "snip", "type", "test", "file", "none")] [string] $Mode = "none",
  [switch] $NoNote,
  [Parameter(ValueFromRemainingArguments = $true)] [string[]] $Paths
)

Add-Type -AssemblyName System.Windows.Forms, System.Drawing, Microsoft.VisualBasic
if (-not ("BrainCapture.Clip" -as [type])) {
  Add-Type -Namespace BrainCapture -Name Clip -MemberDefinition '[DllImport("user32.dll")] public static extern uint GetClipboardSequenceNumber();'
}

$script:BrainEndpoint = if ($env:BRAIN_CAPTURE_URL) { $env:BRAIN_CAPTURE_URL } else { "https://brainy.pxlvzn.in/api/capture" }
$script:BrainKeyFile = Join-Path $env:USERPROFILE ".brain-capture\key"

function Get-BrainKey {
  if ($env:BRAIN_CAPTURE_KEY) { return $env:BRAIN_CAPTURE_KEY }
  if (Test-Path $script:BrainKeyFile) { return (Get-Content $script:BrainKeyFile -Raw).Trim() }
  return ""
}

function Show-BrainToast([string] $msg) {
  $n = New-Object System.Windows.Forms.NotifyIcon
  $n.Icon = [System.Drawing.SystemIcons]::Information
  $n.Visible = $true
  $n.ShowBalloonTip(4000, "Brain", $msg, [System.Windows.Forms.ToolTipIcon]::None)
  Start-Sleep -Seconds 4
  $n.Dispose()
}

# Shrinks to max 1800 px and re-encodes as JPEG (quality 75), returns base64.
function ConvertTo-BrainJpeg([System.Drawing.Image] $img) {
  $max = 1800
  $scale = [Math]::Min(1.0, $max / [Math]::Max($img.Width, $img.Height))
  $w = [int]($img.Width * $scale); $h = [int]($img.Height * $scale)
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.Clear([System.Drawing.Color]::White)
  $g.DrawImage($img, 0, 0, $w, $h)
  $g.Dispose()
  $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
  $params = New-Object System.Drawing.Imaging.EncoderParameters 1
  $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), ([long]75)
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, $codec, $params)
  $bmp.Dispose()
  return [Convert]::ToBase64String($ms.ToArray())
}

function Read-BrainNote([string] $prompt = "Add a note (why you're saving it). Leave blank to skip.") {
  return [Microsoft.VisualBasic.Interaction]::InputBox($prompt, "Save to brain", "")
}

# Reads the clipboard: @{ text = ...; image = [Image] or $null }
function Get-BrainClipboard {
  $out = @{ text = ""; image = $null }
  if ([System.Windows.Forms.Clipboard]::ContainsImage()) {
    $out.image = [System.Windows.Forms.Clipboard]::GetImage()
  } elseif ([System.Windows.Forms.Clipboard]::ContainsFileDropList()) {
    $f = [System.Windows.Forms.Clipboard]::GetFileDropList()[0]
    if ($f -match '\.(png|jpe?g|gif|bmp|webp|tiff?)$') { $out.image = [System.Drawing.Image]::FromFile($f) }
    else { $out.text = [System.IO.Path]::GetFileName($f) }
  } elseif ([System.Windows.Forms.Clipboard]::ContainsText()) {
    $out.text = [System.Windows.Forms.Clipboard]::GetText()
  }
  return $out
}

# Opens the snip overlay and waits (up to 60 s) for a new image on the clipboard.
function Get-BrainSnip {
  $before = [BrainCapture.Clip]::GetClipboardSequenceNumber()
  Start-Process "ms-screenclip:"
  $deadline = (Get-Date).AddSeconds(60)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 300
    [System.Windows.Forms.Application]::DoEvents()
    if ([BrainCapture.Clip]::GetClipboardSequenceNumber() -ne $before -and [System.Windows.Forms.Clipboard]::ContainsImage()) {
      return [System.Windows.Forms.Clipboard]::GetImage()
    }
  }
  return $null
}

function Send-Brain {
  param([string] $Text = "", [System.Drawing.Image] $Image = $null, [string] $Note = "", [string] $Via = "Windows hotkey")
  $key = Get-BrainKey
  if (-not $key) { return "No capture key. Run install.ps1 first." }
  $body = @{ text = $Text; note = $Note; via = $Via }
  if ($Image) { $body.image = ConvertTo-BrainJpeg $Image }
  $json = $body | ConvertTo-Json -Compress
  try {
    $r = Invoke-WebRequest -Uri $script:BrainEndpoint -Method Post -UseBasicParsing -TimeoutSec 45 `
      -Headers @{ Authorization = "Bearer $key" } -ContentType "application/json; charset=utf-8" `
      -Body ([System.Text.Encoding]::UTF8.GetBytes($json))
    return [System.Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray())
  } catch {
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) { return $_.ErrorDetails.Message }
    return "Not saved: $($_.Exception.Message)"
  }
}

# One capture per file: images as images, text-like files as their text, anything else by name.
function Send-BrainFiles([string[]] $Paths, [switch] $NoNote) {
  $files = @($Paths | Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Leaf) })
  if (-not $files.Count) { return "Nothing to save." }
  $note = if ($NoNote) { "" } else { Read-BrainNote ("Add a note for " + $(if ($files.Count -eq 1) { [IO.Path]::GetFileName($files[0]) } else { "$($files.Count) files" }) + " (optional).") }
  $msgs = foreach ($f in $files) {
    $name = [IO.Path]::GetFileName($f)
    if ($f -match '\.(png|jpe?g|gif|bmp|webp|tiff?)$') {
      $img = [System.Drawing.Image]::FromFile($f)
      try { Send-Brain -Text "" -Image $img -Note $note -Via "Windows Send to" } finally { $img.Dispose() }
    } elseif ($f -match '\.(txt|md|markdown|url|csv|json|log)$') {
      $t = Get-Content -LiteralPath $f -Raw -Encoding UTF8
      if ($f -match '\.url$' -and $t -match 'URL=(\S+)') { $t = $Matches[1] }
      Send-Brain -Text $t -Note $note -Via "Windows Send to"
    } else {
      Send-Brain -Text "File: $name" -Note $note -Via "Windows Send to"
    }
  }
  return ($msgs -join "`n")
}

function Invoke-BrainCapture([string] $Mode, [switch] $NoNote, [switch] $Quiet, [string[]] $Paths) {
  $text = ""; $img = $null; $via = "Windows hotkey"
  switch ($Mode) {
    "file" {
      $msg = Send-BrainFiles -Paths $Paths -NoNote:$NoNote
      if (-not $Quiet) { Show-BrainToast $msg }
      return $msg
    }
    "test" {
      try {
        $r = Invoke-WebRequest -Uri $script:BrainEndpoint -UseBasicParsing -TimeoutSec 15 -Headers @{ Authorization = "Bearer $(Get-BrainKey)" }
        return $r.Content
      } catch { return "Key test failed: $($_.ErrorDetails.Message) $($_.Exception.Message)" }
    }
    "clip" { $c = Get-BrainClipboard; $text = $c.text; $img = $c.image }
    "snip" { $via = "Windows snip"; $img = Get-BrainSnip; if (-not $img) { return "" } }
    "type" {
      $via = "Windows tray"
      $text = Read-BrainNote "Type a thought, idea or link:"
      if (-not $text.Trim()) { return "" }
      $NoNote = $true
    }
  }
  if (-not $img -and -not $text.Trim()) { $msg = "Clipboard is empty, nothing saved."; if (-not $Quiet) { Show-BrainToast $msg }; return $msg }
  $note = if ($NoNote) { "" } else { Read-BrainNote }
  $msg = Send-Brain -Text $text -Image $img -Note $note -Via $via
  if (-not $Quiet) { Show-BrainToast $msg }
  return $msg
}

if ($Mode -ne "none") { Invoke-BrainCapture -Mode $Mode -NoNote:$NoNote -Paths $Paths }
