import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { activityRole } from "@/lib/activity";

export const dynamic = "force-dynamic";

const ROLES = ["viewer", "editor"];

// GET: owner/editor lists activity shares.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const a = (await db.activity.findUnique({ where: { id: params.id } }) as unknown as { id: string; ownerId: string } | null);
  if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const role = await activityRole(user.id, a as unknown as Parameters<typeof activityRole>[1]);
  if (role !== "owner" && role !== "editor") return NextResponse.json({ error: "Not yours" }, { status: 403 });
  const shares = (await db.activityShare.findMany({ where: { activityId: params.id }, take: 200 }) as unknown as { id: string; userId: string; role: string }[]);
  const out = [];
  for (const s of shares) {
    const u = (await db.user.findUnique({ where: { id: s.userId } }) as unknown as { name: string; email: string } | null);
    out.push({ ...s, user: u ? { name: u.name, email: u.email } : null });
  }
  return NextResponse.json(out);
}

// POST { email, role }: owner invites (or re-roles) + notifies.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = (await getAuthUser(req) as unknown as { id: string; name: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const a = (await db.activity.findUnique({ where: { id: params.id } }) as unknown as { id: string; ownerId: string; title: string } | null);
  if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (a.ownerId !== user.id) return NextResponse.json({ error: "Only the owner adds people" }, { status: 403 });
  const { email, role } = await req.json().catch(() => ({}));
  if (!ROLES.includes(role)) return NextResponse.json({ error: "Role must be viewer or editor" }, { status: 400 });
  const target = (await db.user.findUnique({ where: { email: String(email ?? "").toLowerCase().trim() } }) as unknown as { id: string; name: string } | null);
  if (!target) return NextResponse.json({ error: "No account with that email — they must register first" }, { status: 404 });
  if (target.id === user.id) return NextResponse.json({ error: "That's your own activity" }, { status: 400 });
  const existing = (await db.activityShare.findFirst({ where: { activityId: params.id, userId: target.id } }) as unknown as { id: string } | null);
  const share = existing
    ? await db.activityShare.update({ where: { id: existing.id }, data: { role } })
    : await db.activityShare.create({ data: { activityId: params.id, ownerId: user.id, userId: target.id, role } });
  await db.notification.create({
    data: {
      userId: target.id, kind: "activity-share",
      title: "Added to an activity",
      body: `${user.name} added you as ${role} to “${a.title}”.`,
      link: "/play", read: false,
    },
  });
  return NextResponse.json(share, { status: 201 });
}

// DELETE ?shareId=: owner removes; invitee leaves their own.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const shareId = searchParams.get("shareId");
  if (!shareId) return NextResponse.json({ error: "shareId required" }, { status: 400 });
  const s = (await db.activityShare.findUnique({ where: { id: shareId } }) as unknown as { activityId: string; ownerId: string; userId: string } | null);
  if (!s || s.activityId !== params.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (s.ownerId !== user.id && s.userId !== user.id) return NextResponse.json({ error: "Not yours" }, { status: 403 });
  await db.activityShare.delete({ where: { id: shareId } });
  return NextResponse.json({ ok: true });
}
