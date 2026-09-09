<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { CHAPTERS } from './chapters';
import { rc } from './legacy';
import {siteContent} from './content';
const lang=ref(rc.i18n.lang());rc.i18n.onChange(()=>lang.value=rc.i18n.lang());
const t=(cn:string,jp:string)=>lang.value==='jp'?jp:cn;
// HTML comes exclusively from repository-owned chapter copy, never visitor data.
const pick=(v?:string[])=>v?.[lang.value==='jp'?0:1]||'';
interface Progress {last:number;read:number[];bookmarks:number[]}
function valid(n:unknown){return Number.isInteger(n)&&Number(n)>=1&&Number(n)<=5?Number(n):1;}
function clean(v:unknown){return Array.isArray(v)?[...new Set(v.filter(n=>Number.isInteger(n)&&n>=1&&n<=5))] as number[]:[];}
const saved=rc.store.get<Partial<Progress>>('archive_v2',{})||{};
const progress=ref<Progress>({last:valid(saved.last),read:clean(saved.read),bookmarks:clean(saved.bookmarks)});
const initial=new URLSearchParams(location.search).get('ch');
const current=ref(initial?valid(Number(initial)):progress.value.last),active=computed(()=>CHAPTERS[current.value-1]);
const opened=ref(true),maximized=ref(false),bookmarksOnly=ref(false),note=ref(''),lightbox=ref<HTMLDialogElement>();
const frequency=ref(88.6),playing=ref(false);let audio:AudioContext|undefined,oscillator:OscillatorNode|undefined;
const station=computed(()=>frequency.value<94?t('夜间天气 · 今夜无雨','夜の天気 · 今夜は晴れ'):frequency.value<102?t('午夜来信 · 有人在等你','真夜中の手紙 · 誰かが待っている'):t('梦境频段 · 请安静收听','夢の周波数 · 静かに耳を澄まして'));
function save(){const next={...progress.value,last:current.value,read:clean([...progress.value.read,current.value])};if(rc.store.set('archive_v2',next))progress.value=next;else note.value=t('阅读进度保存失败。','保存できません。');}
function go(n:number,push=true){if(n<1||n>5)return;current.value=n;opened.value=true;save();if(push)history.pushState(null,'','?ch='+n);}
function pop(){go(valid(Number(new URLSearchParams(location.search).get('ch'))),false);}
window.addEventListener('popstate',pop);save();
function bookmark(){const n=current.value,next={...progress.value,bookmarks:progress.value.bookmarks.includes(n)?progress.value.bookmarks.filter(id=>id!==n):[...progress.value.bookmarks,n]};if(rc.store.set('archive_v2',next))progress.value=next;else note.value=t('收藏保存失败。','保存できません。');}
async function sound(){if(playing.value){await audio?.suspend();playing.value=false;return;}try{if(!audio){audio=new AudioContext();oscillator=audio.createOscillator();const gain=audio.createGain();gain.gain.value=.012;oscillator.type='sine';oscillator.frequency.value=frequency.value*2;oscillator.connect(gain);gain.connect(audio.destination);oscillator.start();}await audio.resume();playing.value=true;}catch{note.value=t('浏览器暂时不能播放声音。','音声を再生できません。');}}
function tune(){if(audio&&oscillator)oscillator.frequency.setTargetAtTime(frequency.value*2,audio.currentTime,.08);}
onBeforeUnmount(()=>{window.removeEventListener('popstate',pop);audio?.close();});
</script>
<template>
<main class="archive-desktop">
  <header class="archive-heading"><div><span class="archive-kicker">RADIO CLUB / DIGITAL MEMORY</span><h1>2006<span> {{t('时光档案馆','時のアーカイブ')}}</span></h1><p>{{t('有些窗口关掉了，有些夜晚一直亮着。','閉じた窓もある。まだ明かりの灯る夜もある。')}}</p></div><a href="index.html">↗ {{t('回到今夜的吧台','今夜のカウンターへ')}}</a></header>
  <div class="archive-workspace"><aside class="archive-sidebar">
    <div class="archive-directory"><div class="retro-mini-title">▣ {{t('我的档案','マイアーカイブ')}}</div><p>{{t('已探索','探索済み')}} {{progress.read.length}} / 5</p><progress :value="progress.read.length" max="5" aria-label="章节探索进度"></progress><button class="bookmark-filter" :aria-pressed="bookmarksOnly" @click="bookmarksOnly=!bookmarksOnly">☆ {{t(bookmarksOnly?'显示全部档案':'只看收藏',bookmarksOnly?'すべて表示':'お気に入り')}}</button>
    <nav aria-label="章节档案"><button v-for="c in CHAPTERS.filter(c=>!bookmarksOnly||progress.bookmarks.includes(c.id))" :key="c.id" class="folder-button" :class="{active:current===c.id&&opened}" :aria-current="current===c.id?'page':undefined" @click="go(c.id)"><span class="folder-icon" aria-hidden="true">▰</span><span><small>FILE 0{{c.id}} {{progress.read.includes(c.id)?'✓':''}}</small>{{t(c.cn,c.jp)}}</span><b v-if="progress.bookmarks.includes(c.id)">☆</b></button></nav><p v-if="bookmarksOnly&&!progress.bookmarks.length">{{t('还没有收藏。打开一章，按下星星。','まだ空です。章を開いて星を押してください。')}}</p></div>
    <section class="archive-radio"><span class="radio-brand">RADIO CLUB / FM</span><output>{{Number(frequency).toFixed(1)}} <small>MHz</small></output><label for="radio-dial">{{t('转动旋钮，寻找一个频段','周波数を合わせる')}}</label><input id="radio-dial" type="range" min="88" max="108" step="0.1" v-model.number="frequency" @input="tune"><p>{{station}}</p><button :aria-pressed="playing" @click="sound">{{t(playing?'关闭声音':'打开调频音',playing?'音声をオフ':'チューニング音をオン')}}</button><small>{{t('本地合成调频音，不连接电台','ローカル合成音・ラジオ配信ではありません')}}</small></section>
  </aside>
  <section v-if="opened" class="archive-window" :class="{maximized}" aria-label="2006档案窗口">
    <div class="retro-titlebar"><span>▣ {{active.winName}}</span><div><button :aria-label="t('最小化','最小化')" @click="opened=false">_</button><button :aria-label="t('切换窗口大小','ウィンドウサイズ')" :aria-pressed="maximized" @click="maximized=!maximized">□</button><button :aria-label="t('关闭档案','閉じる')" @click="opened=false">×</button></div></div>
    <div class="retro-toolbar"><button :disabled="current===1" @click="go(current-1)">← {{t('上一章','前章')}}</button><button :disabled="current===5" @click="go(current+1)">{{t('下一章','次章')}} →</button><button @click="bookmark" :aria-pressed="progress.bookmarks.includes(current)">{{progress.bookmarks.includes(current)?'★':'☆'}} {{t('收藏','保存')}}</button><button @click="rc.i18n.toggle()">中 / JP</button></div>
    <div class="retro-address"><span>{{t('地址','アドレス')}}</span><output>radio-club://memories/2006/0{{current}}</output></div>
    <article :key="current" class="archive-document"><div class="archive-doc-number">ARCHIVE / 0{{current}}<span>2006.11 — 2006.12</span></div><h2>{{t(active.cn,active.jp)}}</h2><p class="archive-sub" v-html="pick(active.sub)"></p>
      <figure><button class="archive-photo" :aria-label="t('放大照片','写真を拡大')" @click="lightbox?.showModal()"><img :src="active.img" :alt="pick(active.imgCap)"><span>＋ {{t('查看照片','写真を見る')}}</span></button><figcaption>{{pick(active.imgCap)}}</figcaption></figure>
      <p v-if="siteContent.chapters[current]" class="archive-letter">{{t(siteContent.chapters[current].cn,siteContent.chapters[current].jp)}}</p>
      <div v-if="active.lede" class="archive-letter" v-html="pick(active.lede)"></div>
      <section class="archive-news"><h3>What's New <small>{{t('那些夜晚的更新','あの夜の更新')}}</small></h3><ul><li v-for="(row,i) in active.whatsnew" :key="i" v-html="pick(row)"></li></ul></section>
      <details v-if="active.master1" class="archive-envelope" open><summary>✉ {{t('来自店主的一封信','店主からの手紙')}}</summary><p v-html="pick(active.master1)"></p><p v-html="pick(active.master2)"></p><p v-html="pick(active.master3)"></p></details>
      <section class="archive-guests"><h3>{{t('常客留下的声音','常連の声')}} <small>GUESTBOOK / {{t('故事中的留言','物語の書き込み')}}</small></h3><details v-for="(row,i) in active.guests" :key="i"><summary>{{t('展开留言','書き込みを開く')}} 0{{i+1}}</summary><div v-html="pick(row)"></div></details></section>
      <p v-if="active.coda" class="archive-coda" v-html="pick(active.coda)"></p><footer class="archive-doc-footer"><span>{{t('你已经来过这里。','ここに来たことがある。')}}</span><button v-if="current<5" @click="go(current+1)">{{t('打开下一份档案','次のファイルへ')}} ↗</button><a v-else href="index.html">{{t('回到吧台','カウンターへ')}} ↗</a></footer>
    </article><div class="retro-status"><span>✓ {{t('档案已载入','読み込み完了')}}</span><span>{{current}} / 5 · {{t('保存在这台设备','この端末に保存')}}</span></div>
  </section><div v-else class="archive-empty"><span>▣</span><h2>{{t('窗口关上了，故事还在。','窓は閉じても、物語は残る。')}}</h2><button @click="opened=true">{{t('继续阅读','続きを読む')}} · {{t(active.cn,active.jp)}}</button></div></div>
  <footer class="archive-taskbar"><button @click="opened=!opened">▣ RADIO CLUB 2006</button><a href="account.html">{{t('保存与同步','保存と同期')}}</a><span>23:06</span></footer><p v-if="note" role="alert">{{note}}</p>
  <dialog ref="lightbox" class="archive-lightbox" :aria-label="t('档案照片','アーカイブ写真')" @click="e=>{if(e.target===lightbox)lightbox?.close()}"><button :aria-label="t('关闭照片','写真を閉じる')" @click="lightbox?.close()">×</button><img :src="active.img.replace('-768.webp','.png')" :alt="pick(active.imgCap)"><p>{{pick(active.imgCap)}}</p></dialog>
</main>
</template>
