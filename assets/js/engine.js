/* ============================================================
   engine.js — 本地生成式推理引擎
   情感谱 / 罗夏墨迹分类 / 词联想复合检测 / 生日数秘 / 假说生成 / 鉴定书组装
   全部离线运行，不依赖任何外部 API
   ============================================================ */
(function () {
  var U = RC.util;

  /* ---------- 情感关键词谱 ---------- */
  var EMOTIONS = [
    { k: 'anx',  label: '不安', jp: '不安',
      w: ['不安', '焦虑', '焦躁', '害怕', '怕', '担心', '紧张', '失眠', '心慌', '发慌', '喘不上气', '慌', 'こわ', '不安'] },
    { k: 'ang',  label: '愤怒', jp: '怒り',
      w: ['怒', '生气', '恨', '烦', '受不了', '凭什么', '可恶', '想砸', '讨厌', 'イラ'] },
    { k: 'gui',  label: '罪责', jp: '罪悪',
      w: ['内疚', '愧疚', '抱歉', '对不起', '是我的错', '怪我', '都怪我', '罪', '申し訳', '后悔'] },
    { k: 'los',  label: '丧失', jp: '喪失',
      w: ['失去', '走了', '去世', '离开', '没了', '空', '丧', '再也', '不在了', '别れ', '死'] },
    { k: 'shm',  label: '羞耻', jp: '恥',
      w: ['羞', '丢人', '没脸', '耻辱', '被看见', '暴露', '出丑', '恥ずかし', '难堪'] },
    { k: 'hop',  label: '期待', jp: '期待',
      w: ['希望', '期待', '要是', '如果', '也许', '盼', '想重新', '好想'] },
    { k: 'esc',  label: '逃避', jp: '逃避',
      w: ['逃', '躲', '不想面对', '回避', '消失', '离开这里', '算了', '逃げ', '不管了'] },
    { k: 'dis',  label: '解离', jp: '解離',
      w: ['另一个我', '不认识自己', '陌生', '断片', '记不得', '记忆没有', '恍惚', '梦游', '不像我', '鏡', '镜子里'] }
  ];

  function spectrum(c) {
    var text = [c.story, c.dream, c.recurring,
      (c.analystLog || []).map(function (l) { return l.dream; }).join(' '),
      (c.assoc || []).map(function (a) { return a.resp; }).join(' ')
    ].join(' \n ');
    return EMOTIONS.map(function (e) {
      var hits = 0;
      e.w.forEach(function (kw) {
        var re = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        var m = text.match(re);
        if (m) hits += m.length;
      });
      // 0 命中给一个低基线，避免全零；命中越多越饱和
      var v = hits === 0 ? 4 : U.clamp(18 + hits * 13, 18, 96);
      return { k: e.k, label: e.label, jp: e.jp, hits: hits, v: v };
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
      summary = '（本次未进行解梦会诊。）';
    } else {
      var masters = rows.map(function (r) { return r.masterCn; });
      var uniq = masters.filter(function (v, i) { return masters.indexOf(v) === i; });
      var topMotif = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];
      var tm = topMotif && A ? A.motifLabel(topMotif) : null;
      summary = '你先后请 ' + uniq.length + ' 位大师会诊：' + uniq.join('、') + '。' +
        (tm ? '反复浮现的意象是「' + tm.cn + '」——不同学派都停在了它上面。' : '');
    }
    return { rows: rows, counts: counts, summary: summary };
  }

  /* ---------- 词联想：复合（complex）检测 — 适配 stim 为 {cn, jp} 或 字符串 ---------- */
  function assocProfile(c) {
    var rows = (c.assoc || []).map(function (a) {
      var flag = null, note = '';
      var resp = String(a.resp || '').trim();
      var ms = a.ms || 0;
      /* stim 兼容：旧数据为字符串，新数据为 {cn, jp} */
      var stimCn = (typeof a.stim === 'object' && a.stim) ? (a.stim.cn || '') : String(a.stim || '');
      var stimJp = (typeof a.stim === 'object' && a.stim) ? (a.stim.jp || '') : String(a.stim || '');
      if (!resp || resp === '...' || resp === '…') { flag = 'refuse'; note = '拒答：这个词被你跳过了。跳过本身就是一种回答。'; }
      else if (resp.indexOf(stimCn) >= 0 && stimCn) { flag = 'persev'; note = '反復：你的回答里含着刺激词本身。思维在这个词上原地打转。'; }
      else if (ms > 5000) { flag = 'complex+'; note = '强复合：反应潜伏期 ' + (ms / 1000).toFixed(1) + ' 秒。这个词碰到了不该碰的地方。'; }
      else if (ms > 2500) { flag = 'complex'; note = '复合：反应潜伏期 ' + (ms / 1000).toFixed(1) + ' 秒，明显长于你的基线。这里有情绪电阻。'; }
      else if (ms < 900) { flag = 'flight'; note = '过速：几乎是条件反射。太快有时不是流畅，而是抢先堵住答案。'; }
      return { stimCn: stimCn, stimJp: stimJp, stim: stimCn, resp: resp, ms: ms, flag: flag, note: note };
    });
    var flagged = rows.filter(function (r) { return r.flag && r.flag !== 'flight'; });
    var summary = flagged.length
      ? '在 ' + rows.length + ' 个刺激词中，有 ' + flagged.length + ' 个引发了反应延迟或拒答：' +
        flagged.map(function (f) { return '「' + (f.stimCn || f.stimJp) + '」'; }).join('、') +
        '。荣格会把这些点称为"复合"——情绪在那里结成了硬块，绕开了你的意识。'
      : '你的反应潜伏期整体平稳，没有明显的复合点。要么你真的通透，要么你把电阻藏得很深。我倾向于后者。';
    return { rows: rows, flagged: flagged, summary: summary };
  }

  /* ---------- 句子完成测试（SCT）：空白、首字、词频 ---------- */
  function sentenceProfile(c) {
    var list = c.sct || [];
    if (!list.length) return null;
    var rows = list.map(function (x) {
      return { i: x.i, qCn: x.qCn || '', qJp: x.qJp || '', a: x.a || '', empty: !x.a };
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
    if (blanks > 0) summary += '你留下了 ' + blanks + ' 句空白。写不出的句子也是答案——它通常在保护你还没准备好触碰的东西。';
    if (repeatOpeners.length) summary += ' 你的句子常常以「' + repeatOpeners.slice(0, 2).join('」「') + '」开头——这是你的常用开场姿势。';
    else summary += ' 你的句子开头并不重复——不同的起点，意味着你愿意换一种方式进入事情。';
    if (topWords.length) summary += ' 高频词 TOP5：' + topWords.map(function (x) { return x.w + ' ×' + x.n; }).join(' ／ ');
    summary += ' 把这些词连起来再读一遍，你能听到自己的语气。';
    return { rows: rows, blanks: blanks, repeatOpeners: repeatOpeners, topWords: topWords, summary: summary };
  }

  /* ---------- 生日数秘 ---------- */
  var ZODIAC = [
    [120, '摩羯座'], [219, '水瓶座'], [321, '双鱼座'], [420, '白羊座'], [521, '金牛座'], [621, '双子座'],
    [722, '巨蟹座'], [823, '狮子座'], [923, '处女座'], [1023, '天秤座'], [1122, '天蝎座'], [1222, '射手座'], [9999, '摩羯座']
  ];
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

  /* ---------- 假说库 ---------- */
  function hypotheses(c, sp, an, assoc) {
    var S = {}; sp.forEach(function (e) { S[e.k] = e; });
    var q = {
      story: U.quoteFrom(c.story), dream: U.quoteFrom(c.dream), rec: U.quoteFrom(c.recurring, 18)
    };
    var H = [];
    /* push(id, score, 中文标题, 日文标题, 正文) —— 正文必须落在第 5 个参数上 */
    var push = function (id, score, titleCn, titleJp, body) {
      if (score > 0) H.push({ id: id, score: score, titleCn: titleCn, titleJp: titleJp, body: body });
    };

    push('persona', (an.counts.mirror ? 40 : 0) + (S.shm.v > 30 ? 25 : 0) + (c.category === '工作' || c.category === '自我' ? 15 : 0) + (S.dis.hits ? 20 : 0),
      '面具的过度使用', 'ペルソナの過剰適用',
      '你戴着的脸已经长在了脸上。问题不在于扮演，而在于你已经想不起卸下来之后那张脸的表情。' +
      (q.story ? '你说「' + q.story + '」——注意，你在描述自己时用的全是角色和职责，没有一处是"我想要"。' : '') +
      (an.counts.mirror ? '你在梦里反复照见镜与影，这不是巧合。' : ''));

    push('shadow', (S.ang.hits ? 30 : 0) + (S.esc.v > 30 ? 20 : 0) + (assoc.flagged.length ? 10 : 0),
      '被压进地下室的愤怒', '抑圧された影',
      '你的叙述里愤怒的浓度和你句子的克制程度不成比例。你把"我不允许自己生气"执行得太彻底，于是它改道了——变成失眠、变成反复的念头、变成梦里那只追你的东西。' +
      (q.rec ? '你反复想起的那句「' + q.rec + '」，就是它敲门的方式。' : ''));

    push('grief', (S.los.v > 30 ? 40 : 0) + ((c.dream || '').match(/死|去世|走|棺|葬|告别/) ? 20 : 0),
      '一场没有办完的告别', '未完了の喪失',
      '有一件事你还没有允许自己哀悼。你可能觉得"已经过去了"，但哀悼不是时间问题，是工序问题——跳过的那一步会一直在原地等你。' +
      (q.dream ? '你的梦里写着「' + q.dream + '」。梦不处理事件，梦处理没说完的话。' : ''));

    push('dissoc', (S.dis.v > 30 ? 40 : 0) + (c.paralysis ? 20 : 0) + (c.dreamFreq === '每夜' ? 15 : 0),
      '把「我」切成两半来减震', '解離的防衛',
      '当冲击超过承受上限时，心智会做的第一件事不是解决，而是"让承受的人不是我"。你描述的陌生感、断片感、镜子里的错位感，都是这个减震器在工作。它保护过你，但它现在不肯关了。');

    push('repeat', (c.recurring && c.recurring.length > 3 ? 30 : 0) + ((c.dream || '').length > 10 ? 15 : 0),
      '同一幕戏的第 n 次重演', '反復強迫',
      '你在重复一个没有被理解的场景。重复不是记忆太好，而是理解没到位——心智会一直重放，直到有人（通常是你自己）看懂那一帧到底发生了什么。');

    push('judge', (S.gui.v > 30 ? 40 : 0),
      '你替别人继续审判自己', '内面化された裁判官',
      '最初指责你的那个声音已经不在场了，但你把它录了下来，并且每天自己播放。你现在的痛苦里，有一半是替一个早已离场的人执行的刑罚。');

    H.sort(function (a, b) { return b.score - a.score; });
    return H.slice(0, 2);
  }

  /* ---------- 处方 ---------- */
  function prescription(hypoIds) {
    var P = {
      persona: '本周安排一次"无角色时间"：两小时，不做任何人的同事/子女/伴侣，只记录"我现在想做什么"。哪怕答案只是"想坐着"。',
      shadow: '给愤怒一个合法的出口：写一封不寄出的信，或者把那句最想说的话写在纸上然后处理掉。重点不是发泄，是承认它存在。',
      grief: '为那件失去的事补一个仪式：一次 alone 的散步、一件旧物的整理、或一句当时没说出口的话。哀悼需要动作，不需要坚强。',
      dissoc: '当陌生感袭来时做"接地"：说出你眼前 5 样东西的名字、4 种声音、3 种触感。把"我"从减震器后面请回来。',
      repeat: '把那一幕写下来，但这次改写结局——不是美化，而是让当时的你得到一个当时没得到的回应。重写的过程就是理解的过程。',
      judge: '下次自我审判响起时，问一句："这句话最初是谁说的？"把声音归还给它真正的主人。'
    };
    var out = [];
    hypoIds.forEach(function (id) { if (P[id]) out.push(P[id]); });
    if (!out.length) out.push('先睡够。其余的等你不再透支时再谈。');
    out.push('七天内回到这间酒吧一次。不是因为我需要你，是因为你需要一个"还没结束"的地方。');
    return out;
  }

  /* ---------- 冷读（专业洞察：指出对方没明说的部分） ---------- */
  function coldReads(c) {
    var pool = [
      '你写这件事的时候删改过至少一次。删掉的那句，往往比留下的更重要。',
      '你把结果放在最前面讲。通常只有已经疼过的人，才会先说结果。',
      '这件事你之前对人讲过一个删减版。今晚这份，更接近真话。',
      '你在某个词上停了一下。我没有指出来，但你自己知道是哪个。',
      '你通篇在解释"为什么会这样"，却一次都没说"我希望怎样"。我把后者补上了。'
    ];
    var r = U.rng(U.hash((c.handle || '') + '|' + (c.story || '').length));
    var a = Math.floor(r() * pool.length), b = Math.floor(r() * pool.length);
    if (b === a) b = (b + 3) % pool.length;
    return [pool[a], pool[b]];
  }

  /* ---------- "缺席"检测：你一次都没提的那个情绪 ---------- */
  function absence(sp) {
    var hi = sp.filter(function (e) { return e.v > 40; }).sort(function (a, b) { return b.v - a.v; })[0];
    var zero = sp.filter(function (e) { return e.hits === 0; });
    if (!hi || !zero.length) return null;
    var pick = zero[Math.floor(U.rng(hi.k.length * 7)() * zero.length)];
    return '你的叙述里一次都没有出现「' + pick.label + '」这个词。但你的句子在发抖。' +
      '人们通常只对自己最熟悉的情绪闭口不谈。';
  }

  /* ---------- 组装鉴定书 ---------- */
  function buildVerdict(c) {
    var sp = spectrum(c);
    var an = analystProfile(c);
    var assoc = assocProfile(c);
    var birth = birthReading(c);
    var H = hypotheses(c, sp, an, assoc);
    var tarotRows = (c.tarot || []).map(function (t) {
      var card = RC.tarot.byId(t.id);
      var pos = RC.tarot.positions[t.pos];
      return {
        id: t.id, upright: t.upright, pos: pos, card: card,
        meaning: t.upright ? card.up : card.rv
      };
    });
    var code = 'RC-' + new Date().getFullYear() + '-' + U.pad(U.hash(JSON.stringify(c.story || '')).toString(36).slice(0, 4).toUpperCase(), 4);
    var stampCn = H.length && H[0].score >= 60 ? '假说成立' : (H.length ? '待观察' : '资料不足');
    var stampJp = H.length && H[0].score >= 60 ? '仮説成立' : (H.length ? '要観察' : '資料不足');
    return {
      code: code, stamp: stampCn, stampCn: stampCn, stampJp: stampJp,
      spectrum: sp, analyst: an, assoc: assoc, birth: birth,
      hypotheses: H, tarot: tarotRows,
      tarotSpread: c.tarotSpread, tarotQuestion: c.tarotQuestion,
      prescription: prescription(H.map(function (h) { return h.id; })),
      cold: coldReads(c), absence: absence(sp),
      quotes: { story: U.quoteFrom(c.story, 40), dream: U.quoteFrom(c.dream, 40), rec: U.quoteFrom(c.recurring, 24) },
      open: [
        '你没有告诉我那件事发生的"地点"。地点往往藏着答案的一半。',
        '如果七天后你没有回来，我会假设你选择了继续扮演。那不是错，只是我会记得。'
      ]
    };
  }

  window.RC = window.RC || {};
  RC.engine = {
    spectrum: spectrum, analystProfile: analystProfile, assocProfile: assocProfile,
    birthReading: birthReading, hypotheses: hypotheses, buildVerdict: buildVerdict, coldReads: coldReads
  };
})();
