/* ============================================================
   demo.js — 示例模式（一次点击走完整条流程）
   给第一次来、还没带故事的人用：塞一份写好的示例委托/塔罗/会诊/联想/SCT，
   直接就能看到鉴定书长什么样。载入前会先把本机档案备份，清除时原样还原。
   页面上会挂一个 DEMO 角标，随时可以一键清掉。
   ============================================================ */
(function () {
  var FLAG = 'demoMode';
  var BACKUP = 'demoBackup';

  var CASE = {
    handle: '示例客人', age: '29', gender: '不便说', birth: '1997-03-14',
    category: '梦与重复',
    story: '这两周一直在做同一个梦：我站在一部电梯里，数字一直往上走，过了 17 层还在走。我想按停止，但按钮是软的，手指陷进去。醒来的时候手臂是麻的。白天倒没什么大事，就是开会时忽然会觉得那部电梯还在上升，然后听不见别人说话。',
    dream: '电梯一直往上，过了 17 层还在走。按钮是软的，按不下去。',
    dreamFreq: '一周三四次',
    recurring: '「再往上就没有楼层了。」——这句是我自己梦里说的。',
    paralysis: true,
    tarotSpread: 'pentagram',
    tarotQuestion: 'self',
    tarot: [
      { id: 16, pos: 0, upright: false },
      { id: 18, pos: 1, upright: true },
      { id: 9,  pos: 2, upright: false },
      { id: 12, pos: 3, upright: true },
      { id: 17, pos: 4, upright: true }
    ]
  };

  var ANALYST = [
    { m: 'freud', dream: '电梯一直往上，按钮是软的，按不下去。', motifs: ['fall', 'house'],
      verdict: { cn: '想停却停不下来：这不是失控的梦，是「被允许的失控」。', jp: '止めたいのに止まらない。これは失控の夢ではなく、許された失控。' }, ts: Date.now() - 86400000 },
    { m: 'jung', dream: '数字过了 17 还在增加，楼里没有别人。', motifs: ['house', 'mirror'],
      verdict: { cn: '你正在上到一个还没有名字的楼层。上楼本身是超越功能，不必急着命名。', jp: 'まだ名のない階へ上っている。上ること自体が超越機能。名付けるのは急がずに。' }, ts: Date.now() - 82800000 },
    { m: 'cartwright', dream: '醒来手臂是麻的，白天开会时忽然又听见电梯在上升。', motifs: ['fall'],
      verdict: { cn: '这是情绪排练没做完。白天的走神，是夜里那一段还没归档。', jp: '感情のリハーサルが未完了。昼の離脱は、夜の分がまだ片付いていない証拠。' }, ts: Date.now() - 79200000 }
  ];

  var ASSOC = [
    { stim: { cn: '镜', jp: '鏡' }, resp: '电梯门。关上以后我还在里面。', ms: 1820 },
    { stim: { cn: '夜', jp: '夜' }, resp: '最亮的时候。', ms: 940 },
    { stim: { cn: '钥匙', jp: '鍵' }, resp: '……找不到。', ms: 4310, interrupted: false },
    { stim: { cn: '17', jp: '17' }, resp: '应该停的地方。', ms: 1260 },
    { stim: { cn: '面具', jp: '仮面' }, resp: '开会那张。', ms: 2050 },
    { stim: { cn: '醒', jp: '覚' }, resp: '没完全醒。', ms: 1580 }
  ];

  var SCT = [
    { i: 0, qCn: '今天如果不去想 _______，我大概会 _______。', qJp: 'もし今日 _______ を考えなければ、おそらく _______。', a: '不去想电梯，我大概能睡着。' },
    { i: 1, qCn: '已经 _______ 这件事 _______ 了我很久。', qJp: 'もうずっと _______ ことが、私を _______ させている。', a: '已经「再往上就没有楼层了」这件事，困扰了我很久。' },
    { i: 2, qCn: '我反复做的那个梦，结尾总是 _______。', qJp: '何度も見る夢の最後には、いつも _______。', a: '停在数字还在跳的那一下。' },
    { i: 3, qCn: '没人知道的是，我 _______。', qJp: '誰も知らないのは、私が _______。', a: '其实不太想让它停下来。' }
  ];

  var DREAMS = [
    { date: new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10), title: '电梯第一次出现',
      body: '只有一台电梯，数字一直往上。我当时没在意，以为是自己累了。', mood: '迷路', tag: '电梯' },
    { date: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10), title: '按钮是软的',
      body: '这次我想按停止，但按钮陷进去了。过了 17 层还在往上。醒来手臂是麻的。', mood: '睡不着', tag: '电梯／按钮' },
    { date: new Date().toISOString().slice(0, 10), title: '白天也听得见',
      body: '开会的时候忽然听见电梯在上升，然后就听不见别人说话了。那几秒钟很长。', mood: '疲惫', tag: '电梯／白天' }
  ];

  function active() { return RC.store.get(FLAG, 0) === 1; }

  function fill() {
    if (active()) return true;
    var backup = { case: RC.store.get('case', null), verdict: RC.store.get('verdict', null), dreamLog: RC.store.get('dreamLog', null) };
    RC.store.set(BACKUP, backup);
    var c = RC.model.normalize(CASE);
    c.caseId = RC.model.id();
    c.createdAt = c.updatedAt = Date.now();
    c.analystLog = ANALYST.map(function (x) { return x; });
    c.assoc = ASSOC.map(function (x) { return x; });
    c.sct = SCT.map(function (x) { return x; });
    c = RC.model.normalize(c);
    RC.store.set('case', c);
    RC.store.set('dreamLog', DREAMS.map(function (d) { return { id: 'demo-' + d.date, demo: true, date: d.date, title: d.title, body: d.body, mood: d.mood, tag: d.tag, ts: Date.parse(d.date) || Date.now() }; }));
    RC.store.set(FLAG, 1);
    badge();
    return true;
  }

  function clear() {
    var b = RC.store.get(BACKUP, null);
    if (b && typeof b === 'object') {
      if (b.case) RC.store.set('case', b.case); else RC.store.del('case');
      if (b.verdict) RC.store.set('verdict', b.verdict); else RC.store.del('verdict');
      if (b.dreamLog) RC.store.set('dreamLog', b.dreamLog); else RC.store.del('dreamLog');
    } else {
      RC.store.del('case'); RC.store.del('verdict'); RC.store.del('dreamLog');
    }
    RC.store.del(BACKUP);
    RC.store.set(FLAG, 0);
    var el = document.getElementById('demoBadge');
    if (el && el.parentNode) el.parentNode.removeChild(el);
    document.body.classList.remove('has-demo-badge');
    return true;
  }

  function badge() {
    if (document.getElementById('demoBadge')) return;
    var b = document.createElement('div');
    b.className = 'demo-badge';
    b.id = 'demoBadge';
    b.innerHTML = '<span>' + RC.util.esc(RC.i18n.t('demoBadge')) + '</span>' +
      '<button type="button">' + RC.util.esc(RC.i18n.t('demoClearBtn')) + '</button>';
    b.querySelector('button').addEventListener('click', function () {
      clear();
      location.reload();
    });
    document.body.appendChild(b);
    document.body.classList.add('has-demo-badge');
  }

  /* 首页/人物页的按钮：#demoLoad / #demoClear */
  function wire() {
    var load = document.getElementById('demoLoad');
    var clr = document.getElementById('demoClear');
    var msg = document.getElementById('demoMsg');
    if (load) load.addEventListener('click', function () {
      fill();
      if (msg) msg.textContent = RC.i18n.t('demoDone');
      if (clr) clr.classList.remove('hidden');
    });
    if (clr) clr.addEventListener('click', function () {
      clear();
      if (msg) msg.textContent = RC.i18n.t('demoCleared');
      clr.classList.add('hidden');
    });
    if (active()) { if (clr) clr.classList.remove('hidden'); }
  }

  window.RC = window.RC || {};
  RC.demo = { active: active, fill: fill, clear: clear, SAMPLE: CASE };

  function init() { if (active()) badge(); wire(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
