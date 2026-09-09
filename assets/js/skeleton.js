/* ============================================================
   skeleton.js — 骨架屏（首屏不空白）
   页面脚本多为同步渲染，但塔罗、鉴定、吧台等要先读档案再拼 DOM，
   这中间会有一段「整块留白」。此模块在挂载点先铺一层占位条，
   一旦真正的 DOM 出现（MutationObserver）或超时即自动撤掉。
   用法：在页面里 <script src="assets/js/skeleton.js?v=1"></script>，
        并在挂载点上写 data-skel="lines|cards|table|spread"。
   ============================================================ */
(function () {
  var TPL = {
    lines: '<i class="sk sk-l" style="width:94%"></i><i class="sk sk-l" style="width:80%"></i><i class="sk sk-l" style="width:62%"></i>',
    cards: '<i class="sk sk-c"></i><i class="sk sk-c"></i><i class="sk sk-c"></i>',
    table: '<i class="sk sk-l" style="width:100%"></i><i class="sk sk-l" style="width:88%"></i><i class="sk sk-l" style="width:96%"></i><i class="sk sk-l" style="width:70%"></i>',
    spread: '<i class="sk sk-c sk-card-tall"></i><i class="sk sk-c sk-card-tall"></i><i class="sk sk-c sk-card-tall"></i><i class="sk sk-c sk-card-tall"></i><i class="sk sk-c sk-card-tall"></i>'
  };
  var MAX = 2600; /* 兜底：再慢也就 2.6 秒，避免骨架永久占位 */

  function mount(el) {
    if (!el || el.getAttribute('data-skel-done')) return;
    var kind = el.getAttribute('data-skel') || 'lines';
    if (el.children.length) return;
    var box = document.createElement('div');
    box.className = 'skel-box';
    box.setAttribute('data-kind', kind);
    box.setAttribute('aria-hidden', 'true');
    box.innerHTML = TPL[kind] || TPL.lines;
    el.appendChild(box);

    var done = false;
    function clear() {
      if (done) return;
      done = true;
      el.setAttribute('data-skel-done', '1');
      if (box.parentNode) box.parentNode.removeChild(box);
      if (mo) mo.disconnect();
    }
    var mo = new MutationObserver(function () {
      for (var i = 0; i < el.children.length; i++) if (el.children[i] !== box) { clear(); return; }
    });
    mo.observe(el, { childList: true });
    setTimeout(clear, MAX);
  }

  function init() {
    if (!window.MutationObserver) return;
    var els = document.querySelectorAll('[data-skel]');
    for (var i = 0; i < els.length; i++) mount(els[i]);
  }

  window.RC = window.RC || {};
  RC.skeleton = { mount: mount, clear: function (el) { if (el) el.setAttribute('data-skel-done', '1'); } };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
