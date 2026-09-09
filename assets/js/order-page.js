(function(){
"use strict";
RC.ui.chrome({ title: RC.i18n.t('order'), path: 'order.html' });
document.getElementById('navMount').innerHTML = RC.ui.nav('order.html');
document.getElementById('footMount').innerHTML = RC.ui.siteFoot({ active: 'order.html' });

RC.ui.dialog({
  who: { cn: '萨弗兰', jp: 'サフラン' },
  jp: { cn: '梦侦探', jp: '夢探偵' },
  mount: document.getElementById('introMount'),
  text: '点单不用写得漂亮。你负责把事实倒出来，我负责把它们摆整齐。写不下去的地方就空着——空着本身也是信息。',
  speed: 26
});

function bindChips(rowId, target) {
  var row = document.getElementById(rowId);
  var state = { v: '' };
  row.addEventListener('click', function (e) {
    var c = e.target.closest('.chip'); if (!c) return;
    row.querySelectorAll('.chip').forEach(function (x) { x.classList.remove('on');x.setAttribute('aria-pressed','false'); });
    c.classList.add('on');c.setAttribute('aria-pressed','true');
    state.v = c.getAttribute('data-v');
    target.set(state.v);
  });
  return state;
}
var sel = { category: '', dreamFreq: '', paralysis: '' };
bindChips('catRow', { set: function (v) { sel.category = v; } });
bindChips('freqRow', { set: function (v) { sel.dreamFreq = v; } });
bindChips('parRow', { set: function (v) { sel.paralysis = v === '1'; } });

var c0 = RC.case.get();
if(new URLSearchParams(location.search).get('new')==='1') {document.getElementById('caseMode').value='new';c0=RC.model.normalize({});}
sel.category=c0.category;sel.dreamFreq=c0.dreamFreq;sel.paralysis=c0.paralysis;
[['catRow',sel.category],['freqRow',sel.dreamFreq],['parRow',sel.paralysis?'1':'0']].forEach(function(p){
  document.getElementById(p[0]).querySelectorAll('.chip').forEach(function(b){var on=b.dataset.v===p[1];b.classList.toggle('on',on);b.setAttribute('aria-pressed',on);});
});
var archive=RC.store.get('caseHistory',[]);if(!Array.isArray(archive))archive=[];
archive.forEach(function(c,i){var op=document.createElement('option');op.value=i;op.textContent=(c.handle||'客人')+' / '+new Date(c.createdAt).toLocaleDateString();document.getElementById('caseHistory').appendChild(op);});
document.getElementById('restoreCase').addEventListener('click',function(){var val=document.getElementById('caseHistory').value;if(val!=='' && RC.case.start(archive[Number(val)])) { RC.case.save(archive[Number(val)]);location.href='order.html'; }});

if (c0.handle) document.getElementById('fHandle').value = c0.handle;
if (c0.age) document.getElementById('fAge').value = c0.age;
if (c0.birth) document.getElementById('fBirth').value = c0.birth;
if (c0.story) document.getElementById('fStory').value = c0.story;
if (c0.dream) document.getElementById('fDream').value = c0.dream;
if (c0.recurring) document.getElementById('fRecurring').value = c0.recurring;

document.getElementById('btnClear').addEventListener('click', function () {
  document.getElementById('orderForm').reset();
  document.querySelectorAll('.chip.on').forEach(function (x) { x.classList.remove('on');x.setAttribute('aria-pressed','false'); });
  sel.category = sel.dreamFreq = ''; sel.paralysis = '';
  document.getElementById('formMsg').textContent = '';
});

document.getElementById('orderForm').addEventListener('submit', function (e) {
  e.preventDefault();
  var msg = document.getElementById('formMsg');
  var handle = document.getElementById('fHandle').value.trim();
  var story = document.getElementById('fStory').value.trim();
  if (!handle) { msg.innerHTML = '<span class="red">※ 总得让我知道怎么称呼你。</span>'; return; }
  if (!sel.category) { msg.innerHTML = '<span class="red">※ 选一个类别，哪怕选"其他"。</span>'; return; }
  if (story.length < 8) { msg.innerHTML = '<span class="red">※ 再多写一点。一句话也行，但得是一句完整的话。</span>'; return; }

  var patch={
    handle: handle,
    age: document.getElementById('fAge').value,
    birth: document.getElementById('fBirth').value,
    category: sel.category,
    story: story,
    dream: document.getElementById('fDream').value.trim(),
    dreamFreq: sel.dreamFreq,
    paralysis: !!sel.paralysis,
    recurring: document.getElementById('fRecurring').value.trim()
  };
  var issue=RC.model.formError(patch);if(issue){msg.textContent=issue;return;}
  var saved=document.getElementById('caseMode').value==='new'?RC.case.start(patch):RC.case.save(patch);
  if(!saved)return;

  document.getElementById('orderForm').classList.add('hidden');
  var done = document.getElementById('doneMount');
  done.classList.remove('hidden');
  RC.ui.dialog({
    who: { cn: '萨弗兰', jp: 'サフラン' },
    jp: { cn: '梦侦探', jp: '夢探偵' },
    mount: done,
    text: '收到了，' + handle + '。我先读完，你别急。……读完了。下一步，去抽牌。牌会替你说那些你还没准备好亲口说的部分。',
    speed: 26,
    done: function () {
      done.insertAdjacentHTML('beforeend',
        '<div class="center mt"><a class="btn" href="tarot.html">去抽牌 →</a> ' +
        '<a class="btn ghost" href="psyche.html">先做分析 →</a></div>');
    }
  });
});

})();
