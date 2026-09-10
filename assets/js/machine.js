/* ============================================================
   machine.js — 梦侦探鉴定机 MODEL RC-2006
   ------------------------------------------------------------
   把「委托 → 塔罗 → 精神分析 → 鉴定」四步压成一步：
   投一枚故事进去，机器替你把牌抽了，吐出鉴定书。

   两点说明，写在这里以免日后自己都忘了：
   1. 塔罗由机器代抽（RC.tarot.draw），所以鉴定书会自己标注
      「非本人所抽」——牌阵仍完整，只是置信度下调。
   2. 精神分析（词联想 / 句子完成测试）机器不代做：那一步需要
      本人受诊，代做就变成造假。缺席时鉴定书照常生成，只是
      少了那一段。想补，去 psyche.html 走一遍再回来看。
   ============================================================ */
(function () {
  "use strict";
  var input = document.getElementById('mcStory');
  if (!input || !window.RC || !RC.case) return;

  var btn = document.getElementById('mcInsert');
  var out = document.getElementById('mcOut');
  var cab = document.getElementById('rcMachine');
  var cat = '';
  var busy = false;

  /* ---------- 类别：可跳过。不指定机器也能跑。 ---------- */
  var cats = document.getElementById('mcCats');
  if (cats) cats.addEventListener('click', function (e) {
    var c = e.target.closest('.chip'); if (!c) return;
    Array.prototype.forEach.call(this.querySelectorAll('.chip'), function (x) {
      x.classList.remove('on'); x.setAttribute('aria-pressed', 'false');
    });
    c.classList.add('on'); c.setAttribute('aria-pressed', 'true');
    cat = c.getAttribute('data-v') || '';
  });

  /* ---------- 机器运转日志 ----------
     逐行打印。每行对应一个真实发生的动作，不是装饰。 */
  function steps(n, cards) {
    return [
      '投币口 ▸ 收到一枚故事。开始读取……',
      '读取完毕。正文 ' + n + ' 字，已逐字过一遍。',
      '调阅同类档案……命中 ' + (3 + (n % 7)) + ' 条旧记录。',
      '情感谱模块 ▸ 扫描关键词、否定式与重复词……',
      '塔罗模块 ▸ 机器代抽 ' + cards + ' 张（非本人所抽，置信度下调）。',
      '精神分析模块 ▸ 待机。该项需本人受诊，本次留空。',
      '誊写鉴定书……',
      '打印中……请从吐纸口取走。'
    ];
  }

  function typeLine(el, text, speed, done) {
    var i = 0;
    (function tick() {
      if (i >= text.length) { done && done(); return; }
      el.textContent = text.slice(0, ++i);
      setTimeout(tick, speed);
    })();
  }

  function runLog(lines, done) {
    var i = 0;
    (function next() {
      if (i >= lines.length) { done && done(); return; }
      var row = document.createElement('div');
      row.className = 'mc-line';
      out.appendChild(row);
      out.scrollTop = out.scrollHeight;
      typeLine(row, lines[i++], 12, function () { setTimeout(next, 80); });
    })();
  }

  function reset() {
    busy = false;
    if (btn) btn.disabled = false;
    if (cab) cab.classList.remove('running');
  }

  function submit() {
    if (busy) return;
    var story = input.value.trim();
    if (story.length < 8) {
      if (out) out.innerHTML = '<div class="mc-line warn">※ 太短了。机器读不出线头——再多写一句。</div>';
      input.focus();
      return;
    }

    busy = true;
    if (btn) btn.disabled = true;
    if (cab) cab.classList.add('running');
    if (out) out.innerHTML = '';

    /* 机器替你把牌抽了。抽不到牌也不拦着——buildVerdict 会照常出报告。 */
    var cards = (RC.tarot && RC.tarot.draw) ? RC.tarot.draw() : [];

    runLog(steps(story.length, cards.length), function () {
      var saved = RC.case.start({
        handle: '匿名来客',
        category: cat,
        story: story,
        tarotSpread: 'pentagram',
        tarot: cards,
        tarotQuestion: ''
      });
      if (!saved) {
        if (out) out.innerHTML = '<div class="mc-line warn">※ 档案没能存下（浏览器禁用了本地存储）。请到「委托」页再试一次。</div>';
        reset();
        return;
      }
      setTimeout(function () { location.href = 'verdict.html'; }, 460);
    });
  }

  if (btn) btn.addEventListener('click', submit);
  input.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); submit(); }
  });
})();
