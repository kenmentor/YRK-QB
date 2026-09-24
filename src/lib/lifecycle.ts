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
  if (type === "fill_in") {
    // Gaps are ordered, compare position by position, case-insensitive.
    if (given.length !== questionCorrect.length) return false;
    return questionCorrect.every((c, i) => (given[i] ?? "").trim().toLowerCase() === c.trim().toLowerCase());
  }
  const normArr = (arr: string[]) => arr.map((s) => s.trim().toLowerCase()).sort().join("|");
  return normArr(given) === normArr(questionCorrect);
}
