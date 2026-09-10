<script setup lang="ts">
/* ============================================================
   PersonalityPage.vue — 性格层析（批次 2）
   ------------------------------------------------------------
   28 题二选一迫选，逐题作答，可中断续做。
   结果写入 RC.profile，并在「边界型」时如实标注而不硬贴标签。
   题目内容来自 content/personality.json（构建期打进 content-bundle）。
   ============================================================ */
import {ref, computed, onMounted, onBeforeUnmount} from 'vue';
import {rc} from './legacy';
import profile from './profile';
import {getContent, score, letterName, typeInfo, type Answer, type Result} from './personality';

const lang = ref(rc.i18n.lang());
rc.i18n.onChange(() => { lang.value = rc.i18n.lang(); });
const t = (k: string) => { void lang.value; return rc.i18n.t(k); };
const bi = (cn: string, jp: string) => (lang.value === 'jp' ? jp : cn);

const content = getContent();
const items = content.items;
const total = items.length;

const stage = ref<'intro' | 'quiz' | 'result'>('intro');
const answers = ref<Answer[]>(items.map(() => null));
const idx = ref(0);
const result = ref<Result | null>(null);
const hasDraft = ref(false);

/* 恢复草稿 */
const saved = profile.get<any>('pfmDraft', null);
if (saved && Array.isArray(saved.answers) && saved.answers.length === total) {
  answers.value = saved.answers.slice();
  const at = Math.min(Number(saved.idx) || 0, total - 1);
  idx.value = at;
  hasDraft.value = saved.answers.some((a: Answer) => a === 0 || a === 1);
}
const prev = profile.personality();

const progPct = computed(() => Math.round(((idx.value) / Math.max(1, total)) * 100));
const item = computed(() => items[idx.value] || null);

function saveDraft(): void {
  profile.set('pfmDraft', {answers: answers.value, idx: idx.value, at: Date.now()});
}
function start(): void {
  answers.value = items.map(() => null);
  idx.value = 0;
  stage.value = 'quiz';
  saveDraft();
}
function resume(): void { stage.value = 'quiz'; saveDraft(); }
function pick(v: 0 | 1): void {
  answers.value[idx.value] = v;
  if (idx.value < total - 1) { idx.value++; saveDraft(); }
  else finish();
}
function back(): void { if (idx.value > 0) { idx.value--; saveDraft(); } }
function finish(): void {
  const r = score(answers.value, content);
  result.value = r;
  profile.savePersonality({
    type: r.type,
    dims: r.dims,
    balanced: r.balanced,
    answers: answers.value.map(a => (a === null ? -1 : a)),
    at: Date.now()
  });
  profile.del('pfmDraft');
  hasDraft.value = false;
  stage.value = 'result';
  try { (rc.stamps as any)?.unlock?.('persona'); } catch (e) { /* 忽略 */ }
  window.scrollTo({top: 0, behavior: 'auto'});
}
function restart(): void {
  stage.value = 'intro';
  result.value = null;
  answers.value = items.map(() => null);
  idx.value = 0;
}

function wordOf(k: string, letter: string): string {
  const n = letterName(k, letter, content);
  return bi(n.cn, n.jp);
}
function noteOf(code: string): string {
  const info = typeInfo(code, content);
  return bi(info.note.cn, info.note.jp);
}
function nameOf(code: string): string {
  const info = typeInfo(code, content);
  return bi(info.cn, info.jp);
}

