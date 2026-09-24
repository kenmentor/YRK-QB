import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, getMembership, getSessionUser } from "@/lib/auth";
import { canInvite } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const ROLES = ["owner", "editor", "reviewer"];

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const role = await getMembership(user.id, params.id);
  if (!canInvite(role)) return NextResponse.json({ error: "Only owner can invite" }, { status: 403 });
  const { email: inviteEmail, role: inviteRole } = await req.json();
  if (!ROLES.includes(inviteRole)) return NextResponse.json({ error: "Bad role" }, { status: 400 });
  // Existing accounts only, typos 404 instead of minting ghost accounts.
  const invitee = (await getSessionUser(inviteEmail) as unknown as { id: string } | null);
  if (!invitee) return NextResponse.json({ error: "No account with that email, ask them to register first" }, { status: 404 });
  const existing = (await db.membership.findFirst({ where: { userId: invitee.id, workspaceId: params.id } }) as unknown as { id: string } | null);
  const membership = existing
    ? await db.membership.update({ where: { id: existing.id }, data: { role: inviteRole } })
    : await db.membership.create({ data: { userId: invitee.id, workspaceId: params.id, role: inviteRole } });
  return NextResponse.json(membership, { status: 201 });
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const ws = (await db.workspace.findUnique({ where: { id: params.id } }) as unknown as { id: string; name: string } | null);
  if (!ws) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Unreviewed drafts are private to the team.
  const role = await getMembership(user.id, params.id);
  if (!role) return NextResponse.json({ error: "Not a member of this workspace" }, { status: 403 });
  const drafts = await db.questionDraft.findMany({ where: { workspaceId: params.id } });
  const memberships = await db.membership.findMany({ where: { workspaceId: params.id } });
  const withUsers = [];
  for (const m of memberships as unknown as { id: string; userId: string; role: string }[]) {
    const u = (await db.user.findUnique({ where: { id: m.userId } }) as unknown as { email: string; name: string } | null);
    withUsers.push({ ...m, user: u });
  }
  return NextResponse.json({ ...ws, drafts, memberships: withUsers });
}

// Owner deletes the whole workspace (drafts, versions, comments, reviews,
// memberships and its merge records go with it, published bank questions stay).
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const role = await getMembership(user.id, params.id);
  if (role !== "owner") return NextResponse.json({ error: "Only owners delete workspaces" }, { status: 403 });
  const { confirm } = await req.json().catch(() => ({ confirm: false }));
  if (confirm !== true) return NextResponse.json({ error: "Send { confirm: true }" }, { status: 400 });
  const drafts = (await db.questionDraft.findMany({ where: { workspaceId: params.id } }) as unknown as { id: string }[]);
  for (const d of drafts) {
    await db.questionVersion.deleteMany({ where: { draftId: d.id } });
    await db.comment.deleteMany({ where: { draftId: d.id } });
    await db.review.deleteMany({ where: { draftId: d.id } });
    await db.questionDraft.delete({ where: { id: d.id } });
  }
  await db.membership.deleteMany({ where: { workspaceId: params.id } });
  await db.mergeRecord.deleteMany({ where: { workspaceId: params.id } });
  await db.workspace.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
