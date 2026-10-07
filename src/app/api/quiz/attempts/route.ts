import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { gradeAnswer, isRubricType, rubricTotal, rubricOk, suggestMarks, gradeMarks } from "@/lib/lifecycle";
import { parseParts, matchAny } from "@/lib/validation";
import { isBankQuestion, safeArr } from "@/lib/shape";
import { verifyTicket } from "@/lib/exam-token";
import { canViewActivity, resolveActivity, type ActivityDoc } from "@/lib/activity";

export const dynamic = "force-dynamic";

const LATE_GRACE_MS = 30 * 1000;

// Exam attempts already recorded against an activity (for caps).
async function examUses(userId: string, activityId: string): Promise<number> {
  const mine = (await db.quizAttempt.findMany({ where: { userId }, take: 200 }) as unknown as { mode: string; filter: string }[]);
  let used = 0;
  for (const m of mine) {
    if (m.mode !== "exam") continue;
    try {
      if (JSON.parse(m.filter ?? "{}").activityId === activityId) used++;
    } catch { /* ignore */ }
  }
  return used;
}

export async function POST(req: Request) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const { mode, topicId, subjectId, questionIds, answers, startedAt, durationSecs, ticket, manual, violations, tookSecs, activityId: bodyActivityId, setId: bodySetId } = await req.json();
  const answerList = (Array.isArray(answers) ? answers : []) as { questionId: string; given: string[] }[];
  const givenById = new Map(answerList.map((a) => [a.questionId, a.given ?? []]));
  // Self/peer rubric totals: [{questionId, score}].
  const manualById = new Map<string, number>(
    (Array.isArray(manual) ? manual : []).map((m: { questionId: string; score: number }) => [m.questionId, Math.max(0, Number(m.score) || 0)])
  );

  let snapshotIds: string[];
  let late = false;
  // Activity context (trusted from the ticket in exam mode, verified below otherwise).
  let activityId: string | null = null;
  let setId: string | null = typeof bodySetId === "string" && bodySetId ? bodySetId : null;
  let activitySettings: { showScore?: string; resultsReleased?: boolean; maxAttempts?: number | null } | null = null;

  if (mode === "exam") {
    // Exam truth comes from the signed ticket, never the client.
    const t = verifyTicket(ticket ?? "");
    if (!t) return NextResponse.json({ error: "Missing or forged exam ticket, restart the exam" }, { status: 400 });
    snapshotIds = t.ids;
    if (t.activityId) activityId = t.activityId;
    else if (typeof bodyActivityId === "string" && bodyActivityId) activityId = bodyActivityId;
    if (t.setId) setId = t.setId;
    if (Date.now() > t.startedAt + t.durationSecs * 1000 + LATE_GRACE_MS) late = true;
    if (activityId) {
      const a = (await db.activity.findUnique({ where: { id: activityId } }) as unknown as (ActivityDoc & { showScore?: string; resultsReleased?: boolean; maxAttempts?: number | null }) | null);
      if (!a || !(await canViewActivity(user.id, a))) return NextResponse.json({ error: "Activity not found" }, { status: 404 });
      activitySettings = a;
      if (a.maxAttempts && (await examUses(user.id, a.id)) >= a.maxAttempts) {
        return NextResponse.json({ error: "No attempts left on this activity" }, { status: 403 });
      }
    }
  } else {
    snapshotIds = (Array.isArray(questionIds) && questionIds.length ? questionIds : answerList.map((a) => a.questionId)) as string[];
    if (!snapshotIds.length) return NextResponse.json({ error: "Empty snapshot" }, { status: 400 });
    if (typeof bodyActivityId === "string" && bodyActivityId) {
      const a = (await db.activity.findUnique({ where: { id: bodyActivityId } }) as unknown as (ActivityDoc & { showScore?: string; resultsReleased?: boolean }) | null);
      if (!a || !(await canViewActivity(user.id, a))) return NextResponse.json({ error: "Activity not found" }, { status: 404 });
      activitySettings = a;
      const { items } = await resolveActivity(user.id, a);
      const live = new Set(items.map((q) => q.id));
      const bad = snapshotIds.filter((id) => !live.has(id));
      if (bad.length) return NextResponse.json({ error: "Snapshot doesn't match the activity" }, { status: 400 });
      activityId = a.id;
    }
    if (topicId || subjectId) {
      let allowed: string[] | null = null;
      if (topicId) allowed = [topicId];
      else if (subjectId) {
        const ts = (await db.topic.findMany({ where: { subjectId } }) as unknown as { id: string }[]);
        allowed = ts.map((x) => x.id);
      }
      if (allowed) {
        const qs = (await db.question.findMany({ where: { id: { in: snapshotIds } } }) as unknown as { id: string; topicId?: string }[]);
        const bad = qs.filter((q) => q.topicId && !allowed!.includes(q.topicId));
        if (bad.length || qs.length !== snapshotIds.length) {
          return NextResponse.json({ error: "Snapshot doesn't match the filter" }, { status: 400 });
        }
      }
    }
    if (startedAt && durationSecs && Date.now() > Number(startedAt) + Number(durationSecs) * 1000 + LATE_GRACE_MS) late = true;
  }

  const questions = (await db.question.findMany({ where: { id: { in: snapshotIds }, mergedIntoId: null } }) as unknown as {
    id: string; stem: string; options: string; correct: string; type: string; explanation: string; parts?: string;
    difficultyIndex?: number; marks?: number | null; optionMarks?: string;
  }[]);
  const byId = new Map(questions.map((q) => [q.id, q]));
  let score = 0;
  let marksEarned = 0;
  let marksTotal = 0;
  const rows: { questionId: string; given: string; correct: boolean }[] = [];
  const breakdown: { questionId: string; stem: string; given: string[]; correctAnswers: string[]; explanation: string; ok: boolean; type: string; max: number; earned: number; parts?: { stem: string; given: string[]; expected: string[]; ok: boolean }[] }[] = [];
  // Smart max: pinned marks win, else the auto suggestion.
  const maxFor = (qq: { type: string; difficultyIndex?: number; marks?: number | null }, correctArr: string[], parts: { max?: number }[]) =>
    (qq.marks ?? suggestMarks({ type: qq.type, correct: correctArr, parts, difficultyIndex: qq.difficultyIndex ?? 3 }));
  for (const qid of snapshotIds) {
    const q = byId.get(qid);
    if (!q || !isBankQuestion(q)) continue;
    if (q.type === "stem") continue; // stimuli never score, even if submitted
    const given = givenById.get(qid) ?? [];
    const correctArr = safeArr((q as { correct?: unknown }).correct);
    const parts = parseParts((q as { parts?: string }).parts);

    // Rubric formats are scored by hand (self/peer in v1): clamp + ok at half.
    if (isRubricType(q.type)) {
      const max = q.marks ?? rubricTotal(parts);
      const claimed = Math.min(manualById.get(qid) ?? 0, max);
      const ok = !late && rubricOk(claimed, max);
      if (ok) score++;
      marksTotal += max;
      if (ok) marksEarned += claimed;
      const disp = [`Scored ${claimed}/${max}`];
      rows.push({ questionId: q.id, given: JSON.stringify(disp), correct: ok });
      breakdown.push({ questionId: q.id, stem: q.stem, given: disp, correctAnswers: [`${max} marks`], explanation: q.explanation, ok, type: q.type, max, earned: ok ? claimed : 0 });
      continue;
    }

    const correct = gradeAnswer(correctArr, given, q.type);
    const max = maxFor(q, correctArr, parts);
    // Option weights (partial credit) where the author set them.
    let earned: number;
    if (["mcq", "multi_select", "true_false", "sct"].includes(q.type)) {
      const weights = safeArr((q as { optionMarks?: unknown }).optionMarks).map((v) => Number(v) || 0);
      const wm = gradeMarks({ type: q.type, options: safeArr((q as { options?: unknown }).options), correct: correctArr, given, optionMarks: weights, max });
      earned = late ? 0 : wm;
    } else {
      earned = late ? 0 : correct ? max : 0;
    }
    marksTotal += max;
    if (correct && !late) score++;
    if (earned) marksEarned += earned;
    rows.push({ questionId: q.id, given: JSON.stringify(given), correct: late ? false : correct });

    // Per-part detail for compound formats.
    let partRows: { stem: string; given: string[]; expected: string[]; ok: boolean }[] | undefined;
    if (["mtf", "emq", "matching", "kfq", "meq", "compound"].includes(q.type) && parts.length) {
      partRows = parts.map((p, i) => {
        const g = (given[i] ?? "").trim();
        const exp = correctArr[i] ?? "";
        const okPart = ["kfq", "meq", "compound"].includes(q.type) ? matchAny(g, exp) : g.toLowerCase() === exp.trim().toLowerCase();
        // Show accepted alternatives with " / ".
        const display = exp.split("||").map((x) => x.trim()).filter(Boolean).join(" / ") || "—";
        return { stem: p.stem ?? `Part ${i + 1}`, given: [g || "(blank)"], expected: [display], ok: okPart };
      });
    }
    breakdown.push({ questionId: q.id, stem: q.stem, given, correctAnswers: correctArr, explanation: q.explanation, ok: late ? false : correct, type: q.type, max, earned, ...(partRows ? { parts: partRows } : {}) });
  }

  const attempt = (await db.quizAttempt.create({
    data: { userId: user.id, mode: mode ?? "practice", filter: JSON.stringify({ topicId, subjectId, activityId, setId, late, violations: Math.max(0, Number(violations) || 0) }), score, total: rows.length, marksEarned, marksTotal, tookSecs: Math.max(0, Number(tookSecs) || 0) }
  }) as unknown as { id: string });
  for (const r of rows) {
    await db.attemptAnswer.create({ data: { attemptId: attempt.id, ...r } });
  }
  // Withheld scoring: examiner hides exact scores until release.
  const withheld = !!activitySettings && activitySettings.showScore === "hidden" && !activitySettings.resultsReleased;
  if (withheld) {
    return NextResponse.json({ attemptId: attempt.id, withheld: true, total: rows.length, late }, { status: 201 });
  }
  return NextResponse.json({ attemptId: attempt.id, score, total: rows.length, late, marksEarned, marksTotal, breakdown }, { status: 201 });
}

