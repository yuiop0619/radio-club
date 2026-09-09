<script setup lang="ts">
import {computed,ref} from 'vue';
import {rc} from './legacy';
import {normalizeCounter} from './order-domain';
import ContentEditor from './ContentEditor.vue';
type Snapshot=Record<string,Record<string,unknown>>;
interface Profile {revision:number;updatedAt?:number;snapshot:Snapshot|null}
interface Report {id:string;noteId:string;body:string;reason:string}
const lang=ref(rc.i18n.lang());rc.i18n.onChange(()=>lang.value=rc.i18n.lang());const t=(cn:string,jp:string)=>lang.value==='jp'?jp:cn;
const uid=ref(''),admin=ref(false),busy=ref(false),message=ref(''),consent=ref(false),withStory=ref(false),restoreConsent=ref(false),remote=ref<Profile>({revision:0,snapshot:null}),code=ref(''),recovery=ref(''),reports=ref<Report[]>([]);
const local=(window as unknown as {RC_CLOUD_CONFIG?:{transport?:string}}).RC_CLOUD_CONFIG?.transport==='local';
const cloud=(window as unknown as {RC:{cloud:{connect():Promise<void>;request<T>(body:unknown):Promise<T>}}}).RC.cloud;
const errors:Record<string,string>={VERSION_CONFLICT:'另一台设备已更新记录。请先重新查看服务器记录，再决定保存。',AUTH_REQUIRED:'请先连接服务。',INVALID_RECOVERY:'恢复码不正确。',FORBIDDEN:'当前身份没有管理权限。',RATE_LIMIT:'操作较频繁，请稍后再试。'};
async function request<T>(path:string,body:unknown):Promise<T>{const r=await fetch('/api/'+path,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Radio-Client':'1'},body:JSON.stringify(body)});const result=await r.json();if(!result.ok)throw Error(result.error);return result.data;}
async function run(fn:()=>Promise<void>){if(busy.value)return;busy.value=true;message.value='';try{await fn();}catch(e){const text=e instanceof Error?e.message:String(e);message.value=(errors[text]||text)+' / '+t('操作未完成','操作を完了できませんでした');}finally{busy.value=false;}}
async function connect(){await cloud.connect();const r=await cloud.request<{uid:string;isAdmin:boolean}>({action:'hello'});uid.value=r.uid;admin.value=r.isAdmin;await read();}
async function read(){remote.value=await cloud.request<Profile>({action:'profile:get'});restoreConsent.value=false;message.value=t('已读取服务器记录，不会自动覆盖本机。','サーバーの記録を確認しました。端末の記録は変更しません。');}
function snapshot():Snapshot{const s:Snapshot={counter_v2:rc.store.get('counter_v2',{}),archive_v2:rc.store.get('archive_v2',{})};if(withStory.value)s.case=rc.case.get();return s;}
async function upload(){if(!consent.value)return;remote.value=await cloud.request<Profile>({action:'profile:save',revision:remote.value.revision,consent:true,snapshot:snapshot()});message.value=t('这份记录已保存到服务器。','サーバーに保存しました。');}
const remoteKeys=computed(()=>Object.keys(remote.value.snapshot||{}).map(k=>({case:t('故事与探索记录','物語と探索記録'),counter_v2:t('点餐记录','注文記録'),archive_v2:t('章节进度与收藏','章とお気に入り')}[k]||k)).join(' · '));
function restore(){
  if(!restoreConsent.value||!remote.value.snapshot)return;
  const incoming=remote.value.snapshot,updates:Record<string,unknown>={};
  if(incoming.case)updates.case=rc.model.normalize(incoming.case);
  if(incoming.counter_v2)updates.counter_v2=normalizeCounter(incoming.counter_v2,rc.bar.menu.map(d=>d.id));
  if(incoming.archive_v2){const a=incoming.archive_v2;const clean=(v:unknown)=>Array.isArray(v)?[...new Set(v.filter(n=>Number.isInteger(n)&&n>=1&&n<=5))]:[];updates.archive_v2={last:Math.min(5,Math.max(1,Number(a.last)||1)),read:clean(a.read),bookmarks:clean(a.bookmarks)};}
  const previous=Object.fromEntries(Object.keys(updates).map(k=>[k,rc.store.get(k,null)]));
  if(!rc.store.set('before_restore',previous))throw Error('无法保存本机恢复点。');
  for(const [k,value] of Object.entries(updates))if(!rc.store.set(k,value)){for(const [key,old] of Object.entries(previous))rc.store.set(key,old);throw Error('恢复失败，已尝试回滚；原记录还保存在恢复点中。');}
  message.value=t('记录已恢复。重新打开吧台或档案馆即可看到。','復元しました。カウンターやアーカイブを開き直してください。');restoreConsent.value=false;
}
function download(previous=false){const value=previous?rc.store.get('before_restore',{}):snapshot();const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),snapshot:value},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=previous?'radio-club-before-restore.json':'radio-club-records.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function recover(){
  if(rc.store.get<unknown[]>('hole_queue',[]).length)throw Error('请先在树洞处理待同步操作，再切换身份。');
  await request('recover',{code:recovery.value.trim()});recovery.value='';location.reload();
}
async function loadReports(){reports.value=(await cloud.request<{reports:Report[]}>({action:'reports:list'})).reports;}
async function resolve(id:string,decision:string){await cloud.request({action:'reports:resolve',id,decision});await loadReports();message.value=t('举报已处理。','報告を処理しました。');}
</script>
<template>
<main class="account-panel"><header><span>RADIO CLUB / YOUR RECORDS</span><button class="lang-switch" @click="rc.i18n.toggle()">中 / JP</button><h1>{{t('把今晚，留到下次。','今夜を、次の夜へ。')}}</h1><p>{{t('默认只保存在这台设备。你决定什么时候备份、同步，以及带走哪些内容。','通常はこの端末だけに保存。バックアップする内容とタイミングはあなたが選びます。')}}</p><nav><a href="index.html">← {{t('回到吧台','カウンターへ')}}</a><a href="about2006.html">2006 {{t('档案馆','アーカイブ')}}</a><a href="bbs.html">{{t('树洞','ツリーホール')}}</a></nav></header>
<section><h2>01 / {{t('选择带走的记录','保存する記録')}}</h2><p>{{t('点餐、章节进度与收藏会包含在备份中。','注文、章の進捗、お気に入りが含まれます。')}}</p><label><input type="checkbox" v-model="withStory">{{t('同时包含我的故事、梦境和探索原文','物語・夢・探索の原文も含める')}}</label><div class="account-actions"><button @click="download()">{{t('下载本机备份','端末のバックアップを保存')}}</button><button @click="download(true)">{{t('下载上次恢复前的记录','復元前の記録を保存')}}</button></div></section>
<section><h2>02 / {{t('连接你的记录柜','記録庫に接続')}}</h2><p>{{local?t('当前使用本站的 Node 服务。本机预览中的“服务器”就在这台电脑上。','このサイトの Node サービスを使用。ローカルプレビューではこのパソコンがサーバーです。'):t('使用站点配置的云服务。','設定済みのクラウドサービスを使用します。')}}</p><button :disabled="busy" @click="run(connect)">{{t(uid?'重新连接':'连接服务',uid?'再接続':'接続する')}}</button><p v-if="uid" class="identity">{{t('当前身份','現在のID')}}：{{uid}}</p><template v-if="uid"><label><input type="checkbox" v-model="consent">{{t('我同意将以上所选记录保存到本站服务器','選択した記録をこのサイトのサーバーに保存することに同意します')}}</label><div class="account-actions"><button :disabled="busy||!consent" @click="run(upload)">{{t('保存这份记录','この記録を保存')}}</button><button :disabled="busy" @click="run(read)">{{t('查看服务器记录','サーバーの記録を確認')}}</button></div><div v-if="remote.snapshot" class="remote-preview"><strong>{{t('服务器版本','サーバー版')}} {{remote.revision}}</strong><p>{{remoteKeys}}</p><p>{{remote.updatedAt?new Date(remote.updatedAt).toLocaleString():''}}</p><label><input type="checkbox" v-model="restoreConsent">{{t('用这份记录替换本机对应内容，并保留恢复前备份','対応する端末データを置き換え、復元前のバックアップを残す')}}</label><button :disabled="busy||!restoreConsent" @click="run(async()=>restore())">{{t('恢复到本机','端末に復元')}}</button></div><p v-else>{{t('服务器还没有你的备份。','サーバーにバックアップはありません。')}}</p></template></section>
<section v-if="local"><h2>03 / {{t('在另一台设备继续','別の端末で続ける')}}</h2><p>{{t('恢复码相当于记录柜的钥匙。请私下保存，不要发送到树洞或公开分享。两台设备需要连接同一个已部署的服务地址。','復元コードは記録庫の鍵です。非公開で保管し、同じサービスに接続した端末で使用してください。')}}</p><button :disabled="busy||!uid" @click="run(async()=>{code=(await request<{code:string}>('recovery',{})).code})">{{t('生成恢复码','復元コードを作成')}}</button><label v-if="code">{{t('请保存恢复码','復元コードを保管')}}<input :value="code" readonly @focus="($event.target as HTMLInputElement).select()"></label><form @submit.prevent="run(recover)"><label for="recovery-code">{{t('已有恢复码','復元コードをお持ちの方')}}</label><input id="recovery-code" type="password" v-model="recovery" autocomplete="off" placeholder="rc-…"><button :disabled="busy||!recovery">{{t('恢复身份','IDを復元')}}</button></form></section>
<section v-if="admin"><h2>{{t('店主管理 · 举报审核','店主管理 · 報告審査')}}</h2><button :disabled="busy" @click="run(loadReports)">{{t('读取待处理举报','未処理の報告を確認')}}</button><article v-for="r in reports" :key="r.id" class="report-card"><p>{{r.body}}</p><p>{{r.reason}}</p><div class="account-actions"><button :disabled="busy" @click="run(()=>resolve(r.id,'dismiss'))">{{t('保留纸条 · 完成审核','投稿を残す')}}</button><button :disabled="busy" @click="run(()=>resolve(r.id,'remove'))">{{t('撤下纸条及回复','投稿と返信を取り下げる')}}</button></div></article></section>
<ContentEditor v-if="admin" :request="cloud.request" />
<p class="account-status" role="status">{{busy?t('正在处理……','処理中…'):message}}</p>
</main>
</template>
<style>
body.account-page{margin:0;background:#171812;color:#e6dcc6;font-family:Georgia,'SimSun',serif}.account-panel{max-width:860px;margin:0 auto;padding:60px 24px 100px}.account-panel header>span{font:10px monospace;letter-spacing:3px;color:#ab9870}.account-panel h1{font-weight:400;font-size:38px;letter-spacing:3px}.account-panel p{font-size:13px;line-height:1.9;color:#acaa95}.account-panel nav{display:flex;gap:25px;flex-wrap:wrap;margin:25px 0 45px}.account-panel a{color:#d7c297;font-size:12px}.account-panel section{border-top:1px solid #51513d;padding:25px 0}.account-panel h2{font-weight:400;font-size:21px}.account-panel label{display:block;font-size:13px;line-height:1.8;margin:18px 0;color:#d6d1b9}.account-panel input[type=checkbox]{accent-color:#bfad74;margin-right:10px}.account-panel input:not([type=checkbox]){display:block;width:100%;box-sizing:border-box;background:#0f110e;border:1px solid #605d43;color:#e3d6b1;padding:12px;margin:12px 0;font:13px monospace}.account-panel button{background:#cbb785;color:#272516;border:1px solid #cbb785;padding:12px 17px;font:12px inherit;cursor:pointer;min-height:42px}.account-panel button:disabled{opacity:.4;cursor:default}.account-actions{display:flex;gap:12px;flex-wrap:wrap;margin:20px 0}.account-actions button+button{background:transparent;color:#cbb785}.remote-preview,.report-card{padding:20px;background:#22271d;border:1px solid #50543c;margin-top:20px}.account-panel .identity{overflow-wrap:anywhere;font:11px monospace;color:#8f987b}.account-status{position:sticky;bottom:10px;background:#2e3525;padding:18px;box-shadow:0 4px 20px #0005}.account-status:empty{display:none}.lang-switch{float:right}.account-panel button:focus-visible,.account-panel a:focus-visible{outline:3px solid #e1b850;outline-offset:3px}@media(max-width:600px){.account-panel{padding:35px 20px 70px}.account-panel h1{font-size:28px}.account-panel nav{gap:18px}.account-panel header>span{font-size:8px;letter-spacing:1px}}
</style>
