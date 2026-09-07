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
    try { var o = JSON.parse(window.name || '{}'); o[NAME_KEY] = obj; window.name = JSON.stringify(o); } catch (e) {}
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
      } catch (e) { /* 静默 */ }
    },
    del: function (k) {
      try {
        if (ok) localStorage.removeItem('rc_' + k);
        else { var bag = nameRead(); delete bag[k]; nameWrite(bag); }
      } catch (e) {}
    }
  };

  /* 事件档案（委托内容） */
  var blankCase = function () {
    return {
      handle: '', age: '', gender: '', birth: '',
      category: '', story: '', dream: '', dreamFreq: '', paralysis: false,
      recurring: '',
      inkblots: [],        // [{id, text}]
      assoc: [],           // [{stim, resp, ms}]
      tarot: [],           // [{id, upright, pos}]
      createdAt: 0, updatedAt: 0
    };
  };

  var Case = {
    get: function () {
      var c = store.get('case', null);
      var b = blankCase();
      if (!c) return b;
      for (var k in b) if (c[k] === undefined) c[k] = b[k];
      return c;
    },
    save: function (patch) {
      var c = Case.get();
      for (var k in patch) c[k] = patch[k];
      c.updatedAt = Date.now();
      if (!c.createdAt) c.createdAt = c.updatedAt;
      store.set('case', c);
      return c;
    },
    reset: function () { store.del('case'); store.del('verdict'); },
    has: function () { var c = Case.get(); return !!(c.story || c.tarot.length || c.inkblots.length); }
  };

  /* 来店计数 */
  var Visits = {
    bump: function () {
      var n = store.get('visits', 0) + 1;
      store.set('visits', n);
      store.set('lastVisit', Date.now());
      return n;
    },
    count: function () { return store.get('visits', 0); }
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
  RC.util = util;
})();
