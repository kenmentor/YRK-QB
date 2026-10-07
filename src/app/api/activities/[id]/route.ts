import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import {
  ACTIVITY_MODES, BANNERS, CURRICULUM, DEFAULT_RULES_PRACTICE, DEFAULT_RULES_TEST,
  activityContributors, activityRole, canViewActivity, parseAssembly, resolveActivity, strArr,
  type ActivityDoc,
} from "@/lib/activity";

export const dynamic = "force-dynamic";

async function load(id: string) {
  return (await db.activity.findUnique({ where: { id } }) as unknown as ActivityDoc & {
    title: string; banner?: string; details?: string; rulesPractice?: string; rulesTest?: string;
    modes?: string; visibility?: string; createdAt?: string;
  } | null);
}

// GET: meta (+ resolved full items when authorized to play).
// Public activities: meta for everyone (even logged out); items for logged-in viewers.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = (await getAuthUser(req) as unknown as { id: string; name: string } | null);
  const a = await load(params.id);
  if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const c = await activityContributors(a);
  const modes = strArr(a.modes);
  // My remaining exam attempts (null = untracked).
  let attemptsLeft: number | null = null;
  if (user && a.maxAttempts) {
    const mine = (await db.quizAttempt.findMany({ where: { userId: user.id }, take: 200 }) as unknown as { mode: string; filter: string }[]);
    let used = 0;
    for (const m of mine) {
      if (m.mode !== "exam") continue;
      try {
        if (JSON.parse(m.filter ?? "{}").activityId === a.id) used++;
      } catch { /* ignore */ }
    }
    attemptsLeft = Math.max(0, (a.maxAttempts as number) - used);
  }
  const meta = {
    id: a.id, ownerId: a.ownerId, title: a.title, banner: a.banner ?? "indigo",
    details: a.details ?? "",
    rulesPractice: a.rulesPractice || DEFAULT_RULES_PRACTICE,
    rulesTest: a.rulesTest || DEFAULT_RULES_TEST,
    modes: modes.length ? modes : [...ACTIVITY_MODES],
    visibility: a.visibility ?? "private",
    category: a.category ?? "tertiary", sector: a.sector ?? "", subject: a.subject ?? "",
    kind: a.kind ?? "quiz",
    timeLimitMinutes: a.timeLimitMinutes ?? null,
    maxAttempts: a.maxAttempts ?? null,
    shuffle: a.shuffle ?? false,
    showScore: a.showScore ?? "immediate",
    resultsReleased: !!(a as { resultsReleased?: boolean }).resultsReleased,
    availableFrom: a.availableFrom ?? null,
    availableUntil: a.availableUntil ?? null,
    attemptsLeft,
    ownerName: c.owner.name, contributors: c.others, questionCount: c.total,
    role: user ? await activityRole(user.id, a) : null,
  };
  if (!user) return NextResponse.json({ meta, items: null });
  if (!(await canViewActivity(user.id, a))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { items, skipped } = await resolveActivity(user.id, a);
  // Builders get raw assembly (explicit ids + folder links + names).
  let assembly = null;
  if (meta.role === "owner" || meta.role === "editor") {
    const stored = parseAssembly(a.assembly);
    const qIds = stored.length ? stored.filter((r) => r.kind === "q").map((r) => r.id) : strArr(a.questionIds);
    const fIds = stored.length ? stored.filter((r) => r.kind === "f").map((r) => r.id) : strArr(a.folderIds);
    const folderNames: Record<string, string> = {};
    for (const id of fIds) {
      const f = (await db.folder.findUnique({ where: { id } }) as unknown as { name: string } | null);
      if (f) folderNames[id] = f.name;
    }
    assembly = { questionIds: qIds, folderIds: fIds, folderNames, order: stored.length ? stored : null };
  }
  return NextResponse.json({ meta, items, skipped, assembly });
}

