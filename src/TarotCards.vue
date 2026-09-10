<script setup lang="ts">
/* ============================================================
   TarotCards.vue — 牌库（批次 3）
   ------------------------------------------------------------
   把 22 张大阿卡纳摊开来看：牌义、元素、正逆位，
   以及每一张的「2006 触点」和四个咨询维度下的短解读。
   这些内容本来就存在，只是过去只在抽牌流程里一闪而过。
   ============================================================ */
import {ref, computed, onMounted} from 'vue';
import {rc} from './legacy';

const T = rc.tarot as any;
const ALL = (T.arcana || []) as any[];
const DOMAINS = (T.DOMAINS || []) as { k: string; cn: string; jp: string }[];
const dimOf = (id: number, k: string) => (T.dimOf ? T.dimOf(id, k) : null);

const lang = ref(rc.i18n.lang());
rc.i18n.onChange(() => { lang.value = rc.i18n.lang(); });
const t = (k: string) => { void lang.value; return rc.i18n.t(k); };
const bi = (cn: string, jp: string) => (lang.value === 'jp' ? jp : cn);

/* 大阿卡纳的 element 字段是占星对应（行星 / 星座），不是四元素。
   22 张的构成正好是 9 行星 + 12 星座 + 1 张无对应（愚者），按这个分组才对得上。 */
const PLANETS = ['水星', '金星', '月亮', '太阳', '火星', '木星', '土星', '海王', '冥王'];
const ZODIAC = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];
function kindOf(c: any): string {
  const e = String(c.element || '');
  if (ZODIAC.indexOf(e) >= 0) return 'zodiac';
  if (PLANETS.indexOf(e) >= 0) return 'planet';
  return 'other';
}
const ELEMS = [
  {k: 'all', cn: '全部', jp: 'すべて'},
  {k: 'planet', cn: '行星', jp: '惑星'},
  {k: 'zodiac', cn: '星座', jp: '星座'},
  {k: 'other', cn: '其他', jp: 'その他'}
];
const elem = ref('all');
const openId = ref<number | null>(null);

const shown = computed(() => (elem.value === 'all' ? ALL : ALL.filter((c) => kindOf(c) === elem.value)));
const nameOf = (c: any) => (lang.value === 'jp' ? (c.jp || c.cn) : (c.cn || c.jp));
const shortOf = (c: any) => (lang.value === 'jp' ? (c.shortJp || '') : (c.shortCn || ''));
function toggle(id: number): void { openId.value = openId.value === id ? null : id; }

onMounted(() => { try { (rc.i18n as any).apply?.(); } catch (e) { /* 忽略 */ } });
</script>

