<script setup lang="ts">
/* ============================================================
   TarotPage.vue — 塔罗展开
   （Phase 2 由 tarot-page.js 迁移；批次 3 做深度化）

   与原实现保持的三条契约（browser.cjs 依赖）：
     1. [data-domain] 选咨询问题 → #btnDeal 洗牌 → .tcard 逐张翻开
     2. 切换语言后 .tcard 数量与 .flip 状态都不变
     3. 刷新页面从 tarotDraft 恢复牌阵与已翻开的牌

   批次 3 新增：
     · 位置化解读：同一张牌在不同牌阵位置，各自配「位置口吻 + 追问」
     · 抽牌写入 RC.profile（dealt 之后第一次 finish 才记一次，避免重复）
     · 分享：复制文字摘要 / 生成一张长图（canvas，不依赖图片资源）
   ============================================================ */
import {ref, computed, watch, onMounted, nextTick} from 'vue';
import {rc} from './legacy';
import profile from './profile';

/* legacy 逻辑仍复用，逐处 cast 到 any，避免类型桥越铺越厚 */
const T = rc.tarot as any;
const C = rc.case as any;
const esc = (value: unknown) => rc.util.esc(value);

const RAW = (typeof window !== 'undefined' && (window as any).RC_CONTENT && (window as any).RC_CONTENT.tarot) || {};

interface Pos { cn: string; jp: string }
interface Drawn { id: number; upright: boolean; pos: number }

/* ---------- i18n ---------- */
const lang = ref(rc.i18n.lang());
rc.i18n.onChange(() => { lang.value = rc.i18n.lang(); });
const t = (key: string) => { void lang.value; return rc.i18n.t(key); };
const of = (pair: { cn: string; jp: string }) => { void lang.value; return rc.i18n.of!(pair); };
const bi = (cn: string, jp: string) => rc.ui.bi(cn, jp);
const rawBi = (pair: { cn?: string; jp?: string } | null) => {
  void lang.value;
  if (!pair) return '';
  return lang.value === 'jp' ? String(pair.jp || pair.cn || '') : String(pair.cn || pair.jp || '');
};

/* ---------- 牌阵 ---------- */
const SPREAD_FALLBACK: Record<string, { pos: Pos[]; pick: number }> = {
  pentagram: { pos: [{jp:'過去',cn:'过去'},{jp:'現在',cn:'现在'},{jp:'隠れた動機',cn:'隐藏动机'},{jp:'障害',cn:'障碍'},{jp:'結論',cn:'结论'}], pick: 5 },
  timeLine:  { pos: [{jp:'過去',cn:'过去'},{jp:'現在',cn:'现在'},{jp:'未来',cn:'未来'}], pick: 3 },
  dailyCard: { pos: [{jp:'今日の一枚',cn:'今日一牌'}], pick: 1 }
};
const SPREAD_LIST = [
  { k: 'dailyCard', key: 'dailyCard' },
  { k: 'timeLine',  key: 'timeLine' },
  { k: 'pentagram', key: 'pentagram' }
];
const HINT_KEY: Record<string, string> = {
  pentagram: 'spreadHintPentagram',
  timeLine: 'spreadHintTimeline',
  dailyCard: 'spreadHintDaily'
};

const spreadKey = ref('pentagram');
const currentSpread = computed(() => {
  const fromData = T.spreads && T.spreads[spreadKey.value];
  return fromData || SPREAD_FALLBACK[spreadKey.value] || SPREAD_FALLBACK.pentagram;
});
const POS = computed<Pos[]>(() => currentSpread.value.pos);
const spreadHint = computed(() => t(HINT_KEY[spreadKey.value] || 'spreadHintPentagram'));
const dealLabel = computed(() =>
  spreadKey.value === 'dailyCard' ? t('dealDaily')
  : spreadKey.value === 'timeLine' ? t('dealTimeline')
  : t('deal'));

/* 位置口吻：{lead, ask} —— 同一张牌落在不同位置，说的不是同一句话 */
function posVoice(index: number): { lead: Pos; ask: Pos } | null {
  const arr = ((RAW as any).posVoice || {})[spreadKey.value] || [];
  return arr[index] || null;
}

