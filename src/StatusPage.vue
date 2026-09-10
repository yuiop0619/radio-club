<script setup lang="ts">
/* ============================================================
   StatusPage.vue — 这台机器的状态（批次 6 · 作品集向）
   ------------------------------------------------------------
   把 A/B/C/D 四档功能汇成一张「现在能做什么」的状态卡：
   哪些模块你用过、技术栈、部署信息。所有判定只读本机存储键。
   ============================================================ */
import {ref} from 'vue';
import {rc} from './legacy';

const lang = ref(rc.i18n.lang());
rc.i18n.onChange(() => { lang.value = rc.i18n.lang(); });
const t = (k: string) => { void lang.value; return rc.i18n.t(k); };
const bi = (cn: string, jp: string) => (lang.value === 'jp' ? jp : cn);

const MODULES = [
  {k: 'order', cn: '委托受理', jp: 'ご用件'},
  {k: 'tarot', cn: '塔罗', jp: 'タロット'},
  {k: 'psyche', cn: '精神分析', jp: '精神分析'},
  {k: 'verdict', cn: '鉴定书', jp: '鑑定書'},
  {k: 'dream', cn: '梦境记录', jp: '夢の記録'},
  {k: 'personality', cn: '性格层析', jp: '層析'},
  {k: 'mood', cn: '情绪打卡', jp: '気分'},
  {k: 'breath', cn: '呼吸引导', jp: '呼吸'},
  {k: 'thought', cn: '念头记录', jp: '念い'},
  {k: 'omen', cn: '每日一签', jp: '今日の札'}
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
const usedCount = MODULES.filter(m => usedOf(m.k)).length;

const STACK = ['Vue 3', 'TypeScript', 'Vite', 'Pinia', 'Node.js', 'Playwright', 'Cloudfunctions'];
const ONLINE = 'http://101.42.158.132:8080';
const VERSION = 'MODEL RC-2006 · 2026.09';
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
      <hr class="rule">
      <p class="dim small">{{ t('statusModules') }}</p>
      <div class="st-grid">
        <div v-for="m in MODULES" :key="m.k" class="st-cell" :class="{on: usedOf(m.k)}">
          <span class="st-name">{{ bi(m.cn, m.jp) }}</span>
          <span class="st-flag">{{ usedOf(m.k) ? t('statusUsed') : t('statusUnused') }}</span>
        </div>
      </div>
      <hr class="rule">
      <p class="dim small">{{ t('statusStack') }}</p>
      <div class="st-stack">
        <span v-for="s in STACK" :key="s" class="st-tag">{{ s }}</span>
      </div>
      <hr class="rule">
      <p class="dim small">{{ t('statusDeploy') }}</p>
      <div class="st-deploy">
        <div><span class="dim small">{{ t('statusOnline') }}</span> <a :href="ONLINE" target="_blank" rel="noopener">{{ ONLINE }}</a></div>
        <div><span class="dim small">{{ t('statusVersion') }}</span> {{ VERSION }}</div>
      </div>
      <p class="faint small mt">{{ t('statusNote') }}</p>
    </div>
  </div>
</template>

<style scoped>
.st-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; margin: 8px 0; }
.st-cell { border: 1px solid var(--line, #2a2a2a); border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 6px; }
.st-cell.on { border-color: currentColor; background: rgba(128,128,128,.07); }
.st-name { font-size: 14px; font-weight: 500; }
.st-flag { font-size: 11px; opacity: .55; }
.st-cell.on .st-flag { opacity: .85; }
.st-stack { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0; }
.st-tag { border: 1px solid var(--line, #2a2a2a); border-radius: 999px; padding: 3px 10px; font-size: 12px; opacity: .8; }
.st-deploy { font-size: 13px; line-height: 2; }
.st-deploy a { color: var(--amber, #e9a23d); }
</style>
