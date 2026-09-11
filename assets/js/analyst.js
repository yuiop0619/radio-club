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

  /* ---------- 本机模板库：多主题、多版本、按历史去重 ----------
     未接入模型时，从该大师的模板池中按主题随机抽取；
     同一回合/历史里出现过的句子不再重复，避免「死循环感」。 */
  var BANK = {
    _default: {
      opening: [
        '这个梦很有意思，讲讲你印象最深的那一幕。',
        '梦里最先出现的是什么？把它说细一点。',
        '先不急着找意义，把梦再讲一遍，像放电影一样。'
      ],
      deepen: [
        '它让你想起了什么？',
        '如果这个梦是一句话，它会说什么？',
        '梦里最让你情绪起伏的是哪一刻？',
        '再讲一个相关的梦，或者白天发生的相关事件。'
      ],
      closure: [
        '梦的线索已经够了。真正的答案在你醒后的生活里。',
        '这个梦会在你继续生活的过程中自己显影。',
        '记下它，然后去过今天——意义会跟上来。'
      ],
      lens: {}
    },
    zhougong: {
      opening: [
        '坐。梦在成为心理学之前，先是兆。讲你看见的，我为你查象。',
        '不必急，先说出梦里最鲜亮的那一物。兆从象起。',
        '梦有象，象有占。今夜你带了哪一象来？'
      ],
      deepen: [
        '再问一句：梦里的兆，是「突来」还是「常在」？',
        '那象在梦中可曾变色、变大、或反复出现？变处是占眼。',
        '醒来第一眼想到的人事，往往是这个梦的引子。是什么？',
        '若把梦倒过来看，最先消失的是什么？那便是你要守的。'
      ],
      closure: [
        '兆已录：吉凶不在象，在你醒后走的那一步。',
        '象已查尽，签文在你手里——接下来看你怎么落子。',
        '梦书翻完，最后一句留给你自己：此兆因你而有解。'
      ],
      lens: {
        water: [
          '水主财与情。梦水非灾，是你的「情」浮出水面。清吉，浊警。',
          '水势顺则财通，逆则情滞。你梦里的水，是流还是困？',
          '梦见大水多应变动，小水多应心事。清浊之间，吉凶自分。'
        ],
        fall: [
          '坠高为失位。你怕的不是摔，是「无人接住」。',
          '高坠之梦，多在人事变动前。失势之象，宜缓不宜急。',
          '若落地未伤，是「失而复得」之兆；若悬而未落，是心事未决。'
        ],
        chase: [
          '被追为欠。梦里追你的，是白天你还没还的那笔面对。',
          '追逃入宅，主家事；追逃于路，主外事。你可记得在哪被追？',
          '追而不及，吉；追而被及，警。梦里的距离，就是现实中的余地。'
        ],
        dead: [
          '梦死多为反象：旧我死、新我生。梦书谓之「更新」。',
          '梦见亡者复生，主念旧；梦见生人死去，主关系将变。',
          '死象最忌惊慌。梦死多是「结束一段」的吉兆，不是身灾。'
        ],
        house: [
          '屋为身与家。门是出路，窗是眼。你停在哪个房间，心就在哪。',
          '房屋倾颓，主旧有结构松动；房屋整洁，主心境渐明。',
          '梦门不开，是出路被自己所堵；开窗则通气，宜与人言。'
        ],
        mirror: [
          '镜见分身。梦现己身，是名实该相省之时。',
          '镜中像变，主自我认知将变；镜碎，主旧身份崩解。',
          '照镜而不见，是「尚未认出自己」之象，宜慢思。'
        ]
      }
    },
    freud: {
      opening: [
        '躺下吧——这里没有躺椅，但话可以躺着说。梦是伪装后的愿望。讲，我来找那个被藏起来的「想要」。',
        '说吧，别修饰。梦里最让你不舒服或最兴奋的细节，都是线索。',
        '梦不是乱编，是夜间审查官下班后的剧情。你带了哪段剧情来？'
      ],
      deepen: [
        '再问：梦里那一幕若愿望成真，你会失去什么？',
        '把梦里最突兀的那个形象放在白天——它会让你想起哪件未了的事？',
        '如果梦是封信，显意是信封，隐意是信纸。你摸到信纸了吗？',
        '重复出现的不是梦的主题，是你反复压抑的同一个念头。'
      ],
      closure: [
        '愿望已署名，只是邮戳被涂改了。',
        '梦的伪装被拆穿后，剩下的愿望往往很单纯。',
        '这就是你的潜意识在夜班写的信——现在你知道落款是谁了。'
      ],
      lens: {
        water: [
          '水是情感与欲望的潮位。梦见水，常是你唯一允许自己「感受」的时刻。',
          '溺水是被情感淹没；清水是愿望的澄澈。你梦里的水是哪一种？',
          '水的容器很重要。井、杯、海，分别对应被压抑、被约束、被放大。'
        ],
        fall: [
          '坠落是控制感松手。你想放下某件事，但超我不批。',
          '摔下去的那一刻，你心里是解脱还是恐惧？这便是答案。',
          '坠落的梦里，地面往往缺席——因为你想放下的，还没找到落点。'
        ],
        chase: [
          '追你的不是别人，是你不认的那部分欲望。它追，是因为你跑。',
          '试着在梦里停下来，看看追你的是谁的脸——多半是你自己的。',
          '被追梦是欲望的逆反：越压抑，夜间越猖獗。'
        ],
        teeth: [
          '掉牙是老剧本：怕失去力量、怕被看穿无力。',
          '牙是攻击器官，掉牙常伴随「不能咬回去」的憋屈。',
          '若梦里你在找牙，是在找失去的那部分自我效能感。'
        ],
        naked: [
          '赤裸是「想被真正看见」与「怕被看见那个」的同框。',
          '梦里裸露时，周围人的反应才是关键——那是你内心观众的声音。',
          'nakedness 的羞耻感，多半来自童年被审视的旧经验。'
        ],
        dead: [
          '梦死常是「希望某段关系结束」的愿望被审查后改写的样子。愿望不等于行动。',
          '死亡在梦里 rarely 是终点，多是一种「让某事停止」的隐喻。',
          '若死者是你恨的人，梦里你是在完成一个被禁止的愿望。'
        ]
      }
    },
    jung: {
      opening: [
        '梦不是伪装，是补偿：它把白天被你忽略的那一半，夜里补给你。说吧。',
        '你的梦带着整个人类的记忆库存。别急着说「这没意义」。',
        '告诉我梦里最「不像你」的那个角色——它往往是被流放的你。'
      ],
      deepen: [
        '若梦是一个人在对你说话，他的语气是敌是友？',
        '这个意象若出现在神话或童话里，会是什么角色？',
        '梦里重复出现的地点，是你心灵的固定坐标。它代表你人生的哪个阶段？',
        'compensation 总在补短板：你白天越否认什么，夜里越会梦见什么。'
      ],
      closure: [
        '补偿已送达：白天缺的，夜里给了。',
        '这个梦在完成你尚未整合的另一半自我。',
        '原型已路过你——接不接得住，是醒后的功课。'
      ],
      lens: {
        mirror: [
          '镜与影是自性的回声。你梦见的「另一个我」，是还没整合的原型。',
          '镜中人的表情若与你不同，那是你拒绝承认的情绪。',
          '镜子在梦里从不说谎，它只是把你还没看见的部分转过来。'
        ],
        animal: [
          '动物是本能的原型。它出现，是因为文明的你太久没喂它。',
          '梦里动物的颜色、大小、动作都是线索——它是来帮你的，还是来警告你？',
          '若你害怕那只动物，多半是在害怕自己身上的某种生命力。'
        ],
        house: [
          '梦屋是你的心灵结构：地下室是无意识，阁楼是精神。你停在哪层？',
          '房子的新旧，对应自我概念的稳固程度。',
          '若在梦里找不到家门，是自性暂时迷失了入口。'
        ],
        water: [
          '水是集体无意识之海。涉水，是在接近所有人共有的那层深。',
          '梦水越深处越黑，代表你越接近自己未整合的阴影。',
          '若你在水边犹豫，是在自性整合的门槛上。'
        ],
        fly: [
          '飞是超越功能启动：你想从处境「上方」看它。',
          '飞不高的梦，是自我还不敢完全脱离地面控制。',
          '坠落前的飞翔，常是「膨胀的自我」在找边界。'
        ]
      }
    },
    horney: {
      opening: [
        '别躺下，坐着就好。我不找「病」，我找你和这个世界的相处方式。梦是你最诚实的自我报告。',
        '梦里没有应该，只有真实。说吧，你最近又在为难自己什么？',
        '这个梦不是告诉你「你有问题」，是告诉你「你怎么活下来了」。'
      ],
      deepen: [
        '梦里你在「迎合」谁？',
        '梦里那个让你不舒服的人，代表的是哪一种关系模式？',
        '如果梦里的你能说「不」，第一句会是什么？',
        '这个梦在保护你的哪一种「理想化自我」不被戳破？'
      ],
      closure: [
        '真实的自我还在，只是被「应该」盖住了声音。',
        '梦没说你有病，它只说你累了，还在硬撑。',
        '关系模式可以改变——从这个梦开始，你已经看见了它。'
      ],
      lens: {
        chase: [
          '被追常是「应该的自我」在追「真实的自我」。你跑，是因为差距让你羞耻。',
          '追你的人若换成你心中的「必须优秀」，你还想逃吗？',
          '被追梦的压力，往往来自你对「不够好」的恐惧。'
        ],
        naked: [
          '赤裸是被评价的恐惧：你怕的不是身体，是「不够好」被看见。',
          '梦里裸露的场景若在工作/学校，对应的是能力焦虑。',
          'nakedness 在此不是性欲，是「被审视」的隐喻。'
        ],
        exam: [
          '考试与迟到是「理想化自我」的考场。你永远在补考，因为标准不在你手里。',
          '梦里考的全是你会的，还是全是你不会的？这暴露了你的焦虑模式。',
          '考试梦最常出现在「被评价期」：求职、考核、关系确认前。'
        ],
        fall: [
          '坠落是「必须优秀」的脚手架松了一根。你怕的不是摔，是「不再被需要」。',
          '若梦里有人接住你，是你内心渴望依赖却不敢承认。',
          '坠落而未受伤，说明你的自我价值感比想象中结实。'
        ]
      }
    },
    perls: {
      opening: [
        '我不解释梦，我要你「演」梦。梦的每个部分都是你。现在，成为梦里那个东西，替它说话。',
        '别告诉我它代表什么，告诉我它此刻在做什么。',
        '梦里没有旁观者，每个角色都是你的分身。选一个，成为它。'
      ],
      deepen: [
        '用第一人称，替梦里最不起眼的那个东西说一句话。',
        '现在成为梦里的背景：墙、天空、地板——它们见证了你什么？',
        '梦里让你最烦的那个人，对他/它说：「你为什么要出现？」',
        '如果你的身体就是梦的场地，它哪个部位在紧？'
      ],
      closure: [
        '梦不是密码，是未完成的格式塔——演完，它就闭合。',
        '你已经把梦从记忆里演到了当下。它现在属于你了。',
        '格式塔闭合后，剩下的感受才是你的功课。'
      ],
      lens: {
        chase: [
          '成为追你的那个东西。替它说一句：它想从你这里得到什么？',
          '你不是受害者，你在梦里选择了跑。选择意味着什么？',
          '停下，转身，看着追你的人——它还在吗？'
        ],
        fall: [
          '成为「坠落」本身。坠落不是事件，是你正在放弃支撑的动作。',
          '坠落时你在想什么？那个念头，就是支撑松手的真相。',
          '若地面是你自己，你会怎么接住自己？'
        ],
        teeth: [
          '成为那颗掉下来的牙。它有什么话没说出口？',
          '牙掉了，嘴里空了。那个空洞在说什么？',
          '若牙能开口，它会对你说：「你咬得太紧了。」'
        ],
        mirror: [
          '成为镜子里那个人。对视时，谁先移开眼睛？',
          '镜中人的嘴唇在动，替他说出他没说出口的话。',
          '镜子本身也是你的一部分——它为什么要反射你？'
        ]
      }
    },
    cartwright: {
      opening: [
        '我是做睡眠实验的。梦不是预言，是夜班的情绪编辑。告诉我梦和白天那件事——我看它们怎么接上线。',
        '把梦当成昨晚的「情绪回放」。白天哪件事，在梦里被改写了？',
        '梦不隐藏意义，它在帮你处理白天没处理完的情绪强度。'
      ],
      deepen: [
        '这个梦和你白天那件事，情绪是同一种吗？',
        '梦里情绪强度比白天高还是低？这是大脑在调节的信号。',
        '醒来后你还带着梦里的情绪吗？那是编辑还没完成的痕迹。',
        '如果梦是排练，它在让你为白天的哪一幕做准备？'
      ],
      closure: [
        '情绪已在夜班被编辑过一轮——你比入睡前轻了一点。',
        '梦的连续性已经闭合：白天的事，夜里被重讲了一遍。',
        '这就是你的睡眠实验室今晚的报告：情绪调节完成度 +1。'
      ],
      lens: {
        chase: [
          '追逃梦是情绪排练：白天没处理完的威胁，夜里接着排演，直到强度降下来。',
          '追逃梦的反复出现，说明白天的压力源还在持续释放皮质醇。',
          '若梦里你成功逃脱，是大脑在增强你的掌控感。'
        ],
        fall: [
          '坠落常出现在「失控感」高的时期。梦在把失控翻译成可以醒来的场景。',
          '坠落梦的情绪峰值往往出现在你白天最无助的那一刻。',
          '若梦里你学会了飞翔或落地，是情绪调节成功的标志。'
        ],
        dead: [
          '丧失类梦是情绪剥离作业：一遍遍放，是为了把「事件」和「痛」慢慢分开。',
          '死亡梦常在真实丧失后反复出现，是大脑在分类存储记忆。',
          '梦里死而复生，是你在练习「没有 TA 也能继续」。'
        ],
        exam: [
          '考试梦多出现在「被评估」压力期，是白天压力的同题重做。',
          '若梦里你答不上题，说明白天的任务你感觉自己准备不足。',
          '考试梦有时也出现在能力即将被验证前，是预演性焦虑。'
        ]
      }
    },
    vonfranz: {
      opening: [
        '荣格老师让我把梦放回神话和童话里读。一个意象是一座图书馆。说吧，我带你翻书。',
        '梦里的每一个细节，都可能在某个童话里出现过千百次。你梦见了哪一页？',
        '不要急着把梦翻译成你的个人问题，先看它在人类故事里是什么意思。'
      ],
      deepen: [
        '如果这是一个童话的开头，下一幕会发生什么？',
        '把这个意象放进你记得的第一个童话——它会扮演什么？',
        '梦里的数字、颜色、动物，都是符号的语法。你注意到了什么？',
        '若梦是神话，你现在的处境对应英雄的哪个阶段？'
      ],
      closure: [
        '意象已扩增：它不只是你的，它带着人类的故事来看你。',
        '童话已经讲完，但它在你的生命里才刚刚开始。',
        '这个梦把你连进了更大的故事网络——你不再是一个人。'
      ],
      lens: {
        animal: [
          '童话里动物是引路者或考验。你梦里的动物，是带路还是拦路？',
          '若它会说话，它用童话里哪种语气？狡猾、忠诚、威胁、还是帮助？',
          '动物在梦里常是「本能向导」——它想带你去哪里？'
        ],
        mirror: [
          '镜与倒影在童话里通向「另一个世界」。你正站在门槛上。',
          '若镜中人是你的童话分身，他/她有什么任务要交给你？',
          '镜子在童话里从不说谎，它只显示你还没准备好看的一面。'
        ],
        fire: [
          '火是转化之炉：童话里被火烧过的才成器。你正被烧，也在被成。',
          '若火在梦里温暖你，是净化；若烧灼你，是旧结构必须崩塌。',
          '凤凰需要先被火烧。你的梦在说：转化已经开始。'
        ],
        water: [
          '水是生命与无意识之泉。泉边相遇的情节，童话里叫「命运的开始」。',
          '若你在梦里饮水，是在汲取无意识深处的能量。',
          '被水淹没在童话里常是「必须放下控制」的仪式。'
        ],
        house: [
          '森林深处的小屋是转化之所。你梦见的屋子，是童话里那间吗？',
          '梦屋在童话里常是「被给予试炼任务」的地方。',
          '若房子里有你找不到的房间，那是你尚未进入的自性角落。'
        ]
      }
    }
  };

  function similar(a, b) {
    var sa = {}, sb = {}, inter = 0, c, i;
    var ta = String(a || ''), tb = String(b || '');
    for (i = 0; i < ta.length; i++) sa[ta.charAt(i)] = 1;
    for (i = 0; i < tb.length; i++) {
      c = tb.charAt(i); sb[c] = 1;
      if (sa[c]) inter++;
    }
    var union = 0;
    for (c in sa) union++;
    for (c in sb) if (!sa[c]) union++;
    return union ? inter / union : 0;
  }
  function pick(pool, history, threshold) {
    threshold = threshold || 0.72;
    if (!pool || !pool.length) return null;
    var recent = [], i, j;
    for (i = 0; i < (history || []).length; i++) if (history[i].role === 'assistant') recent.push(history[i].text);
    recent = recent.slice(-4);
    var candidates = pool;
    if (recent.length) {
      candidates = pool.filter(function (t) {
        return !recent.some(function (h) { return similar(h, t) >= threshold; });
      });
    }
    if (!candidates.length) candidates = pool;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  /* ---------- 本机模板兜底：motif → 学派口吻 ----------
     多轮对话自动切换开场/深入/结案，避免死循环。 */
  function replyOf(master, text, turn, history) {
    var ms = motifs(text);
    var bank = (master && master.id && BANK[master.id]) ? BANK[master.id] : BANK._default;
    var pool = [];
    for (var i = 0; i < ms.length; i++) {
      var arr = bank.lens[ms[i]];
      if (arr && arr.length) pool = pool.concat(arr);
    }
    if (!pool.length) {
      if (turn <= 1) pool = bank.opening;
      else if (turn <= 2) pool = bank.deepen;
      else pool = bank.closure;
    }
    var cn = pick(pool, history);
    if (!cn) cn = master.ask.cn;
    return { cn: cn, jp: cn, motifs: ms, key: ms[0] || '_' };
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
        var fallback = replyOf(cur.m, cur.dream, cur.turn, cur.history);
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
      /* 未配置模型：本机模板，按主题/回合/历史去重随机选择 */
      var r = replyOf(cur.m, t, cur.turn, cur.history);
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
