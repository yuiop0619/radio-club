param([Parameter(Mandatory=$true)][string]$SourceDirectory)
# 将美术素材压缩为网页尺寸 JPEG，降低页面加载体积
Add-Type -AssemblyName System.Drawing
$img = Join-Path (Split-Path -Parent $PSScriptRoot) 'assets/img'
$srcDir = $SourceDirectory
$jobs = @(
  @{ src = "$srcDir\bartenders-friendly_1788765833.png"; out = 'bartenders'; scale = 0.80 },
  @{ src = "$srcDir\detective-calm_1788765829.png";       out = 'detective';  scale = 0.85 }
)
foreach ($j in $jobs) {
  if (-not (Test-Path $j.src)) { Write-Host ("skip " + $j.src); continue }
  $src = [System.Drawing.Image]::FromFile($j.src)
  $w = [int]($src.Width * $j.scale)
  $h = [int]($src.Height * $j.scale)
  $bmp = New-Object System.Drawing.Bitmap($w, $h)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($src, 0, 0, $w, $h)
  $g.Dispose(); $src.Dispose()
  $enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
         Where-Object { $_.MimeType -eq 'image/jpeg' }
  $ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
    [System.Drawing.Imaging.Encoder]::Quality, [long]84)
  $out = Join-Path $img ($j.out + '.jpg')
  $bmp.Save($out, $enc, $ep)
  $bmp.Dispose()
  Write-Host ("{0} -> {1}x{2}" -f $out, $w, $h)
}