/* 键盘 1 / 2 作答（这台机器像一台终端） */
function onKey(e: KeyboardEvent): void {
  if (stage.value !== 'quiz') return;
  const tag = (e.target as HTMLElement | null)?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (e.key === '1') { e.preventDefault(); pick(0); }
  else if (e.key === '2') { e.preventDefault(); pick(1); }
  else if (e.key === 'Backspace') { e.preventDefault(); back(); }
}
onMounted(() => { window.addEventListener('keydown', onKey); try { (rc.i18n as any).apply?.(); } catch (e) { /* 忽略 */ } });
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <!-- 开始 -->
  <div v-if="stage === 'intro'" class="panel">
    <div class="p-head">
      <h2>{{ t('pfmTitle') }}</h2>
      <span class="p-en">TYPE ANALYSIS</span>
      <span class="p-note">{{ total }} {{ t('pfmQUnit') }}</span>
    </div>
    <div class="p-body">
      <p class="dim">{{ bi(
        '给你 28 组情境，每组两句话。不用想太久，选更像你的那一句。',
        '28 の場面を用意した。それぞれ二つの文。考えすぎず、近い方を選べ。'
      ) }}</p>
      <hr class="rule">
      <p class="dim small">{{ bi(
        '说明：性格层析是一种自我叙述的框架，不是心理诊断。四个维度没有优劣，只有偏好方向。某一维你两边都能待时，这台机器会如实写出来，而不是硬给你贴一个标签。',
        '注記：性格層析は自己を語るための枠組みであり、心理的な診断ではない。四つの軸に優劣はなく、向きの違いだけ。どちらにも寄れる軸は、無理に分類せずそのまま書く。'
      ) }}</p>
      <div v-if="prev" class="pfm-prev">
        <span class="dim small">{{ t('pfmLast') }}</span>
        <b class="pfm-prev-type">{{ prev.type }}</b>
        <span class="dim small">{{ nameOf(prev.type) }}</span>
      </div>
      <div class="center mt">
        <button type="button" class="btn" id="pfmStart" @click="start">{{ prev ? t('pfmRetake') : t('pfmStart') }}</button>
        <button v-if="hasDraft" type="button" class="btn ghost" id="pfmResume" @click="resume">{{ t('pfmResume') }}</button>
      </div>
      <p class="hint center">{{ bi('可以用键盘 1 / 2 作答', 'キーボードの 1 / 2 でも答えられる') }}</p>
    </div>
  </div>

  <!-- 作答 -->
  <div v-else-if="stage === 'quiz' && item" class="panel">
    <div class="p-head">
      <h2>{{ idx + 1 }} / {{ total }}</h2>
      <span class="p-en">Q{{ idx + 1 }}</span>
    </div>
    <div class="p-body">
      <div class="pfm-prog"><span class="pfm-prog-fill" :style="{width: progPct + '%'}"></span></div>
      <p class="pfm-ask">{{ t('pfmAsk') }}</p>
      <button type="button" class="pfm-opt" id="pfmA" @click="pick(0)">
        <span class="pfm-key">1</span><span class="pfm-txt">{{ bi(item.a.cn, item.a.jp) }}</span>
      </button>
      <button type="button" class="pfm-opt" id="pfmB" @click="pick(1)">
        <span class="pfm-key">2</span><span class="pfm-txt">{{ bi(item.b.cn, item.b.jp) }}</span>
      </button>
      <div class="center mt">
        <button type="button" class="btn ghost" id="pfmBack" :disabled="idx === 0" @click="back">{{ t('pfmBack') }}</button>
      </div>
    </div>
  </div>

  <!-- 结果 -->
  <template v-else-if="stage === 'result' && result">
    <div class="panel">
      <div class="p-head">
        <h2>{{ t('pfmResult') }}</h2>
        <span class="p-en">RESULT</span>
      </div>
      <div class="p-body">
        <div class="pfm-code" id="pfmType">{{ result.type }}</div>
        <div class="pfm-name">{{ nameOf(result.type) }}</div>
        <p class="pfm-note">{{ noteOf(result.type) }}</p>
      </div>
    </div>

    <div class="panel">
      <div class="p-head">
        <h2>{{ t('pfmAxes') }}</h2>
        <span class="p-en">FOUR AXES</span>
        <span class="p-note">{{ result.answered }} / {{ result.total }}</span>
      </div>
      <div class="p-body">
        <div v-for="ax in result.axes" :key="ax.k" class="pfm-ax">
          <div class="pfm-ax-head">
            <span class="pfm-ax-name">{{ wordOf(ax.k, ax.letter) }}</span>
            <span class="pfm-ax-pct">{{ ax.pct }}%</span>
            <span class="pfm-ax-votes">{{ Math.max(ax.aCount, ax.bCount) }} : {{ Math.min(ax.aCount, ax.bCount) }}</span>
          </div>
          <div class="pfm-ax-bar">
            <span class="pfm-ax-fill" :style="{
              width: (ax.pct / 2) + '%',
              left: ax.letter === ax.a ? '50%' : 'auto',
              right: ax.letter === ax.a ? 'auto' : '50%'
            }"></span>
          </div>
          <p v-if="ax.balanced" class="hint">{{ ax.k }} · {{ t('pfmBalanced') }}</p>
        </div>
        <hr class="rule">
        <p class="dim small">{{ bi(
          '百分比偏向明显那一端占该维度题量的比例；右边的数字是原始票数。',
          'パーセントは偏った側がその軸の設問数のうち占めた割合。右の数字は生の票数。'
        ) }}</p>
      </div>
    </div>

    <div class="panel">
      <div class="p-head">
        <h2>{{ t('pfmWhatNow') }}</h2>
        <span class="p-en">NEXT</span>
      </div>
      <div class="p-body">
        <div class="center">
          <a class="btn ghost" href="profile.html">{{ t('pfmToProfile') }} →</a>
          <a class="btn ghost" href="tarot.html">{{ t('pfmToTarot') }} →</a>
          <button type="button" class="btn ghost" id="pfmAgain" @click="restart">{{ t('pfmAgain') }}</button>
        </div>
        <p class="dim small center mt">{{ bi(
          '结果已存入本机档案。这是一份自我叙述的框架，不是诊断——如果它让你更清楚一点，就够了。',
          '結果は端末内の档案に保存した。これは自己を語る枠組みであり診断ではない。少しでも整理できたら、それでいい。'
        ) }}</p>
      </div>
    </div>
  </template>
