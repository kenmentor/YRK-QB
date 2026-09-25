import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const s = (await db.subject.findUnique({ where: { id: params.id } }) as unknown as {
    id: string; name: string; description?: string; examId: string;
  } | null);
  if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const exam = (await db.exam.findUnique({ where: { id: s.examId } }) as unknown as { name: string; bodyId: string } | null);
  const session = exam ? (await db.examBody.findUnique({ where: { id: exam.bodyId } }) as unknown as { name: string } | null) : null;
  const topics = (await db.topic.findMany({ where: { subjectId: s.id } }) as unknown as { id: string; name: string; description?: string }[]);
  const topicNodes = [];
  let total = 0;
  for (const t of topics) {
    const qs = (await db.question.findMany({ where: { topicId: t.id } }) as unknown as { mergedIntoId?: string; type: string; difficulty: string }[]);
    const live = qs.filter((q) => !q.mergedIntoId);
    total += live.length;
    const byType: Record<string, number> = {};
    for (const q of live) byType[q.type] = (byType[q.type] ?? 0) + 1;
    topicNodes.push({ id: t.id, name: t.name, description: (t as { description?: string }).description ?? "", questionCount: live.length, byType });
  }
  // Crews building this subject: open workspaces show by name, private
  // ones count anonymously. This is the bank-side mirror of workspaces.
  const builders: { id: string; name: string; memberCount: number }[] = [];
  let privateCrews = 0;
  if (exam) {
    const spaces = (await db.workspace.findMany({ where: { examId: (exam as unknown as { id: string }).id } }) as unknown as { id: string; name: string; visibility?: string }[]);
    for (const w of spaces) {
      if ((w.visibility ?? "invite-only") === "open") {
        const members = (await db.membership.findMany({ where: { workspaceId: w.id } }) as unknown as unknown[]);
        builders.push({ id: w.id, name: w.name, memberCount: members.length });
      } else privateCrews++;
    }
  }
  return NextResponse.json({
    subject: { id: s.id, name: s.name, description: s.description ?? "", course: exam?.name ?? "", session: session?.name ?? "", courseId: exam ? (exam as unknown as { id: string }).id : null },
    topics: topicNodes, questionCount: total, builders, privateCrews
  });
}
