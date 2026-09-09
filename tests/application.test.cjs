const {test}=require('node:test'),assert=require('node:assert/strict');
const {application}=require('../cloudfunctions/treehole/application');const {memoryRepo}=require('./memory-repo.cjs');
test('private snapshots require consent, isolate owners and reject stale writes',async()=>{
  const handle=application(memoryRepo());
  const input={action:'profile:save',revision:0,snapshot:{case:{story:'private story'}}};
  await assert.rejects(handle(input,'a'),/CONSENT_REQUIRED/);
  await handle({...input,consent:true},'a');
  assert.equal((await handle({action:'profile:get'},'b')).snapshot,null);
  await assert.rejects(handle({...input,consent:true},'a'),/VERSION_CONFLICT/);
  assert.equal((await handle({action:'profile:get'},'a')).snapshot.case.story,'private story');
  await handle({action:'profile:delete',revision:1},'a');
  await assert.rejects(handle({...input,consent:true},'a'),/VERSION_CONFLICT/);
});
test('moderator removal clears replies and cannot be undone by stale publish retry',async()=>{
  const handle=application(memoryRepo(),{isAdmin:uid=>uid==='admin'});
  const publish={action:'publish',id:'note',operationId:'first',body:'test note'};
  await handle(publish,'a');await handle({action:'reply',id:'note',operationId:'reply',body:'reply'},'b');
  const {reportId}=await handle({action:'report',id:'note',operationId:'report'},'b');
  await assert.rejects(handle({action:'reports:list'},'b'),/FORBIDDEN/);
  await assert.rejects(handle({action:'reports:resolve',id:reportId,decision:'remove'},'b'),/FORBIDDEN/);
  assert.equal((await handle({action:'reports:list'},'admin')).reports.length,1);
  await handle({action:'reports:resolve',id:reportId,decision:'remove'},'admin');
  const {note}=await handle(publish,'a');assert.equal(note.bodyCn,'');assert.deepEqual(note.replies,[]);
  assert.equal((await handle({action:'reports:list'},'admin')).reports.length,0);
});
test('file transactions persist across restart and roll back failed writes',async()=>{
  const fs=require('node:fs'),path=require('node:path'),os=require('node:os');const {fileRepo}=require('../server/file-repo.cjs');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'radio-test-')),repo=fileRepo(dir);
  await repo.atomic(tx=>repo.set(tx,'sample','a',{value:1}));
  await assert.rejects(repo.atomic(async tx=>{await repo.set(tx,'sample','a',{value:2});throw Error('abort');}));
  assert.equal((await fileRepo(dir).get(null,'sample','a')).value,1);
  fs.unlinkSync(path.join(dir,'radio.json'));fs.rmdirSync(dir);
});
test('HTTP rejects cross-origin writes and supports owner recovery',async()=>{
  const {createServer}=require('../tools/server.cjs'),repo=memoryRepo(),server=createServer(()=>{},{repo});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
  async function post(endpoint,body={},cookie='',origin=base){const r=await fetch(base+'/api/'+endpoint,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Radio-Client':'1',Cookie:cookie},body:JSON.stringify(body)});return {status:r.status,cookie:r.headers.get('set-cookie')?.split(';')[0],...(await r.json())};}
  try{
    assert.equal((await post('session',{},'','https://evil.example')).status,403);
    assert.equal((await post('rpc',{action:'profile:get'})).status,401);
    const a=await post('session'),b=await post('session');assert.notEqual(a.data.uid,b.data.uid);
    const save=await post('rpc',{action:'profile:save',consent:true,revision:0,snapshot:{case:{story:'private'}}},a.cookie);assert.equal(save.ok,true);
    const code=(await post('recovery',{},a.cookie)).data.code;
    const recovered=await post('recover',{code});assert.equal(recovered.data.uid,a.data.uid);
    assert.equal((await post('rpc',{action:'profile:get'},recovered.cookie)).data.snapshot.case.story,'private');
    assert.equal((await post('rpc',{action:'profile:get'},b.cookie)).data.snapshot,null);
    assert.equal((await fetch(base+'/.data/radio.json')).status,404);
    const fresh=(await post('recovery',{},a.cookie)).data.code;
    assert.equal((await post('recover',{code})).error,'INVALID_RECOVERY');
    assert.equal((await post('recover',{code:fresh})).data.uid,a.data.uid);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
test('content edits require admin and reject concurrent stale changes',async()=>{
  const handle=application(memoryRepo(),{isAdmin:uid=>uid==='admin'});
  const event={action:'content:save',group:'chapters',id:'2',revision:0,value:{cn:'章节附注',jp:'追記'}};
  await assert.rejects(handle(event,'reader'),/FORBIDDEN/);
  await handle(event,'admin');
  await assert.rejects(handle(event,'admin'),/VERSION_CONFLICT/);
  assert.equal((await handle({action:'content:get'},'reader')).chapters['2'].cn,'章节附注');
});
