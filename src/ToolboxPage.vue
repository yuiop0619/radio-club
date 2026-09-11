<script setup lang="ts">
/* ============================================================
   ToolboxPage.vue — 理线头工具箱（批次 4）
   ------------------------------------------------------------
   三件工具，按一条动线排：
     情绪打卡 → （分数低时）呼吸引导 → 念头记录 → 回档案
   每一件都落进同一个 rc_profile 命名空间，所以在「我的档案」
   里能看到同一条时间线。
   ============================================================ */
import {ref, computed, onMounted, onBeforeUnmount} from 'vue';
import {rc} from './legacy';
import profile from './profile';
import {getContent, cycleOf, breathAt, moodSeries, moodAvg, streakTier, todayKey} from './toolbox';

const lang = ref(rc.i18n.lang());
rc.i18n.onChange(() => { lang.value = rc.i18n.lang(); });
const t = (k: string) => { void lang.value; return rc.i18n.t(k); };
const bi = (cn: string, jp: string) => (lang.value === 'jp' ? jp : cn);

const C = getContent();

/* ---------------- 顶部读数 ---------------- */

const snap = ref(profile.snapshot());
function refresh(): void { snap.value = profile.snapshot(); }

const streak = computed(() => snap.value.mood.streak);
const breathCount = computed(() => snap.value.breaths.length);
const thoughtCount = computed(() => snap.value.thoughts.length);

/* ---------------- 工具切换 ---------------- */

type Tab = 'mood' | 'breath' | 'thought';
const tab = ref<Tab>('mood');

interface Bridge { text: string; to?: Tab; href?: string; label?: string; }
const bridge = ref<Bridge | null>(null);

function go(k: Tab): void {
  tab.value = k;
  bridge.value = null;
  try { window.scrollTo({top: 0, behavior: 'auto'}); } catch (e) { /* 忽略 */ }
}

/* ---------------- 一、情绪打卡 ---------------- */

const today = profile.todayMood();
const score = ref<number>(today ? Number(today.score) || 0 : 0);
const picked = ref<string[]>((today && today.tags) ? today.tags.slice() : []);
const note = ref<string>((today && today.note) || '');
const hasToday = ref<boolean>(!!today);
const moodMsg = ref<string>('');
const moodReading = ref<string>('');
const readingLoading = ref<boolean>(false);
const genReady = ref<boolean>(!!(rc.gen && rc.gen.isReady && rc.gen.isReady()));
const logs = ref(profile.moods());

const series = computed(() => moodSeries(logs.value, 14));
const avg7 = computed(() => moodAvg(logs.value, 7));
const curLevel = computed(() => C.moods.find(m => m.score === score.value) || null);
const tier = computed(() => streakTier(streak.value));

function setScore(v: number): void { score.value = v; moodMsg.value = ''; }
function toggleTag(k: string): void {
  const i = picked.value.indexOf(k);
  if (i >= 0) picked.value.splice(i, 1);
  else if (picked.value.length < 3) picked.value.push(k);
}
function saveMood(): void {
  if (!score.value) { moodMsg.value = t('tbMoodNeed'); return; }
  profile.saveMood({
    date: todayKey(),
    score: score.value,
    tags: picked.value.slice(),
    note: note.value.trim()
  });
  logs.value = profile.moods();
  hasToday.value = true;
  refresh();
  try { (rc.stamps as any)?.unlock?.('mood'); } catch (e) { /* 忽略 */ }
  moodMsg.value = t('tbMoodSaved');
  bridge.value = bridgeFor(score.value);
  genMoodReading();
}

/** 打卡后让机器读你：把今天的分、标签、近况交给用户自己的模型，回来一句不鸡汤的洞察。
    未接模型（RC.gen 未就绪）时静默跳过，不影响打卡本身。 */
