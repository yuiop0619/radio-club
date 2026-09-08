/* ============================================================
   haunt.js — 氛围层与电影彩蛋（神秘但不吓人）
   1. 来店记忆与计数器
   2. 17 层电梯：到站后全站轻微故障（glitch）※ 到过一次后就停在那层
   3. 梦境大游行：今夜的游行正在经过
   4. 镜中人与洞：点一下，镜子里的人比你慢半拍
   5. 红辣椒的名片：首次来店时递给你
   6. 打烊前，店主温和地问候一句（仅首页，且需长时间空闲才触发）
   ============================================================ */
(function () {
  var U = RC.util;
  var I = RC.i18n;

  /* ---------- 1. 计数 ---------- */
  function counter(visits) {
    var vc = U.el('rcVisit');
    if (vc) RC.ui.counter(vc, 100000 + visits * 7 + 3, 6);
  }

  /* ---------- 2. 17 层电梯 ---------- */
  function elevator() {
    var elev = U.el('rcElevator');
    if (!elev) return;
    /* 已经到过 17 层：直接停在那儿，不再重复爬楼 */
    if (RC.store.get('seen17', false)) {
      elev.textContent = '17F';
      var cap0 = U.el('rcElevCap');
      if (cap0) cap0.textContent = I.t('elevDone');
      return;
    }
    var f = 1;
    var t = setInterval(function () {
      f++;
      elev.textContent = U.pad(f, 2) + 'F';
      if (f >= 17) {
        clearInterval(t);
        elev.textContent = '17F';
        RC.store.set('seen17', true);
        var cap = U.el('rcElevCap');
        if (cap) cap.textContent = I.t('elevDone');
        floor17(elev);
      }
    }, 200);
  }
  /* 到 17 层：整层数字都变成 17，全站轻微故障一下 */
  function floor17(elev) {
    var host = U.el('rcElevFloors');
    if (host) {
      var html = '';
      for (var i = 0; i < 6; i++) html += '<span class="fl">17</span>';
      host.innerHTML = html;
      host.classList.add('show');
    }
    document.body.classList.add('floor17');
    elev.classList.add('glitch', 'on', 'chroma', 'on');
    setTimeout(function () {
      document.body.classList.remove('floor17');
      elev.classList.remove('glitch', 'on', 'chroma', 'on');
      if (host) setTimeout(function () { host.classList.remove('show'); }, 1600);
    }, 900);
  }

  /* ---------- 3. 梦境大游行 ---------- */
  var P_ICONS = [
    '<svg viewBox="0 0 24 24"><rect x="6" y="3" width="12" height="18" rx="1"/><path d="M6 10h12" stroke="#17120f" stroke-width="1.2" fill="none"/></svg>',
    '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="1"/><path d="M8 3l4 3 4-3" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="7" r="4"/><path d="M5 21l7-9 7 9z"/></svg>',
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="6" r="3.2"/><rect x="8" y="10" width="8" height="11" rx="1"/></svg>',
    '<svg viewBox="0 0 24 24"><path d="M12 2c3 4 5 6 5 9a5 5 0 0 1-10 0c0-3 2-5 5-9z"/><rect x="10" y="17" width="4" height="5" rx="1"/></svg>',
    '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="17" rx="1"/><circle cx="12" cy="14" r="4.5" fill="#17120f"/></svg>'
  ];
  function parade() {
    var host = U.el('paradeMount');
    if (!host) return;
    var seq = '';
    for (var i = 0; i < P_ICONS.length; i++) seq += '<span class="pd-i">' + P_ICONS[i] + '</span>';
    host.innerHTML =
      '<div class="parade" role="img" aria-label="' + I.t('parade') + '">' +
      '<div class="pd-track">' + seq + seq + seq + seq + '</div></div>' +
      '<div class="pd-cap">' + I.t('parade') + '</div>';
  }

  /* ---------- 4. 镜中人与洞 ---------- */
  function hole() {
    var host = U.el('holeMount');
    if (!host) return;
    host.innerHTML =
      '<div class="hole" id="rcHole" role="button" tabindex="0" aria-label="' + I.t('holeTxt') + '">' +
      '<div class="hole-bg"></div><div class="hole-edge"></div>' +
      '<svg class="mirror-fig" viewBox="0 0 60 90" aria-hidden="true">' +
      '<ellipse cx="30" cy="26" rx="13" ry="15"/><path d="M6 90q3-30 24-30t24 30z"/></svg>' +
      '<div class="hole-txt" data-i18n="holeTxt">' + I.t('holeTxt') + '</div></div>';
    var h = U.el('rcHole');
    function flip() { h.classList.toggle('show'); }
    h.addEventListener('click', flip);
    h.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); }
    });
  }

  /* ---------- 5. 红辣椒的名片 ---------- */
  var CARD_MS = 8000;
  function card() {
    if (RC.store.get('cardSeen', false)) return;
    RC.store.set('cardSeen', true);
    var c = document.createElement('div');
    c.className = 'paprika-card';
    c.innerHTML =
      '<div class="pc-in">' +
      '<div class="pc-mark">✦</div>' +
      '<div class="pc-name">' + RC.ui.bi('红辣椒', 'パプリカ') + '</div>' +
      '<div class="pc-role">' + RC.ui.bi('梦侦探', '夢探偵') + '</div>' +
      '<div class="pc-url">' + I.t('cardUrl') + '</div>' +
      '<div class="pc-note">' + RC.ui.bi('「想见我的时候，随时都能来。」', '「会いたくなったら、いつでも来て。」') + '</div>' +
      '<div class="pc-hint">' + I.t('cardHint') + '</div>' +
      '<div class="pc-close">' + RC.ui.bi('点击收起', 'タップで閉じる') + '</div>' +
      '</div>';
    document.body.appendChild(c);
    setTimeout(function () { c.classList.add('in'); }, 80);
    var close = function () {
      if (!c.parentNode) return;
      c.classList.remove('in');
      setTimeout(function () { if (c.parentNode) c.parentNode.removeChild(c); }, 700);
    };
    c.addEventListener('click', close);
    setTimeout(close, CARD_MS);
  }

  /* ---------- 6. 打烊低语（仅首页、长时间空闲触发） ---------- */
  function whisper() {
    RC.ui.dialog({
      who: { cn: '店主', jp: 'マスター' }, jp: { cn: '店主', jp: '店主' }, master: true,
      text: '……打烊前，再来一杯吗。不着急，我们等你。',
      speed: 40
    });
  }

  /* 只在首页、且确认客人已经发呆很久时才开口，避免打断阅读 */
  function idleWhisper() {
    if (!document.body.hasAttribute('data-amb-whisper')) return;
    var p = location.pathname.split('/').pop() || 'index.html';
    if (p !== 'index.html' && p !== '') return;
    var IDLE = 90000, DWELL = 120000;
    var born = Date.now(), last = Date.now();
    var evs = ['mousemove', 'keydown', 'scroll', 'touchstart', 'click', 'wheel'];
    for (var i = 0; i < evs.length; i++) {
      window.addEventListener(evs[i], function () { last = Date.now(); }, { passive: true });
    }
    var timer = setInterval(function () {
      var now = Date.now();
      if (now - born >= DWELL && now - last >= IDLE) {
        clearInterval(timer);
        whisper();
      }
    }, 5000);
  }

  function init() {
    var visits = RC.visits.bump();
    counter(visits);
    elevator();
    parade();
    hole();
    if (visits === 1) setTimeout(card, 1400);
    idleWhisper();
  }

  window.RC = window.RC || {};
  RC.haunt = {};

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
