import type { Role } from "./types";

export function canEdit(role: Role | undefined): boolean {
  return role === "owner" || role === "editor";
}

export function canReview(role: Role | undefined): boolean {
  return role === "owner" || role === "reviewer";
}

export function canMerge(role: Role | undefined): boolean {
  return role === "owner";
}

export function canInvite(role: Role | undefined): boolean {
  return role === "owner";
}

export function assertCanEdit(role: Role | undefined): void {
  if (!canEdit(role)) {
    const err = new Error("Reviewers cannot edit directly. Leave a comment or change request instead.");
    (err as Error & { code: string }).code = "FORBIDDEN_REVIEWER_EDIT";
    throw err;
  }
}
