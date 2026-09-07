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
      (c.inkblots || []).map(function (i) { return i.text; }).join(' '),
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

  /* ---------- 罗夏墨迹分类 ---------- */
  var BLOT_CATS = [
    { k: 'mask', label: '面具／假面', jp: '仮面', w: ['面具', '假面', '口罩', '脸谱'] },
    { k: 'inse', label: '昆虫', jp: '昆虫', w: ['虫', '蜘蛛', '蜈蚣', '蟑螂', '蚁', '甲虫'] },
    { k: 'anat', label: '解剖／血', jp: '解剖', w: ['血', '内脏', '肺', '骨', '肉', '伤口', '器官', '骨盆', '肋骨'] },
    { k: 'pers', label: '人物', jp: '人物', w: ['人', '男人', '女人', '脸', '面孔', '孩子', '母亲', '妈妈', '父亲', '爸爸', '背影', '手', '眼睛', '两个人'] },
    { k: 'anim', label: '动物', jp: '動物', w: ['动物', '狗', '猫', '鸟', '蝴蝶', '蛾', '兔', '鱼', '蝙蝠', '兽'] },
    { k: 'plan', label: '植物', jp: '植物', w: ['花', '树', '叶', '草', '根', '藤'] },
    { k: 'mech', label: '机械', jp: '機械', w: ['机器', '齿轮', '引擎', '零件', '金属', '电路', '机器人'] },
    { k: 'arch', label: '建筑', jp: '建築', w: ['房子', '门', '窗', '桥', '塔', '走廊', '楼梯', '房间'] },
    { k: 'none', label: '未见／回避', jp: '不明', w: ['看不出', '不知道', '没有', '空白', '什么都', '就是墨', '污渍', '墨迹'] }
  ];
  function classifyBlot(text) {
    var t = String(text || '').trim();
    if (!t) return BLOT_CATS[BLOT_CATS.length - 1];
    for (var i = 0; i < BLOT_CATS.length; i++) {
      var c = BLOT_CATS[i];
      for (var j = 0; j < c.w.length; j++) if (t.indexOf(c.w[j]) >= 0) return c;
    }
    return { k: 'abst', label: '抽象／形状', jp: '抽象' };
  }
  function inkblotProfile(c) {
    var rows = (c.inkblots || []).map(function (b, i) {
      var cat = classifyBlot(b.text);
      return { i: i + 1, text: b.text, cat: cat.k, catLabel: cat.label, jp: cat.jp };
    });
    var counts = {};
    rows.forEach(function (r) { counts[r.cat] = (counts[r.cat] || 0) + 1; });
    var dom = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0] || 'abst';
    var summary = {
      mask: '你在五张墨迹里看见了面具。墨迹本身没有面具——是你把"给别人看的脸"带了进来。',
      inse: '昆虫反应偏多。你把模糊的威胁读成了会爬、会繁殖的东西：它小，但不止一只。',
      anat: '出现了血与内脏的反应。你的注意力落在"身体内部被打开"这件事上，这通常和一次没有被处理的伤害有关。',
      pers: '人物反应占优。即使面对完全无意义的墨点，你最先找到的仍然是"人"——你对他人的动向保持着过高的警觉。',
      anim: '动物反应偏多。你倾向于把未知读成活的、会动的东西，而不是静止的。',
      plan: '植物反应偏多。你在模糊里寻找生长与根，这是一种偏向修复的阅读方式。',
      mech: '机械反应偏多。你把感受翻译成了结构与零件——用"它是怎么运转的"来回避"它让我感觉如何"。',
      arch: '建筑反应偏多。你关心门、窗与走廊：入口和出口。你一直在找离开或进入的路。',
      none: '你多次回答"看不出"。面对模糊时你选择关闭阅读——这是一种保护，也是一种回避。',
      abst: '你的反应偏向抽象与形状。你把情绪放在了距离之外，用"形式"代替"感受"。'
    };
    return { rows: rows, counts: counts, dom: dom, summary: summary[dom] || summary.abst };
  }

  /* ---------- 词联想：复合（complex）检测 ---------- */
  function assocProfile(c) {
    var rows = (c.assoc || []).map(function (a) {
      var flag = null, note = '';
      var resp = String(a.resp || '').trim();
      var ms = a.ms || 0;
      if (!resp || resp === '...' || resp === '…') { flag = 'refuse'; note = '拒答：这个词被你跳过了。跳过本身就是一种回答。'; }
      else if (resp.indexOf(a.stim) >= 0) { flag = 'persev'; note = '反復：你的回答里含着刺激词本身。思维在这个词上原地打转。'; }
      else if (ms > 5000) { flag = 'complex+'; note = '强复合：反应潜伏期 ' + (ms / 1000).toFixed(1) + ' 秒。这个词碰到了不该碰的地方。'; }
      else if (ms > 2500) { flag = 'complex'; note = '复合：反应潜伏期 ' + (ms / 1000).toFixed(1) + ' 秒，明显长于你的基线。这里有情绪电阻。'; }
      else if (ms < 900) { flag = 'flight'; note = '过速：几乎是条件反射。太快有时不是流畅，而是抢先堵住答案。'; }
      return { stim: a.stim, resp: resp, ms: ms, flag: flag, note: note };
    });
    var flagged = rows.filter(function (r) { return r.flag && r.flag !== 'flight'; });
    var summary = flagged.length
      ? '在 ' + rows.length + ' 个刺激词中，有 ' + flagged.length + ' 个引发了反应延迟或拒答：' +
        flagged.map(function (f) { return '「' + f.stim + '」'; }).join('、') +
        '。荣格会把这些点称为"复合"——情绪在那里结成了硬块，绕开了你的意识。'
      : '你的反应潜伏期整体平稳，没有明显的复合点。要么你真的通透，要么你把电阻藏得很深。我倾向于后者。';
    return { rows: rows, flagged: flagged, summary: summary };
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
  function hypotheses(c, sp, blot, assoc) {
    var S = {}; sp.forEach(function (e) { S[e.k] = e; });
    var q = {
      story: U.quoteFrom(c.story), dream: U.quoteFrom(c.dream), rec: U.quoteFrom(c.recurring, 18)
    };
    var H = [];
    var push = function (id, score, title, jp, body) { if (score > 0) H.push({ id: id, score: score, title: title, jp: jp, body: body }); };

    push('persona', (blot.counts.mask ? 40 : 0) + (S.shm.v > 30 ? 25 : 0) + (c.category === '工作' || c.category === '自我' ? 15 : 0) + (S.dis.hits ? 20 : 0),
      '面具的过度使用',
      '你戴着的脸已经长在了脸上。问题不在于扮演，而在于你已经想不起卸下来之后那张脸的表情。' +
      (q.story ? '你说「' + q.story + '」——注意，你在描述自己时用的全是角色和职责，没有一处是"我想要"。' : '') +
      (blot.counts.mask ? '墨迹测试里你看见了面具，这不是巧合。' : ''),
      null);

    push('shadow', (S.ang.hits ? 30 : 0) + (S.esc.v > 30 ? 20 : 0) + (assoc.flagged.length ? 10 : 0),
      '被压进地下室的愤怒',
      '你的叙述里愤怒的浓度和你句子的克制程度不成比例。你把"我不允许自己生气"执行得太彻底，于是它改道了——变成失眠、变成反复的念头、变成梦里那只追你的东西。' +
      (q.rec ? '你反复想起的那句「' + q.rec + '」，就是它敲门的方式。' : ''),
      null);

    push('grief', (S.los.v > 30 ? 40 : 0) + ((c.dream || '').match(/死|去世|走|棺|葬|告别/) ? 20 : 0),
      '一场没有办完的告别',
      '有一件事你还没有允许自己哀悼。你可能觉得"已经过去了"，但哀悼不是时间问题，是工序问题——跳过的那一步会一直在原地等你。' +
      (q.dream ? '你的梦里写着「' + q.dream + '」。梦不处理事件，梦处理没说完的话。' : ''),
      null);

    push('dissoc', (S.dis.v > 30 ? 40 : 0) + (c.paralysis ? 20 : 0) + (c.dreamFreq === '每夜' ? 15 : 0),
      '把“我”切成两半来减震',
      '当冲击超过承受上限时，心智会做的第一件事不是解决，而是"让承受的人不是我"。你描述的陌生感、断片感、镜子里的错位感，都是这个减震器在工作。它保护过你，但它现在不肯关了。',
      null);

    push('repeat', (c.recurring && c.recurring.length > 3 ? 30 : 0) + ((c.dream || '').length > 10 ? 15 : 0),
      '同一幕戏的第 n 次重演',
      '你在重复一个没有被理解的场景。重复不是记忆太好，而是理解没到位——心智会一直重放，直到有人（通常是你自己）看懂那一帧到底发生了什么。',
      null);

    push('judge', (S.gui.v > 30 ? 40 : 0),
      '你替别人继续审判自己',
      '最初指责你的那个声音已经不在场了，但你把它录了下来，并且每天自己播放。你现在的痛苦里，有一半是替一个早已离场的人执行的刑罚。',
      null);

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
    var blot = inkblotProfile(c);
    var assoc = assocProfile(c);
    var birth = birthReading(c);
    var H = hypotheses(c, sp, blot, assoc);
    var tarotRows = (c.tarot || []).map(function (t) {
      var card = RC.tarot.byId(t.id);
      var pos = RC.tarot.positions[t.pos];
      return {
        id: t.id, upright: t.upright, pos: pos, card: card,
        meaning: t.upright ? card.up : card.rv
      };
    });
    var code = 'RC-' + new Date().getFullYear() + '-' + U.pad(U.hash(JSON.stringify(c.story || '')).toString(36).slice(0, 4).toUpperCase(), 4);
    var stamp = H.length && H[0].score >= 60 ? '假说成立' : (H.length ? '需观察' : '资料不足');
    return {
      code: code, stamp: stamp,
      spectrum: sp, inkblot: blot, assoc: assoc, birth: birth,
      hypotheses: H, tarot: tarotRows,
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
    spectrum: spectrum, inkblotProfile: inkblotProfile, assocProfile: assocProfile,
    birthReading: birthReading, hypotheses: hypotheses, buildVerdict: buildVerdict, coldReads: coldReads
  };
})();
