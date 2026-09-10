/* ============================================================
   toolbox.ts — 理线头工具箱（批次 4）
   ------------------------------------------------------------
   三件工具各自的纯逻辑，组件只负责渲染与事件：
     1) 呼吸：把 content 里的 phases 展开成一条时间轴，给定
        已过秒数就能算出「现在是哪个相位、还要几秒、第几轮」
     2) 情绪：把打卡记录排成最近 N 天的连续序列（缺的日子留空，
        而不是把点挤在一起 —— 缺口本身也是信息）
     3) 念头：字段定义来自 content，必填/选填由 must 决定
   ============================================================ */

export interface Pair { cn: string; jp: string; }

export interface MoodLevel { score: number; cn: string; jp: string; line: Pair; }
export interface TagDef { k: string; cn: string; jp: string; }
export interface Pattern {
  k: string; cn: string; jp: string; desc: Pair;
  /** [相位键, 秒数] */
  phases: [string, number][];
}
export interface FieldDef { k: string; cn: string; jp: string; ph: Pair; must: boolean; }

export interface Content {
  moods: MoodLevel[];
  tags: TagDef[];
  breath: { phaseNames: Record<string, Pair>; patterns: Pattern[] };
  thought: { fields: FieldDef[]; sample: Pair };
}

/** 兜底：内容包缺失时页面也不至于白屏 */
const FALLBACK: Content = {
  moods: [
    { score: 1, cn: '很差', jp: 'ひどい', line: { cn: '', jp: '' } },
    { score: 2, cn: '偏低', jp: '沈む', line: { cn: '', jp: '' } },
    { score: 3, cn: '一般', jp: 'ふつう', line: { cn: '', jp: '' } },
    { score: 4, cn: '还好', jp: 'まあまあ', line: { cn: '', jp: '' } },
    { score: 5, cn: '很好', jp: 'いい', line: { cn: '', jp: '' } }
  ],
  tags: [],
  breath: {
    phaseNames: { in: { cn: '吸气', jp: '吸う' }, hold: { cn: '停住', jp: '止める' }, out: { cn: '呼气', jp: '吐く' } },
    patterns: [{ k: 'long', cn: '延长呼气', jp: '長い呼気', desc: { cn: '', jp: '' }, phases: [['in', 4], ['out', 6]] }]
  },
  thought: { fields: [], sample: { cn: '', jp: '' } }
};

/** 读取构建期打进 content-bundle 的文案包 */
export function getContent(): Content {
  const raw = (typeof window !== 'undefined' && (window as any).RC_CONTENT && (window as any).RC_CONTENT.toolbox) || {};
  const b = (raw.breath && typeof raw.breath === 'object') ? raw.breath : {};
  const th = (raw.thought && typeof raw.thought === 'object') ? raw.thought : {};
  return {
    moods: Array.isArray(raw.moods) && raw.moods.length ? raw.moods : FALLBACK.moods,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    breath: {
      phaseNames: (b.phaseNames && typeof b.phaseNames === 'object') ? b.phaseNames : FALLBACK.breath.phaseNames,
      patterns: Array.isArray(b.patterns) && b.patterns.length ? b.patterns : FALLBACK.breath.patterns
    },
    thought: {
      fields: Array.isArray(th.fields) ? th.fields : [],
      sample: (th.sample && typeof th.sample === 'object') ? th.sample : FALLBACK.thought.sample
    }
  };
}

/* ---------------- 呼吸 ---------------- */

export interface Step { k: string; sec: number; from: number; to: number; }
export interface Cycle { total: number; steps: Step[]; }

/** 把 [['in',4],['hold',7],['out',8]] 展开成一条以秒为刻度的循环 */
export function cycleOf(phases: [string, number][] | undefined): Cycle {
  let from = 0;
  const steps: Step[] = [];
  (phases || []).forEach((p) => {
    const k = String((p && p[0]) || 'in');
    const sec = Math.max(1, Math.round(Number(p && p[1]) || 0));
    steps.push({ k, sec, from, to: from + sec });
    from += sec;
  });
  if (!steps.length) steps.push({ k: 'in', sec: 4, from: 0, to: 4 });
  return { total: steps[steps.length - 1].to, steps };
}