// PATCH: owner or activity editor. Profile, rules, modes, visibility, assembly.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const a = await load(params.id);
  if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const role = await activityRole(user.id, a);
  if (role !== "owner" && role !== "editor") return NextResponse.json({ error: "Not yours to edit" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (body.title !== undefined) {
    const t = String(body.title ?? "").trim().slice(0, 120);
    if (!t) return NextResponse.json({ error: "Title required" }, { status: 400 });
    data.title = t;
  }
  if (body.banner !== undefined && (BANNERS as readonly string[]).includes(body.banner)) data.banner = body.banner;
  if (body.details !== undefined) data.details = String(body.details ?? "").slice(0, 2000);
  if (body.rulesPractice !== undefined) data.rulesPractice = String(body.rulesPractice ?? "").slice(0, 2000);
  if (body.rulesTest !== undefined) data.rulesTest = String(body.rulesTest ?? "").slice(0, 2000);
  if (body.modes !== undefined) {
    const modes = (Array.isArray(body.modes) ? body.modes : []).filter((m: string) => (ACTIVITY_MODES as readonly string[]).includes(m));
    if (!modes.length) return NextResponse.json({ error: "Pick at least one mode" }, { status: 400 });
    data.modes = JSON.stringify(modes);
  }
  // Only the owner flips visibility.
  if (body.visibility !== undefined) {
    if (role !== "owner") return NextResponse.json({ error: "Only the owner publishes" }, { status: 403 });
    data.visibility = body.visibility === "public" ? "public" : "private";
  }
  // Examiner controls (owner-only): nature, timing, schedule, attempts, scoring.
  const EXAM_OWNER_KEYS = ["kind", "timeLimitMinutes", "maxAttempts", "shuffle", "showScore", "resultsReleased", "availableFrom", "availableUntil"] as const;
  const wantsExamKeys = EXAM_OWNER_KEYS.some((k) => body[k] !== undefined);
  if (wantsExamKeys && role !== "owner") return NextResponse.json({ error: "Only the owner sets exam controls" }, { status: 403 });
  if (body.kind !== undefined) {
    if (!["practice-set", "quiz", "mock", "exam"].includes(body.kind)) return NextResponse.json({ error: "Unknown activity kind" }, { status: 400 });
    data.kind = body.kind;
  }
  if (body.timeLimitMinutes !== undefined) {
    const v = body.timeLimitMinutes === null || body.timeLimitMinutes === "" ? null : Math.min(600, Math.max(1, Number(body.timeLimitMinutes) || 0));
    if (body.timeLimitMinutes !== null && body.timeLimitMinutes !== "" && !v) return NextResponse.json({ error: "Bad time limit" }, { status: 400 });
    data.timeLimitMinutes = v;
  }
  if (body.maxAttempts !== undefined) {
    const v = body.maxAttempts === null || body.maxAttempts === "" ? null : Math.min(100, Math.max(1, Math.round(Number(body.maxAttempts) || 0)));
    if (body.maxAttempts !== null && body.maxAttempts !== "" && !v) return NextResponse.json({ error: "Bad attempt limit" }, { status: 400 });
    data.maxAttempts = v;
  }
  if (body.shuffle !== undefined) data.shuffle = !!body.shuffle;
  if (body.showScore !== undefined) {
    if (!["immediate", "hidden"].includes(body.showScore)) return NextResponse.json({ error: "Score must be immediate or hidden" }, { status: 400 });
    data.showScore = body.showScore;
  }
  if (body.resultsReleased !== undefined) data.resultsReleased = !!body.resultsReleased;
  for (const k of ["availableFrom", "availableUntil"] as const) {
    if (body[k] !== undefined) {
      if (body[k] === null || body[k] === "") data[k] = null;
      else {
        const t = new Date(body[k]).getTime();
        if (isNaN(t)) return NextResponse.json({ error: "Bad schedule date" }, { status: 400 });
        data[k] = new Date(t).toISOString();
      }
    }
  }
  if (body.category !== undefined) {
    if (!(CURRICULUM as readonly string[]).includes(String(body.category))) return NextResponse.json({ error: "Unknown category" }, { status: 400 });
    data.category = String(body.category);
  }
  if (body.sector !== undefined) data.sector = String(body.sector ?? "").slice(0, 80);
  if (body.subject !== undefined) data.subject = String(body.subject ?? "").slice(0, 120);
  // Ordered mixed assembly [{kind:'q'|'f', id}]; legacy fields derived in order.
  if (body.assembly !== undefined) {
    const refs = parseAssembly(body.assembly).slice(0, 250);
    const qIds: string[] = [];
    const fIds: string[] = [];
    for (const ref of refs) {
      if (ref.kind === "q") {
        const q = (await db.question.findUnique({ where: { id: ref.id } }) as unknown as { mergedIntoId?: string } | null);
        if (!q || q.mergedIntoId) return NextResponse.json({ error: "A linked question is no longer live" }, { status: 400 });
        qIds.push(ref.id);
      } else {
        const f = (await db.folder.findUnique({ where: { id: ref.id } }) as unknown as { id: string } | null);
        if (!f) return NextResponse.json({ error: "A linked folder no longer exists" }, { status: 400 });
        fIds.push(ref.id);
      }
    }
    data.assembly = JSON.stringify(refs);
    data.questionIds = JSON.stringify(qIds);
    data.folderIds = JSON.stringify(fIds);
  }
  if (body.questionIds !== undefined) {
    const ids = Array.from(new Set(strArr(body.questionIds))).slice(0, 200);
    if (ids.length) {
      const live = (await db.question.findMany({ where: { id: { in: ids }, mergedIntoId: null } }) as unknown as { id: string }[]);
      const liveSet = new Set(live.map((q) => q.id));
      const dead = ids.filter((id) => !liveSet.has(id));
      if (dead.length) return NextResponse.json({ error: `${dead.length} question${dead.length === 1 ? " is" : "s are"} no longer live` }, { status: 400 });
    }
    data.questionIds = JSON.stringify(ids);
  }
  if (body.folderIds !== undefined) {
    const ids = Array.from(new Set(strArr(body.folderIds))).slice(0, 50);
    // Folders must exist; playability resolves at play time.
    for (const id of ids) {
      const f = (await db.folder.findUnique({ where: { id } }) as unknown as { id: string } | null);
      if (!f) return NextResponse.json({ error: "A linked folder no longer exists" }, { status: 400 });
    }
    data.folderIds = JSON.stringify(ids);
  }
  if (!Object.keys(data).length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  const updated = await db.activity.update({ where: { id: params.id }, data });
  return NextResponse.json(updated);
}

// DELETE: owner only. Questions stay in the bank.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const a = await load(params.id);
  if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (a.ownerId !== user.id) return NextResponse.json({ error: "Only the owner deletes" }, { status: 403 });
  await db.activityShare.deleteMany({ where: { activityId: params.id } });
  await db.activity.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
