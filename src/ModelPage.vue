<script setup lang="ts">
/* ============================================================
   ModelPage.vue — 模型管理（BYOK，Phase 7 大改地基）
   ------------------------------------------------------------
   用户在此接入自己的 OpenAI 兼容模型。配置只存浏览器本地，
   不进本店服务器。各功能页据此决定是否调用「真大脑」。
   ============================================================ */
import {ref, reactive, computed, onMounted} from 'vue';
import {rc} from './legacy';

const lang = ref(rc.i18n.lang());
rc.i18n.onChange(() => { lang.value = rc.i18n.lang(); });
const t = (k: string) => { void lang.value; return rc.i18n.t(k); };

const PRESETS: Record<string, {base: string; model: string; label: string}> = {
  deepseek: { base: 'https://api.deepseek.com/v1', model: 'deepseek-chat', label: 'DeepSeek' },
  openai:   { base: 'https://api.openai.com/v1',   model: 'gpt-4o-mini',  label: 'OpenAI' },
  qwen:     { base: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', label: '通义千问' },
  ollama:   { base: 'http://127.0.0.1:11434/v1',  model: 'qwen2.5:7b-instruct', label: 'Ollama 本地' },
  custom:   { base: '', model: '', label: '自定义' }
};

const form = reactive({
  preset: 'deepseek',
  base: PRESETS.deepseek.base,
  key: '',
  model: PRESETS.deepseek.model,
  temperature: 0.85,
  maxTokens: 700,
  enabled: true
});

const testing = ref(false);
const testMsg = ref('');
const testKind = ref<'ok' | 'err' | ''>('');
const saved = ref(false);

function applyPreset(): void {
  const p = PRESETS[form.preset];
  if (!p) return;
  if (form.preset !== 'custom') { form.base = p.base; form.model = p.model; }
}

const ready = computed(() =>
  !!form.base.trim() && !!form.model.trim() && !!form.key.trim() && form.enabled
);

function loadCfg(): void {
  const c = rc.gen && rc.gen.load ? rc.gen.load() : null;
  if (c && typeof c === 'object') {
    form.base = c.base || '';
    form.key = c.key || '';
    form.model = c.model || '';
    form.temperature = typeof c.temperature === 'number' ? c.temperature : 0.85;
    form.maxTokens = typeof c.maxTokens === 'number' ? c.maxTokens : 700;
    form.enabled = c.enabled !== false;
    // 反推预设
    const hit = Object.keys(PRESETS).find(k => PRESETS[k].base === form.base && PRESETS[k].model === form.model);
    form.preset = hit || (form.base ? 'custom' : 'deepseek');
  }
}

async function doTest(): Promise<void> {
  if (!rc.gen) { testMsg.value = t('modelTestFail') + ' RC.gen 未加载'; testKind.value = 'err'; return; }
  if (!form.base.trim() || !form.model.trim() || !form.key.trim()) {
    testMsg.value = t('modelFillAll'); testKind.value = 'err'; return;
  }
  testing.value = true; testMsg.value = t('modelTesting'); testKind.value = '';
  const r = await rc.gen.test({
    base: form.base.trim(), key: form.key.trim(), model: form.model.trim(),
    temperature: form.temperature, maxTokens: form.maxTokens, enabled: true
  });
  testing.value = false;
  if (r && r.ok && r.text) { testMsg.value = t('modelTestOk') + '「' + r.text.slice(0, 40) + '」'; testKind.value = 'ok'; }
  else { testMsg.value = t('modelTestFail') + (r ? (' ' + r.source) : ''); testKind.value = 'err'; }
}

function doSave(): void {
  if (!rc.gen) return;
  const cfg = {
    base: form.base.trim(), key: form.key.trim(), model: form.model.trim(),
    temperature: form.temperature, maxTokens: form.maxTokens, enabled: form.enabled
  };
  if (!cfg.base || !cfg.model) { testMsg.value = t('modelFillBaseModel'); testKind.value = 'err'; return; }
  rc.gen.save(cfg);
  saved.value = true;
  setTimeout(() => { saved.value = false; }, 2500);
}

function doClear(): void {
  if (!rc.gen) return;
  try { rc.store.del(rc.gen.KEY); } catch (e) { /* ignore */ }
  form.key = ''; form.enabled = false;
  testMsg.value = ''; testKind.value = '';
}

onMounted(loadCfg);
</script>

<template>
  <div class="wrap">
    <div class="panel">
      <div class="p-head">
        <h2><span class="i18n-cn">模型</span><span class="i18n-jp">モデル</span></h2>
        <span class="p-en">YOUR MODEL</span>
      </div>
      <div class="p-body">
        <p class="hint mb">{{ t('modelSub') }}</p>

        <div class="field">
          <label class="f"><span class="i18n-cn">服务商预设</span><span class="i18n-jp">プロバイダ</span></label>
          <select v-model="form.preset" @change="applyPreset">
            <option v-for="(p, k) in PRESETS" :key="k" :value="k">{{ p.label }}</option>
          </select>
        </div>

        <div class="field">
          <label class="f"><span class="i18n-cn">接口地址 (Base URL)</span><span class="i18n-jp">エンドポイント</span></label>
          <input v-model="form.base" type="text" placeholder="https://api.deepseek.com/v1" spellcheck="false" />
        </div>

        <div class="field">
          <label class="f">API Key</label>
          <input v-model="form.key" type="password" autocomplete="off" placeholder="sk-..." spellcheck="false" />
        </div>

        <div class="field">
          <label class="f"><span class="i18n-cn">模型名</span><span class="i18n-jp">モデル名</span></label>
          <input v-model="form.model" type="text" placeholder="deepseek-chat" spellcheck="false" />
        </div>

        <div class="field row2">
          <div>
            <label class="f"><span class="i18n-cn">温度</span><span class="i18n-jp">温度</span> · {{ form.temperature.toFixed(2) }}</label>
            <input v-model.number="form.temperature" type="range" min="0" max="2" step="0.05" />
          </div>
          <div>
            <label class="f"><span class="i18n-cn">最大长度</span><span class="i18n-jp">最大長</span></label>
            <input v-model.number="form.maxTokens" type="number" min="128" max="2000" step="32" />
          </div>
        </div>

        <div class="field check">
          <label class="cb"><input v-model="form.enabled" type="checkbox" />
            <span class="i18n-cn">启用（开启后，分析由你的模型生成）</span>
            <span class="i18n-jp">有効（入れると分析はあなたのモデルで生成）</span>
          </label>
        </div>

        <div class="model-actions">
          <button type="button" class="btn" :disabled="testing" @click="doTest">
            <span class="i18n-cn">测试连接</span><span class="i18n-jp">接続確認</span>
          </button>
          <button type="button" class="btn red" @click="doSave">
            <span class="i18n-cn">保存</span><span class="i18n-jp">保存</span>
          </button>
          <button type="button" class="btn ghost" @click="doClear">
            <span class="i18n-cn">清除</span><span class="i18n-jp">消去</span>
          </button>
        </div>

        <p v-if="saved" class="ok-note"><span class="i18n-cn">已保存（仅本机）</span><span class="i18n-jp">保存しました（この端末のみ）</span></p>
        <p v-if="testMsg" class="test-note" :class="testKind">
          <span class="i18n-cn">{{ testMsg }}</span>
        </p>

        <p class="hint faint">{{ t('modelHint') }}</p>

        <div class="status-chip" :class="ready ? 'on' : 'off'">
          <span class="dot"></span>
          <span class="i18n-cn">{{ ready ? '已接入：分析由你的模型生成' : '未配置：分析由本机模板代笔' }}</span>
          <span class="i18n-jp">{{ ready ? '接続済：分析はあなたのモデル' : '未設定：分析は本機テンプレ' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.model-actions{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0 8px;}
.model-actions .btn{margin:0;}
.field.row2{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
.field.row2 > div{display:flex;flex-direction:column;gap:6px;}
.field.row2 input[type=range]{width:100%;}
.field.check .cb{display:flex;gap:8px;align-items:flex-start;font-size:13px;color:var(--text-dim);cursor:pointer;}
.ok-note{color:var(--ok);font-size:13px;margin-top:10px;}
.test-note{font-size:13px;margin-top:6px;word-break:break-word;}
.test-note.ok{color:var(--ok);}
.test-note.err{color:var(--warn);}
.status-chip{display:flex;align-items:center;gap:10px;margin-top:16px;padding:10px 14px;border:1px solid var(--line);background:var(--panel);font-size:13px;}
.status-chip .dot{width:8px;height:8px;border-radius:50%;background:var(--text-faint);flex:none;}
.status-chip.on .dot{background:var(--ok);box-shadow:0 0 8px var(--ok);}
.status-chip.on{color:var(--ok);}
.hint.faint{margin-top:14px;}
.hint.mb{margin-bottom:14px;}
@media (max-width:520px){.field.row2{grid-template-columns:1fr;}}
</style>
