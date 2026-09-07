/* ============================================================
   ui.js — 假浏览器外壳 / 导航 / SVG 侦探头像（视线追踪+眨眼+说话）
            / 打字机 / 对话气泡 / 计数器
   ============================================================ */
(function () {
  var U = RC.util;
  var BASE_URL = 'http://www.radio-club.ne.jp/';

  var NAV = [
    { href: 'index.html',   jp: 'カウンター', cn: '吧台',   en: 'COUNTER' },
    { href: 'people.html',  jp: '登場人物',   cn: '人物',   en: 'PEOPLE' },
    { href: 'order.html',   jp: 'ご注文',     cn: '委托',   en: 'ORDER' },
    { href: 'tarot.html',   jp: 'タロット',   cn: '塔罗',   en: 'TAROT' },
    { href: 'psyche.html',  jp: '精神分析',   cn: '精神分析', en: 'PSYCHE' },
    { href: 'verdict.html', jp: '鑑定',       cn: '鉴定',   en: 'VERDICT' },
    { href: 'bbs.html',     jp: 'BBS',        cn: '留言板', en: 'BBS' },
    { href: 'link.html',    jp: 'LINK',       cn: '链接',   en: 'LINK' }
  ];

  /* ---------- 假浏览器外壳 ---------- */
  function chrome(meta) {
    var app = U.el('app');
    if (!app) return;
    var b = document.createElement('div');
    b.className = 'browser';
    b.innerHTML =
      '<div class="b-title"><span class="b-dot"></span>' +
      '<span class="b-tname">RADIO CLUB - ' + U.esc(meta.title) + ' - 梦浏览器 6.0</span>' +
      '<span class="b-btns"><i></i><i></i><i></i></span></div>' +
      '<div class="b-menu"><span><u>文</u>件(F)</span><span><u>编</u>辑(E)</span><span><u>查</u>看(V)</span>' +
      '<span>收藏(A)</span><span>工具(T)</span><span>帮助(H)</span></div>' +
      '<div class="b-bar"><span class="b-lbl">地址</span>' +
      '<input class="b-addr" id="rcAddr" readonly value="' + BASE_URL + U.esc(meta.path || 'index.html') + '">' +
      '<button type="button" id="rcGo">前往</button></div>' +
      '<div class="b-viewport"></div>' +
      '<div class="b-status"><span class="b-status-text" id="rcStatus">完成</span>' +
      '<span class="b-zone">网络区域</span></div>';
    app.parentNode.insertBefore(b, app);
    b.querySelector('.b-viewport').appendChild(app);
    document.title = 'RADIO CLUB｜' + meta.title;
    U.el('rcGo').addEventListener('click', function () {
      var v = U.el('rcAddr').value.replace(BASE_URL, '');
      if (/^[\w.\-]+\.html$/.test(v)) location.href = v;
    });
  }

  /* ---------- 导航 ---------- */
  function nav(active) {
    var html = NAV.map(function (n) {
      var on = n.href === active ? ' class="on"' : '';
      return '<a href="' + n.href + '"' + on + '>' + n.cn +
        '<span class="nav-en">' + n.en + '</span></a>';
    }).join('');
    return '<nav class="nav">' + html +
      '<span class="spacer"></span>' +
      '<span class="counter-mini">来店人数 <span class="digits" id="rcVisit"></span></span></nav>';
  }

  /* ---------- 计数器 ---------- */
  function counter(el, n, w) {
    if (!el) return;
    var s = U.pad(n, w || 6);
    el.innerHTML = s.split('').map(function (d) { return '<i>' + d + '</i>'; }).join('');
  }

  /* ---------- SVG 侦探头像 ---------- */
  var avatars = [];
  function avatarSVG() {
    return '' +
      '<svg viewBox="0 0 74 74" class="rc-av" aria-hidden="true">' +
      '<defs><clipPath id="avclip"><rect x="0" y="0" width="74" height="74" rx="4"/></clipPath></defs>' +
      '<g clip-path="url(#avclip)">' +
      '<rect width="74" height="74" fill="#171210"/>' +
      '<rect width="74" height="74" fill="url(#avg)" opacity="0"/>' +
      // 后发
      '<path d="M14 40 q0-26 23-26 q23 0 23 26 l0 22 q-6 6 -23 6 q-17 0 -23 -6 z" fill="#3a211c"/>' +
      // 衣领（绯红外套）
      '<path d="M10 74 q4-16 27-16 q23 0 27 16 z" fill="#a83226"/>' +
      '<path d="M30 60 l7 8 l7-8 l-3 14 l-8 0 z" fill="#e8dcc4"/>' +
      // 脸
      '<ellipse cx="37" cy="38" rx="16" ry="18" fill="#f0dcc4"/>' +
      '<path d="M21 38 q0-20 16-20 q16 0 16 20 q-4-8 -16-8 q-12 0 -16 8 z" fill="#3a211c"/>' +
      // 刘海
      '<path d="M21 34 q2-14 16-14 q14 0 16 14 q-6-6 -10-5 q2-4 -2-6 q1 4 -3 5 q-8 2 -17 6 z" fill="#46281f"/>' +
      // 发夹
      '<path d="M50 26 l6-3 l-1 5 l4 1 l-6 3 z" fill="#d8402c"/>' +
      // 眉
      '<path class="browL" d="M26 33 q4-2 8-1" stroke="#3a211c" stroke-width="1.4" fill="none"/>' +
      '<path class="browR" d="M40 32 q4-1 8 1" stroke="#3a211c" stroke-width="1.4" fill="none"/>' +
      // 眼（眼白+虹膜+瞳孔+高光），瞳孔组可平移
      '<g class="eyes">' +
      '<ellipse cx="30" cy="39" rx="4.6" ry="4.2" fill="#fff"/>' +
      '<ellipse cx="44" cy="39" rx="4.6" ry="4.2" fill="#fff"/>' +
      '<g class="pupils">' +
      '<circle cx="30" cy="39" r="3.1" fill="#c8502c"/><circle cx="30" cy="39" r="1.5" fill="#20100c"/>' +
      '<circle cx="44" cy="39" r="3.1" fill="#c8502c"/><circle cx="44" cy="39" r="1.5" fill="#20100c"/>' +
      '<circle cx="31.2" cy="37.8" r="0.8" fill="#fff"/><circle cx="45.2" cy="37.8" r="0.8" fill="#fff"/>' +
      '</g>' +
      '<g class="lids">' +
      '<rect class="lidL" x="25" y="34" width="10" height="0" fill="#f0dcc4"/>' +
      '<rect class="lidR" x="39" y="34" width="10" height="0" fill="#f0dcc4"/>' +
      '</g>' +
      '</g>' +
      // 鼻 / 嘴
      '<path d="M37 44 l-1 3 l2 0" stroke="#c9a98c" stroke-width="1" fill="none"/>' +
      '<path class="mouth" d="M33 50 q4 2.4 8 0" stroke="#8c4a3a" stroke-width="1.6" fill="none"/>' +
      '</g></svg>';
  }
  function avatar(host) {
    host.innerHTML = avatarSVG();
    var svg = host.querySelector('svg');
    var rec = { svg: svg, pupils: svg.querySelector('.pupils'), lids: svg.querySelector('.lids'), mouth: svg.querySelector('.mouth') };
    avatars.push(rec);
    scheduleBlink(rec);
    return rec;
  }
  function scheduleBlink(rec) {
    setTimeout(function () {
      var l = rec.svg.querySelector('.lidL'), r = rec.svg.querySelector('.lidR');
      if (l && r) { l.setAttribute('height', 9); r.setAttribute('height', 9); }
      setTimeout(function () { if (l && r) { l.setAttribute('height', 0); r.setAttribute('height', 0); } }, 110);
      scheduleBlink(rec);
    }, 2600 + Math.random() * 3800);
  }
  window.addEventListener('mousemove', function (e) {
    avatars.forEach(function (rec) {
      var box = rec.svg.getBoundingClientRect();
      var cx = box.left + box.width / 2, cy = box.top + box.height * 0.52;
      var dx = U.clamp((e.clientX - cx) / 40, -2.6, 2.6);
      var dy = U.clamp((e.clientY - cy) / 60, -2.0, 2.0);
      rec.pupils.setAttribute('transform', 'translate(' + dx.toFixed(2) + ',' + dy.toFixed(2) + ')');
    });
  });

  /* ---------- 打字机 ---------- */
  function type(el, text, speed, done) {
    speed = speed || 26;
    var i = 0;
    el.innerHTML = '<span class="tw"></span><span class="caret">&nbsp;</span>';
    var tw = el.querySelector('.tw');
    var caret = el.querySelector('.caret');
    // 说话时嘴动
    var dlg = el.closest('.dialog');
    if (dlg) dlg.classList.add('talking');
    var t = setInterval(function () {
      i++;
      tw.textContent = text.slice(0, i);
      if (i % 2) { if (dlg) dlg.classList.toggle('talking'); }
      if (i >= text.length) {
        clearInterval(t);
        if (caret) caret.remove();
        if (dlg) dlg.classList.remove('talking');
        if (done) done();
      }
    }, speed);
    return function cancel() { clearInterval(t); tw.textContent = text; if (caret) caret.remove(); if (dlg) dlg.classList.remove('talking'); if (done) done(); };
  }

  /* ---------- 对话气泡 ---------- */
  function dialog(opts) {
    // opts: {who, jp, text, master?, other?, speed, done, mount}
    var d = document.createElement('div');
    d.className = 'dialog' + (opts.master ? ' master' : '') + (opts.other ? ' other' : '');
    d.innerHTML = '<div class="av"></div><div class="bubble">' +
      '<div class="who">' + U.esc(opts.who) + (opts.jp ? ' <span class="jp">／' + U.esc(opts.jp) + '</span>' : '') + '</div>' +
      '<div class="line"></div></div>';
    (opts.mount || document.body).appendChild(d);
    if (!opts.master && !opts.other) avatar(d.querySelector('.av'));
    else {
      // 酒保/其他：用一个简化占位（方块剪影）
      d.querySelector('.av').innerHTML = opts.other
        ? '<svg viewBox="0 0 74 74"><rect width="74" height="74" fill="#0f151a"/><ellipse cx="37" cy="34" rx="15" ry="16" fill="#1d2b36"/><path d="M12 74 q4-18 25-18 q21 0 25 18z" fill="#16222b"/></svg>'
        : '<svg viewBox="0 0 74 74"><rect width="74" height="74" fill="#171210"/><ellipse cx="37" cy="34" rx="15" ry="16" fill="#3a2f26"/><path d="M12 74 q4-18 25-18 q21 0 25 18z" fill="#2a221c"/></svg>';
    }
    var line = d.querySelector('.line');
    if (opts.text === false) { line.innerHTML = ''; return { el: d, line: line }; }
    type(line, opts.text, opts.speed, opts.done);
    return { el: d, line: line };
  }

  window.RC = window.RC || {};
  RC.ui = {
    BASE_URL: BASE_URL, NAV: NAV,
    chrome: chrome, nav: nav, counter: counter,
    avatar: avatar, avatarSVG: avatarSVG, type: type, dialog: dialog
  };
})();
