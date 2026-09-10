<script setup lang="ts">
/* ============================================================
   ProfilePage.vue — 我的档案（批次 1 · 档案地基）
   ------------------------------------------------------------
   把散落在各存储键里的痕迹聚成一份可看、可导出的卷宗。
   本页只读旧键，不写入（新数据由 profile.ts 管在 rc_profile 下），
   导出完全在浏览器内生成文件，不经过服务器。
   ============================================================ */
import {ref, computed, onMounted} from 'vue';
import {rc} from './legacy';
import profile, {type Event as RcEvent} from './profile';

const lang = ref(rc.i18n.lang());
rc.i18n.onChange(() => { lang.value = rc.i18n.lang(); });
const t = (k: string) => { void lang.value; return rc.i18n.t(k); };
const bi = (cn: string, jp: string) => (lang.value === 'jp' ? jp : cn);

const snap = ref(profile.snapshot());
const events = ref<RcEvent[]>(profile.timeline());
const mirror = ref(profile.mirror());
const msg = ref('');

function refresh(): void {
  snap.value = profile.snapshot();
  events.value = profile.timeline();
  mirror.value = profile.mirror();
}
refresh();
onMounted(() => { try { (rc.i18n as any).apply?.(); } catch (e) { /* 忽略 */ } });

/* ---------------- 章 1 · 概览 ---------------- */
const overview = computed(() => {
  const s = snap.value;
  return [
    {k: 'visits', n: s.visits.total, cn: '到店', jp: '来店'},
    {k: 'tarot', n: s.counts.tarot, cn: '抽牌', jp: 'タロット'},
    {k: 'dream', n: s.counts.dreams, cn: '梦境', jp: '夢'},
    {k: 'mood', n: s.counts.mood, cn: '情绪', jp: '気分'},
    {k: 'thought', n: s.thoughts.length, cn: '念头', jp: '念い'},
    {k: 'stamp', n: s.counts.stamps, cn: '印章', jp: '印'}
  ];
});

/* ---------------- 章 2 · 性格层析 ---------------- */
const AXES = [
  {k: 'EI', l: 'E', r: 'I', lcn: '外向', rcn: '内向', ljp: '外向', rjp: '内向'},
  {k: 'SN', l: 'S', r: 'N', lcn: '实感', rcn: '直觉', ljp: '感覚', rjp: '直観'},
  {k: 'TF', l: 'T', r: 'F', lcn: '思考', rcn: '情感', ljp: '思考', rjp: '感情'},
  {k: 'JP', l: 'J', r: 'P', lcn: '判断', rcn: '感知', ljp: '判断', rjp: '知覚'}
];
const TYPE_NAME: Record<string, {cn: string; jp: string}> = {
  INTJ: {cn: '建筑师', jp: '建築家'}, INTP: {cn: '逻辑学家', jp: '論理学者'},
  ENTJ: {cn: '指挥官', jp: '指揮官'}, ENTP: {cn: '辩论家', jp: '討論者'},
  INFJ: {cn: '提倡者', jp: '提唱者'}, INFP: {cn: '调停者', jp: '仲介者'},
  ENFJ: {cn: '主人公', jp: '主人公'}, ENFP: {cn: '竞选者', jp: '運動家'},
  ISTJ: {cn: '物流师', jp: '物流担当'}, ISFJ: {cn: '守卫者', jp: '擁護者'},
  ESTJ: {cn: '总经理', jp: '幹部'}, ESFJ: {cn: '执政官', jp: '領事'},
  ISTP: {cn: '鉴赏家', jp: '巨匠'}, ISFP: {cn: '探险家', jp: '冒険家'},
  ESTP: {cn: '企业家', jp: '起業家'}, ESFP: {cn: '表演者', jp: 'エンターテイナー'}
};
function typeName(code: string): {cn: string; jp: string} {
  return TYPE_NAME[code] || {cn: code, jp: code};
}
/** 条形从中线向偏向端延伸的长度（占容器百分比）：偏向越明显越长，两端都不溢出 */
function axisPct(v: number): number {
  const n = Number(v);
  return Math.round(Math.max(n, 1 - n) * 50);
}
function axisSide(k: string, v: number): string {
  const a = AXES.find(x => x.k === k)!;
  return Number(v) >= 0.5 ? a.l : a.r;
}
function axisWord(k: string, v: number): string {
  const a = AXES.find(x => x.k === k)!;
  return Number(v) >= 0.5 ? bi(a.lcn, a.ljp) : bi(a.rcn, a.rjp);
}

