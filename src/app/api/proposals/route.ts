import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { normalizeStem } from "@/lib/types";

export const dynamic = "force-dynamic";

// Admin inbox: list proposals (pending by default)
export async function GET(req: Request) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const me = (await db.user.findUnique({ where: { id: user.id } }) as unknown as { role: string });
  if (me?.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "pending";
  const list = (await db.proposal.findMany({ where: { status } }) as unknown as Record<string, unknown>[]);
  const out = [];
  for (const p of list as unknown as { id: string; contributorId: string; subjectId: string; payload: string }[]) {
    const c = (await db.user.findUnique({ where: { id: p.contributorId } }) as unknown as { name: string; email: string } | null);
    const s = (await db.subject.findUnique({ where: { id: p.subjectId } }) as unknown as { name: string } | null);
    out.push({ ...(p as object), contributor: c, subject: s });
  }
  return NextResponse.json(out);
}

// Admin decision. Body: { decision: "commit" | "cancel", message?: string }
export async function POST(req: Request) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const me = (await db.user.findUnique({ where: { id: user.id } }) as unknown as { role: string });
  if (me?.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  void searchParams;
  return NextResponse.json({ error: "Use /api/proposals/[id]/decision" }, { status: 400 });
}
