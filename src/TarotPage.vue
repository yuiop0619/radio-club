<script setup lang="ts">
/* ============================================================
   TarotPage.vue — 塔罗展开（Phase 2：由 tarot-page.js 迁移而来）

   与原实现保持的三条契约（browser.cjs 依赖）：
     1. [data-domain] 选咨询问题 → #btnDeal 洗牌 → .tcard 逐张翻开
     2. 切换语言后 .tcard 数量与 .flip 状态都不变
     3. 刷新页面从 tarotDraft 恢复牌阵与已翻开的牌

   顺带修掉两处原实现的键名笔误：牌阵提示取的是 spreadHintTimeLine /
   spreadHintDailyCard，而词条表里叫 spreadHintTimeline / spreadHintDaily，
   于是「时间线」「每日一牌」的提示一直是空白。
   ============================================================ */
import {ref, computed, watch, onMounted, nextTick} from 'vue';
import {rc} from './legacy';

/* legacy 逻辑仍复用，逐处 cast 到 any，避免类型桥越铺越厚 */
const T = rc.tarot as any;
const C = rc.case as any;
const esc = (value: unknown) => rc.util.esc(value);

interface Pos { cn: string; jp: string }
interface Drawn { id: number; upright: boolean; pos: number }

/* ---------- i18n ---------- */
const lang = ref(rc.i18n.lang());
rc.i18n.onChange(() => { lang.value = rc.i18n.lang(); });
const t = (key: string) => { void lang.value; return rc.i18n.t(key); };
const of = (pair: { cn: string; jp: string }) => { void lang.value; return rc.i18n.of!(pair); };
const bi = (cn: string, jp: string) => rc.ui.bi(cn, jp);

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
/* 词条表的真实键名（见 content/i18n.json） */
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
  dealHint.value = t('dealHintAfter');
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
  dealHint.value = t('dealHint');
  if (synthMount.value) synthMount.value.innerHTML = '';
  saveDraft();
}

/* ---------- 读牌表（原实现逐字保持） ---------- */
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
    return '<tr>' +
      '<th>' + esc(pos.cn) + '</th>' +
      '<td>' +
        '<b>' + bi(c.cn, c.jp) + '</b>（' + esc(orient) + '）' + elementTxt +
        '<br><span class="quote small">' + shortTxt + '</span>' +
        '<br><span class="dim">' + esc(d.upright ? c.up : c.rv) + '</span>' +
        (dm ? '<br><span class="quote small amber">' + bi(dm.cn, dm.jp) + '</span>' : '') +
        (er ? '<br><span class="dim small">〔2006〕' + bi(er.cn, er.jp) + '</span>' : '') +
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
    text: qPrefix + sPos.cn + '位落在「' + cc.cn + '」' + t(concl.upright ? 'upright' : 'reversed') +
      '——' + (concl.upright ? cc.up : cc.rv) +
      (conclDimTxt ? ' 就这件事而言：' + conclDimTxt : '') +
      ' ……先别下结论，等会诊和联想做完，我再把三样东西拼起来给你看。',
    speed: 26
  });
}

watch(lang, () => {
  if (results.value.length && flippedIdx.value.length === results.value.length) finish(false);
});

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
      <h2><span class="i18n-cn">塔罗展开</span><span class="i18n-jp">タロット展開</span></h2>
      <span class="p-en">TAROT</span>
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
      <div class="center mt">
        <a class="btn" href="psyche.html">{{ t('toPsyche') }}</a>
        <a class="btn ghost" href="verdict.html">{{ t('toVerdict') }}</a>
      </div>
    </div>
  </div>
</template>
