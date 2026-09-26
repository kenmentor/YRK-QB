import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, getMembership } from "@/lib/auth";
import { assertCanEdit } from "@/lib/permissions";
import { rateLimited } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  if (rateLimited(req, "drafts", 60, 60 * 1000)) {
    return NextResponse.json({ error: "Slow down, too many drafts" }, { status: 429 });
  }
  const body = await req.json();
  const role = await getMembership(user.id, body.workspaceId);
  try { assertCanEdit(role); } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 403 }); }
  const draft = await db.questionDraft.create({
    data: {
      workspaceId: body.workspaceId, authorId: user.id,
      topicId: body.topicId ?? null, type: body.type ?? "mcq",
      stem: body.stem ?? "", options: JSON.stringify(body.options ?? []),
      correct: JSON.stringify(body.correct ?? []),
      parts: typeof body.parts === "string" ? body.parts : JSON.stringify(body.parts ?? []),
      explanation: body.explanation ?? "",
      difficulty: body.difficulty ?? "medium",
      difficultyIndex: body.difficultyIndex ?? 3,
      category: body.category ?? "tertiary", sector: body.sector ?? "",
      mediaUrl: body.mediaUrl ?? "",
      tags: JSON.stringify(body.tags ?? []),
      // Revision loop: editing a published bank question starts a draft
      // linked to it; merging updates the canonical instead of duplicating.
      revisionOf: body.revisionOf ?? null
    }
  });
  await db.questionVersion.create({
    data: { draftId: draft.id, authorId: user.id, stem: draft.stem, options: draft.options, correct: draft.correct, explanation: draft.explanation, note: "initial" }
  });
  return NextResponse.json(draft, { status: 201 });
}

export async function GET(req: Request) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");
  if (workspaceId) {
    if (!(await getMembership(user.id, workspaceId))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const drafts = await db.questionDraft.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" }, take: 100 });
    return NextResponse.json(drafts);
  }
  // No workspace filter: only drafts from my own workspaces, never the bank's.
  const mine = (await db.membership.findMany({ where: { userId: user.id } }) as unknown as { workspaceId: string }[]);
  const out = [];
  for (const m of mine.slice(0, 20)) {
    out.push(...((await db.questionDraft.findMany({ where: { workspaceId: m.workspaceId }, take: 50 }) as unknown as unknown[])));
  }
  return NextResponse.json(out);
}
