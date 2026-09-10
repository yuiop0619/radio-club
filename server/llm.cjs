'use strict';
/* ============================================================
   llm.cjs — 统一模型调用层（Phase 4）

   原则：规则负责「看到什么」，AI 负责「怎么说」。
   本文件只做传输，不碰业务语义；提示词在 prompt.cjs。

   协议：OpenAI 兼容的 POST {base}/chat/completions。
   云 API（DeepSeek / 通义 / OpenAI）与本地推理
   （Ollama / OpenVINO GenAI / llama.cpp / vLLM）都实现这个协议，
   因此换模型只改环境变量，不改代码。

   配置（全部走环境变量，缺 base 或 model 即视为「未启用」）：
     RC_LLM_BASE_URL    例如 https://api.deepseek.com/v1
                        或     http://127.0.0.1:11434/v1  （Ollama）
                        或     http://127.0.0.1:8000/v3   （OpenVINO GenAI）
     RC_LLM_API_KEY     本地模型可留空（不发送 Authorization 头）
     RC_LLM_MODEL       例如 deepseek-chat / qwen2.5:7b-instruct
     RC_LLM_TIMEOUT_MS  默认 12000，钳制在 1000~60000
     RC_LLM_MAX_TOKENS  默认 700，钳制在 128~2000
     RC_LLM_TEMPERATURE 默认 0.85，钳制在 0~2

   失败语义（重要）：任何异常都不向上抛。
   返回 {ok:false, source}，由调用方决定如何降级 —— 本层保证「绝不空白」。
   ============================================================ */

const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_MAX_TOKENS = 700;
const DEFAULT_TEMPERATURE = 0.85;

function intIn(value, fallback, lo, hi) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function floatIn(value, fallback, lo, hi) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, n));
}

/* 读取并规范化配置；enabled 为 false 时调用方应直接走模板降级 */
function config(env) {
  const e = env || process.env || {};
  const base = String(e.RC_LLM_BASE_URL || '').trim().replace(/\/+$/, '');
  const model = String(e.RC_LLM_MODEL || '').trim();
  const key = String(e.RC_LLM_API_KEY || '').trim();
  return {
    enabled: Boolean(base && model),
    base: base,
    model: model,
    key: key,
    timeoutMs: intIn(e.RC_LLM_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 1000, 60000),
    maxTokens: intIn(e.RC_LLM_MAX_TOKENS, DEFAULT_MAX_TOKENS, 128, 2000),
    temperature: floatIn(e.RC_LLM_TEMPERATURE, DEFAULT_TEMPERATURE, 0, 2),
  };
}

/* 探测运行时是否具备 fetch（Node >= 18 才有全局 fetch） */
function hasFetch() {
  return typeof fetch === 'function';
}

/* 底层单轮对话。messages 为 [{role,content}, ...] */
async function chat(messages, options) {
  const opts = options || {};
  const base = config(opts.env);
  // 逐项合并，缺省项必须回落到 env 配置 —— 用 Object.assign 会把未传的项写成 undefined，
  // 于是 setTimeout(fn, undefined) 变成 0ms，请求会「立刻超时」。
  const cfg = {
    enabled: base.enabled,
    base: base.base,
    key: base.key,
    model: opts.model ? String(opts.model) : base.model,
    timeoutMs: opts.timeoutMs === undefined ? base.timeoutMs : intIn(opts.timeoutMs, base.timeoutMs, 1000, 60000),
    maxTokens: opts.maxTokens === undefined ? base.maxTokens : intIn(opts.maxTokens, base.maxTokens, 128, 2000),
    temperature: opts.temperature === undefined ? base.temperature : floatIn(opts.temperature, base.temperature, 0, 2),
  };
  if (!cfg.enabled) return { ok: false, source: 'unconfigured', ms: 0 };
  if (!hasFetch()) return { ok: false, source: 'no_fetch_runtime', ms: 0 };
  if (!Array.isArray(messages) || !messages.length) return { ok: false, source: 'bad_request', ms: 0 };

  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, cfg.timeoutMs);
  const started = Date.now();
  try {
    const headers = { 'content-type': 'application/json' };
    if (cfg.key) headers.authorization = 'Bearer ' + cfg.key;
    const res = await fetch(cfg.base + '/chat/completions', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        model: cfg.model,
        messages: messages,
        max_tokens: cfg.maxTokens,
        temperature: cfg.temperature,
        stream: false,
      }),
      signal: controller.signal,
    });
    const ms = Date.now() - started;
    if (!res.ok) return { ok: false, source: 'http_' + res.status, ms: ms };
    let data;
    try {
      data = await res.json();
    } catch (_e) {
      return { ok: false, source: 'bad_json', ms: ms };
    }
    const choice = data && data.choices && data.choices[0];
    const text = choice && choice.message && choice.message.content;
    if (typeof text !== 'string' || !text.trim()) return { ok: false, source: 'empty', ms: ms };
    return { ok: true, source: 'llm', text: text.trim(), model: cfg.model, ms: ms };
  } catch (err) {
    const ms = Date.now() - started;
    const aborted = err && (err.name === 'AbortError' || err.code === 'ABORT_ERR');
    return { ok: false, source: aborted ? 'timeout' : 'error', ms: ms };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { config: config, chat: chat, hasFetch: hasFetch };
