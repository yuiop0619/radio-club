import {ref} from 'vue';
import {rc} from './legacy';
export interface SiteContent {revision:number;items:Record<string,Record<string,string>>;chapters:Record<string,{cn:string;jp:string}>}
export const siteContent=ref<SiteContent>({revision:0,items:{},chapters:{}});
export async function loadContent(){
  try{
    const response=await fetch('/api/content',{signal:AbortSignal.timeout(2500)});if(!response.ok)return;
    const {data}=await response.json();if(!data?.items||!data?.chapters)return;
    siteContent.value=data;
    for(const d of rc.bar.menu){const item=data.items[d.id];if(!item)continue;for(const k of ['cn','jp','desc','descJp','line','lineJp'] as const)if(typeof item[k]==='string'&&item[k])d[k]=item[k];}
  }catch{/* Static hosting and offline visits keep the bundled story and menu. */}
}
