/* ============================================================
   scene.js — 第一人称进店镜头编排（仅 index.html）
   状态：walk(滑动=走一步) → chair(拉椅坐下) → sit(坐下)
        → lookbt(看酒保) → menu(菜单浮现/手指点菜) → wait
        → lookdet(看侦探) → form(咨询单浮现/填写) → chat(两人聊)
        → serve(酒保把菜放到你手边) → idle
   镜头语言：先看人 → 对方递物 → 视线切到浮现在眼前的纸
   ============================================================ */
(function () {
  var U = RC.util;
  var vp = U.el('vp');
  if (!vp) return;

  var shHall = U.el('shHall'), shPov = U.el('shPov');
  var shBt = U.el('shBt'), shBtImg = U.el('shBtImg'), shDet = U.el('shDet');
  var figDet = U.el('figDet'), figSrv = U.el('figSrv');
  var dishes = U.el('dishes');
  var chair = U.el('chair'), vpWalk = U.el('vpWalk'), vpChair = U.el('vpChair');
  var menuWrap = U.el('menuWrap'), formWrap = U.el('formWrap');
  var vsub = U.el('vsub');

  var MAXSTEP = 6;
  var step = 0;
  var state = 'walk';
  var cin = RC.store.get('cin', { seated: false, formDone: false, chatDone: false, bt: '' });
  function saveCin() { RC.store.set('cin', cin); }

  /* ---------- 字幕 ---------- */
  var subCancel = null;
  function sub(who, text, master, other) {
    if (subCancel) { subCancel(); subCancel = null; }
    vsub.innerHTML = '<span class="who' + (master ? ' m' : '') + (other ? ' o' : '') + '">' + U.esc(who) + '</span><span class="tx"></span>';
    subCancel = RC.ui.type(vsub.querySelector('.tx'), text, 24);
  }
  function later(fn, ms) { return setTimeout(fn, ms); }

  /* ---------- 状态 ---------- */
  function setState(s) { state = s; vp.setAttribute('data-state', s); }

  /* ---------- 步行：滑动一下 = 走一步 ---------- */
  function applyZoom() {
    var img = shHall.querySelector('img');
    img.style.transform = 'scale(' + (1 + step * 0.15).toFixed(3) + ') translateY(' + (-step * 1.2).toFixed(2) + '%)';
  }
  function bob() { vp.classList.remove('bob'); void vp.offsetWidth; vp.classList.add('bob'); }
  function stepFwd() {
    if (step >= MAXSTEP) return;
    step++; applyZoom(); bob();
    if (step >= MAXSTEP) toChair();
  }
  function stepBack() {
    if (step <= 0) return;
    step--; applyZoom(); bob();
    if (state === 'chair') { setState('walk'); chair.classList.remove('show'); vpChair.classList.remove('show'); }
  }
  function toChair() {
    setState('chair');
    chair.classList.add('show');
    vpChair.classList.add('show');
    vpWalk.classList.remove('show');
  }
  vp.addEventListener('wheel', function (e) {
    if (state !== 'walk' && state !== 'chair') return;   // 坐下后归还滚轮
    e.preventDefault();
    if (e.deltaY > 0) stepFwd(); else if (e.deltaY < 0) stepBack();
  }, { passive: false });

  /* ---------- 坐下 ---------- */
  function sit() {
    if (state !== 'chair') return;
    setState('sit');
    chair.classList.add('pulled');
    vpChair.textContent = '……好，坐。';
    later(function () {
      cin.seated = true; saveCin();
      shPov.classList.add('on');
      shHall.classList.remove('on');
      chair.classList.remove('show'); vpChair.classList.remove('show');
      later(lookBt, 1000);
    }, 650);
  }
  chair.addEventListener('click', sit);

  /* ---------- 看酒保 → 递菜单 ---------- */
  function pickBt() {
    if (!cin.bt) cin.bt = Math.random() < 0.5 ? 'iwao' : 'lian';
    saveCin();
    return cin.bt;
  }
  function btName() { return cin.bt === 'lian' ? '涟' : '岩夫'; }
  function btOther() { return cin.bt === 'lian'; }
  function lookBt() {
    setState('lookbt');
    var b = pickBt();
    shBtImg.src = 'assets/img/bt-' + b + '-menu.jpg';
    shBt.classList.add('on');
    sub(btName(), '……坐。别站着。菜单给你——今晚的都在这儿。', !btOther(), btOther());
    later(function () {
      openMenu();
    }, 1600);
  }
  function openMenu() {
    setState('menu');
    buildMenu();
    menuWrap.classList.add('in');
    enableHand();
    sub(btName(), '慢慢看。点完了叫我一声。', !btOther(), btOther());
  }
  function closeMenu() {
    menuWrap.classList.remove('in');
    disableHand();
    setState('wait');
    sub(btName(), '……好，记下了。稍等一会儿。', !btOther(), btOther());
    later(function () { if (cin.formDone) chat(); else lookDet(); }, 1700);
  }

  /* ---------- 看侦探 → 推咨询单 ---------- */
  function lookDet() {
    setState('lookdet');
    shDet.classList.add('on');
    sub('萨弗兰', '……轮到我了。别紧张，只是几张纸。你写，我等。', false, false);
    later(function () {
      setState('form');
      buildForm();
      formWrap.classList.add('in');
    }, 1600);
  }
  function closeForm() {
    formWrap.classList.remove('in');
    cin.formDone = true; saveCin();
    var h = RC.case.get().handle || '客人';
    sub('萨弗兰', '收到了，' + h + '。我先读，你别急。……读完了。', false, false);
    later(chat, 1500);
  }

  /* ---------- 两人聊 → 上菜 ---------- */
  function chat() {
    setState('chat');
    shDet.classList.remove('on');
    figDet.classList.add('on');
    var c = RC.case.get();
    sub('萨弗兰', '……嗯。你写的，和你点的，我对过了。' + (c.category ? '「' + c.category + '」这类事，急不得。' : ''), false, false);
    later(function () {
      sub('萨弗兰', '先吃口热的。脑子吃饱了，话才说得清楚。', false, false);
      later(serve, 1600);
    }, 2200);
  }
  function serve() {
    var list = RC.bar.pending();
    if (!list.length) { finishIdle(); return; }
    setState('serve');
    figSrv.classList.add('on');
    sub(btName(), '……久等了。放你手边，趁热。', !btOther(), btOther());
    later(function () {
      var flat = [];
      list.forEach(function (x) { for (var i = 0; i < x.n; i++) flat.push(x.id); });
      flat.forEach(function (id, i) {
        later(function () {
          RC.bar.markServed([id]);
          renderDishes(true);
          if (RC.scene.renderTray) RC.scene.renderTray();
        }, 600 + i * 800);
      });
      later(function () {
        figSrv.classList.remove('on');
        cin.chatDone = true; saveCin();
        finishIdle();
      }, 600 + flat.length * 800 + 1200);
    }, 1100);
  }
  function finishIdle() {
    setState('idle');
    if (RC.case.get().assoc.length >= 5) {
      sub('萨弗兰', '分析做完了对吧。那下一步，鉴定书在等你。', false, false);
    } else {
      sub('萨弗兰', '吃吧。凉了就不可惜了——可惜的从来不是菜。', false, false);
    }
  }

  /* ---------- 吧台上的菜（有体积感） ---------- */
  function servedFlat() {
    var s = RC.bar.served(), out = [];
    RC.bar.tray().forEach(function (x) {
      var n = Math.min(x.n, s[x.id] || 0);
      for (var i = 0; i < n; i++) out.push(x.id);
    });
    return out;
  }
  function renderDishes(animateLast) {
    var list = servedFlat();
    dishes.innerHTML = list.map(function (id, i) {
      return '<span class="dish3d' + (animateLast && i === list.length - 1 ? ' drop' : '') + '">' +
        '<img src="assets/img/item-' + id + '.jpg" alt="' + U.esc((RC.bar.byId(id) || {}).cn || '') + '"></span>';
    }).join('');
  }

  /* ---------- 手指光标 ---------- */
  var hand = null;
  function handSVG() {
    return '<svg viewBox="0 0 40 46" aria-hidden="true">' +
      '<path d="M15 5 c0-3.4 5.4-3.4 5.4 0 l0 13 c0-2.2 5-2.2 5 0 l0 3 c0-2.2 5-2.2 5 0 l0 3 c0-2 4.4-1.4 4.4 1 l0 6 c0 7-4.6 12-11 12 h-3.6 c-5.4 0-8.6-3-10.8-7.4 l-4-8.2 c-1.2-2.8 2.8-4.8 4.2-2 l2.2 4.2 z" ' +
      'fill="#e9d7b6" stroke="#2c2016" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<path d="M20.4 18 l0 6 M25.4 21 l0 5 M30.2 24 l0 4" stroke="#c9a98c" stroke-width="1.2" fill="none"/></svg>';
  }
  function enableHand() {
    if (hand || !window.matchMedia || !matchMedia('(pointer:fine)').matches) return;
    hand = document.createElement('div');
    hand.id = 'rcHand'; hand.innerHTML = handSVG();
    document.body.appendChild(hand);
    vp.classList.add('handmode');
    document.addEventListener('mousemove', function (e) {
      var over = vp.contains(e.target);
      hand.style.opacity = over ? '1' : '0';
      hand.style.left = e.clientX + 'px'; hand.style.top = e.clientY + 'px';
    });
    document.addEventListener('mousedown', function (e) { if (vp.contains(e.target)) hand.classList.add('press'); });
    document.addEventListener('mouseup', function () { hand.classList.remove('press'); });
  }
  function disableHand() { if (hand) hand.style.opacity = '0'; }

  /* ---------- 纸菜单（带图） ---------- */
  function pmItem(d) {
    return '<div class="pm-item" data-id="' + d.id + '">' +
      '<div class="pm-pic"><img src="assets/img/item-' + d.id + '.jpg" alt=""></div>' +
      '<div class="pm-main"><div class="pm-name">' + U.esc(d.cn) + '<span class="pm-jp">' + U.esc(d.jp) + '</span>' +
      '<span class="pm-tag' + (d.alc ? ' alc' : '') + '">' + (d.alc ? '含酒精' : '无酒精') + '</span></div>' +
      '<div class="pm-desc">' + U.esc(d.desc) + '</div></div>' +
      '<div class="pm-right"><button type="button" class="pm-btn" data-pm="' + d.id + '">点</button>' +
      '<span class="pm-qty" data-qty="' + d.id + '"></span></div>' +
      '<span class="pm-stamp">已点</span></div>';
  }
  function pmSec(t, arr) { return '<div class="pm-sec">' + t + '</div>' + arr.map(pmItem).join(''); }
  function buildMenu() {
    menuWrap.innerHTML = '<div class="paper-menu"><span class="paper-pin"></span>' +
      '<div class="pm-head"><div class="pm-title">今 夜 菜 单</div><div class="pm-sub">RADIO CLUB ／ 价格：一个故事</div></div>' +
      '<div class="pm-list">' + pmSec('饮 品', RC.bar.drinks) + pmSec('主 食 · 稍后上', RC.bar.foods) + '</div>' +
      '<div class="pm-foot">※ 主食不立刻上。等她把该问的问完，会放到你手边。<br>' +
      '<button type="button" class="btn mini" id="pmClose">点完了 · 合上菜单</button></div></div>';
    refreshQty();
  }
  function trayN(id) {
    var t = RC.bar.tray();
    for (var i = 0; i < t.length; i++) if (t[i].id === id) return t[i].n;
    return 0;
  }
  function refreshQty() {
    RC.bar.menu.forEach(function (d) {
      var q = menuWrap.querySelector('[data-qty="' + d.id + '"]');
      var it = menuWrap.querySelector('.pm-item[data-id="' + d.id + '"]');
      var n = trayN(d.id);
      if (q) q.textContent = n ? '×' + n : '';
      if (it) it.classList.toggle('ordered', n > 0);
    });
  }
  function order(id) {
    var d = RC.bar.byId(id); if (!d) return;
    RC.bar.add(id);
    var it = menuWrap.querySelector('.pm-item[data-id="' + id + '"]');
    if (it) { it.classList.add('ordered', 'stamped'); later(function () { it.classList.remove('stamped'); }, 600); }
    refreshQty();
    if (RC.scene.renderTray) RC.scene.renderTray();
    sub(btName(), d.kind === 'food'
      ? '……' + d.cn + '，记下了。这个不急——等会儿放你手边。'
      : '……' + d.cn + '，好。', !btOther(), btOther());
  }

  /* ---------- 纸咨询单（可填） ---------- */
  function buildForm() {
    var c = RC.case.get();
    formWrap.innerHTML =
      '<form class="paper-form" id="cinForm" autocomplete="off"><span class="paper-pin"></span>' +
      '<div class="pf-head"><div class="pf-title">咨 询 单</div><div class="pf-sub">RADIO CLUB ／ 梦侦探事务所 ／ 只收故事</div></div>' +
      '<div class="pf-body">' +
      '<div class="pf-row"><label>怎么称呼你 *</label><input type="text" id="cfHandle" value="' + U.esc(c.handle) + '" placeholder="真名或昵称"></div>' +
      '<div class="pf-row"><label>类别 *</label><div class="pf-chips" id="cfCat">' +
        ['人际关系', '工作', '恋爱', '丧失', '记忆', '自我', '其他'].map(function (v) {
          return '<span class="pchip' + (c.category === v ? ' on' : '') + '" data-v="' + v + '">' + v + '</span>';
        }).join('') + '</div></div>' +
      '<div class="pf-row"><label>把这件事讲给我听 *</label><textarea id="cfStory" placeholder="想到什么写什么，越乱越好。">' + U.esc(c.story) + '</textarea></div>' +
      '<div class="pf-row"><label>最近反复做的梦</label><textarea id="cfDream" style="min-height:52px" placeholder="片段也可以。">' + U.esc(c.dream) + '</textarea></div>' +
      '<div class="pf-row"><label>做梦频率</label><div class="pf-chips" id="cfFreq">' +
        ['每夜', '每周数次', '偶尔', '几乎不做'].map(function (v) {
          return '<span class="pchip' + (c.dreamFreq === v ? ' on' : '') + '" data-v="' + v + '">' + v + '</span>';
        }).join('') + '</div></div>' +
      '<div class="pf-row"><label>反复想起的一句话 / 画面</label><input type="text" id="cfRec" value="' + U.esc(c.recurring) + '"></div>' +
      '<div class="pf-msg" id="cfMsg"></div>' +
      '<div class="pf-foot"><button type="submit" class="btn red mini">交给她</button>' +
      '<button type="button" class="btn ghost mini" id="cfLater">先不填</button></div>' +
      '</div></form>';
    // chips 单选
    ['cfCat', 'cfFreq'].forEach(function (rid) {
      var row = U.el(rid);
      row.addEventListener('click', function (e) {
        var ch = e.target.closest('.pchip'); if (!ch) return;
        row.querySelectorAll('.pchip').forEach(function (x) { x.classList.remove('on'); });
        ch.classList.add('on');
      });
    });
    U.el('cinForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = U.el('cfMsg');
      var handle = U.el('cfHandle').value.trim();
      var story = U.el('cfStory').value.trim();
      var catEl = menuSel('#cfCat .pchip.on');
      var freqEl = menuSel('#cfFreq .pchip.on');
      if (!handle) { msg.innerHTML = '<span class="red">※ 总得让我知道怎么称呼你。</span>'; return; }
      if (!catEl) { msg.innerHTML = '<span class="red">※ 选一个类别，哪怕选"其他"。</span>'; return; }
      if (story.length < 8) { msg.innerHTML = '<span class="red">※ 再多写一点，一句话也行。</span>'; return; }
      RC.case.save({
        handle: handle, category: catEl.getAttribute('data-v'), story: story,
        dream: U.el('cfDream').value.trim(),
        dreamFreq: freqEl ? freqEl.getAttribute('data-v') : '',
        recurring: U.el('cfRec').value.trim()
      });
      if (RC.scene.renderTray) RC.scene.renderTray();
      closeForm();
    });
    U.el('cfLater').addEventListener('click', function () {
      formWrap.classList.remove('in');
      cin.formDone = true; saveCin();
      sub('萨弗兰', '……也好。不想写的部分，嘴里说给我听也一样。', false, false);
      later(chat, 1400);
    });
  }
  function menuSel(sel) { return formWrap.querySelector(sel); }

  /* ---------- 工具按钮 ---------- */
  vp.addEventListener('click', function (e) {
    var pm = e.target.closest('[data-pm]');
    if (pm) { order(pm.getAttribute('data-pm')); return; }
    if (e.target.id === 'pmClose') { closeMenu(); return; }
    if (e.target.id === 'btnSkip') { if (state === 'walk' || state === 'chair') { step = MAXSTEP; toChair(); sit(); } return; }
    if (e.target.id === 'btnMenuOpen') { if (state === 'idle') openMenu(); return; }
    if (e.target.id === 'btnReset') { RC.store.set('cin', { seated: false, formDone: false, chatDone: false, bt: '' }); RC.store.del('served'); location.href = 'index.html'; return; }
  });

  /* ---------- 启动 / 断点续播 ---------- */
  function boot() {
    renderDishes(false);
    if (!cin.seated) {
      setState('walk');
      shHall.classList.add('on');
      vpWalk.classList.add('show');
      applyZoom();
      return;
    }
    // 已坐下：续播未完成的环节
    shPov.classList.add('on');
    if (!cin.formDone) { later(lookDet, 900); return; }
    if (!cin.chatDone) { figDet.classList.add('on'); later(chat, 900); return; }
    figDet.classList.add('on');
    setState('idle');
    if (RC.bar.pending().length) later(serve, 1200);
  }
  boot();

  RC.scene = RC.scene || {};
  RC.scene.order = order;
  RC.scene.renderDishes = renderDishes;
})();
