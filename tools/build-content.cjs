/* ============================================================
   build-content.cjs — content/*.json → assets/js/content-bundle.js

   为什么需要这一步：
   legacy 页面用的是 classic <script>（同步执行），而 JSON 只能异步 fetch。
   构建期把 content/ 打成一个同步可用的 classic script，既保住
   「JSON 是唯一来源」，又不改变任何脚本的执行时序。

   产出：assets/js/content-bundle.js
     window.RC_CONTENT = { revision, menu, masters, tarot, hypotheses, ... }

   由 npm run build 与 vite 插件保证每个页面都最先加载它。
   用法：node tools/build-content.cjs [--check]
         --check 只校验产物是否最新（CI / 构建期用），不写文件
   ============================================================ */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content');
const OUT_FILE = path.join(ROOT, 'assets', 'js', 'content-bundle.js');
const CHECK_ONLY = process.argv.includes('--check');

function readContent() {
  if (!fs.existsSync(CONTENT_DIR)) throw new Error('缺少 content/ 目录');
  const files = fs
    .readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();
  const bundle = {};
  const sources = [];
  for (const f of files) {
    const key = f.replace(/\.json$/, '');
    if (key.startsWith('_')) continue;
    const raw = fs.readFileSync(path.join(CONTENT_DIR, f), 'utf8');
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      throw new Error(`content/${f} 不是合法 JSON：${e.message}`);
    }
    sources.push(f);
    // 去掉 _note 之类的元信息键
    const clean = {};
    for (const k of Object.keys(parsed).sort()) {
      if (k.startsWith('_')) continue;
      clean[k] = parsed[k];
    }
    bundle[key] = clean;
  }
  if (!Object.keys(bundle).length) throw new Error('content/ 里没有任何 JSON');
  return { bundle, sources };
}

function revisionOf(bundle) {
  const h = crypto.createHash('sha1').update(JSON.stringify(bundle)).digest('hex');
  return h.slice(0, 10);
}

function render(bundle, revision, sources) {
  const sorted = {};
  for (const k of Object.keys(bundle).sort()) sorted[k] = bundle[k];
  const body = JSON.stringify({ revision, ...sorted }, null, 2);
  return (
    `/* 由 tools/build-content.cjs 从 content/*.json 生成 — 请勿手改。\n` +
    `   来源：${sources.join(' / ')}\n` +
    `   revision: ${revision} */\n` +
    `window.RC_CONTENT = ${body};\n`
  );
}

function main() {
  const { bundle, sources } = readContent();
  const revision = revisionOf(bundle);
  const next = render(bundle, revision, sources);
  const prev = fs.existsSync(OUT_FILE) ? fs.readFileSync(OUT_FILE, 'utf8') : '';

  if (prev === next) {
    console.log(`content-bundle.js 已是最新 (rev ${revision})`);
    return 0;
  }
  if (CHECK_ONLY) {
    console.error(
      `✗ assets/js/content-bundle.js 不是最新 (期望 rev ${revision})。\n` +
        `  请运行：node tools/build-content.cjs`
    );
    return 1;
  }
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, next, 'utf8');
  const kb = (Buffer.byteLength(next, 'utf8') / 1024).toFixed(1);
  console.log(`✓ assets/js/content-bundle.js  (rev ${revision}, ${kb} KB, 来源 ${sources.length} 个)`);
  return 0;
}

process.exit(main());