/* ---------- 咨询问题 ---------- */
const DOMAINS = (T.DOMAINS || []) as { k: string; cn: string; jp: string }[];
const curQ = ref<string | null>(null);
const consultHint = ref('');
const consultHintError = ref(false);

function pickDomain(d: { k: string; cn: string; jp: string }) {
  curQ.value = d.k;
  consultHintError.value = false;
  consultHint.value = of({ cn: '就「' + d.cn + '」这件事问牌。', jp: '「' + d.jp + '」についてカードに問う。' });
  saveDraft();
  if (results.value.length && flippedIdx.value.length === results.value.length) finish(false);
}

/* ---------- 牌面 ---------- */
const results = ref<Drawn[]>([]);
const flippedIdx = ref<number[]>([]);
const dealHint = ref(t('dealHint'));
const readVisible = ref(false);
const shareMsg = ref('');
let pendingLog = false;

const introMount = ref<HTMLElement | null>(null);
const synthMount = ref<HTMLElement | null>(null);

const card = (id: number) => T.byId(id) || { cn: '', jp: '', r: '', g: '', seal: '', up: '', rv: '', shortCn: '', shortJp: '', element: '' };
const sealOf = (id: number) => card(id).seal || T.sealOf(id);
const posAt = (i: number): Pos => POS.value[i] || { cn: '', jp: '' };
const isFlipped = (p: number) => flippedIdx.value.includes(p);

/* ---------- 抽牌 / 翻牌 ---------- */
function bumpStat() {
  /* 原先由 stamps.js 绑 #btnDeal 计数；塔罗页改由组件自己负责 */
  rc.store.set('stat_tarot', (rc.store.get('stat_tarot', 0) || 0) + 1);
}

function deal() {
  bumpStat();
  if (!curQ.value) {
    consultHintError.value = true;
    consultHint.value = '先选一个咨询问题，再洗牌。';
    return;
  }
  if (!C.save({ tarot: [], tarotSpread: spreadKey.value, tarotQuestion: curQ.value })) return;
  if (T.drawFor) results.value = T.drawFor(spreadKey.value);
  else if (T.draw) results.value = T.draw().slice(0, currentSpread.value.pick);
  else results.value = [];
  flippedIdx.value = [];
  readVisible.value = false;
  shareMsg.value = '';
  dealHint.value = t('dealHintAfter');
  pendingLog = true;
  if (synthMount.value) synthMount.value.innerHTML = '';
  saveDraft();
}

function flipCard(p: number) {
  if (isFlipped(p)) return;
  flippedIdx.value = [...flippedIdx.value, p];
  saveDraft();
  if (flippedIdx.value.length === results.value.length) finish(true);
}

function flipAll() {
  if (!results.value.length) return;
  flippedIdx.value = results.value.map((d) => d.pos);
  saveDraft();
  finish(true);
}

function pickSpread(k: string) {
  if (spreadKey.value === k && results.value.length) return;
  if (!C.save({ tarot: [], tarotSpread: k })) return;
  spreadKey.value = k;
  results.value = [];
  flippedIdx.value = [];
  readVisible.value = false;
  shareMsg.value = '';
  dealHint.value = t('dealHint');
  if (synthMount.value) synthMount.value.innerHTML = '';
  saveDraft();
}

