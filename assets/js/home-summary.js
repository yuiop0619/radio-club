/* ============================================================
   home-summary.js — 首页「最近在这台机器上」动态概览
   ------------------------------------------------------------
   挂载点：<div id="trayBox"></div>（原「你的吧台」空面板）
   显示今日一签、最近委托、最近梦境、情绪连续天数、印章进度。
   只读本机存储键，不上传。
   ============================================================ */
(function () {
  window.RC = window.RC || {};

  function todayStr() {
    var d = new Date();
    var p = function (n) { return (n < 10 ? '0' + n : '' + n); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function hash(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h;
  }
  function pickOmen() {
    var arc = (RC.tarot && RC.tarot.arcana) || [];
    if (!arc.length) return null;
    return arc[hash(todayStr()) % arc.length];
  }
  function esc(s) { return RC.util.esc(String(s == null ? '' : s)); }
  function bi(cn, jp) { return RC.ui.bi(cn, jp); }
  function streak() {
    try {
      var logs = RC.store.get('profile', {}).moodLogs || [];
      if (!logs.length) return 0;
      var dates = {};
      for (var i = 0; i < logs.length; i++) if (logs[i] && logs[i].date) dates[logs[i].date] = true;
      var today = todayStr();
      var d = new Date();
      var check = today;
      if (!dates[check]) {
        d.setDate(d.getDate() - 1);
        var p = function (n) { return (n < 10 ? '0' + n : '' + n); };
        check = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
      }
      var n = 0;
      while (dates[check]) {
        n++;
        d = new Date(check + 'T00:00:00');
        d.setDate(d.getDate() - 1);
        var p = function (x) { return (x < 10 ? '0' + x : '' + x); };
        check = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
      }
      return n;
    } catch (e) { return 0; }
  }
  function stampProgress() {
    try { return RC.stamps.count() + ' / ' + RC.stamps.DEFS.length; } catch (e) { return '0 / ?'; }
  }
  function latestDream() {
    try {
      var logs = RC.store.get('dreamLog', []);
      if (!logs.length) return null;
      var last = logs[logs.length - 1];
      return { tag: last.tag || '', body: (last.body || '').slice(0, 60) };
    } catch (e) { return null; }
  }
  function latestCase() {
    try {
      var c = RC.store.get('case', null);
      if (!c || !c.story) return null;
      return (c.story || '').slice(0, 60);
    } catch (e) { return null; }
  }

  function render(host) {
    if (!host) return;
    var lang = RC.i18n.lang();
    var rows = [];

    var omen = pickOmen();
    if (omen && omen.dailyOmen) {
      var name = lang === 'jp' ? (omen.jp || omen.cn) : (omen.cn || omen.jp);
      var txt = omen.dailyOmen[lang] || omen.dailyOmen.cn;
      rows.push('<div class="hs-row"><span class="hs-k">' + (lang === 'jp' ? '今日の札' : '今日一签') + '</span>' +
        '<span class="hs-v"><b>' + esc(name) + '</b> · ' + esc(txt) +
        ' <a class="hs-link" href="cards.html#card-' + omen.n + '">' + (lang === 'jp' ? '読む →' : '看牌 →') + '</a></span></div>');
    }

    var cs = latestCase();
    if (cs) rows.push('<div class="hs-row"><span class="hs-k">' + (lang === 'jp' ? '最近の依頼' : '最近委托') + '</span>' +
      '<span class="hs-v">' + esc(cs) + '… <a class="hs-link" href="verdict.html">' + (lang === 'jp' ? '鑑定書 →' : '鉴定书 →') + '</a></span></div>');

    var dr = latestDream();
    if (dr) rows.push('<div class="hs-row"><span class="hs-k">' + (lang === 'jp' ? '最近の夢' : '最近梦境') + '</span>' +
      '<span class="hs-v">' + (dr.tag ? '「' + esc(dr.tag) + '」' : '') + esc(dr.body) + '… <a class="hs-link" href="dreams.html">' + (lang === 'jp' ? '夢日記 →' : '梦境 →') + '</a></span></div>');

    var st = streak();
    rows.push('<div class="hs-row"><span class="hs-k">' + (lang === 'jp' ? '気分連続' : '情绪连续') + '</span>' +
      '<span class="hs-v">' + st + (lang === 'jp' ? ' 日連続で記録中' : ' 天连续记录') +
      ' <a class="hs-link" href="toolbox.html">' + (lang === 'jp' ? '打卡 →' : '打卡 →') + '</a></span></div>');

    rows.push('<div class="hs-row"><span class="hs-k">' + (lang === 'jp' ? '印章' : '印章') + '</span>' +
      '<span class="hs-v">' + stampProgress() + (lang === 'jp' ? ' 枚集まった' : ' 枚已收集') +
      ' <a class="hs-link" href="profile.html#stampPanel">' + (lang === 'jp' ? '見る →' : '查看 →') + '</a></span></div>');

    host.innerHTML = rows.length ? '<div class="hs-box">' + rows.join('') + '</div>' : '';
  }

  function init() {
    if (typeof RC === 'undefined' || !RC.store) return;
    var host = document.getElementById('trayBox');
    if (!host) return;
    render(host);
    RC.i18n.onChange(function () { render(host); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