async function genMoodReading(): Promise<void> {
  moodReading.value = '';
  const g = rc.gen;
  if (!g || !g.isReady || !g.isReady()) return;
  readingLoading.value = true;
  const ev = {
    score: score.value,
    tags: picked.value.slice(),
    note: note.value.trim(),
    avg7: avg7.value,
    streak: streak.value,
    series: series.value.map(c => c.score || 0)
  };
  try {
    const r = await g.interpret('mood', ev, '夜访者');
    if (r && r.ok && r.text) moodReading.value = r.text;
  } catch (e) {
    /* 模型失败：静默降级，不阻塞打卡 */
  } finally {
    readingLoading.value = false;
  }
}

/** 打完分之后，这台机器给你的下一步（三件工具就这样串起来） */
function bridgeFor(s: number): Bridge {
  if (s <= 2) {
    return {text: t('tbBridgeLow'), to: 'breath', label: t('tbGoBreath')};
  }
  if (s >= 4) {
    return {text: t('tbBridgeHigh'), href: 'tarot.html', label: t('tbGoTarot')};
  }
  return {text: t('tbBridgeMid'), to: 'thought', label: t('tbGoThought')};
}

/* ---------------- 二、呼吸引导 ---------------- */

const patterns = C.breath.patterns;
const pk = ref<string>(patterns[0].k);
const pattern = computed(() => patterns.find(p => p.k === pk.value) || patterns[0]);
const cycle = computed(() => cycleOf(pattern.value.phases));

const running = ref(false);
const elapsed = ref(0);
const roundsSeen = ref(0);
const breathMsg = ref<string>('');

const at = computed(() => breathAt(cycle.value, elapsed.value));
const phaseName = computed(() => {
  const n = C.breath.phaseNames[at.value.k];
  return n ? bi(n.cn, n.jp) : at.value.k;
});
const levelName = computed(() => {
  const n = at.value.level;
  if (!running.value) return t('tbBreathReady');
  return n <= 0.34 ? bi('吸到底前', 'まだ浅い') : (n >= 0.67 ? bi('快满了', 'もう少し') : bi('一半', '半分'));
});

const RING = 2 * Math.PI * 58;
const dashOffset = computed(() => (RING * (1 - Math.max(0, Math.min(1, at.value.level)))).toFixed(2));

let timer: number | null = null;
let t0 = 0;

function pickPattern(k: string): void {
  if (running.value) return;
  pk.value = k;
  elapsed.value = 0;
  roundsSeen.value = 0;
  breathMsg.value = '';
}
function tick(): void {
  const e = (Date.now() - t0) / 1000;
  elapsed.value = e;
  const done = Math.floor(e / cycle.value.total);
  if (done > roundsSeen.value) roundsSeen.value = done;
}
function startBreath(): void {
  running.value = true;
  breathMsg.value = '';
  bridge.value = null;
  elapsed.value = 0;
  roundsSeen.value = 0;
  t0 = Date.now();
  if (timer) window.clearInterval(timer);
  timer = window.setInterval(tick, 100);
}
function stopBreath(): void {
  if (timer) { window.clearInterval(timer); timer = null; }
  const secs = Math.round((Date.now() - t0) / 1000);
  const rounds = roundsSeen.value;
  running.value = false;
  elapsed.value = 0;
  if (secs < 3 && rounds < 1) {
    breathMsg.value = t('tbBreathTooShort');
    return;
  }
  profile.addBreath({pattern: pk.value, rounds, seconds: secs});
  refresh();
  breathMsg.value = t('tbBreathSaved').replace('{n}', String(secs)).replace('{r}', String(rounds));
  bridge.value = {text: t('tbBridgeBreath'), to: 'thought', label: t('tbGoThought')};
}

/* ---------------- 三、念头记录 ---------------- */

const form = ref<Record<string, string>>({scene: '', thought: '', for: '', against: '', alt: ''});
const thMsg = ref<string>('');
const thSample = ref<boolean>(false);

const mustFields = computed(() => C.thought.fields.filter(f => f.must));

