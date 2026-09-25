import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// My commits: every contribution I made, newest first, with subject names.
export async function GET(req: Request) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const list = (await db.proposal.findMany({ where: { contributorId: user.id }, take: 100 }) as unknown as {
    id: string; subjectId: string; status: string; payload: string; message: string; adminMessage?: string; createdAt: string;
  }[]);
  list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const out = [];
  for (const p of list) {
    const s = (await db.subject.findUnique({ where: { id: p.subjectId } }) as unknown as { name: string } | null);
    let stem = "";
    try { stem = (JSON.parse(p.payload) as { stem: string }).stem; } catch { /* keep blank */ }
    out.push({ ...p, subjectName: s?.name ?? "" });
  }
  return NextResponse.json(out);
}
