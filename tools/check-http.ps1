param([string]$BaseUrl = "http://127.0.0.1:8080")
$failed = $false
$urls = @('/index.html','/assets/js/scene.js','/assets/js/store.js','/assets/css/club.css',
          '/assets/img/scene-hall.jpg','/assets/img/scene-seated.jpg',
          '/assets/img/puppet-det-768.webp','/assets/img/master-jung-320.webp')
foreach ($u in $urls) {
  try {
    $r = Invoke-WebRequest -Uri ($BaseUrl + $u) -UseBasicParsing -TimeoutSec 8
    Write-Host ("{0}  {1}" -f $r.StatusCode, $u)
  } catch {
    $failed = $true
    Write-Host ("ERR {0}  {1}" -f $u, $_.Exception.Message)
  }
}

if ($failed) { exit 1 }
