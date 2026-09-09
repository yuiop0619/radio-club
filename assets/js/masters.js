/* ============================================================
   masters.js — 大师画廊（解梦会诊的七位）
   数据取自 analyst.js 的 RC.analyst.MASTERS，点一下出那位的开场白。
   ============================================================ */
(function () {
  function esc(s) { return RC.util.esc(s); }

  function render(host) {
    if (!host) return;
    var list = (RC.analyst && RC.analyst.MASTERS) || [];
    var h = '<div class="ggrid">';
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      h += '<div class="gcard">' +
        '<div class="gc-photo"><picture>' +
        '<source type="image/webp" srcset="assets/img/master-' + m.id + '-160.webp 160w, assets/img/master-' + m.id + '-640.webp 640w" sizes="(max-width:600px) 50vw, 160px">' +
        '<img src="assets/img/master-' + m.id + '-320.png" width="320" height="320" loading="lazy" decoding="async" alt=""></picture></div>' +
        '<div class="gc-body">' +
        '<div class="gc-name"><span class="i18n-cn">' + esc(m.cn) + '</span><span class="i18n-jp">' + esc(m.jp) + '</span></div>' +
        '<div class="gc-en">' + esc(m.en) + '</div>' +
        '<div class="gc-school"><span class="i18n-cn">' + esc(m.school.cn) + '</span><span class="i18n-jp">' + esc(m.school.jp) + '</span></div>' +
        '<div class="gc-greet"><span class="i18n-cn">' + esc(m.greet.cn) + '</span><span class="i18n-jp">' + esc(m.greet.jp) + '</span></div>' +
        '<div class="mt"><a class="btn ghost small" href="psyche.html">' + esc(RC.i18n.t('goPsyche2')) + '</a></div>' +
        '</div></div>';
    }
    h += '</div>';
    host.innerHTML = h;
  }

  function init() {
    RC.ui.chrome({ title: RC.i18n.t('gallery'), path: 'masters.html' });
    document.getElementById('navMount').innerHTML = RC.ui.nav('masters.html');
    document.getElementById('footMount').innerHTML = RC.ui.siteFoot({ active: 'masters.html' });
    var host = document.getElementById('masterMount');
    render(host);
    RC.i18n.onChange(function () { render(host); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
