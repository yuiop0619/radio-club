/* ============================================================
   puppet.js — 首页中国元素：皮影戏「影窗」（陕西 / 川北真实皮影 · 红发侦探）
   首页右下角是一块背光透亮的影窗（亮子），里面是照真实皮影照片风格
   生成的红发侦探皮影：侧脸五分脸、单凤眼、通体镂空雕花透光、分节
   签子关节、点翠珠花发髻、手持放大镜。
   - 图像：assets/img/puppet-det-768.webp
   - 交互：点击 / 回车滚动到 #vp 第一人称镜头（进店坐下）
   - 操纵感：CSS 让整块影窗轻微摆动，如艺人执签轻移
   仅在 index.html 引入；挂载点 #heroPuppet（不存在则静默跳过）
   ============================================================ */
(function () {
  var U = RC.util;

  /* ---------- 挂载影窗 + 交互 ---------- */
  function hero(mount) {
    if (!mount) return null;
    mount.insertAdjacentHTML(
      'afterbegin',
      '<img class="pp-img" src="assets/img/puppet-det-768.webp" alt="" draggable="false">'
    );

    /* 点击 / 回车：进店，滚到第一人称镜头 */
    function enter() {
      var vp = document.getElementById('vp');
      if (vp && vp.scrollIntoView) vp.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else if (vp) window.scrollTo(0, vp.offsetTop);
    }
    mount.addEventListener('click', enter);
    mount.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); enter(); }
    });

    return { enter: enter };
  }

  function init() {
    var mount = U.el('heroPuppet');
    if (!mount) return;
    /* 双语 aria-label（无障碍） */
    if (!mount.getAttribute('aria-label')) {
      mount.setAttribute('aria-label', RC.i18n.of({ cn: '进入店里，坐到吧台', jp: '店に入って、カウンターに座る' }));
    }
    hero(mount);
  }

  window.RC = window.RC || {};
  RC.puppet = { hero: hero };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
