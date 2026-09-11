/* ============================================================
   gen.js — 「模型管理」客户端生成层（BYOK，Phase 7 大改地基）

   设计原则（回应用户「我上线 LLM 撑不住」）：
     · 默认不接任何模型，所有分析走本机模板兜底（零成本、零隐私外泄）
     · 用户在「模型」页填入自己的 Base URL / Key / 模型名
     · 配置只存在浏览器本地（rc_llm_cfg），不经过本店服务器
     · 各功能页调用 rc.gen.interpret(kind, ev, handle)，有配置就真的生成，
       没有就返回 null，调用方自动降级到现有模板

   与 server/llm.cjs 同源思路：规则负责「看到什么」，模型负责「怎么说」。
   这里是浏览器直连用户自己的模型（避免 CORS 时可后续加服务器中转开关）。
   ============================================================ */
(function () {
  'use strict';
  var KEY = 'rc_llm_cfg';

  function getCfg() {
    try { return RC.store.get(KEY, null); } catch (e) { return null; }
  }
  function isReady() {
    var c = getCfg();
    return !!(c && c.enabled && typeof c.base === 'string' && c.base &&
      typeof c.model === 'string' && c.model);
  }
  function clamp(n, lo, hi, fb) {
    n = Number(n);
    if (!isFinite(n)) return fb;
    return Math.max(lo, Math.min(hi, Math.round(n)));
  }
  function headers(c) {
    var h = { 'content-type': 'application/json' };
    if (c.key) h['authorization'] = 'Bearer ' + c.key;
    return h;
  }

  /* 原始对话接口：调用户自己的 /chat/completions（OpenAI 兼容） */
  async function chat(messages, opts) {
    opts = opts || {};
    var c = getCfg();
    if (!c || !c.base || !c.model) return { ok: false, source: 'unconfigured' };
    if (!Array.isArray(messages) || !messages.length) return { ok: false, source: 'bad_request' };
    var base = String(c.base).trim().replace(/\/+$/, '');
    var body = {
      model: opts.model || c.model,
      messages: messages,
      max_tokens: clamp(opts.maxTokens || c.maxTokens, 128, 2000, 700),
      temperature: clamp(opts.temperature || c.temperature, 0, 2, 0.85)
    };
    var ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
    var ms = clamp(opts.timeoutMs || c.timeoutMs, 3000, 60000, 15000);
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, ms) : null;
    var started = Date.now();
    try {
      var res = await fetch(base + '/chat/completions', {
        method: 'POST',
        headers: headers(c),
        body: JSON.stringify(body),
        signal: ctrl ? ctrl.signal : undefined
      });
      var dt = Date.now() - started;
      if (!res.ok) return { ok: false, source: 'http_' + res.status, ms: dt };
      var data = await res.json();
      var text = data && data.choices && data.choices[0] && data.choices[0].message &&
        data.choices[0].message.content;
      if (typeof text !== 'string' || !text.trim()) return { ok: false, source: 'empty', ms: dt };
      return { ok: true, text: text.trim(), model: c.model, ms: dt };
    } catch (err) {
      var dt2 = Date.now() - started;
      var aborted = err && (err.name === 'AbortError' || err.code === 'ABORT_ERR');
      // TypeError / 断网 / CORS 被拦 → 都归到 error，调用方降级
      return { ok: false, source: aborted ? 'timeout' : 'error', ms: dt2 };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /* ---------- 证据 → 提示词（可扩展，按 kind 分支） ---------- */
  function renderEv(v) {
    if (!v || typeof v !== 'object') return '';
    var L = [];
    if (Array.isArray(v.hypotheses)) v.hypotheses.slice(0, 4).forEach(function (h) {
      if (h && h.titleCn) L.push('· 推测：' + h.titleCn + (h.score ? ('（' + h.score + '）') : ''));
    });
    if (Array.isArray(v.spectrum)) v.spectrum.slice(0, 8).forEach(function (s) {
      if (s && s.label) L.push('· 情感谱：' + s.label + (s.v ? (' ' + s.v) : ''));
    });
    if (Array.isArray(v.tarot)) v.tarot.slice(0, 5).forEach(function (t) {
      if (t && t.pos && t.card) L.push('· 塔罗：' + t.pos + ' — ' + t.card);
    });
    if (v.quotes) {
      if (v.quotes.story) L.push('· 自述：' + v.quotes.story);
      if (v.quotes.dream) L.push('· 梦境：' + v.quotes.dream);
      if (v.quotes.rec) L.push('· 回忆：' + v.quotes.rec);
    }
    if (v.stampCn) L.push('· 印章：' + v.stampCn);
    if (Array.isArray(v.prescription)) v.prescription.slice(0, 4).forEach(function (p) {
      if (p) L.push('· 处方：' + p);
    });
    if (v.absence) L.push('· 缺失：' + v.absence);
    if (Array.isArray(v.cold)) v.cold.slice(0, 2).forEach(function (x) { if (x) L.push('· 冷读：' + x); });
    return L.join('\n');
  }
  function buildMessages(kind, ev, handle) {
    handle = handle || '客人';
    var sys = '你是 RADIO CLUB 的鉴定机 MODEL RC-2006，一台为深夜来访者撰写心理附注的机器。' +
      '口吻克制、带一点冷幽默，像酒吧里见多识广的设备。只基于给出的证据写，不要编造证据之外的事实，不要下医学诊断。' +
      '用「' + handle + '」称呼对方。中文，一段话（3-5 句）。';
    var user = '证据如下：\n' + (renderEv(ev) || '（无）') + '\n\n请据此写一段「机器附注」。';
    if (kind === 'dream') {
      sys = '你是 RADIO CLUB 的梦境机。根据来访者的梦，写一段温柔又带点洞察的解析（3-4 句），不强行解梦，允许留白。用「' + handle + '」称呼。中文。';
      user = '梦的内容：\n' + (typeof ev === 'string' ? ev : JSON.stringify(ev)) + '\n\n写一段解析。';
    } else if (kind === 'mood') {
      sys = '你是 RADIO CLUB 的情绪机。根据来访者近况，写一句简短、不鸡汤的回应（1-2 句）。用「' + handle + '」称呼。中文。';
      user = (typeof ev === 'string' ? ev : JSON.stringify(ev));
    } else if (kind === 'tarot') {
      sys = '你是 RADIO CLUB 的塔罗机。根据抽到的牌与问题，写一段读牌文字（3-5 句），结合牌位与问题，不宿命论。用「' + handle + '」称呼。中文。';
      user = (typeof ev === 'string' ? ev : JSON.stringify(ev));
    } else if (kind === 'persona') {
      sys = '你是 RADIO CLUB 的人格机。根据来访者的性格侧写，写一段温和的、像老朋友一样的观察（2-3 句）。用「' + handle + '」称呼。中文。';
      user = (typeof ev === 'string' ? ev : JSON.stringify(ev));
    } else if (kind === 'reading') {
      sys = '你是 RADIO CLUB 的综合读心机。把来访者在不同功能里留下的痕迹合成一段个人叙事（4-6 句），像是为他画了一幅速写。克制、真诚、不诊断。用「' + handle + '」称呼。中文。';
      user = (typeof ev === 'string' ? ev : JSON.stringify(ev));
    }
    return [{ role: 'system', content: sys }, { role: 'user', content: user }];
  }
  async function interpret(kind, ev, handle) {
    return chat(buildMessages(kind, ev, handle));
  }

  /* ---------- 模型页：保存 / 读取 / 测试 ---------- */
  function save(cfg) {
    try { RC.store.set(KEY, cfg); return true; } catch (e) { return false; }
  }
  function load() { return getCfg(); }
  async function test(cfg) {
    var prev = getCfg();
    try {
      RC.store.set(KEY, Object.assign({}, cfg, { enabled: true }));
      return await chat(
        [{ role: 'system', content: '你是测试助手。' }, { role: 'user', content: '只回复 OK' }],
        { timeoutMs: 9000, maxTokens: 24 }
      );
    } finally {
      if (prev) RC.store.set(KEY, prev); else RC.store.del(KEY);
    }
  }

  window.RC = window.RC || {};
  if (!RC.gen) {
    RC.gen = {
      KEY: KEY, isReady: isReady, getCfg: getCfg, chat: chat,
      interpret: interpret, buildMessages: buildMessages, save: save, load: load, test: test
    };
  }
})();
