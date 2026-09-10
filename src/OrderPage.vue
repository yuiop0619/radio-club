<script setup lang="ts">
/* ============================================================
   OrderPage.vue — 委托受理（Phase 2：由 order-page.js 迁移而来）

   表单语义与原来一致：
     · 校验失败只提示、不清空
     · 保存失败（配额满等）时表单保持可见、输入原样保留（store.js 会
       自动挂出 #storageError），不显示成功
     · 成功后才隐藏表单，并让萨弗兰把下一步念出来
   ============================================================ */
import {ref, nextTick, onMounted} from 'vue';
import {rc} from './legacy';

const introMount = ref<HTMLElement | null>(null);
const doneMount = ref<HTMLElement | null>(null);
const lang = ref(rc.i18n.lang());
rc.i18n.onChange(() => { lang.value = rc.i18n.lang(); });
const t = (key: string) => { void lang.value; return rc.i18n.t(key); };

/* 值 / 文案：注意几个词的 data-v 与显示文案不同 */
const CATS: [string, string][] = [
  ['人际关系', '人际关系'], ['工作', '工作'], ['恋爱', '恋爱'],
  ['丧失', '丧失／离别'], ['记忆', '记忆／遗忘'], ['自我', '自我／身份'], ['其他', '其他']
];
const FREQS: [string, string][] = [
  ['每夜', '每夜'], ['每周数次', '每周数次'], ['偶尔', '偶尔'], ['几乎不做', '几乎不做']
];
const PARS: [string, string][] = [['1', '有过'], ['0', '没有']];

const started = new URLSearchParams(location.search).get('new') === '1';
const savedCase: any = started ? rc.model.normalize({}) : rc.case.get();

const mode = ref(started ? 'new' : 'edit');
const category = ref<string>(savedCase.category || '');
const dreamFreq = ref<string>(savedCase.dreamFreq || '');
const paralysis = ref<boolean>(!!savedCase.paralysis);
const form = ref({
  handle: savedCase.handle || '',
  age: savedCase.age || '',
  birth: savedCase.birth || '',
  story: savedCase.story || '',
  dream: savedCase.dream || '',
  recurring: savedCase.recurring || ''
});
const msg = ref('');
const msgTone = ref<'red' | 'plain'>('plain');
const done = ref(false);

function readArchive(): any[] {
  const a = rc.store.get<unknown>('caseHistory', []);
  return Array.isArray(a) ? a : [];
}
const archive = ref<any[]>(readArchive());
const historyIndex = ref('');

function chipOn(value: string, current: string) { return value === current; }

function clearAll() {
  form.value = { handle: '', age: '', birth: '', story: '', dream: '', recurring: '' };
  category.value = ''; dreamFreq.value = ''; paralysis.value = false;
  msg.value = '';
}

function restore() {
  if (historyIndex.value === '') return;
  const target = archive.value[Number(historyIndex.value)];
  if (rc.case.start?.(target)) {
    rc.case.save!(target);
    location.href = 'order.html';
  }
}

function submit() {
  const handle = form.value.handle.trim();
  const story = form.value.story.trim();
  if (!handle) { msgTone.value = 'red'; msg.value = '※ 总得让我知道怎么称呼你。'; return; }
  if (!category.value) { msgTone.value = 'red'; msg.value = '※ 选一个类别，哪怕选"其他"。'; return; }
  if (story.length < 8) { msgTone.value = 'red'; msg.value = '※ 再多写一点。一句话也行，但得是一句完整的话。'; return; }

  const patch = {
    handle,
    age: form.value.age,
    birth: form.value.birth,
    category: category.value,
    story,
    dream: form.value.dream.trim(),
    dreamFreq: dreamFreq.value,
    paralysis: !!paralysis.value,
    recurring: form.value.recurring.trim()
  };

  const issue = rc.model.formError?.(patch);
  if (issue) { msgTone.value = 'plain'; msg.value = issue; return; }

  const saved = mode.value === 'new' ? rc.case.start?.(patch) : rc.case.save!(patch);
  if (!saved) return;                                  /* 失败：保留表单与输入 */

  done.value = true;
  nextTick(() => {
    rc.ui.dialog({
      who: { cn: '萨弗兰', jp: 'サフラン' }, jp: { cn: '梦侦探', jp: '夢探偵' },
      mount: doneMount.value,
      text: '收到了，' + handle + '。我先读完，你别急。……读完了。下一步，去抽牌。牌会替你说那些你还没准备好亲口说的部分。',
      speed: 26,
      done: () => {
        doneMount.value?.insertAdjacentHTML('beforeend',
          '<div class="center mt"><a class="btn" href="tarot.html">去抽牌 →</a> ' +
          '<a class="btn ghost" href="psyche.html">先做分析 →</a></div>');
      }
    });
  });
}

onMounted(() => {
  rc.ui.dialog({
    who: { cn: '萨弗兰', jp: 'サフラン' }, jp: { cn: '梦侦探', jp: '夢探偵' },
    mount: introMount.value,
    text: '点单不用写得漂亮。你负责把事实倒出来，我负责把它们摆整齐。写不下去的地方就空着——空着本身也是信息。',
    speed: 26
  });
  nextTick(() => rc.i18n.apply?.(document));
});
</script>