/* ---------- 读牌表 ---------- */
const readRows = computed(() => {
  void lang.value;
  return results.value.map((d) => {
    const c = card(d.id);
    const pos = posAt(d.pos);
    const orient = t(d.upright ? 'upright' : 'reversed');
    const shortTxt = bi(c.shortCn || '', c.shortJp || '');
    const elementTxt = c.element ? ' ／ <span class="dim">' + esc(c.element) + '</span>' : '';
    const dm = (T.dimOf && curQ.value) ? T.dimOf(d.id, curQ.value) : null;
    const er = T.dimOf ? T.dimOf(d.id, 'era') : null;
    const v = posVoice(d.pos);
    const leadTxt = v ? rawBi(v.lead) : '';
    const askTxt = v ? rawBi(v.ask) : '';
    return '<tr>' +
      '<th>' + bi(pos.cn, pos.jp) + '</th>' +
      '<td>' +
        (leadTxt ? '<span style="opacity:.6;font-size:12px">' + esc(leadTxt) + '</span><br>' : '') +
        '<b>' + bi(c.cn, c.jp) + '</b>（' + esc(orient) + '）' + elementTxt +
        '<br><span class="quote small">' + shortTxt + '</span>' +
        '<br><span class="dim">' + esc(d.upright ? c.up : c.rv) + '</span>' +
        (dm ? '<br><span class="quote small amber">' + bi(dm.cn, dm.jp) + '</span>' : '') +
        (er ? '<br><span class="dim small">〔2006〕' + bi(er.cn, er.jp) + '</span>' : '') +
        (askTxt ? '<br><span style="opacity:.72;font-size:12.5px">↳ ' + esc(askTxt) + '</span>' : '') +
      '</td>' +
    '</tr>';
  }).join('');
});

const elementBar = computed(() => {
  void lang.value;
  if (results.value.length < 2) return '';
  const counts: Record<string, number> = {};
  results.value.forEach((d) => {
    const el = card(d.id).element;
    if (el) counts[el] = (counts[el] || 0) + 1;
  });
  const cells = Object.keys(counts)
    .map((k) => '<span class="el-chip">' + esc(k) + ' <b>' + counts[k] + '</b></span>')
    .join(' ');
  return '<div class="dim small" style="margin-bottom:4px">' + esc(t('elementHint')) + '</div><div>' + cells + '</div>';
});

function finish(save = true) {
  if (save !== false && !C.save({ tarot: results.value, tarotSpread: spreadKey.value, tarotQuestion: curQ.value })) return;
  if (pendingLog) {
    pendingLog = false;
    /* 只在真正「洗牌之后」记一次，切语言 / 恢复草稿都不会重复写档案 */
    profile.addDraw({
      spread: spreadKey.value,
      domain: curQ.value || '',
      question: '',
      cards: results.value.map((d) => ({ id: d.id, upright: d.upright, pos: d.pos }))
    });
  }
  readVisible.value = true;
  nextTick(renderSynth);
}

/* 综合解读：萨弗兰的结语（挂载点由 rc.ui.dialog 自行填充，Vue 不接管） */
function renderSynth() {
  const mount = synthMount.value;
  if (!mount) return;
  mount.innerHTML = '';
  const idx = spreadKey.value === 'dailyCard' ? 0 : results.value.length - 1;
  const concl = results.value[idx];
  if (!concl) return;
  const cc = card(concl.id);
  const sPos = posAt(idx);
  const domObj = DOMAINS.filter((x) => x.k === curQ.value)[0] || null;
  const qPrefix = domObj ? of({ cn: '关于「' + domObj.cn + '」：', jp: '「' + domObj.jp + '」について：' }) : '';
  const conclDim = (T.dimOf && curQ.value) ? T.dimOf(concl.id, curQ.value) : null;
  const conclDimTxt = conclDim ? of(conclDim) : '';
  rc.ui.dialog({
    who: { cn: '萨弗兰', jp: 'サフラン' },
    jp: { cn: '梦侦探', jp: '夢探偵' },
    mount,
    text: qPrefix + rawBi(sPos) + '位落在「' + (lang.value === 'jp' ? cc.jp : cc.cn) + '」' + t(concl.upright ? 'upright' : 'reversed') +
      '——' + (concl.upright ? cc.up : cc.rv) +
      (conclDimTxt ? ' 就这件事而言：' + conclDimTxt : '') +
      ' ……先别下结论，等会诊和联想做完，我再把三样东西拼起来给你看。',
    speed: 26
  });
}

watch(lang, () => {
  if (results.value.length && flippedIdx.value.length === results.value.length) finish(false);
});

