/* ============================================================
   omen.js — 每日一签（批次 5 · 回访机制）
   首页一块小面板：按当天日期选一张今日签，同一天固定、隔天换。
   看过三天不同日期的签，解锁「签」印章（判定在 stamps.js）。
   挂载点：<div id="omenMount"></div>
   ============================================================ */
(function () {
  window.RC = window.RC || {};

  function todayStr() {
    var d = new Date();
    var p = function (n) { return (n < 10 ? '0' + n : '' + n); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  /* DJB2：同样的日期永远得到同一张牌，跨天才会变 */
  function hash(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h;
  }
  function pick() {
    var arc = (RC.tarot && RC.tarot.arcana) || [];
    if (!arc.length) return null;
    var idx = hash(todayStr()) % arc.length;
    return arc[idx];
  }
  function render(host) {
    if (!host) return;
    var card = pick();
    if (!card || !card.dailyOmen) { host.innerHTML = ''; return; }
    var lang = RC.i18n.lang();
    var name = lang === 'jp' ? (card.jp || card.cn) : (card.cn || card.jp);
    var omen = (card.dailyOmen && (card.dailyOmen[lang] || card.dailyOmen.cn)) || '';
    var d = new Date();
    var dateCn = (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日';
    var dateJp = (d.getMonth() + 1) + '月' + d.getDate() + '日';
    var date = lang === 'jp' ? dateJp : dateCn;
    host.innerHTML =
      '<div class="omen-card">' +
        '<div class="omen-date">' + RC.util.esc(date) + '</div>' +
        '<div class="omen-name"><span class="omen-glyph">' + RC.util.esc(card.g || '✦') + '</span>' +
          '<span>' + RC.util.esc(name) + '</span></div>' +
        '<p class="omen-text">' + RC.util.esc(omen) + '</p>' +
        '<a class="omen-link" href="cards.html#card-' + card.n + '">' + RC.util.esc(RC.i18n.t('omenSee')) + ' →</a>' +
      '</div>';
  }
  /* 把今天记进 rc_profile.omenSeen（去重），stamps.js 据其解锁「签」印章。
     写的是 profile 顶层对象下的 omenSeen 子键，与 profile.ts 管理的其它子键互不冲突。 */
  function markSeen() {
    try {
      var box = RC.store.get('profile', {}) || {};
      if (typeof box !== 'object' || Array.isArray(box)) box = {};
      var seen = Array.isArray(box.omenSeen) ? box.omenSeen : [];
      var t = todayStr();
      if (seen.indexOf(t) < 0) { seen = seen.concat([t]); box.omenSeen = seen; RC.store.set('profile', box); }
    } catch (e) { /* 忽略 */ }
  }
  function init() {
    if (typeof RC === 'undefined' || !RC.tarot) return;
    var host = document.getElementById('omenMount');
    if (!host) return;
    render(host);
    markSeen();
    RC.i18n.onChange(function () { render(host); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
