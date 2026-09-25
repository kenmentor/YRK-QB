import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, getMembership } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Owner approves (adds as editor/reviewer + notifies) or declines (notifies).
// Body: { decision: "approve" | "decline", message?: string }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const jr = (await db.joinRequest.findUnique({ where: { id: params.id } }) as unknown as {
    id: string; workspaceId: string; userId: string; role: string; status: string;
  } | null);
  if (!jr) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if ((await getMembership(user.id, jr.workspaceId)) !== "owner") {
    return NextResponse.json({ error: "Owners only" }, { status: 403 });
  }
  if (jr.status !== "pending") return NextResponse.json({ error: "Already decided" }, { status: 409 });
  const { decision, message } = await req.json();
  const ws = (await db.workspace.findUnique({ where: { id: jr.workspaceId } }) as unknown as { name: string } | null);

  if (decision === "approve") {
    await db.membership.create({ data: { userId: jr.userId, workspaceId: jr.workspaceId, role: jr.role } });
    await db.joinRequest.update({ where: { id: jr.id }, data: { status: "approved" } });
    await db.notification.create({
      data: { userId: jr.userId, kind: "decision", title: `Joined ${ws?.name ?? "workspace"}`, body: message?.trim() ? `Owner approved you as ${jr.role}. Message: ${message}` : `Owner approved you as ${jr.role}. Welcome in!`, link: `/workspaces/${jr.workspaceId}`, read: false }
    });
    return NextResponse.json({ ok: true });
  }
  if (decision === "decline") {
    await db.joinRequest.update({ where: { id: jr.id }, data: { status: "declined" } });
    await db.notification.create({
      data: { userId: jr.userId, kind: "decision", title: "Request declined", body: message?.trim() ? `Owner declined: ${message}` : "Owner declined this time. You can still browse the bank.", link: "/workspaces", read: false }
    });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Bad decision" }, { status: 400 });
}
