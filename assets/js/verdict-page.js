(function(){
"use strict";
RC.ui.chrome({ title: RC.i18n.t('verdict'), path: 'verdict.html' });
document.getElementById('navMount').innerHTML = RC.ui.nav('verdict.html');
document.getElementById('footMount').innerHTML = RC.ui.siteFoot({ active: 'verdict.html' });

document.getElementById('btnPrint').addEventListener('click', function () { window.print(); });

/* Sharing is an explicit preview, followed by a separate copy action. */
var shared=null,shareError='',summary=null;
try {
  var incoming=RC.share.read('c');
  if(incoming && incoming.kind && incoming.schemaVersion!==1)throw Error('不支持的分享版本 / Unsupported version');
  if(incoming && incoming.kind==='summary' && incoming.schemaVersion===1) {
    if(typeof incoming.text!=='string'||incoming.text.length>6000) throw Error('摘要格式有误 / Invalid summary');
    summary=incoming.text; shared=true;
  } else if(incoming) shared=RC.model.parse(incoming.case || incoming);
} catch(e) { shareError=e.message; }
var c=summary!==null?RC.model.normalize({}):(shared || RC.case.get());
var esc=RC.util.esc;
function exportSummary() {
  if(summary!==null)return summary;
  var r=RC.engine.buildVerdict(c);
  return 'RADIO CLUB · 娱乐与自我梳理 / For reflection only\n' +
    r.spectrum.map(function(s){return s.label+' '+s.v;}).join(' / ')+'\n'+
    r.hypotheses.map(function(h){return h.titleCn+' / '+h.titleJp;}).join('\n')+'\n'+
    r.tarot.map(function(t){return t.pos.cn+'：'+t.card.cn;}).join(' / ')+'\n'+r.stampCn;
}
var btnShare=document.getElementById('btnShare');
btnShare.addEventListener('click',function(){
  var full=document.getElementById('shareFull').checked && summary===null;
  var payload=full?{kind:'case',schemaVersion:1,case:RC.model.normalize(c)}:{kind:'summary',schemaVersion:1,text:exportSummary()};
  var msg=document.getElementById('shareMsg');
  try {
    var link=RC.share.link('c',payload);
    document.getElementById('sharePreview').textContent=full?JSON.stringify(payload.case,null,2):payload.text;
    document.getElementById('shareBox').value=link;
    document.getElementById('shareWrap').classList.remove('hidden');
    msg.textContent=full?'将分享以上完整原文，请检查后复制。 / 原文を確認してコピー。':'仅分享以上摘要，不包含姓名、生日或原文。 / 原文なしの要約です。';
  }catch(e){msg.textContent=e.message;document.getElementById('shareWrap').classList.add('hidden');}
});
document.getElementById('shareFull').addEventListener('change',function(){document.getElementById('shareWrap').classList.add('hidden');document.getElementById('shareBox').value='';});
document.getElementById('btnCopyShare').addEventListener('click',function(){
  var box=document.getElementById('shareBox');
  if(!box.value)return;
  RC.share.copy(box.value).then(function(){document.getElementById('shareMsg').textContent='已复制 / コピーしました';},function(){box.focus();box.select();document.getElementById('shareMsg').textContent='复制未成功，请手动复制链接。 / 手動でコピーしてください。';});
});
if(shareError) {
  document.getElementById('emptyMount').classList.remove('hidden');
  var err=document.querySelector('#emptyMount p');err.removeAttribute('data-i18n');err.textContent=shareError;err.setAttribute('role','alert');
} else if(summary!==null) {
  document.getElementById('reportMount').classList.remove('hidden');
  document.getElementById('report').textContent=summary;
  document.getElementById('report').style.whiteSpace='pre-wrap';
  document.getElementById('shareFull').disabled=true;
} else if (!shared && !RC.case.has()) {
  document.getElementById('emptyMount').classList.remove('hidden');
  document.getElementById('btnShare').classList.add('hidden');
  RC.ui.dialog({ who: { cn: '萨弗兰', jp: 'サフラン' }, jp: { cn: '梦侦探', jp: '夢探偵' },
    mount: document.getElementById('introMount'),
    text: '还没有委托内容呢。先去把事写下来，我才能给你写这份东西。', speed: 26 });
} else {
  document.getElementById('reportMount').classList.remove('hidden');
  var v = RC.engine.buildVerdict(c);
  var visits = shared ? 1 : RC.store.get('visits', 0);

  RC.ui.dialog({ who: { cn: '萨弗兰', jp: 'サフラン' }, jp: { cn: '梦侦探', jp: '夢探偵' },
    mount: document.getElementById('introMount'),
    text: '坐好，' + (c.handle || '客人') + '。这份我写完了，逐条念给你听。不同意的地方现在就反驳我——反驳也是诊断的一部分。',
    speed: 26, done: function () { document.getElementById('reportMount').classList.remove('hidden'); } });

  document.getElementById('vCode').innerHTML = v.code + ' ／ ' + RC.ui.bi(v.stampCn, v.stampJp);

  /* 章节计数器：让 · 序号自适应（有无生日、有无 SCT 都正确） */
  var N = 1;
  function sec(titleCn, titleJp) {
    return '<h3>' + (N++) + '・' + RC.ui.bi(titleCn, titleJp) + '</h3>';
  }

  var h = '';
  h += '<table class="grid mb"><tr><th data-i18n="callMe">称呼</th><td>' + esc(c.handle || '―') + '</td>' +
       '<th data-i18n="category">类别</th><td>' + esc(c.category || '―') + '</td></tr>' +
       '<tr><th data-i18n="visitCount">来店</th><td>第 ' + (visits) + ' 回</td>' +
       '<th data-i18n="madeAt">作成</th><td>' + new Date(v.generatedAt || Date.now()).toLocaleString('zh-CN') + '</td></tr></table>';

  h += sec('事件重述', '事件の再構成');
  h += '<p>你用这样的话开头：<span class="quote">「' + esc(v.quotes.story || '…') + '」</span></p>';
  if (v.quotes.dream) h += '<p>你的梦里反复出现：<span class="quote">「' + esc(v.quotes.dream) + '」</span></p>';
  if (v.quotes.rec) h += '<p>而白天缠着你的那句是：<span class="quote">「' + esc(v.quotes.rec) + '」</span></p>';
  if (v.absence) h += '<p class="dim">' + esc(v.absence) + '</p>';
  h += '<p class="dim">' + esc(v.cold[0]) + '</p>';

  h += sec('情感谱', '感情スペクトル') + '<div class="bars">';
  v.spectrum.forEach(function (s) {
    var n = Math.round(s.v / 5);
    h += '<div class="bar"><span class="bl">' + esc(s.label) + '</span><span class="bt">' + '█'.repeat(n) + '</span><span class="bv">' + s.v + '</span><small>' + esc((s.evidence||[]).join('、')) + '</small></div>';
  });
  h += '</div><p class="hint">※ 数值是去重关键词统计，不是心理测量；忽略引号内原话及部分否定表达，仍可能误判。</p>';

  /* 三・解梦会诊：七大师记录 */
  h += sec('解梦会诊', '夢診断セッション');
  if (v.analyst.rows.length) {
    h += '<table class="grid">' + v.analyst.rows.map(function (r) {
      var name = '<span class="i18n-cn">' + esc(r.masterCn) + '</span><span class="i18n-jp">' + esc(r.masterJp) + '</span>';
      var mot = r.motifs.length
        ? r.motifs.map(function (k) { var l = RC.analyst.motifLabel(k); return '<span class="i18n-cn">' + esc(l.cn) + '</span><span class="i18n-jp">' + esc(l.jp) + '</span>'; }).join('、')
        : '<span class="faint">—</span>';
      var vd = '<span class="i18n-cn">' + esc(r.verdict.cn || '') + '</span><span class="i18n-jp">' + esc(r.verdict.jp || '') + '</span>';
      return '<tr><th>' + name + '</th><td>' + mot + '</td><td>' + vd + '</td></tr>';
    }).join('') + '</table>';
    h += '<p class="mt dim">' + esc(v.analyst.summary) + '</p>';
  } else {
    h += '<p class="hint dim">※ ' + esc(v.analyst.summary) + '</p>';
  }

  /* 四・词联想：双语刺激词 */
  h += sec('词联想断层', '連想の断層');
  h += '<table class="grid">' + v.assoc.rows.map(function (r) {
    var stimTxt = (r.stimCn === r.stimJp || !r.stimJp)
      ? esc(r.stimCn)
      : '<span class="i18n-cn">' + esc(r.stimCn) + '</span><span class="i18n-jp">' + esc(r.stimJp) + '</span>';
    return '<tr>' +
      '<th>' + stimTxt + '</th>' +
      '<td>' + (r.resp ? esc(r.resp) : '<span class="faint">（未答）</span>') + '</td>' +
      '<td class="mono">' + (r.ms / 1000).toFixed(1) + 's</td>' +
      '<td>' + (r.note ? '<span class="amber">' + esc(r.note) + '</span>' : '<span class="faint">―</span>') + '</td>' +
    '</tr>';
  }).join('') + '</table>';
  h += '<p class="mt dim">' + esc(v.assoc.summary) + '</p>';

  /* 新增 · SCT（可选：无则跳过） */
  if (v.sct) {
    h += sec('句子完成测试', '文完成テスト');
    h += '<table class="grid">' + v.sct.rows.map(function (r) {
      return '<tr>' +
        '<th style="white-space:nowrap">句 ' + esc(r.i) + '</th>' +
        '<td>' +
          '<span class="i18n-cn"><span class="quote small">' + esc(r.qCn) + '</span></span>' +
          '<span class="i18n-jp"><span class="quote small">' + esc(r.qJp) + '</span></span>' +
          '<br>' +
          (r.empty
            ? '<span class="faint">（空白）</span>'
            : '<span class="amber">' + esc(r.a) + '</span>') +
        '</td>' +
      '</tr>';
    }).join('') + '</table>';
    h += '<p class="mt dim">' + esc(v.sct.summary) + '</p>';
  }

  if (v.birth) {
    h += sec('数秘', '数秘');
    h += '<p>' + RC.i18n.t('lifePath') + ' <b class="amber">' + v.birth.lifePath + '</b> ／ ' + esc(v.birth.zodiac) +
      ' ／ ' + RC.i18n.t('birthCard') + '「' + RC.ui.bi(v.birth.birthCardObj.cn, v.birth.birthCardObj.jp) + '」——' + esc(v.birth.birthCardObj.up) + '</p>';
  }

  /* 塔罗段：牌阵模板名 + 咨询问题 + 多维牌义 */
  var spreadObj = RC.tarot.spreads[v.tarotSpread] || RC.tarot.spreads.pentagram;
  h += sec('牌阵（' + spreadObj.labelCn + '）',
           RC.tarot.spreads[v.tarotSpread] ? spreadObj.labelJp : 'タロットの配置');
  var qObj = RC.tarot.DOMAINS ? RC.tarot.DOMAINS.filter(function (x) { return x.k === v.tarotQuestion; })[0] : null;
  if (qObj) h += '<p class="hint">' + esc(RC.i18n.of({ cn: '咨询问题：' + qObj.cn, jp: '相談ごと：' + qObj.jp })) + '</p>';
  if (v.tarot.length) {
    h += '<table class="grid">' + v.tarot.map(function (t) {
      var dm = (RC.tarot.dimOf && v.tarotQuestion) ? RC.tarot.dimOf(t.id, v.tarotQuestion) : null;
      var er = RC.tarot.dimOf ? RC.tarot.dimOf(t.id, 'era') : null;
      return '<tr><th>' + esc(t.pos.cn) + '</th><td>' + RC.ui.bi(t.card.cn, t.card.jp) + '（' + RC.i18n.t(t.upright ? 'upright' : 'reversed') +
        '）<br><span class="dim small">' + esc(t.card.shortCn) + ' ／ ' + esc(t.card.shortJp) + '</span><br><span class="dim">' + esc(t.meaning) + '</span>' +
        (dm ? '<br><span class="quote small amber">' + RC.ui.bi(dm.cn, dm.jp) + '</span>' : '') +
        (er ? '<br><span class="dim small">〔2006〕' + RC.ui.bi(er.cn, er.jp) + '</span>' : '') +
        '</td></tr>';
    }).join('') + '</table>';
  } else {
    h += '<p class="dim" data-i18n="noCard">（未抽牌。以下结论仅基于文字与测试，置信度下调。）</p>';
  }

  h += sec('我的结论', '仮説');
  if (v.hypotheses.length) {
    v.hypotheses.forEach(function (hy, i) {
      h += '<p><b class="amber">' + RC.i18n.t('hypothesis') + (i + 1) + '：' + RC.ui.bi(hy.titleCn, hy.titleJp) + '</b><br>' + esc(hy.body) + '</p>';
    });
  } else {
    h += '<p class="dim" data-i18n="noHypo">信息还不足以形成假说。再多告诉我一点。</p>';
  }
  h += '<p class="dim">' + esc(v.cold[1]) + '</p>';

  h += sec('回去之后', '処方') + '<ol style="padding-left:20px">';
  v.prescription.forEach(function (p) { h += '<li>' + esc(p) + '</li>'; });
  h += '</ol>';

  h += sec('我还想知道', '未解決') + '<ul style="padding-left:20px">';
  v.open.forEach(function (o) { h += '<li class="dim">' + esc(o) + '</li>'; });
  h += '</ul>';

  h += '<div class="center mt"><span class="stamp">' + RC.ui.bi(v.stampCn, v.stampJp) + '</span></div>';
  h += '<p class="hint center">' + RC.ui.bi('梦侦探萨弗兰', '夢探偵サフラン') + ' ／ RADIO CLUB　――　' +
       RC.i18n.t('disclaimer') + '</p>';

  document.getElementById('report').innerHTML = h;
  RC.i18n.apply(document);
  /* Phase 4：规则已给出「看到什么」，这里补一层「怎么说」。失败自动回退本地模板。 */
  if (RC.interpret) RC.interpret.attach(v, c);
}

})();