/* ---------- 分享 ---------- */
function summaryText(): string {
  const head = (lang.value === 'jp' ? '塔罗展開 · ' : '塔罗展开 · ') + t(spreadKey.value);
  const lines = results.value.map((d) => {
    const c = card(d.id);
    const pos = posAt(d.pos);
    return rawBi(pos) + '　' + (lang.value === 'jp' ? c.jp : c.cn) + '（' + t(d.upright ? 'upright' : 'reversed') + '）' +
      (c.shortCn ? '　' + (lang.value === 'jp' ? c.shortJp : c.shortCn) : '');
  });
  return head + '\n' + lines.join('\n') + '\n— RADIO CLUB · MODEL RC-2006';
}

async function copySummary(): Promise<void> {
  const txt = summaryText();
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(txt);
      shareMsg.value = t('tarotCopied');
      return;
    }
    throw new Error('no clipboard');
  } catch (e) {
    /* 剪贴板不可用时的兜底：选中一个临时 textarea */
    try {
      const ta = document.createElement('textarea');
      ta.value = txt;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand && document.execCommand('copy');
      document.body.removeChild(ta);
      shareMsg.value = ok ? t('tarotCopied') : t('tarotCopyFail');
    } catch (e2) {
      shareMsg.value = t('tarotCopyFail');
    }
  }
}

function stampStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
}

