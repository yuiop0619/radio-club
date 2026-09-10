'use strict';
/* ============================================================
   interpret.cjs — 解读编排层（Phase 4）

   职责：把「证据」变成「叙事」的完整流程，且保证任何情况下都能收场。

     证据（rules）  --sanitize-->  提示词  --chat-->  文本
                                          |
                                          +--失败--> { ok:false, source }

   本模块永不上抛异常：调用方（api.cjs）只需把结果包进响应，
   前端看到 text === null 就用现有模板，绝不出现空白报告。
   ============================================================ */

const { config, chat } = require('./llm.cjs');
const { sanitize, hasSignal, buildMessages } = require('./prompt.cjs');

/* evidence: 前端上传的原始证据包（不可信）；options.handle: 称呼 */
async function interpret(evidence, options) {
  const opts = options || {};
  const ev = sanitize(evidence);

  // 证据太稀疏时不动用模型：烧 token 也写不出好东西，直接让前端用模板
  if (!hasSignal(ev)) return { ok: false, source: 'insufficient', text: null, ms: 0 };

  const cfg = config(opts.env);
  if (!cfg.enabled) return { ok: false, source: 'unconfigured', text: null, model: null, ms: 0 };

  const result = await chat(buildMessages(ev, { handle: opts.handle }), {
    env: opts.env,
    timeoutMs: opts.timeoutMs,
  });

  if (result.ok) {
    return { ok: true, source: 'llm', text: result.text, model: result.model, ms: result.ms };
  }
  return { ok: false, source: result.source, text: null, model: null, ms: result.ms || 0 };
}

module.exports = { interpret: interpret };
