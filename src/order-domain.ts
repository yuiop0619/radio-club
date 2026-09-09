export type Quantities = Record<string, number>;
export interface Ticket { id: string; createdAt: number; items: Quantities; served: Quantities; state: 'queued'|'serving'|'done' }
export interface Counter { version: 2; revision: number; seated: boolean; draft: Quantities; tickets: Ticket[] }
export const freshCounter = (): Counter => ({version:2,revision:0,seated:false,draft:{},tickets:[]});
export const sum = (q: Quantities) => Object.values(q).reduce((a,b)=>a+b,0);
export function quantities(input: unknown, ids: string[], limit=12): Quantities {
  const result: Quantities = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return result;
  for (const id of ids) {
    const n = (input as Quantities)[id];
    if (Number.isSafeInteger(n) && n > 0) result[id] = Math.min(n,6,Math.max(0,limit-sum(result)));
    if (!result[id]) delete result[id];
  }
  return result;
}
export function normalizeCounter(input: unknown, ids: string[]): Counter {
  const x = input as Partial<Counter> | null;
  if (!x || x.version !== 2) return freshCounter();
  const seen = new Set<string>(); let remaining=30;
  const tickets:Ticket[]=[];
  for (const t of Array.isArray(x.tickets)?x.tickets.slice(-20):[]) {
    if (!t || typeof t.id!=='string' || !/^[\w-]{1,80}$/.test(t.id) || seen.has(t.id)) continue;
    const items=quantities(t.items,ids,remaining); remaining-=sum(items);
    if (!sum(items)) continue;
    seen.add(t.id);
    const served=quantities(t.served,ids);
    for (const id of Object.keys(served)) { served[id]=Math.min(served[id],items[id]||0); if(!served[id])delete served[id]; }
    tickets.push({id:t.id,createdAt:Number.isFinite(t.createdAt)?t.createdAt:0,items,served,state:sum(served)===sum(items)?'done':t.state==='serving'?'serving':'queued'});
  }
  return {version:2,revision:Number.isSafeInteger(x.revision)?x.revision!:0,seated:x.seated===true,draft:quantities(x.draft,ids),tickets};
}
export function changeDraft(s: Counter,id:string,delta:number,ids:string[]) {
  if (!ids.includes(id)) return;
  const n=(s.draft[id]||0)+delta;
  if(n>6 || (delta>0 && sum(s.draft)>=12)) throw Error('每种最多 6 份，每单最多 12 份。 / 1種類6点、1注文12点まで。');
  if(n<=0)delete s.draft[id];else s.draft[id]=n;
}
export function confirmTicket(s: Counter,id:string,now=Date.now()) {
  if(!sum(s.draft))throw Error('请先选一份喜欢的。 / まず一品選んでください。');
  if(s.tickets.reduce((n,t)=>n+sum(t.items),0)+sum(s.draft)>30)throw Error('吧台有点满了，请先收起已上桌的餐具。 / 先に食器を片付けてください。');
  s.tickets.push({id,createdAt:now,items:{...s.draft},served:{},state:'queued'});s.draft={};
}
export function deliverOne(s:Counter,ticketId:string) {
  const t=s.tickets.find(t=>t.id===ticketId);if(!t||t.state==='done')return;
  const id=Object.keys(t.items).find(id=>(t.served[id]||0)<t.items[id]);
  if(id)t.served[id]=(t.served[id]||0)+1;
  t.state=sum(t.served)===sum(t.items)?'done':'serving';
}