function saveImage(): void {
  const rows = results.value;
  if (!rows.length) return;
  const W = 720, PAD = 44, ROW = 112, HEAD = 176, FOOT = 108;
  const H = HEAD + rows.length * ROW + FOOT;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cv = document.createElement('canvas');
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  const g = cv.getContext('2d');
  if (!g) return;
  g.scale(dpr, dpr);

  g.fillStyle = '#0b0b0d';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(214,178,94,.45)';
  g.lineWidth = 1;
  g.strokeRect(PAD / 2, PAD / 2, W - PAD, H - PAD);

  g.fillStyle = '#d6b25e';
  g.font = '500 12px system-ui, -apple-system, "Noto Sans CJK SC", sans-serif';
  g.fillText('RADIO CLUB · MODEL RC-2006', PAD, 70);
  g.fillStyle = '#f2ede4';
  g.font = '500 26px system-ui, -apple-system, "Noto Sans CJK SC", sans-serif';
  g.fillText((lang.value === 'jp' ? 'タロット展開 · ' : '塔罗展开 · ') + t(spreadKey.value), PAD, 108);
  g.fillStyle = 'rgba(242,237,228,.5)';
  g.font = '400 12px system-ui, -apple-system, "Noto Sans CJK SC", sans-serif';
  const q = DOMAINS.filter((x) => x.k === curQ.value)[0];
  g.fillText(new Date().toLocaleString('zh-CN') + (q ? '　／　' + rawBi(q) : ''), PAD, 134);

  let y = HEAD;
  rows.forEach((d) => {
    const c = card(d.id);
    const pos = posAt(d.pos);
    const v = posVoice(d.pos);
    g.fillStyle = 'rgba(214,178,94,.85)';
    g.font = '400 12px system-ui, -apple-system, "Noto Sans CJK SC", sans-serif';
    g.fillText(rawBi(pos) + '　' + t(d.upright ? 'upright' : 'reversed'), PAD, y);
    g.fillStyle = '#f2ede4';
    g.font = '500 20px system-ui, -apple-system, "Noto Sans CJK SC", sans-serif';
    g.fillText(lang.value === 'jp' ? c.jp : c.cn, PAD, y + 28);
    g.fillStyle = 'rgba(242,237,228,.6)';
    g.font = '400 12.5px system-ui, -apple-system, "Noto Sans CJK SC", sans-serif';
    g.fillText(lang.value === 'jp' ? (c.shortJp || '') : (c.shortCn || ''), PAD + 4, y + 52);
    g.fillStyle = 'rgba(242,237,228,.4)';
    g.font = '400 11.5px system-ui, -apple-system, "Noto Sans CJK SC", sans-serif';
    if (v) g.fillText('↳ ' + rawBi(v.ask), PAD + 4, y + 74);
    g.strokeStyle = 'rgba(242,237,228,.12)';
    g.beginPath();
    g.moveTo(PAD, y + 92);
    g.lineTo(W - PAD, y + 92);
    g.stroke();
    y += ROW;
  });

  g.fillStyle = 'rgba(242,237,228,.4)';
  g.font = '400 11.5px system-ui, -apple-system, "Noto Sans CJK SC", sans-serif';
  g.fillText('牌不预言未来。它只是一面便宜的镜子。', PAD, H - 58);
  g.fillStyle = '#d6b25e';
  g.font = '400 11.5px system-ui, -apple-system, "Noto Sans CJK SC", sans-serif';
  g.fillText(location.host + '/tarot.html', PAD, H - 36);

  cv.toBlob((blob) => {
    if (!blob) { shareMsg.value = t('tarotSaveFail'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'radio-club-tarot-' + stampStr() + '.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    shareMsg.value = t('tarotSaved');
  }, 'image/png');
}

/* ---------- 草稿 ---------- */
function saveDraft() {
  return rc.store.set('tarotDraft', {
    caseId: (C.get() as any).caseId,
    spread: spreadKey.value,
    question: curQ.value,
    cards: results.value,
    flipped: [...flippedIdx.value]
  });
}

function restoreDraft() {
  const draft = rc.store.get<any>('tarotDraft', null);
  const savedCase = C.get() as any;
  if (!draft || draft.caseId !== savedCase.caseId || !T.spreads[draft.spread]) return;
  spreadKey.value = draft.spread;
  curQ.value = draft.question || null;
  results.value = rc.model.normalize({ tarotSpread: draft.spread, tarot: draft.cards }).tarot as any;
  dealHint.value = results.value.length ? t('dealHintAfter') : t('dealHint');
  flippedIdx.value = results.value
    .map((d) => d.pos)
    .filter((p) => Array.isArray(draft.flipped) && draft.flipped.indexOf(Number(p)) >= 0);
  if (results.value.length && flippedIdx.value.length === results.value.length) finish(false);
}

/* ---------- 今日一牌（独立快速入口） ---------- */
const dailyCard = ref<{id: number; upright: boolean}|null>(null);
function todayStr() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
function hash(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}
function drawDaily() {
  const arc = (T.arcana || []) as any[];
  if (!arc.length) return;
  const c = arc[hash(todayStr()) % arc.length];
  dailyCard.value = {id: c.n, upright: hash(todayStr() + 'up') % 2 === 0};
}

/* ---------- 挂载 ---------- */
onMounted(() => {
  rc.ui.dialog({
    who: { cn: '萨弗兰', jp: 'サフラン' },
    jp: { cn: '梦侦探', jp: '夢探偵' },
    mount: introMount.value,
    text: '牌不预言未来。它只是一面便宜的镜子，让你把心里已经有的答案，借着一张画说出来。所以——别挑，随手翻。',
    speed: 26
  });
  restoreDraft();
});
</script>

<template>
  <div ref="introMount" id="introMount"></div>

  <div class="panel">
    <div class="p-head">
      <h2><span class="i18n-cn">今日一牌</span><span class="i18n-jp">今日の一枚</span></h2>
      <span class="p-en">TODAY'S CARD</span>
      <span class="p-note"><span class="i18n-cn">同一天只会出现这一张</span><span class="i18n-jp">同じ日はこの一枚だけ</span></span>
    </div>
    <div class="p-body">
      <div v-if="!dailyCard" class="center">
        <button type="button" class="btn ghost" @click="drawDaily"><span class="i18n-cn">翻开今日之牌 →</span><span class="i18n-jp">今日の札を開く →</span></button>
      </div>
      <div v-else class="daily-card">
        <div class="daily-glyph">{{ card(dailyCard.id).g }}</div>
        <div class="daily-name">{{ bi(card(dailyCard.id).cn, card(dailyCard.id).jp) }} · {{ t(dailyCard.upright ? 'upright' : 'reversed') }}</div>
        <p class="daily-text">{{ dailyCard.upright ? card(dailyCard.id).up : card(dailyCard.id).rv }}</p>
        <a class="daily-link" :href="'cards.html#card-' + dailyCard.id"><span class="i18n-cn">看完整牌义 →</span><span class="i18n-jp">詳細を見る →</span></a>
      </div>
    </div>
  </div>

  <div class="panel">
    <div class="p-head">
      <h2><span class="i18n-cn">塔罗展开</span><span class="i18n-jp">タロット展開</span></h2>
      <span class="p-en">TAROT</span>
      <a class="p-note" href="cards.html"><span class="i18n-cn">牌库 →</span><span class="i18n-jp">カード一覧 →</span></a>
    </div>
    <div class="p-body">
      <!-- D1 · 咨询问题（先选问题，再抽牌） -->
      <div class="spread-bar consult-bar">
        <span class="sb-label"><span class="i18n-cn">咨询问题</span><span class="i18n-jp">相談ごと</span>：</span>
        <span id="domainBtns">
          <button
            v-for="d in DOMAINS" :key="d.k" type="button" class="sb-btn"
            :class="{on: curQ === d.k}" :data-domain="d.k"
            v-html="bi(d.cn, d.jp)" @click="pickDomain(d)"></button>
        </span>
      </div>
      <div class="spread-hint center" id="consultHint">
        <span v-if="consultHintError" class="red">※ {{ consultHint }}</span>
        <template v-else>{{ consultHint }}</template>
      </div>

      <!-- D2 · 三种牌阵选择器 -->
      <div class="spread-bar">
        <span class="sb-label"><span class="i18n-cn">选阵型</span><span class="i18n-jp">展開を選ぶ</span>：</span>
        <button
          v-for="s in SPREAD_LIST" :key="s.k" type="button" class="sb-btn"
          :class="{on: spreadKey === s.k}" :data-spread="s.k"
          @click="pickSpread(s.k)">{{ t(s.key) }}</button>
      </div>
      <div class="spread-hint center" id="spreadHint">{{ spreadHint }}</div>

      <div class="center mb">
        <button type="button" class="btn" id="btnDeal" @click="deal">{{ dealLabel }}</button>
        <button type="button" class="btn ghost" id="btnFlipAll" @click="flipAll">{{ t('flipAll') }}</button>
      </div>

      <div class="spread" id="spread">
        <button
          v-for="(d, i) in results" :key="i" type="button"
          class="tcard" :class="{rev: !d.upright, flip: isFlipped(d.pos)}"
          :data-i="d.pos" aria-label="翻开塔罗牌 / カードを開く"
          @click="flipCard(d.pos)">
          <div class="inner">
            <div class="face back"><div class="seal" v-html="sealOf(d.id)"></div></div>
            <div class="face front">
              <div class="num">{{ card(d.id).r }}</div>
              <div class="glyph">{{ card(d.id).g }}</div>
              <div class="nm" v-html="bi(card(d.id).cn, card(d.id).jp)"></div>
            </div>
          </div>
          <div class="pos" v-html="bi(posAt(d.pos).cn, posAt(d.pos).jp) + '・' + bi(d.upright ? '正位' : '逆位', d.upright ? '正位置' : '逆位置')"></div>
        </button>
      </div>
      <div class="hint center" id="dealHint">{{ dealHint }}</div>
    </div>
  </div>

  <div class="panel" :class="{hidden: !readVisible}" id="readPanel">
    <div class="p-head">
      <h2><span class="i18n-cn">读牌</span><span class="i18n-jp">読牌</span></h2>
      <span class="p-en">READING</span>
    </div>
    <div class="p-body">
      <table class="grid" id="readTable" v-html="readRows"></table>
      <div ref="synthMount" id="synthMount"></div>
      <div class="center mt" id="elementBarMount" v-html="elementBar"></div>
      <div class="center mt" id="tarotShare">
        <button type="button" class="btn ghost" id="btnTarotCopy" @click="copySummary">{{ t('tarotCopy') }}</button>
        <button type="button" class="btn ghost" id="btnTarotImage" @click="saveImage">{{ t('tarotImage') }}</button>
        <a class="btn ghost" href="profile.html">{{ t('mirrorTitle') }} →</a>
      </div>
      <p class="hint center" id="tarotShareMsg" role="status" aria-live="polite">{{ shareMsg }}</p>
      <div class="center mt">
        <a class="btn" href="psyche.html">{{ t('toPsyche') }}</a>
        <a class="btn ghost" href="verdict.html">{{ t('toVerdict') }}</a>
      </div>
    </div>
  </div>
</template>
