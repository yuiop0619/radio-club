import {rc as rcBridge} from './legacy';

/* ============================================================
   profile.ts — 统一档案层（《梦侦探档案》）
   ------------------------------------------------------------
   原则：既有存储键（case / verdict / dreamLog / bbs_v2 / stamps /
   counter_v2 / visits / stat_tarot …）一律不搬动 —— demo、regulars、
   stamps 与测试都在直接读它们，搬迁会破坏既有契约。

   本层只做两件事：
     1) 聚合视图：把散落各处的痕迹汇成一份可看、可导出的档案
        （snapshot / timeline / toMarkdown / toJSON）
     2) 增量写入：给新功能（性格层析 / 情绪打卡 / 抽牌历史 / 牌库）
        一个统一的命名空间（写在 rc_profile 下，与旧键互不干扰）
   ============================================================ */

const KEY = 'profile';

/** 拿最新的 window.RC（模块求值时它可能还没挂上） */
function R(): any {
  if (typeof window !== 'undefined' && (window as any).RC) return (window as any).RC;
  return rcBridge as any;
}

function read<T>(k: string, def: T): T {
  try { return (R().store.get(k, def) as T); } catch (e) { return def; }
}
function write(k: string, v: unknown): boolean {
  try { return !!R().store.set(k, v); } catch (e) { return false; }
}
function arr<T>(v: unknown): T[] { return Array.isArray(v) ? (v as T[]) : []; }

/* ---------------- 新功能的数据形状 ---------------- */

export interface Personality {
  /** 四字母类型，如 'INFP' */
  type: string;
  /** 四维倾向：EI/SN/TF/JP 各取 0~1，>0.5 偏向前一个字母 */
  dims: Record<string, number>;
  /** 边界型标记：该维度接近 0.5，不硬贴标签 */
  balanced: Record<string, boolean>;
  /** 每题答案（用于复测对比） */
  answers?: number[];
  at: number;
}

export interface TarotDraw {
  id: string;
  at: number;
  /** 牌阵键：pentagram / timeLine / dailyCard */
  spread: string;
  /** 咨询维度：love / work / self / choice */
  domain: string;
  question?: string;
  /** [{ id, upright, pos }] */
  cards: { id: number; upright: boolean; pos: number }[];
}

export interface MoodLog {
  /** YYYY-MM-DD，一天一条（同日覆盖） */
  date: string;
  /** 1~5 */
  score: number;
  tags: string[];
  note?: string;
  at: number;
}

export interface ThoughtRecord {
  id: string;
  at: number;
  /** 情境 */
  scene: string;
  /** 自动念头 */
  thought: string;
  /** 支持证据 */
  for: string;
  /** 反对证据 */
  against: string;
  /** 替代想法 */
  alt: string;
}

export interface Snapshot {
  handle: string;
  visits: {total: number; today: number; lastAt: number};
  firstAt: number;
  caseDoc: any | null;
  verdict: any | null;
  personality: Personality | null;
  tarot: {draws: TarotDraw[]; count: number};
  mood: {logs: MoodLog[]; streak: number; avg7: number};
  thoughts: ThoughtRecord[];
  dreams: any[];
  notes: any[];
  stamps: {id: string; at: number}[];
  counts: {
    orders: number; items: number; tarot: number;
    dreams: number; notes: number; stamps: number; mood: number;
  };
}

export interface Event {
  at: number;
  kind: 'order' | 'verdict' | 'tarot' | 'personality' | 'mood' | 'dream' | 'note' | 'stamp' | 'thought';
  title: string;
  detail: string;
}

/* ---------------- 读写（新功能数据走这里） ---------------- */

function subGet<T>(k: string, def: T): T {
  const box = read<Record<string, unknown>>(KEY, {});
  if (!box || typeof box !== 'object' || Array.isArray(box)) return def;
  return (k in box ? (box[k] as T) : def);
}
function subSet(k: string, v: unknown): boolean {
  const box = read<Record<string, unknown>>(KEY, {});
  const next = (box && typeof box === 'object' && !Array.isArray(box)) ? box : {};
  next[k] = v;
  return write(KEY, next);
}

