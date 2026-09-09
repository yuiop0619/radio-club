/* ============================================================
   store.js — 事件档案 / 来店记录 / 通用工具
   localStorage 不可用时自动降级为内存存储
   ============================================================ */
(function () {
  var ok = (function () {
    try { localStorage.setItem('__rc_t', '1'); localStorage.removeItem('__rc_t'); return true; }
    catch (e) { return false; }
  })();

  /* localStorage 不可用（如某些 file:// 环境）时，用 window.name 做跨页面兜底 */
  var NAME_KEY = 'rc_store_v1';
  function nameRead() {
    try { var o = JSON.parse(window.name || '{}'); return (o && o[NAME_KEY]) || {}; } catch (e) { return {}; }
  }
  function nameWrite(obj) {
    var o; try { o = JSON.parse(window.name || '{}'); } catch (e) { o = {}; }
    if (!o || typeof o !== 'object' || Array.isArray(o)) o = {};
    o[NAME_KEY] = obj; window.name = JSON.stringify(o);
  }

  function failed() {
    var el=document.getElementById('storageError');
    if(!el && document.body){el=document.createElement('p');el.id='storageError';el.className='storage-error';el.setAttribute('role','alert');document.body.prepend(el);}
    if(el) el.textContent='保存失败：浏览器存储不可用或已满。请保留当前输入后重试。 / 保存できません。入力を残して再試行してください。';
    return false;
  }
  var store = {
    available: ok,
    get: function (k, def) {
      try {
        if (ok) {
          var raw = localStorage.getItem('rc_' + k);
          return raw == null ? def : JSON.parse(raw);
        }
        var bag = nameRead();
        return (k in bag) ? bag[k] : def;
      } catch (e) { return def; }
    },
    set: function (k, v) {
      try {
        if (ok) { localStorage.setItem('rc_' + k, JSON.stringify(v)); }
        else { var bag = nameRead(); bag[k] = v; nameWrite(bag); }
        return true;
      } catch (e) { return failed(); }
    },
    del: function (k) {
      try {
        if (ok) localStorage.removeItem('rc_' + k);
        else { var bag = nameRead(); delete bag[k]; nameWrite(bag); }
        return true;
      } catch (e) { return failed(); }
    }
  };

  /* 事件档案（委托内容） */
  var Case = {
    get: function () { return RC.model.normalize(store.get('case', null)); },
    save: function (patch) {
      var c=RC.model.normalize(Object.assign({},Case.get(),patch));
      c.updatedAt=Date.now();if(!c.createdAt)c.createdAt=c.updatedAt;if(!c.caseId)c.caseId=RC.model.id();
      return store.set('case',c) ? c : null;
    },
    start: function(patch) {
      var old=Case.get();
      if(Case.has()) {
        var history=store.get('caseHistory',[]);if(!Array.isArray(history))history=[];
        history=history.slice(-4).concat([old]);
        if(!store.set('caseHistory',history)) return null;
      }
      var c=RC.model.normalize(patch);c.caseId=RC.model.id();c.createdAt=c.updatedAt=Date.now();
      return store.set('case',c)?c:null;
    },
    reset: function () { return store.del('case') && store.del('verdict'); },
    has: function () { var c=Case.get();return !!(c.story||c.tarot.length||c.analystLog.length||c.assoc.length||c.sct.some(function(s){return s.a;})); }
  };

  /* 来店计数
     - total:     累计到访（持久）
     - today:     今日到访（按本地日期切分）
     - bump() 同会话内只 +1：靠 sessionStorage 标记去重，避免 8 页来回切每次都涨
  */
  var Visits = {
    bump: function () {
      try {
        if (sessionStorage.getItem('rc_visit_session')) {
          return this.count();
        }
        sessionStorage.setItem('rc_visit_session', '1');
      } catch (e) { /* sessionStorage 不可用时退回每页 +1：保留旧行为 */ }

      var n = store.get('visits', 0) + 1;
      store.set('visits', n);
      store.set('lastVisit', Date.now());

      /* 今日计数 */
      var d = new Date();
      var dayKey = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
      var t = store.get('visitsToday', null);
      if (!t || t.day !== dayKey) {
        store.set('visitsToday', { day: dayKey, n: 1 });
      } else {
        store.set('visitsToday', { day: dayKey, n: t.n + 1 });
      }
      return n;
    },
    count: function () { return store.get('visits', 0); },
    today: function () { return (store.get('visitsToday', null) || {}).n || 0; }
  };

  /* ---------- 吧台：饮品单 + 主食单 + 托盘 ---------- */
  var DRINKS = [
    { id: 'highball', cn: '琥珀高球',   jp: 'ハイボール',          alc: true,  by: '岩夫', kind: 'drink',
      desc: '威士忌苏打。气泡打得很细，不呛口。',
      descJp: 'ウイスキーソーダ。泡は細かく、喉にこない。',
      line: '琥珀高球。气泡要打得细才不呛口。慢慢喝，我们有的是时间。',
      lineJp: 'ハイボール。泡を細かくすれば喉にこない。ゆっくり飲んで、時間はあるから。' },
    { id: 'milk',     cn: '热牛奶',     jp: 'ホットミルク',        alc: false, by: '涟', kind: 'drink',
      desc: '给不喝酒的客人。涟会多加一点蜂蜜。',
      descJp: 'お酒を飲まない方に。れんは蜂蜜を少し多めに入れる。',
      line: '……热牛奶。蜂蜜多放了一点。手先暖起来，话才好说。',
      lineJp: '……ホットミルク。蜂蜜を少し多めに。まず手を温めてから、話はゆっくり。' },
    { id: 'fizz',     cn: '藏红气泡',   jp: 'サフラン・フィズ',    alc: true,  by: '岩夫', kind: 'drink',
      desc: '本店招牌，以那位小姐命名。颜色像她的外套。',
      descJp: '当店の看板、あのお嬢さんの名を冠した一杯。色は彼女のコートのよう。',
      line: '藏红气泡，本店招牌。颜色像那位小姐的外套——她本人对这个说法不予置评。',
      lineJp: 'サフラン・フィズ、当店の看板。色はあのお嬢さんのコートのよう——本人はこの説にコメントを控えている。' },
    { id: 'coffee',   cn: '午夜咖啡',   jp: 'ミッドナイト・コーヒー', alc: false, by: '涟', kind: 'drink',
      desc: '无酒精，偏苦。适合清醒地把一件事讲完。',
      descJp: 'ノンアルコール、やや苦め。正気で一つのことを語り切るのに合う。',
      line: '午夜咖啡，很苦。想清醒地把话讲完，点它没错。',
      lineJp: 'ミッドナイト・コーヒー、とても苦い。正気で話を終えたいなら、これを選んで間違いはない。' },
    { id: 'orange',   cn: '血橙苏打',   jp: 'ブラッドオレンジ',    alc: false, by: '涟', kind: 'drink',
      desc: '微酸带气。涟说适合“想说又说不出口”的时候。',
      descJp: 'ほのかな酸味と炭酸。れん曰く「言いたいのに言えない」時に合う。',
      line: '血橙苏打，酸的。……有时候酸一点，话反而说得出口。',
      lineJp: 'ブラッドオレンジ、酸っぱい。……時々、少し酸っぱいほうが、かえって言葉を口にできる。' },
    { id: 'water',    cn: '一杯冷水',   jp: '冷水',                alc: false, by: '岩夫', kind: 'drink',
      desc: '也有人只想喝这个。我们不问原因。',
      descJp: 'これだけが飲みたい人もいる。理由は訊かない。',
      line: '冷水一杯。不问原因——这里没那种规矩。坐吧。',
      lineJp: '冷水を一杯。理由は訊かない——ここにそういう決まりはない。座って。' }
  ];
  /* 主食：点下后不立刻上，等精神分析做完才和答案一起端上来 */
  var FOODS = [
    { id: 'ramen', cn: '深夜拉面', jp: '夜ラーメン', alc: false, by: '岩夫', kind: 'food',
      desc: '味噌汤底、叉烧两片、溏心蛋。打烊前吊的最后一锅汤。',
      descJp: '味噌スープ、チャーシュー二枚、半熟卵。閉店前に取った最後の一杯の出汁。',
      line: '深夜拉面。汤是白天吊的，面是现煮的——趁热。',
      lineJp: '夜ラーメン。スープは昼に取って、麺は今茹でた——熱いうちに。' },
    { id: 'steak', cn: '铁板牛排', jp: 'ステーキ',   alc: false, by: '岩夫', kind: 'food',
      desc: '厚切，五分熟，配蒜片与一点岩盐。',
      descJp: '厚切り、ミディアム、ガーリックチップと少量の岩塩を添えて。',
      line: '铁板牛排，五分熟。刀在右手边——慢慢切，没人催你。',
      lineJp: 'ステーキ、ミディアム。ナイフは右手に——ゆっくり切って、誰も急かさない。' },
    { id: 'sandwich', cn: '玉子三明治', jp: '玉子サンド', alc: false, by: '涟', kind: 'food',
      desc: '厚蛋烧夹吐司，切掉硬边。涟的拿手。',
      descJp: '厚焼き玉子をトーストで挟み、硬い耳は落とした。れんの得意作。',
      line: '玉子三明治，边切掉了。……不喜欢边的人，运气都不会太差。',
      lineJp: '玉子サンド、耳は落とした。……耳が嫌いな人は、運が悪くないものだ。' },
    { id: 'onigiri', cn: '味噌烤饭团', jp: '焼きおにぎり', alc: false, by: '涟', kind: 'food',
      desc: '刷味噌烤到焦香。配茶、配沉默都可以。',
      descJp: '味噌を塗って香ばしく焼いた。お茶にも、沈黙にも合う。',
      line: '味噌烤饭团，焦的那面朝上。留给你。',
      lineJp: '焼きおにぎり、焦げた面を上にして。あなたに取っておいた。' }
  ];
  var ALL = DRINKS.concat(FOODS);
  var Bar = {
    menu: ALL,
    drinks: DRINKS,
    foods: FOODS,
    byId: function (id) { for (var i = 0; i < ALL.length; i++) if (ALL[i].id === id) return ALL[i]; return null; },
    isFood: function (id) { var d = Bar.byId(id); return !!(d && d.kind === 'food'); },
    tray: function () { return store.get('tray', []); },          // [{id, n}]
    add: function (id) {
      var t = Bar.tray(), hit = false;
      for (var i = 0; i < t.length; i++) if (t[i].id === id) { t[i].n++; hit = true; }
      if (!hit) t.push({ id: id, n: 1 });
      store.set('tray', t);
      return t;
    },
    remove: function (id) { var t = Bar.tray().filter(function (x) { return x !== id && x.id !== id; }); store.set('tray', t); return t; },
    clear: function () { store.del('tray'); store.del('served'); return []; },
    count: function () { return Bar.tray().reduce(function (a, x) { return a + x.n; }, 0); },
    /* 已送上桌的数量 {id:n} */
    served: function () { return store.get('served', {}); },
    markServed: function (ids) {
      var s = Bar.served();
      (ids || []).forEach(function (id) { s[id] = (s[id] || 0) + 1; });
      store.set('served', s);
      return s;
    },
    /* 还没送上桌的（tray - served） */
    pending: function () {
      var s = Bar.served();
      return Bar.tray().map(function (x) {
        var left = x.n - (s[x.id] || 0);
        return left > 0 ? { id: x.id, n: left } : null;
      }).filter(Boolean);
    },
    /* 待送的主食（拉面/牛排等）——只有点了这些才触发“上菜” */
    pendingFood: function () {
      return Bar.pending().filter(function (x) { return Bar.isFood(x.id); });
    },
    checkoutLine: '好，今晚这些记在账上——账就是你的故事。什么时候想讲了，去吧台另一端找她。',
    checkoutLineJp: 'よし、今夜の分は帳面に付けておく——帳面というのは、あなたの物語だ。話したくなったら、カウンターの向こうの彼女のところへ。'
  };

  /* 工具 */
  function hashStr(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var util = {
    hash: hashStr,
    rng: mulberry,
    pick: function (arr, r) { return arr[Math.floor((r || Math.random)() * arr.length)]; },
    clamp: function (v, a, b) { return Math.max(a, Math.min(b, v)); },
    esc: function (s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    },
    el: function (id) { return document.getElementById(id); },
    /* 从用户文本里挑一句可引用的原话 */
    quoteFrom: function (text, maxLen) {
      maxLen = maxLen || 26;
      var t = String(text || '').replace(/\s+/g, ' ').trim();
      if (!t) return '';
      var parts = t.split(/[。！？!?；;，,\n]/).filter(function (p) { return p.trim().length >= 4; });
      if (!parts.length) return t.length > maxLen ? t.slice(0, maxLen) + '…' : t;
      parts.sort(function (a, b) { return b.length - a.length; });
      var s = parts[0].trim();
      return s.length > maxLen ? s.slice(0, maxLen) + '…' : s;
    },
    pad: function (n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; },
    now: function () { return Date.now(); }
  };

  window.RC = window.RC || {};
  RC.store = store;
  RC.case = Case;
  RC.visits = Visits;
  RC.bar = Bar;
  RC.util = util;
})();
