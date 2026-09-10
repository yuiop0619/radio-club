<script setup lang="ts">
/* ============================================================
   PsychePage.vue — 精神分析（Phase 2：由 psyche-page.js 迁移而来）

   三块：
     A 解梦智能体（七大师会诊）—— 交互仍由 analyst.js 负责，
       它的 init 在 DOMContentLoaded 时找不到挂载点，故这里挂载后补调一次；
     B 词语联想 ×12 —— 记录反应时间与失焦中断；
     C 句子完成测试 ×6。
   ============================================================ */
import {ref, nextTick, onMounted} from 'vue';
import {rc} from './legacy';

const introMount = ref<HTMLElement | null>(null);
const lang = ref(rc.i18n.lang());
rc.i18n.onChange(() => { lang.value = rc.i18n.lang(); });
const t = (key: string) => { void lang.value; return rc.i18n.t(key); };

/* ---------- B · 词语联想（12 词，含红辣椒意象） ---------- */
const STIM = [
  { cn: '镜', jp: '鏡' }, { cn: '母亲', jp: '母' }, { cn: '夜', jp: '夜' },
  { cn: '钥匙', jp: '鍵' }, { cn: '名字', jp: '名' }, { cn: '楼梯', jp: '階段' },
  { cn: '电梯', jp: 'エレベーター' }, { cn: '17', jp: '17' }, { cn: '戏', jp: '芝居' },
  { cn: '面具', jp: '仮面' }, { cn: '醒', jp: '覚' }, { cn: '烟', jp: '煙' }
];

const assocStarted = ref(false);
const assocInputEl = ref<HTMLInputElement | null>(null);
const assocInput = ref('');
const stimText = ref('―');
const stimBi = ref('');
const prog = ref('');
const assocFinished = ref(false);
const assocRows = ref<any[]>([]);
const assocSummary = ref('');

let ai = -1, t0 = 0, rows: any[] = [], interrupted = false;

function renderStim(n: number) {
  stimText.value = rc.i18n.of!(STIM[n]);
  stimBi.value = '<span class="i18n-cn">' + STIM[n].cn + '</span><span class="i18n-jp">' + STIM[n].jp + '</span>';
}
rc.i18n.onChange(() => { if (ai >= 0 && ai < STIM.length) renderStim(ai); });

function nextStim() {
  ai++;
  if (ai >= STIM.length) { finishAssoc(); return; }
  rows.push(null);
  renderStim(ai);
  assocInput.value = '';
  nextTick(() => assocInputEl.value?.focus());
  t0 = performance.now(); interrupted = false;
  prog.value = (ai + 1) + ' / ' + STIM.length;
}

function startAssoc() { assocStarted.value = true; assocInput.value = ''; nextStim(); }

function submitAssoc() {
  if (ai < 0 || ai >= STIM.length) return;
  const ms = Math.round(performance.now() - t0);
  rows[ai] = { stim: STIM[ai], resp: assocInput.value.trim(), ms, interrupted };
  nextStim();
}

function onAssocKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && !(e as any).isComposing && (e as any).keyCode !== 229) { e.preventDefault(); submitAssoc(); }
}

function finishAssoc() {
  if (!rc.case.save!({ assoc: rows })) { assocStarted.value = false; return; }
  const prof = (rc.engine as any).assocProfile(rc.case.get());
  assocRows.value = prof.rows; assocSummary.value = prof.summary;
  assocFinished.value = true;
}

/* ---------- C · 句子完成测试（SCT ×6） ---------- */
const SCT_CN: [string, string][] = [
  ['今天如果不去想 _______，我大概会 _______。', 'もし今日 _______ を考えなければ、おそらく _______。'],
  ['已经 _______ 这件事 _______ 了我很久。', 'もうずっと _______ ことが、私を _______ させている。'],
  ['如果可以回到 _______，我会对 _______ 说 _______。', 'もし _______ に戻れるなら、_______ に _______ と言うだろう。'],
  ['我反复做的那个梦，结尾总是 _______。', '何度も見る夢の最後には、いつも _______。'],
  ['没人知道的是，我 _______。', '誰も知らないのは、私が _______。'],
  ['再过十年，我会 _______。', '十年後、私は _______。']
];

const sctDrafts = ref<string[]>(SCT_CN.map(() => ''));
const sctMsg = ref('');
const sctMsgTone = ref<'red' | 'amber'>('amber');

function loadSct() {
  const saved = (rc.case.get() as any).sct || [];
  sctDrafts.value = SCT_CN.map((_, i) => (saved[i] && saved[i].a) || '');
}

function submitSct() {
  const ans = SCT_CN.map((pair, i) => ({ i, qCn: pair[0], qJp: pair[1], a: (sctDrafts.value[i] || '').trim() }));
  const filled = ans.filter((x) => x.a).length;
  if (filled === 0) { sctMsgTone.value = 'red'; sctMsg.value = t('sctNone'); return; }
  if (!rc.case.save!({ sct: ans })) return;
  sctMsgTone.value = 'amber';
  sctMsg.value = t('sctSaved') + ' ' + filled + ' / ' + SCT_CN.length;
}

loadSct();
document.addEventListener('visibilitychange', () => { if (document.hidden) interrupted = true; });
window.addEventListener('blur', () => { interrupted = true; });

/* ---------- 挂载 ---------- */
onMounted(() => {
  rc.ui.dialog({
    who: { cn: '萨弗兰', jp: 'サフラン' }, jp: { cn: '梦侦探', jp: '夢探偵' },
    mount: introMount.value,
    text: '接下来三项没有对错。解梦会诊看的是"你反复梦见什么"，联想测的是"哪个词会让你卡住"，句子完成测的是"你通常怎么把一件事说完"。卡住的地方，就是我们要去的地方。',
    speed: 26
  });
  nextTick(() => {
    rc.i18n.apply?.(document);
    /* analyst.js 的 init 在 DOMContentLoaded 时找不到 #masterGrid（Vue 挂载更晚） */
    (rc.analyst as unknown as { init?: () => void }).init?.();
  });
});
</script>

