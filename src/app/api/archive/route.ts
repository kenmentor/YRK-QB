import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { activityContributors } from "@/lib/activity";

export const dynamic = "force-dynamic";

// Public archive: published activities + public folders. No login needed.
export async function GET() {
  const acts = (await db.activity.findMany({ where: { visibility: "public" }, take: 100, orderBy: { createdAt: "desc" } }) as unknown as {
    id: string; ownerId: string; title: string; banner?: string; details?: string; modes?: string; visibility?: string;
    category?: string; sector?: string; subject?: string; createdAt?: string;
  }[]);
  const activities = [];
  for (const a of acts) {
    const c = await activityContributors(a as unknown as Parameters<typeof activityContributors>[0]);
    let modes: string[] = [];
    try { modes = JSON.parse(a.modes ?? "[]"); } catch { modes = []; }
    activities.push({
      id: a.id, title: a.title, banner: a.banner ?? "indigo", details: a.details ?? "",
      modes: modes.length ? modes : ["practice", "selftest", "exam"],
      category: a.category ?? "tertiary", sector: a.sector ?? "", subject: a.subject ?? "",
      ownerName: c.owner.name, contributors: c.others, questionCount: c.total, createdAt: a.createdAt,
    });
  }
  const fols = (await db.folder.findMany({ where: { isPublic: true }, take: 100, orderBy: { createdAt: "desc" } }) as unknown as {
    id: string; name: string; ownerId: string; publicAccess?: string; createdAt?: string;
  }[]);
  const folders = [];
  for (const f of fols) {
    const o = (await db.user.findUnique({ where: { id: f.ownerId } }) as unknown as { name: string } | null);
    // Dominant category/sector by majority vote over live questions (≤200).
    const all = (await db.question.findMany({ where: { folderId: f.id, mergedIntoId: null }, take: 200 }) as unknown as { id: string; category?: string; sector?: string }[]);
    const catVotes = new Map<string, number>();
    const secVotes = new Map<string, number>();
    for (const qd of all) {
      if (qd.category) catVotes.set(qd.category, (catVotes.get(qd.category) ?? 0) + 1);
      if (qd.sector) secVotes.set(qd.sector, (secVotes.get(qd.sector) ?? 0) + 1);
    }
    const top = (m: Map<string, number>) => {
      let best = "";
      let n = 0;
      m.forEach((v, k) => { if (v > n) { n = v; best = k; } });
      return best;
    };
    folders.push({
      id: f.id, name: f.name, ownerId: f.ownerId, ownerName: o?.name ?? "Someone",
      publicAccess: f.publicAccess ?? "view", questionCount: all.length,
      category: top(catVotes) || "tertiary", sector: top(secVotes),
      createdAt: f.createdAt,
    });
  }
  return NextResponse.json({ activities, folders });
}
