(function(){
"use strict";
RC.ui.chrome({ title: RC.i18n.t('psyche'), path: 'psyche.html' });
document.getElementById('navMount').innerHTML = RC.ui.nav('psyche.html');
document.getElementById('footMount').innerHTML = RC.ui.siteFoot({ active: 'psyche.html' });

RC.ui.dialog({
  who: { cn: '萨弗兰', jp: 'サフラン' },
  jp: { cn: '梦侦探', jp: '夢探偵' },
  mount: document.getElementById('introMount'),
  text: '接下来三项没有对错。解梦会诊看的是"你反复梦见什么"，联想测的是"哪个词会让你卡住"，句子完成测的是"你通常怎么把一件事说完"。卡住的地方，就是我们要去的地方。',
  speed: 26
});

/* ============================================================
   B · 词语联想（12 词，含红辣椒意象）
   ============================================================ */
var STIM = [
  { cn: '镜',   jp: '鏡' },
  { cn: '母亲', jp: '母' },
  { cn: '夜',   jp: '夜' },
  { cn: '钥匙', jp: '鍵' },
  { cn: '名字', jp: '名' },
  { cn: '楼梯', jp: '階段' },
  { cn: '电梯', jp: 'エレベーター' },
  { cn: '17',   jp: '17' },
  { cn: '戏',   jp: '芝居' },
  { cn: '面具', jp: '仮面' },
  { cn: '醒',   jp: '覚' },
  { cn: '烟',   jp: '煙' }
];
var ai = -1, t0 = 0, assocRows = [], interrupted=false;
document.addEventListener("visibilitychange",function(){if(document.hidden)interrupted=true;});
window.addEventListener("blur",function(){interrupted=true;});
var stimEl = document.getElementById('stim');
var stimBiEl = document.getElementById('stimBilingual');
var inputEl = document.getElementById('assocInput');
var progEl = document.getElementById('assocProg');

function renderStim(n) {
  stimEl.textContent = RC.i18n.of(STIM[n]);
  stimBiEl.innerHTML = '<span class="i18n-cn">' + STIM[n].cn + '</span><span class="i18n-jp">' + STIM[n].jp + '</span>';
}
RC.i18n.onChange(function () { if (ai >= 0 && ai < STIM.length) renderStim(ai); });

document.getElementById('btnAssocStart').addEventListener('click', function () {
  this.classList.add('hidden');
  document.getElementById('btnAssocNext').classList.remove('hidden');
  inputEl.disabled = false;
  inputEl.value = '';
  nextStim();
});
function nextStim() {
  ai++;
  if (ai >= STIM.length) { finishAssoc(); return; }
  assocRows.push(null);
  renderStim(ai);
  inputEl.value = '';
  inputEl.focus();
  t0 = performance.now(); interrupted=false;
  progEl.textContent = (ai + 1) + ' / ' + STIM.length;
}
document.getElementById('btnAssocNext').addEventListener('click', function () {
  if (ai < 0 || ai >= STIM.length) return;
  var ms = Math.round(performance.now() - t0);
  assocRows[ai] = { stim: STIM[ai], resp: inputEl.value.trim(), ms: ms, interrupted:interrupted };
  nextStim();
});
inputEl.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); document.getElementById('btnAssocNext').click(); }
});

function finishAssoc() {
  inputEl.disabled = true;
  document.getElementById('btnAssocNext').classList.add('hidden');
  if (!RC.case.save({ assoc: assocRows })) { document.getElementById('btnAssocNext').classList.remove('hidden'); document.getElementById('btnAssocNext').onclick=finishAssoc; return; }
  var prof = RC.engine.assocProfile(RC.case.get());
  document.getElementById('assocTable').innerHTML = prof.rows.map(function (r) {
    var stimTxt = r.stimCn === r.stimJp ? r.stimCn : (r.stimCn + '／' + r.stimJp);
    return '<tr>' +
      '<th>' + RC.util.esc(stimTxt) + '</th>' +
      '<td>' + (r.resp ? RC.util.esc(r.resp) : '<span class="faint">（未答）</span>') + '</td>' +
      '<td class="mono">' + (r.ms / 1000).toFixed(1) + 's</td>' +
      '<td>' + (r.note ? '<span class="amber">' + RC.util.esc(r.note) + '</span>' : '<span class="faint">―</span>') + '</td>' +
    '</tr>';
  }).join('');
  document.getElementById('assocSumm').textContent = prof.summary;
  document.getElementById('assocBox').classList.add('hidden');
  document.getElementById('assocResult').classList.remove('hidden');
}

/* ============================================================
   C · 句子完成测试（SCT · 6 句）
   ============================================================ */
var SCT_CN = [
  ['今天如果不去想 _______，我大概会 _______。',
   'もし今日 _______ を考えなければ、おそらく _______。'],
  ['已经 _______ 这件事 _______ 了我很久。',
   'もうずっと _______ ことが、私を _______ させている。'],
  ['如果可以回到 _______，我会对 _______ 说 _______。',
   'もし _______ に戻れるなら、_______ に _______ と言うだろう。'],
  ['我反复做的那个梦，结尾总是 _______。',
   '何度も見る夢の最後には、いつも _______。'],
  ['没人知道的是，我 _______。',
   '誰も知らないのは、私が _______。'],
  ['再过十年，我会 _______。',
   '十年後、私は _______。']
];

function renderSct() {
  var drafts=Array.from(document.querySelectorAll('#sctList .sct-a')).map(function(t){return t.value;});
  var saved=RC.case.get().sct;
  var html = '';
  SCT_CN.forEach(function (pair, i) {
    var cnq = pair[0], jpq = pair[1];
    html += '<div class="sct-row">' +
      '<label class="sct-q" for="sct-' + i + '">' +
        '<span class="i18n-cn">' + RC.util.esc(cnq) + '</span>' +
        '<span class="i18n-jp">' + RC.util.esc(jpq) + '</span>' +
      '</label>' +
      '<textarea class="sct-a" id="sct-' + i + '" maxlength="1000" data-i="' + i + '" rows="1" placeholder="—">' + RC.util.esc(drafts[i] !== undefined ? drafts[i] : (saved[i] ? saved[i].a : '')) + '</textarea>' +
    '</div>';
  });
  document.getElementById('sctList').innerHTML = html;
}
renderSct();
RC.i18n.onChange(renderSct);

document.getElementById('btnSct').addEventListener('click', function () {
  var ans = [];
  document.querySelectorAll('#sctList .sct-a').forEach(function (ta) {
    ans.push({
      i: +ta.getAttribute('data-i'),
      qCn: SCT_CN[+ta.getAttribute('data-i')][0],
      qJp: SCT_CN[+ta.getAttribute('data-i')][1],
      a: ta.value.trim()
    });
  });
  var filled = ans.filter(function (x) { return x.a; }).length;
  var msg = document.getElementById('sctMsg');
  if (filled === 0) {
    msg.innerHTML = '<span class="red">※ ' + RC.i18n.t('sctNone') + '</span>';
    return;
  }
  if (!RC.case.save({ sct: ans })) return;
  msg.innerHTML = '<span class="amber">※ ' + RC.i18n.t('sctSaved') + ' ' + filled + ' / ' + SCT_CN.length + '</span>';
});

})();