<template>
  <div ref="introMount" id="introMount"></div>

  <!-- A · 解梦智能体：七大师会诊 -->
  <div class="panel">
    <div class="p-head">
      <h2><span class="i18n-cn">解梦智能体</span><span class="i18n-jp">夢解きエージェント</span></h2>
      <span class="p-en">DREAM ANALYST ×7</span>
      <span class="p-note"><span class="i18n-cn">选一位大师，讲一个梦，领一张卡</span><span class="i18n-jp">大師を一人選び、夢を語り、カードを受け取る</span></span>
    </div>
    <div class="p-body">
      <div id="masterGrid" class="mgrid"></div>
      <div id="analystChat" class="achat hidden">
        <div class="achat-head">
          <span id="chatWho" class="chat-who"></span>
          <button type="button" class="btn ghost" id="btnMasterBack"><span class="i18n-cn">← 换一位</span><span class="i18n-jp">← 替える</span></button>
        </div>
        <div id="chatLog" class="chat-log"></div>
        <div class="chat-input">
          <label for="chatIn">梦的内容 / 夢の内容</label>
          <textarea id="chatIn" maxlength="2000" rows="2" placeholder="把你记得的梦写在这里……"></textarea>
          <div class="chat-btns">
            <button type="button" class="btn" id="btnSend"><span class="i18n-cn">讲给大师</span><span class="i18n-jp">大師に語る</span></button>
            <button type="button" class="btn" id="btnCard"><span class="i18n-cn">领成就卡</span><span class="i18n-jp">カード受取</span></button>
          </div>
        </div>
        <div class="hint center" id="analystMsg"></div>
        <div id="cardBox" class="center mt"></div>
      </div>
    </div>
  </div>

  <!-- B · 词语联想 -->
  <div class="panel">
    <div class="p-head">
      <h2><span class="i18n-cn">词语联想测试</span><span class="i18n-jp">単語連想テスト</span></h2>
      <span class="p-en">WORD ASSOCIATION ×12</span>
      <span class="p-note"><span class="i18n-cn">会记录你的反应时间</span><span class="i18n-jp">反応潜時も記録します</span></span>
    </div>
    <div class="p-body">
      <div id="assocBox" class="center" :class="{hidden: assocFinished}">
        <div class="dim small" data-i18n="stimWord">刺激词</div>
        <div id="stim" class="logo" style="font-size:48px;margin:8px 0">{{ stimText }}</div>
        <div class="hint mb" id="stimBilingual" v-html="stimBi"></div>
        <div style="max-width:340px;margin:0 auto">
          <input
            ref="assocInputEl" type="text" id="assocInput" aria-label="联想回答 / 連想の回答" aria-describedby="stim"
            maxlength="200" data-i18n-ph="bodyPh2" placeholder="今夜想说、又说不出口的那句"
            :disabled="!assocStarted" v-model="assocInput" @keydown="onAssocKey">
        </div>
        <div class="mt">
          <button :class="{hidden: assocStarted}" type="button" class="btn" id="btnAssocStart" data-i18n="startTest" @click="startAssoc">开始测试</button>
          <button :class="{hidden: !assocStarted}" type="button" class="btn ghost" id="btnAssocNext" data-i18n="submit" @click="submitAssoc">提交</button>
        </div>
        <div class="hint" id="assocProg">{{ prog }}</div>
      </div>
      <div id="assocResult" :class="{hidden: !assocFinished}">
        <table class="grid" id="assocTable">
          <tr v-for="(r, i) in assocRows" :key="i">
            <th>{{ r.stimCn === r.stimJp ? r.stimCn : (r.stimCn + '／' + r.stimJp) }}</th>
            <td><template v-if="r.resp">{{ r.resp }}</template><span v-else class="faint">（未答）</span></td>
            <td class="mono">{{ (r.ms / 1000).toFixed(1) }}s</td>
            <td><span v-if="r.note" class="amber">{{ r.note }}</span><span v-else class="faint">―</span></td>
          </tr>
        </table>
        <div id="assocSumm" class="mt dim">{{ assocSummary }}</div>
        <div class="center mt">
          <a class="btn" href="verdict.html" data-i18n="toVerdict">领取鉴定书 →</a>
        </div>
      </div>
    </div>
  </div>

  <!-- C · 句子完成测试 -->
  <div class="panel">
    <div class="p-head">
      <h2><span data-i18n="sctTitle">句子完成测试</span></h2>
      <span class="p-en">SCT ×6</span>
      <span class="p-note" data-i18n="sctSub">句子没有对错；写下脑子里冒出来的第一个答案</span>
    </div>
    <div class="p-body">
      <div id="sctList">
        <div class="sct-row" v-for="(pair, i) in SCT_CN" :key="i">
          <label class="sct-q" :for="'sct-' + i">
            <span class="i18n-cn">{{ pair[0] }}</span>
            <span class="i18n-jp">{{ pair[1] }}</span>
          </label>
          <textarea class="sct-a" :id="'sct-' + i" maxlength="1000" :data-i="i" rows="1" placeholder="—" v-model="sctDrafts[i]"></textarea>
        </div>
      </div>
      <div class="center mt">
        <button type="button" class="btn" id="btnSct" data-i18n="sctSave" @click="submitSct">记录并提交</button>
      </div>
      <div class="hint center" id="sctMsg"><span :class="sctMsgTone" v-if="sctMsg">※ {{ sctMsg }}</span></div>
    </div>
  </div>
</template>
