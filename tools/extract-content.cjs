/* ============================================================
   extract-content.cjs — 一次性抽取脚本（Phase 3）
   在 Node 沙箱里加载 legacy IIFE，把它挂在 RC.* 上的纯数据导出为
   content/*.json。跑一次即可；之后 content/ 成为唯一来源，
   由 tools/build-content.cjs 重新打包回浏览器可用的 content-bundle.js。

   用法：node tools/extract-content.cjs
   ============================================================ */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'content');

/* ---------- 最小 DOM / window 沙箱 ---------- */
function makeSandbox() {
  const noop = () => {};
  const fakeEl = () => ({
    innerHTML: '', textContent: '', className: '', value: '',
    style: {}, dataset: {}, classList: { add: noop, remove: noop, contains: () => false },
    setAttribute: noop, getAttribute: () => null, appendChild: noop, removeChild: noop,
    addEventListener: noop, removeEventListener: noop, querySelector: () => null,
    querySelectorAll: () => [], closest: () => null, insertBefore: noop, remove: noop,
    scrollIntoView: noop, focus: noop, cloneNode: fakeEl, parentNode: null, children: [],
  });
  const document = {
    readyState: 'complete',
    title: '',
    body: Object.assign(fakeEl(), { setAttribute: noop, prepend: noop }),
    documentElement: fakeEl(),
    getElementById: () => null,
    createElement: fakeEl,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: noop,
    removeEventListener: noop,
  };
  const sandbox = {
    console,
    document,
    window: null,
    localStorage: undefined,      // store.js 的 try/catch 会接住
    sessionStorage: undefined,
    navigator: { language: 'zh-CN' },
    location: { pathname: '/index.html', search: '', hash: '' },
    matchMedia: () => ({ matches: false, addEventListener: noop }),
    setTimeout, clearTimeout, setInterval, clearInterval,
    JSON, Math, Date, RegExp, Object, Array, String, Number, Boolean, Set, Map,
    Uint8Array, Promise, Error, isNaN, parseInt, parseFloat,
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  return sandbox;
}

/* ---------- 加载一个 legacy JS，返回其 RC ---------- */
function loadRC(sandbox, file) {
  // 先装好 RC 骨架，IIFE 会往上挂东西
  vm.runInContext('window.RC = window.RC || {};', sandbox);
  // util / i18n 这些被引用的依赖，先给最小实现
  vm.runInContext(`
    RC.util = RC.util || {
      esc: function (s) { return String(s == null ? '' : s); },
      el: function () { return null; },
      pad: function (n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; },
      hash: function () { return 0; },
      rng: function () { return function () { return 0.5; }; },
      pick: function (a) { return a[0]; },
      clamp: function (v, a, b) { return Math.max(a, Math.min(b, v)); },
      quoteFrom: function () { return ''; },
      now: function () { return Date.now(); }
    };
    RC.i18n = RC.i18n || {
      lang: function () { return 'cn'; },
      t: function (k) { return k; },
      of: function (o) { return (o && (o.cn || o.jp)) || ''; },
      onChange: function () {}, toggle: function () {}
    };
    RC.model = RC.model || { normalize: function (x) { return x || {}; }, id: function () { return 'x'; } };
    RC.store = RC.store || { get: function (k, d) { return d; }, set: function () { return true; }, del: function () { return true; }, available: false };
  `, sandbox);
  // 若内容包已存在，先装进沙箱 —— 抽取脚本因此可重复运行（幂等），
  // 已抽离的模块会直接从 RC_CONTENT 取数据再原样导出。
  const bundlePath = path.join(ROOT, 'assets', 'js', 'content-bundle.js');
  if (fs.existsSync(bundlePath)) {
    vm.runInContext(fs.readFileSync(bundlePath, 'utf8'), sandbox, { filename: 'content-bundle.js' });
  }
  const code = fs.readFileSync(path.join(ROOT, 'assets', 'js', file), 'utf8');
  vm.runInContext(code, sandbox, { filename: file });
  return sandbox.RC;
}

function writeJson(name, data) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const p = path.join(OUT_DIR, name);
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
  const size = fs.statSync(p).size;
  console.log(`  ✓ content/${name}  (${(size / 1024).toFixed(1)} KB)`);
}

