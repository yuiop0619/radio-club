(function(){
"use strict";
RC.ui.chrome({ title: RC.i18n.t('counter'), path: 'index.html' });
document.getElementById('navMount').innerHTML = RC.ui.nav('index.html');
document.getElementById('footMount').innerHTML = RC.ui.siteFoot({ active: 'index.html' });

/* ---------- 你的吧台（账单） ---------- */
var trayBox = document.getElementById('trayBox');
function renderTray() {
  var t = RC.i18n.t, of = RC.i18n.of;
  var tr = RC.bar.tray(), total = RC.bar.count();
  var served = RC.bar.served();
  var items = tr.length ? tr.map(function (x) {
    var d = RC.bar.byId(x.id);
    var left = x.n - (served[x.id] || 0);
    var state = d.kind === 'food' && left > 0
      ? '<span class="ti-by">' + of({ cn: '厨房里 · 稍后上', jp: '厨房で · 後ほど' }) + '</span>'
      : (d.kind === 'food' ? '<span class="ti-by">' + of({ cn: '已上桌', jp: 'お出し済み' }) + '</span>'
         : '<span class="ti-by">' + RC.util.esc(d.by) + of({ cn: ' 调', jp: ' 担当' }) + '</span>');
    return '<div class="tray-item"><span class="ti-n">×' + x.n + '</span><span>' + RC.util.esc(of({ cn: d.cn, jp: d.jp })) + '</span>' +
      state + '<span class="ti-x" data-rm="' + x.id + '">' + of({ cn: '撤掉', jp: '取消' }) + '</span></div>';
  }).join('') : '<div class="tray-empty">' + t('trayEmpty') + '</div>';
  trayBox.innerHTML =
    '<div class="tray-head">' + t('yourCounter') + '<span class="cnt">' + t('tonightTotal') + ' ' + total + ' ' + t('items') + '</span></div>' + items +
    (tr.length ? '<div class="tray-foot"><button type="button" class="btn ghost mini" id="trayClear">' + of({ cn: '清空吧台', jp: 'カウンターを空に' }) + '</button>' +
      '<a class="btn mini" href="order.html">' + of({ cn: '就这些了 · 去讲我的事 →', jp: 'これで全部 · 話を聞いてもらう →' }) + '</a></div>' : '');
}
trayBox.addEventListener('click', function (e) {
  var rm = e.target.closest('[data-rm]');
  if (rm) { RC.bar.remove(rm.getAttribute('data-rm')); renderTray(); if (RC.scene) RC.scene.renderDishes(false); return; }
  if (e.target.id === 'trayClear') { RC.bar.clear(); renderTray(); if (RC.scene) RC.scene.renderDishes(false); }
});
RC.scene = RC.scene || {};
RC.scene.renderTray = renderTray;
renderTray();
if (RC.i18n.onChange) RC.i18n.onChange(renderTray);

})();