/* ---------------- 章 3 · 你的镜子 ---------------- */
const ELEMS = [
  {k: '火', cn: '火 · 行动', jp: '火・行動'},
  {k: '水', cn: '水 · 情感', jp: '水・感情'},
  {k: '风', cn: '风 · 思想', jp: '風・思考'},
  {k: '土', cn: '土 · 物质', jp: '土・物質'}
];
const elemTotal = computed(() => {
  const e = mirror.value.elements || {};
  return Object.keys(e).reduce((a, k) => a + (e[k] || 0), 0);
});
function elemPct(k: string): number {
  const total = elemTotal.value;
  if (!total) return 0;
  return Math.round(((mirror.value.elements[k] || 0) / total) * 100);
}
function cardName(id: number): string {
  const card = (rc.tarot as any).byId ? (rc.tarot as any).byId(id) : null;
  if (!card) return '#' + id;
  return lang.value === 'jp' ? String(card.jp || card.cn || id) : String(card.cn || card.jp || id);
}

/* ---------------- 章 4 · 情绪记录 ---------------- */
const moodBars = computed(() =>
  snap.value.mood.logs.slice(-30).map(l => ({
    date: l.date,
    score: l.score,
    h: Math.max(6, Math.round((Number(l.score) / 5) * 100)),
    tags: (l.tags || []).join(' · ')
  }))
);

/* ---------------- 章 5 · 时间线 ---------------- */
const KIND: Record<string, {mark: string; cn: string; jp: string}> = {
  order: {mark: '託', cn: '委托', jp: '依頼'},
  verdict: {mark: '鑑', cn: '鉴定', jp: '鑑定'},
  tarot: {mark: '牌', cn: '塔罗', jp: 'タロット'},
  personality: {mark: '格', cn: '性格', jp: '性格'},
  mood: {mark: '情', cn: '情绪', jp: '気分'},
  dream: {mark: '夢', cn: '梦境', jp: '夢'},
  note: {mark: '穴', cn: '树洞', jp: '木の穴'},
  stamp: {mark: '印', cn: '印章', jp: '印'},
  thought: {mark: '念', cn: '念头', jp: '念い'}
};
function kindMark(k: string): string { return (KIND[k] || {mark: '·'}).mark; }
function fmtAt(ts: number): string {
  if (!ts) return '—';
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}
const shownEvents = computed(() => events.value.slice(0, 40));

/* ---------------- 章 6 · 导出 ---------------- */
function stampStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
}
function download(filename: string, content: string, mime: string): void {
  try {
    const blob = new Blob([content], {type: mime});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    msg.value = t('expDone');
  } catch (e) {
    msg.value = t('expFail');
  }
}
function exportMd(): void {
  download('radio-club-archive-' + stampStr() + '.md', profile.toMarkdown(), 'text/markdown;charset=utf-8');
}
function exportJson(): void {
  download('radio-club-archive-' + stampStr() + '.json', profile.toJSON(), 'application/json;charset=utf-8');
}
</script>

