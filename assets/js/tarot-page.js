(function(){
"use strict";
RC.ui.chrome({ title: RC.i18n.t('tarot'), path: 'tarot.html' });
document.getElementById('navMount').innerHTML = RC.ui.nav('tarot.html');
document.getElementById('footMount').innerHTML = RC.ui.siteFoot({ active: 'tarot.html' });

RC.ui.dialog({
  who: { cn: '萨弗兰', jp: 'サフラン' },
  jp: { cn: '梦侦探', jp: '夢探偵' },
  mount: document.getElementById('introMount'),
  text: '牌不预言未来。它只是一面便宜的镜子，让你把心里已经有的答案，借着一张画说出来。所以——别挑，随手翻。',
  speed: 26
});

/* ---------- D2 · 牌阵状态 ---------- */
var SPREAD_KEY = 'pentagram';     // 当前牌阵
var POS;                          // 当前牌阵的位置数组
var results = [];
var flipped = 0;

/* 兜底：即便 tarot-data.js 被缓存为旧版，本页也能自立 */
var SPREAD_FALLBACK = {
  pentagram: { labelCn: '五张解读', labelJp: '五枚解読', pos: [{jp:'過去',cn:'过去'},{jp:'現在',cn:'现在'},{jp:'隠れた動機',cn:'隐藏动机'},{jp:'障害',cn:'障碍'},{jp:'結論',cn:'结论'}], pick: 5 },
  timeLine:  { labelCn: '时间线',  labelJp: 'タイムライン',  pos: [{jp:'過去',cn:'过去'},{jp:'現在',cn:'现在'},{jp:'未来',cn:'未来'}], pick: 3 },
  dailyCard: { labelCn: '每日一牌', labelJp: '今日の一枚',  pos: [{jp:'今日の一枚',cn:'今日一牌'}], pick: 1 }
};

function pickSpread(k, preserve) {
  SPREAD_KEY = k;
  var spreads = RC.tarot && RC.tarot.spreads ? RC.tarot.spreads : SPREAD_FALLBACK;
  var sp = spreads[k] || SPREAD_FALLBACK[k] || SPREAD_FALLBACK.pentagram;
  POS = sp.pos;
  // 标题按钮高亮
  document.querySelectorAll('[data-spread]').forEach(function (b) {
    b.classList.toggle('on', b.getAttribute('data-spread') === k);
  });
  // 提示文字
  var hintKey = 'spreadHint' + k.charAt(0).toUpperCase() + k.slice(1);
  var hint = RC.i18n.t(hintKey);
  document.getElementById('spreadHint').textContent = hint || '';
  // 抽牌按钮文案随牌阵切换
  var dealBtn = document.getElementById('btnDeal');
  if (k === 'dailyCard')       dealBtn.textContent = RC.i18n.t('dealDaily');
  else if (k === 'timeLine')   dealBtn.textContent = RC.i18n.t('dealTimeline');
  else                          dealBtn.textContent = RC.i18n.t('deal');
  if (preserve) return;
  results=[];flipped=0;
  // 已开出的牌清空
  document.getElementById('spread').innerHTML = '';
  document.getElementById('dealHint').textContent = RC.i18n.t('dealHint');
  document.getElementById('readPanel').classList.add('hidden');
  document.getElementById('synthMount').innerHTML = '';
  if (document.getElementById('elementBarMount')) document.getElementById('elementBarMount').innerHTML = '';
}
document.querySelectorAll('.sb-btn').forEach(function (b) {
  b.addEventListener('click', function () {
    var k=b.getAttribute('data-spread');
    if(!RC.case.save({tarot:[],tarotSpread:k}))return;
    pickSpread(k);saveDraft();
  });
});
// 语言切换时更新提示
RC.i18n.onChange(function () {
  pickSpread(SPREAD_KEY, true);
  if (results.length && flipped===results.length) finish(false);
});
pickSpread(SPREAD_KEY);

/* ---------- D1 · 咨询问题（感情/工作/自我/抉择） ---------- */
var CUR_Q = null;
(function renderDomains() {
  var host = document.getElementById('domainBtns');
  if (!host || !RC.tarot.DOMAINS) return;
  host.innerHTML = RC.tarot.DOMAINS.map(function (d) {
    return '<button type="button" class="sb-btn" data-domain="' + d.k + '">' + RC.ui.bi(d.cn, d.jp) + '</button>';
  }).join('');
  host.querySelectorAll('.sb-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      CUR_Q = b.getAttribute('data-domain');
      saveDraft();
      if(results.length && flipped===results.length) finish();
      host.querySelectorAll('.sb-btn').forEach(function (x) { x.classList.toggle('on', x === b); });
      var dom = RC.tarot.DOMAINS.filter(function (d) { return d.k === CUR_Q; })[0];
      document.getElementById('consultHint').textContent =
        RC.i18n.of({ cn: '就「' + dom.cn + '」这件事问牌。', jp: '「' + dom.jp + '」についてカードに問う。' });
    });
  });
})();

