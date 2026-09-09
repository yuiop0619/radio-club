param([Parameter(Mandatory=$true)][string]$SourceDirectory)
# prep-items.ps1 — 压缩新镜头图 / 菜品图到 assets/img
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$vibe = $SourceDirectory
$out  = "$root\assets\img"

function Save-Jpeg([string]$src, [string]$dst, [int]$w, [long]$q) {
  $img = New-Object System.Drawing.Bitmap($src)
  $h = [int]([math]::Round($img.Height * ($w / $img.Width)))
  $bmp = New-Object System.Drawing.Bitmap($img, $w, $h)
  $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
  $ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, $q)
  $bmp.Save($dst, $codec, $ep)
  $bmp.Dispose(); $img.Dispose()
}

# 人物镜头（第一人称递物）
$shots = @(
  @{ p = 'bt-iwao-menu';  w = 760 },
  @{ p = 'bt-lian-menu';  w = 760 },
  @{ p = 'det-push-form'; w = 760 }
)
# 菜品 / 饮品配图
$items = @('highball','milk','fizz','coffee','orange','water','ramen','steak','sandwich','onigiri')

foreach ($s in $shots) {
  $src = (Get-ChildItem "$vibe\$($s.p)_*.png" | Select-Object -First 1).FullName
  Save-Jpeg $src "$out\$($s.p).jpg" $s.w 82
}
foreach ($it in $items) {
  $src = (Get-ChildItem "$vibe\item-$($it)_*.png" | Select-Object -First 1).FullName
  Save-Jpeg $src "$out\item-$it.jpg" 300 82
}

Get-ChildItem "$out\bt-*.jpg","$out\det-push-form.jpg","$out\item-*.jpg" |
  Select-Object Name, @{n='KB';e={[int]($_.Length/1KB)}} | Format-Table -AutoSize
Write-Host 'prep-items done'
