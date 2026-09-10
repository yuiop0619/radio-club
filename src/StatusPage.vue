<script setup lang="ts">
/* ============================================================
   StatusPage.vue — 这台机器的状态
   ------------------------------------------------------------
   把 A/B/C/D 四档功能汇成一张「现在能做什么」的状态卡：
   哪些模块你用过、哪些还没碰，以及下一步可以去哪。
   所有判定只读本机存储键，不上传。
   ============================================================ */
import {computed, ref} from 'vue';
import {rc} from './legacy';

const lang = ref(rc.i18n.lang());
rc.i18n.onChange(() => { lang.value = rc.i18n.lang(); });
const t = (k: string) => { void lang.value; return rc.i18n.t(k); };
const bi = (cn: string, jp: string) => (lang.value === 'jp' ? jp : cn);

interface Module { k: string; cn: string; jp: string; href: string; color: string; }
const MODULES: Module[] = [
  {k: 'order', cn: '委托受理', jp: 'ご用件', href: 'order.html', color: '#e9a23d'},
  {k: 'tarot', cn: '塔罗', jp: 'タロット', href: 'tarot.html', color: '#c88fd9'},
  {k: 'psyche', cn: '精神分析', jp: '精神分析', href: 'psyche.html', color: '#7fb5d6'},
  {k: 'verdict', cn: '鉴定书', jp: '鑑定書', href: 'verdict.html', color: '#e07a5f'},
  {k: 'dream', cn: '梦境记录', jp: '夢の記録', href: 'dreams.html', color: '#8fbc8f'},
  {k: 'personality', cn: '性格层析', jp: '層析', href: 'personality.html', color: '#d4a373'},
  {k: 'mood', cn: '情绪打卡', jp: '気分', href: 'toolbox.html', color: '#f2cc8f'},
  {k: 'breath', cn: '呼吸引导', jp: '呼吸', href: 'toolbox.html', color: '#81b29a'},
  {k: 'thought', cn: '念头记录', jp: '念い', href: 'toolbox.html', color: '#9ea7c6'},
  {k: 'omen', cn: '每日一签', jp: '今日の札', href: 'index.html', color: '#e9a23d'}
];

function usedOf(k: string): boolean {
  const store = rc.store as any;
  try {
    const c = store.get('case', null);
    const p = store.get('profile', null) || {};
    switch (k) {
      case 'order': return !!(c && c.story);
      case 'tarot': return !!(c && c.tarot && c.tarot.length);
      case 'psyche': return !!(c && ((c.analystLog && c.analystLog.length) || (c.assoc && c.assoc.some((a: any) => a.resp))));
      case 'verdict': return !!store.get('verdict', null);
      case 'dream': return (store.get('dreamLog', []) || []).length > 0;
      case 'personality': return !!(p.personality && p.personality.type);
      case 'mood': return !!(p.moodLogs && p.moodLogs.length);
      case 'breath': return !!(p.breaths && p.breaths.length);
      case 'thought': return !!(p.thoughts && p.thoughts.length);
      case 'omen': return !!(p.omenSeen && p.omenSeen.length);
    }
  } catch (e) { return false; }
  return false;
}

const usedFlags = computed(() => {
  const map: Record<string, boolean> = {};
  for (const m of MODULES) map[m.k] = usedOf(m.k);
  return map;
});
const usedCount = computed(() => MODULES.filter(m => usedFlags.value[m.k]).length);
const nextModule = computed(() => MODULES.find(m => !usedFlags.value[m.k]) || MODULES[0]);

function recentHint(): string {
  const store = rc.store as any;
  try {
    const dreams = store.get('dreamLog', []) as any[];
    if (dreams.length) {
      const last = dreams[dreams.length - 1];
      return bi(`最近记过一场梦：${last.tag || '无标签'}`, `最近書いた夢：${last.tag || 'タグなし'}`);
    }
    const c = store.get('case', null);
    if (c && c.story) return bi('最近留下了一句委托。', '最近ご用件を残した。');
    const p = store.get('profile', null) || {};
    if (p.moodLogs && p.moodLogs.length) return bi('最近打过一次情绪卡。', '最近気分を記録した。');
  } catch (e) {}
  return bi('还没有留下任何记录。', 'まだ記録がない。');
}
</script>

