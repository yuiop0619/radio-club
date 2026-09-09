import { defineStore } from 'pinia';
import { ref } from 'vue';
import { rc } from './legacy';
import { freshCounter, normalizeCounter, type Counter } from './order-domain';
const KEY='counter_v2';
const ids=rc.bar.menu.map(d=>d.id);
function load() {
  const saved=rc.store.get<unknown>(KEY,null);
  if(saved)return normalizeCounter(saved,ids);
  const s=freshCounter(), items:Record<string,number>={};
  for(const x of rc.bar.tray())if(x && ids.includes(x.id))items[x.id]=x.n;
  if(Object.keys(items).length)s.tickets=[{id:'legacy-order',createdAt:0,items,served:rc.bar.served(),state:'queued'}];
  s.seated=rc.store.get('cin',{seated:false}).seated;
  return normalizeCounter(s,ids);
}
export const useCounter=defineStore('counter',()=>{
  const state=ref(load()), error=ref('');
  async function update(fn:(s:Counter)=>void) {
    const commit=()=>{
      try {
        const next=load();fn(next);next.revision++;
        if(!rc.store.set(KEY,next))throw Error('保存失败，未提交更改。 / 保存できませんでした。');
        state.value=next;error.value='';return true;
      }catch(e){error.value=e instanceof Error?e.message:'保存失败';return false;}
    };
    return navigator.locks? navigator.locks.request('radio-counter',commit):commit();
  }
  window.addEventListener('storage',e=>{if(e.key==='rc_'+KEY)state.value=load();});
  return {state,error,update};
});
