import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDb, plain } from "@/lib/mongo";
import { getAuthUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = (await getAuthUser(req) as unknown as { id: string; email: string; name: string; role: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const me = (await db.user.findUnique({ where: { id: user.id } }) as unknown as { id: string; email: string; name: string; role: string; createdAt: string });
  const memberships = (await db.membership.findMany({ where: { userId: user.id } }) as unknown as { workspaceId: string; role: string }[]);
  // Authored drafts across my workspaces (bounded by membership count).
  const authored: { id: string; authorId: string; status: string; stem: string }[] = [];
  for (const m of memberships) {
    const ds = (await db.questionDraft.findMany({ where: { workspaceId: m.workspaceId } }) as unknown as { id: string; authorId: string; status: string; stem: string }[]);
    for (const d of ds) if (d.authorId === user.id) authored.push(d);
  }
  const reviews = (await db.review.findMany({ where: { reviewerId: user.id } }) as unknown as { verdict: string }[]);
  const created = (await db.question.findMany({ where: { creatorId: user.id } }) as unknown as { id: string }[]);
  const attempts = (await db.quizAttempt.findMany({ where: { userId: user.id } }) as unknown as { score: number; total: number; mode: string }[]);
  const answered = attempts.reduce((s, a) => s + a.total, 0);
  const correct = attempts.reduce((s, a) => s + a.score, 0);
  const accuracy = answered ? Math.round((correct / answered) * 100) : 0;

  // Rank over ALL users with three aggregation pipelines, no per-user
  // fan-out, no 100-user cap.
  const mongo = await getDb();
  const [qCounts, attAgg, users] = await Promise.all([
    mongo.collection("questions").aggregate([{ $group: { _id: "$creatorId", n: { $sum: 1 } } }]).toArray(),
    mongo.collection("quizAttempts").aggregate([{ $group: { _id: "$userId", score: { $sum: "$score" }, total: { $sum: "$total" } } }]).toArray(),
    mongo.collection("users").find({}, { projection: { name: 1 } }).toArray()
  ]);
  const qMap = new Map<string, number>(qCounts.map((r) => [String(r._id), r.n]));
  const aMap = new Map<string, { score: number; total: number }>(attAgg.map((r) => [String(r._id), { score: r.score, total: r.total }]));
  const scores = users.map((u) => {
    const uDoc = plain(u) as unknown as { id: string; name: string };
    const acc = (aMap.get(uDoc.id)?.total ?? 0)
      ? Math.round(((aMap.get(uDoc.id)?.score ?? 0) / (aMap.get(uDoc.id)?.total ?? 1)) * 100)
      : 0;
    return { id: uDoc.id, name: uDoc.name, score: (qMap.get(uDoc.id) ?? 0) * 10 + acc };
  });
  scores.sort((a, b) => b.score - a.score);
  const rank = scores.findIndex((s) => s.id === user.id) + 1;

  // Weak areas: batched question + topic lookups, not per-answer round-trips.
  const byTopic: Record<string, { correct: number; total: number; name: string }> = {};
  const myAttempts = (await db.quizAttempt.findMany({ where: { userId: user.id }, take: 10 }) as unknown as { id: string }[]);
  const allAns: { questionId: string; correct: boolean }[] = [];
  for (const a of myAttempts) {
    allAns.push(...((await db.attemptAnswer.findMany({ where: { attemptId: a.id } }) as unknown as { questionId: string; correct: boolean }[])));
  }
  const uniqQ = Array.from(new Set(allAns.map((a) => a.questionId)));
  const qMap2 = new Map<string, string | undefined>();
  if (uniqQ.length) {
    const qs = (await db.question.findMany({ where: { id: { in: uniqQ } } }) as unknown as { id: string; topicId?: string }[]);
    for (const q of qs) qMap2.set(q.id, q.topicId);
  }
  const topicVals: (string | undefined)[] = [];
  qMap2.forEach((v) => { topicVals.push(v); });
  const uniqT = Array.from(new Set(topicVals.filter(Boolean))) as string[];
  const tMap = new Map<string, string>();
  if (uniqT.length) {
    const ts = (await db.topic.findMany({ where: { id: { in: uniqT } } }) as unknown as { id: string; name: string }[]);
    for (const t of ts) tMap.set(t.id, t.name);
  }
  for (const x of allAns) {
    const name = tMap.get(qMap2.get(x.questionId) ?? "") ?? "Untagged";
    byTopic[name] ??= { correct: 0, total: 0, name };
    byTopic[name].total++;
    if (x.correct) byTopic[name].correct++;
  }
  return NextResponse.json({
    user: me,
    status: { workspaces: memberships.length, draftsAuthored: authored.length, reviewsDone: reviews.length, questionsCreated: created.length, attempts: attempts.length, accuracy },
    rank: { position: rank, of: scores.length, leaderboard: scores.slice(0, 5) },
    contributions: { drafts: authored.slice(0, 5), reviews: reviews.length },
    weakAreas: byTopic,
    recentAttempts: attempts.slice(0, 5)
  });
}
