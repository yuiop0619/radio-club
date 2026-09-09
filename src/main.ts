import {createApp} from 'vue';
import {createPinia} from 'pinia';
import {rc} from './legacy';
import {loadContent} from './content';
if(document.getElementById('bar-app')) {
  rc.ui.chrome({title:rc.i18n.t('counter'),path:'index.html'});
  document.getElementById('navMount')!.innerHTML=rc.ui.nav('index.html');
  document.getElementById('footMount')!.innerHTML=rc.ui.siteFoot({active:'index.html'});
  await loadContent();const {default:Scene}=await import('./CounterScene.vue');await import('./counter.css');
  createApp(Scene).use(createPinia()).mount('#bar-app');
  const puppet=document.getElementById('heroPuppet');
  const enter=()=>document.getElementById('bar-app')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  puppet?.addEventListener('click',enter);puppet?.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();enter();}});
}
if(document.getElementById('archive-app')) {
  await loadContent();const {default:Archive}=await import('./ArchiveDesktop.vue');await import('./archive.css');createApp(Archive).mount('#archive-app');
}
if(document.getElementById('account-app')) {
  const {default:Account}=await import('./AccountPanel.vue');createApp(Account).mount('#account-app');
}
