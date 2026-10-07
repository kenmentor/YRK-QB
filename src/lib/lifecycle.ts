import { normalize, type DraftStatus } from "./types";

const TRANSITIONS: Record<DraftStatus, DraftStatus[]> = {
  draft: ["in_review"],
  in_review: ["approved", "changes_requested", "draft"],
  approved: ["merged", "in_review", "draft"],
  changes_requested: ["draft", "in_review"],
  merged: []
};

export function canTransition(from: DraftStatus, to: DraftStatus): boolean {
  return (TRANSITIONS[from] ?? []).includes(to);
}

export function assertTransition(from: DraftStatus, to: DraftStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid transition ${from} -> ${to}`);
  }
}

export function findDuplicate(stem: string, existingNormStems: string[]): string | null {
  const norm = normalize(stem);
  for (const s of existingNormStems) {
    if (s === norm) return s;
  }
  return null;
}

export function gradeAnswer(questionCorrect: string[], given: string[], type: string): boolean {
  if (type === "stem") return false; // stimuli never score
  if (type === "essay" || type === "short_answer") {
    // Theory is self-marked: counts as answered; correct if substantive attempt.
    return (given.join(" ").trim().length >= 3);
  }
  if (type === "saq") {
    // Any accepted alternative counts (correct holds the alternatives).
    const g = (given[0] ?? "").trim().toLowerCase();
    return !!g && questionCorrect.some((c) => c.trim().toLowerCase() === g);
  }
  if (type === "sct") {
    // Expert panel choice must match exactly.
    return (given[0] ?? "").trim() === (questionCorrect[0] ?? "").trim() && !!(given[0] ?? "").trim();
  }
  if (type === "mtf" || type === "emq" || type === "matching") {
    // Per-part answers aligned to parts; ordered, case-insensitive.
    if (given.length !== questionCorrect.length) return false;
    return questionCorrect.every((c, i) => (given[i] ?? "").trim().toLowerCase() === c.trim().toLowerCase());
  }
  if (type === "kfq" || type === "meq" || type === "compound") {
    // Per-part accepted alternatives ("a||b").
    if (given.length !== questionCorrect.length) return false;
    return questionCorrect.every((c, i) => {
      const g = (given[i] ?? "").trim().toLowerCase();
      return !!g && c.split("||").map((x) => x.trim().toLowerCase()).includes(g);
    });
  }
  if (type === "fill_in") {
    // Gaps are ordered, compare position by position, case-insensitive.
    if (given.length !== questionCorrect.length) return false;
    return questionCorrect.every((c, i) => (given[i] ?? "").trim().toLowerCase() === c.trim().toLowerCase());
  }
  const normArr = (arr: string[]) => arr.map((s) => s.trim().toLowerCase()).sort().join("|");
  return normArr(given) === normArr(questionCorrect);
}

// Smart default marks: one per scorable unit, essay weight, hard bonus.
export function suggestMarks(args: {
  type: string;
  correct?: string[];
  parts?: { max?: number }[];
  difficultyIndex?: number;
}): number {
  const { type, correct = [], parts = [], difficultyIndex = 3 } = args;
  let base: number;
  if (isRubricType(type)) base = Math.max(1, rubricTotal(parts));
  else if (type === "essay") base = 5;
  else if (type === "mtf" || type === "emq" || type === "matching" || type === "kfq" || type === "meq" || type === "compound") base = Math.max(1, parts.length);
  else if (type === "multi_select") base = Math.max(1, correct.length);
  else if (type === "stem") base = 0;
  else base = 1;
  if (base > 0 && difficultyIndex >= 4 && type !== "essay" && !isRubricType(type)) base += 1;
  return Math.max(0, base);
}
export const RUBRIC_TYPES = ["osce", "dops", "minicex", "msf", "viva"];

export function isRubricType(type: string): boolean {
  return RUBRIC_TYPES.includes(type);
}

export function rubricTotal(parts: { max?: number }[]): number {
  return parts.reduce((s, p) => s + (Number(p.max) || 0), 0);
}

// ok at half marks or better.
export function rubricOk(score: number, total: number): boolean {
  if (total <= 0) return false;
  return score >= total / 2;
}

// Per-option marks: fine / most-correct options earn partial credit, wrong
// default to 0, fully-correct takes the max. Empty (or all-zero) weights =
// legacy binary. Returns -1 for types that are not option-weighted (caller
// falls back).
export function gradeMarks(args: {
  type: string;
  options: string[];
  correct: string[];
  given: string[];
  optionMarks?: number[];
  max: number;
}): number {
  const { type, options, correct, given, optionMarks = [], max } = args;
  const clamp = (v: number) => Math.min(max, Math.max(0, v));
  const normEq = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const isCorrect = (v: string) => correct.some((c) => normEq(c, v));
  const weightOf = (value: string): number | null => {
    let i = options.indexOf(value);
    if (i < 0) i = options.findIndex((o) => normEq(o, value));
    if (i < 0 || i >= optionMarks.length) return null;
    return optionMarks[i] ?? null;
  };
  // No positive weights anywhere = legacy binary grading (correct takes max).
  const hasWeights = optionMarks.some((w) => (w || 0) > 0);
  if (type === "mcq" || type === "true_false" || type === "sct") {
    const g = (given[0] ?? "").trim();
    if (!g) return 0;
    if (!hasWeights) return isCorrect(g) ? max : 0;
    const w = weightOf(given[0] ?? "");
    if (w != null) return clamp(w);
    return isCorrect(g) ? max : 0;
  }
  if (type === "multi_select") {
    if (!hasWeights) {
      // Legacy: exact set or nothing.
      const normArr = (arr: string[]) => arr.map((s) => s.trim().toLowerCase()).sort().join("|");
      return normArr(given) === normArr(correct) ? max : 0;
    }
    let sum = 0;
    for (const gv of given) {
      const w = weightOf(gv);
      if (w != null) sum += w;
      else if (correct.includes(gv)) sum += max;
    }
    return clamp(sum);
  }
  return -1;
}