<template>
  <div class="panel">
    <div class="p-head">
      <h2>{{ t('cardsTitle') }}</h2>
      <span class="p-en">DECK</span>
      <span class="p-note">{{ ALL.length }}</span>
    </div>
    <div class="p-body">
      <p class="dim">{{ bi(
        '二十二张大阿卡纳，每一张都配了一个 2006 年的触点——那不是通用的牌义，是这间店自己的记性。点开任意一张慢慢看。',
        '大アルカナ22枚。それぞれに 2006 年の接点をつけた。汎用の牌義ではなく、この店自身の記憶。開いて眺めてほしい。'
      ) }}</p>
      <p class="dim small">{{ bi(
        '这里只有 22 张，不是一副完整的 78 张牌。因为整副牌的 56 张小阿尔卡纳更适合「学牌」，而这台机器是用来「说事」的——22 张够讲一个完整的故事，也才写得起这种密度的注脚。',
        'ここにあるのは 22 枚だけで、78 枚のフルデッキではない。残り 56 枚は「覚える」ための札で、この機械は「語る」ための機械だから。22 枚あれば物語は閉じるし、この密度の註が書ける。'
      ) }}</p>
      <hr class="rule">

      <div class="cd-filter">
        <button
          v-for="e in ELEMS" :key="e.k" type="button" class="sb-btn"
          :class="{on: elem === e.k}" @click="elem = e.k">{{ bi(e.cn, e.jp) }}</button>
      </div>

      <p v-if="!shown.length" class="dim center mt">{{ t('cardsEmpty') }}</p>
      <div v-else class="cd-grid">
        <button
          v-for="c in shown" :key="c.n" type="button"
          class="cd-cell" :class="{open: openId === c.n}"
          :id="'card-' + c.n" :data-card="c.n" @click="toggle(c.n)">
          <span class="cd-num">{{ c.r }}</span>
          <span class="cd-glyph">{{ c.g }}</span>
          <span class="cd-name">{{ nameOf(c) }}</span>
          <span class="cd-short">{{ shortOf(c) }}</span>
        </button>
      </div>

      <div v-if="openId !== null" class="cd-detail" id="cardDetail">
        <template v-for="c in ALL" :key="c.n">
          <div v-if="openId === c.n" class="cd-full">
            <div class="cd-full-head">
              <span class="cd-full-glyph">{{ c.g }}</span>
              <span class="cd-full-name">{{ nameOf(c) }}</span>
              <span class="cd-elem">{{ c.element }}</span>
              <button type="button" class="cd-close" @click="openId = null">×</button>
            </div>
            <p class="cd-line"><b>{{ t('cardsUpright') }}</b>{{ c.up }}</p>
            <p class="cd-line"><b>{{ t('cardsReversed') }}</b>{{ c.rv }}</p>
            <p v-if="dimOf(c.n, 'era')" class="cd-era">
              <span class="cd-tag">2006</span>{{ bi(dimOf(c.n, 'era').cn, dimOf(c.n, 'era').jp) }}
            </p>
            <div class="cd-domains">
              <p v-for="d in DOMAINS" :key="d.k" class="cd-domain">
                <span class="cd-dname">{{ bi(d.cn, d.jp) }}</span>
                <span>{{ bi((dimOf(c.n, d.k) || {}).cn || '', (dimOf(c.n, d.k) || {}).jp || '') }}</span>
              </p>
            </div>
          </div>
        </template>
      </div>

      <div class="center mt">
        <a class="btn" href="tarot.html">{{ bi('去抽一次牌','タロットを引く') }} →</a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cd-filter { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
.cd-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 8px; }
.cd-cell { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 12px 6px; border: 1px solid var(--line, #2a2a2a); border-radius: 10px; background: transparent; color: inherit; font: inherit; cursor: pointer; text-align: center; }
.cd-cell:hover { border-color: currentColor; }
.cd-cell.open { border-color: currentColor; background: rgba(128,128,128,.08); }
.cd-num { font-size: 10px; opacity: .45; letter-spacing: 1px; }
.cd-glyph { font-size: 22px; line-height: 1.2; }
.cd-name { font-size: 13px; font-weight: 500; }
.cd-short { font-size: 11px; opacity: .55; }
.cd-detail { margin-top: 16px; }
.cd-full { border: 1px solid var(--line, #2a2a2a); border-radius: 12px; padding: 16px; }
.cd-full-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 10px; }
.cd-full-glyph { font-size: 26px; }
.cd-full-name { font-size: 18px; font-weight: 500; }
.cd-elem { font-size: 12px; opacity: .5; }
.cd-close { margin-left: auto; border: 0; background: transparent; color: inherit; font-size: 18px; cursor: pointer; opacity: .5; }
.cd-line { font-size: 13.5px; line-height: 1.75; margin: 6px 0; }
.cd-line b { display: inline-block; min-width: 42px; font-weight: 500; opacity: .6; }
.cd-era { font-size: 13px; line-height: 1.75; margin: 10px 0 0; padding: 10px 12px; border-left: 2px solid currentColor; opacity: .85; }
.cd-tag { display: inline-block; margin-right: 8px; font-size: 11px; letter-spacing: 1px; opacity: .6; }
.cd-domains { margin-top: 10px; border-top: 1px dashed rgba(128,128,128,.2); padding-top: 10px; }
.cd-domain { font-size: 13px; line-height: 1.7; margin: 4px 0; }
.cd-dname { display: inline-block; min-width: 42px; opacity: .55; margin-right: 6px; }
@media (max-width: 640px) {
  .cd-grid { grid-template-columns: repeat(auto-fill, minmax(88px, 1fr)); }
}
</style>