</template>

<style scoped>
.pfm-prev { margin-top: 12px; display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.pfm-prev-type { font-size: 16px; letter-spacing: 1px; }
.pfm-prog { height: 4px; border-radius: 2px; background: rgba(128,128,128,.2); overflow: hidden; margin-bottom: 14px; }
.pfm-prog-fill { display: block; height: 100%; background: currentColor; opacity: .65; transition: width .2s ease; }
.pfm-ask { font-size: 13px; opacity: .6; margin: 0 0 10px; }
.pfm-opt { display: flex; align-items: flex-start; gap: 10px; width: 100%; text-align: left; margin: 8px 0; padding: 14px 14px; border: 1px solid var(--line, #333); border-radius: 10px; background: transparent; color: inherit; font: inherit; font-size: 14px; line-height: 1.6; cursor: pointer; }
.pfm-opt:hover { border-color: currentColor; }
.pfm-opt:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
.pfm-key { flex: 0 0 auto; width: 22px; height: 22px; border-radius: 50%; border: 1px solid currentColor; font-size: 12px; line-height: 20px; text-align: center; opacity: .6; }
.pfm-txt { flex: 1; }
.pfm-code { font-size: 44px; font-weight: 500; letter-spacing: 6px; line-height: 1.1; }
.pfm-name { font-size: 15px; opacity: .75; margin-top: 2px; }
.pfm-note { margin-top: 12px; font-size: 14px; line-height: 1.7; }
.pfm-ax { margin: 14px 0; }
.pfm-ax-head { display: flex; align-items: baseline; gap: 8px; }
.pfm-ax-name { font-size: 14px; font-weight: 500; }
.pfm-ax-pct { font-size: 14px; margin-left: auto; }
.pfm-ax-votes { font-size: 11px; opacity: .45; }
.pfm-ax-bar { position: relative; height: 6px; border-radius: 3px; background: rgba(128,128,128,.2); overflow: hidden; margin-top: 6px; }
.pfm-ax-bar::after { content: ''; position: absolute; left: 50%; top: 0; bottom: 0; width: 1px; background: rgba(128,128,128,.5); }
.pfm-ax-fill { position: absolute; top: 0; bottom: 0; display: block; background: currentColor; opacity: .7; }
.btn[disabled] { opacity: .35; cursor: default; }
</style>
