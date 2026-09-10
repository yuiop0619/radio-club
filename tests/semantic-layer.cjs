/* ============================================================
   叙事层端到端契约（Phase 4）
   跑法：npm run test:ai

   验证两件事，且两者都必须成立：
     A 未配置模型 → 机器附注回退本地模板，页面无报错、无空白
     B 配置模型   → 机器附注显示模型文本

   需要一个假的 OpenAI 兼容服务，因此不进 npm test（单测已覆盖纯逻辑）。
   ============================================================ */
const http = require('node:http');
const { chromium } = require('playwright');
const { createServer } = require('../tools/server.cjs');

const STORY = '我最近总是梦见赶不上的列车，醒来以后一直很不安，白天也心慌。';
const MOCK = '经查，来访者的症状属于「星期日黄昏型期待落空综合征」，1874 年由柏林某位不愿具名的医师首次描述。';
const log = (...a) => console.log(...a);

/* Playwright 在部分环境下 close() 会吊死（keep-alive 连接未释放），统一加兜底 */
function settle(closeFn, ms = 2000) {
  return Promise.race([
    Promise.resolve().then(closeFn).catch(() => {}),
    new Promise((r) => setTimeout(r, ms)),
  ]);
}

(async () => {
  const llama = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      let sent = {};
      try { sent = JSON.parse(body || '{}'); } catch { /* ignore */ }
      const shapeOk = Array.isArray(sent.messages) && sent.messages.length === 2;
      res.writeHead(shapeOk ? 200 : 400, { 'content-type': 'application/json' });
      res.end(shapeOk ? JSON.stringify({ choices: [{ message: { content: MOCK } }] }) : '{}');
    });
  });
  await new Promise((r) => llama.listen(0, '127.0.0.1', r));
  const llamaBase = 'http://127.0.0.1:' + llama.address().port + '/v1';

  const server = createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch();

  let failed = 0;
  const check = (name, cond, extra) => {
    if (cond) log('  PASS ' + name);
    else { failed++; log('  FAIL ' + name + (extra ? ' -> ' + extra : '')); }
  };

  async function openVerdict() {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base + '/verdict.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate((story) => { RC.case.save({ handle: '客人', category: '自我', story: story }); }, STORY);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.ai-sec', { timeout: 10000 });
    await page.waitForFunction(() => {
      const el = document.querySelector('.ai-body');
      return el && el.textContent.trim().length > 15;
    }, null, { timeout: 20000 });
    const out = {
      text: (await page.locator('.ai-body').innerText()).trim(),
      note: await page.locator('.ai-sec .hint.faint').count(),
      sections: await page.locator('#report h3').count(),
      errors: errors,
    };
    await settle(() => ctx.close());
    return out;
  }

  try {
    log('· A 未配置模型：应降级为本地模板');
    delete process.env.RC_LLM_BASE_URL; delete process.env.RC_LLM_MODEL;
    const a = await openVerdict();
    check('无 JS 报错', a.errors.length === 0, a.errors.join(' | '));
    check('机器附注不为空', a.text.length > 15, a.text.slice(0, 60));
    check('降级脚注可见', a.note === 1, 'note=' + a.note);
    check('原有章节未被破坏', a.sections >= 8, 'h3=' + a.sections);

    log('· B 已配置模型：应显示模型文本');
    process.env.RC_LLM_BASE_URL = llamaBase;
    process.env.RC_LLM_MODEL = 'mock-model';
    const b = await openVerdict();
    check('无 JS 报错', b.errors.length === 0, b.errors.join(' | '));
    check('显示模型文本', b.text.includes('星期日黄昏型'), b.text.slice(0, 80));
    check('无降级脚注', b.note === 0, 'note=' + b.note);
  } catch (e) {
    failed++;
    log('  ERROR ' + (e && e.message));
  } finally {
    delete process.env.RC_LLM_BASE_URL; delete process.env.RC_LLM_MODEL;
    await settle(() => browser.close(), 3000);
    if (server.closeAllConnections) server.closeAllConnections();
    await settle((r) => server.close(r));
    if (llama.closeAllConnections) llama.closeAllConnections();
    await settle((r) => llama.close(r));
  }
  log(failed ? '\n结果：' + failed + ' 项失败' : '\n结果：全部通过');
  process.exit(failed ? 1 : 0);
})();
