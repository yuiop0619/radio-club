/* 第二批功能（#33-#41）冒烟测试：13 个页面无报错 + 新功能可用 */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createServer } = require('../tools/server.cjs');

const server = createServer();
const PAGES = ['index.html', 'people.html', 'order.html', 'tarot.html', 'psyche.html', 'verdict.html', 'bbs.html', 'link.html', 'about2006.html', 'account.html', 'masters.html', 'dreams.html', '404.html'];
let browser, base, failed = 0;

function ok(name, cond, extra) {
  if (cond) console.log('  PASS ' + name);
  else { failed++; console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch();

  console.log('· 全站页面加载');
  for (const p of PAGES) {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    const errors = [], missing = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400) missing.push(r.url()); });
    await page.goto(base + '/' + p, { waitUntil: 'load' });
    await page.waitForTimeout(700);
    ok(p + ' 无 JS 报错', errors.length === 0, errors.join(' | '));
    ok(p + ' 无 404', missing.filter(u => u.startsWith(base)).length === 0, missing.join(' | '));
    await ctx.close();
  }

  console.log('· #33 骨架屏');
  {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(base + '/tarot.html');
    await page.waitForTimeout(600);
    ok('骨架屏已撤除', await page.locator('.skel-box').count() === 0);
    await ctx.close();
  }

  console.log('· #37 大师画廊');
  {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(base + '/masters.html');
    await page.waitForTimeout(500);
    ok('七位大师卡片', await page.locator('#masterMount .gcard').count() === 7);
    ok('致敬卡五张', await page.locator('.hcard').count() === 5);
    ok('导航含画廊', (await page.locator('#navMount a[href="masters.html"]').count()) === 1);
    await ctx.close();
  }

  console.log('· #40 梦境时间线');
  {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(base + '/dreams.html');
    await page.fill('#dBody', '我站在一部电梯里，数字过了 17 还在往上。');
    await page.fill('#dTag', '电梯');
    await page.click('#dreamForm button[type=submit]');
    await page.waitForTimeout(300);
    ok('时间线出现一条', await page.locator('#dreamMount .tl-item').count() === 1);
    ok('计数已更新', (await page.locator('#dreamCount').textContent()).startsWith('1'));
    await ctx.close();
  }

  console.log('· #38 集章卡');
  {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(base + '/index.html');
    await page.waitForTimeout(800);
    const stampDefs = await page.evaluate(() => RC.stamps.DEFS.length);
    ok('集章卡格数与印章定义一致', await page.locator('#stampMount .stamp-cell').count() === stampDefs);
    ok('初次到店已盖章', await page.locator('#stampMount .stamp-cell.got').count() >= 1);
    await ctx.close();
  }

  console.log('· #39 电台环境音');
  {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(base + '/index.html');
    await page.waitForTimeout(400);
    ok('电台按钮存在', await page.locator('#ambBtn').count() === 1);
    await page.click('#ambBtn');
    await page.waitForTimeout(200);
    ok('点击后为开启态', (await page.locator('#ambBtn').getAttribute('class')).includes('on'));
    await ctx.close();
  }

  console.log('· #41 常客墙 + 数据看板');
  {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(base + '/people.html');
    await page.waitForTimeout(500);
    ok('常客墙 7 位（含你）', await page.locator('#regMount .reg').count() === 7);
    ok('数据看板 8 项', await page.locator('#boardMount .bstat').count() === 8);
    await ctx.close();
  }

  console.log('· #34 示例模式 + #36 分享图');
  {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(base + '/index.html');
    await page.click('#demoLoad');
    await page.waitForTimeout(300);
    ok('DEMO 角标出现', await page.locator('#demoBadge').count() === 1);
    await page.goto(base + '/verdict.html');
    await page.waitForTimeout(900);
    ok('示例档案可直接出鉴定书', await page.locator('#report h3').count() >= 3);
    await page.click('#btnCard');
    await page.waitForTimeout(600);
    ok('分享图已生成', await page.locator('.share-mask img').count() === 1);
    const src = await page.locator('.share-mask img').getAttribute('src');
    ok('分享图是 PNG dataURL', !!src && src.startsWith('data:image/png') && src.length > 5000);
    await page.goto(base + '/index.html');
    await page.waitForTimeout(300);
    await page.click('#demoClear');
    await page.waitForTimeout(200);
    ok('示例数据可清除', await page.locator('#demoBadge').count() === 0);
    await ctx.close();
  }

  console.log('· #35 移动端（390×844）');
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    for (const p of ['index.html', 'tarot.html', 'people.html', 'verdict.html', 'masters.html', 'dreams.html']) {
      await page.goto(base + '/' + p);
      await page.waitForTimeout(400);
      const w = await page.evaluate(() => document.documentElement.scrollWidth);
      ok(p + ' 无横向溢出（' + w + 'px）', w <= 391, 'scrollWidth=' + w);
    }
    await ctx.close();
  }

  /* 结束时不让 keep-alive 连接把进程吊住 */
  try { await Promise.race([browser.close(), new Promise(r => setTimeout(r, 3000))]); } catch (e) { /* 忽略 */ }
  if (server.closeAllConnections) server.closeAllConnections();
  try { server.close(); } catch (e) { /* 忽略 */ }
  console.log(failed ? '\n✗ 失败 ' + failed + ' 项' : '\n✓ 全部通过');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