<template>
  <!-- 章 1 · 概览 -->
  <div class="panel">
    <div class="p-head">
      <h2>{{ t('profileT') }}</h2>
      <span class="p-en">DETECTIVE FILE</span>
      <span class="p-note">{{ bi('本机记录 · 未上传', '端末内のみ · 送信なし') }}</span>
    </div>
    <div class="p-body">
      <p class="dim">{{ bi(
        '你在这家店留下的全部痕迹，汇成一份卷宗。全程只存在这台设备上，导出也在浏览器里完成。',
        'この店に残したすべての痕跡を一冊に。すべて端末内、書き出しもブラウザ内で完結する。'
      ) }}</p>
      <hr class="rule">
      <div class="pf-ov">
        <div v-for="c in overview" :key="c.k" class="ov-cell">
          <div class="ov-n">{{ c.n }}</div>
          <div class="ov-l">{{ bi(c.cn, c.jp) }}</div>
        </div>
      </div>
      <p v-if="!snap.visits.total" class="hint center mt">{{ t('tlEmpty') }}</p>
    </div>
  </div>

  <!-- 章 2 · 性格层析 -->
  <div class="panel">
    <div class="p-head">
      <h2>{{ t('pfmTitle') }}</h2>
      <span class="p-en">TYPE</span>
      <span v-if="snap.personality" class="p-note">{{ fmtAt(snap.personality.at) }}</span>
    </div>
    <div class="p-body">
      <template v-if="snap.personality">
        <div class="pf-type">
          <span class="pf-code">{{ snap.personality.type }}</span>
          <span class="pf-name">{{ bi(typeName(snap.personality.type).cn, typeName(snap.personality.type).jp) }}</span>
        </div>
        <ul class="pf-axes">
          <li v-for="a in AXES" :key="a.k" class="ax">
            <span class="ax-side" :class="{on: axisSide(a.k, snap.personality.dims[a.k]) === a.l}">{{ bi(a.lcn, a.ljp) }}</span>
            <span class="ax-bar" :class="{bal: snap.personality.balanced && snap.personality.balanced[a.k]}">
              <span class="ax-fill" :style="{
                width: axisPct(snap.personality.dims[a.k]) + '%',
                left: Number(snap.personality.dims[a.k]) >= 0.5 ? 'auto' : '50%',
                right: Number(snap.personality.dims[a.k]) >= 0.5 ? '50%' : 'auto'
              }"></span>
            </span>
            <span class="ax-side" :class="{on: axisSide(a.k, snap.personality.dims[a.k]) === a.r}">{{ bi(a.rcn, a.rjp) }}</span>
          </li>
        </ul>
        <p class="dim small">{{ bi(
          '条形长度表示该维度的偏向强度。接近中线即「基本持平」——这台机器不会硬给你贴一个标签。',
          'バーの長さは偏向の強さ。中央線に近ければ「ほぼ拮抗」——この機械は無理に分類しない。'
        ) }}</p>
        <p v-for="a in AXES" :key="'b' + a.k">
          <span v-if="snap.personality.balanced && snap.personality.balanced[a.k]" class="hint">
            {{ a.k }} · {{ t('pfmBalanced') }}
          </span>
        </p>
      </template>
      <template v-else>
        <p class="dim center">{{ t('pfmEmpty') }}</p>
        <div class="center mt">
          <a class="btn ghost" href="personality.html">{{ t('pfmGo') }} →</a>
        </div>
      </template>
    </div>
  </div>

  <!-- 章 3 · 你的镜子 -->
  <div class="panel" v-if="mirror.draws">
    <div class="p-head">
      <h2>{{ t('mirrorTitle') }}</h2>
      <span class="p-en">YOUR MIRROR</span>
      <span class="p-note">{{ mirror.draws }} × {{ mirror.total }}</span>
    </div>
    <div class="p-body">
      <div class="mir-elems">
        <div v-for="e in ELEMS" :key="e.k" class="me-row">
          <span class="me-l">{{ bi(e.cn, e.jp) }}</span>
          <span class="me-bar"><span class="me-fill" :style="{width: elemPct(e.k) + '%'}"></span></span>
          <span class="me-n">{{ mirror.elements[e.k] || 0 }}</span>
        </div>
      </div>
      <p class="dim small">
        {{ t('mirrorUpright') }}　{{ Math.round(mirror.uprightRatio * 100) }}%
      </p>
      <template v-if="mirror.top.length">
        <hr class="rule">
        <p class="dim small">{{ t('mirrorTop') }}</p>
        <div class="mir-top">
          <span v-for="c in mirror.top" :key="c.id" class="mt-chip">{{ cardName(c.id) }} ×{{ c.n }}</span>
        </div>
      </template>
      <div class="center mt">
        <a class="btn ghost" href="tarot.html">{{ bi('再去抽一次','もう一度引く') }} →</a>
      </div>
    </div>
  </div>

  <!-- 章 4 · 情绪记录 -->
  <div class="panel" v-if="moodBars.length">
    <div class="p-head">
      <h2>{{ t('moodTitle') }}</h2>
      <span class="p-en">MOOD</span>
      <span class="p-note">{{ t('moodStreak') }} {{ snap.mood.streak }} {{ t('moodDays') }}</span>
    </div>
    <div class="p-body">
      <div class="mood-chart">
        <div v-for="m in moodBars" :key="m.date" class="mc-col" :title="m.date + '　' + m.score + '/5' + (m.tags ? '　' + m.tags : '')">
          <span class="mc-bar" :style="{height: m.h + '%'}"></span>
        </div>
      </div>
      <p class="dim small">
        {{ bi('最近 30 天。柱子的高低就是你当天给自己打的分。', '直近30日。バーの高さがその日の自己採点。') }}
      </p>
      <div class="center mt">
        <a class="btn ghost" href="toolbox.html">{{ bi('去打卡','記録する') }} →</a>
      </div>
    </div>
  </div>

  <!-- 章 5 · 时间线 -->
  <div class="panel">
    <div class="p-head">
      <h2>{{ t('tlTitle') }}</h2>
      <span class="p-en">TIMELINE</span>
      <span class="p-note">{{ events.length }}</span>
    </div>
    <div class="p-body">
      <p v-if="!shownEvents.length" class="dim center">{{ t('tlEmpty') }}</p>
      <div v-else class="pf-tl">
        <div v-for="(e, i) in shownEvents" :key="i" class="pf-ev">
          <span class="ev-mark">{{ kindMark(e.kind) }}</span>
          <span class="ev-body">
            <span class="ev-title">{{ e.title }}</span>
            <span v-if="e.detail" class="ev-detail">{{ e.detail }}</span>
          </span>
          <span class="ev-at">{{ fmtAt(e.at) }}</span>
        </div>
      </div>
    </div>
  </div>

  <!-- 章 6 · 导出 -->
  <div class="panel">
    <div class="p-head">
      <h2>{{ t('expTitle') }}</h2>
      <span class="p-en">EXPORT</span>
    </div>
    <div class="p-body">
      <p class="dim">{{ bi(
        '把整份卷宗带走：Markdown 给自己留档或贴进笔记，JSON 用于备份与迁移。文件在你的浏览器里生成，不经过服务器。',
        '巻宗ごと持ち出す：Markdown は手元の記録やメモ用、JSON はバックアップと移行用。ファイルはブラウザ内で生成され、サーバーを通らない。'
      ) }}</p>
      <div class="center mt">
        <button type="button" class="btn" id="btnExportMd" @click="exportMd">{{ t('expMd') }}</button>
        <button type="button" class="btn ghost" id="btnExportJson" @click="exportJson">{{ t('expJson') }}</button>
      </div>
      <p class="hint center" id="exportMsg" role="status" aria-live="polite">{{ msg }}</p>
    </div>
  </div>
