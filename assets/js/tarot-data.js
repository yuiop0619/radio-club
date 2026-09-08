/* ============================================================
   tarot-data.js — 大阿尔卡纳 22 张（正位／逆位）+ 封印符号
   每张牌背面按 id 选用不同封印，给每张牌补一行「短牌义」
   ============================================================ */
(function () {
  /* 22 张大阿尔卡纳，带 short（中/日短牌义 + 元素倾向） */
  var A = [
    { n: 0,  r: '0',    jp: '愚者',           cn: '愚者',     g: '✦',  seal: '✦', element: '风',
      shortCn: '新的可能',     shortJp: '新しい可能性',
      up: '新的开始，尚未被规则驯服的可能性。你正站在悬崖边，却只看着天。',
      rv: '鲁莽、逃避现实、不肯为自己的选择负责。' },
    { n: 1,  r: 'I',    jp: '魔術師',         cn: '魔术师',   g: '∞',  seal: '∞', element: '水星',
      shortCn: '手中齐备',     shortJp: '手に揃う道具',
      up: '你手里其实有全部的工具。缺的只是把注意力集中到一件事上。',
      rv: '才能被浪费在操纵与自我欺骗上。' },
    { n: 2,  r: 'II',   jp: '女教皇',         cn: '女教皇',   g: '☽',  seal: '☽', element: '月亮',
      shortCn: '沉默知情',     shortJp: '沈黙の知',
      up: '答案不在外面。你早已知道，只是不肯承认那个安静的声音。',
      rv: '压抑直觉、信息被隐藏、拒绝面对内心。' },
    { n: 3,  r: 'III',  jp: '女帝',           cn: '女帝',     g: '♀',  seal: '♀', element: '金星',
      shortCn: '滋养生成',     shortJp: '滋養と生成',
      up: '滋养与创造。允许自己被照顾，也允许事物慢慢生长。',
      rv: '过度付出后的枯竭、占有欲、创造受阻。' },
    { n: 4,  r: 'IV',   jp: '皇帝',           cn: '皇帝',     g: '♂',  seal: '♂', element: '白羊',
      shortCn: '秩序边界',     shortJp: '秩序と境界',
      up: '需要结构与边界。把混乱的局面交给规则去管。',
      rv: '控制欲、僵化、来自权威或父性的压迫。' },
    { n: 5,  r: 'V',    jp: '教皇',           cn: '教皇',     g: '✠',  seal: '✠', element: '金牛',
      shortCn: '沿旧路行',     shortJp: '古い道をゆく',
      up: '遵循已被验证的道路，或向一个前辈寻求指引。',
      rv: '被教条束缚、盲从、或反过来对规则的叛逆。' },
    { n: 6,  r: 'VI',   jp: '恋人',           cn: '恋人',     g: '♥',  seal: '♥', element: '双子',
      shortCn: '一个选择',     shortJp: '一つの選択',
      up: '一个重要的选择，或一段需要坦诚的关系。心与心的对齐。',
      rv: '关系失衡、价值观冲突、逃避选择。' },
    { n: 7,  r: 'VII',  jp: '戦車',           cn: '战车',     g: '♞',  seal: '♞', element: '巨蟹',
      shortCn: '驾驭冲突',     shortJp: '矛盾を御す',
      up: '把矛盾的两股力量套上同一辆车。胜利来自掌控而非蛮力。',
      rv: '失控、方向分散、被情绪拖着走。' },
    { n: 8,  r: 'VIII', jp: '力',             cn: '力量',     g: '♌',  seal: '♌', element: '狮子',
      shortCn: '柔能克刚',     shortJp: '柔よく剛を制す',
      up: '以温柔驯服内心的兽。真正的力量是不必证明的力量。',
      rv: '自我怀疑、意志薄弱、或用蛮力压制情绪。' },
    { n: 9,  r: 'IX',   jp: '隠者',           cn: '隐者',     g: '✶',  seal: '✶', element: '处女',
      shortCn: '独自提灯',     shortJp: '一人で提灯',
      up: '退后一步，独自提灯照路。此刻的孤独是必要的。',
      rv: '过度封闭、拒绝帮助、或在人群中迷失自我。' },
    { n: 10, r: 'X',    jp: '運命の輪',       cn: '命运之轮', g: '☸',  seal: '☸', element: '木星',
      shortCn: '局面转动',     shortJp: '局面が回る',
      up: '局面开始转动。顺势而为，抓住上升的那一段弧。',
      rv: '抗拒改变、被外力摆布、循环往复的困境。' },
    { n: 11, r: 'XI',   jp: '正義',           cn: '正义',     g: '⚖',  seal: '⚖', element: '天秤',
      shortCn: '因果必报',     shortJp: '因果応報',
      up: '因果清楚。做你认为公正的事，并承担其结果。',
      rv: '失衡、自我审判过苛、或不愿面对真相。' },
    { n: 12, r: 'XII',  jp: '吊るされた男',   cn: '倒吊人',   g: '⚓',  seal: '⚓', element: '海王',
      shortCn: '换角度',       shortJp: '視点を換える',
      up: '换一个角度看，困局自解。暂时的停滞是必要的牺牲。',
      rv: '无谓的牺牲、拖延、不肯放手。' },
    { n: 13, r: 'XIII', jp: '死',             cn: '死神',     g: '☠',  seal: '☠', element: '天蝎',
      shortCn: '结束，开始',   shortJp: '終わり、そして始まり',
      up: '某件事必须结束，好让另一件事开始。不是肉体的死。',
      rv: '抗拒必要的结束、僵持、腐烂中的维持。' },
    { n: 14, r: 'XIV',  jp: '節制',           cn: '节制',     g: '☯',  seal: '☯', element: '射手',
      shortCn: '两杯互倾',     shortJp: '二杯を注ぎ合う',
      up: '把对立的两杯互相倾倒，直到调出合适的比例。',
      rv: '过度、失衡、缺乏耐心、消耗。' },
    { n: 15, r: 'XV',   jp: '悪魔',           cn: '恶魔',     g: '♑',  seal: '♑', element: '摩羯',
      shortCn: '锁链是松的',   shortJp: '鎖は緩い',
      up: '看清锁链其实是松的。你随时可以取下，但你没有。',
      rv: '开始挣脱依附、戒断、或沉溺到极点后反弹。' },
    { n: 16, r: 'XVI',  jp: '塔',             cn: '高塔',     g: '⚡',  seal: '⚡', element: '火星',
      shortCn: '真相一击',     shortJp: '真実の一撃',
      up: '建立在假象上的结构将被击落。痛苦但必要的一次真相。',
      rv: '灾难被延缓、侥幸、或拒绝承认崩塌已开始。' },
    { n: 17, r: 'XVII', jp: '星',             cn: '星星',     g: '★',  seal: '★', element: '水瓶',
      shortCn: '雨后第一颗',   shortJp: '雨上がりの星',
      up: '雨后的第一颗星。保持希望，它是指向而非终点。',
      rv: '希望动摇、自我怀疑、与指引失联。' },
    { n: 18, r: 'XVIII',jp: '月',             cn: '月亮',     g: '☾',  seal: '◐', element: '双鱼',
      shortCn: '雾中有路',     shortJp: '霧の中の道',
      up: '雾中有路但看不清。相信本能，别信幻影。',
      rv: '恐惧消散、迷雾渐清、或自欺被揭穿。' },
    { n: 19, r: 'XIX',  jp: '太陽',           cn: '太阳',     g: '☀',  seal: '☀', element: '太阳',
      shortCn: '事情亮了',     shortJp: 'ことが明るむ',
      up: '事情将清楚而明亮地展开。允许自己单纯地高兴。',
      rv: '成功被推迟、过度乐观、或快乐被压抑。' },
    { n: 20, r: 'XX',   jp: '審判',           cn: '审判',     g: '♆',  seal: '♆', element: '冥王',
      shortCn: '旧账清算',     shortJp: '旧きを清算',
      up: '旧账被翻起，是为了清算后重启。回应那个召唤。',
      rv: '逃避清算、自我否定、听不见召唤。' },
    { n: 21, r: 'XXI',  jp: '世界',           cn: '世界',     g: '◯',  seal: '◯', element: '土星',
      shortCn: '一次完成',     shortJp: '一周は閉じる',
      up: '一个循环圆满闭合。你成为了你想成为的样子。',
      rv: '差一点的完成、未竟之事、或害怕收尾。' }
  ];

  /* 22 个程序化"封印"（每张大阿卡纳一个独立符号） */
  var SEALS = ['✦','∞','☽','♀','♂','✠','♥','♞','♌','✶','☸','⚖','⚓','☠','☯','♑','⚡','★','◐','☀','♆','◯'];

  /* 三种牌阵模板：
     - dailyCard: 1 张「每日一牌」（按当日日期种子，保证同一天结果稳定）
     - timeLine : 3 张「时间线」（过去／现在／未来）
     - pentagram: 5 张「五张解读」（过去／现在／隐藏动机／障碍／结论，默认）
  */
  var POS = [
    { jp: '過去',       cn: '过去' },
    { jp: '現在',       cn: '现在' },
    { jp: '隠れた動機', cn: '隐藏动机' },
    { jp: '障害',       cn: '障碍' },
    { jp: '結論',       cn: '结论' }
  ];
  var POS_DAILY = [{ jp: '今日の一枚', cn: '今日一牌' }];
  var POS_TL    = [
    { jp: '過去', cn: '过去' },
    { jp: '現在', cn: '现在' },
    { jp: '未来', cn: '未来' }
  ];

  /* 各牌阵的位置标签，便于统一迭代 */
  var SPREADS = {
    pentagram: { labelCn: '五张解读',  labelJp: '五枚解読',  pos: POS,        pick: 5, seededDaily: false },
    timeLine:  { labelCn: '时间线',    labelJp: 'タイムライン', pos: POS_TL,     pick: 3, seededDaily: false },
    dailyCard: { labelCn: '每日一牌',  labelJp: '今日の一枚', pos: POS_DAILY,  pick: 1, seededDaily: true }
  };

  /* ---------- 基于种子洗牌：不重复取 N 张（洗过的牌再放回去时不参与本次抽取） ---------- */
  function drawN(pick, seed) {
    var r = seed != null ? RC.util.rng(seed) : Math.random;
    var bag = A.map(function (c) { return c.n; });
    var out = [];
    var need = Math.min(pick, bag.length);
    for (var i = 0; i < need; i++) {
      var idx = Math.floor(r() * bag.length);
      var id = bag.splice(idx, 1)[0];
      out.push({ id: id, upright: r() < 0.5, pos: i });
    }
    return out;
  }
  function seedFor(spreadKey) {
    if (spreadKey === 'dailyCard') {
      var d = new Date();
      var s = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
      return s;
    }
    return null;
  }

  window.RC = window.RC || {};
  RC.tarot = {
    arcana: A, seals: SEALS, pos: POS,
    positions: POS,                /* legacy alias */
    positionsDaily: POS_DAILY,
    positionsTimeline: POS_TL,
    spreads: SPREADS,
    byId: function (n) { return A[n]; },
    sealOf: function (id) { return SEALS[id % SEALS.length]; },
    draw: function (seed) { return drawN(SPREADS.pentagram.pick, seed); },  /* legacy: always 5 */
    drawFor: function (spreadKey, seedOverride) {
      var sp = SPREADS[spreadKey] || SPREADS.pentagram;
      var seed = seedOverride != null ? seedOverride : seedFor(spreadKey);
      return drawN(sp.pick, seed);
    },
    isShortAvailable: true
  };
})();