export interface BreathAt {
  /** 第几轮，从 1 起 */
  round: number;
  /** 当前相位键 */
  k: string;
  /** 该相位总秒数 */
  sec: number;
  /** 该相位剩余整秒（向上取整，读到 1 时收尾） */
  remain: number;
  /** 整轮进度 0~1 */
  progress: number;
  /** 当前相位进度 0~1 */
  phaseProgress: number;
  /** 已完成轮数（不含当前这轮） */
  done: number;
  /** 肺里的气量 0~1：吸气涨、呼气降、停住时保持不变 */
  level: number;
}

/** 已过 seconds 秒时，机器应该处在什么状态 */
export function breathAt(cycle: Cycle, seconds: number): BreathAt {
  const total = cycle.total || 1;
  const s = Math.max(0, Number(seconds) || 0);
  const done = Math.floor(s / total);
  const round = done + 1;
  const t = s - done * total;
  let step = cycle.steps[cycle.steps.length - 1];
  for (const st of cycle.steps) { if (t >= st.from && t < st.to) { step = st; break; } }
  const within = Math.max(0, Math.min(1, (t - step.from) / step.sec));

  /* 气量：顺着相位走一遍，停住（hold）时沿用上一相位的终值 */
  let level = 0;
  for (const st of cycle.steps) {
    if (st.k === 'in') level = 1;
    else if (st.k === 'out') level = 0;
    if (st === step) break;
  }
  if (step.k === 'in') level = within;
  else if (step.k === 'out') level = 1 - within;

  return {
    round,
    k: step.k,
    sec: step.sec,
    remain: Math.max(1, Math.ceil(step.to - t)),
    progress: t / total,
    phaseProgress: within,
    done,
    level
  };
}

/* ---------------- 情绪 ---------------- */

export interface MoodCell {
  /** YYYY-MM-DD */
  date: string;
  /** 日号，如 7 */
  day: number;
  /** 0 表示那天没打 */
  score: number;
  today: boolean;
}

function dateKey(d: Date): string {
  const p = (n: number) => (n < 10 ? '0' + n : String(n));
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

/** 今天（或给定时刻）的 YYYY-MM-DD，与 profile 里 MoodLog.date 的口径一致 */
export function todayKey(now = Date.now()): string {
  return dateKey(new Date(now));
}

/** 最近 N 天的连续序列（含今天，升序）；没打卡的那天 score 记 0 */
export function moodSeries(logs: { date: string; score: number }[], days = 14, now = Date.now()): MoodCell[] {
  const byDate: Record<string, number> = {};
  (logs || []).forEach((l) => {
    if (!l || !l.date) return;
    byDate[String(l.date)] = Number(l.score) || 0;
  });
  const todayKey = dateKey(new Date(now));
  const out: MoodCell[] = [];
  const cur = new Date(now);
  cur.setHours(0, 0, 0, 0);
  cur.setDate(cur.getDate() - (Math.max(1, days) - 1));
  for (let i = 0; i < Math.max(1, days); i++) {
    const k = dateKey(cur);
    out.push({ date: k, day: cur.getDate(), score: byDate[k] || 0, today: k === todayKey });
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/** 最近 N 天已打卡者的均分（一位小数；无记录为 0） */
export function moodAvg(logs: { at: number; score: number }[], days = 7, now = Date.now()): number {
  const cut = now - Math.max(1, days) * 864e5;
  const recent = (logs || []).filter(l => l && Number(l.at) >= cut);
  if (!recent.length) return 0;
  const sum = recent.reduce((a, l) => a + (Number(l.score) || 0), 0);
  return Math.round((sum / recent.length) * 10) / 10;
}

/** 状态词：给连续天数配一句人话 */
export function streakTier(streak: number): 'none' | 'start' | 'week' | 'month' {
  if (!streak) return 'none';
  if (streak >= 21) return 'month';
  if (streak >= 7) return 'week';
  return 'start';
}

if (typeof window !== 'undefined') {
  const w = window as any;
  w.RC = w.RC || {};
  w.RC.toolbox = {getContent, cycleOf, breathAt, moodSeries, moodAvg, streakTier, todayKey};
}

export default {getContent, cycleOf, breathAt, moodSeries, moodAvg, streakTier, todayKey};
