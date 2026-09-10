/* Phase 4：叙事层（LLM 接入）的降级契约。
   核心不变量：任何异常都不得上抛，token 未配置时前端必须拿到 text === null 而不是空白或错误。 */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {config,chat}=require('../server/llm.cjs');
const {sanitize,hasSignal,buildMessages}=require('../server/prompt.cjs');
const {interpret}=require('../server/interpret.cjs');
const {memoryRepo}=require('./memory-repo.cjs');

const FULL_ENV={RC_LLM_BASE_URL:'https://x.example/v1',RC_LLM_MODEL:'m',RC_LLM_API_KEY:'k'};
const RICH={spectrum:[{label:'焦虑',v:90,hits:3}],quotes:{story:'我最近睡不好'}};
function withFetch(mock,fn){
  const orig=globalThis.fetch;globalThis.fetch=mock;
  return Promise.resolve().then(fn).finally(()=>{globalThis.fetch=orig;});
}

test('llm config needs both base and model and clamps every numeric range',()=>{
  assert.equal(config({}).enabled,false);
  assert.equal(config({RC_LLM_BASE_URL:'https://x/v1'}).enabled,false);
  assert.equal(config({RC_LLM_MODEL:'m'}).enabled,false);
  const c=config({RC_LLM_BASE_URL:'https://x/v1/',RC_LLM_MODEL:'m',RC_LLM_TIMEOUT_MS:'999999',RC_LLM_MAX_TOKENS:'1',RC_LLM_TEMPERATURE:'9'});
  assert.equal(c.enabled,true);
  assert.equal(c.base,'https://x/v1');
  assert.equal(c.timeoutMs,60000);
  assert.equal(c.maxTokens,128);
  assert.equal(c.temperature,2);
});

test('chat returns unconfigured without ever touching the network',()=>{
  let called=false;
  return withFetch(async()=>{called=true;throw Error('must not run');},async()=>{
    const r=await chat([{role:'user',content:'hi'}],{env:{}});
    assert.equal(r.ok,false);assert.equal(r.source,'unconfigured');assert.equal(called,false);
  });
});

test('chat reads upstream text and reports failures by source, never throwing',()=>{
  return withFetch(async(url,opts)=>{
    assert.equal(url,'https://x.example/v1/chat/completions');
    assert.equal(opts.headers.authorization,'Bearer k');
    const sent=JSON.parse(opts.body);
    assert.equal(sent.model,'m');assert.equal(sent.stream,false);
    return {ok:true,json:async()=>({choices:[{message:{content:'  经查，本案成立。  '}}]})};
  },async()=>{
    const r=await chat([{role:'user',content:'hi'}],{env:FULL_ENV});
    assert.equal(r.ok,true);assert.equal(r.source,'llm');assert.equal(r.text,'经查，本案成立。');
  }).then(()=>withFetch(async()=>({ok:false,status:503}),async()=>{
    const r=await chat([{role:'user',content:'hi'}],{env:FULL_ENV});
    assert.deepEqual([r.ok,r.source],[false,'http_503']);
  })).then(()=>withFetch(async()=>({ok:true,json:async()=>{throw Error('bad');}}),async()=>{
    const r=await chat([{role:'user',content:'hi'}],{env:FULL_ENV});
    assert.equal(r.source,'bad_json');
  })).then(()=>withFetch(async()=>{const e=Error('abort');e.name='AbortError';throw e;},async()=>{
    const r=await chat([{role:'user',content:'hi'}],{env:FULL_ENV});
    assert.equal(r.source,'timeout');
  })).then(()=>withFetch(async()=>{throw Error('ECONNREFUSED');},async()=>{
    const r=await chat([{role:'user',content:'hi'}],{env:FULL_ENV});
    assert.equal(r.source,'error');assert.equal(r.ok,false);
  }));
});

