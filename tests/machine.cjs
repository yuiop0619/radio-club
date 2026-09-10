/* ============================================================
   鉴定机端到端契约（Phase 5）
   跑法：npm run test:machine

   验证「投币 → 运转 → 吐纸」这条把四步压成一步的链路。
   这是赛道的核心交互，所以它必须自己跑得通、且不依赖任何外部服务：

     1. 首页确实有一台机器（投币口 + 投币按钮）
     2. 投入一句话后，机器自动运转并跳到鉴定书页
     3. 鉴定书是完整的：多章节、机器代抽的牌阵、印章、无 JS 报错
     4. 太短的输入会被拦下，不消耗机器

   注意第 3 条：塔罗由机器代抽，所以牌一定有；精神分析缺席，
   但报告必须照常生成——这正是「一句话直达高潮」的前提。
   ============================================================ */
const { chromium } = require('playwright');
const { createServer } = require('../tools/server.cjs');

const STORY = '我总在凌晨三点醒来，想起十年前那扇关不上的门，然后一直到天亮都睡不着。';
const log = (...a) => console.log(...a);

/* Playwright 在部分环境下 close() 会吊死（keep-alive 连接未释放），统一加兜底 */
function settle(closeFn, ms = 2000) {
  return Promise.race([
    Promise.resolve().then(closeFn).catch(() => {}),
    new Promise((r) => setTimeout(r, ms)),
  ]);
}

(async () => {
  const server = createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch();

  let failed = 0;
  const check = (name, cond, extra) => {
    if (cond) log('  PASS ' + name);
    else { failed++; log('  FAIL ' + name + (extra ? ' -> ' + extra : '')); }
  };

  try {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    page.setDefaultTimeout(20000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    log('· A 首页：机器在不在');
    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#rcMachine', { timeout: 10000 });
    check('投币口存在', (await page.locator('#mcStory').count()) === 1);
    check('投币按钮存在', (await page.locator('#mcInsert').count()) === 1);
    check('型号铭牌正确', (await page.locator('.mc-name').innerText()).includes('RC-2006'));

    log('· A2 导航：主流程只留 6 项，移出的页面仍可达');
    const nav = await page.locator('#navMount .nav a')
      .evaluateAll((els) => els.map((a) => a.getAttribute('href')));
    check('导航恰好 6 项', nav.length === 6, nav.join(' '));
    check('委托 / 塔罗已移出导航', !nav.includes('order.html') && !nav.includes('tarot.html'), nav.join(' '));
    check('精神分析仍在（机器不能代做）', nav.includes('psyche.html'), nav.join(' '));
    const foot = await page.locator('#footMount a')
      .evaluateAll((els) => els.map((a) => a.getAttribute('href')));
    for (const p of ['people.html', 'order.html', 'tarot.html', 'link.html']) {
      check('页脚仍可达 ' + p, foot.includes(p));
    }

    log('· B 太短的输入应被拦下');
    await page.fill('#mcStory', '难受');
    await page.click('#mcInsert');
    await page.waitForTimeout(400);
    check('没有跳走', page.url().includes('index.html'), page.url());
    check('给出了提示', (await page.locator('#mcOut .warn').count()) === 1);

    log('· C 投币：一句话应直达鉴定书');
    await page.fill('#mcStory', STORY);
    await page.click('#mcInsert');
    // 运转日志应当真的逐行打出来（不是瞬间跳过）
    await page.waitForSelector('#mcOut .mc-line', { timeout: 5000 });
    check('机器开始运转', (await page.locator('#mcOut .mc-line').count()) >= 1);
    await page.waitForURL(/verdict\.html/, { timeout: 25000 });
    await page.waitForSelector('#report h3', { timeout: 15000 });

    const sections = await page.locator('#report h3').count();
    const body = await page.locator('#report').innerText();
    const cardRows = await page.locator('#report table.grid tr').count();
    const stamps = await page.locator('.stamp').count();
    const draft = await page.evaluate(() => {
      const c = RC.case.get();
      return { has: RC.case.has(), tarot: (c.tarot || []).length, handle: c.handle, story: c.story };
    });

    check('跳到了鉴定书页', page.url().includes('verdict.html'));
    check('档案已落盘', draft.has === true);
    check('称呼记为匿名来客', draft.handle === '匿名来客', draft.handle);
    check('原文完整保存', draft.story === STORY);
    check('机器代抽了 5 张牌', draft.tarot === 5, 'tarot=' + draft.tarot);
    check('鉴定书章节完整（≥8 节）', sections >= 8, 'h3=' + sections);
    check('牌阵已渲染', cardRows >= 5, 'rows=' + cardRows);
    check('盖了结论印章', stamps >= 1, 'stamp=' + stamps);
    check('没出现"尚未委托"空态', (await page.locator('#emptyMount:not(.hidden)').count()) === 0);
    check('无 JS 报错', errors.length === 0, errors.join(' | '));

    await settle(() => ctx.close());
  } catch (e) {
    failed++;
    log('  ERROR ' + (e && e.message));
  } finally {
    await settle(() => browser.close(), 3000);
    if (server.closeAllConnections) server.closeAllConnections();
    await settle((r) => server.close(r));
  }
  log(failed ? '\n结果：' + failed + ' 项失败' : '\n结果：全部通过');
  process.exit(failed ? 1 : 0);
})();
