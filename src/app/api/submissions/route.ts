import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { canViewActivity, activityRole, type ActivityDoc } from "@/lib/activity";

export const dynamic = "force-dynamic";

type AttemptDoc = {
  id: string; userId: string; mode: string; score: number; total: number;
  marksEarned?: number; marksTotal?: number; tookSecs?: number; filter: string; createdAt: string;
};

function filterOf(at: AttemptDoc): { activityId?: string; setId?: string } {
  try {
    return JSON.parse(at.filter ?? "{}") as { activityId?: string; setId?: string };
  } catch {
    return {};
  }
}

function jsArr(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string" && raw.trim()) {
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

// GET /api/submissions — examiner inbox: my activities + sets with counts.
// GET /api/submissions?scope=activity&id=<id> — drill-down: rows, stats, absent.
// GET /api/submissions?scope=set&id=<id> — same for an exam set.
export async function GET(req: Request) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope");
  const id = searchParams.get("id");

  if (!scope || !id) {
    // Inbox: activities I own or edit, sets I own, with submission counts.
    const mine = (await db.activity.findMany({ where: { ownerId: user.id }, take: 200 }) as unknown as ActivityDoc[]);
    const shared = (await db.activityShare.findMany({ where: { userId: user.id }, take: 200 }) as unknown as { activityId: string; role: string }[]);
    const sharedActs: ActivityDoc[] = [];
    for (const s of shared) {
      if (s.role !== "editor") continue;
      const a = (await db.activity.findUnique({ where: { id: s.activityId } }) as unknown as ActivityDoc | null);
      if (a) sharedActs.push(a);
    }
    const sets = (await db.examSet.findMany({ where: { ownerId: user.id }, take: 200 }) as unknown as { id: string; title: string }[]);
    const attempts = (await db.quizAttempt.findMany({ take: 500 }) as unknown as AttemptDoc[]);
    const actCount = new Map<string, number>();
    const setCount = new Map<string, number>();
    for (const at of attempts) {
      const f = filterOf(at);
      if (f.activityId) actCount.set(f.activityId, (actCount.get(f.activityId) ?? 0) + 1);
      if (f.setId) setCount.set(f.setId, (setCount.get(f.setId) ?? 0) + 1);
    }
    const seen = new Set<string>();
    const activities = [...mine, ...sharedActs]
      .filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)))
      .map((a) => ({
        id: a.id,
        title: a.title,
        role: a.ownerId === user.id ? "owner" : "editor",
        submissions: actCount.get(a.id) ?? 0,
      }));
    return NextResponse.json({
      activities,
      sets: sets.map((s) => ({ id: s.id, title: s.title, role: "owner", submissions: setCount.get(s.id) ?? 0 })),
    });
  }

  if (scope !== "activity" && scope !== "set") {
    return NextResponse.json({ error: "Bad scope" }, { status: 400 });
  }

  let title = "";
  let kind = scope;
  let expected: { id: string; name: string; role: string }[] = [];

  if (scope === "activity") {
    const a = (await db.activity.findUnique({ where: { id } }) as unknown as ActivityDoc | null);
    if (!a || !(await canViewActivity(user.id, a))) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const role = await activityRole(user.id, a);
    if (role !== "owner" && role !== "editor") return NextResponse.json({ error: "Not yours to review" }, { status: 403 });
    title = a.title;
    const owner = (await db.user.findUnique({ where: { id: a.ownerId } }) as unknown as { name: string } | null);
    expected = [{ id: a.ownerId, name: owner?.name ?? "Owner", role: "owner" }];
    const shares = (await db.activityShare.findMany({ where: { activityId: a.id }, take: 200 }) as unknown as { userId: string; role: string }[]);
    for (const s of shares) {
      if (expected.some((e) => e.id === s.userId)) continue;
      const u = (await db.user.findUnique({ where: { id: s.userId } }) as unknown as { name: string } | null);
      expected.push({ id: s.userId, name: u?.name ?? "Someone", role: s.role });
    }
  } else {
    const s = (await db.examSet.findUnique({ where: { id } }) as unknown as { id: string; ownerId: string; title: string } | null);
    if (!s || s.ownerId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
    title = s.title;
    expected = [];
  }

  const all = (await db.quizAttempt.findMany({ take: 500 }) as unknown as AttemptDoc[]);
  const mine: AttemptDoc[] = [];
  for (const at of all) {
    const f = filterOf(at);
    const hit = scope === "activity" ? f.activityId === id : f.setId === id;
    if (hit) mine.push(at);
  }
  mine.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const qIds = new Set<string>();
  const ansByAttempt = new Map<string, { questionId: string; given: string; correct: boolean }[]>();
  for (const at of mine) {
    const rows = (await db.attemptAnswer.findMany({ where: { attemptId: at.id } }) as unknown as { questionId: string; given: string; correct: boolean }[]);
    ansByAttempt.set(at.id, rows);
    for (const r of rows) qIds.add(r.questionId);
  }
  const qMap = new Map<string, { stem: string; type: string }>();
  if (qIds.size) {
    const qs = (await db.question.findMany({ where: { id: { in: Array.from(qIds) } } }) as unknown as { id: string; stem: string; type: string }[]);
    for (const q of qs) qMap.set(q.id, q);
  }
  const userCache = new Map<string, { name: string; email: string } | null>();
  async function who(uid: string) {
    if (!userCache.has(uid)) {
      userCache.set(uid, (await db.user.findUnique({ where: { id: uid } }) as unknown as { name: string; email: string } | null));
    }
    return userCache.get(uid) ?? null;
  }

  const rows = [];
  for (const at of mine) {
    const u = await who(at.userId);
    rows.push({
      id: at.id,
      mode: at.mode,
      score: at.score,
      total: at.total,
      marksEarned: at.marksEarned ?? null,
      marksTotal: at.marksTotal ?? null,
      tookSecs: at.tookSecs ?? null,
      createdAt: at.createdAt,
      user: u ? { name: u.name, email: u.email } : null,
      answers: (ansByAttempt.get(at.id) ?? []).map((r) => ({
        stem: qMap.get(r.questionId)?.stem ?? "(removed)",
        type: qMap.get(r.questionId)?.type ?? "",
        given: jsArr(r.given),
        correct: r.correct,
      })),
    });
  }

  const submittedIds = new Set(mine.map((a) => a.userId));
  const notSubmitted = expected.filter((e) => !submittedIds.has(e.id));
  const withTotal = mine.filter((a) => a.total > 0);
  const avgScore = withTotal.length
    ? Math.round((withTotal.reduce((s, a) => s + a.score / Math.max(1, a.total), 0) / withTotal.length) * 100)
    : null;
  const timed = mine.map((a) => a.tookSecs ?? 0).filter((t) => t > 0);
  const avgTookSecs = timed.length ? Math.round(timed.reduce((s, t) => s + t, 0) / timed.length) : null;

  return NextResponse.json({
    title,
    kind,
    stats: {
      submitted: submittedIds.size,
      expected: expected.length,
      attempts: mine.length,
      avgScore,
      avgTookSecs,
    },
    mine: rows.filter((r, i) => mine[i]?.userId === user.id),
    all: rows,
    notSubmitted,
  });
}
