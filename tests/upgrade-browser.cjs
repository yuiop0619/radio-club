const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {createServer}=require('../tools/server.cjs'),{memoryRepo}=require('./memory-repo.cjs');
const server=createServer(()=>{},{repo:memoryRepo()});let browser,base;const errors=[];
async function context(width=1280){
  const c=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
  await c.addInitScript(()=>{if(!/^https?:$/.test(location.protocol))return;sessionStorage.setItem('rc_visit_session','1');if(!localStorage.getItem('rc_visits'))localStorage.setItem('rc_visits','3');});
  await c.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  c.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));return c;
}
async function screenshot(p,name){fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});await p.screenshot({path:path.join(__dirname,'artifacts',name+'.png'),fullPage:false});}
async function main(){
  await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true});
  try{
    const c=await context(),p=await c.newPage();await p.goto(base+'/index.html');
    await p.getByRole('button',{name:'拉开椅子 · 入座'}).click();
    await p.getByRole('button',{name:'添加 热牛奶',exact:true}).click();await p.getByRole('button',{name:'添加 热牛奶',exact:true}).click();await p.getByRole('button',{name:'添加 深夜拉面',exact:true}).click();
    assert.equal(await p.evaluate(()=>JSON.parse(localStorage.rc_counter_v2).tickets.length),0);
    await p.waitForFunction(()=>JSON.parse(localStorage.rc_counter_v2).draft.ramen===1);await p.locator('.menu-top').scrollIntoViewIfNeeded();await screenshot(p,'new-menu-desktop');
    await p.getByRole('button',{name:'就这些 · 交给她 ↗'}).click();
    await p.getByRole('button',{name:'修改这张单'}).click();await p.getByRole('button',{name:'减少 热牛奶',exact:true}).click();await p.getByRole('button',{name:'添加 一杯冷水',exact:true}).click();
    await p.waitForFunction(()=>JSON.parse(localStorage.rc_counter_v2).draft.water===1);await p.keyboard.press('Escape');await p.reload();await p.getByRole('button',{name:'翻开今晚的菜单'}).click();
    assert.equal(await p.getByRole('status',{name:'热牛奶数量'}).textContent(),'1');
    await p.getByRole('button',{name:'就这些 · 交给她 ↗'}).click();await p.locator('.menu-dialog').waitFor({state:'hidden'});await p.reload();
    assert.equal(await p.locator('.table-dish').count(),0);await p.getByRole('button',{name:'现在上菜吧'}).click();await p.waitForFunction(()=>JSON.parse(localStorage.rc_counter_v2).tickets.some(t=>t.state==='serving'||t.state==='done'));await p.reload();
    await p.waitForFunction(()=>document.querySelectorAll('.table-dish').length===3).catch(async e=>{console.log(await p.evaluate(()=>({state:localStorage.rc_counter_v2,html:document.querySelector('#bar-app')?.textContent})));throw e;});
    await p.getByRole('button',{name:'品尝 热牛奶'}).click();assert.match(await p.locator('.counter-dialogue').textContent(),/蜂蜜/);
    await p.locator('.counter-scene').scrollIntoViewIfNeeded();await screenshot(p,'new-counter-desktop');
    const p2=await c.newPage();await p2.goto(base+'/index.html');await p.getByRole('button',{name:'翻开今晚的菜单'}).click();await p2.getByRole('button',{name:'翻开今晚的菜单'}).click();
    await Promise.all([p.getByRole('button',{name:'添加 热牛奶',exact:true}).click(),p2.getByRole('button',{name:'添加 热牛奶',exact:true}).click()]);
    await p.waitForFunction(()=>JSON.parse(localStorage.rc_counter_v2).draft.milk===2);await p2.close();await c.close();console.log('PASS editable order, reload, delivery, taste and concurrent tabs');

    const mobile=await context(390),m=await mobile.newPage();await m.goto(base+'/index.html');await m.getByRole('button',{name:'拉开椅子 · 入座'}).click();await m.getByRole('button',{name:'添加 热牛奶',exact:true}).click();await m.waitForFunction(()=>JSON.parse(localStorage.rc_counter_v2).draft.milk===1);await screenshot(m,'new-menu-mobile');
    assert.equal(await m.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true);
    await m.keyboard.press('Escape');await m.goto(base+'/about2006.html?ch=2');await m.getByRole('button',{name:'☆ 收藏',exact:true}).click();await m.getByRole('button',{name:'下一章 →',exact:true}).click();await m.goBack();await m.waitForFunction(()=>document.querySelector('.archive-document h2')?.textContent==='17 楼开放');
    assert.equal(await m.getByRole('button',{name:'★ 收藏',exact:true}).getAttribute('aria-pressed'),'true');await m.reload();await m.getByRole('button',{name:'放大照片',exact:true}).click();await m.getByRole('button',{name:'关闭照片',exact:true}).click();
    await m.getByRole('button',{name:'关闭档案',exact:true}).click();await m.getByRole('button',{name:/继续阅读/}).click();
    await screenshot(m,'new-archive-mobile');assert.equal(await m.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true);
    await m.setViewportSize({width:1280,height:900});await screenshot(m,'new-archive-desktop');await mobile.close();console.log('PASS mobile layout, chapter history, bookmarks, window and photo');

    const a=await context(),ap=await a.newPage();await ap.goto(base+'/account.html');
    await ap.evaluate(()=>{RC.store.set('case',{story:'私密测试原文'});RC.store.set('archive_v2',{last:3,read:[1,2,3],bookmarks:[2]});});
    await ap.getByRole('button',{name:'连接服务',exact:true}).click();await ap.getByLabel('我同意将以上所选记录保存到本站服务器').check();await ap.getByRole('button',{name:'保存这份记录',exact:true}).click();await ap.getByText('这份记录已保存到服务器。',{exact:true}).waitFor();
    assert.doesNotMatch(await ap.locator('.remote-preview').textContent(),/故事与探索/);
    await ap.getByRole('button',{name:'生成恢复码',exact:true}).click();const recovery=await ap.getByLabel('请保存恢复码').inputValue();
    const b=await context(),bp=await b.newPage();await bp.goto(base+'/account.html');await bp.getByLabel('已有恢复码',{exact:true}).fill(recovery);await bp.getByRole('button',{name:'恢复身份',exact:true}).click();await bp.waitForLoadState('load');await bp.getByRole('button',{name:'连接服务',exact:true}).click();await bp.getByLabel('用这份记录替换本机对应内容，并保留恢复前备份').check();await bp.getByRole('button',{name:'恢复到本机',exact:true}).click();await bp.getByText('记录已恢复。重新打开吧台或档案馆即可看到。',{exact:true}).waitFor();
    assert.equal(await bp.evaluate(()=>RC.store.get('archive_v2').last),3);assert.equal(await bp.evaluate(()=>RC.case.get().story),'');await a.close();await b.close();console.log('PASS consent, no original story by default, recovery and second-browser restore');
    assert.deepEqual(errors,[]);
  }finally{
    /* 与 browser.cjs 同理：close 会被 keep-alive 连接吊死，必须超时兜底并显式退出 */
    await Promise.race([(browser?browser.close():Promise.resolve()).catch(()=>{}),new Promise(r=>setTimeout(r,3000))]);
    if(server.closeAllConnections)server.closeAllConnections();
    await new Promise(r=>server.close(r));
  }
}
main().then(()=>process.exit(process.exitCode||0)).catch(e=>{console.error(e);process.exit(1);});
