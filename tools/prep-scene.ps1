param([Parameter(Mandatory=$true)][string]$SourceDirectory)
# prep-scene.ps1 — 场景素材处理
#  1) 背景图（scene-hall / scene-seated）: PNG -> 缩放 -> JPEG(q84)
#  2) 人物立绘（fig-detective-bar / fig-bartender-serve）: 黑底抠透明(max-channel key) -> 缩放 -> PNG
# 用法: powershell -ExecutionPolicy Bypass -File tools\prep-scene.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$vibe = $SourceDirectory
$out  = "$root\assets\img"

function Save-Jpeg([System.Drawing.Image]$img, [string]$path, [int]$w, [long]$q) {
  $h = [int]([math]::Round($img.Height * ($w / $img.Width)))
  $bmp = New-Object System.Drawing.Bitmap($img, $w, $h)
  $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
  $ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, $q)
  $bmp.Save($path, $codec, $ep)
  $bmp.Dispose()
}

# 黑底抠透明：先缩放到 32bppArgb 目标位图，再按 alpha = clamp((max(R,G,B) - lo)/(hi-lo)) 抠除黑底
function Keyout-Save([string]$src, [string]$dst, [int]$w, [int]$lo, [int]$hi) {
  $srcImg = New-Object System.Drawing.Bitmap($src)
  $h = [int]([math]::Round($srcImg.Height * ($w / $srcImg.Width)))
  $img = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($img)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($srcImg, 0, 0, $w, $h)
  $g.Dispose(); $srcImg.Dispose()

  $rect = New-Object System.Drawing.Rectangle(0, 0, $img.Width, $img.Height)
  $bd = $img.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $len = $bd.Stride * $bd.Height
  $bytes = New-Object byte[] $len
  [System.Runtime.InteropServices.Marshal]::Copy($bd.Scan0, $bytes, 0, $len)
  $range = [double]($hi - $lo)
  for ($y = 0; $y -lt $bd.Height; $y++) {
    $row = $y * $bd.Stride
    for ($x = 0; $x -lt $bd.Width; $x++) {
      $p = $row + $x * 4
      $b = $bytes[$p]; $g2 = $bytes[$p + 1]; $r = $bytes[$p + 2]
      $mx = $r; if ($g2 -gt $mx) { $mx = $g2 }; if ($b -gt $mx) { $mx = $b }
      $a = ($mx - $lo) / $range
      if ($a -lt 0) { $a = 0 }; if ($a -gt 1) { $a = 1 }
      $bytes[$p + 3] = [byte]([math]::Round($a * 255))
    }
  }
  [System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $bd.Scan0, $len)
  $img.UnlockBits($bd)
  $img.Save($dst, [System.Drawing.Imaging.ImageFormat]::Png)
  $img.Dispose()
}

# --- 背景 ---
Save-Jpeg (New-Object System.Drawing.Bitmap("$vibe\scene-hall_1788773007.png"))   "$out\scene-hall.jpg"   1600 84
Save-Jpeg (New-Object System.Drawing.Bitmap("$vibe\scene-seated_1788773002.png")) "$out\scene-seated.jpg" 1600 84

# --- 人物立绘（抠透明） ---
Keyout-Save "$vibe\fig-detective-bar_1788772992.png"  "$out\fig-detective.png" 620 14 60
Keyout-Save "$vibe\fig-bartender-serve_1788772991.png" "$out\fig-serve.png"    620 14 60

Get-ChildItem "$out\scene-hall.jpg","$out\scene-seated.jpg","$out\fig-detective.png","$out\fig-serve.png" |
  Select-Object Name, @{n='KB';e={[int]($_.Length/1KB)}} | Format-Table -AutoSize
Write-Host 'prep-scene done'
