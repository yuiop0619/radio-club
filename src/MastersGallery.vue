<script setup lang="ts">
/* ============================================================
   MastersGallery.vue — 大师画廊（Phase 2：由 masters.js 迁移而来）

   数据取自 analyst.js 的 RC.analyst.MASTERS。语言切换由 i18n.onChange 驱动，
   静态双语内容仍用 .i18n-cn / .i18n-jp 并列，靠 body[data-lang] 显隐。
   ============================================================ */
import {ref} from 'vue';
import {rc} from './legacy';

const lang = ref(rc.i18n.lang());
rc.i18n.onChange(() => { lang.value = rc.i18n.lang(); });
const t = (key: string) => { void lang.value; return rc.i18n.t(key); };

interface Master { id: string; cn: string; jp: string; en: string; school: { cn: string; jp: string }; greet: { cn: string; jp: string } }

const masters = ref<Master[]>(((rc.analyst as unknown as { MASTERS?: Master[] }).MASTERS) || []);

/* 本店想记住的那些夜晚：静态致敬清单 */
const homage = [
  { year: '1997', cn: '未麻的部屋', jp: 'パーフェクトブルー', lineCn: '「镜头切走的那一下，才是真的。」', lineJp: '「カメラが逸らした一瞬こそ、本物。」' },
  { year: '2001', cn: '千年女优', jp: '千年女優', lineCn: '「我追的不是他，是追着他的我自己。」', lineJp: '「追っているのは彼でなく、追っている私。」' },
  { year: '2003', cn: '东京教父', jp: '東京ゴッドファーザーズ', lineCn: '「三个人加起来，勉强像个家。」', lineJp: '「三人合わせて、やっと家族。」' },
  { year: '2004', cn: '妄想代理人', jp: '妄想代理人', lineCn: '「走一步，再走一步。棒球少年一直在后面。」', lineJp: '「一歩、もう一歩。バットの少年は後ろにいる。」' },
  { year: '2006', cn: '红辣椒', jp: 'パプリカ', lineCn: '「梦跑到现实里来了，所以才需要有人守着边界。」', lineJp: '「夢が現実へ出てきた。だから境界を守る者が要る。」' }
];
</script>

<template>
  <div class="panel">
    <div class="p-head">
      <h2><span class="i18n-cn">{{ t('mastersTitle') }}</span><span class="i18n-jp">{{ t('mastersTitle') }}</span></h2>
      <span class="p-en">GALLERY</span>
      <span class="p-note"><span class="i18n-cn">{{ t('mastersSub') }}</span><span class="i18n-jp">{{ t('mastersSub') }}</span></span>
    </div>
    <div class="p-body">
      <p class="dim"><span class="i18n-cn">{{ t('mastersTip') }}</span><span class="i18n-jp">{{ t('mastersTip') }}</span></p>
      <hr class="rule">
      <div id="masterMount">
        <div class="ggrid">
          <div class="gcard" v-for="m in masters" :key="m.id">
            <div class="gc-photo"><picture>
              <source type="image/webp" :srcset="`assets/img/master-${m.id}-160.webp 160w, assets/img/master-${m.id}-640.webp 640w`" sizes="(max-width:600px) 50vw, 160px">
              <img :src="`assets/img/master-${m.id}-320.png`" width="320" height="320" loading="lazy" decoding="async" alt="">
            </picture></div>
            <div class="gc-body">
              <div class="gc-name"><span class="i18n-cn">{{ m.cn }}</span><span class="i18n-jp">{{ m.jp }}</span></div>
              <div class="gc-en">{{ m.en }}</div>
              <div class="gc-school"><span class="i18n-cn">{{ m.school.cn }}</span><span class="i18n-jp">{{ m.school.jp }}</span></div>
              <div class="gc-greet"><span class="i18n-cn">{{ m.greet.cn }}</span><span class="i18n-jp">{{ m.greet.jp }}</span></div>
              <div class="mt"><a class="btn ghost small" href="psyche.html">{{ t('goPsyche2') }}</a></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="panel">
    <div class="p-head">
      <h2><span class="i18n-cn">本店想记住的那些夜晚</span><span class="i18n-jp">この店が覚えていたい夜</span></h2>
      <span class="p-en">HOMAGE</span>
      <span class="p-note"><span class="i18n-cn">同人致敬 · 非官方</span><span class="i18n-jp">同人致敬 · 非公式</span></span>
    </div>
    <div class="p-body">
      <div class="honor-grid">
        <div class="hcard" v-for="h in homage" :key="h.year">
          <div class="hc-year">{{ h.year }}</div>
          <div class="hc-title"><span class="i18n-cn">{{ h.cn }}</span><span class="i18n-jp">{{ h.jp }}</span></div>
          <div class="hc-line"><span class="i18n-cn">{{ h.lineCn }}</span><span class="i18n-jp">{{ h.lineJp }}</span></div>
        </div>
      </div>
      <p class="hint mt"><span class="i18n-cn">※ 本店是同人向致敬站点，与上述作品的权利方无任何关联。这里只做一件事：把你说不清的那部分，摆回桌上。</span><span class="i18n-jp">※ 当サイトは同人によるオマージュであり、権利者とは一切関係ありません。ここがすることは一つだけ。</span></p>
    </div>
  </div>
</template>
