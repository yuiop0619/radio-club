/* ============================================================
   i18n.js — 中／日双语层
   默认中文（cn），可一键切回日文（jp），选择记入 localStorage。
   - 静态文案：HTML 里用 <span class="i18n-cn">／<span class="i18n-jp"> 并列，靠 body[data-lang] 显隐
   - 动态文案：JS 里用 RC.i18n.t(key) 或 RC.i18n.of({cn,jp})
   ============================================================ */
(function () {
  var KEY = 'lang';
  var DEFAULT = 'cn';
  var listeners = [];

  /* 词条内容见 content/i18n.json，构建期打入 RC_CONTENT.i18n.dict */
  var DICT = (window.RC_CONTENT && window.RC_CONTENT.i18n && window.RC_CONTENT.i18n.dict) ||
             { cn: {}, jp: {} };

  var cur = null;
  try { cur = RC.store.get(KEY, DEFAULT); } catch (e) { cur = DEFAULT; }
  if (cur !== 'cn' && cur !== 'jp') cur = DEFAULT;

  function t(key) {
    var d = DICT[cur] || DICT[DEFAULT];
    var v = d[key];
    if (v == null) v = (DICT[DEFAULT] || {})[key];
    return v == null ? key : v;
  }

  /* 取 {cn, jp} 对象的当前语言字段 */
  function of(obj) {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    var v = cur === 'jp' ? obj.jp : obj.cn;
    return v == null ? (obj.cn == null ? obj.jp : obj.cn) : v;
  }

  /* 渲染并列双语：默认只输出当前语言（供 JS 拼接） */
  function pair(cn, jp) { return cur === 'jp' ? jp : cn; }

  function applyTo(root) {
    var scope = root || document;
    if (document.body) document.body.setAttribute('data-lang', cur);
    if (document.documentElement) document.documentElement.setAttribute('lang', cur === 'jp' ? 'ja' : 'zh-CN');
    var els = scope.querySelectorAll('[data-i18n]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var key = el.getAttribute('data-i18n');
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        var ph = el.getAttribute('data-i18n-ph');
        if (ph) el.placeholder = t(ph);
      } else {
        el.textContent = t(key);
      }
    }
    var phs = scope.querySelectorAll('[data-i18n-ph]');
    for (var j = 0; j < phs.length; j++) phs[j].placeholder = t(phs[j].getAttribute('data-i18n-ph'));
  }

  function set(lang) {
    if (lang !== 'cn' && lang !== 'jp') return;
    cur = lang;
    try { RC.store.set(KEY, lang); } catch (e) {}
    applyTo(document);
    var btns = document.querySelectorAll('.lang-toggle');
    for (var i = 0; i < btns.length; i++) {
      btns[i].textContent = t('langSwitch');
      btns[i].setAttribute('title', t('langTip'));
      btns[i].setAttribute('aria-label', t('langTip'));
    }
    for (var k = 0; k < listeners.length; k++) {
      try { listeners[k](lang); } catch (e) {}
    }
  }

  function toggle() { set(cur === 'cn' ? 'jp' : 'cn'); }

  function onChange(fn) { if (typeof fn === 'function') listeners.push(fn); }

  window.RC = window.RC || {};
  RC.i18n = {
    lang: function () { return cur; },
    t: t, of: of, pair: pair, set: set, toggle: toggle,
    onChange: onChange, apply: applyTo, DICT: DICT
  };

  /* 统一委托语言切换按钮（siteFoot 返回的 .lang-toggle 也能响应） */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.lang-toggle');
    if (b) { e.preventDefault(); toggle(); }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { applyTo(document); });
  } else {
    applyTo(document);
  }
})();