/* ---------------- 时间工具 ---------------- */

function dayKey(ts: number): string {
  const d = new Date(ts);
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}
function toDateStr(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => (n < 10 ? '0' + n : String(n));
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
function fmt(ts: number): string {
  if (!ts) return '—';
  const d = new Date(ts);
  const p = (n: number) => (n < 10 ? '0' + n : String(n));
  return toDateStr(ts) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

/** 连续打卡天数（含今天；今天没打则从昨天往前数） */
function calcStreak(logs: MoodLog[]): number {
  if (!logs.length) return 0;
  const days = new Set(logs.map(l => l.date).filter(Boolean));
  const today = new Date();
  const todayKey = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
  if (!days.has(todayKey)) {
    today.setDate(today.getDate() - 1);
    const yKey = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
    if (!days.has(yKey)) return 0;
  }
  let n = 0;
  const cur = new Date();
  for (let i = 0; i < 400; i++) {
    const k = cur.getFullYear() + '-' + (cur.getMonth() + 1) + '-' + cur.getDate();
    if (!days.has(k)) break;
    n++;
    cur.setDate(cur.getDate() - 1);
  }
  return n;
}

/** 最近 7 天平均情绪分（无记录返回 0） */
function calcAvg7(logs: MoodLog[]): number {
  const cut = Date.now() - 7 * 864e5;
  const recent = logs.filter(l => l.at >= cut);
  if (!recent.length) return 0;
  return Math.round((recent.reduce((a, l) => a + (Number(l.score) || 0), 0) / recent.length) * 10) / 10;
}

/* ---------------- 聚合视图 ---------------- */

function safeCase(): any | null {
  try { return R().case.get(); } catch (e) { return null; }
}
function hasCase(c: any): boolean {
  if (!c) return false;
  return !!(c.story || (c.tarot && c.tarot.length) || (c.analystLog && c.analystLog.length) ||
    (c.assoc && c.assoc.some((a: any) => a && a.resp)) ||
    (c.sct && c.sct.some((s: any) => s && s.a)));
}

export const profile = {
  KEY,

  /* 新功能的命名空间 */
  get: subGet,
  set: subSet,
  del(k: string) {
    const box = read<Record<string, unknown>>(KEY, {});
    if (box && typeof box === 'object' && !Array.isArray(box)) { delete box[k]; return write(KEY, box); }
    return true;
  },

  /* ---- 写入各类新数据 ---- */

  savePersonality(p: Personality) { return subSet('personality', p); },
  personality(): Personality | null { return subGet<Personality | null>('personality', null); },

  addDraw(d: Omit<TarotDraw, 'id' | 'at'> & {at?: number}): TarotDraw | null {
    const list = subGet<TarotDraw[]>('tarotDraws', []);
    const rec: TarotDraw = {
      id: 'td-' + (Date.now().toString(36)) + Math.random().toString(36).slice(2, 6),
      at: d.at || Date.now(),
      spread: d.spread, domain: d.domain, question: d.question,
      cards: d.cards
    };
    const next = arr<TarotDraw>(list).concat([rec]).slice(-200);
    return subSet('tarotDraws', next) ? rec : null;
  },
  draws(): TarotDraw[] { return arr<TarotDraw>(subGet<TarotDraw[]>('tarotDraws', [])); },

  /** 「你的镜子」：反复出现的牌 / 元素倾向 / 正逆位比例 */
  mirror() {
    const draws = this.draws();
    const cardCount: Record<string, number> = {};
    const elemCount: Record<string, number> = {风: 0, 水: 0, 火: 0, 土: 0};
    let upright = 0, total = 0;
    const arcana = arr<any>((R().tarot && R().tarot.arcana) || []);
    for (const d of draws) {
      for (const c of (d.cards || [])) {
        cardCount[c.id] = (cardCount[c.id] || 0) + 1;
        total++;
        if (c.upright) upright++;
        const card = (R().tarot && R().tarot.byId) ? R().tarot.byId(c.id) : arcana.find(a => a.n === c.id);
        if (card && card.element && card.element in elemCount) elemCount[card.element]++;
      }
    }
    const top = Object.keys(cardCount)
      .map(k => ({id: Number(k), n: cardCount[k]}))
      .sort((a, b) => b.n - a.n)
      .slice(0, 5);
    return {
      total, draws: draws.length,
      top, elements: elemCount,
      uprightRatio: total ? Math.round((upright / total) * 100) / 100 : 0
    };
  },

  /** 情绪打卡：一天一条，同日覆盖 */
  saveMood(log: Omit<MoodLog, 'at'> & {at?: number}): boolean {
    const list = arr<MoodLog>(subGet<MoodLog[]>('moodLogs', []));
    const rec: MoodLog = {...log, at: log.at || Date.now()};
    const next = list.filter(l => l.date !== rec.date).concat([rec])
      .sort((a, b) => a.date < b.date ? -1 : 1).slice(-400);
    return subSet('moodLogs', next);
  },
  moods(): MoodLog[] { return arr<MoodLog>(subGet<MoodLog[]>('moodLogs', [])); },
  todayMood(): MoodLog | null {
    const today = toDateStr(Date.now());
    return this.moods().find(l => l.date === today) || null;
  },

  addThought(t: Omit<ThoughtRecord, 'id' | 'at'> & {at?: number}): ThoughtRecord | null {
    const list = arr<ThoughtRecord>(subGet<ThoughtRecord[]>('thoughts', []));
    const rec: ThoughtRecord = {
      id: 'tr-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      at: t.at || Date.now(), scene: t.scene, thought: t.thought,
      for: t.for, against: t.against, alt: t.alt
    };
    const next = list.concat([rec]).slice(-200);
    return subSet('thoughts', next) ? rec : null;
  },
  thoughts(): ThoughtRecord[] { return arr<ThoughtRecord>(subGet<ThoughtRecord[]>('thoughts', [])); },
  delThought(id: string): boolean {
    return subSet('thoughts', this.thoughts().filter(t => t.id !== id));
  },

  /* ---- 聚合 ---- */

  snapshot(): Snapshot {
    const c = safeCase();
    const dreams = arr<any>(read('dreamLog', []));
    const bbs = read<any>('bbs_v2', null);
    const notes = (bbs && Array.isArray(bbs.notes)) ? bbs.notes.filter((n: any) => n && n.mine) : [];
    const counter = read<any>('counter_v2', null);
    const tickets = (counter && Array.isArray(counter.tickets)) ? counter.tickets : [];
    let items = 0;
    tickets.forEach((t: any) => {
      const it = (t && t.items) || {};
      for (const k in it) if (Number.isInteger(it[k]) && it[k] > 0) items += it[k];
    });
    const stampsRaw = read<Record<string, number>>('stamps', {});
    const stamps = Object.keys(stampsRaw)
      .filter(k => stampsRaw[k])
      .map(k => ({id: k, at: Number(stampsRaw[k]) || 0}))
      .sort((a, b) => b.at - a.at);

    const draws = this.draws();
    const moodLogs = this.moods();
    const p = this.personality();
    const caseTarot = (c && Array.isArray(c.tarot)) ? c.tarot.length : 0;

    return {
      handle: String((c && c.handle) || ''),
      visits: {
        total: read<number>('visits', 0),
        today: (read<any>('visitsToday', null) || {}).n || 0,
        lastAt: read<number>('lastVisit', 0)
      },
      firstAt: Number((c && c.createdAt) || 0),
      caseDoc: hasCase(c) ? c : null,
      verdict: read<any>('verdict', null),
      personality: p,
      tarot: {draws, count: read<number>('stat_tarot', 0) + (caseTarot ? 1 : 0)},
      mood: {logs: moodLogs, streak: calcStreak(moodLogs), avg7: calcAvg7(moodLogs)},
      thoughts: this.thoughts(),
      dreams, notes, stamps,
      counts: {
        orders: tickets.length, items,
        tarot: draws.length,
        dreams: dreams.length,
        notes: notes.length,
        stamps: stamps.length,
        mood: moodLogs.length
      }
    };
  },

  /** 事件流：所有痕迹按时间倒序合成一条时间线 */
  timeline(): Event[] {
    const s = this.snapshot();
    const ev: Event[] = [];
    const R_ = R();

    const stampName = (id: string): string => {
      const defs = arr<any>((R_.stamps && R_.stamps.DEFS) || []);
      const d = defs.find(x => x.id === id);
      return d ? String(d.cn) : id;
    };

    if (s.caseDoc && s.caseDoc.createdAt) {
      ev.push({
        at: Number(s.caseDoc.createdAt), kind: 'order', title: '递交委托',
        detail: String(s.caseDoc.story || '').slice(0, 40)
      });
    }
    s.dreams.forEach(d => {
      ev.push({
        at: Number(d.ts) || Date.parse(d.date) || 0, kind: 'dream',
        title: '记了一个梦', detail: String(d.title || '').slice(0, 40)
      });
    });
    s.stamps.forEach(st => {
      ev.push({at: st.at, kind: 'stamp', title: '获得印章 · ' + stampName(st.id), detail: ''});
    });
    s.mood.logs.forEach(m => {
      ev.push({
        at: m.at, kind: 'mood', title: '情绪打卡 · ' + m.score + '/5',
        detail: (m.tags || []).join(' · ')
      });
    });
    s.tarot.draws.forEach(d => {
      ev.push({
        at: d.at, kind: 'tarot', title: '抽了一次牌',
        detail: (d.cards || []).length + ' 张' + (d.question ? ' · ' + d.question.slice(0, 20) : '')
      });
    });
    if (s.personality && s.personality.at) {
      ev.push({
        at: s.personality.at, kind: 'personality',
        title: '完成性格层析', detail: s.personality.type
      });
    }
    s.thoughts.forEach(t => {
      ev.push({at: t.at, kind: 'thought', title: '记下一条念头', detail: String(t.thought || '').slice(0, 30)});
    });

    return ev.filter(e => e.at > 0).sort((a, b) => b.at - a.at);
  },

  /* ---- 导出 ---- */

  toJSON(): string {
    const s = this.snapshot();
    return JSON.stringify({
      _format: 'radio-club-profile',
      _version: 1,
      _exportedAt: new Date().toISOString(),
      handle: s.handle,
      visits: s.visits,
      personality: s.personality,
      tarot: {count: s.counts.tarot, draws: s.tarot.draws, mirror: this.mirror()},
      mood: s.mood,
      thoughts: s.thoughts,
      dreams: s.dreams,
      counts: s.counts,
      stamps: s.stamps
    }, null, 2);
  },

  toMarkdown(): string {
    const s = this.snapshot();
    const R_ = R();
    const cardName = (id: number): string => {
      const card = (R_.tarot && R_.tarot.byId) ? R_.tarot.byId(id) : null;
      return card ? String(card.cn || card.jp || id) : '#' + id;
    };
    const L: string[] = [];
    L.push('# 梦侦探档案' + (s.handle ? ' · ' + s.handle : ''));
    L.push('');
    L.push('> 生成于 ' + fmt(Date.now()) + '　｜　RADIO CLUB · MODEL RC-2006');
    L.push('> 全部数据来自本机浏览器，未上传。');
    L.push('');

    L.push('## 概览');
    L.push('');
    L.push('| 项目 | 数量 |');
    L.push('|---|---|');
    L.push('| 到店 | ' + s.visits.total + ' 次（今日 ' + s.visits.today + '） |');
    L.push('| 鉴定书 | ' + (s.verdict ? 1 : 0) + ' 份 |');
    L.push('| 抽牌 | ' + s.counts.tarot + ' 次 |');
    L.push('| 记录梦境 | ' + s.counts.dreams + ' 则 |');
    L.push('| 情绪打卡 | ' + s.counts.mood + ' 天（连续 ' + s.mood.streak + ' 天） |');
    L.push('| 念头记录 | ' + s.thoughts.length + ' 条 |');
    L.push('| 印章 | ' + s.counts.stamps + ' 枚 |');
    L.push('');

    if (s.personality) {
      const p = s.personality;
      L.push('## 性格层析 · ' + p.type);
      L.push('');
      L.push('测于 ' + fmt(p.at));
      L.push('');
      const AXES: [string, string, string][] = [['EI', 'E 外向', 'I 内向'], ['SN', 'S 实感', 'N 直觉'], ['TF', 'T 思考', 'F 情感'], ['JP', 'J 判断', 'P 感知']];
      AXES.forEach(([k, l, r]) => {
        const v = Number(p.dims && p.dims[k]);
        if (isNaN(v)) return;
        const pct = Math.round(Math.abs(v - 0.5) * 200);
        const side = v >= 0.5 ? l : r;
        const balanced = p.balanced && p.balanced[k] ? '（基本持平，不强行归类）' : '';
        L.push('- ' + k + '：' + side + ' ' + pct + '%' + balanced);
      });
      L.push('');
    }

    const m = this.mirror();
    if (m.draws) {
      L.push('## 你的镜子');
      L.push('');
      L.push('- 共抽牌 ' + m.draws + ' 次，翻开 ' + m.total + ' 张');
      L.push('- 正位占比 ' + Math.round(m.uprightRatio * 100) + '%');
      const elems = Object.keys(m.elements).filter(k => m.elements[k] > 0);
      if (elems.length) {
        L.push('- 元素倾向：' + elems.map(k => k + ' ' + m.elements[k]).join('　'));
      }
      if (m.top.length) {
        L.push('- 反复出现：' + m.top.map(t => cardName(t.id) + '×' + t.n).join('、'));
      }
      L.push('');
    }

    if (s.mood.logs.length) {
      L.push('## 情绪记录');
      L.push('');
      s.mood.logs.slice(-14).forEach(l => {
        L.push('- ' + l.date + '　' + '●'.repeat(l.score) + '○'.repeat(Math.max(0, 5 - l.score)) +
          (l.tags && l.tags.length ? '　' + l.tags.join('、') : ''));
      });
      L.push('');
    }

    if (s.dreams.length) {
      L.push('## 梦境日志');
      L.push('');
      s.dreams.slice().sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0)).forEach(d => {
        L.push('### ' + (d.date || '') + (d.title ? '　' + d.title : ''));
        if (d.mood) L.push('*心情：' + d.mood + (d.tag ? ' · ' + d.tag : '') + '*');
        L.push('');
        L.push(String(d.body || '').trim());
        L.push('');
      });
    }

    if (s.thoughts.length) {
      L.push('## 念头记录');
      L.push('');
      s.thoughts.slice().reverse().forEach(t => {
        L.push('### ' + fmt(t.at));
        L.push('- 情境：' + t.scene);
        L.push('- 念头：' + t.thought);
        if (t.for) L.push('- 支持：' + t.for);
        if (t.against) L.push('- 反对：' + t.against);
        if (t.alt) L.push('- 替代想法：' + t.alt);
        L.push('');
      });
    }

    const tl = this.timeline();
    if (tl.length) {
      L.push('## 时间线');
      L.push('');
      tl.slice(0, 40).forEach(e => {
        L.push('- ' + fmt(e.at) + '　' + e.title + (e.detail ? '　—　' + e.detail : ''));
      });
      L.push('');
    }

    L.push('---');
    L.push('');
    L.push('*本档案由《梦侦探鉴定机 MODEL RC-2006》生成。性格层析是一种自我叙述的框架，不是心理诊断。*');
    L.push('');
    return L.join('\n');
  },

  has(): boolean {
    const s = this.snapshot();
    return !!(s.visits.total || s.counts.tarot || s.counts.dreams || s.counts.mood ||
      s.counts.notes || s.counts.stamps || s.personality || s.verdict);
  }
};

if (typeof window !== 'undefined') {
  const w = window as any;
  w.RC = w.RC || {};
  w.RC.profile = profile;
}

export default profile;
