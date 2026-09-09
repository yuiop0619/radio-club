/* ============================================================
   ui.js — 假浏览器外壳 / 导航 / SVG 侦探头像（视线追踪+眨眼+说话）
            / 打字机 / 对话气泡 / 计数器
   双语：并列片段用 bi(cn,jp)，动态文本走 RC.i18n.t()
   ============================================================ */
(function () {
  var U = RC.util;
  var I = RC.i18n;
  /* 核心常量：彩蛋名片用的抽象域名（仅展示，不点击跳转）
   实际网络地址（页面底部）已按用户反馈移除，因为对本店没有功能价值 */
  var BASE_URL = 'www.radio-club.ne.jp';

  /* 并列双语片段：由 body[data-lang] 决定显示哪一种 */
  function bi(cn, jp) {
    return '<span class="i18n-cn">' + U.esc(cn) + '</span><span class="i18n-jp">' + U.esc(jp) + '</span>';
  }
  function txt(o, fallback) {
    if (o == null) return fallback || '';
    if (typeof o === 'object') return bi(o.cn, o.jp);
    return U.esc(o);
  }

  var NAV = [
    { href: 'index.html',   jp: 'カウンター', cn: '吧台',   en: 'COUNTER' },
    { href: 'people.html',  jp: '登場人物',   cn: '人物',   en: 'PEOPLE' },
    { href: 'order.html',   jp: 'ご注文',     cn: '委托',   en: 'ORDER' },
    { href: 'tarot.html',   jp: 'タロット',   cn: '塔罗',   en: 'TAROT' },
    { href: 'psyche.html',  jp: '精神分析',   cn: '精神分析', en: 'PSYCHE' },
    { href: 'verdict.html', jp: '鑑定',       cn: '鉴定',   en: 'VERDICT' },
    { href: 'bbs.html',     jp: '木の穴',      cn: '树洞',   en: 'BBS' },
    { href: 'link.html',    jp: 'LINK',       cn: '链接',   en: 'LINK' }
  ];

  /* ---------- 站点外壳：去掉 2006 假浏览器外壳，改为网页原生 max-width 容器 ---------- */
  function chrome(meta) {
    var app = U.el('app');
    if (!app) return;
    document.title = 'RADIO CLUB｜' + (meta && meta.title ? meta.title : '');
    document.body.setAttribute('data-page', (meta && meta.path) || '');
    var wrap = document.createElement('div');
    wrap.className = 'site';
    var pageKey = (meta && meta.path || '').replace(/\.html$/, '');
    if (pageKey) wrap.setAttribute('data-page', pageKey);
    if (app.parentNode) app.parentNode.insertBefore(wrap, app);
    wrap.appendChild(app);
  }

  /* ---------- 导航 ---------- */
  function nav(active) {
    var html = NAV.map(function (n) {
      var on = n.href === active ? ' class="on"' : '';
      return '<a href="' + n.href + '"' + on + '>' + bi(n.cn, n.jp) +
        '<span class="nav-en">' + n.en + '</span></a>';
    }).join('');
    return '<nav class="nav">' + html +
      '<span class="spacer"></span>' +
      '<span class="counter-mini"><span data-i18n="visitors">' + I.t('visitors') + '</span> <span class="digits" id="rcVisit"></span></span></nav>';
  }

  /* ---------- 计数器 ---------- */
  function counter(el, n, w) {
    if (!el) return;
    var s = U.pad(n, w || 6);
    el.innerHTML = s.split('').map(function (d) { return '<i>' + d + '</i>'; }).join('');
  }

  /* ---------- 统一 footer：8 个页面都调一次，输出同样的版心 ---------- */
  function siteFoot(opts) {
    opts = opts || {};
    var langBtn =
      '<button type="button" class="lang-toggle foot-lang" data-lang-target="jp" title="' + I.t('langTip') + '">' +
      '<span class="i18n-cn" data-i18n="langName">' + I.t('langName') + '</span>' +
      '<span class="i18n-jp" data-i18n="langName">' + I.t('langName') + '</span>' +
      '</button>';

    return '<footer class="site-foot" id="siteFoot">' +
      '<div class="sf-row sf-base">' +
        '<span class="sf-since">© 2006- RADIO CLUB ／ <span class="i18n-cn">网络酒吧</span><span class="i18n-jp">ネット上のバー</span></span>' +
        '<span class="sf-since">Since 2006.11.25</span>' +
        '<a class="badge88" href="about2006.html" title="看看 2006 年同人版">2006 ↗</a>' +
        '<span class="sf-lang">' + langBtn + '</span>' +
      '</div>' +
    '</footer>';
  }

  /* ---------- 皮影头像（真实皮影照片风：黑底透光皮影，背光容器 screen 混合裁出头肩） ---------- */
  var AV_IMG = {
    det: 'assets/img/puppet-det-768.webp',
    master: 'assets/img/puppet-iwao-768.webp',
    other: 'assets/img/puppet-lian-768.webp'
  };
  function avatar(host, kind) {
    var src = AV_IMG[kind] || AV_IMG.det;
    host.innerHTML = '<img class="rc-av" src="' + src + '" alt="" draggable="false">';
    return { img: host.querySelector('img') };
  }

  /* ---------- 打字机 ---------- */
  function type(el, text, speed, done) {
    if(el._cancelType)el._cancelType();
    text=String(text || '');var i=0,finished=false,t;
    el.innerHTML='<span class="tw"></span>';
    var tw=el.querySelector('.tw'),skip=document.createElement('button');
    skip.type='button';skip.className='btn ghost small';skip.textContent=I.of({cn:'显示全部',jp:'すべて表示'});
    function finish(){if(finished)return;finished=true;clearInterval(t);tw.textContent=text;skip.remove();el._cancelType=null;if(done)done();}
    el._cancelType=finish;
    if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches){finish();return finish;}
    el.appendChild(skip);skip.addEventListener('click',finish);
    t=setInterval(function(){if(!el.isConnected){clearInterval(t);return;}tw.textContent=text.slice(0,++i);if(i>=text.length)finish();},speed||26);
    return finish;
  }

  /* ---------- 对话气泡 ---------- */
  function dialog(opts) {
    var d = document.createElement('div');
    d.className = 'dialog' + (opts.master ? ' master' : '') + (opts.other ? ' other' : '');
    var whoHtml = txt(opts.who, '');
    var roleHtml = opts.jp ? ' <span class="jp">／' + txt(opts.jp, '') + '</span>' : '';
    d.innerHTML = '<div class="av"></div><div class="bubble">' +
      '<div class="who">' + whoHtml + roleHtml + '</div>' +
      '<div class="line"></div></div>';
    (opts.mount || document.body).appendChild(d);
    avatar(d.querySelector('.av'), opts.master ? 'master' : (opts.other ? 'other' : 'det'));
    var line = d.querySelector('.line');
    if (opts.text === false) { line.innerHTML = ''; return { el: d, line: line }; }
    type(line, opts.text, opts.speed, opts.done);
    return { el: d, line: line };
  }

  function portrait(src,alt){
    var base=src.replace(/\.png$/,'');
    return '<picture><source type="image/webp" srcset="'+base+'-160.webp 160w, '+base+'-320.webp 320w, '+base+'-640.webp 640w" sizes="(max-width:600px) 80px, 160px"><img src="'+base+'-320.png" width="320" height="320" loading="lazy" decoding="async" alt="'+U.esc(alt)+'"></picture>';
  }
  window.RC = window.RC || {};
  RC.ui = {
    BASE_URL: BASE_URL, NAV: NAV,
    chrome: chrome, nav: nav, counter: counter, siteFoot: siteFoot,
    portrait:portrait, avatar: avatar, type: type, dialog: dialog, bi: bi, txt: txt
  };
})();
