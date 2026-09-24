import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { normalize } from "@/lib/types";

// Resolve the taxonomy curation queue. Admins only.
// Body: { decision: "approve" | "reject" }
// Approve creates the real node (exam/subject/topic); reject closes it.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const me = (await db.user.findUnique({ where: { id: user.id } }) as unknown as { role: string });
  if (me?.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const proposal = (await db.taxonomyProposal.findUnique({ where: { id: params.id } }) as unknown as {
    id: string; kind: string; parentId: string; name: string; normName: string; status: string;
  } | null);
  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (proposal.status !== "pending") return NextResponse.json({ error: "Already decided" }, { status: 409 });
  const { decision } = await req.json();

  if (decision === "reject") {
    await db.taxonomyProposal.update({ where: { id: proposal.id }, data: { status: "rejected" } });
    return NextResponse.json({ ok: true });
  }
  if (decision !== "approve") return NextResponse.json({ error: "Bad decision" }, { status: 400 });

  const normName = normalize(proposal.name);
  if (proposal.kind === "topic") {
    const dup = await db.topic.findFirst({ where: { subjectId: proposal.parentId, normName } });
    if (dup) {
      await db.taxonomyProposal.update({ where: { id: proposal.id }, data: { status: "rejected" } });
      return NextResponse.json({ ok: true, note: "Already exists, closed as duplicate" });
    }
    await db.topic.create({ data: { subjectId: proposal.parentId, name: proposal.name.trim(), normName } });
  } else if (proposal.kind === "subject") {
    const dup = await db.subject.findFirst({ where: { examId: proposal.parentId, normName } });
    if (dup) {
      await db.taxonomyProposal.update({ where: { id: proposal.id }, data: { status: "rejected" } });
      return NextResponse.json({ ok: true, note: "Already exists, closed as duplicate" });
    }
    await db.subject.create({ data: { examId: proposal.parentId, name: proposal.name.trim(), normName } });
  } else if (proposal.kind === "exam") {
    const dup = await db.exam.findFirst({ where: { bodyId: proposal.parentId, normName } });
    if (dup) {
      await db.taxonomyProposal.update({ where: { id: proposal.id }, data: { status: "rejected" } });
      return NextResponse.json({ ok: true, note: "Already exists, closed as duplicate" });
    }
    await db.exam.create({ data: { bodyId: proposal.parentId, name: proposal.name.trim(), normName } });
  } else {
    return NextResponse.json({ error: "Unknown kind" }, { status: 400 });
  }
  await db.taxonomyProposal.update({ where: { id: proposal.id }, data: { status: "approved" } });
  return NextResponse.json({ ok: true });
}
