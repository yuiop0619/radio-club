$urls = @('/index.html','/assets/js/scene.js','/assets/js/store.js','/assets/css/club.css',
          '/assets/img/scene-hall.jpg','/assets/img/scene-seated.jpg',
          '/assets/img/fig-detective.png','/assets/img/fig-serve.png')
foreach ($u in $urls) {
  try {
    $r = Invoke-WebRequest -Uri ('http://localhost:8080' + $u) -UseBasicParsing -TimeoutSec 8
    Write-Host ("{0}  {1}" -f $r.StatusCode, $u)
  } catch {
    Write-Host ("ERR {0}  {1}" -f $u, $_.Exception.Message)
  }
}
