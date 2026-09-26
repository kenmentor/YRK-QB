import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { rateLimited } from "@/lib/ratelimit";
import { signTicket } from "@/lib/exam-token";
import { canViewActivity, resolveActivity, type ActivityDoc } from "@/lib/activity";
import { isBankQuestion } from "@/lib/shape";

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
  const { topicId, subjectId, count, minutes, setId, activityId } = await req.json();
  const n = Math.min(Math.max(Number(count) || 10, 1), 50);
  const mins = Math.min(Math.max(Number(minutes) || 10, 1), 180);

  // Activity run: curated order kept; dead/unplayable ids skipped + reported.
  if (activityId) {
    const a = (await db.activity.findUnique({ where: { id: String(activityId) } }) as unknown as ActivityDoc | null);
    if (!a || !(await canViewActivity(user.id, a))) return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    const { items: resolved, skipped } = await resolveActivity(user.id, a);
    if (!resolved.length) return NextResponse.json({ error: "Activity has no live questions" }, { status: 400 });
    const startedAt = Date.now();
    const durationSecs = mins * 60;
    const ids = resolved.map((q) => q.id);
    const items = resolved.map((q) => ({
      id: q.id, stem: q.stem, options: q.options, parts: (q as { parts?: string }).parts ?? "[]",
      type: q.type, difficulty: q.difficulty, topicId: q.topicId,
    }));
    const ticket = signTicket({ ids, startedAt, durationSecs });
    return NextResponse.json({ items, ticket, startedAt, durationSecs, skipped });
  }

  // Exam-set run: set order is kept (exams are ordered); dead ids skipped.
  if (setId) {
    const set = (await db.examSet.findUnique({ where: { id: String(setId) } }) as unknown as { ownerId: string; questionIds?: string } | null);
    if (!set || set.ownerId !== user.id) return NextResponse.json({ error: "Exam set not found" }, { status: 404 });
    let ids: string[] = [];
    try {
      const a = JSON.parse(set.questionIds ?? "[]");
      ids = Array.isArray(a) ? a.map(String) : [];
    } catch { ids = []; }
    const live = ids.length
      ? (await db.question.findMany({ where: { id: { in: ids }, mergedIntoId: null } }) as unknown as { id: string }[])
      : [];
    const liveSet = new Set(live.map((q) => q.id));
    const ordered = ids.filter((id) => liveSet.has(id));
    if (!ordered.length) return NextResponse.json({ error: "Exam set has no live questions" }, { status: 400 });
    const startedAt = Date.now();
    const durationSecs = mins * 60;
    const full = (await db.question.findMany({ where: { id: { in: ordered } } }) as unknown as {
      id: string; stem: string; options: string; parts?: string; type: string; difficulty: string; topicId?: string;
    }[]);
    const byId = new Map(full.map((q) => [q.id, q]));
    const items = ordered.map((id) => byId.get(id)).filter(Boolean).map((q) => ({
      id: q!.id, stem: q!.stem, options: q!.options, parts: q!.parts ?? "[]", type: q!.type, difficulty: q!.difficulty, topicId: q!.topicId,
    }));
    const ticket = signTicket({ ids: ordered, startedAt, durationSecs });
    return NextResponse.json({ items, ticket, startedAt, durationSecs, skipped: ids.length - ordered.length });
  }

  let topicIds: string[] | null = null;
  if (topicId) topicIds = [topicId];
  else if (subjectId) {
    const ts = (await db.topic.findMany({ where: { subjectId } }) as unknown as { id: string }[]);
    topicIds = ts.map((t) => t.id);
    if (!topicIds.length) return NextResponse.json({ error: "Empty subject" }, { status: 400 });
  }
  const where: Record<string, unknown> = { mergedIntoId: null };
  if (topicIds) where.topicId = { in: topicIds.length ? topicIds : ["__none__"] };
  const pool = ((await db.question.findMany({ where, take: 500 }) as unknown as { id: string }[])).filter(isBankQuestion);
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
    id: string; stem: string; options: string; parts?: string; type: string; difficulty: string; topicId?: string;
  }[]);
  // Answers + guides stay on the server until grading (parts carry no answers).
  const items = full.map((q) => ({ id: q.id, stem: q.stem, options: q.options, parts: q.parts ?? "[]", type: q.type, difficulty: q.difficulty, topicId: q.topicId }));
  const ticket = signTicket({ ids, topicId, subjectId, startedAt, durationSecs });
  return NextResponse.json({ items, ticket, startedAt, durationSecs });
}
