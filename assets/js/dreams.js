/* ============================================================
   dreams.js — 梦境档案（时间线）
   本机记录：日期 / 标题 / 正文 / 醒来时的感觉 / 反复出现的意象。
   每条可以「带去会诊」，直接写进委托档案的「最近反复做的梦」。
   ============================================================ */
(function () {
  var KEY = 'dreamLog';
  var MOODS = [
    { k: 'tired', cn: '疲惫', jp: '疲れ' },
    { k: 'angry', cn: '生气', jp: '怒り' },
    { k: 'miss',  cn: '想念', jp: '会いたい' },
    { k: 'awake', cn: '睡不着', jp: '眠れない' },
    { k: 'lost',  cn: '迷路', jp: '迷い' },
    { k: 'calm',  cn: '还好', jp: 'まあまあ' }
  ];
  function moodLabel(v) {
    for (var i = 0; i < MOODS.length; i++) if (MOODS[i].cn === v || MOODS[i].k === v) return MOODS[i];
    return { k: v, cn: v, jp: v };
  }
  function esc(s) { return RC.util.esc(s); }

  function load() {
    var l = RC.store.get(KEY, []);
    if (!Array.isArray(l)) return [];
    return l.filter(function (d) { return d && typeof d === 'object'; }).map(function (d) {
      return {
        id: String(d.id || ('d-' + Math.random().toString(36).slice(2, 9))),
        date: /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : new Date(d.ts || Date.now()).toISOString().slice(0, 10),
        title: String(d.title || '').slice(0, 60),
        body: String(d.body || '').slice(0, 2000),
        mood: String(d.mood || '').slice(0, 20),
        tag: String(d.tag || '').slice(0, 40),
        ts: Number(d.ts) || Date.parse(d.date) || Date.now()
      };
    }).sort(function (a, b) { return b.ts - a.ts; });
  }
  function save(l) { RC.store.set(KEY, l.slice(0, 200)); }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function render(host) {
    if (!host) return;
    var l = load();
    var cnt = document.getElementById('dreamCount');
    if (cnt) cnt.textContent = l.length + ' ' + RC.i18n.t('dreamCount');
    if (!l.length) {
      host.innerHTML = '<p class="dim center">' + esc(RC.i18n.t('dreamEmpty')) + '</p>';
      return;
    }
    var today = todayStr();
    var h = '<div class="tl">';
    for (var i = 0; i < l.length; i++) {
      var d = l[i], m = moodLabel(d.mood);
      h += '<div class="tl-item' + (d.date === today ? ' today' : '') + '">' +
        '<div class="tl-date">' + esc(d.date) + (d.date === today ? ' · ' + esc(RC.i18n.t('justNow')) : '') + '</div>' +
        (d.title ? '<div class="tl-title">' + esc(d.title) + '</div>' : '') +
        '<div class="tl-body">' + esc(d.body) + '</div>' +
        '<div class="tl-meta">' +
        (d.mood ? '<span><span class="i18n-cn">' + esc(m.cn) + '</span><span class="i18n-jp">' + esc(m.jp) + '</span></span>' : '') +
        (d.tag ? '<span class="tagx">＃' + esc(d.tag) + '</span>' : '') +
        '<button type="button" data-take="' + esc(d.id) + '">' + esc(RC.i18n.t('dreamTake')) + '</button>' +
        '<button type="button" data-del="' + esc(d.id) + '">×</button>' +
        '</div></div>';
    }
    h += '</div>';
    host.innerHTML = h;
  }

  function take(id) {
    var l = load(), d = null;
    for (var i = 0; i < l.length; i++) if (l[i].id === id) d = l[i];
    if (!d) return;
    RC.case.save({ dream: d.body });
    location.href = 'psyche.html';
  }
  function del(id) {
    var l = load().filter(function (x) { return x.id !== id; });
    save(l);
    render(document.getElementById('dreamMount'));
    var m = document.getElementById('dreamMsg');
    if (m) m.textContent = RC.i18n.t('dreamDeleted');
  }

  function init() {
    var host = document.getElementById('dreamMount');
    if (!host) return;
    render(host);

    var f = document.getElementById('dreamForm');
    if (f) f.addEventListener('submit', function (e) {
      e.preventDefault();
      var body = (document.getElementById('dBody').value || '').trim();
      if (!body) { document.getElementById('dBody').focus(); return; }
      var l = load();
      l.push({
        id: 'd-' + Date.now().toString(36),
        date: (document.getElementById('dDate').value || todayStr()),
        title: (document.getElementById('dTitle').value || '').trim(),
        body: body,
        mood: document.getElementById('dMood').value,
        tag: (document.getElementById('dTag').value || '').trim(),
        ts: Date.now()
      });
      save(l);
      document.getElementById('dTitle').value = '';
      document.getElementById('dBody').value = '';
      document.getElementById('dTag').value = '';
      render(host);
      var m = document.getElementById('dreamMsg');
      if (m) m.textContent = RC.i18n.t('dreamSaved');
      if (RC.stamps) RC.stamps.check();
    });

    host.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      if (b.getAttribute('data-take')) take(b.getAttribute('data-take'));
      else if (b.getAttribute('data-del')) del(b.getAttribute('data-del'));
    });

    RC.i18n.onChange(function () { render(host); });
  }

  window.RC = window.RC || {};
  RC.dreams = { load: load, save: save, render: render, MOODS: MOODS };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
