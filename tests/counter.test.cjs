const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const code=ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'../src/order-domain.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const context={exports:{}};vm.runInNewContext(code,context);const d=context.exports,ids=['milk','water','ramen'];
test('draft is distinct from confirmed orders, limits and repeat confirmation',()=>{
  const s=d.freshCounter();for(let i=0;i<6;i++)d.changeDraft(s,'milk',1,ids);
  assert.equal(s.tickets.length,0);assert.throws(()=>d.changeDraft(s,'milk',1,ids));
  d.changeDraft(s,'milk',-1,ids);d.confirmTicket(s,'ticket-1',1);
  assert.equal(s.tickets[0].items.milk,5);assert.equal(d.sum(s.draft),0);assert.throws(()=>d.confirmTicket(s,'ticket-2'));
  for(let i=0;i<8;i++)d.deliverOne(s,'ticket-1');assert.equal(s.tickets[0].served.milk,5);assert.equal(s.tickets[0].state,'done');
});
test('reload resumes partial delivery without duplicate plates',()=>{
  const s=d.freshCounter();d.changeDraft(s,'ramen',1,ids);d.changeDraft(s,'ramen',1,ids);d.confirmTicket(s,'ticket',1);d.deliverOne(s,'ticket');
  const restored=d.normalizeCounter(JSON.parse(JSON.stringify(s)),ids);assert.equal(restored.tickets[0].state,'serving');d.deliverOne(restored,'ticket');assert.equal(restored.tickets[0].served.ramen,2);assert.equal(restored.tickets[0].state,'done');
});
test('untrusted old storage is bounded and cannot introduce foreign items',()=>{
  const s=d.normalizeCounter({version:2,draft:{milk:100,water:1.5,'__proto__':4},tickets:[{id:'same',items:{ramen:400},served:{ramen:900},state:'serving'},{id:'same',items:{water:2}}]},ids);
  assert.equal(s.draft.milk,6);assert.equal(s.draft.water,undefined);assert.equal(s.tickets.length,1);assert.equal(s.tickets[0].served.ramen,6);assert.equal(s.tickets[0].state,'done');
  assert.equal(d.normalizeCounter({version:2,tickets:[null]},ids).tickets.length,0);
});