function cardHTML(d) {
  var c = RC.tarot.byId(d.id);
  var pos = POS[d.pos];
  var orient = RC.ui.bi(d.upright ? '正位' : '逆位',
                         d.upright ? '正位置' : '逆位置');
  return '<button type="button" aria-label="翻开塔罗牌 / カードを開く" class="tcard' + (d.upright ? '' : ' rev') + '" data-i="' + d.pos + '">' +
    '<div class="inner">' +
    '<div class="face back"><div class="seal">' + (c.seal || RC.tarot.sealOf(d.id)) + '</div></div>' +
    '<div class="face front">' +
    '<div class="num">' + c.r + '</div>' +
    '<div class="glyph">' + c.g + '</div>' +
    '<div class="nm">' + RC.ui.bi(c.cn, c.jp) + '</div>' +
    '</div></div>' +
    '<div class="pos">' + RC.ui.bi(pos.cn, pos.jp) + '・' + orient + '</div>' +
    '</button>';
}

document.getElementById('btnDeal').addEventListener('click', function () {
  if (!CUR_Q) {
    document.getElementById('consultHint').innerHTML = '<span class="red">※ ' +
      RC.i18n.of({ cn: '先选一个咨询问题，再洗牌。', jp: 'まず相談ごとを選んでから。' }) + '</span>';
    return;
  }
  if(!RC.case.save({tarot:[],tarotSpread:SPREAD_KEY,tarotQuestion:CUR_Q}))return;
  if (RC.tarot && RC.tarot.drawFor) {
    results = RC.tarot.drawFor(SPREAD_KEY);
  } else if (RC.tarot && RC.tarot.draw) {
    results = RC.tarot.draw().slice(0, (SPREAD_FALLBACK[SPREAD_KEY] || SPREAD_FALLBACK.pentagram).pick);
  } else {
    results = [];
  }
  flipped = 0;
  var sp = document.getElementById('spread');
  sp.innerHTML = results.map(cardHTML).join('');
  bindCards();saveDraft();
  document.getElementById('dealHint').textContent = RC.i18n.t('dealHintAfter');
  document.getElementById('readPanel').classList.add('hidden');
  document.getElementById('synthMount').innerHTML = '';
  document.getElementById('elementBarMount').innerHTML = '';
});

document.getElementById('btnFlipAll').addEventListener('click', function () {
  var sp = document.getElementById('spread');
  if (!sp.querySelector('.tcard')) return;
  sp.querySelectorAll('.tcard').forEach(function (el) { el.classList.add('flip'); });
  flipped = results.length;
  saveDraft();
  finish();
});

function saveDraft(){
  return RC.store.set('tarotDraft',{caseId:RC.case.get().caseId,spread:SPREAD_KEY,question:CUR_Q,cards:results,flipped:Array.from(document.querySelectorAll('.tcard.flip')).map(function(el){return Number(el.dataset.i);})});
}
function bindCards(){
  document.querySelectorAll('.tcard').forEach(function(el){el.addEventListener('click',function(){
    if(el.classList.contains('flip'))return;el.classList.add('flip');flipped++;saveDraft();if(flipped===results.length)finish();
  });});
}

