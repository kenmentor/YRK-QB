import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { ACTIVITY_MODES, BANNERS, activityContributors, strArr } from "@/lib/activity";

export const dynamic = "force-dynamic";

// GET /api/activities?scope=mine|shared|public — Play listing.
export async function GET(req: Request) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") ?? "mine";

  if (scope === "mine") {
    const mine = await db.activity.findMany({ where: { ownerId: user.id }, take: 100, orderBy: { createdAt: "desc" } });
    return NextResponse.json(await withMeta(mine as unknown as MetaDoc[]));
  }
  if (scope === "shared") {
    const shares = (await db.activityShare.findMany({ where: { userId: user.id }, take: 100 }) as unknown as { activityId: string; role: string }[]);
    const out = [];
    for (const s of shares) {
      const a = (await db.activity.findUnique({ where: { id: s.activityId } }) as unknown as MetaDoc | null);
      if (a) out.push({ ...(await meta(a)), role: s.role });
    }
    return NextResponse.json(out);
  }
  // public: every published activity.
  const pub = (await db.activity.findMany({ where: { visibility: "public" }, take: 100, orderBy: { createdAt: "desc" } }) as unknown as MetaDoc[]);
  return NextResponse.json(await withMeta(pub.filter((a) => a.ownerId !== user.id)));
}

interface MetaDoc { id: string; ownerId: string; title: string; banner?: string; details?: string; modes?: string[] | string; visibility?: string; category?: string; sector?: string; subject?: string; createdAt?: string; }

async function meta(a: MetaDoc) {
  const c = await activityContributors(a as unknown as Parameters<typeof activityContributors>[0]);
  const modes = Array.isArray(a.modes) ? a.modes : strArr(a.modes);
  return {
    id: a.id, ownerId: a.ownerId, title: a.title, banner: a.banner ?? "indigo",
    details: a.details ?? "", modes: modes.length ? modes : [...ACTIVITY_MODES],
    visibility: a.visibility ?? "private",
    category: a.category ?? "tertiary", sector: a.sector ?? "", subject: a.subject ?? "",
    createdAt: a.createdAt,
    ownerName: c.owner.name, contributors: c.others, questionCount: c.total,
  };
}

async function withMeta(list: MetaDoc[]) {
  const out = [];
  for (const a of list) out.push(await meta(a));
  return out;
}

// POST: create an activity shell (builder fills it in).
export async function POST(req: Request) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const title = String(body.title ?? "").trim().slice(0, 120);
  if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 });
  const banner = (BANNERS as readonly string[]).includes(body.banner) ? body.banner : "indigo";
  const created = await db.activity.create({
    data: {
      ownerId: user.id, title, banner,
      details: String(body.details ?? "").slice(0, 2000),
      rulesPractice: "", rulesTest: "",
      modes: JSON.stringify((Array.isArray(body.modes) ? body.modes : [...ACTIVITY_MODES]).filter((m: string) => (ACTIVITY_MODES as readonly string[]).includes(m))),
      visibility: body.visibility === "public" ? "public" : "private",
      category: String(body.category ?? "tertiary").slice(0, 40),
      sector: String(body.sector ?? "").slice(0, 80),
      subject: String(body.subject ?? "").slice(0, 120),
      assembly: JSON.stringify([]),
      questionIds: JSON.stringify([]), folderIds: JSON.stringify([]),
    },
  });
  return NextResponse.json(created, { status: 201 });
}