/* ============ 1. menu.json ← store.js ============ */
function extractMenu() {
  const sb = makeSandbox();
  const RC = loadRC(sb, 'store.js');
  const bar = RC.bar;
  if (!bar || !bar.drinks || !bar.drinks.length) throw new Error('store.js: RC.bar.drinks 为空');
  // checkoutLine 在 store.js 里是 Bar 上的两个独立字段
  writeJson('menu.json', {
    _note: '吧台酒单与主食单。drink/food 的 desc/line 为中文，descJp/lineJp 为日文。',
    drinks: bar.drinks,
    foods: bar.foods,
    checkoutLine: { cn: bar.checkoutLine, jp: bar.checkoutLineJp },
  });
  console.log(`     酒 ${bar.drinks.length} 款 / 主食 ${bar.foods.length} 道`);
}

/* ============ 2. masters.json ← analyst.js ============ */
function extractMasters() {
  const sb = makeSandbox();
  const RC = loadRC(sb, 'analyst.js');
  const A = RC.analyst;
  if (!A || !A.MASTERS || !A.MASTERS.length) throw new Error('analyst.js: RC.analyst.MASTERS 为空');
  // 意象词典：已抽离过就直接复用内容包，否则从 analyst.js 源码里取数组字面量。
  // 统一序列化成 { re: source, flags }，消费端 new RegExp(re, flags) 重建。
  let motifList = (sb.RC_CONTENT && sb.RC_CONTENT.masters && sb.RC_CONTENT.masters.motifs) || null;
  if (!motifList) {
    const src = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'analyst.js'), 'utf8');
    const from = src.indexOf('var MOTIFS = [');
    const to = src.indexOf('];', from);
    if (from < 0 || to < 0) throw new Error('analyst.js: 找不到 MOTIFS 数组');
    const literal = src.slice(from + 'var MOTIFS = '.length, to + 1); // 含结尾的 ]
    motifList = vm
      .runInNewContext('(' + literal + ')', { RegExp, Object, Array, String })
      .map((m) => ({ k: m.k, cn: m.cn, jp: m.jp, re: m.re.source, flags: m.re.flags }));
  }

  writeJson('masters.json', {
    _note: '解梦会诊的意象词典与七位大师。lens 的键对应 motifs[].k，"_" 为兜底。re 为正则 source，消费端重建 RegExp。',
    motifs: motifList,
    masters: A.MASTERS,
  });
  console.log(`     意象 ${motifList.length} 个 / 大师 ${A.MASTERS.length} 位`);
}

/* ============ 3. tarot.json ← tarot-data.js ============ */
function extractTarot() {
  const sb = makeSandbox();
  const RC = loadRC(sb, 'tarot-data.js');
  const T = RC.tarot;
  if (!T || !T.arcana || T.arcana.length !== 22) throw new Error('tarot-data.js: 大阿尔卡纳应为 22 张');
  writeJson('tarot.json', {
    _note: '大阿尔卡纳 22 张 + 封印符号 + 三种牌阵模板。up 为正位牌义，rv 为逆位。',
    arcana: T.arcana,
    seals: T.seals,
    positions: {
      pentagram: T.positions,
      daily: T.positionsDaily,
      timeline: T.positionsTimeline,
    },
    spreads: T.spreads,
  });
  console.log(`     牌 ${T.arcana.length} 张 / 封印 ${T.seals.length} 个 / 牌阵 ${Object.keys(T.spreads).length} 种`);
}

/* ============ 4. i18n.json ← i18n.js ============ */
function extractI18n() {
  const sb = makeSandbox();
  const RC = loadRC(sb, 'i18n.js');
  const DICT = RC.i18n && RC.i18n.DICT;
  if (!DICT || !DICT.cn || !DICT.jp) throw new Error('i18n.js: RC.i18n.DICT 结构异常');
  writeJson('i18n.json', {
    _note: '界面词条表。cn / jp 为两套语言，键名一致；代码只做取值与替换。',
    dict: { cn: DICT.cn, jp: DICT.jp },
  });
  console.log(`     词条 ${Object.keys(DICT.cn).length} 条 × 2 语言`);
}

console.log('抽取内容 → content/');
extractMenu();
extractMasters();
extractTarot();
extractI18n();
console.log('完成。');
