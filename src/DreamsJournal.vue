<script setup lang="ts">
/* ============================================================
   DreamsJournal.vue — 梦境档案（Phase 2：由 dreams.js 迁移而来）

   本机记录：日期 / 标题 / 正文 / 醒来时的感觉 / 反复出现的意象。
   每条可以「带去会诊」，直接写进委托档案的「最近反复做的梦」。
   存储键仍是 dreamLog（demo / regulars / stamps 都在读它）。
   ============================================================ */
import {ref, computed} from 'vue';
import {rc} from './legacy';

const KEY = 'dreamLog';
const MOODS = [
  { k: 'calm', cn: '还好', jp: 'まあまあ' },
  { k: 'tired', cn: '疲惫', jp: '疲れ' },
  { k: 'angry', cn: '生气', jp: '怒り' },
  { k: 'miss', cn: '想念', jp: '会いたい' },
  { k: 'awake', cn: '睡不着', jp: '眠れない' },
  { k: 'lost', cn: '迷路', jp: '迷い' }
];

interface Entry { id: string; date: string; title: string; body: string; mood: string; tag: string; ts: number }

const lang = ref(rc.i18n.lang());
rc.i18n.onChange(() => { lang.value = rc.i18n.lang(); });
const t = (key: string) => { void lang.value; return rc.i18n.t(key); };

const list = ref<Entry[]>([]);
const msg = ref('');
const form = ref({ date: todayStr(), mood: MOODS[0].cn, tag: '', title: '', body: '' });

