import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Subjects-first bank landing: every subject with its path, description, topic + question counts.
export async function GET() {
  const subjects = (await db.subject.findMany({ take: 100 }) as unknown as { id: string; name: string; description?: string; examId: string }[]);
  const out = [];
  for (const s of subjects) {
    const exam = (await db.exam.findUnique({ where: { id: s.examId } }) as unknown as { name: string; bodyId: string } | null);
    let session = null;
    if (exam) session = (await db.examBody.findUnique({ where: { id: exam.bodyId } }) as unknown as { name: string } | null);
    const topics = (await db.topic.findMany({ where: { subjectId: s.id } }) as unknown as { id: string; name: string }[]);
    let count = 0;
    for (const t of topics) {
      const qs = (await db.question.findMany({ where: { topicId: t.id } }) as unknown as { mergedIntoId?: string }[]);
      count += qs.filter((q) => !q.mergedIntoId).length;
    }
    out.push({
      id: s.id, name: s.name, description: s.description ?? `Topics forming ${s.name}.`,
      course: exam?.name ?? "", session: session?.name ?? "",
      topics: topics.length, questionCount: count
    });
  }
  out.sort((a, b) => b.questionCount - a.questionCount);
  return NextResponse.json(out);
}
