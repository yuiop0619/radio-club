<script setup lang="ts">
/* ============================================================
   LabPage.vue — 实验室 / 技术文档（批次 6 · 作品集向）
   ------------------------------------------------------------
   给想看源码的人：架构、存储键、构建链、设计决策。
   全部是静态内容，不读存储键。
   ============================================================ */
import {ref} from 'vue';
import {rc} from './legacy';

const lang = ref(rc.i18n.lang());
rc.i18n.onChange(() => { lang.value = rc.i18n.lang(); });
const t = (k: string) => { void lang.value; return rc.i18n.t(k); };
const bi = (cn: string, jp: string) => (lang.value === 'jp' ? jp : cn);

const ARCH = [
  'Vue 3 + TypeScript 前端，Pinia 管状态',
  'Vite 构建，MPA：构建期扫描根目录 *.html 动态生成页面',
  'Node.js 后端 + Cloudfunctions 处理树洞留言同步',
  'Playwright 驱动六套件端到端测试（unit / browser / machine / second / upgrade / ai）'
];
const STORE_KEYS = [
  {k: 'rc_profile', d: '档案聚合层：personality / moodLogs / thoughts / breaths / draws / omenSeen'},
  {k: 'case', d: '委托 + 鉴定书草稿：story / tarot / analystLog / assoc / verdict'},
  {k: 'dreamLog', d: '梦境记录：date / mood / tag / body'},
  {k: 'bbs_v2', d: '树洞留言（含云端同步标记）'},
  {k: 'stamps', d: '集章卡（17 枚成就印章）'},
  {k: 'counter_v2 / visits', d: '吧台订单与到店计数'},
  {k: 'stat_tarot / tarotDraft', d: '塔罗统计与草稿恢复'}
];
const BUILD = [
  'build-content：content/*.json → assets/js/content-bundle.js（window.RC_CONTENT）',
  'check-pages：校验 site.config.json 的页面脚本清单',
  'vue-tsc --noEmit：类型检查',
  'vite build：产出 dist/'
];
const DECISIONS = [
  '双入口：main.ts（有状态 Vue 页）与 chrome.ts（无状态样板页）',
  '类型桥 legacy.ts：Vue 复用 legacy IIFE 逻辑，window.RC 为桥',
  '内容单一来源：content/*.json 自动扫入 bundle，新增 json 即进构建',
  '档案层：聚合视图 + rc_profile 增量写入，既有键只读不搬动',
  '边界型如实标注：某维度 4:3 标为 slight，不强行归类'
];
</script>

<template>
  <div class="panel">
    <div class="p-head">
      <h2>{{ t('labTitle') }}</h2>
      <span class="p-en">LAB</span>
    </div>
    <div class="p-body">
      <p class="dim">{{ bi('这台机器是怎么搭起来的。给想看源码的人。', 'この機械の作り方。ソースを見たい人へ。') }}</p>
      <hr class="rule">
      <p class="dim small">{{ t('labArch') }}</p>
      <ul class="lab-list"><li v-for="a in ARCH" :key="a">{{ a }}</li></ul>
      <hr class="rule">
      <p class="dim small">{{ t('labStore') }}</p>
      <table class="lab-tbl"><tr v-for="s in STORE_KEYS" :key="s.k"><td class="lab-k">{{ s.k }}</td><td>{{ s.d }}</td></tr></table>
      <hr class="rule">
      <p class="dim small">{{ t('labBuild') }}</p>
      <ol class="lab-list"><li v-for="b in BUILD" :key="b">{{ b }}</li></ol>
      <hr class="rule">
      <p class="dim small">{{ t('labDecisions') }}</p>
      <ul class="lab-list"><li v-for="d in DECISIONS" :key="d">{{ d }}</li></ul>
      <div class="center mt">
        <a class="btn ghost" href="status.html">{{ bi('看运行状态', '状態を見る') }} →</a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lab-list { margin: 6px 0; padding-left: 18px; }
.lab-list li { font-size: 13px; line-height: 1.9; }
.lab-tbl { width: 100%; border-collapse: collapse; }
.lab-tbl td { font-size: 12.5px; padding: 5px 8px; border-bottom: 1px dashed rgba(128,128,128,.18); vertical-align: top; }
.lab-k { font-family: var(--font-mono, monospace); opacity: .8; white-space: nowrap; width: 1%; }
</style>
