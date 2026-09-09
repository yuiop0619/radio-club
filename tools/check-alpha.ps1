Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
foreach ($f in @('master-jung-320.png','master-freud-320.png')) {
  $img = New-Object System.Drawing.Bitmap("$root\assets\img\$f")
  $t = 0; $o = 0
  for ($y = 0; $y -lt $img.Height; $y += 7) {
    for ($x = 0; $x -lt $img.Width; $x += 7) {
      if ($img.GetPixel($x, $y).A -lt 20) { $t++ } else { $o++ }
    }
  }
  Write-Host ("{0}  transparent={1}  opaque={2}" -f $f, $t, $o)
  $img.Dispose()
}
