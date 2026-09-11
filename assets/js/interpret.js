/* ============================================================
   interpret.js — 前端叙事层接入（Phase 4）

   规则负责「看到什么」（engine.js 在本地跑完，报告主体已渲染），
   AI 负责「怎么说」（本节）。两件事分开，所以：

     · 断网 / 未配置模型 / 超时 → 用本地模板拼一段「机器附注」，**永不空白**
     · 模型可用 → 用它的文字替换，逐字浮现，把延迟变成表演

   机器运转日志是纯前端的，必现；它本身就构成一段可演示的仪式。
   ============================================================ */
(function () {
  'use strict';
  var esc = RC.util.esc;

  /* 本地兜底：把已有证据拼成一段机器口吻的附注 */
  function localNote(v) {
    var out = [];
    var top = v.hypotheses && v.hypotheses[0];
    if (top) out.push('经查，本案最可能归属于「' + top.titleCn + '」，评分 ' + top.score + '。');
    if (v.absence) out.push(v.absence);
    if (v.cold && v.cold[1]) out.push(v.cold[1]);
    if (v.prescription && v.prescription[0]) out.push('处方：' + v.prescription[0] + '。');
    if (!out.length) out.push('本案资料过薄，本机维持原判，不作追加推断。');
    return out.join('');
  }

  /* 机器运转日志：纯前端，必现 */
  var STEPS = [
    '接入 07 号塔罗模块',
    '调取词联想断层波形',
    '检索大师笔记（1953–2006）',
    '比对情感谱阈值',
    '成文'
  ];

  function runLog(host, done) {
    var i = 0, lines = [];
    function tick() {
      if (!host.isConnected) return;
      if (i < STEPS.length) {
        lines.push('&gt; ' + esc(STEPS[i]) + ' … <b>就绪</b>');
        host.innerHTML = lines.join('<br>');
        i++;
        setTimeout(tick, 260 + Math.random() * 220);
      } else {
        setTimeout(done, 320);
      }
    }
    tick();
  }

  function attach(v, c) {
    var report = document.getElementById('report');
    if (!report || !v) return;

    var sec = document.createElement('section');
    sec.className = 'ai-sec';
    sec.innerHTML = '<h3>机器附注 <span class="jp">／機械の追記</span></h3>' +
      '<div class="ai-log mono dim small" aria-hidden="true"></div>' +
      '<div class="ai-body" aria-live="polite"></div>';

    /* 插到印章之前；找不到就追加到末尾 */
    var anchor = report.querySelector('.center.mt') || report.querySelector('.stamp');
    if (anchor && anchor.parentNode === report) report.insertBefore(sec, anchor);
    else if (anchor && anchor.parentNode) report.insertBefore(sec, anchor.parentNode);
    else report.appendChild(sec);

    var logBox = sec.querySelector('.ai-log');
    var body = sec.querySelector('.ai-body');
    var settled = false;

    function settle(text, soft) {
      if (settled) return;
      settled = true;
      logBox.style.opacity = '0';
      setTimeout(function () { logBox.remove(); }, 400);
      if (soft) {
        var note = document.createElement('div');
        note.className = 'hint faint';
        note.textContent = '※ 外部叙事模块未接线，本节由本机模板代笔。';
        body.parentNode.insertBefore(note, body);
      }
      RC.ui.type(body, text, 18);
    }

    /* 并发：一边跑日志，一边请求模型。
       优先用户自己的模型（BYOK，rc.gen）；未配置则回退本店 /api/interpret（模板兜底）。 */
    var result = null;
    var handle = (c || {}).handle || '';
    var promise;

    if (RC.gen && RC.gen.isReady()) {
      promise = RC.gen.interpret('verdict', v, handle)
        .then(function (r) { if (r && r.ok && r.text) result = r.text; return result; })
        .catch(function () { return null; });
    } else {
      var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 15000);
      var payload = { evidence: v, handle: handle };
      promise = fetch('/api/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Radio-Client': '1' },
        body: JSON.stringify(payload),
        credentials: 'same-origin',
        signal: ctrl ? ctrl.signal : undefined
      }).then(function (r) { return r.json(); })
        .then(function (r) { if (r && r.ok && r.data && r.data.text) result = r.data.text; return result; })
        .catch(function () { return null; })
        .then(function () { clearTimeout(timer); return result; });
    }

    runLog(logBox, function () {
      promise.then(function () {
        if (result) settle(result, false);
        else settle(localNote(v), true);
      });
    });
  }

  window.RC = window.RC || {};
  RC.interpret = { attach: attach, localNote: localNote };
})();