function finish(save) {
  if(save !== false && !RC.case.save({ tarot: results, tarotSpread: SPREAD_KEY, tarotQuestion: CUR_Q })) return;
  document.getElementById("synthMount").innerHTML="";
  /* 解读表：显示 short + element + 所选问题维度牌义 + 2006 时代行 */
  var rows = results.map(function (d) {
    var c = RC.tarot.byId(d.id);
    var pos = POS[d.pos];
    var orient = RC.i18n.t(d.upright ? 'upright' : 'reversed');
    var shortTxt = RC.ui.bi(c.shortCn || '', c.shortJp || '');
    var elementTxt = c.element ? ' ／ <span class="dim">' + c.element + '</span>' : '';
    var dm = (RC.tarot.dimOf && CUR_Q) ? RC.tarot.dimOf(d.id, CUR_Q) : null;
    var er = RC.tarot.dimOf ? RC.tarot.dimOf(d.id, 'era') : null;
    return '<tr>' +
      '<th>' + RC.util.esc(pos.cn) + '</th>' +
      '<td>' +
        '<b>' + RC.ui.bi(c.cn, c.jp) + '</b>（' + orient + '）' + elementTxt +
        '<br><span class="quote small">' + shortTxt + '</span>' +
        '<br><span class="dim">' + RC.util.esc(d.upright ? c.up : c.rv) + '</span>' +
        (dm ? '<br><span class="quote small amber">' + RC.ui.bi(dm.cn, dm.jp) + '</span>' : '') +
        (er ? '<br><span class="dim small">〔2006〕' + RC.ui.bi(er.cn, er.jp) + '</span>' : '') +
      '</td>' +
    '</tr>';
  }).join('');
  document.getElementById('readTable').innerHTML = rows;

  /* 元素分布条（仅当抽 ≥ 2 张时显示） */
  if (results.length >= 2 && document.getElementById('elementBarMount')) {
    var counts = {};
    results.forEach(function (d) {
      var c = RC.tarot.byId(d.id);
      counts[c.element] = (counts[c.element] || 0) + 1;
    });
    var keys = Object.keys(counts);
    var cellHtml = keys.map(function (k) {
      return '<span class="el-chip">' + k + ' <b>' + counts[k] + '</b></span>';
    }).join(' ');
    document.getElementById('elementBarMount').innerHTML =
      '<div class="dim small" style="margin-bottom:4px">' + RC.i18n.t('elementHint') + '</div>' +
      '<div>' + cellHtml + '</div>';
  }

  document.getElementById('readPanel').classList.remove('hidden');

  /* 综合解读：根据牌阵选择不同的合成位置 */
  var synthIdx = SPREAD_KEY === 'dailyCard' ? 0 : (results.length - 1);
  var concl = results[synthIdx];
  var cc = RC.tarot.byId(concl.id);
  var sPos = POS[synthIdx];
  var domObj = RC.tarot.DOMAINS ? RC.tarot.DOMAINS.filter(function (x) { return x.k === CUR_Q; })[0] : null;
  var qPrefix = domObj ? RC.i18n.of({ cn: '关于「' + domObj.cn + '」：', jp: '「' + domObj.jp + '」について：' }) : '';
  var conclDim = (RC.tarot.dimOf && CUR_Q) ? RC.tarot.dimOf(concl.id, CUR_Q) : null;
  var conclDimTxt = conclDim ? RC.i18n.of(conclDim) : '';
  RC.ui.dialog({
    who: { cn: '萨弗兰', jp: 'サフラン' },
    jp: { cn: '梦侦探', jp: '夢探偵' },
    mount: document.getElementById('synthMount'),
    text: qPrefix + sPos.cn + '位落在「' + cc.cn + '」' + RC.i18n.t(concl.upright ? 'upright' : 'reversed') +
      '——' + (concl.upright ? cc.up : cc.rv) +
      (conclDimTxt ? ' 就这件事而言：' + conclDimTxt : '') +
      ' ……先别下结论，等会诊和联想做完，我再把三样东西拼起来给你看。',
    speed: 26
  });
}

var draft=RC.store.get('tarotDraft',null),savedCase=RC.case.get();
if(draft && draft.caseId===savedCase.caseId && RC.tarot.spreads[draft.spread]){
  pickSpread(draft.spread);CUR_Q=draft.question;
  results=RC.model.normalize({tarotSpread:draft.spread,tarot:draft.cards}).tarot;
  document.getElementById('spread').innerHTML=results.map(cardHTML).join('');
  document.querySelectorAll('.tcard').forEach(function(el){if(Array.isArray(draft.flipped)&&draft.flipped.indexOf(Number(el.dataset.i))>=0){el.classList.add('flip');flipped++;}});
  document.querySelectorAll('[data-domain]').forEach(function(b){b.classList.toggle('on',b.dataset.domain===CUR_Q);});
  bindCards();if(results.length&&flipped===results.length)finish(false);
}

})();
