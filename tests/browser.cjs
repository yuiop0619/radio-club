const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {createServer}=require('../tools/server.cjs');
const {service}=require('../cloudfunctions/treehole/service');
const {memoryRepo}=require('./memory-repo.cjs');
const root=path.resolve(__dirname,'..'),requests=[],results=[];
const server=createServer(u=>requests.push(u));
const repo=memoryRepo(),handle=service(repo);
let browser,base;
async function fresh(uid){
  const ctx=await browser.newContext({reducedMotion:'reduce'}),errors=[],external=[],missing=[];
  await ctx.route('**/*',async route=>{
    const url=route.request().url();
    if(!url.startsWith(base+'/')){external.push(url);return route.abort();}
    if(uid&&url.includes('/assets/js/cloud-config.js'))return route.fulfill({contentType:'application/javascript',body:'window.RC_CLOUD_CONFIG={enabled:true,env:"mock",functionName:"treehole"};'});
    return route.continue();
  });
  if(uid){
    await ctx.exposeFunction('__cloudCall',event=>handle(event,uid));
    await ctx.addInitScript(()=>{
      window.cloudbase={init:()=>({auth:()=>({signInAnonymously:()=>Promise.resolve()}),callFunction:async({data})=>{
        if(window.__failNext){window.__failNext=false;throw Error('SIMULATED_OFFLINE');}
        try{const r=await window.__cloudCall(data);return {result:{ok:true,data:r}};}catch(e){return {result:{ok:false,error:e.message}};}
      }})};
    });
  }
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)missing.push(r.url());});
  return {ctx,page,errors,external,missing};
}
async function scenario(name,fn){await fn();results.push(name);console.log('PASS '+name);}
async function refresh(page){await page.evaluate(async()=>{const known=RC.store.get('bbs_v2').notes.filter(n=>n.cloud).map(n=>n.id);RC.hole.mergeCloud(await RC.cloud.pull(known));RC.hole.render();});}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true});
  try{
    await scenario('all nine pages: desktop/mobile, images, no script errors',async()=>{
      const {ctx,page,errors,external,missing}=await fresh();
      for(const width of [1280,390]){
        await page.setViewportSize({width,height:844});
        for(const file of fs.readdirSync(root).filter(f=>f.endsWith('.html'))){
          await page.goto(base+'/'+file);
          await page.evaluate(async()=>{await Promise.all([...document.images].filter(i=>i.loading!=='lazy').map(i=>i.decode().catch(()=>{})));});
          assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true,file+' at '+width+'px overflows');
        }
      }
      assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(missing,[]);
      await page.goto(base+'/psyche.html');await page.locator('#masterGrid').scrollIntoViewIfNeeded();
      await page.waitForFunction(()=>[...document.querySelectorAll('#masterGrid img')].every(i=>i.complete&&i.naturalWidth>0));
      const img=await page.locator('#masterGrid img').first().evaluate(i=>({src:i.currentSrc,width:i.naturalWidth,labels:document.querySelector('.sct-a').labels.length}));
      assert.match(img.src,/webp$/);assert.ok(img.width<=320);assert.equal(img.labels,1);
      fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});await page.screenshot({path:path.join(__dirname,'artifacts/psyche-mobile.png'),fullPage:true});
      await ctx.close();
    });
    await scenario('full order, tarot, analyst, association, SCT and verdict flow',async()=>{
      const {ctx,page,errors}=await fresh();
      await page.goto(base+'/order.html');await page.getByLabel('怎么称呼你').fill('测试访客');await page.locator('#catRow [data-v="工作"]').press('Enter');await page.getByLabel('把这件事讲给我听').fill('最近工作有些忙，我想记录并梳理自己的生活。');await page.locator('#orderForm button[type="submit"]').click();
      assert.equal(await page.locator('#doneMount').isVisible(),true);
      await page.goto(base+'/tarot.html');await page.locator('[data-domain="work"]').click();await page.locator('#btnDeal').click();await page.locator('.tcard').first().press('Enter');
      await page.locator('.lang-toggle').click();assert.equal(await page.locator('.tcard').count(),5);assert.equal(await page.locator('.tcard.flip').count(),1);
      await page.reload();assert.equal(await page.locator('.tcard').count(),5);assert.equal(await page.locator('.tcard.flip').count(),1);await page.locator('#btnFlipAll').click();
      await page.goto(base+'/psyche.html');await page.locator('[data-m="jung"]').click();await page.locator('#chatIn').fill('梦里走进一间有镜子的房间');
      await page.locator('#chatIn').dispatchEvent('keydown',{key:'Enter',isComposing:true});assert.notEqual(await page.locator('#chatIn').inputValue(),'');
      await page.locator('#btnSend').click();await page.locator('#btnCard').click();await page.locator('#btnAssocStart').click();
      for(let i=0;i<12;i++){await page.locator('#assocInput').fill('回答'+i);await page.locator('#btnAssocNext').click();}
      await page.locator('.sct-a').first().fill('我想给自己安排一个安静的晚上');await page.locator('.lang-toggle').click();assert.match(await page.locator('.sct-a').first().inputValue(),/安静/);await page.locator('#btnSct').click();
      await page.reload();assert.match(await page.locator('.sct-a').first().inputValue(),/安静/);
      await page.goto(base+'/verdict.html');assert.equal(await page.locator('#reportMount').isVisible(),true);assert.match(await page.locator('#report').textContent(),/句子完成测试/);assert.match(await page.locator('#report').textContent(),/安静/);assert.deepEqual(errors,[]);await ctx.close();
    });
    await scenario('untrusted sharing stays text; fragment never reaches HTTP request',async()=>{
      const {ctx,page,errors}=await fresh();
      const payload={story:'安全测试',analystLog:[{m:'jung',motifs:['<svg onload="window.__xss=1"></svg>','mirror'],verdict:{cn:'<img src=x onerror="window.__xss=1">'}}]};
      const encoded=Buffer.from(JSON.stringify(payload)).toString('base64url');
      await page.goto(base+'/verdict.html#c='+encoded);
      assert.equal(await page.evaluate(()=>window.__xss),undefined);assert.equal(await page.locator('#report svg,#report img').count(),0);assert.equal(new URL(page.url()).hash,'');assert.equal(requests.some(r=>r.includes(encoded)),false);
      await page.goto(base+'/verdict.html#c='+Buffer.from(JSON.stringify({kind:'summary',schemaVersion:1,text:'<img onerror="window.__xss=1">'})).toString('base64url'));
      assert.equal(await page.locator('#report img').count(),0);assert.deepEqual(errors,[]);await ctx.close();
    });
    await scenario('invalid and legacy share links have recoverable errors',async()=>{
      const {ctx,page,errors}=await fresh();
      for(const suffix of ['#c=bad!!','#c='+Buffer.from('[]').toString('base64url'),'?c=old']){
        await page.goto(base+'/verdict.html'+suffix);assert.equal(await page.locator('#emptyMount').isVisible(),true);assert.equal(await page.locator('#reportMount').isVisible(),false);
      }assert.deepEqual(errors,[]);await ctx.close();
    });
    await scenario('share defaults to a preview without original data; clipboard failure has fallback',async()=>{
      const {ctx,page}=await fresh();await page.goto(base+'/verdict.html');await page.evaluate(()=>RC.case.save({handle:'私密姓名',birth:'1990-01-01',story:'只有本人知道的原始故事'}));await page.reload();await page.locator('#btnShare').click();
      const link=await page.locator('#shareBox').inputValue();const decoded=Buffer.from(new URL(link).hash.slice(3),'base64url').toString();assert.equal(decoded.includes('私密姓名'),false);assert.equal(decoded.includes('1990-01-01'),false);assert.equal(decoded.includes('原始故事'),false);
      await page.locator('#shareFull').check();assert.equal(await page.locator('#shareWrap').isVisible(),false);await page.locator('#btnShare').click();assert.match(await page.locator('#sharePreview').textContent(),/原始故事/);
      await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(Error('denied'))}}));await page.locator('#btnCopyShare').click();await page.waitForFunction(()=>document.getElementById('shareMsg').textContent.includes('手动'));await ctx.close();
    });
    await scenario('treehole connects to the cloud by default and defaults to public delivery',async()=>{
      const {ctx,page,external,errors}=await fresh();await page.goto(base+'/bbs.html');
      await page.waitForFunction(()=>RC.cloud.ready);
      assert.ok(await page.locator('#thCloud').textContent().then(t=>/已连接/.test(t)),'badge should say connected');
      assert.equal(await page.locator('#thVisibility option[value="public"]').isDisabled(),false);
      assert.equal(await page.locator('#thVisibility').inputValue(),'public');
      assert.deepEqual(external,[]);assert.deepEqual(errors,[]);await ctx.close();
    });
    await scenario('local treehole notes stay on device, reply button works, deletion survives reload',async()=>{
      const {ctx,page,external,errors}=await fresh();await page.goto(base+'/bbs.html');await page.locator('#thVisibility').selectOption('local');await page.locator('#thBody').fill('一张仅保存在本机的测试纸条');await page.locator('#thDrop').click();
      const note=page.locator('.note.mine').last();await note.locator('[data-act="reply"]').click();await note.locator('.ri').fill('本地回复');await note.locator('[data-act="send"]').click();assert.match(await note.textContent(),/本地回复/);
      await note.locator('[data-act="share"]').click();assert.equal(await page.locator('#noteShare').isVisible(),true);assert.match(await page.locator('#noteShareLink').inputValue(),/#n=/);
      await note.locator('[data-act="take"]').click();await page.reload();assert.equal(await page.locator('.note.mine').count(),0);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);await ctx.close();
    });
    await scenario('public cloud: two clients, merge, report, withdraw and retry',async()=>{
      const a=await fresh('owner'),b=await fresh('visitor');
      for(const x of [a,b]){await x.page.goto(base+'/bbs.html');await x.page.locator('#thConnect').click();await x.page.waitForFunction(()=>RC.cloud.ready);}
      await a.page.locator('#thVisibility').selectOption('public');await a.page.locator('#thBody').fill('公开纸条测试');await a.page.locator('#thDrop').click();await a.page.waitForFunction(()=>RC.store.get('bbs_v2').notes.some(n=>n.cloud));
      const id=await a.page.evaluate(()=>RC.store.get('bbs_v2').notes.find(n=>n.cloud).id);await refresh(b.page);
      const noteB=b.page.locator('.note[data-id="'+id+'"]');await noteB.locator('[data-act="reply"]').click();await noteB.locator('.ri').fill('来自另一访客的回复');await noteB.locator('[data-act="send"]').click();await b.page.waitForFunction(()=>RC.cloud.pending()===0);await refresh(a.page);
      assert.match(await a.page.locator('.note[data-id="'+id+'"]').textContent(),/另一访客/);
      await b.page.evaluate(async id=>Promise.all([RC.cloud.mutate('reply',id,{body:'并发回复甲'}),RC.cloud.mutate('reply',id,{body:'并发回复乙'})]),id);
      assert.equal(await b.page.evaluate(()=>RC.cloud.pending()),0);await refresh(a.page);assert.match(await a.page.locator('.note[data-id="'+id+'"]').textContent(),/并发回复乙/);
      await noteB.locator('[data-act="report"]').click();await b.page.waitForFunction(()=>document.getElementById('thMsg').textContent.includes('举报已受理'));assert.ok(repo.snapshot().some(([k])=>k.startsWith('rc_reports:')));
      await a.page.evaluate(()=>window.__failNext=true);await a.page.locator('.note[data-id="'+id+'"] [data-act="take"]').click();await a.page.waitForFunction(()=>RC.cloud.pending()===1);assert.equal(await a.page.locator('.note[data-id="'+id+'"]').count(),1);
      await a.page.locator('#thRetry').click();await a.page.waitForFunction(()=>RC.cloud.pending()===0);await refresh(b.page);assert.equal(await b.page.locator('.note[data-id="'+id+'"]').count(),0);await a.page.reload();await a.page.locator('#thConnect').click();await a.page.waitForFunction(()=>RC.cloud.ready);await refresh(a.page);assert.equal(await a.page.locator('.note[data-id="'+id+'"]').count(),0);
      assert.deepEqual(a.errors,[]);assert.deepEqual(b.errors,[]);await a.ctx.close();await b.ctx.close();
    });
    await scenario('storage failure retains form input and does not show success',async()=>{
      const {ctx,page}=await fresh();await page.goto(base+'/order.html');await page.locator('#fHandle').fill('存储测试');await page.locator('#catRow [data-v="工作"]').click();await page.locator('#fStory').fill('这段输入在保存失败时必须保留下来');
      await page.evaluate(()=>Storage.prototype.setItem=function(){throw Error('quota');});await page.locator('#orderForm button[type="submit"]').click();assert.equal(await page.locator('#orderForm').isVisible(),true);assert.equal(await page.locator('#storageError').isVisible(),true);assert.match(await page.locator('#fStory').inputValue(),/保留下来/);await ctx.close();
    });
    await scenario('profile page aggregates records, computes mirror and exports',async()=>{
      const {ctx,page,errors}=await fresh();
      await page.goto(base+'/profile.html');
      assert.equal(await page.locator('#profile-app .panel').count()>=4,true);
      assert.equal(await page.locator('#btnExportMd').isVisible(),true);
      /* 用真实的旧键数据模拟「已经用过一阵子」的访客，刷新后档案应当把它聚合出来 */
      await page.evaluate(()=>{
        RC.case.save({handle:'档案测试',story:'最近总梦见同一部电梯，楼层一直在变。'});
        RC.store.set('dreamLog',[{id:'d-1',date:'2026-09-10',title:'电梯',body:'楼层一直在变',mood:'还好',tag:'电梯',ts:Date.parse('2026-09-10')}]);
        RC.store.set('stamps',{enter:Date.parse('2026-09-01'),dream:Date.parse('2026-09-10')});
      });
      await page.reload();
      const text=await page.locator('#profile-app').textContent();
      assert.match(text,/档案测试|到店|梦境/);
      assert.match(text,/电梯/);
      const md=await page.evaluate(()=>RC.profile.toMarkdown());
      assert.match(md,/梦侦探档案/);
      assert.match(md,/电梯/);
      const json=JSON.parse(await page.evaluate(()=>RC.profile.toJSON()));
      assert.equal(json._format,'radio-club-profile');
      assert.equal(json.dreams.length,1);
      const [dl]=await Promise.all([page.waitForEvent('download',{timeout:8000}),page.locator('#btnExportMd').click()]);
      assert.match(dl.suggestedFilename(),/radio-club-archive-.*\.md$/);
      assert.deepEqual(errors,[]);
      await ctx.close();
    });
    await scenario('personality: 28 forced choices, boundary axes labelled honestly',async()=>{
      const {ctx,page,errors}=await fresh();
      await page.goto(base+'/personality.html');
      await page.locator('#pfmStart').click();
      /* 每维 7 题，前 4 题选前一句、后 3 题选后一句 —— 构造 4:3 的边界型 */
      for(let d=0;d<4;d++){for(let i=0;i<7;i++){await page.locator(i<4?'#pfmA':'#pfmB').click();}}
      await page.waitForSelector('#pfmType');
      assert.equal((await page.locator('#pfmType').textContent()).trim(),'ESTJ');
      assert.equal(await page.locator('.pfm-ax').count(),4);
      /* 边界型必须如实标注，而不是硬贴标签 */
      assert.match(await page.locator('#personality-app').textContent(),/基本持平/);
      const saved=await page.evaluate(()=>{const p=RC.store.get('profile',{});return p.personality&&p.personality.type;});
      assert.equal(saved,'ESTJ');
      /* 档案页读同一份档案 */
      await page.goto(base+'/profile.html');
      assert.match(await page.locator('#profile-app').textContent(),/ESTJ/);
      assert.deepEqual(errors,[]);
      await ctx.close();
    });
    await scenario('tarot: positional reading, draw logged once, share image downloads',async()=>{
      const {ctx,page,errors}=await fresh();
      await page.goto(base+'/tarot.html');
      await page.locator('[data-domain="work"]').click();
      await page.locator('#btnDeal').click();
      await page.locator('#btnFlipAll').click();
      await page.waitForSelector('#readPanel:not(.hidden)');
      assert.equal(await page.locator('#readTable tr').count(),5);
      /* 位置化解读：五张牌各自的位置口吻不同，且各带一句追问 */
      const txt=await page.locator('#readTable').textContent();
      assert.match(txt,/已经发生的那部分/);
      assert.match(txt,/挡在路上的，正是这一张/);
      assert.match(txt,/↳/);
      /* 抽牌写入档案 */
      assert.equal(await page.evaluate(()=>((RC.store.get('profile',{}).tarotDraws)||[]).length),1);
      /* 切换语言只重渲染，不重复记账 */
      await page.locator('.foot-lang').first().click();
      await page.waitForTimeout(250);
      assert.equal(await page.evaluate(()=>((RC.store.get('profile',{}).tarotDraws)||[]).length),1);
      /* 分享长图：真实下载事件 */
      const [dl]=await Promise.all([page.waitForEvent('download',{timeout:10000}),page.locator('#btnTarotImage').click()]);
      assert.match(dl.suggestedFilename(),/radio-club-tarot-.*\.png$/);
      assert.deepEqual(errors,[]);
      await ctx.close();
    });
    await scenario('cards page lists all 22 arcana with 2006 notes and filters',async()=>{
      const {ctx,page,errors}=await fresh();
      await page.goto(base+'/cards.html');
      assert.equal(await page.locator('.cd-cell').count(),22);
      await page.locator('.cd-cell').first().click();
      assert.equal(await page.locator('#cardDetail').isVisible(),true);
      assert.match(await page.locator('#cardDetail').textContent(),/2006/);
      await page.locator('.cd-filter .sb-btn').nth(1).click();
      const n=await page.locator('.cd-cell').count();
      assert.ok(n>0&&n<22,'元素筛选后应当只剩部分牌，实际 '+n);
      assert.deepEqual(errors,[]);
      await ctx.close();
    });
    await scenario('static server refuses repository internals',async()=>{for(const p of ['/.git/config','/cloudfunctions/treehole/index.js','/assets/%2e%2e/%2e%2e/package.json'])assert.equal((await fetch(base+p)).status,404);});
    fs.writeFileSync(path.join(__dirname,'artifacts/results.json'),JSON.stringify({passed:results},null,2));
    console.log(results.length+' browser scenarios passed');
  }finally{
    /* browser.close() 与 server.close() 可能被 keep-alive 连接吊死，必须加兜底并显式退出 */
    await Promise.race([browser.close().catch(()=>{}),new Promise(r=>setTimeout(r,3000))]);
    if(server.closeAllConnections)server.closeAllConnections();
    server.close();
  }
})().then(()=>process.exit(process.exitCode||0)).catch(e=>{console.error(e);process.exit(1);});
