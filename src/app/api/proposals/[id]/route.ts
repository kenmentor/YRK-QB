import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { validateQuestion } from "@/lib/validation";

export const dynamic = "force-dynamic";

// Edit my pending proposal (payload/message). Decided ones are history.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const p = (await db.proposal.findUnique({ where: { id: params.id } }) as unknown as {
    id: string; contributorId: string; status: string; subjectId: string;
  } | null);
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (p.contributorId !== user.id) return NextResponse.json({ error: "Yours only" }, { status: 403 });
  if (p.status !== "pending") return NextResponse.json({ error: "Already decided — can't edit" }, { status: 409 });
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.payload) {
    const pl = body.payload as { type: string; stem: string; options: string[]; correct: string[]; explanation: string; difficulty: string; topicId?: string };
    const parsed = validateQuestion({ type: pl.type, stem: pl.stem, options: pl.options ?? [], correct: pl.correct ?? [], explanation: pl.explanation, difficulty: (pl.difficulty ?? "medium") as "easy" | "medium" | "hard", tags: [] });
    if (!parsed.success) return NextResponse.json({ error: "Edits must stay valid", issues: parsed.error.issues }, { status: 422 });
    if (pl.topicId) {
      const topic = (await db.topic.findUnique({ where: { id: pl.topicId } }) as unknown as { subjectId: string } | null);
      if (!topic || topic.subjectId !== p.subjectId) {
        return NextResponse.json({ error: "Topic doesn't belong to this subject" }, { status: 422 });
      }
    }
    data.payload = JSON.stringify(body.payload);
  }
  if (body.message !== undefined) data.message = body.message;
  const updated = await db.proposal.update({ where: { id: p.id }, data });
  return NextResponse.json(updated);
}

// Withdraw my pending proposal.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const p = (await db.proposal.findUnique({ where: { id: params.id } }) as unknown as {
    id: string; contributorId: string; status: string;
  } | null);
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (p.contributorId !== user.id) return NextResponse.json({ error: "Yours only" }, { status: 403 });
  if (p.status !== "pending") return NextResponse.json({ error: "Already decided" }, { status: 409 });
  await db.proposal.delete({ where: { id: p.id } });
  return NextResponse.json({ ok: true });
}
