/* ============================================================
   haunt.js — 氛围层（神秘但不吓人）
   来店记忆 / 17 层电梯的温和彩蛋 / 打烊前的一句低语
   不含任何恐怖、故障或惊吓元素
   ============================================================ */
(function () {
  var U = RC.util;

  function init() {
    var visits = RC.visits.bump();
    var vc = U.el('rcVisit');
    if (vc) RC.ui.counter(vc, 100000 + visits * 7 + 3, 6);

    /* 电梯：升到 17 层停住，一句温和的说明 */
    var elev = U.el('rcElevator');
    if (elev) {
      var f = 1;
      var t = setInterval(function () {
        f++;
        elev.textContent = U.pad(f, 2) + 'F';
        if (f >= 17) {
          clearInterval(t);
          elev.textContent = '17F';
          var cap = U.el('rcElevCap');
          if (cap) cap.textContent = '※ 17 层以上，今晚不开放。别担心，只是不开放。';
        }
      }, 200);
    }

    /* 打烊低语：停留较久后，店主温和地问候一句（呼应已点的饮品） */
    if (document.body.hasAttribute('data-amb-whisper')) {
      setTimeout(function () {
        var cnt = (RC.bar && RC.bar.count) ? RC.bar.count() : 0;
        var txt = cnt > 0
          ? '……打烊前，你点的那 ' + cnt + ' 杯还合口味吗。想再来一杯，我们也不急着打烊。'
          : '……打烊前，要来一杯吗。热的凉的都有。不着急，我们等你。';
        RC.ui.dialog({
          who: '岩夫', jp: '店主', master: true,
          text: txt,
          speed: 40
        });
      }, 30000 + Math.random() * 15000);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
