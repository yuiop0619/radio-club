'use strict';
/* ============================================================
   check-pages.cjs — 页面脚本配置校验（构建前运行）
   1. 每个 HTML 都要在 site.config.json 里登记，反之亦然
   2. 引用的脚本文件必须真实存在
   3. 用了 data-skel 的页面必须引 skeleton.js
   4. HTML 里不允许再出现手写脚本标签（应由构建期注入）
   5. 列出未被任何页面引用的孤儿脚本（提示，不报错）
   ============================================================ */
const { readdirSync, readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const cfg = JSON.parse(readFileSync(join(root, 'site.config.json'), 'utf8'));
const htmlFiles = readdirSync(root).filter((f) => f.endsWith('.html')).sort();
const jsDir = join(root, 'assets', 'js');

let errors = 0;
const fail = (m) => { console.log('  \u2717 ' + m); errors++; };
const pass = (m) => console.log('  \u2713 ' + m);

const referenced = new Set();

for (const f of htmlFiles) {
  if (!(f in cfg.pages)) fail(`${f} 未在 site.config.json 中登记`);
}

for (const [f, list] of Object.entries(cfg.pages)) {
  if (!htmlFiles.includes(f)) { fail(`site.config.json 里的 ${f} 不存在`); continue; }
  for (const n of list) {
    referenced.add(n);
    if (!existsSync(join(jsDir, n + '.js'))) fail(`${f} 引用了不存在的脚本 ${n}.js`);
  }
}

for (const f of htmlFiles) {
  const html = readFileSync(join(root, f), 'utf8');
  const list = cfg.pages[f] || [];
  if (/data-skel/.test(html) && !list.includes('skeleton')) fail(`${f} 用了 data-skel 但没引 skeleton.js`);
  if (/<script\s+src="assets\/js\//.test(html)) fail(`${f} 仍有手写脚本标签，应由构建期注入`);
}

const orphans = readdirSync(jsDir)
  .filter((f) => f.endsWith('.js'))
  .map((f) => f.replace(/\.js$/, ''))
  .filter((n) => !referenced.has(n));

if (!errors) pass(`${htmlFiles.length} 个页面脚本配置一致（共引用 ${referenced.size} 个脚本）`);
if (orphans.length) console.log(`  ! 未被引用的脚本：${orphans.join(', ')}`);

process.exit(errors ? 1 : 0);
