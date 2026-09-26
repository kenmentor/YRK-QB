import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { isBankQuestion } from "@/lib/shape";

export const dynamic = "force-dynamic";

async function ownedSet(userId: string, id: string) {
  const s = (await db.examSet.findUnique({ where: { id } }) as unknown as { id: string; ownerId: string } | null);
  if (!s || s.ownerId !== userId) return null;
  return s;
}

function parseIds(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === "string") {
    try {
      const a = JSON.parse(raw);
      return Array.isArray(a) ? a.map(String).filter(Boolean) : [];
    } catch { return []; }
  }
  return [];
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const s = (await db.examSet.findUnique({ where: { id: params.id } }) as unknown as { ownerId: string; questionIds?: string } | null);
  if (!s || s.ownerId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Enrich with ordered live questions (dead/aliased ids flagged, not dropped here).
  // Full payload (options/correct/parts/guide) is included: this route is
  // owner-only, and Play practice/self-test needs answers client-side.
  const ids = parseIds(s.questionIds);
  const live = ids.length
    ? ((await db.question.findMany({ where: { id: { in: ids }, mergedIntoId: null } }) as unknown as { id: string; stem: string; type: string; difficulty: string; options: string; correct: string; parts?: string; explanation: string }[])).filter(isBankQuestion)
    : [];
  const byId = new Map(live.map((q) => [q.id, q]));
  const questions = ids.map((id) => byId.get(id) ?? { id, stem: "(removed from bank)", type: "missing", difficulty: "—" });
  return NextResponse.json({ set: s, questions });
}

// PATCH: profile fields and/or ordered questionIds (validated live).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  if (!(await ownedSet(user.id, params.id))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  for (const k of ["title", "institution", "department", "domain", "level", "term", "subject"] as const) {
    if (body[k] !== undefined) data[k] = String(body[k] ?? "").slice(0, 120);
  }
  if (data.title === "") return NextResponse.json({ error: "Exam title required" }, { status: 400 });
  if (body.questionIds !== undefined) {
    const ids = Array.from(new Set(parseIds(body.questionIds))).slice(0, 200);
    if (ids.length) {
      const live = (await db.question.findMany({ where: { id: { in: ids }, mergedIntoId: null } }) as unknown as { id: string }[]);
      const liveSet = new Set(live.map((q) => q.id));
      const dead = ids.filter((id) => !liveSet.has(id));
      if (dead.length) return NextResponse.json({ error: `${dead.length} question${dead.length === 1 ? " is" : "s are"} no longer in the bank` }, { status: 400 });
    }
    data.questionIds = JSON.stringify(ids);
  }
  if (!Object.keys(data).length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  const updated = await db.examSet.update({ where: { id: params.id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  if (!(await ownedSet(user.id, params.id))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.examSet.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