</template>

<style scoped>
.pf-ov { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; }
.ov-cell { border: 1px solid var(--line, #2a2a2a); border-radius: 8px; padding: 10px 4px; text-align: center; }
.ov-n { font-size: 22px; font-weight: 500; line-height: 1.2; }
.ov-l { font-size: 12px; opacity: .65; margin-top: 4px; }
.pf-type { display: flex; align-items: baseline; gap: 12px; margin: 4px 0 12px; }
.pf-code { font-size: 30px; font-weight: 500; letter-spacing: 2px; }
.pf-name { font-size: 14px; opacity: .7; }
.pf-axes { list-style: none; margin: 0; padding: 0; }
.ax { display: grid; grid-template-columns: 56px 1fr 56px; align-items: center; gap: 8px; margin: 8px 0; }
.ax-side { font-size: 12px; opacity: .45; text-align: center; }
.ax-side.on { opacity: 1; font-weight: 500; }
.ax-bar { position: relative; display: block; height: 6px; border-radius: 3px; background: rgba(128,128,128,.22); overflow: hidden; }
.ax-bar::after { content: ''; position: absolute; left: 50%; top: 0; bottom: 0; width: 1px; background: rgba(128,128,128,.5); }
.ax-fill { position: absolute; top: 0; bottom: 0; display: block; background: currentColor; opacity: .75; }
.ax-bar.bal .ax-fill { opacity: .35; }
.mir-elems { margin: 4px 0 10px; }
.me-row { display: grid; grid-template-columns: 76px 1fr 32px; align-items: center; gap: 8px; margin: 6px 0; }
.me-l { font-size: 12px; opacity: .75; }
.me-bar { display: block; height: 6px; border-radius: 3px; background: rgba(128,128,128,.22); overflow: hidden; }
.me-fill { display: block; height: 100%; background: currentColor; opacity: .7; }
.me-n { font-size: 12px; opacity: .6; text-align: right; }
.mir-top { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.mt-chip { border: 1px solid var(--line, #2a2a2a); border-radius: 999px; padding: 3px 10px; font-size: 12px; }
.mood-chart { display: flex; align-items: flex-end; gap: 3px; height: 84px; margin: 8px 0 6px; }
.mc-col { flex: 1; display: flex; align-items: flex-end; height: 100%; }
.mc-bar { display: block; width: 100%; border-radius: 2px 2px 0 0; background: currentColor; opacity: .55; }
.pf-tl { margin-top: 4px; }
.pf-ev { display: grid; grid-template-columns: 22px 1fr auto; gap: 10px; align-items: baseline; padding: 7px 0; border-bottom: 1px dashed rgba(128,128,128,.18); }
.ev-mark { font-size: 13px; opacity: .8; text-align: center; }
.ev-title { font-size: 13px; }
.ev-detail { font-size: 12px; opacity: .55; margin-left: 8px; }
.ev-at { font-size: 11px; opacity: .45; white-space: nowrap; }
.dim.small { font-size: 12px; }
@media (max-width: 640px) {
  .pf-ov { grid-template-columns: repeat(3, 1fr); }
  .ev-detail { display: block; margin-left: 0; }
}
</style>
