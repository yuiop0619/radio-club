/* ============================================================
   stamps.js — 集章卡（成就印章）
   在这家店做过的事，会一枚枚盖到你的卡片上。全部只存本机。
   挂载点：<div id="stampMount" data-skel="cards"></div>
   ============================================================ */
(function () {
  var KEY = 'stamps';
  var DEFS = [
    { id: 'enter',   mark: '入', cn: '初次到店', jp: '初来店',   hint: { cn: '推开这扇门。', jp: 'この扉を開けた。' } },
    { id: 'order',   mark: '託', cn: '递交委托', jp: 'ご用件',   hint: { cn: '你把事写下来，交给了吧台。', jp: '言葉にして、カウンターへ渡した。' } },
    { id: 'tarot',   mark: '牌', cn: '抽过牌',   jp: 'タロット', hint: { cn: '五张牌摊在桌上，你已经翻开了。', jp: '五枚を並べ、めくった。' } },
    { id: 'psyche',  mark: '夢', cn: '做过会诊', jp: '夢診断',   hint: { cn: '七位大师轮流接过了你的梦。', jp: '七人が順に夢を受け取った。' } },
    { id: 'verdict', mark: '鑑', cn: '领取鉴定', jp: '鑑定書',   hint: { cn: '她把结论写下来了，白纸黑字。', jp: '彼女は結論を書いた。' } },
    { id: 'hole',    mark: '穴', cn: '投过纸条', jp: '木の穴',   hint: { cn: '你往树洞里投了一句说不出口的话。', jp: '言えなかった一言を、穴へ。' } },
    { id: 'dream',   mark: '記', cn: '记过梦',   jp: '夢の記録', hint: { cn: '梦不占地方，但你记下了它的形状。', jp: '夢は場所を取らないが、形を残した。' } },
    { id: 'night',   mark: '夜', cn: '深夜来访', jp: '深夜来店', hint: { cn: '0 点到 5 点之间，灯还为你亮着。', jp: '0時〜5時、灯はまだ点いている。' } },
    { id: 'menu',    mark: '杯', cn: '点过三样', jp: '三品注文', hint: { cn: '岩夫记得你点过什么。', jp: '岩夫はあなたの注文を覚えている。' } },
    { id: 'regular', mark: '常', cn: '七回来店', jp: '七度来店', hint: { cn: '第七次了。他们开始先跟你打招呼。', jp: '七度目。彼らが先に声をかける。' } },
    { id: 'lang',    mark: '譯', cn: '换过语言', jp: '言語切替', hint: { cn: '你读过这个网站的另一种声音。', jp: 'このサイトの別の声を読んだ。' } },
    { id: 'floor17', mark: '楼', cn: '到过 17 层', jp: '17階',   hint: { cn: '电梯停在这里。上面今晚不开放。', jp: 'エレベータはここで止まる。上は今夜は開かない。' } }
  ];

  function read() {
    var s = RC.store.get(KEY, null);
    if (!s || typeof s !== 'object' || Array.isArray(s)) s = {};
    return s;
  }
  function write(s) { RC.store.set(KEY, s); }

  function got(id) { return !!read()[id]; }
  function count() { var s = read(), n = 0; for (var k in s) if (s[k]) n++; return n; }

  function unlock(id) {
    var s = read();
    if (s[id]) return false;
    s[id] = Date.now();
    write(s);
    toast(id);
    return true;
  }

  function toast(id) {
    var d = null;
    for (var i = 0; i < DEFS.length; i++) if (DEFS[i].id === id) d = DEFS[i];
    if (!d) return;
    var box = document.createElement('div');
    box.className = 'stamp-toast';
    box.setAttribute('role', 'status');
    box.innerHTML = '<b>' + RC.i18n.t('stampGot') + '：' + RC.ui.bi(d.cn, d.jp) + '</b><br>' + RC.i18n.of(d.hint);
    document.body.appendChild(box);
    setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 4200);
  }

  /* ---------- 条件判定 ---------- */
  function noteCount() {
    try {
      var d = RC.store.get('bbs_v2', null);
      if (!d || !Array.isArray(d.notes)) return 0;
      var n = 0;
      for (var i = 0; i < d.notes.length; i++) if (d.notes[i] && d.notes[i].mine) n++;
      return n;
    } catch (e) { return 0; }
  }
  function dreamCount() {
    var l = RC.store.get('dreamLog', []);
    return Array.isArray(l) ? l.length : 0;
  }
  function drinkKinds() {
    var n = 0;
    try {
      var served = RC.store.get('served', {}) || {};
      for (var k in served) if (served[k] > 0) n++;
      var tray = RC.bar.tray();
      for (var i = 0; i < tray.length; i++) if (tray[i] && tray[i].n > 0) n++;
    } catch (e) { /* 忽略 */ }
    return n;
  }

  function check() {
    var unlocked = [];
    var page = document.body.getAttribute('data-page') || '';
    var c = null;
    try { c = RC.case.get(); } catch (e) { c = null; }
    var hour = new Date().getHours();

    function try_(id, ok) { if (ok && unlock(id)) unlocked.push(id); }

    try_('enter', true);
    try_('order', !!c && !!c.story);
    try_('tarot', !!c && c.tarot.length > 0);
    try_('psyche', !!c && (c.analystLog.length > 0 || c.assoc.some(function (a) { return !!a.resp; })));
    try_('verdict', page === 'verdict' && !!c && RC.case.has());
    try_('hole', noteCount() > 0);
    try_('dream', dreamCount() > 0);
    try_('night', hour >= 0 && hour < 5);
    try_('menu', drinkKinds() >= 3);
    try_('regular', RC.store.get('visits', 0) >= 7);
    try_('lang', RC.i18n.lang() === 'jp' || RC.store.get('lang', 'cn') === 'jp');
    try_('floor17', !!RC.store.get('seen17', false));
    return unlocked;
  }

  /* ---------- 渲染 ---------- */
  function render(host) {
    if (!host) return;
    var s = read();
    var h = '<div class="stamp-grid">';
    for (var i = 0; i < DEFS.length; i++) {
      var d = DEFS[i];
      var on = !!s[d.id];
      var when = on ? new Date(s[d.id]).toLocaleDateString('zh-CN') : '';
      h += '<div class="stamp-cell' + (on ? ' got' : '') + '" title="' + RC.util.esc(RC.i18n.of(d.hint)) + '">' +
        '<div class="sc-mark">' + d.mark + '</div>' +
        '<div class="sc-name"><span class="i18n-cn">' + RC.util.esc(d.cn) + '</span><span class="i18n-jp">' + RC.util.esc(d.jp) + '</span></div>' +
        '<div class="sc-when">' + (on ? RC.util.esc(when) : '—') + '</div>' +
        '</div>';
    }
    h += '</div>';
    h += '<p class="hint mt">' + RC.ui.bi(
      RC.i18n.t('stampProgress') + ' ' + count() + ' / ' + DEFS.length + '　' + RC.i18n.t('stampTip'),
      RC.i18n.t('stampProgress') + ' ' + count() + ' / ' + DEFS.length + '　' + RC.i18n.t('stampTip')
    ) + '</p>';
    host.innerHTML = h;
  }

  window.RC = window.RC || {};
  RC.stamps = { DEFS: DEFS, got: got, count: count, unlock: unlock, check: check, render: render };

  function init() {
    var host = document.getElementById('stampMount');
    if (host) render(host);
    /* 等页面的档案/计数器写完之后再判定，避免刚落地就误判 */
    setTimeout(function () {
      check();
      if (host) render(host);
    }, 400);
    RC.i18n.onChange(function () { if (host) render(host); });
    /* 塔罗展开次数（数据看板用）：只在这一页有「洗牌并抽牌」按钮 */
    var deal = document.getElementById('btnDeal');
    if (deal) deal.addEventListener('click', function () {
      RC.store.set('stat_tarot', (RC.store.get('stat_tarot', 0) || 0) + 1);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
