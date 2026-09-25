import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { rateLimited } from "@/lib/ratelimit";
import { signTicket } from "@/lib/exam-token";

export const dynamic = "force-dynamic";

// Start an exam: the server picks + freezes the snapshot, signs it with
// the clock, and strips answers/explanations (no more open-book devtools).
// Practice keeps using /api/bank directly (instant feedback needs answers).
export async function POST(req: Request) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  if (rateLimited(req, "quiz-start", 30, 60 * 1000)) {
    return NextResponse.json({ error: "Slow down" }, { status: 429 });
  }
  const { topicId, subjectId, count, minutes } = await req.json();
  const n = Math.min(Math.max(Number(count) || 10, 1), 50);
  const mins = Math.min(Math.max(Number(minutes) || 10, 1), 180);

  let topicIds: string[] | null = null;
  if (topicId) topicIds = [topicId];
  else if (subjectId) {
    const ts = (await db.topic.findMany({ where: { subjectId } }) as unknown as { id: string }[]);
    topicIds = ts.map((t) => t.id);
    if (!topicIds.length) return NextResponse.json({ error: "Empty subject" }, { status: 400 });
  }
  const where: Record<string, unknown> = { mergedIntoId: null };
  if (topicIds) where.topicId = { in: topicIds.length ? topicIds : ["__none__"] };
  const pool = (await db.question.findMany({ where, take: 500 }) as unknown as { id: string }[]);
  if (!pool.length) return NextResponse.json({ error: "No questions for this filter" }, { status: 400 });

  // Shuffle + slice server-side so the client can't cherry-pick.
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const snap = shuffled.slice(0, Math.min(n, shuffled.length));
  const ids = snap.map((q) => q.id);
  const startedAt = Date.now();
  const durationSecs = mins * 60;
  const full = (await db.question.findMany({ where: { id: { in: ids } } }) as unknown as {
    id: string; stem: string; options: string; type: string; difficulty: string; topicId?: string;
  }[]);
  // Answers + guides stay on the server until grading.
  const items = full.map((q) => ({ id: q.id, stem: q.stem, options: q.options, type: q.type, difficulty: q.difficulty, topicId: q.topicId }));
  const ticket = signTicket({ ids, topicId, subjectId, startedAt, durationSecs });
  return NextResponse.json({ items, ticket, startedAt, durationSecs });
}
