import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const q = (await db.question.findUnique({ where: { id: params.id } }) as unknown as {
    id: string; stem: string; options: string; correct: string; explanation: string;
    difficulty: string; type: string; creatorId?: string; allowApplications?: boolean; editorIds?: string;
  } | null);
  if (!q || (q as { mergedIntoId?: string }).mergedIntoId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  let creator = null;
  if (q.creatorId) creator = await db.user.findUnique({ where: { id: q.creatorId } });
  let editors: { id: string; name: string; email: string }[] = [];
  try {
    const ids = JSON.parse(q.editorIds ?? "[]") as string[];
    for (const eid of ids.slice(0, 10)) {
      const u = (await db.user.findUnique({ where: { id: eid } }) as unknown as { id: string; name: string; email: string } | null);
      if (u) editors.push(u);
    }
  } catch { /* ignore */ }
  return NextResponse.json({ question: q, creator, editors });
}

// Creator toggles appliable. Body: { allowApplications: boolean }
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = (await getAuthUser(req) as unknown as { id: string; role: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const q = (await db.question.findUnique({ where: { id: params.id } }) as unknown as { creatorId?: string } | null);
  if (!q) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { allowApplications } = await req.json();
  const me = (await db.user.findUnique({ where: { id: user.id } }) as unknown as { role: string });
  // Unclaimed legacy questions can only be claimed by admins, otherwise
  // the first visitor to find one would own it.
  if (!q.creatorId) {
    if (me?.role !== "admin") return NextResponse.json({ error: "Unclaimed question, ask an admin to assign it" }, { status: 403 });
    const updated = await db.question.update({ where: { id: params.id }, data: { creatorId: user.id, allowApplications: !!allowApplications } });
    return NextResponse.json(updated);
  }
  if (q.creatorId !== user.id && me?.role !== "admin") return NextResponse.json({ error: "Only the creator can change appliable" }, { status: 403 });
  const updated = await db.question.update({ where: { id: params.id }, data: { allowApplications: !!allowApplications } });
  return NextResponse.json(updated);
}
