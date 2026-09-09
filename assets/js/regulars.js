/* ============================================================
   regulars.js — 常客墙 + 数据看板
   常客墙：店里的老面孔（虚构）——加上你自己。第二次来，他们会先开口。
   数据看板：本机累计的全部痕迹。数据都在这台设备上，哪里也不去。
   挂载点：#regMount / #boardMount（人物页）
   ============================================================ */
(function () {
  var REGULARS = [
    { seat: '壱', cn: '末永',      jp: '末永',      cn2: '广告公司 · 42', jp2: '広告会社・42',
      drink: { cn: '琥珀高球', jp: 'ハイボール' }, when: { cn: '每周三', jp: '毎週水曜' },
      line: { cn: '「我说的不是梦，是 KPI。」', jp: '「夢じゃない、KPIの話だ。」' } },
    { seat: '弐', cn: '时田',      jp: '时田',      cn2: '工程师 · 31', jp2: 'エンジニア・31',
      drink: { cn: '热牛奶', jp: 'ホットミルク' }, when: { cn: '通宵前后', jp: '徹夜の前後' },
      line: { cn: '「我做的东西会做梦吗？」', jp: '「僕の作ったものは夢を見る？」' } },
    { seat: '参', cn: '冰室',      jp: '氷室',      cn2: '护士 · 27', jp2: '看護師・27',
      drink: { cn: '气泡水', jp: '炭酸水' }, when: { cn: '下夜班', jp: '夜勤明け' },
      line: { cn: '「别人的梦我听够了。」', jp: '「他人の夢はもう聞き飽きた。」' } },
    { seat: '肆', cn: '小山内',    jp: '小山内',    cn2: '研究生 · 24', jp2: '院生・24',
      drink: { cn: '威士忌 · 不加冰', jp: 'ウイスキー・氷なし' }, when: { cn: '写不下去的时候', jp: '書けなくなった時' },
      line: { cn: '「我怕的不是做不出来，是被看穿。」', jp: '「怖いのは出来ないことでなく、見抜かれること。」' } },
    { seat: '伍', cn: '粉川',      jp: '粉川',      cn2: '刑警 · 38', jp2: '刑事・38',
      drink: { cn: '黑咖啡', jp: 'ブラック' }, when: { cn: '结案之后', jp: '事件の後' },
      line: { cn: '「十七楼那件事，我还没想明白。」', jp: '「十七階の件は、まだ分からない。」' } },
    { seat: '陸', cn: '乾',        jp: '乾',        cn2: '？', jp2: '？',
      drink: { cn: '只喝水', jp: '水だけ' }, when: { cn: '不定时', jp: '不定期' },
      line: { cn: '「梦不该跑到现实里来。」', jp: '「夢が現実に出てはいけない。」' } }
  ];

  function esc(s) { return RC.util.esc(s); }
  function bi(o) { return '<span class="i18n-cn">' + esc(o.cn) + '</span><span class="i18n-jp">' + esc(o.jp) + '</span>'; }

  /* ---------- 统计 ---------- */
  function stats() {
    var visits = RC.store.get('visits', 0) || 0;
    var today = (RC.store.get('visitsToday', null) || {}).n || 0;
    var c = null; try { c = RC.case.get(); } catch (e) { c = null; }
    var counter = RC.store.get('counter_v2', null);
    var tickets = (counter && Array.isArray(counter.tickets)) ? counter.tickets : [];
    var items = 0;
    for (var i = 0; i < tickets.length; i++) {
      var it = tickets[i].items || {};
      for (var k in it) items += it[k];
    }
    var notes = 0;
    try {
      var d = RC.store.get('bbs_v2', null);
      if (d && Array.isArray(d.notes)) for (var j = 0; j < d.notes.length; j++) if (d.notes[j] && d.notes[j].mine) notes++;
    } catch (e) { /* 忽略 */ }
    var dreams = RC.store.get('dreamLog', []);
    return {
      visits: visits, today: today,
      orders: tickets.length, items: items,
      tarot: RC.store.get('stat_tarot', 0) + ((c && c.tarot.length) ? 1 : 0),
      notes: notes,
      dreams: Array.isArray(dreams) ? dreams.length : 0,
      stamps: RC.stamps ? RC.stamps.count() : 0
    };
  }

  /* ---------- 你的档案 ---------- */
  function me() {
    var c = null; try { c = RC.case.get(); } catch (e) { c = null; }
    var name = (c && c.handle) ? c.handle : '';
    var fav = '';
    try {
      var served = RC.store.get('served', {}) || {}, best = 0, bestId = '';
      for (var k in served) if (served[k] > best) { best = served[k]; bestId = k; }
      if (bestId) {
        for (var i = 0; i < RC.bar.menu.length; i++) if (RC.bar.menu[i].id === bestId) fav = RC.bar.menu[i].cn;
      }
    } catch (e) { /* 忽略 */ }
    var last = RC.store.get('lastVisit', 0);
    return {
      name: name, fav: fav,
      last: last ? new Date(last).toLocaleDateString('zh-CN') : '',
      visits: RC.store.get('visits', 0) || 0
    };
  }

  function renderReg(host) {
    if (!host) return;
    var m = me();
    var h = '<div class="reg-grid">';
    for (var i = 0; i < REGULARS.length; i++) {
      var r = REGULARS[i];
      h += '<div class="reg">' +
        '<div class="rg-seat">' + esc(r.seat) + '</div>' +
        '<div><div class="rg-n"><span class="i18n-cn">' + esc(r.cn) + '</span><span class="i18n-jp">' + esc(r.jp) + '</span></div>' +
        '<div class="rg-d"><span class="i18n-cn">' + esc(r.cn2) + '</span><span class="i18n-jp">' + esc(r.jp2) + '</span></div>' +
        '<div class="rg-d">' + bi(r.when) + ' ／ ' + bi(r.drink) + '</div>' +
        '<div class="rg-d">' + bi(r.line) + '</div></div></div>';
    }
    h += '<div class="reg me">' +
      '<div class="rg-seat">' + (m.name ? esc(m.name.slice(0, 1)) : '？') + '</div>' +
      '<div><div class="rg-n">' + esc(m.name || RC.i18n.t('you')) + '</div>' +
      '<div class="rg-d">' + esc(RC.i18n.t('bdVisits')) + ' ' + m.visits + '</div>' +
      '<div class="rg-d">' + esc(RC.i18n.t('favDrink')) + '：' + esc(m.fav || '—') + '</div>' +
      '<div class="rg-d">' + esc(RC.i18n.t('lastSeen')) + '：' + esc(m.last || RC.i18n.t('never')) + '</div></div></div>';
    h += '</div>';
    host.innerHTML = h;
  }

  function renderBoard(host) {
    if (!host) return;
    var s = stats();
    var rows = [
      [s.visits, 'bdVisits'], [s.today, 'bdToday'], [s.orders, 'bdOrders'], [s.items, 'bdItems'],
      [s.tarot, 'bdTarot'], [s.notes, 'bdNotes'], [s.dreams, 'bdDreams'], [s.stamps, 'bdStamps']
    ];
    var h = '<div class="board-grid">';
    for (var i = 0; i < rows.length; i++) {
      h += '<div class="bstat"><div class="bs-n">' + rows[i][0] + '</div><div class="bs-l">' + esc(RC.i18n.t(rows[i][1])) + '</div></div>';
    }
    h += '</div>';
    host.innerHTML = h;
  }

  function init() {
    renderReg(document.getElementById('regMount'));
    renderBoard(document.getElementById('boardMount'));
    RC.i18n.onChange(function () {
      renderReg(document.getElementById('regMount'));
      renderBoard(document.getElementById('boardMount'));
    });
  }

  window.RC = window.RC || {};
  RC.regulars = { stats: stats, render: renderReg, board: renderBoard };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
