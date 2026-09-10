/* ============================================================
   personality.ts — 性格层析计分
   ------------------------------------------------------------
   四维 · 二选一迫选。每维 7 题，按 A 端票数定字母与强度。

   强度分三级，用于「如实标注边界型」：
     clear    7:0 / 6:1   倾向明确
     moderate 5:2         倾向清楚
     slight   4:3         两边都能待 —— 不硬贴标签
   ============================================================ */

export interface Pair {
  cn: string;
  jp: string;
}
export interface DimDef {
  k: string;
  a: string;
  b: string;
  aName: Pair;
  bName: Pair;
  aDesc: Pair;
  bDesc: Pair;
}
export interface Item {
  dim: string;
  a: Pair;
  b: Pair;
}
export interface TypeDef {
  cn: string;
  jp: string;
  note: Pair;
}
export interface Content {
  dims: DimDef[];
  items: Item[];
  types: Record<string, TypeDef>;
}

export type Answer = 0 | 1 | null;
export type Strength = 'clear' | 'moderate' | 'slight';

export interface AxisResult {
  k: string;
  a: string;
  b: string;
  aCount: number;
  bCount: number;
  total: number;
  /** 偏向前一个字母的比例 0~1 */
  ratio: number;
  letter: string;
  /** 偏向明显的那一端占该维度题量的百分比，如 71 */
  pct: number;
  strength: Strength;
  balanced: boolean;
}

export interface Result {
  type: string;
  /** 各维 ratio（供档案层存 dims） */
  dims: Record<string, number>;
  balanced: Record<string, boolean>;
  axes: AxisResult[];
  answered: number;
  total: number;
  at: number;
}

/** 读取构建期打进 content-bundle 的题库 */
export function getContent(): Content {
  const raw = (typeof window !== 'undefined' && (window as any).RC_CONTENT && (window as any).RC_CONTENT.personality) || {};
  return {
    dims: Array.isArray(raw.dims) ? raw.dims : [],
    items: Array.isArray(raw.items) ? raw.items : [],
    types: (raw.types && typeof raw.types === 'object') ? raw.types : {}
  };
}

function strengthOf(majority: number, total: number): Strength {
  if (total <= 1) return 'clear';
  if (majority >= total - 1) return 'clear';
  if (majority >= total - 2) return 'moderate';
  return 'slight';
}

/** 计分：answers[i] = 0（选前一句）/ 1（选后一句）/ null（未答） */
export function score(answers: Answer[], content?: Content): Result {
  const c = content || getContent();
  const dims: Record<string, number> = {};
  const balanced: Record<string, boolean> = {};
  const axes: AxisResult[] = [];
  let type = '';
  let answered = 0;

  c.dims.forEach((d) => {
    let aCount = 0, bCount = 0;
    c.items.forEach((it, i) => {
      if (it.dim !== d.k) return;
      const ans = answers[i];
      if (ans === 0) aCount++;
      else if (ans === 1) bCount++;
    });
    const total = aCount + bCount;
    answered += total;
    const ratio = total ? aCount / total : 0.5;
    const letter = ratio > 0.5 ? d.a : (ratio < 0.5 ? d.b : d.a);
    const majority = Math.max(aCount, bCount);
    const strength = strengthOf(majority, total || 1);
    dims[d.k] = ratio;
    balanced[d.k] = strength === 'slight';
    axes.push({
      k: d.k, a: d.a, b: d.b, aCount, bCount, total,
      ratio, letter,
      pct: total ? Math.round((majority / total) * 100) : 50,
      strength,
      balanced: strength === 'slight'
    });
    type += letter;
  });

  return {type, dims, balanced, axes, answered, total: c.items.length, at: Date.now()};
}

/** 该字母指向的文字（如 'I' → 内向） */
export function letterName(k: string, letter: string, content?: Content): Pair {
  const c = content || getContent();
  const d = c.dims.find(x => x.k === k);
  if (!d) return {cn: letter, jp: letter};
  return letter === d.a ? d.aName : d.bName;
}

export function typeInfo(code: string, content?: Content): TypeDef {
  const c = content || getContent();
  return c.types[code] || {cn: code, jp: code, note: {cn: '', jp: ''}};
}

if (typeof window !== 'undefined') {
  const w = window as any;
  w.RC = w.RC || {};
  w.RC.personality = {getContent, score, letterName, typeInfo};
}

export default {getContent, score, letterName, typeInfo};
