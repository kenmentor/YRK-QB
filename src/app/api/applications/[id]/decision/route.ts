import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Creator approves/rejects an edit application. Body: { decision: "approved" | "rejected" }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const app = (await db.editApplication.findUnique({ where: { id: params.id } }) as unknown as {
    id: string; questionId: string; applicantId: string; status: string;
  } | null);
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const q = (await db.question.findUnique({ where: { id: app.questionId } }) as unknown as { creatorId?: string; editorIds?: string } | null);
  if (!q) return NextResponse.json({ error: "Question gone" }, { status: 404 });
  if (q.creatorId !== user.id) return NextResponse.json({ error: "Only the creator decides" }, { status: 403 });
  const { decision } = await req.json();
  if (!["approved", "rejected"].includes(decision)) return NextResponse.json({ error: "Bad decision" }, { status: 400 });
  await db.editApplication.update({ where: { id: app.id }, data: { status: decision } });
  if (decision === "approved") {
    let ids: string[] = [];
    try { ids = JSON.parse(q.editorIds ?? "[]") as string[]; } catch { ids = []; }
    if (!ids.includes(app.applicantId)) ids.push(app.applicantId);
    await db.question.update({ where: { id: app.questionId }, data: { editorIds: JSON.stringify(ids) } });
  }
  return NextResponse.json({ ok: true, decision });
}