<template>
  <div ref="introMount" id="introMount"></div>

  <p class="hint">编辑保留当前测试；新委托归档当前记录（最多保留五份）并开始新测试。 / 新規依頼は新しいテストを開始します。</p>
  <label for="caseMode">处理方式 / モード</label>
  <select id="caseMode" v-model="mode">
    <option value="edit">编辑当前委托 / 編集</option>
    <option value="new">新建委托 / 新規</option>
  </select>
  <label for="caseHistory">恢复历史委托 / 履歴</label>
  <select id="caseHistory" v-model="historyIndex">
    <option value="">选择记录 / 選択</option>
    <option v-for="(c, i) in archive" :key="i" :value="String(i)">
      {{ (c.handle || '客人') + ' / ' + new Date(c.createdAt).toLocaleDateString() }}
    </option>
  </select>
  <button type="button" id="restoreCase" class="btn ghost" @click="restore">恢复 / 復元</button>

  <form id="orderForm" autocomplete="off" :class="{hidden: done}" @submit.prevent="submit">
    <div class="panel">
      <div class="p-head">
        <h2><span class="i18n-cn">委托受理</span><span class="i18n-jp">ご用件承り</span></h2>
        <span class="p-en">ORDER</span>
        <span class="p-note">※ 带 * 为必填</span>
      </div>
      <div class="p-body">

        <div class="row">
          <div class="field">
            <label class="f" for="fHandle">怎么称呼你 <span class="req">*</span></label>
            <input type="text" id="fHandle" maxlength="60" placeholder="真名或昵称都行" v-model="form.handle">
          </div>
          <div class="field">
            <label class="f" for="fAge">年龄段</label>
            <select id="fAge" v-model="form.age">
              <option value="">（不说也行）</option>
              <option>十几岁</option><option>二十几岁</option><option>三十几岁</option><option>四十几岁</option><option>五十岁以上</option>
            </select>
          </div>
          <div class="field">
            <label class="f" for="fBirth">生日</label>
            <input type="date" id="fBirth" v-model="form.birth">
            <div class="hint">用于数秘与本命牌，可留空</div>
          </div>
        </div>

        <div class="field">
          <span class="f" id="categoryLabel">这件事属于哪一类 <span class="req">*</span></span>
          <div class="radio-row" id="catRow" role="group" aria-labelledby="categoryLabel">
            <button
              v-for="[v, label] in CATS" :key="v" type="button" class="chip"
              :class="{on: chipOn(v, category)}" :data-v="v" :aria-pressed="chipOn(v, category)"
              @click="category = v">{{ label }}</button>
          </div>
        </div>

        <div class="field">
          <label class="f" for="fStory">把这件事讲给我听 <span class="req">*</span></label>
          <textarea id="fStory" maxlength="4000" placeholder="想到什么写什么，不用组织语言。越乱越好，乱的地方就是线头。" v-model="form.story"></textarea>
          <div class="hint" id="storyHint">至少写一句话。她真的会逐字读。</div>
        </div>

        <div class="field">
          <label class="f" for="fDream">最近反复做的梦</label>
          <textarea id="fDream" maxlength="4000" style="min-height:64px" placeholder="片段也可以。记不清就写记不清。" v-model="form.dream"></textarea>
        </div>

        <div class="row">
          <div class="field">
            <span class="f" id="frequencyLabel">做梦的频率</span>
            <div class="radio-row" id="freqRow" role="group" aria-labelledby="frequencyLabel">
              <button
                v-for="[v, label] in FREQS" :key="v" type="button" class="chip"
                :class="{on: chipOn(v, dreamFreq)}" :data-v="v" :aria-pressed="chipOn(v, dreamFreq)"
                @click="dreamFreq = v">{{ label }}</button>
            </div>
          </div>
          <div class="field">
            <span class="f" id="paralysisLabel">是否有过"醒着但动不了"的经历</span>
            <div class="radio-row" id="parRow" role="group" aria-labelledby="paralysisLabel">
              <button
                v-for="[v, label] in PARS" :key="v" type="button" class="chip"
                :class="{on: (v === '1') === paralysis}" :data-v="v" :aria-pressed="(v === '1') === paralysis"
                @click="paralysis = v === '1'">{{ label }}</button>
            </div>
          </div>
        </div>

        <div class="field">
          <label class="f" for="fRecurring">最近反复想起的一句话或一个画面</label>
          <input type="text" id="fRecurring" maxlength="500" placeholder="例如：某人说过的某句话 / 某个走廊 / 某扇关不上的门" v-model="form.recurring">
        </div>

        <div class="center mt">
          <button type="submit" class="btn red" data-i18n="submitOrder">交给吧台</button>
          <button type="button" class="btn ghost" id="btnClear" data-i18n="rewrite" @click="clearAll">重写</button>
        </div>
        <div class="hint center" id="formMsg"><span v-if="msg" :class="msgTone === 'red' ? 'red' : ''">{{ msg }}</span></div>

      </div>
    </div>
  </form>

  <div ref="doneMount" id="doneMount" :class="{hidden: !done}"></div>
</template>