function saveThought(): void {
  const f = form.value;
  for (const d of mustFields.value) {
    if (!String(f[d.k] || '').trim()) {
      thMsg.value = t('tbThNeed').replace('{x}', bi(d.cn, d.jp));
      return;
    }
  }
  profile.addThought({
    scene: f.scene.trim(), thought: f.thought.trim(),
    for: f['for'].trim(), against: f.against.trim(), alt: f.alt.trim()
  });
  refresh();
  try { (rc.stamps as any)?.unlock?.('thought'); } catch (e) { /* 忽略 */ }
  form.value = {scene: '', thought: '', for: '', against: '', alt: ''};
  thSample.value = false;
  thMsg.value = t('tbThSaved');
  bridge.value = {text: t('tbBridgeThought'), href: 'profile.html', label: t('tbToProfile')};
  try { window.scrollTo({top: 0, behavior: 'auto'}); } catch (e) { /* 忽略 */ }
}
function delThought(id: string): void {
  profile.delThought(id);
  refresh();
  thMsg.value = t('tbThDeleted');
}

function fmt(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => (n < 10 ? '0' + n : String(n));
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

onMounted(() => {
  try { (rc.i18n as any).apply?.(); } catch (e) { /* 忽略 */ }
  genReady.value = !!(rc.gen && rc.gen.isReady && rc.gen.isReady());
});
onBeforeUnmount(() => { if (timer) window.clearInterval(timer); });
</script>

<template>
  <!-- 今晚的读数：三件工具都记在这里 -->
  <div class="panel tight">
    <div class="p-head">
      <h2>{{ t('tbReadout') }}</h2>
      <span class="p-en">READOUT</span>
      <span class="p-note"><a href="profile.html">{{ t('tbToProfile') }} →</a></span>
    </div>
    <div class="p-body">
      <div class="tb-readout" id="tbReadout">
        <div class="tb-ro">
          <span class="tb-ro-n" id="tbRoStreak">{{ streak }}</span>
          <span class="tb-ro-l">{{ t('tbStreakLabel') }}</span>
        </div>
        <div class="tb-ro">
          <span class="tb-ro-n" id="tbRoMood">{{ score ? score + '/5' : '—' }}</span>
          <span class="tb-ro-l">{{ t('tbRMood') }}</span>
        </div>
        <div class="tb-ro">
          <span class="tb-ro-n" id="tbRoBreath">{{ breathCount }}</span>
          <span class="tb-ro-l">{{ t('tbRBreath') }}</span>
        </div>
        <div class="tb-ro">
          <span class="tb-ro-n" id="tbRoThought">{{ thoughtCount }}</span>
          <span class="tb-ro-l">{{ t('tbRThought') }}</span>
        </div>
      </div>
    </div>
  </div>

  <!-- 三件工具的入口 -->
  <div class="panel">
    <div class="p-head">
      <h2>{{ t('tbTitle') }}</h2>
      <span class="p-en">TOOLBOX</span>
    </div>
    <div class="p-body">
      <div class="tb-tabs">
        <button type="button" class="tb-tab" :class="{on: tab === 'mood'}" id="tbTabMood" @click="go('mood')">
          <span class="tb-tab-m">情</span>
          <span class="tb-tab-t">{{ t('tbMoodTab') }}</span>
        </button>
        <button type="button" class="tb-tab" :class="{on: tab === 'breath'}" id="tbTabBreath" @click="go('breath')">
          <span class="tb-tab-m">息</span>
          <span class="tb-tab-t">{{ t('tbBreathTab') }}</span>
        </button>
        <button type="button" class="tb-tab" :class="{on: tab === 'thought'}" id="tbTabThought" @click="go('thought')">
          <span class="tb-tab-m">念</span>
          <span class="tb-tab-t">{{ t('tbThoughtTab') }}</span>
        </button>
      </div>
      <p class="dim small mt">{{ bi(
        '三件工具可以分开用，也可以顺着走：先给今天打个分，再看要不要坐两分钟，最后把绕了一天的那句话写下来。',
        '三つは別々に使ってもいいし、順にどうぞ。今日に点をつけ、必要なら二分だけ座り、最後に一日つきまとった言葉を書き出す。'
      ) }}</p>
    </div>
  </div>

  <!-- 桥接：上一步做完了，下一步往哪走 -->
  <div v-if="bridge" class="panel tb-bridge" id="tbBridge">
    <div class="p-body">
      <p class="tb-bridge-txt" id="tbBridgeText">{{ bridge.text }}</p>
      <div class="mt">
        <button v-if="bridge.to" type="button" class="btn ghost small" id="tbBridgeGo" @click="go(bridge.to)">{{ bridge.label }} →</button>
        <a v-else-if="bridge.href" class="btn ghost small" id="tbBridgeGo" :href="bridge.href">{{ bridge.label }} →</a>
      </div>
    </div>
  </div>

  <!-- ============ 一、情绪打卡 ============ -->
  <div v-show="tab === 'mood'" class="panel" id="tbMoodPanel">
    <div class="p-head">
      <h2>{{ t('tbMoodTab') }}</h2>
      <span class="p-en">MOOD LOG</span>
      <span class="p-note" id="tbMoodStreak">{{ t('tbStreak') }} {{ streak }} {{ t('tbStreakDays') }}</span>
    </div>
    <div class="p-body">
      <p class="tb-ask">{{ t('tbMoodQ') }}</p>
      <div class="tb-scores">
        <button v-for="m in C.moods" :key="m.score" type="button" class="tb-score"
          :class="{on: score === m.score}" :id="'tbMood' + m.score" @click="setScore(m.score)">
          <span class="tb-score-n">{{ m.score }}</span>
          <span class="tb-score-w">{{ bi(m.cn, m.jp) }}</span>
        </button>
      </div>
      <p v-if="curLevel" class="tb-line" id="tbMoodLine">{{ bi(curLevel.line.cn, curLevel.line.jp) }}</p>

      <hr class="rule">
      <p class="tb-lab">{{ t('tbMoodTag') }}</p>
      <div class="tb-tags">
        <button v-for="g in C.tags" :key="g.k" type="button" class="chip tb-tag"
          :class="{on: picked.indexOf(g.k) >= 0}" :id="'tbTag-' + g.k" @click="toggleTag(g.k)">{{ bi(g.cn, g.jp) }}</button>
      </div>

      <p class="tb-lab mt">{{ t('tbMoodNote') }}</p>
      <textarea id="tbMoodNote" v-model="note" rows="2" :placeholder="t('tbMoodNotePh')"></textarea>

      <div class="mt">
        <button type="button" class="btn small" id="tbMoodSave" @click="saveMood">{{ hasToday ? t('tbMoodAgain') : t('tbMoodSave') }}</button>
        <span class="tb-msg" id="tbMoodMsg">{{ moodMsg }}</span>
      </div>

      <hr class="rule">
      <div class="tb-chart-head">
        <span class="tb-lab">{{ t('tbMoodChart') }}</span>
        <span class="dim small">{{ t('tbMoodAvg') }} {{ avg7 || '—' }}</span>
      </div>
      <div class="tb-chart" id="tbMoodChart">
        <div v-for="c in series" :key="c.date" class="tb-col" :class="{today: c.today, blank: !c.score}">
          <span class="tb-bar" :style="{height: (c.score ? c.score * 18 : 1) + 'px'}"></span>
          <span class="tb-col-d">{{ c.day }}</span>
        </div>
      </div>
      <p class="hint">{{ t('tbMoodEmpty') }}</p>
      <p v-if="tier !== 'none'" class="dim small mt" id="tbStreakTier">{{ t('tbStreak_' + tier) }}</p>

      <div v-if="readingLoading || moodReading" class="tb-machine" id="tbMoodReading">
        <p class="tb-machine-h">机器读你 · MODEL RC-2006</p>
        <p v-if="readingLoading" class="dim small">{{ bi('正在读取今夜的你……', '今夜のあなたを読んでいます…') }}</p>
        <p v-else class="tb-machine-t">{{ moodReading }}</p>
      </div>
      <p v-else-if="!genReady" class="tb-machine-off">
        {{ bi('这台机器还没接上你自己的模型。', 'この機械にはあなたの模型がまだ繋がっていない。') }}
        <a href="model.html">{{ bi('去模型页接一个', '模型ページで繋ぐ') }}</a>{{ bi('，每次打卡会给你一句「机器读你」。', '、毎回の記録に一言添える。') }}
      </p>
    </div>
  </div>

  <!-- ============ 二、呼吸引导 ============ -->
  <div v-show="tab === 'breath'" class="panel" id="tbBreathPanel">
    <div class="p-head">
      <h2>{{ t('tbBreathTab') }}</h2>
      <span class="p-en">BREATH</span>
      <span class="p-note">{{ t('tbBreathCount') }} {{ breathCount }}</span>
    </div>
    <div class="p-body">
      <div class="tb-pats">
        <button v-for="p in patterns" :key="p.k" type="button" class="chip" :class="{on: p.k === pk}"
          :id="'tbPat-' + p.k" @click="pickPattern(p.k)">{{ bi(p.cn, p.jp) }}</button>
      </div>
      <p class="dim small mt">{{ bi(pattern.desc.cn, pattern.desc.jp) }}</p>

      <div class="tb-ring">
        <svg viewBox="0 0 140 140" class="tb-svg" aria-hidden="true">
          <circle cx="70" cy="70" r="58" class="tb-ring-track"></circle>
          <circle cx="70" cy="70" r="58" class="tb-ring-fill"
            :style="{strokeDasharray: RING.toFixed(2), strokeDashoffset: dashOffset}"></circle>
        </svg>
        <div class="tb-ring-in">
          <div class="tb-phase" id="tbBreathPhase">{{ running ? phaseName : t('tbBreathReady') }}</div>
          <div class="tb-count" id="tbBreathCount">{{ running ? at.remain : cycle.total }}</div>
          <div class="tb-level">{{ running ? levelName : cycle.total + ' ' + t('tbBreathSec') }}</div>
        </div>
      </div>

      <p class="center dim small">
        <span class="tb-round-lab">{{ t('tbBreathRound') }}</span>
        <b id="tbBreathRound">{{ roundsSeen }}</b>
        <span>{{ t('tbBreathUnit') }}</span>
      </p>
      <div class="center mt">
        <button v-if="!running" type="button" class="btn small" id="tbBreathStart" @click="startBreath">{{ t('tbBreathStart') }}</button>
        <button v-else type="button" class="btn ghost small" id="tbBreathStop" @click="stopBreath">{{ t('tbBreathStop') }}</button>
      </div>
      <p class="hint center" id="tbBreathMsg">{{ breathMsg }}</p>
      <p class="dim small mt">{{ bi(
        '不用做到完美。走神了就回到数字上，从 1 重新数。停下来的那一刻会自动记进档案。',
        '完璧じゃなくていい。気が逸れたら数字に戻って、1から数え直す。止めた時点で档案に残る。'
      ) }}</p>
    </div>
  </div>

  <!-- ============ 三、念头记录 ============ -->
  <div v-show="tab === 'thought'" class="panel" id="tbThoughtPanel">
    <div class="p-head">
      <h2>{{ t('tbThoughtTab') }}</h2>
      <span class="p-en">THOUGHT RECORD</span>
      <span class="p-note">{{ thoughtCount }}</span>
    </div>
    <div class="p-body">
      <p class="dim small">{{ t('tbThoughtIntro') }}</p>
      <button type="button" class="btn ghost mini mt" id="tbThSampleBtn" @click="thSample = !thSample">
        {{ thSample ? t('tbThSampleHide') : t('tbThSample') }}
      </button>
      <p v-if="thSample" class="tb-sample" id="tbThSample">{{ bi(C.thought.sample.cn, C.thought.sample.jp) }}</p>

      <div v-for="f in C.thought.fields" :key="f.k" class="tb-f">
        <label class="tb-f-l" :for="'tbTh-' + f.k">
          {{ bi(f.cn, f.jp) }}
          <span v-if="!f.must" class="tb-opt">{{ t('tbOptional') }}</span>
        </label>
        <textarea :id="'tbTh-' + f.k" v-model="form[f.k]" rows="2" :placeholder="bi(f.ph.cn, f.ph.jp)"></textarea>
      </div>

      <div class="mt">
        <button type="button" class="btn small" id="tbThSave" @click="saveThought">{{ t('tbThSave') }}</button>
        <span class="tb-msg" id="tbThMsg">{{ thMsg }}</span>
      </div>
      <p class="hint">{{ t('tbThNote') }}</p>

      <template v-if="thoughtCount">
        <hr class="rule">
        <p class="tb-lab">{{ t('tbThList') }}</p>
        <ul class="tb-list" id="tbThList">
          <li v-for="r in snap.thoughts.slice().reverse()" :key="r.id" class="tb-item">
            <div class="tb-item-head">
              <span class="dim small">{{ fmt(r.at) }}</span>
              <button type="button" class="tb-del" :data-del="r.id" @click="delThought(r.id)">{{ t('tbThDel') }}</button>
            </div>
            <p class="tb-item-scene">{{ r.scene }}</p>
            <p class="tb-item-thought">{{ r.thought }}</p>
            <p v-if="r.alt" class="tb-item-alt">{{ t('tbThAlt') }}{{ r.alt }}</p>
          </li>
        </ul>
      </template>
    </div>
  </div>

  <p class="dim small center">{{ bi(
    '这里记下的东西都留在这台机器的浏览器里，不会上传。它不替你下判断，只是把线头一根根摆出来。',
    'ここに書いたものは端末のブラウザ内に残る。送信はしない。判断はしない、糸口を並べるだけ。'
  ) }}</p>
</template>

<style scoped>
/* 读数 */
.tb-readout { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.tb-ro { text-align: center; padding: 6px 2px; border: 1px solid var(--line-soft); }
.tb-ro-n { display: block; font-size: 20px; color: var(--amber); line-height: 1.2; }
.tb-ro-l { display: block; font-size: 10px; color: var(--text-faint); margin-top: 3px; letter-spacing: .08em; }

/* 标签页 */
.tb-tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.tb-tab { display: flex; align-items: center; gap: 8px; padding: 10px 10px; border: 1px solid var(--line);
  background: transparent; color: var(--text-dim); font: inherit; font-size: 12px; cursor: pointer; text-align: left; }
.tb-tab:hover { color: var(--amber); border-color: var(--amber-dim); }
.tb-tab.on { color: var(--amber); border-color: var(--amber); background: rgba(232,163,61,.08); box-shadow: inset 0 -2px 0 var(--amber); }
.tb-tab-m { flex: 0 0 auto; width: 22px; height: 22px; line-height: 20px; text-align: center; border: 1px solid currentColor; border-radius: 50%; font-size: 11px; }
.tb-tab-t { flex: 1; }

/* 桥接 */
.tb-bridge { border-color: var(--amber-dim); background: rgba(232,163,61,.05); }
.tb-bridge-txt { font-size: 13px; line-height: 1.7; }

/* 情绪 */
.tb-ask { font-size: 13px; margin: 0 0 10px; }
.tb-scores { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
.tb-score { padding: 10px 2px; border: 1px solid var(--line); background: transparent; color: var(--text-dim);
  font: inherit; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 3px; }
.tb-score:hover { border-color: var(--amber-dim); color: var(--amber); }
.tb-score.on { color: #1a120a; background: var(--amber); border-color: var(--amber); font-weight: bold; }
.tb-score-n { font-size: 15px; }
.tb-score-w { font-size: 10px; }
.tb-line { margin: 10px 0 0; font-size: 13px; color: var(--amber); text-align: center; }
.tb-lab { font-size: 11px; color: var(--text-faint); letter-spacing: .1em; margin: 0 0 8px; }
.tb-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.tb-tag { font-size: 11px; }
.tb-msg { font-size: 11px; color: var(--amber); margin-left: 10px; }

/* 机器读你（情绪打卡 AI 洞察） */
.tb-machine { margin-top: 16px; border: 1px solid var(--amber-dim); border-radius: 10px; padding: 12px 14px; background: rgba(232,163,61,.05); }
.tb-machine-h { font-size: 11px; letter-spacing: .12em; color: var(--amber); margin: 0 0 6px; }
.tb-machine-t { font-size: 13px; line-height: 1.75; margin: 0; }
.tb-machine-off { margin-top: 14px; font-size: 12px; color: var(--text-faint); line-height: 1.7; }
.tb-machine-off a { color: var(--amber-dim); }
.tb-chart-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 8px; }
.tb-chart { display: flex; align-items: flex-end; gap: 3px; height: 100px; padding-top: 4px; border-bottom: 1px solid var(--line-soft); }
.tb-col { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; height: 100%; gap: 4px; }
.tb-bar { display: block; width: 100%; background: var(--amber-dim); }
.tb-col.today .tb-bar { background: var(--amber); }
.tb-col.blank .tb-bar { background: var(--line); }
.tb-col-d { font-size: 9px; color: var(--text-faint); line-height: 1; }

/* 呼吸 */
.tb-pats { display: flex; flex-wrap: wrap; gap: 6px; }
.tb-ring { position: relative; width: 180px; height: 180px; margin: 16px auto 8px; }
.tb-svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.tb-ring-track { fill: none; stroke: var(--line); stroke-width: 3; }
.tb-ring-fill { fill: none; stroke: var(--amber); stroke-width: 4; stroke-linecap: round; transition: stroke-dashoffset .12s linear; }
.tb-ring-in { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; }
.tb-phase { font-size: 15px; color: var(--amber); letter-spacing: .1em; }
.tb-count { font-size: 34px; line-height: 1; }
.tb-level { font-size: 10px; color: var(--text-faint); }
.tb-round-lab { margin-right: 4px; }

/* 念头 */
.tb-f { margin-top: 12px; }
.tb-f-l { display: block; font-size: 12px; margin-bottom: 4px; }
.tb-opt { font-size: 10px; color: var(--text-faint); margin-left: 6px; }
.tb-sample { font-size: 11px; color: var(--text-faint); line-height: 1.7; margin: 8px 0 0; padding: 8px 10px; border-left: 2px solid var(--line); }
.tb-list { list-style: none; margin: 0; padding: 0; }
.tb-item { border-top: 1px solid var(--line-soft); padding: 10px 0; }
.tb-item-head { display: flex; align-items: baseline; justify-content: space-between; }
.tb-del { background: none; border: 0; color: var(--text-faint); font: inherit; font-size: 10px; cursor: pointer; padding: 0; }
.tb-del:hover { color: var(--crimson, #b4453a); }
.tb-item-scene { font-size: 12px; color: var(--text-dim); margin: 6px 0 2px; }
.tb-item-thought { font-size: 13px; margin: 0; }
.tb-item-alt { font-size: 12px; color: var(--amber-dim); margin: 4px 0 0; }

@media (max-width: 520px) {
  .tb-readout { grid-template-columns: repeat(2, 1fr); }
  .tb-tabs { grid-template-columns: 1fr; }
  .tb-scores { grid-template-columns: repeat(5, 1fr); gap: 3px; }
  .tb-score-w { font-size: 9px; }
  .tb-ring { width: 150px; height: 150px; }
}
</style>
