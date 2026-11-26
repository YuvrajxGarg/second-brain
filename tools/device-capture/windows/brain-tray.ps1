# Tray icon for the second brain (Windows). Right-click it for: save clipboard, snip,
# type a thought, open the brain. Double-click = snip. install.ps1 starts it at login.
# Hotkeys (Ctrl+Alt+B clipboard, Ctrl+Alt+Shift+B snip) are Start Menu shortcuts made by
# install.ps1, so they work with or without the tray icon running.

. (Join-Path $PSScriptRoot "brain-capture.ps1")

# A small "B" icon drawn at runtime, so there is no .ico file to ship.
$bmp = New-Object System.Drawing.Bitmap 32, 32
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = "AntiAlias"; $g.TextRenderingHint = "AntiAliasGridFit"
$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 122, 69))), 0, 0, 31, 31)
$font = New-Object System.Drawing.Font "Segoe UI", 15, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
$sf = New-Object System.Drawing.StringFormat; $sf.Alignment = "Center"; $sf.LineAlignment = "Center"
$g.DrawString("B", $font, [System.Drawing.Brushes]::White, (New-Object System.Drawing.RectangleF 0, 1, 32, 32), $sf)
$g.Dispose()

$tray = New-Object System.Windows.Forms.NotifyIcon
$tray.Icon = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
$tray.Text = "Second Brain capture"
$tray.Visible = $true

function Run-Capture([string] $mode) {
  $tray.Text = "Saving to brain..."
  $msg = Invoke-BrainCapture -Mode $mode -Quiet
  $tray.Text = "Second Brain capture"
  if ($msg) { $tray.ShowBalloonTip(4000, "Brain", $msg, [System.Windows.Forms.ToolTipIcon]::None) }
}

$menu = New-Object System.Windows.Forms.ContextMenuStrip
[void] $menu.Items.Add("Save clipboard to brain", $null, { Run-Capture "clip" })
[void] $menu.Items.Add("Snip to brain", $null, { Run-Capture "snip" })
[void] $menu.Items.Add("Type a thought...", $null, { Run-Capture "type" })
[void] $menu.Items.Add("-")
[void] $menu.Items.Add("Open brain site", $null, { Start-Process "https://brainy.pxlvzn.in" })
[void] $menu.Items.Add("Test key", $null, { $tray.ShowBalloonTip(4000, "Brain", (Invoke-BrainCapture -Mode test), [System.Windows.Forms.ToolTipIcon]::None) })
[void] $menu.Items.Add("Quit", $null, { $tray.Visible = $false; $tray.Dispose(); [System.Windows.Forms.Application]::Exit() })
$tray.ContextMenuStrip = $menu
$tray.add_DoubleClick({ Run-Capture "snip" })

[System.Windows.Forms.Application]::Run()
