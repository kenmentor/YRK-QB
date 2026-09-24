import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// User model: Session → Course → Subject → Topic → Question (atomic).
// Storage names: session=examBody, course=exam. Each node carries description + published counts.
export async function GET() {
  const sessions = (await db.examBody.findMany({ take: 50 }) as unknown as { id: string; name: string; description?: string }[]);
  const tree = [];
  for (const s of sessions) {
    const courses = (await db.exam.findMany({ where: { bodyId: s.id } }) as unknown as { id: string; name: string; description?: string }[]);
    const courseNodes = [];
    let sessionCount = 0;
    for (const c of courses) {
      const subjects = (await db.subject.findMany({ where: { examId: c.id } }) as unknown as { id: string; name: string; description?: string }[]);
      const subjectNodes = [];
      let courseCount = 0;
      for (const sub of subjects) {
        const topics = (await db.topic.findMany({ where: { subjectId: sub.id } }) as unknown as { id: string; name: string; description?: string }[]);
        const topicNodes = [];
        let subjectCount = 0;
        for (const t of topics) {
          const qs = (await db.question.findMany({ where: { topicId: t.id } }) as unknown as { mergedIntoId?: string }[]);
          const count = qs.filter((q) => !q.mergedIntoId).length;
          subjectCount += count;
          topicNodes.push({ id: t.id, name: t.name, description: (t as { description?: string }).description ?? `Atomic questions about ${t.name}.`, questionCount: count });
        }
        courseCount += subjectCount;
        subjectNodes.push({ id: sub.id, name: sub.name, description: (sub as { description?: string }).description ?? `Topics in ${sub.name}.`, questionCount: subjectCount, topics: topicNodes });
      }
      sessionCount += courseCount;
      courseNodes.push({ id: c.id, name: c.name, description: (c as { description?: string }).description ?? `Subjects forming the ${c.name} course.`, questionCount: courseCount, subjects: subjectNodes });
    }
    tree.push({ id: s.id, name: s.name, description: (s as { description?: string }).description ?? `Courses in the ${s.name} session.`, questionCount: sessionCount, courses: courseNodes });
  }
  return NextResponse.json(tree);
}
