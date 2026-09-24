export type Role = "owner" | "editor" | "reviewer";
export type DraftStatus = "draft" | "in_review" | "approved" | "changes_requested" | "merged";
export type QuestionType = "mcq" | "multi_select" | "true_false" | "fill_in";
export type MergeType = "approve_to_live" | "deduplicate" | "set_publish";

export interface QuestionPayload {
  type: QuestionType;
  stem: string;
  options: string[];
  correct: string[];
  explanation: string;
  difficulty?: string;
  tags?: string[];
  imageUrl?: string;
}

export function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeStem(stem: string): string {
  return normalize(stem);
}