function todayStr(): string {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function moodLabel(v: string) {
  return MOODS.find((m) => m.cn === v || m.k === v) || { k: v, cn: v, jp: v };
}

function load(): Entry[] {
  const raw = rc.store.get<unknown>(KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((d) => d && typeof d === 'object')
    .map((d: any) => ({
      id: String(d.id || ('d-' + Math.random().toString(36).slice(2, 9))),
      date: /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : new Date(d.ts || Date.now()).toISOString().slice(0, 10),
      title: String(d.title || '').slice(0, 60),
      body: String(d.body || '').slice(0, 2000),
      mood: String(d.mood || '').slice(0, 20),
      tag: String(d.tag || '').slice(0, 40),
      ts: Number(d.ts) || Date.parse(d.date) || Date.now()
    }))
    .sort((a, b) => b.ts - a.ts);
}

function persist(): void { rc.store.set(KEY, list.value.slice(0, 200)); }
function refresh(): void { list.value = load(); }

const today = todayStr();
const countText = computed(() => list.value.length + ' ' + t('dreamCount'));

function submit(): void {
  const body = form.value.body.trim();
  if (!body) return;
  list.value.unshift({
    id: 'd-' + Date.now().toString(36),
    date: form.value.date || todayStr(),
    title: form.value.title.trim(),
    body,
    mood: form.value.mood,
    tag: form.value.tag.trim(),
    ts: Date.now()
  });
  persist();
  refresh();
  form.value.title = ''; form.value.body = ''; form.value.tag = '';
  msg.value = t('dreamSaved');
  rc.stamps?.check?.();
}

function take(id: string): void {
  const d = list.value.find((x) => x.id === id);
  if (!d) return;
  rc.case.save!({ dream: d.body });
  location.href = 'psyche.html';
}

function remove(id: string): void {
  list.value = list.value.filter((x) => x.id !== id);
  persist();
  refresh();
  msg.value = t('dreamDeleted');
}

refresh();
</script>

<template>
  <div class="panel">
    <div class="p-head">
      <h2><span class="i18n-cn">{{ t('dreamTitle') }}</span><span class="i18n-jp">{{ t('dreamTitle') }}</span></h2>
      <span class="p-en">DREAM LOG</span>
      <span class="p-note"><span class="i18n-cn">{{ t('dreamSub') }}</span><span class="i18n-jp">{{ t('dreamSub') }}</span></span>
    </div>
    <div class="p-body">
      <p class="dim"><span class="i18n-cn">只存在这台设备上，不会上传。醒来还记得的三句就够，写不下就写「记不清了」。</span><span class="i18n-jp">この端末の中だけ。アップロードしない。起きて覚えている三行でいい。</span></p>
      <hr class="rule">

      <form id="dreamForm" class="dream-form" @submit.prevent="submit">
        <div class="df-row">
          <label for="dDate"><span class="i18n-cn">{{ t('dreamDate') }}</span><span class="i18n-jp">{{ t('dreamDate') }}</span>
            <input type="date" id="dDate" v-model="form.date"></label>
          <label for="dMood"><span class="i18n-cn">{{ t('dreamMood') }}</span><span class="i18n-jp">{{ t('dreamMood') }}</span>
            <select id="dMood" v-model="form.mood">
              <option v-for="m in MOODS" :key="m.k" :value="m.cn">{{ m.cn }}</option>
            </select></label>
          <label for="dTag"><span class="i18n-cn">{{ t('dreamTag') }}</span><span class="i18n-jp">{{ t('dreamTag') }}</span>
            <input type="text" id="dTag" maxlength="40" placeholder="电梯／水／追赶…" v-model="form.tag"></label>
        </div>
        <label for="dTitle"><span class="i18n-cn">给它起个名字</span><span class="i18n-jp">タイトル</span>
          <input type="text" id="dTitle" maxlength="60" placeholder="电梯第一次出现" v-model="form.title"></label>
        <label for="dBody"><span class="i18n-cn">{{ t('dreamBody') }}</span><span class="i18n-jp">{{ t('dreamBody') }}</span>
          <textarea id="dBody" rows="4" maxlength="2000" placeholder="片段也可以。记不清就写记不清。" v-model="form.body"></textarea></label>
        <div class="center">
          <button type="submit" class="btn"><span class="i18n-cn">{{ t('dreamSave') }}</span><span class="i18n-jp">{{ t('dreamSave') }}</span></button>
        </div>
      </form>
      <p class="hint center" id="dreamMsg" role="status" aria-live="polite">{{ msg }}</p>
    </div>
  </div>

  <div class="panel">
    <div class="p-head">
      <h2><span class="i18n-cn">时间线</span><span class="i18n-jp">タイムライン</span></h2>
      <span class="p-en">TIMELINE</span>
      <span class="p-note" id="dreamCount">{{ countText }}</span>
    </div>
    <div class="p-body">
      <div id="dreamMount">
        <p v-if="!list.length" class="dim center">{{ t('dreamEmpty') }}</p>
        <div v-else class="tl">
          <div v-for="d in list" :key="d.id" class="tl-item" :class="{today: d.date === today}">
            <div class="tl-date">{{ d.date }}<template v-if="d.date === today"> · {{ t('justNow') }}</template></div>
            <div v-if="d.title" class="tl-title">{{ d.title }}</div>
            <div class="tl-body">{{ d.body }}</div>
            <div class="tl-meta">
              <span v-if="d.mood"><span class="i18n-cn">{{ moodLabel(d.mood).cn }}</span><span class="i18n-jp">{{ moodLabel(d.mood).jp }}</span></span>
              <span v-if="d.tag" class="tagx">＃{{ d.tag }}</span>
              <button type="button" @click="take(d.id)">{{ t('dreamTake') }}</button>
              <button type="button" @click="remove(d.id)">×</button>
            </div>
          </div>
        </div>
      </div>
      <div class="center mt">
        <a class="btn ghost" href="psyche.html"><span class="i18n-cn">去做会诊 →</span><span class="i18n-jp">診断へ →</span></a>
        <a class="btn ghost" href="order.html"><span class="i18n-cn">写进委托 →</span><span class="i18n-jp">ご用件へ →</span></a>
      </div>
    </div>
  </div>
</template>
