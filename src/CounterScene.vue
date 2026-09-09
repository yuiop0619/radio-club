<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { rc, type Dish } from './legacy';
import { useCounter } from './counter-store';
import { changeDraft, confirmTicket, deliverOne, sum } from './order-domain';
const counter=useCounter();
const lang=ref(rc.i18n.lang());rc.i18n.onChange(()=>lang.value=rc.i18n.lang());
const t=(cn:string,jp:string)=>lang.value==='jp'?jp:cn;
const name=(d:Dish)=>t(d.cn,d.jp), menu=rc.bar.menu, ids=menu.map(d=>d.id);
const menuDialog=ref<HTMLDialogElement>(), category=ref('all'), selected=ref(menu[1]), receipt=ref<HTMLElement>();
const message=ref(''), tasted=ref(''), reduced=ref(matchMedia('(prefers-reduced-motion: reduce)').matches);
const filtered=computed(()=>menu.filter(d=>category.value==='all'||(category.value==='soft'?d.kind==='drink'&&!d.alc:d.kind===category.value)));
const draftCount=computed(()=>sum(counter.state.draft));
const pending=computed(()=>counter.state.tickets.filter(o=>o.state!=='done'));
const table=computed(()=>counter.state.tickets.flatMap(o=>Object.entries(o.served).flatMap(([id,n])=>Array.from({length:n},(_,i)=>({key:o.id+'-'+id+'-'+i,dish:menu.find(d=>d.id===id)!})))).filter(x=>x.dish));
const pendingCount=computed(()=>pending.value.reduce((n,o)=>n+sum(o.items)-sum(o.served),0));
const busy=ref(false);let deliveryTimer:ReturnType<typeof setTimeout>|undefined;let stopped=false;
async function enter(){if(await counter.update(s=>{s.seated=true;}))openMenu();}
function openMenu(){menuDialog.value?.showModal();}
function closeMenu(){menuDialog.value?.close();}
async function add(d:Dish,event?:MouseEvent){
  selected.value=d;
  if(!await counter.update(s=>changeDraft(s,d.id,1,ids)))return;
  if(event&&!reduced.value&&receipt.value){
    const from=(event.currentTarget as HTMLElement).getBoundingClientRect(), to=receipt.value.getBoundingClientRect();
    const dot=document.createElement('span');dot.className='order-flight';dot.textContent='✦';menuDialog.value?.append(dot);
    const modal=menuDialog.value!.getBoundingClientRect();
    dot.style.left=(from.x-modal.x)+'px';dot.style.top=(from.y-modal.y)+'px';
    dot.animate([{transform:'translate(0,0) scale(1)',opacity:1},{transform:`translate(${to.x-from.x}px,${to.y-from.y}px) scale(.4)`,opacity:0}],{duration:460,easing:'cubic-bezier(.2,.8,.3,1)'}).finished.finally(()=>dot.remove());
  }
}
async function confirm(){
  if(busy.value)return;busy.value=true;
  const ok=await counter.update(s=>confirmTicket(s,crypto.randomUUID()));
  if(ok){closeMenu();message.value=t('记下了。今晚想聊聊，还是先吃点东西？','控えたよ。話をする？ それとも先に食べる？');}
  busy.value=false;
}
async function editOrder(id:string){
  if(await counter.update(s=>{
    const o=s.tickets.find(o=>o.id===id);if(!o||o.state!=='queued')return;
    if(sum(s.draft))throw Error(t('先处理菜单里尚未确认的选择。','先に未確定の注文を確認してください。'));
    s.draft={...o.items};s.tickets=s.tickets.filter(o=>o.id!==id);
  }))openMenu();
}
async function serve(){await counter.update(s=>{for(const o of s.tickets)if(o.state==='queued')o.state='serving';});schedule();}
function schedule(){
  if(deliveryTimer||stopped||!counter.state.tickets.some(o=>o.state==='serving'))return;
  deliveryTimer=setTimeout(async()=>{
    deliveryTimer=undefined;
    const ok=await counter.update(s=>{const ticket=s.tickets.find(o=>o.state==='serving');if(ticket)deliverOne(s,ticket.id);});
    if(ok)schedule();
  },reduced.value?30:650);
}
watch(()=>counter.state.tickets,schedule,{deep:true,immediate:true});
function taste(key:string,d:Dish){tasted.value=key;message.value=t(d.line,d.lineJp);}
function drop(e:DragEvent){e.preventDefault();const id=e.dataTransfer?.getData('text/plain');const d=menu.find(d=>d.id===id);if(d)add(d);}
function drag(e:DragEvent,id:string){e.dataTransfer?.setData('text/plain',id);}
async function clearTable(){await counter.update(s=>{s.tickets=s.tickets.filter(o=>o.state!=='done');});}
onBeforeUnmount(()=>{stopped=true;clearTimeout(deliveryTimer);});
</script>

