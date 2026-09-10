/* ============================================================
   engine.js — 本地生成式推理引擎
   情感谱 / 罗夏墨迹分类 / 词联想复合检测 / 生日数秘 / 假说生成 / 鉴定书组装
   全部离线运行，不依赖任何外部 API

   内容与逻辑分离（Phase 3）：
     · 文案（假说正文、处方、冷读、印章、小结模板）→ content/hypotheses.json
     · 逻辑（打分、阈值、排序、条件组合）→ 本文件
   构建期由 tools/build-content.cjs 把 JSON 打成 window.RC_CONTENT。
   ============================================================ */
(function () {
  var U = RC.util;
  var HC = (window.RC_CONTENT && window.RC_CONTENT.hypotheses) || {};
  var SM = HC.summaries || {};

  /* 模板填充：{key} → 值 */
  function fill(tpl, map) {
    return String(tpl == null ? '' : tpl).replace(/\{(\w+)\}/g, function (_m, k) {
      var v = map ? map[k] : '';
      return v == null ? '' : String(v);
    });
  }

  /* ---------- 情感关键词谱（内容见 content/hypotheses.json） ---------- */
  var EMOTIONS = HC.emotions || [];

  function spectrum(c) {
    c=RC.model.normalize(c);
    var parts=[c.story,c.dream,c.recurring].concat(c.analystLog.map(function(l){return l.dream;}),c.assoc.map(function(a){return a.resp;}),c.sct.map(function(a){return a.a;}));
    var text=Array.from(new Set(parts.filter(Boolean))).join('。');
    // Quoted speech is not automatically attributed to the writer. Longest non-overlapping match wins.
    text=text.replace(/「[^」]*」|“[^”]*”|"[^"\n]*"/g,'');
    return EMOTIONS.map(function(e){
      var words=Array.from(new Set(e.w)).sort(function(a,b){return b.length-a.length;});
      var occupied=new Set(),evidence=[];
      words.forEach(function(kw){
        var start=0,at;
        while((at=text.indexOf(kw,start))!==-1){
          start=at+kw.length;
          var prefix=text.slice(Math.max(0,at-8),at);
          var overlap=false;for(var i=at;i<start;i++)if(occupied.has(i))overlap=true;
          if(overlap)continue;
          for(var j=at;j<start;j++)occupied.add(j);
          if(/(?:不再|不|没有|并非|不是|并不|未曾|毫无|不会|不觉得|不感到|不感到很)$/.test(prefix))continue;
          evidence.push(kw);
        }
      });
      var hits=evidence.length;
      return {k:e.k,label:e.label,jp:e.jp,hits:hits,v:hits?U.clamp(18+hits*13,18,96):0,evidence:evidence};
    });
  }

  /* ---------- 解梦会诊：七大师记录汇总 ---------- */
  function analystProfile(c) {
    var A = RC.analyst;
    var rows = (c.analystLog || []).map(function (l, i) {
      var m = A ? A.byId(l.m) : null;
      return {
        i: i + 1, masterId: l.m,
        masterCn: m ? m.cn : l.m, masterJp: m ? m.jp : l.m,
        schoolCn: m ? m.school.cn : '', schoolJp: m ? m.school.jp : '',
        motifs: l.motifs || [], dream: l.dream || '', verdict: l.verdict || {}
      };
    });
    var counts = {};
    rows.forEach(function (r) { r.motifs.forEach(function (k) { counts[k] = (counts[k] || 0) + 1; }); });
    var summary;
    if (!rows.length) {
      summary = SM.analystNone || '';
    } else {
      var masters = rows.map(function (r) { return r.masterCn; });
      var uniq = masters.filter(function (v, i) { return masters.indexOf(v) === i; });
      var topMotif = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];
      var tm = topMotif && A ? A.motifLabel(topMotif) : null;
      summary = fill(SM.analystPrefix, { n: uniq.length, names: uniq.join('、') }) +
        (tm ? fill(SM.analystMotif, { motif: tm.cn }) : '');
    }
    return { rows: rows, counts: counts, summary: summary };
  }

  /* ---------- 词联想：复合（complex）检测 — 适配 stim 为 {cn, jp} 或 字符串 ---------- */
  function assocProfile(c) {
    var AF = HC.assocFlags || {};
    var rows = (c.assoc || []).map(function (a) {
      var flag = null, note = '';
      var resp = String(a.resp || '').trim();
      var ms = a.ms || 0;
      /* stim 兼容：旧数据为字符串，新数据为 {cn, jp} */
      var stimCn = (typeof a.stim === 'object' && a.stim) ? (a.stim.cn || '') : String(a.stim || '');
      var stimJp = (typeof a.stim === 'object' && a.stim) ? (a.stim.jp || '') : String(a.stim || '');
      if (a.interrupted) { flag='interrupted'; note=AF.interrupted || ''; }
      else if (!resp || resp === '...' || resp === '…') { flag = 'refuse'; note = AF.refuse || ''; }
      else if (resp.indexOf(stimCn) >= 0 && stimCn) { flag = 'persev'; note = AF.persev || ''; }
      else if (ms > 5000) { flag = 'complex+'; note = fill(AF.complexPlus, { sec: (ms / 1000).toFixed(1) }); }
      else if (ms > 2500) { flag = 'complex'; note = fill(AF.complex, { sec: (ms / 1000).toFixed(1) }); }
      else if (ms < 900) { flag = 'flight'; note = AF.flight || ''; }
      return { stimCn: stimCn, stimJp: stimJp, stim: stimCn, resp: resp, ms: ms, flag: flag, note: note };
    });
    var flagged = rows.filter(function (r) { return r.flag && r.flag !== 'flight' && r.flag !== 'interrupted'; });
    var summary = !rows.length ? (SM.assocNone || '') : flagged.length
      ? fill(SM.assocFlagged, {
          total: rows.length,
          n: flagged.length,
          list: flagged.map(function (f) { return '「' + (f.stimCn || f.stimJp) + '」'; }).join('、')
        })
      : (SM.assocClean || '');
    return { rows: rows, flagged: flagged, summary: summary };
  }

  /* ---------- 句子完成测试（SCT）：空白、首字、词频 ---------- */
  function sentenceProfile(c) {
    var list = c.sct || [];
    if (!list.length) return null;
    var rows = list.map(function (x) {
      return { i: x.i + 1, qCn: x.qCn || '', qJp: x.qJp || '', a: x.a || '', empty: !x.a };
    });
    var blanks = rows.filter(function (r) { return r.empty; }).length;

    /* 句首 / 首个名词短语 —— 取答案前半句前 6 个字 */
    var OPENERS = [];
    rows.forEach(function (r) {
      if (r.empty) return;
      var a = String(r.a).replace(/^[\s,，.。、:：;；]+/, '');
      var head = a.slice(0, 6);
      if (head) OPENERS.push(head);
    });
    var openerCounts = {};
    OPENERS.forEach(function (h) { openerCounts[h] = (openerCounts[h] || 0) + 1; });
    var repeatOpeners = Object.keys(openerCounts).filter(function (k) { return openerCounts[k] >= 2; });

    /* 高频词：剔除停用词，取 top 5 */
    var STOP = new Set([
      '我','你','他','她','它','们','的','了','着','和','与','或','也','就','都','还','在','是','有','没',
      '会','能','可','要','不','也','但','而','又','一','一个','一','因为','所以','如果','会','已','已经','大概',
      'the','a','an','and','or','of','to','in','on','is','are','was','were','be'
    ]);
    var FREQ = {};
    rows.forEach(function (r) {
      if (r.empty) return;
      String(r.a).split(/[\s,，.。、:：;；「」()（）!?！？]+/).forEach(function (w) {
        w = w.trim();
        if (!w || w.length < 2 || STOP.has(w)) return;
        FREQ[w] = (FREQ[w] || 0) + 1;
      });
    });
    var topWords = Object.keys(FREQ).sort(function (a, b) { return FREQ[b] - FREQ[a]; }).slice(0, 5)
      .map(function (w) { return { w: w, n: FREQ[w] }; });

    /* 综合 */
    var summary = '';
    if (blanks > 0) summary += fill(SM.sctBlanks, { n: blanks });
    if (repeatOpeners.length) summary += fill(SM.sctOpeners, { list: repeatOpeners.slice(0, 2).join('」「') });
    else summary += SM.sctNoOpeners || '';
    if (topWords.length) summary += fill(SM.sctTopWords, { list: topWords.map(function (x) { return x.w + ' ×' + x.n; }).join(' ／ ') });
    summary += SM.sctTail || '';
    return { rows: rows, blanks: blanks, repeatOpeners: repeatOpeners, topWords: topWords, summary: summary };
  }

  /* ---------- 生日数秘 ---------- */
  var ZODIAC = HC.zodiac || [];
  function birthReading(c) {
    if (!c.birth) return null;
    var d = String(c.birth).replace(/-/g, '');
    if (!/^\d{8}$/.test(d)) return null;
    var y = +d.slice(0, 4), m = +d.slice(4, 6), day = +d.slice(6, 8);
    var sum = d.split('').reduce(function (a, b) { return a + (+b); }, 0);
    var lp = sum; while (lp > 9 && lp !== 11 && lp !== 22) lp = String(lp).split('').reduce(function (a, b) { return a + (+b); }, 0);
    var bc = sum; while (bc > 21) bc = String(bc).split('').reduce(function (a, b) { return a + (+b); }, 0);
    var md = m * 100 + day, z = '摩羯座';
    for (var i = 0; i < ZODIAC.length; i++) if (md <= ZODIAC[i][0]) { z = ZODIAC[i][1]; break; }
    return { year: y, lifePath: lp, zodiac: z, birthCard: bc, birthCardObj: RC.tarot.byId(bc) };
  }

  /* ---------- 假说库 ----------
     打分与阈值是逻辑（在这里），标题与正文是内容（在 JSON）。
     follow 列出可拼接的补充段落：{ key, on, map }，on 为真才拼。 */
  function hypotheses(c, sp, an, assoc) {
    var S = {}; sp.forEach(function (e) { S[e.k] = e; });
    var q = {
      story: U.quoteFrom(c.story), dream: U.quoteFrom(c.dream), rec: U.quoteFrom(c.recurring, 18)
    };
    var DEFS = HC.hypotheses || {};
    var H = [];
    var push = function (id, score, follow) {
      if (score <= 0) return;
      var t = DEFS[id];
      if (!t) return;                       /* 内容缺失就跳过，不产出半截假说 */
      var body = t.body || '';
      (follow || []).forEach(function (f) {
        if (f && f.on && t[f.key]) body += fill(t[f.key], f.map);
      });
      H.push({ id: id, score: score, titleCn: t.titleCn, titleJp: t.titleJp, body: body });
    };

    push('persona', (an.counts.mirror ? 40 : 0) + (S.shm.v > 30 ? 25 : 0) + (c.category === '工作' || c.category === '自我' ? 15 : 0) + (S.dis.hits ? 20 : 0),
      [{ key: 'story', on: !!q.story, map: q }, { key: 'mirror', on: !!an.counts.mirror }]);

    push('shadow', (S.ang.hits ? 30 : 0) + (S.esc.v > 30 ? 20 : 0) + (assoc.flagged.length ? 10 : 0),
      [{ key: 'rec', on: !!q.rec, map: q }]);

    push('grief', (S.los.v > 30 ? 40 : 0) + ((c.dream || '').match(/死|去世|走|棺|葬|告别/) ? 20 : 0),
      [{ key: 'dream', on: !!q.dream, map: q }]);

    push('dissoc', (S.dis.v > 30 ? 40 : 0) + (c.paralysis ? 20 : 0) + (c.dreamFreq === '每夜' ? 15 : 0), []);

    push('repeat', (c.recurring && c.recurring.length > 3 ? 30 : 0) + ((c.dream || '').length > 10 ? 15 : 0), []);

    push('judge', (S.gui.v > 30 ? 40 : 0), []);

    H.sort(function (a, b) { return b.score - a.score; });
    return H.slice(0, 2);
  }

  /* ---------- 处方 ---------- */
  function prescription(hypoIds) {
    var P = HC.prescriptions || {};
    var out = [];
    hypoIds.forEach(function (id) { if (P[id]) out.push(P[id]); });
    if (!out.length && P._default) out.push(P._default);
    if (P._return) out.push(P._return);
    return out;
  }

  /* ---------- 冷读（专业洞察：指出对方没明说的部分） ---------- */
  function coldReads(c) {
    var pool = HC.coldReads || [];
    if (!pool.length) return [];
    var pre = HC.coldReadsPrefix || ['', ''];
    var r = U.rng(U.hash((c.handle || '') + '|' + (c.story || '').length));
    var a = Math.floor(r() * pool.length), b = Math.floor(r() * pool.length);
    if (b === a) b = (b + 3) % pool.length;
    return [String(pre[0] || '') + pool[a], String(pre[1] || pre[0] || '') + pool[b]];
  }

  /* ---------- "缺席"检测：你一次都没提的那个情绪 ---------- */
  function absence(sp) {
    var hi = sp.filter(function (e) { return e.v > 40; }).sort(function (a, b) { return b.v - a.v; })[0];
    var zero = sp.filter(function (e) { return e.hits === 0; });
    if (!hi || !zero.length) return null;
    var pick = zero[Math.floor(U.rng(hi.k.length * 7)() * zero.length)];
    return fill(HC.absenceTemplate, { label: pick.label });
  }

  /* ---------- 组装鉴定书 ---------- */
  function buildVerdict(c) {
    c=RC.model.normalize(c);
    var sp = spectrum(c);
    var an = analystProfile(c);
    var assoc = assocProfile(c);
    var birth = birthReading(c);
    var H = hypotheses(c, sp, an, assoc);
    var tarotRows = (c.tarot || []).map(function (t) {
      var card = RC.tarot.byId(t.id);
      var pos = RC.tarot.spreads[c.tarotSpread].pos[t.pos];
      return {
        id: t.id, upright: t.upright, pos: pos, card: card,
        meaning: t.upright ? card.up : card.rv
      };
    });
    var code = 'RC-' + new Date(c.createdAt || Date.now()).getFullYear() + '-' + U.pad(U.hash(JSON.stringify(c.story || '')).toString(36).slice(0, 4).toUpperCase(), 4);
    var ST = HC.stamps || {};
    var st = H.length && H[0].score >= 60 ? ST.confirmed : (H.length ? ST.observe : ST.insufficient);
    st = st || {};
    return {
      code: code, stamp: st.cn || '', stampCn: st.cn || '', stampJp: st.jp || '',
      spectrum: sp, analyst: an, assoc: assoc, birth: birth, sct: sentenceProfile(c),
      reportVersion:1, caseId:c.caseId, generatedAt:c.updatedAt || c.createdAt,
      hypotheses: H, tarot: tarotRows,
      tarotSpread: c.tarotSpread, tarotQuestion: c.tarotQuestion,
      prescription: prescription(H.map(function (h) { return h.id; })),
      cold: coldReads(c), absence: absence(sp),
      quotes: { story: U.quoteFrom(c.story, 40), dream: U.quoteFrom(c.dream, 40), rec: U.quoteFrom(c.recurring, 24) },
      open: HC.verdictOpen || []
    };
  }

  window.RC = window.RC || {};
  RC.engine = {
    spectrum: spectrum, analystProfile: analystProfile, assocProfile: assocProfile,
    birthReading: birthReading, hypotheses: hypotheses, buildVerdict: buildVerdict, coldReads: coldReads
  };
})();
