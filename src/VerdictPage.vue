<script setup lang="ts">
/* ============================================================
   VerdictPage.vue — 鉴定书（Phase 2：由 verdict-page.js 迁移而来）

   规则引擎在本地跑完（engine.js），页面只负责把它渲染成一份书面鉴定。
   报告主体的 HTML 由 buildReport() 生成，与原实现逐字一致，
   以保证既有浏览器契约测试的 DOM 断言不变。
   ============================================================ */
import {ref, nextTick, onMounted} from 'vue';
import {rc} from './legacy';

const esc = (value: unknown) => rc.util.esc(value);
const t = (key: string) => rc.i18n.t(key);
const bi = (cn: string, jp: string) => rc.ui.bi(cn, jp);

const introMount = ref<HTMLElement | null>(null);
const view = ref<'empty' | 'report'>('empty');
const errText = ref('');
const isError = ref(false);
const hideShare = ref(false);

const plainMode = ref(false);
const reportPlain = ref('');
const reportHtml = ref('');
const vCode = ref('');

const shareMsg = ref('');
const shareWrapOpen = ref(false);
const sharePreview = ref('');
const shareBox = ref<HTMLTextAreaElement | null>(null);
const shareFull = ref(false);
const shareFullDisabled = ref(false);

/* 分享态：summary（摘要链接）优先于 full case */
let current: Record<string, any> = {};
let shared: Record<string, any> | null = null;
let summary: string | null = null;

function exportSummary(): string {
  if (summary !== null) return summary;
  const r = rc.engine.buildVerdict(current);
  return 'RADIO CLUB · 娱乐与自我梳理 / For reflection only\n' +
    (r.spectrum as any[]).map((s) => s.label + ' ' + s.v).join(' / ') + '\n' +
    (r.hypotheses as any[]).map((h) => h.titleCn + ' / ' + h.titleJp).join('\n') + '\n' +
    (r.tarot as any[]).map((x) => x.pos.cn + '：' + x.card.cn).join(' / ') + '\n' + r.stampCn;
}

