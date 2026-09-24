import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { validateQuestion } from "@/lib/validation";
import { normalizeStem } from "@/lib/types";

// Admin decision on a proposal. Body: { decision: "commit" | "cancel", message?: string }
// - commit (+optional message) → question published, contributor notified
// - cancel + message → contributor notified with message
// - cancel, no message → contributor gets default message
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const me = (await db.user.findUnique({ where: { id: user.id } }) as unknown as { role: string });
  if (me?.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const proposal = (await db.proposal.findUnique({ where: { id: params.id } }) as unknown as {
    id: string; contributorId: string; subjectId: string; kind: string; questionId?: string; payload: string; status: string;
  } | null);
  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (proposal.status !== "pending") return NextResponse.json({ error: "Already decided" }, { status: 409 });
  const { decision, message } = await req.json();

  if (decision === "commit") {
    const p = JSON.parse(proposal.payload) as { type: string; stem: string; options: string[]; correct: string[]; explanation: string; difficulty: string; topicId: string | null };
    // Same bar as the workspace flow: full schema validation, topic must
    // belong to the proposal's subject, no silent duplicates.
    const parsed = validateQuestion({ type: p.type, stem: p.stem, options: p.options ?? [], correct: p.correct ?? [], explanation: p.explanation, difficulty: (p.difficulty ?? "medium") as "easy" | "medium" | "hard", tags: [] });
    if (!parsed.success) return NextResponse.json({ error: "Payload fails question validation", issues: parsed.error.issues }, { status: 422 });
    if (p.topicId) {
      const topic = (await db.topic.findUnique({ where: { id: p.topicId } }) as unknown as { subjectId: string } | null);
      if (!topic || topic.subjectId !== proposal.subjectId) {
        return NextResponse.json({ error: "Payload topic is outside the proposal subject" }, { status: 422 });
      }
    }
    const dup = await db.question.findFirst({ where: { normStem: normalizeStem(p.stem) } });
    if (dup) return NextResponse.json({ error: "This question already exists in the bank", duplicateId: (dup as { id: string }).id }, { status: 409 });
    const question = await db.question.create({
      data: { topicId: p.topicId, type: p.type, stem: p.stem, normStem: normalizeStem(p.stem), options: JSON.stringify(p.options ?? []), correct: JSON.stringify(p.correct ?? []), explanation: p.explanation, difficulty: p.difficulty ?? "medium", tags: JSON.stringify(["community"]), creatorId: proposal.contributorId }
    });
    await db.proposal.update({ where: { id: proposal.id }, data: { status: "committed", adminMessage: message ?? "" } });
    await db.mergeRecord.create({ data: { type: "approve_to_live", sourceIds: JSON.stringify([proposal.id]), targetIds: JSON.stringify([(question as { id: string }).id]), actorId: user.id } });
    await db.notification.create({
      data: { userId: proposal.contributorId, kind: "decision", title: "Committed to the bank", body: message?.trim() ? `Admin committed your question. Message: ${message}` : "Admin committed your question to the bank. Nice work!", link: "/bank", read: false }
    });
    return NextResponse.json({ ok: true, question });
  }

  if (decision === "cancel") {
    await db.proposal.update({ where: { id: proposal.id }, data: { status: "cancelled", adminMessage: message ?? "" } });
    await db.notification.create({
      data: {
        userId: proposal.contributorId, kind: "decision", title: "Not committed",
        body: message?.trim() ? `Admin cancelled with a message: ${message}` : "Admin cancelled this time, the default note: thanks for contributing, please align with the marking guide and try again.",
        link: "/notifications", read: false
      }
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Bad decision" }, { status: 400 });
}
