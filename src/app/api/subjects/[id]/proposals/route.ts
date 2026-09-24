import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { rateLimited } from "@/lib/ratelimit";

// Create a contribution proposal on a subject. Body:
// { kind: "new_question", payload: {type,stem,options,correct,explanation,difficulty,topicId}, message, termsAccepted: true }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  if (rateLimited(req, "proposals", 20, 60 * 1000)) {
    return NextResponse.json({ error: "Slow down, too many proposals at once" }, { status: 429 });
  }
  const subject = await db.subject.findUnique({ where: { id: params.id } });
  if (!subject) return NextResponse.json({ error: "Subject not found" }, { status: 404 });
  const body = await req.json();
  if (!body.termsAccepted) return NextResponse.json({ error: "Read and accept the terms first" }, { status: 400 });
  const p = body.payload ?? {};
  if (!p.stem || String(p.stem).trim().length < 8) return NextResponse.json({ error: "Stem needs 8+ characters" }, { status: 422 });
  if (!p.explanation || String(p.explanation).trim().length < 4) return NextResponse.json({ error: "Explanation / guide required" }, { status: 422 });
  // The topic must actually belong to this subject, no filing Mechanics
  // questions under Cardio.
  if (p.topicId) {
    const topic = (await db.topic.findUnique({ where: { id: p.topicId } }) as unknown as { subjectId: string } | null);
    if (!topic || topic.subjectId !== params.id) {
      return NextResponse.json({ error: "Topic doesn't belong to this subject" }, { status: 422 });
    }
  }
  const proposal = await db.proposal.create({
    data: {
      subjectId: params.id, contributorId: user.id, kind: body.kind ?? "new_question",
      questionId: body.questionId ?? null,
      payload: JSON.stringify({ type: p.type ?? "mcq", stem: p.stem, options: p.options ?? [], correct: p.correct ?? [], explanation: p.explanation, difficulty: p.difficulty ?? "medium", topicId: p.topicId ?? null }),
      message: body.message ?? "", status: "pending", adminMessage: ""
    }
  });
  // notify all admins
  const admins = (await db.user.findMany({ where: { role: "admin" } }) as unknown as { id: string }[]);
  const me = (await db.user.findUnique({ where: { id: user.id } }) as unknown as { name: string });
  for (const a of admins) {
    await db.notification.create({
      data: { userId: a.id, kind: "proposal", title: "New contribution to review", body: `${me?.name ?? "Someone"} proposed a question, review and commit or cancel.`, link: "/admin/reviews", read: false }
    });
  }
  return NextResponse.json(proposal, { status: 201 });
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const all = (await db.proposal.findMany({ where: { subjectId: params.id } }) as unknown as { contributorId: string; status: string }[]);
  return NextResponse.json(all.filter((p) => p.contributorId === user.id));
}
