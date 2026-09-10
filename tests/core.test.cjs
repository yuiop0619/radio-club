const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..');
function setup(){
  const data=new Map();let fail=false;
  const context=vm.createContext({console,TextEncoder,TextDecoder,btoa,atob,URLSearchParams,Uint8Array,document:{getElementById:()=>null,body:null},localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>{if(fail)throw Error('QUOTA');data.set(k,v);},removeItem:k=>data.delete(k)}});
  context.window=context;
  // 与浏览器一致的加载顺序：内容包（content/*.json 生成）必须最先到位
  for(const name of ['content-bundle','store','model','tarot-data','engine'])vm.runInContext(fs.readFileSync(path.join(ROOT,'assets/js/'+name+'.js'),'utf8'),context);
  return {RC:context.RC,fail:()=>{fail=true;},context,data};
}
test('every browser script parses',()=>{for(const f of fs.readdirSync(path.join(ROOT,'assets/js')))new vm.Script(fs.readFileSync(path.join(ROOT,'assets/js',f),'utf8'),{filename:f});});
test('invalid and legacy inputs normalize without throwing',()=>{
  const {RC}=setup();for(const input of [null,[],{tarot:[null,{id:999,pos:0,upright:true}]},{assoc:'bad',sct:[{i:'<svg>',a:'ok'}],analystLog:[null]}])assert.doesNotThrow(()=>RC.engine.buildVerdict(input));
  assert.throws(()=>RC.model.parse([]));assert.throws(()=>RC.model.parse({story:'x',assoc:{}}));assert.throws(()=>RC.model.parse({schemaVersion:99,story:'x'}));
  assert.equal(RC.model.normalize({birth:'2024-02-31'}).birth,'');
});
test('untrusted motifs, prototypes and oversized fields are removed',()=>{
  const {RC}=setup();const n=RC.model.parse(JSON.parse('{"story":"ok","__proto__":{"polluted":true},"analystLog":[{"m":"jung","motifs":["mirror","<svg onload=alert(1)>"]}]}'));
  assert.equal(n.analystLog[0].motifs.join(','),'mirror');assert.equal(n.polluted,undefined);assert.equal(RC.model.normalize({story:'a'.repeat(6000)}).story.length,4000);
});
test('SCT is included with one-based indices',()=>{
  const {RC}=setup(),r=RC.engine.buildVerdict({sct:[{i:999,qCn:'问题',a:'答案'}]});assert.equal(r.sct.rows[0].i,1);assert.equal(r.sct.rows[0].a,'答案');assert.equal(RC.engine.buildVerdict({}).sct,null);
});
test('all spread positions follow their selected template',()=>{
  const {RC}=setup();for(const [k,pos,expect] of [['timeLine',2,'未来'],['dailyCard',0,'今日一牌'],['pentagram',2,'隐藏动机']])assert.equal(RC.engine.buildVerdict({tarotSpread:k,tarot:[{id:0,pos,upright:true}]}).tarot[0].pos.cn,expect);
});
test('keyword counts deduplicate overlapping words and repeated dreams',()=>{
  const {RC}=setup(),count=c=>RC.engine.spectrum(c).find(s=>s.k==='anx');
  assert.equal(count({story:'不安'}).hits,1);assert.equal(count({story:'害怕'}).hits,1);assert.equal(count({story:'不安'}).v,31);
  assert.equal(count({dream:'不安',analystLog:[{m:'jung',dream:'不安'},{m:'freud',dream:'不安'}]}).hits,1);
  assert.equal(count({story:'我并不害怕。他说「不安」'}).hits,0);
});
test('no association data is not interpreted as personal evidence',()=>{const {RC}=setup();assert.match(RC.engine.assocProfile({}).summary,/未进行/);assert.equal(RC.engine.assocProfile({assoc:[{stim:'梦',resp:'answer',ms:6000,interrupted:true}]}).flagged.length,0);});
test('failed saves return failure without replacing the stored case',()=>{const {RC,fail}=setup();RC.case.save({story:'before'});fail();assert.equal(RC.case.save({story:'after'}),null);assert.equal(RC.case.get().story,'before');});
test('new case resets tests and preserves bounded history',()=>{const {RC}=setup();RC.case.save({story:'old',tarot:[{id:0,pos:0,upright:true}]});const before=RC.case.get().caseId;RC.case.start({story:'new'});assert.notEqual(RC.case.get().caseId,before);assert.equal(RC.case.get().tarot.length,0);assert.equal(RC.store.get('caseHistory')[0].story,'old');});
test('window.name fallback round-trips when storage unavailable',()=>{const {context}=setup();context.localStorage.setItem=()=>{throw Error('blocked');};vm.runInContext(fs.readFileSync(path.join(ROOT,'assets/js/store.js'),'utf8'),context);context.RC.case.save({story:'fallback'});assert.equal(context.RC.case.get().story,'fallback');assert.match(context.name,/fallback/);});