function buildReport(v: Record<string, any>, visits: number): string {
  let N = 1;
  const sec = (titleCn: string, titleJp: string) => '<h3>' + (N++) + '・' + bi(titleCn, titleJp) + '</h3>';

  let h = '';
  h += '<table class="grid mb"><tr><th data-i18n="callMe">称呼</th><td>' + esc(v.handle || '―') + '</td>' +
       '<th data-i18n="category">类别</th><td>' + esc(v.category || '―') + '</td></tr>' +
       '<tr><th data-i18n="visitCount">来店</th><td>第 ' + visits + ' 回</td>' +
       '<th data-i18n="madeAt">作成</th><td>' + new Date(v.generatedAt || Date.now()).toLocaleString('zh-CN') + '</td></tr></table>';

  h += sec('事件重述', '事件の再構成');
  h += '<p>你用这样的话开头：<span class="quote">「' + esc(v.quotes.story || '…') + '」</span></p>';
  if (v.quotes.dream) h += '<p>你的梦里反复出现：<span class="quote">「' + esc(v.quotes.dream) + '」</span></p>';
  if (v.quotes.rec) h += '<p>而白天缠着你的那句是：<span class="quote">「' + esc(v.quotes.rec) + '」</span></p>';
  if (v.absence) h += '<p class="dim">' + esc(v.absence) + '</p>';
  h += '<p class="dim">' + esc(v.cold[0]) + '</p>';

  h += sec('情感谱', '感情スペクトル') + '<div class="bars">';
  (v.spectrum as any[]).forEach((s) => {
    const n = Math.round(s.v / 5);
    h += '<div class="bar"><span class="bl">' + esc(s.label) + '</span><span class="bt">' + '█'.repeat(n) + '</span><span class="bv">' + s.v + '</span><small>' + esc((s.evidence || []).join('、')) + '</small></div>';
  });
  h += '</div><p class="hint">※ 数值是去重关键词统计，不是心理测量；忽略引号内原话及部分否定表达，仍可能误判。</p>';

  /* 三・解梦会诊：七大师记录 */
  h += sec('解梦会诊', '夢診断セッション');
  if (v.analyst.rows.length) {
    h += '<table class="grid">' + (v.analyst.rows as any[]).map((r) => {
      const name = '<span class="i18n-cn">' + esc(r.masterCn) + '</span><span class="i18n-jp">' + esc(r.masterJp) + '</span>';
      const mot = r.motifs.length
        ? r.motifs.map((k: string) => { const l = rc.analyst.motifLabel(k); return '<span class="i18n-cn">' + esc(l.cn) + '</span><span class="i18n-jp">' + esc(l.jp) + '</span>'; }).join('、')
        : '<span class="faint">—</span>';
      const vd = '<span class="i18n-cn">' + esc(r.verdict.cn || '') + '</span><span class="i18n-jp">' + esc(r.verdict.jp || '') + '</span>';
      return '<tr><th>' + name + '</th><td>' + mot + '</td><td>' + vd + '</td></tr>';
    }).join('') + '</table>';
    h += '<p class="mt dim">' + esc(v.analyst.summary) + '</p>';
  } else {
    h += '<p class="hint dim">※ ' + esc(v.analyst.summary) + '</p>';
  }

  /* 四・词联想：双语刺激词 */
  h += sec('词联想断层', '連想の断層');
  h += '<table class="grid">' + (v.assoc.rows as any[]).map((r) => {
    const stimTxt = (r.stimCn === r.stimJp || !r.stimJp)
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
    h += '<table class="grid">' + (v.sct.rows as any[]).map((r) =>
      '<tr>' +
        '<th style="white-space:nowrap">句 ' + esc(r.i) + '</th>' +
        '<td>' +
          '<span class="i18n-cn"><span class="quote small">' + esc(r.qCn) + '</span></span>' +
          '<span class="i18n-jp"><span class="quote small">' + esc(r.qJp) + '</span></span>' +
          '<br>' +
          (r.empty
            ? '<span class="faint">（空白）</span>'
            : '<span class="amber">' + esc(r.a) + '</span>') +
        '</td>' +
      '</tr>'
    ).join('') + '</table>';
    h += '<p class="mt dim">' + esc(v.sct.summary) + '</p>';
  }

  if (v.birth) {
    h += sec('数秘', '数秘');
    h += '<p>' + t('lifePath') + ' <b class="amber">' + v.birth.lifePath + '</b> ／ ' + esc(v.birth.zodiac) +
      ' ／ ' + t('birthCard') + '「' + bi(v.birth.birthCardObj.cn, v.birth.birthCardObj.jp) + '」——' + esc(v.birth.birthCardObj.up) + '</p>';
  }

  /* 塔罗段：牌阵模板名 + 咨询问题 + 多维牌义 */
  const spreadObj = rc.tarot.spreads[v.tarotSpread] || rc.tarot.spreads.pentagram;
  h += sec('牌阵（' + spreadObj.labelCn + '）',
           rc.tarot.spreads[v.tarotSpread] ? spreadObj.labelJp : 'タロットの配置');
  const qObj = rc.tarot.DOMAINS ? rc.tarot.DOMAINS.filter((x) => x.k === v.tarotQuestion)[0] : null;
  if (qObj) h += '<p class="hint">' + esc(rc.i18n.of!({ cn: '咨询问题：' + qObj.cn, jp: '相談ごと：' + qObj.jp })) + '</p>';
  if (v.tarot.length) {
    h += '<table class="grid">' + (v.tarot as any[]).map((x) => {
      const dm = (rc.tarot.dimOf && v.tarotQuestion) ? rc.tarot.dimOf(x.id, v.tarotQuestion) : null;
      const er = rc.tarot.dimOf ? rc.tarot.dimOf(x.id, 'era') : null;
      return '<tr><th>' + esc(x.pos.cn) + '</th><td>' + bi(x.card.cn, x.card.jp) + '（' + t(x.upright ? 'upright' : 'reversed') +
        '）<br><span class="dim small">' + esc(x.card.shortCn) + ' ／ ' + esc(x.card.shortJp) + '</span><br><span class="dim">' + esc(x.meaning) + '</span>' +
        (dm ? '<br><span class="quote small amber">' + bi(dm.cn, dm.jp) + '</span>' : '') +
        (er ? '<br><span class="dim small">〔2006〕' + bi(er.cn, er.jp) + '</span>' : '') +
        '</td></tr>';
    }).join('') + '</table>';
  } else {
    h += '<p class="dim" data-i18n="noCard">（未抽牌。以下结论仅基于文字与测试，置信度下调。）</p>';
  }

  h += sec('我的结论', '仮説');
  if (v.hypotheses.length) {
    (v.hypotheses as any[]).forEach((hy, i) => {
      h += '<p><b class="amber">' + t('hypothesis') + (i + 1) + '：' + bi(hy.titleCn, hy.titleJp) + '</b><br>' + esc(hy.body) + '</p>';
    });
  } else {
    h += '<p class="dim" data-i18n="noHypo">信息还不足以形成假说。再多告诉我一点。</p>';
  }
  h += '<p class="dim">' + esc(v.cold[1]) + '</p>';

  h += sec('回去之后', '処方') + '<ol style="padding-left:20px">';
  (v.prescription as any[]).forEach((p) => { h += '<li>' + esc(p) + '</li>'; });
  h += '</ol>';

  h += sec('我还想知道', '未解決') + '<ul style="padding-left:20px">';
  (v.open as any[]).forEach((o) => { h += '<li class="dim">' + esc(o) + '</li>'; });
  h += '</ul>';

  h += '<div class="center mt"><span class="stamp">' + bi(v.stampCn, v.stampJp) + '</span></div>';
  h += '<p class="hint center">' + bi('梦侦探萨弗兰', '夢探偵サフラン') + ' ／ RADIO CLUB　――　' +
       t('disclaimer') + '</p>';

  return h;
}

function init() {
  let shareError = '';
  try {
    const incoming: any = rc.share.read('c');
    if (incoming && incoming.kind && incoming.schemaVersion !== 1) throw Error('不支持的分享版本 / Unsupported version');
    if (incoming && incoming.kind === 'summary' && incoming.schemaVersion === 1) {
      if (typeof incoming.text !== 'string' || incoming.text.length > 6000) throw Error('摘要格式有误 / Invalid summary');
      summary = incoming.text; shared = { kind: 'summary' };
    } else if (incoming) shared = rc.model.parse!(incoming.case || incoming);
  } catch (e) { shareError = (e as Error).message; }

  current = summary !== null ? rc.model.normalize({}) : (shared || rc.case.get());

  if (shareError) {
    view.value = 'empty'; isError.value = true; errText.value = shareError;
    return;
  }
  if (summary !== null) {
    view.value = 'report'; plainMode.value = true; reportPlain.value = summary; shareFullDisabled.value = true;
    return;
  }
  if (!shared && !rc.case.has!()) {
    view.value = 'empty'; hideShare.value = true;
    rc.ui.dialog({
      who: { cn: '萨弗兰', jp: 'サフラン' }, jp: { cn: '梦侦探', jp: '夢探偵' },
      mount: introMount.value,
      text: '还没有委托内容呢。先去把事写下来，我才能给你写这份东西。', speed: 26
    });
    return;
  }

  view.value = 'report';
  const v = rc.engine.buildVerdict(current);
  const visits = shared ? 1 : rc.store.get<number>('visits', 0);

  rc.ui.dialog({
    who: { cn: '萨弗兰', jp: 'サフラン' }, jp: { cn: '梦侦探', jp: '夢探偵' },
    mount: introMount.value,
    text: '坐好，' + ((current.handle as string) || '客人') + '。这份我写完了，逐条念给你听。不同意的地方现在就反驳我——反驳也是诊断的一部分。',
    speed: 26
  });

  vCode.value = v.code + ' ／ ' + bi(v.stampCn, v.stampJp);
  reportHtml.value = buildReport(v, visits);

  nextTick(() => {
    /* Phase 4：规则已给出「看到什么」，这里补一层「怎么说」。失败自动回退本地模板。 */
    if (rc.interpret) rc.interpret.attach(v, current);
  });
}

function doShare() {
  const full = shareFull.value && summary === null;
  const payload = full
    ? { kind: 'case', schemaVersion: 1, case: rc.model.normalize(current) }
    : { kind: 'summary', schemaVersion: 1, text: exportSummary() };
  try {
    const link = rc.share.link('c', payload);
    sharePreview.value = full ? JSON.stringify((payload as any).case, null, 2) : (payload as any).text;
    if (shareBox.value) shareBox.value.value = link;
    shareWrapOpen.value = true;
    shareMsg.value = full
      ? '将分享以上完整原文，请检查后复制。 / 原文を確認してコピー。'
      : '仅分享以上摘要，不包含姓名、生日或原文。 / 原文なしの要約です。';
  } catch (e) {
    shareMsg.value = (e as Error).message; shareWrapOpen.value = false;
  }
}

function onShareFullChange() { shareWrapOpen.value = false; if (shareBox.value) shareBox.value.value = ''; }

function printPage() { window.print(); }

function copyShare() {
  const box = shareBox.value; if (!box || !box.value) return;
  rc.share.copy(box.value).then(
    () => { shareMsg.value = '已复制 / コピーしました'; },
    () => { box.focus(); box.select(); shareMsg.value = '复制未成功，请手动复制链接。 / 手動でコピーしてください。'; }
  );
}

onMounted(() => {
  init();
  nextTick(() => {
    rc.i18n.apply?.(document);
    /* share-card.js 在 DOMContentLoaded 时找不到 #btnCard（Vue 挂载更晚），这里补绑一次 */
    rc.shareCard?.init();
  });
});
</script>

<template>
  <div ref="introMount" id="introMount"></div>

  <div id="emptyMount" :class="{hidden: view !== 'empty'}">
    <div class="panel"><div class="p-body center">
      <p v-if="isError" class="dim" role="alert">{{ errText }}</p>
      <p v-else class="dim" data-i18n="emptyVerdict">吧台还没有收到你的委托。</p>
      <a v-if="!isError" class="btn" href="order.html" data-i18n="toOrder">去点单 →</a>
    </div></div>
  </div>

  <div id="reportMount" :class="{hidden: view !== 'report'}">
    <div class="panel">
      <div class="p-head">
        <h2><span class="i18n-cn">鉴定书</span><span class="i18n-jp">鑑定書</span></h2>
        <span class="p-en">VERDICT</span>
        <span class="p-note" id="vCode" v-html="vCode"></span>
      </div>
      <div
        class="p-body report" id="report"
        :style="plainMode ? { whiteSpace: 'pre-wrap' } : undefined"
        v-html="plainMode ? esc(reportPlain) : reportHtml"></div>
    </div>
    <div class="center mt">
      <button type="button" class="btn ghost" id="btnPrint" data-i18n="printIt" @click="printPage">打印</button>
      <label><input type="checkbox" id="shareFull" :disabled="shareFullDisabled" v-model="shareFull" @change="onShareFullChange"> 包含原始档案（生日、原文和测试回答） / 原文も含む</label>
      <button :class="{hidden: hideShare}" type="button" class="btn ghost" id="btnShare" @click="doShare">预览分享 / プレビュー</button>
      <button type="button" class="btn ghost" id="btnCard"><span class="i18n-cn" data-i18n="shareCard"></span><span class="i18n-jp" data-i18n="shareCard"></span></button>
      <a class="btn ghost" href="order.html?new=1" data-i18n="orderAgain">重写委托</a>
      <a class="btn" href="index.html" data-i18n="backCounter">回吧台</a>
    </div>
    <div class="hint center" id="shareMsg">{{ shareMsg }}</div>
    <div class="mt" id="shareWrap" :class="{hidden: !shareWrapOpen}">
      <pre id="sharePreview" class="share-preview">{{ sharePreview }}</pre>
      <button type="button" class="btn" id="btnCopyShare" @click="copyShare">复制预览链接 / コピー</button>
      <label for="shareBox">分享链接 / リンク</label>
      <textarea ref="shareBox" id="shareBox" readonly style="min-height:64px;font-size:11px"></textarea>
      <div class="hint">链接持有人可以读取预览内容。片段不会随页面请求发送，但不是加密；已分发副本无法撤回。 / リンクを持つ人は内容を読めます。</div>
    </div>

    <div class="panel next-card">
      <div class="p-head">
        <h2><span class="i18n-cn">接下来</span><span class="i18n-jp">次は</span></h2>
        <span class="p-en">NEXT</span>
      </div>
      <div class="p-body">
        <p class="dim"><span class="i18n-cn">这份鉴定书只是中场。你可以继续往深处走，也可以重新开始一句委托。</span><span class="i18n-jp">この鑑定書は中盤。深く進んでもいいし、新しい依頼を書いてもいい。</span></p>
        <div class="next-actions">
          <a class="btn" href="psyche.html"><span class="i18n-cn">去做精神分析 →</span><span class="i18n-jp">精神分析へ →</span></a>
          <a class="btn ghost" href="tarot.html"><span class="i18n-cn">再抽一组牌 →</span><span class="i18n-jp">もう一组のカード →</span></a>
          <a class="btn ghost" href="order.html?new=1"><span class="i18n-cn">追加一句委托 →</span><span class="i18n-jp">依頼を追加 →</span></a>
        </div>
      </div>
    </div>
  </div>
</template>
