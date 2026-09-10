/* ============================================================
   analyst.js — 解梦智能体：七大师预设式对话引擎（离线，无外部 API）
   七位大师（四男三女）各执一派：周公 / 弗洛伊德 / 荣格 / 霍妮 /
   珀尔斯 / 卡特莱特 / 冯·法兰兹。引擎做三件事：
   1. 从客人的梦文本里抽取「意象 motif」（水/坠/追/飞/牙/死/考/裸/兽/屋/火/镜）
   2. 按所选大师的学派 lens 把 motif 翻译成该派口吻的解读（预设模板）
   3. 结案时发「成就卡」，写入 RC.case.analystLog 供鉴定书引用
   页面挂载：psyche.html（#masterGrid / #analystChat / #chatLog /
   #chatIn / #btnSend / #btnCard / #btnMasterBack / #cardBox）
   ============================================================ */
(function () {
  var U = RC.util;
  var I = RC.i18n;

  /* ---------- 意象词典（内容见 content/masters.json） ----------
     JSON 里存正则的 source/flags，这里重建 RegExp。 */
  var MC = (window.RC_CONTENT && window.RC_CONTENT.masters) || {};
  var MOTIFS = (MC.motifs || []).map(function (m) {
    return { k: m.k, cn: m.cn, jp: m.jp, re: new RegExp(m.re, m.flags || '') };
  });
  function motifs(text) {
    var t = String(text || '');
    var out = [];
    for (var i = 0; i < MOTIFS.length; i++) if (MOTIFS[i].re.test(t)) out.push(MOTIFS[i].k);
    return out;
  }
  function motifLabel(k) {
    for (var i = 0; i < MOTIFS.length; i++) if (MOTIFS[i].k === k) return { cn: MOTIFS[i].cn, jp: MOTIFS[i].jp };
    return { cn: '未知意象', jp: '不明なイメージ' };
  }

  /* ---------- 七大师（内容见 content/masters.json） ---------- */
  var MASTERS = MC.masters || [];
  function byId(id) { for (var i = 0; i < MASTERS.length; i++) if (MASTERS[i].id === id) return MASTERS[i]; return null; }

  /* ---------- 解读：motif → 学派口吻 ---------- */
  function replyOf(master, text) {
    var ms = motifs(text);
    var key = null;
    for (var i = 0; i < ms.length; i++) if (master.lens[ms[i]]) { key = ms[i]; break; }
    if (!key && ms.length) key = ms[0];
    var lens = master.lens[key] || master.lens._;
    return {
      cn: lens.cn + ' ' + master.ask.cn,
      jp: lens.jp + ' ' + master.ask.jp,
      motifs: ms, key: key
    };
  }
  function verdictOf(master, text) {
    var ms = motifs(text);
    var tags = ms.slice(0, 3).map(function (k) { return motifLabel(k); });
    return {
      cn: master.close.cn + (tags.length ? '（见象：' + tags.map(function (t) { return t.cn; }).join('、') + '）' : ''),
      jp: master.close.jp + (tags.length ? '（象：' + tags.map(function (t) { return t.jp; }).join('、') + '）' : '')
    };
  }

  /* ---------- 页面挂载（psyche.html） ---------- */
  var cur = null; /* {m, dream, motifs} */

  function bubble(log, who, textObj, instant) {
    var d = document.createElement('div');
    d.className = 'abub ' + who;
    d.innerHTML = '<div class="aline"></div>';
    log.appendChild(d);
    var line = d.querySelector('.aline');
    var str = I.of(textObj);
    if (instant) line.textContent = str;
    else RC.ui.type(line, str, 20);
    log.scrollTop = log.scrollHeight;
    return d;
  }

  function renderGrid(host) {
    var html = '';
    for (var i = 0; i < MASTERS.length; i++) {
      var m = MASTERS[i];
      html += '<button type="button" class="mcard" data-m="' + m.id + '">' +
        '<span class="shadow-screen">' + RC.ui.portrait(m.img,m.cn+'皮影') + '</span>' +
        '<span class="mname"><span class="i18n-cn">' + m.cn + '</span><span class="i18n-jp">' + m.jp + '</span></span>' +
        '<span class="mschool"><span class="i18n-cn">' + m.school.cn + '</span><span class="i18n-jp">' + m.school.jp + '</span></span>' +
        '</button>';
    }
    host.innerHTML = html;
  }

  function openChat(m, els) {
    cur = { m: m, dream: '', motifs: [] };
    els.grid.classList.add('hidden');
    els.chat.classList.remove('hidden');
    els.who.innerHTML = '<span class="i18n-cn">' + m.cn + ' · ' + m.school.cn + '</span>' +
      '<span class="i18n-jp">' + m.jp + ' · ' + m.school.jp + '</span>';
    els.log.innerHTML = '';
    els.cardBox.innerHTML = '';
    bubble(els.log, 'm', m.greet);
  }

  function init() {
    var grid = U.el('masterGrid');
    if (!grid) return;
    var els = {
      grid: grid,
      chat: U.el('analystChat'), who: U.el('chatWho'), log: U.el('chatLog'),
      input: U.el('chatIn'), send: U.el('btnSend'), card: U.el('btnCard'),
      back: U.el('btnMasterBack'), cardBox: U.el('cardBox'), msg: U.el('analystMsg')
    };
    renderGrid(grid);

    grid.addEventListener('click', function (e) {
      var btn = e.target.closest('.mcard');
      if (!btn) return;
      var m = byId(btn.getAttribute('data-m'));
      if (m) openChat(m, els);
    });
    els.back.addEventListener('click', function () {
      cur = null;
      els.chat.classList.add('hidden');
      els.grid.classList.remove('hidden');
    });
    function send() {
      if (!cur) return;
      var t = (els.input.value || '').trim();
      if (!t) return;
      els.input.value = '';
      bubble(els.log, 'u', { cn: t, jp: t }, true);
      cur.dream = t; cur.motifs = motifs(t);
      var r = replyOf(cur.m, t);
      setTimeout(function () { bubble(els.log, 'm', { cn: r.cn, jp: r.jp }); }, 260);
    }
    els.send.addEventListener('click', send);
    els.input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); send(); }
    });
    els.card.addEventListener('click', function () {
      if (!cur || !cur.dream) { if (els.msg) els.msg.innerHTML = '<span class="red">※ ' + I.of({ cn: '先讲一个梦，再领卡。', jp: 'まず夢を一つ、それからカードを。' }) + '</span>'; return; }
      var v = verdictOf(cur.m, cur.dream);
      var entry = { m: cur.m.id, dream: cur.dream, motifs: cur.motifs, verdict: v, ts: Date.now() };
      var c = RC.case.get();
      var log = (c.analystLog || []).slice();
      log.push(entry);
      if (!RC.case.save({ analystLog: log })) return;
      /* 成就卡 */
      els.cardBox.innerHTML =
        '<div class="acard">' +
        '<div class="ac-head"><span class="shadow-screen">' + RC.ui.portrait(cur.m.img,'') + '</span>' +
        '<div><div class="ac-title"><span class="i18n-cn">' + cur.m.card.cn + '</span><span class="i18n-jp">' + cur.m.card.jp + '</span></div>' +
        '<div class="ac-name"><span class="i18n-cn">' + cur.m.cn + '</span><span class="i18n-jp">' + cur.m.jp + '</span></div></div></div>' +
        '<div class="ac-body">' + esc(v.cn) + '</div>' +
        '<div class="ac-foot">' + I.of({ cn: '已记入档案 · 鉴定书可引用', jp: '档案に记录済み · 鉴定书で引用可' }) + '</div>' +
        '</div>';
      if (els.msg) els.msg.innerHTML = '<span class="amber">※ ' + I.of({ cn: '成就卡已入账。', jp: 'カードを记录した。' }) + '</span>';
    });
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  window.RC = window.RC || {};
  /* Phase 2：精神分析页改由 Vue 挂载，DOM 晚于本脚本出现。
     init 可重入（找不到 #masterGrid 直接返回），组件挂载后再调一次。 */
  RC.analyst = { MASTERS: MASTERS, byId: byId, motifs: motifs, motifLabel: motifLabel, replyOf: replyOf, verdictOf: verdictOf, init: init };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
