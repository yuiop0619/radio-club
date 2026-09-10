const { chromium } = require('playwright');
const BASE = process.env.RC_BASE || 'http://101.42.158.132:8080';
const PAGES = ['/', '/index.html', '/people.html', '/order.html', '/tarot.html', '/psyche.html',
  '/verdict.html', '/dreams.html', '/masters.html', '/bbs.html', '/link.html',
  '/account.html', '/about2006.html'];
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  let bad = 0;
  for (const p of PAGES) {
    const page = await ctx.newPage();
    const errs = [], f404 = [];
    page.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
    page.on('response', r => { if (r.status() >= 400) f404.push(r.status() + ' ' + r.url().replace(BASE, '')); });
    await page.goto(BASE + p, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(700);
    const info = await page.evaluate(() => ({
      title: document.title,
      navCount: document.querySelectorAll('#navMount .nav a').length,
      siteW: Math.round((document.querySelector('.site') || {}).clientWidth || 0),
    }));
    const ok = errs.length === 0 && f404.length === 0;
    if (!ok) bad++;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${p.padEnd(18)} 导航${info.navCount}项 版心${info.siteW}px 标题「${info.title}」`);
    if (errs.length) console.log('   JS错误:', errs.join(' | '));
    if (f404.length) console.log('   资源失败:', f404.slice(0, 4).join(' | '));
    await page.close();
  }
  /* browser.close() 可能被 keep-alive 连接吊死；先出结论，再兜底收尾并显式退出，
     否则脚本会卡在 close 上（被管道缓冲时表现为「什么都不打印、一直不结束」）。 */
  await Promise.race([browser.close().catch(() => {}), new Promise(r => setTimeout(r, 3000))]);
  console.log(bad ? `\n✗ ${bad} 页有问题` : '\n✓ 全部页面正常');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
