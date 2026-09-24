import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, getMembership } from "@/lib/auth";
import { rateLimited } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

async function memberWorkspace(userId: string, draftId: string) {
  const draft = (await db.questionDraft.findUnique({ where: { id: draftId } }) as unknown as { workspaceId: string } | null);
  if (!draft) return null;
  if (!(await getMembership(userId, draft.workspaceId))) return null;
  return draft;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  if (rateLimited(req, "comments", 30, 60 * 1000)) {
    return NextResponse.json({ error: "Slow down, too many comments" }, { status: 429 });
  }
  if (!(await memberWorkspace(user.id, params.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { body: text } = await req.json();
  if (!text || String(text).trim().length < 1 || String(text).length > 2000) {
    return NextResponse.json({ error: "Comment must be 1–2000 characters" }, { status: 422 });
  }
  const comment = await db.comment.create({ data: { draftId: params.id, authorId: user.id, body: String(text).trim() } });
  return NextResponse.json(comment, { status: 201 });
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  if (!(await memberWorkspace(user.id, params.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const comments = await db.comment.findMany({ where: { draftId: params.id }, orderBy: { createdAt: "asc" } });
  return NextResponse.json(comments);
}
