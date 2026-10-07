import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { rateLimited } from "@/lib/ratelimit";
import { signTicket } from "@/lib/exam-token";
import { canViewActivity, resolveActivity, type ActivityDoc } from "@/lib/activity";
import { isBankQuestion } from "@/lib/shape";

export const dynamic = "force-dynamic";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type FullQ = {
  id: string; stem: string; options: string; parts?: string; type: string;
  difficulty: string; topicId?: string; stemId?: string; inheritOptions?: boolean;
};

interface PackedItem {
  id: string; stem: string; options: string; parts: string; type: string;
  difficulty: string; topicId?: string; stemId: string | null; inheritOptions: boolean;
}

// Stems never play: filter them from items, resolve them for display, and
// sign tickets over playable ids only. Stems referenced by items (or filed
// alongside) ride in `stems` with passage + shared options (no answers).
async function packageItems(docs: FullQ[]): Promise<{
  items: PackedItem[];
  stems: { id: string; stem: string; options: string }[];
}> {
  const live = docs.filter((d): d is FullQ & { stem: string; type: string } => isBankQuestion(d));
  const items: PackedItem[] = live
    .filter((q) => q.type !== "stem")
    .map((q) => ({
      id: q.id, stem: q.stem, options: q.options, parts: q.parts ?? "[]",
      type: q.type, difficulty: q.difficulty, topicId: q.topicId,
      stemId: q.stemId ?? null, inheritOptions: !!q.inheritOptions,
    }));
  const wanted = Array.from(new Set([
    ...items.map((q) => q.stemId).filter(Boolean) as string[],
    ...live.filter((q) => q.type === "stem").map((q) => q.id),
  ]));
  const stemDocs = wanted.length
    ? (await db.question.findMany({ where: { id: { in: wanted }, mergedIntoId: null } }) as unknown as { id: string; stem: string; options: string; type: string }[])
    : [];
  const stems = stemDocs
    .filter((s) => s.type === "stem" && typeof s.stem === "string")
    .map((s) => ({ id: s.id, stem: s.stem, options: s.options ?? "[]" }));
  return { items, stems };
}

// Start an exam: the server picks + freezes the snapshot, signs it with
// the clock, and strips answers/explanations (no more open-book devtools).
// Answers stay on the server until grading; stems ride along for display only.
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
  const startedAt = Date.now();
  const durationSecs = mins * 60;

  // Activity run: curated order kept; dead/unplayable ids skipped + reported.
  // Examiner controls enforced: schedule window, attempt cap, fixed clock, shuffle.
  if (activityId) {
    const a = (await db.activity.findUnique({ where: { id: String(activityId) } }) as unknown as (ActivityDoc & {
      kind?: string; timeLimitMinutes?: number | null; maxAttempts?: number | null; shuffle?: boolean;
    }) | null);
    if (!a || !(await canViewActivity(user.id, a))) return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    const now = Date.now();
    const from = a.availableFrom ? new Date(a.availableFrom as unknown as string).getTime() : NaN;
    const until = a.availableUntil ? new Date(a.availableUntil as unknown as string).getTime() : NaN;
    if (!isNaN(from) && now < from) return NextResponse.json({ error: `Opens ${new Date(from).toLocaleString()}` }, { status: 403 });
    if (!isNaN(until) && now > until) return NextResponse.json({ error: "This activity is closed" }, { status: 403 });
    if (a.maxAttempts) {
      const mine = (await db.quizAttempt.findMany({ where: { userId: user.id }, take: 200 }) as unknown as { mode: string; filter: string }[]);
      let used = 0;
      for (const m of mine) {
        if (m.mode !== "exam") continue;
        try {
          if (JSON.parse(m.filter ?? "{}").activityId === a.id) used++;
        } catch { /* ignore */ }
      }
      if (used >= (a.maxAttempts as number)) return NextResponse.json({ error: "No attempts left on this activity" }, { status: 403 });
    }
    const { items: resolved, skipped } = await resolveActivity(user.id, a);
    if (!resolved.length) return NextResponse.json({ error: "Activity has no live questions" }, { status: 400 });
    const ordered = a.shuffle ? shuffle(resolved) : resolved;
    const startedAt = Date.now();
    const durationSecs = (a.timeLimitMinutes ?? mins) * 60;
    const { items, stems } = await packageItems(ordered as unknown as Parameters<typeof packageItems>[0]);
    if (!items.length) return NextResponse.json({ error: "Activity has no playable questions" }, { status: 400 });
    const ticket = signTicket({ ids: items.map((q) => q.id), activityId: a.id, startedAt, durationSecs });
    return NextResponse.json({ items, stems, ticket, startedAt, durationSecs, skipped, timeLimitMinutes: a.timeLimitMinutes ?? null });
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
    const full = ids.length
      ? (await db.question.findMany({ where: { id: { in: ids }, mergedIntoId: null } }) as unknown as FullQ[])
      : [];
    const byId = new Map(full.map((q) => [q.id, q]));
    const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as FullQ[];
    const { items, stems } = await packageItems(ordered);
    if (!items.length) return NextResponse.json({ error: "Exam set has no live questions" }, { status: 400 });
    const ticket = signTicket({ ids: items.map((q) => q.id), startedAt, durationSecs });
    return NextResponse.json({ items, stems, ticket, startedAt, durationSecs, skipped: ids.length - ordered.length });
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
  const pool = ((await db.question.findMany({ where, take: 500 }) as unknown as FullQ[])).filter((q) => isBankQuestion(q) && q.type !== "stem");
  if (!pool.length) return NextResponse.json({ error: "No questions for this filter" }, { status: 400 });

  // Shuffle + slice server-side so the client can't cherry-pick.
  const { items, stems } = await packageItems(shuffle(pool).slice(0, Math.min(n, pool.length)));
  if (!items.length) return NextResponse.json({ error: "No questions for this filter" }, { status: 400 });
  const ticket = signTicket({ ids: items.map((q) => q.id), topicId, subjectId, startedAt, durationSecs });
  return NextResponse.json({ items, stems, ticket, startedAt, durationSecs });
}