<template>
  <section class="counter-scene" aria-label="互动吧台" :class="{seated:counter.state.seated, 'less-motion':reduced}">
    <img class="counter-backdrop" :src="counter.state.seated?'assets/img/scene-seated.jpg':'assets/img/scene-hall.jpg'" alt="暖灯下的深夜酒吧">
    <div class="counter-shade"></div>
    <header class="counter-heading"><span class="eyebrow">A SEAT IS WAITING FOR YOU</span><h2>{{t('今夜，想来点什么？','今夜は、何にしよう。')}}</h2><p>{{t('不收现金。只收一个故事，或一会儿安静。','お代は物語ひとつ。静かなひとときでも。')}}</p></header>
    <div v-if="!counter.state.seated" class="seat-invite"><span class="seat-number">SEAT 06</span><button class="counter-primary" @click="enter">{{t('拉开椅子 · 入座','椅子を引いて · 座る')}} ↗</button></div>
    <template v-else>
      <div class="counter-welcome"><span class="live-dot"></span>{{t('欢迎回来。你的位置一直留着。','お帰り。あなたの席は空けてある。')}}</div>
      <div class="tabletop" :aria-label="t('已上桌的菜品','テーブルの料理')">
        <p v-if="!table.length" class="empty-table">{{t('桌面还空着。翻开菜单，挑一份喜欢的。','まだ何もない。メニューを開いて、好きなものを。')}}</p>
        <TransitionGroup name="dish" tag="div" class="table-dishes">
          <button v-for="item in table" :key="item.key" class="table-dish" :class="{tasted:tasted===item.key}" :aria-label="t('品尝 ','味わう ')+name(item.dish)" @click="taste(item.key,item.dish)">
            <i v-if="['milk','coffee','ramen'].includes(item.dish.id)" class="steam" aria-hidden="true">﹏</i><img :src="'assets/img/item-'+item.dish.id+'.jpg'" :alt="name(item.dish)"><span>{{name(item.dish)}}</span>
          </button>
        </TransitionGroup>
      </div>
      <div class="counter-actions"><button class="counter-primary" @click="openMenu">{{t('翻开今晚的菜单','今夜のメニュー')}} <span>↗</span></button><button v-if="table.length" class="counter-secondary" @click="clearTable">{{t('收起已用餐具','食器を片付ける')}}</button><a class="counter-secondary" href="order.html">{{t('给她讲个故事','物語を話す')}}</a></div>
    </template>
    <p class="counter-dialogue" role="status">{{message||t('岩夫：慢慢来，夜还很长。','いわお：ゆっくり。夜はまだ長い。')}}</p>
    <div class="counter-bottom"><span>RADIO CLUB · OPEN UNTIL DAWN</span><label><input type="checkbox" v-model="reduced"> {{t('简化动画','動きを控える')}}</label></div>
  </section>
  <section v-if="pending.length" class="order-queue" aria-label="待上菜订单">
    <div><span class="eyebrow">YOUR ORDER</span><h3>{{t('纸单已经递过去了','注文を預かりました')}}</h3><p>{{pendingCount}} {{t('份等待上桌。你来决定节奏。','点を準備中。あなたのペースで。')}}</p></div>
    <div class="queue-tickets"><article v-for="o in pending" :key="o.id"><strong>{{t(o.state==='serving'?'正在上菜':'已确认',o.state==='serving'?'配膳中':'注文済み')}}</strong><p>{{Object.entries(o.items).map(([id,n])=>name(menu.find(d=>d.id===id)!)+' ×'+n).join(' · ')}}</p><button v-if="o.state==='queued'" @click="editOrder(o.id)">{{t('修改这张单','注文を変更')}}</button></article></div>
    <div class="queue-options"><button class="counter-primary" :disabled="pending.every(o=>o.state==='serving')" @click="serve">{{t('现在上菜吧','料理をお願いします')}}</button><a href="order.html">{{t('等一会儿，先聊聊 →','先に少し話す →')}}</a></div>
  </section>
  <p v-if="counter.error" class="counter-error" role="alert">{{counter.error}}</p>

  <dialog ref="menuDialog" class="menu-dialog" :class="{'less-motion':reduced}" aria-labelledby="menu-title" @click="e=>{if(e.target===menuDialog)closeMenu()}">
    <div class="menu-top"><div><span class="eyebrow">RADIO CLUB / NIGHT MENU</span><h2 id="menu-title">{{t('把夜晚，交给喜欢的味道。','好きな味に、夜を預けて。')}}</h2></div><button class="menu-close" :aria-label="t('合上菜单','メニューを閉じる')" @click="closeMenu">×</button></div>
    <div class="menu-layout"><div class="menu-catalog">
      <nav class="menu-filters" aria-label="菜品分类"><button v-for="filter in [{id:'all',cn:'全部',jp:'すべて'},{id:'drink',cn:'饮品',jp:'ドリンク'},{id:'food',cn:'深夜食堂',jp:'夜食'},{id:'soft',cn:'无酒精',jp:'ノンアルコール'}]" :key="filter.id" :aria-pressed="category===filter.id" @click="category=filter.id">{{t(filter.cn,filter.jp)}}</button></nav>
      <div class="menu-grid"><article v-for="d in filtered" :key="d.id" class="menu-card" :class="{chosen:counter.state.draft[d.id]}" draggable="true" @dragstart="drag($event,d.id)">
        <button class="dish-preview" :aria-label="t('查看 ','詳細 ')+name(d)" @click="selected=d"><img :src="'assets/img/item-'+d.id+'.jpg'" :alt="name(d)" loading="lazy"><span v-if="counter.state.draft[d.id]" class="dish-selected">✓ {{counter.state.draft[d.id]}}</span></button>
        <div class="dish-info"><small>{{d.kind==='food'?'MIDNIGHT KITCHEN':d.alc?'COCKTAIL':'ALCOHOL FREE'}}</small><h3>{{name(d)}}</h3><p>{{t(d.desc,d.descJp)}}</p><div class="dish-controls"><button :disabled="!counter.state.draft[d.id]" :aria-label="t('减少 ','減らす ')+name(d)" @click="counter.update(s=>changeDraft(s,d.id,-1,ids))">−</button><output :aria-label="name(d)+t('数量','数量')">{{counter.state.draft[d.id]||0}}</output><button :aria-label="t('添加 ','追加 ')+name(d)" @click="add(d,$event)">＋</button></div></div>
      </article></div>
    </div><aside ref="receipt" class="order-receipt" @dragover.prevent @drop="drop">
      <span class="receipt-pin" aria-hidden="true"></span><span class="eyebrow">TABLE 06</span><h3>{{t('今晚的点单','今夜の注文')}}</h3><p class="receipt-price">{{t('价格：一个故事','お代：物語ひとつ')}}</p>
      <p v-if="!draftCount" class="receipt-empty">{{t('点一下喜欢的菜，也可以把它拖到这张纸上。','料理を選ぶか、この紙にドラッグしてね。')}}</p>
      <ul><li v-for="(n,id) in counter.state.draft" :key="id"><span>{{name(menu.find(d=>d.id===id)!)}}</span><b>×{{n}}</b><button :aria-label="t('移除 ','削除 ')+name(menu.find(d=>d.id===id)!)" @click="counter.update(s=>{delete s.draft[id]})">×</button></li></ul>
      <div class="receipt-total"><span>{{t('合计','合計')}}</span><b>{{draftCount}} {{t('份','点')}}</b></div>
      <button class="receipt-submit" :disabled="!draftCount||busy" @click="confirm">{{t('就这些 · 交给她','これで決まり · 注文する')}} ↗</button><p class="receipt-note">{{t('确认前都可以修改，合上菜单也会保留。','確定前は変更自由。閉じても選択は残ります。')}}</p>
      <div v-if="selected" class="bartender-note"><span>{{selected.by}} / RECOMMENDS</span><p>{{t(selected.line,selected.lineJp)}}</p></div>
      <p v-if="counter.error" role="alert" class="receipt-error">{{counter.error}}</p>
    </aside></div>
    <div class="mobile-receipt-bar"><span>{{t('已选','選択')}} {{draftCount}} {{t('份','点')}}</span><button @click="receipt?.scrollIntoView({behavior:reduced?'instant':'smooth',block:'start'})">{{t('查看点单 ↓','注文を見る ↓')}}</button></div>
  </dialog>
</template>
