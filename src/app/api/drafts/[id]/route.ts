import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, getMembership } from "@/lib/auth";
import { assertCanEdit } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const draft = (await db.questionDraft.findUnique({ where: { id: params.id } }) as unknown as {
    id: string; workspaceId: string; status: string; stem: string; options: string; correct: string; explanation: string; difficulty: string; topicId?: string; conflictBranch: boolean;
  } | null);
  if (!draft) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const role = await getMembership(user.id, draft.workspaceId);
  try { assertCanEdit(role); } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 403 }); }
  if (draft.status === "in_review" || draft.status === "merged") {
    return NextResponse.json({ error: `Cannot edit while ${draft.status}` }, { status: 409 });
  }
  const body = await req.json();
  const versions = (await db.questionVersion.findMany({ where: { draftId: params.id } }) as unknown as { id: string }[]);
  const latestId = versions[0]?.id;
  const conflict = body.baseVersionId && latestId && body.baseVersionId !== latestId;
  const updated = await db.questionDraft.update({
    where: { id: params.id },
    data: {
      stem: body.stem ?? draft.stem, options: body.options ? JSON.stringify(body.options) : draft.options,
      correct: body.correct ? JSON.stringify(body.correct) : draft.correct,
      parts: body.parts !== undefined ? (typeof body.parts === "string" ? body.parts : JSON.stringify(body.parts)) : (draft as { parts?: string }).parts ?? "[]",
      explanation: body.explanation ?? draft.explanation,
      difficulty: body.difficulty ?? draft.difficulty,
      difficultyIndex: body.difficultyIndex ?? (draft as { difficultyIndex?: number }).difficultyIndex ?? 3,
      category: body.category ?? (draft as { category?: string }).category ?? "tertiary",
      sector: body.sector ?? (draft as { sector?: string }).sector ?? "",
      mediaUrl: body.mediaUrl ?? (draft as { mediaUrl?: string }).mediaUrl ?? "",
      topicId: body.topicId !== undefined ? body.topicId : draft.topicId,
      ...(body.type ? { type: body.type } : {}),
      status: "draft",
      conflictBranch: conflict ? true : draft.conflictBranch
    }
  });
  const version = await db.questionVersion.create({
    data: { draftId: params.id, authorId: user.id, stem: (updated as { stem: string }).stem, options: (updated as { options: string }).options, correct: (updated as { correct: string }).correct, explanation: (updated as { explanation: string }).explanation, note: conflict ? "branch (conflict)" : (body.note ?? "edit") }
  });
  return NextResponse.json({ draft: updated, version, conflict: !!conflict });
}

// Delete a draft with its versions/comments/reviews. Owner, or the author
// while it's still pre-review (draft/changes_requested). Merged or
// in-review drafts are history, they can't be deleted.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const draft = (await db.questionDraft.findUnique({ where: { id: params.id } }) as unknown as { workspaceId: string; authorId: string; status: string } | null);
  if (!draft) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const role = await getMembership(user.id, draft.workspaceId);
  const canDelete = role === "owner" || (user.id === draft.authorId && (draft.status === "draft" || draft.status === "changes_requested"));
  if (!canDelete) return NextResponse.json({ error: "Only the owner (or author pre-review) deletes drafts" }, { status: 403 });
  if (draft.status === "in_review" || draft.status === "merged") {
    return NextResponse.json({ error: `Cannot delete while ${draft.status}` }, { status: 409 });
  }
  await db.questionVersion.deleteMany({ where: { draftId: params.id } });
  await db.comment.deleteMany({ where: { draftId: params.id } });
  await db.review.deleteMany({ where: { draftId: params.id } });
  await db.questionDraft.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const draft = (await db.questionDraft.findUnique({ where: { id: params.id } }) as unknown as { workspaceId: string } | null);
  if (!draft) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await getMembership(user.id, draft.workspaceId))) {
    return NextResponse.json({ error: "Not a member of this workspace" }, { status: 403 });
  }
  const full = await db.questionDraft.findUnique({ where: { id: params.id } });
  if (!full) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const versions = await db.questionVersion.findMany({ where: { draftId: params.id } });
  const comments = await db.comment.findMany({ where: { draftId: params.id } });
  const reviews = await db.review.findMany({ where: { draftId: params.id } });
  return NextResponse.json({ draft: full, versions, comments, reviews });
}
