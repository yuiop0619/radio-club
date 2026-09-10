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

  /* ---------- 吧台：饮品单 + 主食单 ----------
     内容在 content/menu.json，构建期由 tools/build-content.cjs 打成
     assets/js/content-bundle.js（window.RC_CONTENT），此处只做取值与逻辑。 */
  var MENU = (window.RC_CONTENT && window.RC_CONTENT.menu) || {};
  var DRINKS = MENU.drinks || [];
  var FOODS  = MENU.foods  || [];
  var ALL = DRINKS.concat(FOODS);
  var Bar = {
    menu: ALL,
    drinks: DRINKS,
    foods: FOODS,
    byId: function (id) { for (var i = 0; i < ALL.length; i++) if (ALL[i].id === id) return ALL[i]; return null; },
    isFood: function (id) { var d = Bar.byId(id); return !!(d && d.kind === 'food'); },
    tray: function () {
      var modern=store.get('counter_v2',null);
      if(modern&&modern.version===2&&Array.isArray(modern.tickets)){
        var totals={};modern.tickets.slice(-20).forEach(function(t){if(!t||!t.items)return;ALL.forEach(function(d){var n=t.items[d.id];if(Number.isInteger(n)&&n>0)totals[d.id]=(totals[d.id]||0)+Math.min(n,6);});});
        return Object.keys(totals).map(function(id){return {id:id,n:totals[id]};});
      }
      var old=store.get('tray',[]);return Array.isArray(old)?old.filter(function(x){return x&&Bar.byId(x.id)&&Number.isInteger(x.n)&&x.n>0;}).slice(0,10):[];
    },
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
    served: function () {
      var modern=store.get('counter_v2',null);
      if(modern&&modern.version===2&&Array.isArray(modern.tickets)){var totals={};modern.tickets.slice(-20).forEach(function(t){if(!t||!t.served||!t.items)return;ALL.forEach(function(d){var n=t.served[d.id];if(Number.isInteger(n)&&n>0)totals[d.id]=(totals[d.id]||0)+Math.min(n,t.items[d.id]||0,6);});});return totals;}
      return store.get('served', {});
    },
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
    checkoutLine: (MENU.checkoutLine || {}).cn || '',
    checkoutLineJp: (MENU.checkoutLine || {}).jp || ''
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