export async function GET(req: Request) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ attempts: [], weakAreas: {} });
  const attempts = (await db.quizAttempt.findMany({ where: { userId: user.id }, take: 20 }) as unknown as {
    id: string; mode: string; score: number; total: number; createdAt: string; filter: string;
    marksEarned?: number; marksTotal?: number;
  }[]);
  // Mask attempts whose activity withholds scores until the examiner releases.
  const maskedIds = new Set<string>();
  for (const a of attempts) {
    try {
      const f = JSON.parse(a.filter ?? "{}") as { activityId?: string };
      if (!f.activityId) continue;
      const act = (await db.activity.findUnique({ where: { id: f.activityId } }) as unknown as { showScore?: string; resultsReleased?: boolean } | null);
      if (act && act.showScore === "hidden" && !act.resultsReleased) maskedIds.add(a.id);
    } catch { /* ignore */ }
  }
  const byTopic: Record<string, { correct: number; total: number; name: string }> = {};
  const allAnswers: { questionId: string; correct: boolean }[] = [];
  const detailed: unknown[] = [];
  for (const a of attempts) {
    const answers = (await db.attemptAnswer.findMany({ where: { attemptId: a.id } }) as unknown as { questionId: string; correct: boolean }[]);
    if (maskedIds.has(a.id)) {
      detailed.push({ ...a, score: null, marksEarned: null, withheld: true, answers: [] });
      continue;
    }
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