<template>
  <div class="panel">
    <div class="p-head">
      <h2>{{ t('statusTitle') }}</h2>
      <span class="p-en">STATUS</span>
      <span class="p-note">{{ usedCount }} / {{ MODULES.length }} {{ t('statusUsed') }}</span>
    </div>
    <div class="p-body">
      <p class="dim">{{ t('statusSub') }}</p>
      <div class="st-summary">
        <div class="st-ring" :style="{'--pct': usedCount/MODULES.length}">
          <span class="st-ring-num">{{ usedCount }}</span>
          <span class="st-ring-den">/ {{ MODULES.length }}</span>
        </div>
        <div class="st-hint">
          <p class="st-hint-line">{{ recentHint() }}</p>
          <p v-if="usedCount < MODULES.length" class="st-next">
            {{ bi('下一步可以试试', '次はこれを試してみよう') }}
            <a :href="nextModule.href" :style="{color: nextModule.color}">{{ bi(nextModule.cn, nextModule.jp) }}</a>
          </p>
          <p v-else class="st-next all">{{ bi('所有模块都留下了痕迹。这台机器已经认识你。', 'すべてのモジュールに痕跡がある。この機械はもう君を知っている。') }}</p>
        </div>
      </div>
      <hr class="rule">
      <p class="dim small">{{ t('statusModules') }}</p>
      <div class="st-grid">
        <a v-for="m in MODULES" :key="m.k" :href="m.href" class="st-cell" :class="{on: usedFlags[m.k]}">
          <span class="st-dot" :style="{background: m.color}"></span>
          <span class="st-name">{{ bi(m.cn, m.jp) }}</span>
          <span class="st-flag">{{ usedFlags[m.k] ? t('statusUsed') : t('statusUnused') }}</span>
        </a>
      </div>
      <p class="faint small mt">{{ t('statusNote') }}</p>
    </div>
  </div>
</template>

<style scoped>
.st-summary { display: flex; align-items: center; gap: 18px; margin: 12px 0 18px; }
.st-ring { width: 84px; height: 84px; border-radius: 50%; display: grid; place-items: center; position: relative; flex: 0 0 auto; background: conic-gradient(var(--amber,#e9a23d) calc(var(--pct,0)*360deg), rgba(128,128,128,.15) 0); }
.st-ring::before { content: ''; position: absolute; inset: 6px; border-radius: 50%; background: var(--bg,#100e0c); }
.st-ring-num { position: relative; font-size: 26px; font-weight: 600; line-height: 1; }
.st-ring-den { position: relative; font-size: 11px; opacity: .6; margin-top: -14px; }
.st-hint { flex: 1; }
.st-hint-line { font-size: 13.5px; margin: 0 0 8px; line-height: 1.6; }
.st-next { font-size: 13px; margin: 0; opacity: .85; }
.st-next a { font-weight: 500; text-decoration: underline; text-underline-offset: 3px; }
.st-next.all { color: var(--amber,#e9a23d); }
.st-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; margin: 8px 0; }
.st-cell { border: 1px solid var(--line, #2a2a2a); border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 6px; text-decoration: none; color: inherit; transition: transform .12s ease, border-color .12s ease; }
.st-cell:hover { transform: translateY(-2px); border-color: rgba(255,255,255,.2); }
.st-cell.on { border-color: currentColor; background: rgba(128,128,128,.07); }
.st-dot { width: 8px; height: 8px; border-radius: 50%; }
.st-name { font-size: 14px; font-weight: 500; }
.st-flag { font-size: 11px; opacity: .55; }
.st-cell.on .st-flag { opacity: .85; }
@media (max-width: 520px) {
  .st-summary { flex-direction: column; align-items: flex-start; gap: 12px; }
}
</style>
