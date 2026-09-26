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

// Rubric (examiner-scored) formats: self/peer-scored in v1 via manual totals.
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
