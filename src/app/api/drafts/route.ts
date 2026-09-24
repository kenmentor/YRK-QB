import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, getMembership } from "@/lib/auth";
import { assertCanEdit } from "@/lib/permissions";

export async function POST(req: Request) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const body = await req.json();
  const role = await getMembership(user.id, body.workspaceId);
  try { assertCanEdit(role); } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 403 }); }
  const draft = await db.questionDraft.create({
    data: {
      workspaceId: body.workspaceId, authorId: user.id,
      topicId: body.topicId ?? null, type: body.type ?? "mcq",
      stem: body.stem ?? "", options: JSON.stringify(body.options ?? []),
      correct: JSON.stringify(body.correct ?? []), explanation: body.explanation ?? "",
      difficulty: body.difficulty ?? "medium", tags: JSON.stringify(body.tags ?? [])
    }
  });
  await db.questionVersion.create({
    data: { draftId: draft.id, authorId: user.id, stem: draft.stem, options: draft.options, correct: draft.correct, explanation: draft.explanation, note: "initial" }
  });
  return NextResponse.json(draft, { status: 201 });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");
  const drafts = await db.questionDraft.findMany({ where: workspaceId ? { workspaceId } : {}, orderBy: { updatedAt: "desc" }, take: 100 });
  return NextResponse.json(drafts);
}
