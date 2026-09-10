/* ============================================================
   treehole.js — 树洞（旧「常客留言板」改造）
   1. 匿名身份：进站自动生成稳定代号，署名可选
   2. 投递：纸条卷起落进洞口的动画
   3. 回信：本地回声池（陌生人）＋ 店主/萨弗兰角色回信，保证不落空
   4. 云端：CloudBase 双轨，本地先写先显，后台静默同步，失败自动降级
   5. 安全：统一转义、140 字上限、冷却、可收回、可举报
   ============================================================ */
(function () {
  var U = RC.util, I = RC.i18n;
  var KEY = 'bbs_v2';          /* 与旧 rc_bbs 区分，旧数据做迁移 */
  var ID_KEY = 'hole_id';
  var MAX = 140;
  var COOL = 3000;             /* 3 秒冷却 */
  var BURST = 5;               /* 连发上限 */

  /* ---------------- 身份 ---------------- */
  function myId() {
    var id = RC.store.get(ID_KEY, null);
    if (!id) {
      id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
      RC.store.set(ID_KEY, id);
    }
    return id;
  }
  function myCode() {
    var h = U.hash(myId());
    var CN = ['夜鸟', '纸鹤', '雨燕', '鸽子', '乌鸦', '麻雀', '萤火', '飞蛾', '白鹭', '燕子', '猫头鹰', '蜻蜓'];
    var JP = ['夜鳥', '折鶴', 'アマツバメ', '鳩', '烏', '雀', '蛍', '蛾', '白鷺', '燕', '梟', 'トンボ'];
    var i = h % CN.length;
    var n = ((h >>> 7) % 800) + 100;
    return { cn: '第 ' + n + ' 只' + CN[i], jp: '第 ' + n + ' 羽の' + JP[i] };
  }
  var ME = myCode();

  /* ---------------- 心情 ---------------- */
  var MOODS = [
    { k: 'tired', key: 'mTired' }, { k: 'angry', key: 'mAngry' },
    { k: 'miss', key: 'mMiss' }, { k: 'awake', key: 'mAwake' },
    { k: 'lost', key: 'mLost' }, { k: 'calm', key: 'mCalm' }
  ];

  /* ---------------- 种子数据 ---------------- */
  function seedNotes() {
    var H = 3600000;
    var now = Date.now();
    function N(id, code, sig, who, body, mood, ts, lights, replies) {
      return {
        id: id, code: code, sig: sig, who: who, body: body, mood: mood,
        ts: ts, lights: lights || 0, lit: false, mine: false, replies: replies || [], seed: true
      };
    }
    return [
      N('s1', { cn: '雾岛岩夫', jp: '霧島岩夫' }, '', 'master',
        { cn: '今夜也照常营业。夜里冷，点热牛奶的客人我都多加点蜂蜜。', jp: '今夜も営業中。寒い夜だから、ホットミルクを注文する子には蜂蜜を多めにしているぞ。' },
        'calm', now - 5 * H, 12, []),
      N('s2', { cn: '濑田涟', jp: '瀬田涟' }, '', 'bartender',
        { cn: '……嗯。（新来的客人，牌不用怕抽错。）', jp: '……ん。（初めての客も、カードは引いても大丈夫。）' },
        'calm', now - 4 * H, 7, []),
      N('s3', { cn: '常客・阿隆', jp: '常連・タカ' }, '', 'guest',
        { cn: '上周在这里被听完之后，我终于跟上司把话说出口了。谢谢。', jp: '先週ここで話を聞いてもらって、やっと上司に言えました。ありがとう。' },
        'calm', now - 26 * H, 31, [
          { code: { cn: '雾岛岩夫', jp: '霧島岩夫' }, who: 'master', body: { cn: '该说的时候能说出来，这杯我请。', jp: '言うべき時に言えた。この一杯はおごりだ。' }, ts: now - 25 * H }
        ]),
      N('s4', { cn: '萨弗兰', jp: 'サフラン' }, '', 'safran',
        { cn: '鉴定书我放在吧台上了，记得来取。看完之后，把反驳也一起带过来。', jp: '鑑定書はカウンターに置いておきます。受け取りに来てください。読んだら、反論も持って来てください。' },
        'calm', now - 2 * H, 19, []),
      N('s5', { cn: '常客・小绿', jp: '常連・ミドリ' }, '', 'guest',
        { cn: '这里的高球，气泡真的细。岩夫的手艺没退步。', jp: 'ここのハイボール、ほんとに泡が細かい。岩夫さんの腕は落ちてない。' },
        'calm', now - 50 * H, 5, [])
    ];
  }

  /* ---------------- 存储与迁移 ---------------- */
  function load() {
    var d = RC.store.get(KEY, null);
    if (!d || !Array.isArray(d.notes)) {
      d = { v: 2, notes: seedNotes().concat(migrateOld()) };
      RC.store.set(KEY, d);
    }
    return d;
  }
  function save(d) { return RC.store.set(KEY, d); }
  function migrateOld() {
    var old = RC.store.get('bbs', null);
    if (!old || !old.length) return [];
    var seeds = seedNotes();
    var known = {};
    for (var s = 0; s < seeds.length; s++) known[seeds[s].body.cn] = 1;
    var out = [];
    for (var i = 0; i < old.length; i++) {
      var o = old[i];
      if (!o) continue;
      var b = (o.body && typeof o.body === 'object') ? o.body.cn : o.body;
      if (!b || known[b]) continue;
      var nm = (o.name && typeof o.name === 'object') ? o.name : { cn: o.name || '', jp: o.name || '' };
      out.push({
        id: 'm' + i, code: nm, sig: '', who: 'guest',
        body: { cn: b, jp: (o.body && o.body.jp) ? o.body.jp : b },
        mood: 'calm', ts: Date.now() - (old.length - i) * 60000,
        lights: 0, lit: false, mine: true, replies: []
      });
    }
    return out;
  }
  function findNote(d, id) {
    for (var i = 0; i < d.notes.length; i++) if (d.notes[i].id === id) return d.notes[i];
    return null;
  }

  /* ---------------- 相对时间 ---------------- */
  function rel(ts) {
    var d = Date.now() - ts;
    if (d < 60000) return { cn: '刚刚', jp: 'たった今' };
    if (d < 3600000) { var m = Math.floor(d / 60000); return { cn: m + ' 分钟前', jp: m + '分前' }; }
    if (d < 86400000) { var h = Math.floor(d / 3600000); return { cn: h + ' 小时前', jp: h + '時間前' }; }
    var dt = new Date(ts);
    var hh = U.pad(dt.getHours(), 2) + ':' + U.pad(dt.getMinutes(), 2);
    if (d < 172800000) return { cn: '昨夜 ' + hh, jp: '昨夜 ' + hh };
    if (d < 604800000) { var dd = Math.floor(d / 86400000); return { cn: dd + ' 天前', jp: dd + '日前' }; }
    return { cn: (dt.getMonth() + 1) + '月' + dt.getDate() + '日', jp: (dt.getMonth() + 1) + '月' + dt.getDate() + '日' };
  }

  /* ---------------- 回信：陌生人的回声池 ---------------- */
  var ECHO = [
    { re: /上班|工作|上司|领导|加班|辞职|同事|职场|老板|实习|绩效/,
      cn: ['那个会我也开过。散会之后我在楼梯间站了十分钟。', '你把「算了」说了太多次了。这次别算。', '不是你不够好，是那个位置本来就不适合坐。'],
      jp: ['その会議、私も出た。終わってから階段に十分立っていた。', '「まあいいや」を言いすぎた。今回は言うな。', 'あなたが悪いんじゃない。その席が合っていないだけ。'] },
    { re: /考|学|毕|论文|成绩|考研|分数|专业|读书/,
      cn: ['考不上也不会死。我是说真的，不会死。', '你已经比去年这个时候懂得多了，只是不觉得。', '那张纸决定不了你是什么人。'],
      jp: ['受からなくても死なない。本当に、死なない。', '去年の今より、あなたはもう知っている。自覚がないだけ。', 'あの紙は、あなたが何者かを決めない。'] },
    { re: /分手|前任|喜欢|暗恋|他|她|告白|在一起|异地/,
      cn: ['你不是放不下他，你是放不下那时候的自己。', '喜欢一个人不该这么累。累的那部分不是喜欢。', '会有人不让你猜。'],
      jp: ['手放せないのは相手じゃない。あの頃の自分だ。', '好きでこんなに疲れるはずがない。疲れている分は好きじゃない。', '猜らせない人が、いつか来る。'] },
    { re: /睡|梦|醒|噩梦|失眠|夜里|凌晨/,
      cn: ['梦里追你的那个东西，白天是有名字的。想出来是什么。', '睡不着的时候别躺着硬撑，起来喝口水，看看窗外。', '梦不处理事件，梦处理没说完的话。'],
      jp: ['夢で追ってくるものには、昼間に名前がある。思い出して。', '眠れないときは無理に横になるな。起きて水を飲んで、窓の外を見ろ。', '夢は事件を扱わない。言えなかった言葉を扱う。'] },
    { re: /妈|爸|父母|家|爷爷|奶奶|外婆|外公/,
      cn: ['你替他们活了很久了。可以还一点给自己。', '家人说的话最伤人，因为那是我们唯一没设防的地方。', '你可以爱他们，同时不认同他们。'],
      jp: ['ずいぶん長く、彼らの分まで生きた。少し自分に返していい。', '家族の言葉が一番痛い。そこだけ無防備だから。', '愛することと、同意することは別だ。'] },
    { re: /死|走了|告别|葬|离开|再也|想他|想她/,
      cn: ['哀悼不是时间问题，是工序问题。跳过的那一步会一直在原地等你。', '你可以想他。想，不代表没往前走。', '没说出口的那句，现在说也来得及。'],
      jp: ['喪は時間の問題じゃない。工程の問題だ。飛ばした一歩はずっとそこで待っている。', '思っていい。思うことは、立ち止まることじゃない。', '言えなかった一言は、今からでも間に合う。'] },
    { re: /累|疲惫|撑|坚持|扛|不想动|没力气/,
      cn: ['你已经撑了很久了。休息不是奖励，是续命。', '不用每天都赢。今天只要还在，就算过了。', '把「必须」从身上卸下来一个试试。'],
      jp: ['よくここまで耐えた。休息はご褒美じゃない。延命だ。', '毎日勝たなくていい。今日ここにいれば、それで合格。', '「ねばならない」を一つ、降ろしてみろ。'] }
  ];
  var ECHO_GENERIC = {
    cn: [
      '看到了。虽然不知道该怎么帮你，但这句话我接住了。',
      '你愿意写下来，就比昨天好一点。',
      '我也是半夜三点醒着的人，所以我知道这三个字有多难：说出口。',
      '不用解释。这里没人要你解释。',
      '这句话放在这里很安全，我会替你看着。',
      '明天可能还是这样，但今晚你不是一个人。',
      '写出来了就好。写出来的东西就不在肚子里咬你了。',
      '抱一下。不用回。'
    ],
    jp: [
      '見た。どう助ければいいか分からないけど、この言葉は受け取った。',
      '書けたなら、昨日より一歩進んでいる。',
      '私も午前三時に起きている人間だ。だから知っている。口に出すのがどれだけ難しいか。',
      '説明しなくていい。ここには説明を求める人いない。',
      'ここに置いておけば安全だ。私が見張っている。',
      '明日も同じかもしれない。でも今夜、あなたは一人じゃない。',
      '書けただけでいい。書いたものは、もう中で噛まない。',
      'ぎゅっと。返信はいらない。'
    ]
  };

  function pickEcho(note) {
    var text = String((note.body && note.body.cn) || note.body || '');
    var r = U.rng(U.hash(note.id));
    for (var i = 0; i < ECHO.length; i++) {
      if (ECHO[i].re.test(text)) {
        var lang = I.lang() === 'jp' ? 'jp' : 'cn';
        var arr = ECHO[i][lang] || ECHO[i].cn;
        return { cn: ECHO[i].cn[Math.floor(r() * ECHO[i].cn.length)] || ECHO[i].cn[0],
                 jp: ECHO[i].jp[Math.floor(r() * ECHO[i].jp.length)] || ECHO[i].jp[0] };
      }
    }
    var g = ['cn', 'jp'], out = {};
    for (var k = 0; k < g.length; k++) {
      var pool = ECHO_GENERIC[g[k]];
      out[g[k]] = pool[Math.floor(r() * pool.length)];
    }
    return out;
  }

  /* ---------------- 回信：店主与萨弗兰 ---------------- */
  var SAFRAN = [
    { re: /梦|睡|醒|记不清|忘了|模糊/,
      cn: ['梦会绕，但不会骗。你记不清的那一段，往往是你最不想看清的那一段。',
           '你描述的时候跳过了三秒。那三秒在哪儿？',
           '重复出现的画面不是预兆，是还没被理解的一帧。'],
      jp: ['夢は回り道をするが、嘘はつかない。思い出せない部分こそ、見たくない部分だ。',
           'さっき三秒飛ばした。あの三秒はどこだ。',
           '繰り返す映像は予兆じゃない。まだ理解されていない一コマだ。'] },
    { re: /怕|恐惧|不敢|慌|紧张/,
      cn: ['怕的不是那件事，是「再一次」。你说的是现在，身体记的是上次。',
           '恐惧是有形状的。你把它画出来，它就小一半。'],
      jp: ['怖いのは出来事じゃない。「もう一度」だ。口では今を言っているが、体は前回を覚えている。',
           '恐怖には形がある。描けば半分になる。'] },
    { re: /我是不是|正常|奇怪|有病|矫情/,
      cn: ['「正常」是最没用的词。我只关心一件事：它有没有在妨碍你活着。',
           '会问自己是不是太矫情的人，通常刚好相反。'],
      jp: ['「普通」は一番役に立たない言葉。私が知りたいのは一つだけ。それは生きる邪魔をしているか。',
           '自分が大げさかと聞く人に限って、たいてい逆だ。'] }
  ];
  var MASTER = [
    { re: /累|疲惫|喝|酒|睡|不想动|没力气/,
      cn: ['先坐着。话可以等一会儿再说，热牛奶不行，凉了就不好喝了。',
           '你这样子，我给你调一杯没酒精的。喝完再决定要不要讲。'],
      jp: ['まず座れ。話は後でいい。ホットミルクは待ってくれない。冷めたらまずい。',
           'その顔なら、ノンアルコールを作る。飲んでから話すか決めろ。'] },
    { re: /谢|谢谢|感谢/,
      cn: ['不用谢我。你肯走进来，这店就还开得下去。'],
      jp: ['礼はいらない。来てくれるなら、この店はまだ続く。'] },
    { re: /一个人|孤独|没人|朋友/,
      cn: ['这里十二个座位，你随便坐。空着的那几个，是留给还没来的人的。',
           '没人陪的时候，就当来陪我。我也一个人守店。'],
      jp: ['ここは十二席ある。好きに座れ。空いている席は、まだ来ない人の分だ。',
           '誰もいないなら、私に会いに来たと思えばいい。私も一人で店を守っている。'] }
  ];
  var SAFRAN_DEF = {
    cn: ['写下来了，就说明它已经在你外面了。剩下的我们一起看。',
         '我不安慰人。我只负责把线头找出来——你看，这里有一根。'],
    jp: ['書けたということは、もう外に出たということ。残りは一緒に見る。',
         '慰めない。糸口を見つけるのが仕事だ。ほら、ここに一本。']
  };
  var MASTER_DEF = {
    cn: ['嗯。听到了。要不要再来一杯？', '慢慢来。这店不打烊在你开口之前。'],
    jp: ['ん。聞いた。もう一杯どうだ。', '急ぐな。この店は、あなたが口を開くまでは閉めない。']
  };

  function pickCharacter(note) {
    var text = String((note.body && note.body.cn) || note.body || '');
    var r = U.rng(U.hash(note.id) ^ 0x9e37);
    var sets = [SAFRAN, MASTER], defs = [SAFRAN_DEF, MASTER_DEF];
    for (var s = 0; s < sets.length; s++) {
      for (var i = 0; i < sets[s].length; i++) {
        if (sets[s][i].re.test(text)) {
          return {
            who: s === 0 ? 'safran' : 'master',
            body: { cn: sets[s][i].cn[Math.floor(r() * sets[s][i].cn.length)],
                    jp: sets[s][i].jp[Math.floor(r() * sets[s][i].jp.length)] }
          };
        }
      }
    }
    var s2 = r() < 0.5 ? 0 : 1;
    var d = defs[s2];
    return {
      who: s2 === 0 ? 'safran' : 'master',
      body: { cn: d.cn[Math.floor(r() * d.cn.length)], jp: d.jp[Math.floor(r() * d.jp.length)] }
    };
  }

  /* Public operations are explicit; imported/local notes never auto-upload. */
  var cloud=RC.cloud;
  function message(text){var el=document.getElementById('thMsg');if(el)el.textContent=text;}
  function error(e){message('操作未完成，已保留待重试记录：'+e.message+' / Retry when connected');}
  function fromCloudDoc(d){
    if(!d||typeof d.id!=='string'||!/^[-a-zA-Z0-9_]{1,80}$/.test(d.id))return null;
    return {id:d.id,code:{cn:RC.model.string(d.codeCn,60),jp:RC.model.string(d.codeJp,60)},sig:RC.model.string(d.sig,16),who:'guest',
      body:{cn:RC.model.string(d.bodyCn,140),jp:RC.model.string(d.bodyJp||d.bodyCn,140)},mood:RC.model.string(d.mood,20),
      ts:typeof d.ts==='number'?d.ts:Date.now(),lights:Number.isFinite(d.lights)?Math.max(0,d.lights):0,lit:d.lit===true,
      mine:d.mine===true,replies:Array.isArray(d.replies)?d.replies.slice(0,200).filter(function(r){return r&&typeof r==='object';}).map(function(r){return {id:RC.model.string(r.id,80),code:RC.model.pair(r.code,60),body:RC.model.pair(r.body,140),who:'user',ts:Number.isFinite(r.ts)?r.ts:Date.now()};}):[],
      cloud:true,status:d.status,version:Number.isFinite(d.version)?d.version:0};
  }
  function mergeCloud(list){
    if(!Array.isArray(list))return 0;
    var d=load(),changed=0,hidden=RC.store.get('hole_hidden',[]);
    if(!Array.isArray(hidden))hidden=[];
    list.forEach(function(raw){
      var n=fromCloudDoc(raw);if(!n||hidden.indexOf(n.id)>=0)return;
      var ex=findNote(d,n.id);
      if(n.status==='withdrawn'){
        if(ex){d.notes=d.notes.filter(function(x){return x.id!==n.id;});changed++;}
      }else if(n.status==='published' && n.body.cn){
        if(!ex){d.notes.push(n);changed++;}
        else if((ex.version||0)<=n.version && JSON.stringify(ex)!==JSON.stringify(n)){d.notes[d.notes.indexOf(ex)]=n;changed++;}
      }
    });
    if(changed&&!save(d))throw Error('LOCAL_SAVE_FAILED');
    return changed;
  }
  cloud.onResult=function(result,action){
    if(result.note)mergeCloud([result.note]);
    render();
    message(action==='report'?'举报已受理，编号 '+result.reportId+' / Report received': '操作已完成 / 完了しました');
  };
  function refresh(){return cloud.pull(load().notes.filter(function(n){return n.cloud;}).map(function(n){return n.id;})).then(function(list){if(mergeCloud(list))render();});}

  /* ---------------- 渲染 ---------------- */
  var host = null, filter = 'all';

  function moodName(k) {
    for (var i = 0; i < MOODS.length; i++) if (MOODS[i].k === k) return I.t(MOODS[i].key);
    return '';
  }
  function whoName(note) {
    if (note.sig) return U.esc(note.sig);
    if (note.code && note.code.cn) return RC.ui.bi(note.code.cn, note.code.jp || note.code.cn);
    return RC.ui.bi('匿名', '名無し');
  }
  function roleClass(note) {
    if (note.who === 'master') return 'r-master';
    if (note.who === 'safran') return 'r-safran';
    if (note.who === 'bartender') return 'r-bartender';
    return 'r-guest';
  }

  function render() {
    if (!host) return;
    var active=document.activeElement,focused=active&&active.classList.contains('ri')?active.closest('.note').dataset.id:null;
    var drafts={};host.querySelectorAll('.note').forEach(function(a){var inp=a.querySelector('.ri');if(inp)drafts[a.dataset.id]={value:inp.value,open:!a.querySelector('.n-box').hidden};});
    var d = load();
    var notes = d.notes.slice().sort(function (a, b) {
      return (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || b.ts - a.ts;
    });
    if (filter !== 'all') notes = notes.filter(function (n) { return n.mood === filter; });
    if (!notes.length) {
      host.innerHTML = '<div class="th-empty">' + U.esc(I.t('empty')) + '</div>';
      return;
    }
    var h = '';
    for (var i = 0; i < notes.length; i++) h += noteHTML(notes[i]);
    host.innerHTML = h;
    host.querySelectorAll('.note').forEach(function(a){var draft=drafts[a.dataset.id];if(draft){a.querySelector('.ri').value=draft.value;a.querySelector('.n-box').hidden=!draft.open;if(focused===a.dataset.id)a.querySelector('.ri').focus();}});
  }

  function noteHTML(n) {
    var t = rel(n.ts);
    var h = '<article class="note ' + roleClass(n) + (n.mine ? ' mine' : '') + '" data-id="' + U.esc(n.id) + '">';
    h += '<div class="n-top">';
    h += '<span class="n-name">' + whoName(n) + '</span>';
    if (n.mood) h += '<span class="n-mood m-' + U.esc(n.mood) + '">' + U.esc(moodName(n.mood)) + '</span>';
    h += '<span class="n-time">' + RC.ui.bi(t.cn, t.jp) + '</span>';
    if (n.mine) h += '<span class="n-flag">' + U.esc(I.t('myNote')) + '</span>';
    else if (n.cloud) h += '<span class="n-flag dim">' + U.esc(I.t('fromOther')) + '</span>';
    h += '</div>';
    h += '<div class="n-body">' + U.esc(I.of ? I.of(n.body) : n.body.cn) + '</div>';

    var reps = n.replies || [];
    if (reps.length) {
      h += '<div class="n-reps">';
      for (var i = 0; i < reps.length; i++) {
        var r = reps[i], rt = rel(r.ts || n.ts);
        h += '<div class="rep ' + (r.who && r.who !== 'user' ? 'by-' + U.esc(r.who) : '') + '">' +
          '<span class="r-name">' + U.esc(I.of && r.code ? I.of(r.code) : (r.code && r.code.cn) || '') + '</span>' +
          '<span class="r-time">' + RC.ui.bi(rt.cn, rt.jp) + '</span>' +
          '<div class="r-body">' + U.esc(I.of && r.body ? I.of(r.body) : (r.body && r.body.cn) || r.body || '') + '</div>' +
          '</div>';
      }
      h += '</div>';
    }

    h += '<div class="n-ops">';
    h += '<button type="button" class="op' + (n.lit ? ' on' : '') + '" data-act="light">' +
      (n.lit ? '✦ ' + U.esc(I.t('lit')) : '✧ ' + U.esc(I.t('light'))) +
      (n.lights ? ' <b>' + U.esc(n.lights) + '</b>' : '') + '</button>';
    h += '<button type="button" class="op" data-act="reply">' + U.esc(I.t('reply')) + '</button>';
    h += '<button type="button" class="op" data-act="share">' + U.esc(I.t('shareNote')) + '</button>';
    if (n.mine) h += '<button type="button" class="op danger" data-act="take">' + U.esc((n.cloud?'撤回公开纸条 / 取り消す':'删除本机纸条 / 削除')) + '</button>';
    else h += '<button type="button" class="op dim" data-act="report">' + U.esc((n.cloud?'举报 / 通報':'仅本机隐藏 / 非表示')) + '</button>';
    h += '</div>';
    h += '<div class="n-box" hidden><input type="text" aria-label="回复纸条 / 返信" class="ri" maxlength="' + MAX + '" placeholder="' + U.esc(I.t('replyPh')) + '">' +
      '<button type="button" class="btn small" data-act="send">' + U.esc(I.t('send')) + '</button></div>';
    h += '</article>';
    return h;
  }

  /* ---------------- 投递动画 ---------------- */
  function drop(fromEl, done) {
    var mouth = document.getElementById('thMouth');
    if (!mouth || !fromEl || (window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches)) { done(); return; }
    var a = fromEl.getBoundingClientRect(), b = mouth.getBoundingClientRect();
    var slip = document.createElement('div');
    slip.className = 'slip';
    slip.style.left = a.left + 'px';
    slip.style.top = a.top + 'px';
    slip.style.width = a.width + 'px';
    slip.style.height = a.height + 'px';
    document.body.appendChild(slip);
    var dx = (b.left + b.width / 2) - (a.left + a.width / 2);
    var dy = (b.top + b.height / 2) - (a.top + a.height / 2);
    requestAnimationFrame(function () {
      slip.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(.12) rotate(24deg)';
      slip.style.opacity = '.15';
    });
    setTimeout(function () {
      if (slip.parentNode) slip.parentNode.removeChild(slip);
      mouth.classList.add('gulp');
      setTimeout(function () { mouth.classList.remove('gulp'); done(); }, 260);
    }, 620);
  }

  /* ---------------- 交互 ---------------- */
  function addNote(text, sig, mood) {
    var d = load();
    var now = Date.now();
    var last = RC.store.get('hole_last', 0);
    var burst = RC.store.get('hole_burst', 0);
    if (now - last > 60000) burst = 0;
    if (burst >= BURST) return 'cooldownHit';
    if(typeof text!=='string'||!text.trim()||text.length>MAX||String(sig||'').length>16)return 'invalid';
    var n = {
      id: 'n' + now.toString(36) + Math.floor(Math.random() * 1e4).toString(36),
      code: ME, sig: sig || '', who: 'guest',
      body: { cn: text, jp: text }, mood: mood || 'calm',
      ts: now, lights: 0, lit: false, mine: true, replies: []
    };
    d.notes.push(n);
    if(!save(d))return 'saveFailed';
    RC.store.set('hole_last', now);
    RC.store.set('hole_burst', burst + 1);


    /* 陌生人的回声：延迟出现，像真的有人在洞口那头 */
    var echoDelay = 2500 + Math.floor(Math.random() * 2500);
    setTimeout(function () {
      var dd = load(), nn = findNote(dd, n.id);
      if (!nn) return;
      nn.replies.push({
        code: { cn: '本地预设回声（非真人）', jp: '定型文（実在の人ではありません）' }, who: 'user',
        body: pickEcho(nn), ts: Date.now()
      });
      if(save(dd))render();
    }, echoDelay);

    /* 店主或萨弗兰的回信 */
    var ch = pickCharacter(n);
    setTimeout(function () {
      var dd = load(), nn = findNote(dd, n.id);
      if (!nn) return;
      nn.replies.push({
        code: ch.who === 'safran'
          ? { cn: I.t('detective')+'（预设）', jp: I.t('detective')+'（定型文）' }
          : { cn: I.t('master')+'（预设）', jp: I.t('master')+'（定型文）' },
        who: ch.who, body: ch.body, ts: Date.now()
      });
      if(save(dd))render();
    }, echoDelay + 2200 + Math.floor(Math.random() * 2000));

    return n;
  }

  function bind() {
    if (!host) return;
    host.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.op, .n-box button') : null;
      if (!btn) return;
      var art = btn.closest('.note');
      if (!art) return;
      var id = art.getAttribute('data-id');
      var act = btn.getAttribute('data-act');
      var d = load(), n = findNote(d, id);
      if (!n) return;

      if(act==='retry'){cloud.flush().then(refresh).catch(error);return;}
      if(act==='share'){shareNote(n);return;}
      if(act==='reply'){
        var box=art.querySelector('.n-box');box.hidden=!box.hidden;if(!box.hidden)box.querySelector('.ri').focus();return;
      }
      if(n.cloud){
        var fields={};
        if(act==='send'){fields.body=art.querySelector('.ri').value.trim();if(!fields.body||fields.body.length>MAX)return;}
        if(act==='light'&&n.lit)return;
        var actions={send:'reply',light:'light',take:'withdraw',report:'report'};
        if(actions[act]){btn.disabled=true;cloud.mutate(actions[act],n.id,fields).then(function(){if(act==='send'){var input=host.querySelector('.note[data-id="'+n.id+'"] .ri');if(input)input.value='';}}).catch(error).finally(function(){btn.disabled=false;});}
        return;
      }
      if(act==='light'){
        if(n.lit)return;n.lit=true;n.lights=(Number(n.lights)||0)+1;if(save(d))render();
      }else if(act==='send'){
        var inp=art.querySelector('.ri'),text=inp.value.trim();if(!text||text.length>MAX||n.replies.length>=200)return;
        n.replies.push({code:ME,who:'user',body:{cn:text,jp:text},ts:Date.now()});
        if(save(d)){inp.value='';render();}
      }else if(act==='take'||act==='report'){
        var hidden=RC.store.get('hole_hidden',[]);if(!Array.isArray(hidden))hidden=[];
        if(hidden.indexOf(id)<0)hidden.push(id);
        if(!RC.store.set('hole_hidden',hidden))return;
        d.notes=d.notes.filter(function(x){return x.id!==id;});
        if(save(d)){render();message('已从本机移除；不影响已分享或历史公开副本。 / この端末から削除しました。');}
      }
    });

    host.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || e.isComposing || e.keyCode===229) return;
      var inp = e.target;
      if (!inp || !inp.classList || !inp.classList.contains('ri')) return;
      var art = inp.closest('.note');
      if (!art) return;
      var sendBtn = art.querySelector('[data-act="send"]');
      if (sendBtn) sendBtn.click();
    });
  }

  function shareNote(n){
    var payload={id:n.id,b:n.body.cn,c:n.sig||(n.code&&n.code.cn)||'',m:n.mood||'calm',t:n.ts};
    try {
      var url=RC.share.link('n',payload),wrap=document.getElementById('noteShare');
      wrap.hidden=false;document.getElementById('noteSharePreview').textContent=payload.c+'：'+payload.b;
      document.getElementById('noteShareLink').value=url;
      message('请检查纸条预览；复制后持有人可读取，副本无法撤回。 / 内容を確認してコピー。');
    }catch(e){message(e.message);}
  }
  function acceptShared(){
    var p;
    try{p=RC.share.read('n');if(!p)return;
      if(typeof p.id!=='string'||!/^[-a-zA-Z0-9_]{1,80}$/.test(p.id)||typeof p.b!=='string'||!p.b.trim()||p.b.length>140||typeof p.c!=='string'||p.c.length>60)throw Error('纸条格式无效 / Invalid note');
    }catch(e){message(e.message);return;}
    var d=load(),id='shared-'+U.hash(p.id+'|'+p.b).toString(36);
    var hidden=RC.store.get('hole_hidden',[]);if(Array.isArray(hidden)&&hidden.indexOf(id)>=0)return;
    if(!findNote(d,id)){
      d.notes.push({id:id,code:{cn:p.c,jp:p.c},sig:'',who:'guest',body:{cn:p.b,jp:p.b},mood:RC.model.string(p.m,20),ts:Number.isFinite(p.t)?p.t:Date.now(),lights:0,lit:false,mine:false,replies:[],shared:true});
      if(!save(d))return;
    }
    render();
    var art=Array.from(host.querySelectorAll('.note')).find(function(a){return a.dataset.id===id;});if(art)art.classList.add('pin');
  }

  /* ---------------- 启动 ---------------- */
  function init() {
    host = document.getElementById('thNotes');
    if (!host) return;

    var codeEl = document.getElementById('thCode');
    if (codeEl) codeEl.innerHTML = RC.ui.bi(ME.cn, ME.jp);

    /* 心情选择 */
    var moodBox = document.getElementById('thMoods');
    var curMood = 'calm';
    if (moodBox) {
      var mh = '<button type="button" class="mchip" data-m="calm">' + U.esc(I.t('mCalm')) + '</button>';
      for (var i = 0; i < MOODS.length; i++) {
        if (MOODS[i].k === 'calm') continue;
        mh += '<button type="button" class="mchip" data-m="' + MOODS[i].k + '">' + U.esc(I.t(MOODS[i].key)) + '</button>';
      }
      moodBox.innerHTML = mh;
      moodBox.addEventListener('click', function (e) {
        var c = e.target.closest ? e.target.closest('.mchip') : null;
        if (!c) return;
        curMood = c.getAttribute('data-m');
        var all = moodBox.querySelectorAll('.mchip');
        for (var k = 0; k < all.length; k++) all[k].classList.toggle('on', all[k] === c);
      });
      var first = moodBox.querySelector('.mchip');
      if (first) first.classList.add('on');
    }

    /* 筛选 */
    var fBox = document.getElementById('thFilter');
    if (fBox) {
      var fh = '<button type="button" class="fchip on" data-f="all">' + U.esc(I.t('filterAll')) + '</button>';
      for (var j = 0; j < MOODS.length; j++) {
        fh += '<button type="button" class="fchip" data-f="' + MOODS[j].k + '">' + U.esc(I.t(MOODS[j].key)) + '</button>';
      }
      fBox.innerHTML = fh;
      fBox.addEventListener('click', function (e) {
        var c = e.target.closest ? e.target.closest('.fchip') : null;
        if (!c) return;
        filter = c.getAttribute('data-f');
        var all = fBox.querySelectorAll('.fchip');
        for (var k = 0; k < all.length; k++) all[k].classList.toggle('on', all[k] === c);
        render();
      });
    }

    /* 投递 */
    var btn = document.getElementById('thDrop');
    var bodyEl = document.getElementById('thBody');
    var sigEl = document.getElementById('thSig');
    var msg = document.getElementById('thMsg');
    var cnt = document.getElementById('thCount');
    if (bodyEl) {
      bodyEl.addEventListener('input', function () {
        if (cnt) cnt.textContent = bodyEl.value.length + ' / ' + MAX;
      });
    }
    if (btn) {
      btn.addEventListener('click', function () {
        var txt = (bodyEl ? bodyEl.value : '').trim();
        if (!txt) { if (msg) msg.innerHTML = '<span class="red">※ ' + U.esc(I.t('atLeastOne')) + '</span>'; return; }
        if (txt.length > MAX) { if (msg) msg.innerHTML = '<span class="red">※ ' + U.esc(I.t('tooLong')) + '</span>'; return; }
        var last = RC.store.get('hole_last', 0);
        if (Date.now() - last < COOL) { if (msg) msg.innerHTML = '<span class="red">※ ' + U.esc(I.t('cooling')) + '</span>'; return; }
        if(document.getElementById('thVisibility').value==='public'){
          if(!cloud.ready){message('请先连接公开树洞 / Connect first');return;}
          btn.disabled=true;
          var id='n'+Date.now().toString(36)+Math.random().toString(36).slice(2,10);
          cloud.mutate('publish',id,{body:txt,sig:sigEl?sigEl.value.trim():'',mood:curMood}).then(function(){bodyEl.value='';if(cnt)cnt.textContent='0 / '+MAX;}).catch(error).finally(function(){btn.disabled=false;});
          return;
        }
        var r = addNote(txt, sigEl ? sigEl.value.trim() : '', curMood);
        if(typeof r==='string'&&r!=='cooldownHit'){message('未保存，请检查输入与浏览器存储。 / 保存できません');return;}
        if (r === 'cooldownHit') { if (msg) msg.innerHTML = '<span class="red">※ ' + U.esc(I.t('cooldownHit')) + '</span>'; return; }
        if (bodyEl) bodyEl.value = '';
        if (cnt) cnt.textContent = '0 / ' + MAX;
        drop(bodyEl, function () {
          render();
          if (msg) msg.innerHTML = '<span class="amber">※ ' + U.esc(I.t('dropped')) + '</span>';
        });
      });
    }

    bind();
    render();
    acceptShared();

    var badge=document.getElementById('thCloud');
    var visSel=document.getElementById('thVisibility'),pubOpt=document.getElementById('thPublicOption'),visTouched=false;
    if(visSel)visSel.addEventListener('change',function(){visTouched=true;});
    function markConnected(){badge.textContent='已连接云端树洞 / クラウド接続済み';if(pubOpt)pubOpt.disabled=false;if(visSel&&!visTouched)visSel.value='public';}
    function markLocal(){badge.textContent='本机模式 / この端末のみ';if(visSel&&!visTouched)visSel.value='local';}
    function connect(btn,silent){
      if(btn)btn.disabled=true;
      return cloud.connect().then(function(){markConnected();return cloud.flush();}).then(refresh)
        .catch(function(e){markLocal();if(!silent)error(e);}).finally(function(){if(btn)btn.disabled=false;});
    }
    document.getElementById('thConnect').addEventListener('click',function(){connect(this,false);});
    /* 默认接云端：进页即自动连接公开树洞，成功后可见范围默认落在「公开投递」。
       服务不可达时静默退回「仅本机」，投递与本地回声都不受影响。
       访客一旦自己改过可见范围，就完全尊重他的选择，不再回写默认值。 */
    badge.textContent='连接云端中… / 接続中…';
    connect(null,true);
    document.getElementById('thRetry').addEventListener('click',function(){cloud.flush().then(refresh).catch(error);});
    document.getElementById('thCancelPending').addEventListener('click',function(){try{if(cloud.cancelPending())message('已取消待同步；已送达的操作不受影响。 / 送信待ちを破棄しました。');}catch(e){error(e);}});
    document.getElementById('noteCopy').addEventListener('click',function(){var box=document.getElementById('noteShareLink');RC.share.copy(box.value).then(function(){message('已复制 / コピーしました');},function(){box.focus();box.select();message('请手动复制 / 手動でコピー');});});
    setInterval(function(){if(!document.hidden&&cloud.ready)refresh().catch(error);},9000);

    RC.i18n.onChange(function () { render(); });
  }

  window.RC = window.RC || {};
  RC.hole = { add: addNote, render: render, code: function () { return ME; }, cloud: cloud, mergeCloud:mergeCloud };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