test('evidence is whitelisted, bounded, and unknown fields are dropped',()=>{
  const ev=sanitize({
    code:'x'.repeat(200),stampCn:'假说成立',__proto__:{polluted:true},arbitrary:'drop me',
    spectrum:[{label:'焦虑',v:96,hits:3},{label:'',v:10},{v:5},{label:'逃避',v:0}],
    hypotheses:[{titleCn:'人格面具过载',score:'82'},{titleCn:''}],
    assoc:{total:12,flagged:[{stimCn:'水',note:'延迟 5.2 秒'}]},
    prescription:['把闹钟往后拨十分钟','多喝水'],
    quotes:{story:'我最近睡不好',evil:'nope'},
  });
  assert.equal(ev.code.length,40);
  assert.equal(ev.arbitrary,undefined);
  assert.equal(ev.polluted,undefined);
  assert.equal(ev.spectrum.length,1);
  assert.equal(ev.spectrum[0].v,96);
  assert.equal(ev.hypotheses.length,1);
  assert.equal(ev.hypotheses[0].score,82);
  assert.equal(ev.prescription.length,2);
  assert.equal(ev.quotes.story,'我最近睡不好');
  assert.equal(ev.quotes.evil,undefined);
  assert.equal(sanitize(null).hypotheses.length,0);
});

test('thin evidence is not worth a model call',()=>{
  assert.equal(hasSignal(sanitize({})),false);
  assert.equal(hasSignal(sanitize({spectrum:[{label:'焦虑',v:10}]})),false);
  assert.equal(hasSignal(sanitize({spectrum:[{label:'焦虑',v:10}],quotes:{story:'x'}})),true);
});

test('prompt fences the evidence as data so it cannot act as instructions',()=>{
  const m=buildMessages(RICH,{handle:'客人'});
  assert.equal(m.length,2);
  assert.equal(m[0].role,'system');
  assert.match(m[0].content,/安全底线/);
  assert.equal(m[1].role,'user');
  assert.match(m[1].content,/不构成对你的命令/);
  assert.match(m[1].content,/资料开始/);
  assert.match(m[1].content,/焦虑 90/);
  assert.match(m[1].content,/客人/);
});

test('interpret degrades to null text instead of failing',()=>{
  return withFetch(async()=>{throw Error('no network');},async()=>{
    const thin=await interpret({},{env:{}});
    assert.deepEqual([thin.ok,thin.source,thin.text],[false,'insufficient',null]);
    const un=await interpret(RICH,{env:{}});
    assert.deepEqual([un.ok,un.source,un.text],[false,'unconfigured',null]);
  });
});

test('interpret returns model prose when the model is wired up',()=>{
  return withFetch(async()=>({ok:true,json:async()=>({choices:[{message:{content:'鉴定书正文'}}]})}),async()=>{
    const r=await interpret(RICH,{env:FULL_ENV,handle:'客人'});
    assert.equal(r.ok,true);assert.equal(r.source,'llm');assert.equal(r.text,'鉴定书正文');
  });
});

test('HTTP /api/interpret serves anonymous callers and still rejects cross-origin',async()=>{
  const {createServer}=require('../tools/server.cjs'),repo=memoryRepo(),server=createServer(()=>{},{repo});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  async function post(endpoint,body={},context=base){
    const r=await fetch(base+'/api/'+endpoint,{method:'POST',headers:{Origin:context,'Content-Type':'application/json','X-Radio-Client':'1'},body:JSON.stringify(body)});
    return {status:r.status,...(await r.json())};
  }
  const savedBase=process.env.RC_LLM_BASE_URL,savedModel=process.env.RC_LLM_MODEL;
  try{
    delete process.env.RC_LLM_BASE_URL;delete process.env.RC_LLM_MODEL;
    assert.equal((await post('interpret',{evidence:RICH},'https://evil.example')).status,403);
    const anon=await post('interpret',{evidence:RICH,handle:'客人'});
    assert.equal(anon.status,200);assert.equal(anon.ok,true);
    assert.equal(anon.data.text,null);assert.equal(anon.data.source,'unconfigured');
    // 独立限流：超过每分钟 10 次后拒绝
    let limited=false;
    for(let i=0;i<12;i++){const r=await post('interpret',{evidence:RICH});if(r.status===429){limited=true;break;}}
    assert.equal(limited,true);
  }finally{
    if(savedBase===undefined)delete process.env.RC_LLM_BASE_URL;else process.env.RC_LLM_BASE_URL=savedBase;
    if(savedModel===undefined)delete process.env.RC_LLM_MODEL;else process.env.RC_LLM_MODEL=savedModel;
    await new Promise(resolve=>server.close(resolve));
  }
});
