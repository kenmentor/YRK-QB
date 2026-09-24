import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, getMembership } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Remove a member (owner only) or leave (self). Last owner is protected.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const { userId, action } = await req.json();
  const myRole = await getMembership(user.id, params.id);

  if (action === "leave") {
    if (!myRole) return NextResponse.json({ error: "Not a member" }, { status: 403 });
    if (myRole === "owner") {
      const owners = (await db.membership.findMany({ where: { workspaceId: params.id } }) as unknown as { userId: string; role: string }[]);
      if (owners.filter((m) => m.role === "owner").length <= 1) {
        return NextResponse.json({ error: "Last owner can't leave, transfer ownership first" }, { status: 409 });
      }
    }
    const mine = await db.membership.findFirst({ where: { userId: user.id, workspaceId: params.id } });
    if (mine) await db.membership.delete({ where: { id: (mine as { id: string }).id } });
    return NextResponse.json({ ok: true });
  }

  if (action === "remove") {
    if (myRole !== "owner") return NextResponse.json({ error: "Only owners remove members" }, { status: 403 });
    if (userId === user.id) return NextResponse.json({ error: "Use leave instead of removing yourself" }, { status: 400 });
    const target = (await db.membership.findFirst({ where: { userId, workspaceId: params.id } }) as unknown as { id: string; role: string } | null);
    if (!target) return NextResponse.json({ error: "Not a member" }, { status: 404 });
    if (target.role === "owner") {
      const owners = (await db.membership.findMany({ where: { workspaceId: params.id } }) as unknown as { role: string }[]);
      if (owners.filter((m) => m.role === "owner").length <= 1) {
        return NextResponse.json({ error: "Can't remove the last owner" }, { status: 409 });
      }
    }
    await db.membership.delete({ where: { id: target.id } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "action must be leave or remove" }, { status: 400 });
}
