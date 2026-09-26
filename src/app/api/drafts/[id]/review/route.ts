import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, getMembership } from "@/lib/auth";
import { validateQuestion } from "@/lib/validation";
import { assertTransition } from "@/lib/lifecycle";
import { canEdit } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function badTransition(from: string, to: string) {
  return NextResponse.json({ error: `Cannot move from ${from} to ${to}` }, { status: 400 });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const draft = (await db.questionDraft.findUnique({ where: { id: params.id } }) as unknown as {
    id: string; workspaceId: string; authorId: string; type: string; stem: string; options: string; correct: string;
    explanation: string; difficulty: string; tags: string; status: string; parts?: string;
    difficultyIndex?: number; category?: string; sector?: string; mediaUrl?: string;
  } | null);
  if (!draft) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const role = await getMembership(user.id, draft.workspaceId);
  if (!role) return NextResponse.json({ error: "Not a member of this workspace" }, { status: 403 });
  const { action, comment, verdict } = await req.json();

  if (action === "request") {
    if (!canEdit(role)) return NextResponse.json({ error: "Only editors/owners send drafts for review" }, { status: 403 });
    const parsed = validateQuestion({
      type: draft.type, stem: draft.stem, options: JSON.parse(draft.options), correct: JSON.parse(draft.correct),
      parts: (() => { try { return JSON.parse(draft.parts ?? "[]"); } catch { return []; } })(),
      explanation: draft.explanation, difficulty: draft.difficulty as "easy" | "medium" | "hard",
      difficultyIndex: draft.difficultyIndex ?? 3, category: draft.category ?? "tertiary",
      sector: draft.sector ?? "", mediaUrl: draft.mediaUrl ?? "", tags: JSON.parse(draft.tags),
    });
    if (!parsed.success) return NextResponse.json({ error: "Fix validation before review", issues: parsed.error.issues }, { status: 422 });
    try {
      assertTransition(draft.status as "draft", "in_review");
    } catch { return badTransition(draft.status, "in_review"); }
    // Freeze the latest version id as the true review snapshot.
    const versions = (await db.questionVersion.findMany({ where: { draftId: draft.id } }) as unknown as { id: string }[]);
    const updated = await db.questionDraft.update({ where: { id: draft.id }, data: { status: "in_review", reviewSnapshotId: versions[0]?.id ?? draft.id } });
    return NextResponse.json(updated);
  }
  if (role !== "reviewer" && role !== "owner") return NextResponse.json({ error: "Only reviewer/owner can review, this is good, commit needs professor sign-off" }, { status: 403 });
  // No self-approval while a reviewer exists on the team: the author can't
  // sign off their own draft. Solo workspaces (no reviewer yet) stay unblocked.
  if (user.id === draft.authorId) {
    const members = (await db.membership.findMany({ where: { workspaceId: draft.workspaceId } }) as unknown as { userId: string; role: string }[]);
    if (members.some((m) => m.role === "reviewer" && m.userId !== user.id)) {
      return NextResponse.json({ error: "Authors can't approve their own draft, ask your reviewer" }, { status: 403 });
    }
  }
  if (verdict === "approved") {
    try {
      assertTransition(draft.status as "in_review", "approved");
    } catch { return badTransition(draft.status, "approved"); }
    await db.review.create({ data: { draftId: draft.id, reviewerId: user.id, verdict: "approved", comment: comment ?? "Looks good, approved" } });
    const updated = await db.questionDraft.update({ where: { id: draft.id }, data: { status: "approved" } });
    return NextResponse.json(updated);
  }
  try {
    assertTransition(draft.status as "in_review", "changes_requested");
  } catch { return badTransition(draft.status, "changes_requested"); }
  await db.review.create({ data: { draftId: draft.id, reviewerId: user.id, verdict: "changes_requested", comment: comment ?? "changes requested" } });
  const updated = await db.questionDraft.update({ where: { id: draft.id }, data: { status: "changes_requested" } });
  return NextResponse.json(updated);
}
