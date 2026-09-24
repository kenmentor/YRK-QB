import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { gradeAnswer } from "@/lib/lifecycle";

const LATE_GRACE_MS = 30 * 1000;

export async function POST(req: Request) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const { mode, topicId, subjectId, questionIds, answers, startedAt, durationSecs } = await req.json();
  const answerList = (Array.isArray(answers) ? answers : []) as { questionId: string; given: string[] }[];
  // The snapshot is authoritative: grade every snapshotted question so
  // blanks count as wrong (no more "3/3" for answering 3 of 10).
  const snapshotIds = (Array.isArray(questionIds) && questionIds.length ? questionIds : answerList.map((a) => a.questionId)) as string[];
  if (!snapshotIds.length) return NextResponse.json({ error: "Empty snapshot" }, { status: 400 });

  // Snapshot must respect the declared filter, no smuggling hard
  // questions out or easy ones in.
  if (topicId || subjectId) {
    let allowed: string[] | null = null;
    if (topicId) allowed = [topicId];
    else if (subjectId) {
      const ts = (await db.topic.findMany({ where: { subjectId } }) as unknown as { id: string }[]);
      allowed = ts.map((t) => t.id);
    }
    if (allowed) {
      const qs = (await db.question.findMany({ where: { id: { in: snapshotIds } } }) as unknown as { id: string; topicId?: string }[]);
      const bad = qs.filter((q) => q.topicId && !allowed!.includes(q.topicId));
      if (bad.length || qs.length !== snapshotIds.length) {
        return NextResponse.json({ error: "Snapshot doesn't match the filter" }, { status: 400 });
      }
    }
  }

  const questions = (await db.question.findMany({ where: { id: { in: snapshotIds }, mergedIntoId: null } }) as unknown as { id: string; correct: string; type: string }[]);
  const byId = new Map(questions.map((q) => [q.id, q]));
  const givenById = new Map(answerList.map((a) => [a.questionId, a.given ?? []]));
  let score = 0;
  const rows: { questionId: string; given: string; correct: boolean }[] = [];
  for (const qid of snapshotIds) {
    const q = byId.get(qid);
    if (!q) continue; // drafted-away alias or deleted, skip, don't inflate total
    const given = givenById.get(qid) ?? []; // blank = wrong
    const correct = gradeAnswer(JSON.parse(q.correct), given, q.type);
    if (correct) score++;
    rows.push({ questionId: q.id, given: JSON.stringify(given), correct });
  }

  // Server-side clock: overtime exam submissions score zero. The client
  // timer is convenience, not authority.
  let late = false;
  if (mode === "exam" && startedAt && durationSecs) {
    if (Date.now() > Number(startedAt) + Number(durationSecs) * 1000 + LATE_GRACE_MS) {
      late = true;
      score = 0;
    }
  }

  const attempt = (await db.quizAttempt.create({
    data: { userId: user.id, mode: mode ?? "practice", filter: JSON.stringify({ topicId, subjectId, late }), score, total: rows.length }
  }) as unknown as { id: string });
  for (const r of rows) {
    await db.attemptAnswer.create({ data: { attemptId: attempt.id, ...r } });
  }
  return NextResponse.json({ attemptId: attempt.id, score, total: rows.length, late }, { status: 201 });
}

export async function GET(req: Request) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ attempts: [], weakAreas: {} });
  const attempts = (await db.quizAttempt.findMany({ where: { userId: user.id }, take: 20 }) as unknown as {
    id: string; mode: string; score: number; total: number; createdAt: string;
  }[]);
  const byTopic: Record<string, { correct: number; total: number; name: string }> = {};
  // Batch: one answers query per attempt is gone, fetch per attempt is
  // bounded (20), then resolve questions + topics in two batched queries.
  const allAnswers: { questionId: string; correct: boolean }[] = [];
  const detailed: unknown[] = [];
  for (const a of attempts) {
    const answers = (await db.attemptAnswer.findMany({ where: { attemptId: a.id } }) as unknown as { questionId: string; correct: boolean }[]);
    allAnswers.push(...answers);
    detailed.push({ ...a, answers });
  }
  const qIds = Array.from(new Set(allAnswers.map((a) => a.questionId)));
  const qMap = new Map<string, { topicId?: string }>();
  if (qIds.length) {
    const qs = (await db.question.findMany({ where: { id: { in: qIds } } }) as unknown as { id: string; topicId?: string }[]);
    for (const q of qs) qMap.set(q.id, q);
  }
  const qVals: { topicId?: string }[] = [];
  qMap.forEach((v) => { qVals.push(v); });
  const tIds = Array.from(new Set(qVals.map((q) => q.topicId).filter(Boolean))) as string[];
  const tMap = new Map<string, string>();
  if (tIds.length) {
    const ts = (await db.topic.findMany({ where: { id: { in: tIds } } }) as unknown as { id: string; name: string }[]);
    for (const t of ts) tMap.set(t.id, t.name);
  }
  for (const ans of allAnswers) {
    const t = tMap.get(qMap.get(ans.questionId)?.topicId ?? "") ?? "Untagged";
    byTopic[t] ??= { correct: 0, total: 0, name: t };
    byTopic[t].total++;
    if (ans.correct) byTopic[t].correct++;
  }
  return NextResponse.json({ attempts: detailed, weakAreas: byTopic });
}
