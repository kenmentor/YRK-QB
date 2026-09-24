import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Filters: sessionId (=bodyId), courseId (=examId), subjectId, topicId, difficulty, type, appliable, q
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");
  const courseId = searchParams.get("courseId");
  const subjectId = searchParams.get("subjectId");
  const topicId = searchParams.get("topicId");
  const difficulty = searchParams.get("difficulty");
  const type = searchParams.get("type");
  const appliable = searchParams.get("appliable");
  const q = searchParams.get("q") ?? "";
  const take = Math.min(Math.max(Number(searchParams.get("take")) || 100, 1), 500);
  const skip = Math.max(Number(searchParams.get("skip")) || 0, 0);

  // resolve hierarchy down to topic ids
  let topicIds: string[] | null = null;
  if (topicId) topicIds = [topicId];
  else if (subjectId) {
    const ts = (await db.topic.findMany({ where: { subjectId } }) as unknown as { id: string }[]);
    topicIds = ts.map((t) => t.id);
  } else if (courseId) {
    const subs = (await db.subject.findMany({ where: { examId: courseId } }) as unknown as { id: string }[]);
    const ids: string[] = [];
    for (const s of subs) {
      const ts = (await db.topic.findMany({ where: { subjectId: s.id } }) as unknown as { id: string }[]);
      ids.push(...ts.map((t) => t.id));
    }
    topicIds = ids;
  } else if (sessionId) {
    const courses = (await db.exam.findMany({ where: { bodyId: sessionId } }) as unknown as { id: string }[]);
    const ids: string[] = [];
    for (const c of courses) {
      const subs = (await db.subject.findMany({ where: { examId: c.id } }) as unknown as { id: string }[]);
      for (const s of subs) {
        const ts = (await db.topic.findMany({ where: { subjectId: s.id } }) as unknown as { id: string }[]);
        ids.push(...ts.map((t) => t.id));
      }
    }
    topicIds = ids;
  }

  const where: Record<string, unknown> = { mergedIntoId: null };
  if (topicIds) where.topicId = { in: topicIds.length ? topicIds : ["__none__"] };
  if (difficulty) where.difficulty = difficulty;
  if (type) where.type = type;
  if (appliable === "open") where.allowApplications = true;
  if (q) where.stem = { contains: q };

  const questions = await db.question.findMany({ where, take, skip, orderBy: { createdAt: "desc" } });
  return NextResponse.json(questions);
}
