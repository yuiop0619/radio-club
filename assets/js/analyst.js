/* ============================================================
   analyst.js — 解梦智能体：七大师会诊
   Phase 7 大改：默认走本机模板（零成本），用户自接模型后走真 AI。
   七位大师（四男三女）各执一派：周公 / 弗洛伊德 / 荣格 / 霍妮 /
   珀尔斯 / 卡特莱特 / 冯·法兰兹。
   引擎做三件事：
     1. 从客人的梦文本里抽取「意象 motif」（水/坠/追/飞/牙/死/考/裸/兽/屋/火/镜）
     2. 按所选大师的学派 lens 把 motif 翻译成该派口吻的解读
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

  /* ---------- 本机模板兜底：motif → 学派口吻 ----------
     第一轮回合给解读+追问，第二回合起只给结案式回应，避免死循环。 */
  function replyOf(master, text, turn) {
    var ms = motifs(text);
    var key = null;
    for (var i = 0; i < ms.length; i++) if (master.lens[ms[i]]) { key = ms[i]; break; }
    if (!key && ms.length) key = ms[0];
    var lens = master.lens[key] || master.lens._;
    var suffix = (turn <= 1) ? (' ' + master.ask.cn) : '';
    var suffixJp = (turn <= 1) ? (' ' + master.ask.jp) : '';
    return {
      cn: lens.cn + suffix,
      jp: lens.jp + suffixJp,
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
  var cur = null; /* {m, dream, motifs, turn, history} */

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
  function bubbleText(log, who, text, instant) {
    return bubble(log, who, { cn: text, jp: text }, instant);
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
    cur = { m: m, dream: '', motifs: [], turn: 0, history: [] };
    els.grid.classList.add('hidden');
    els.chat.classList.remove('hidden');
    els.who.innerHTML = '<span class="i18n-cn">' + m.cn + ' · ' + m.school.cn + '</span>' +
      '<span class="i18n-jp">' + m.jp + ' · ' + m.school.jp + '</span>';
    els.log.innerHTML = '';
    els.cardBox.innerHTML = '';
    bubble(els.log, 'm', m.greet);
  }

  /* ---------- 模型生成：用大师人设向用户自己的模型请求 ---------- */
  function masterSystem(master) {
    var cn = '你是 RADIO CLUB 的解梦大师「' + master.cn + '」，代表「' + master.school.cn +
      '」学派。请用该学派的口吻、视角与术语，为来访者解读梦境。' +
      '保持克制、有洞察力，不强行解释，不制造恐惧，不下医学诊断。' +
      '每次回复 3-5 句中文，语气像一位深夜酒吧里愿意倾听的大师。';
    var jp = 'あなたは RADIO CLUB の夢解きの大家「' + master.jp + '」，「' + master.school.jp +
      '」の流派を代表しています。その流派の口調と視点で、来訪者の夢を読んでください。';
    return { cn: cn, jp: jp };
  }
  function modelReply(els) {
    if (!cur) return;
    if (!RC.gen || !RC.gen.isReady || !RC.gen.isReady()) return false;
    var sys = masterSystem(cur.m);
    var messages = [{ role: 'system', content: I.of(sys) }];
    cur.history.forEach(function (h) { messages.push({ role: h.role, content: h.text }); });
    var loading = bubbleText(els.log, 'm', '…', true);
    RC.gen.chat(messages, { maxTokens: 700 }).then(function (r) {
      if (loading && loading.parentNode) loading.parentNode.removeChild(loading);
      if (r && r.ok && r.text) {
        bubbleText(els.log, 'm', r.text, false);
      } else {
        /* 模型失败自动降级模板 */
        var fallback = replyOf(cur.m, cur.dream, cur.turn);
        bubble(els.log, 'm', fallback);
      }
    });
    return true;
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
      cur.turn++;
      cur.dream = t;
      cur.motifs = motifs(t);
      cur.history.push({ role: 'user', text: t });
      bubble(els.log, 'u', { cn: t, jp: t }, true);
      /* 优先走用户自己的模型 */
      if (modelReply(els)) return;
      /* 未配置模型：本机模板，第一回合给解读+追问，后续只给结案式回应 */
      var r = replyOf(cur.m, t, cur.turn);
      cur.history.push({ role: 'assistant', text: I.of(r) });
      bubble(els.log, 'm', r);
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
