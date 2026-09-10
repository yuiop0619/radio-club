import {createApp} from 'vue';
import {createPinia} from 'pinia';
import {rc} from './legacy';
import {loadContent} from './content';

// `crypto.randomUUID()` 仅在安全上下文（HTTPS / localhost）下存在；
// IP 直访（http://101.42.158.132:8080）会报 "is not a function"。
// 用 getRandomValues 拼一个 v4 兜底，覆盖所有上下文。
if(typeof window!=='undefined' && window.crypto && typeof window.crypto.randomUUID!=='function'){
  Object.defineProperty(window.crypto,'randomUUID',{configurable:true,writable:true,value:function(){
    const c=window.crypto as Crypto;const b=new Uint8Array(16);c.getRandomValues(b);
    b[6]=(b[6]&0x0f)|0x40;b[8]=(b[8]&0x3f)|0x80;
    const h=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
    return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
  }});
}
if(document.getElementById('bar-app')) {
  rc.ui.chrome({title:rc.i18n.t('counter'),path:'index.html'});
  document.getElementById('navMount')!.innerHTML=rc.ui.nav('index.html');
  document.getElementById('footMount')!.innerHTML=rc.ui.siteFoot({active:'index.html'});
  await loadContent();const {default:Scene}=await import('./CounterScene.vue');await import('./counter.css');
  createApp(Scene).use(createPinia()).mount('#bar-app');
  const puppet=document.getElementById('heroPuppet');
  // 「进店」落点是吧台上那台鉴定机（核心入口），场景紧接在它下面
  const enter=()=>document.getElementById('rcMachine')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  puppet?.addEventListener('click',enter);puppet?.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();enter();}});
}
if(document.getElementById('archive-app')) {
  await loadContent();const {default:Archive}=await import('./ArchiveDesktop.vue');await import('./archive.css');createApp(Archive).mount('#archive-app');
}
if(document.getElementById('account-app')) {
  const {default:Account}=await import('./AccountPanel.vue');createApp(Account).mount('#account-app');
}
if(document.getElementById('verdict-app')) {
  rc.ui.chrome({title:rc.i18n.t('verdict'),path:'verdict.html'});
  document.getElementById('navMount')!.innerHTML=rc.ui.nav('verdict.html');
  document.getElementById('footMount')!.innerHTML=rc.ui.siteFoot({active:'verdict.html'});
  const {default:Verdict}=await import('./VerdictPage.vue');createApp(Verdict).mount('#verdict-app');
}
if(document.getElementById('masters-app')) {
  rc.ui.chrome({title:rc.i18n.t('gallery'),path:'masters.html'});
  document.getElementById('navMount')!.innerHTML=rc.ui.nav('masters.html');
  document.getElementById('footMount')!.innerHTML=rc.ui.siteFoot({active:'masters.html'});
  const {default:Masters}=await import('./MastersGallery.vue');createApp(Masters).mount('#masters-app');
}
if(document.getElementById('dreams-app')) {
  rc.ui.chrome({title:rc.i18n.t('dreams'),path:'dreams.html'});
  document.getElementById('navMount')!.innerHTML=rc.ui.nav('dreams.html');
  document.getElementById('footMount')!.innerHTML=rc.ui.siteFoot({active:'dreams.html'});
  const {default:Dreams}=await import('./DreamsJournal.vue');createApp(Dreams).mount('#dreams-app');
}
if(document.getElementById('psyche-app')) {
  rc.ui.chrome({title:rc.i18n.t('psyche'),path:'psyche.html'});
  document.getElementById('navMount')!.innerHTML=rc.ui.nav('psyche.html');
  document.getElementById('footMount')!.innerHTML=rc.ui.siteFoot({active:'psyche.html'});
  const {default:Psyche}=await import('./PsychePage.vue');createApp(Psyche).mount('#psyche-app');
}
if(document.getElementById('order-app')) {
  rc.ui.chrome({title:rc.i18n.t('order'),path:'order.html'});
  document.getElementById('navMount')!.innerHTML=rc.ui.nav('order.html');
  document.getElementById('footMount')!.innerHTML=rc.ui.siteFoot({active:'order.html'});
  const {default:Order}=await import('./OrderPage.vue');createApp(Order).mount('#order-app');
}
if(document.getElementById('tarot-app')) {
  rc.ui.chrome({title:rc.i18n.t('tarot'),path:'tarot.html'});
  document.getElementById('navMount')!.innerHTML=rc.ui.nav('tarot.html');
  document.getElementById('footMount')!.innerHTML=rc.ui.siteFoot({active:'tarot.html'});
  const {default:Tarot}=await import('./TarotPage.vue');createApp(Tarot).mount('#tarot-app');
}
if(document.getElementById('profile-app')) {
  rc.ui.chrome({title:rc.i18n.t('profileT'),path:'profile.html'});
  document.getElementById('navMount')!.innerHTML=rc.ui.nav('profile.html');
  document.getElementById('footMount')!.innerHTML=rc.ui.siteFoot({active:'profile.html'});
  const {default:Profile}=await import('./ProfilePage.vue');createApp(Profile).mount('#profile-app');
}
if(document.getElementById('personality-app')) {
  rc.ui.chrome({title:rc.i18n.t('pfmTitle'),path:'personality.html'});
  document.getElementById('navMount')!.innerHTML=rc.ui.nav('personality.html');
  document.getElementById('footMount')!.innerHTML=rc.ui.siteFoot({active:'personality.html'});
  const {default:Personality}=await import('./PersonalityPage.vue');createApp(Personality).mount('#personality-app');
}
if(document.getElementById('cards-app')) {
  rc.ui.chrome({title:rc.i18n.t('cardsTitle'),path:'cards.html'});
  document.getElementById('navMount')!.innerHTML=rc.ui.nav('cards.html');
  document.getElementById('footMount')!.innerHTML=rc.ui.siteFoot({active:'cards.html'});
  const {default:Cards}=await import('./TarotCards.vue');createApp(Cards).mount('#cards-app');
}
