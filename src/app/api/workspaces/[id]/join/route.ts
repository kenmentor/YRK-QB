import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, getMembership } from "@/lib/auth";
import { rateLimited } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const ROLES = ["editor", "reviewer"];

// Ask to join a workspace as editor or reviewer. Owners decide.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  if (rateLimited(req, "join", 10, 60 * 1000)) {
    return NextResponse.json({ error: "Slow down" }, { status: 429 });
  }
  const ws = await db.workspace.findUnique({ where: { id: params.id } });
  if (!ws) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const existing = await db.membership.findFirst({ where: { userId: user.id, workspaceId: params.id } });
  if (existing) return NextResponse.json({ error: "Already a member" }, { status: 409 });
  const { role, message } = await req.json();
  if (!ROLES.includes(role)) return NextResponse.json({ error: "Ask for editor or reviewer" }, { status: 400 });
  const pending = (await db.joinRequest.findMany({ where: { workspaceId: params.id } }) as unknown as { userId: string; status: string }[]);
  if (pending.some((r) => r.userId === user.id && r.status === "pending")) {
    return NextResponse.json({ error: "Request already pending" }, { status: 409 });
  }
  const jr = await db.joinRequest.create({
    data: { workspaceId: params.id, userId: user.id, role, message: message ?? "", status: "pending" }
  });
  return NextResponse.json(jr, { status: 201 });
}

// Owner inbox of join requests.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  if ((await getMembership(user.id, params.id)) !== "owner") {
    return NextResponse.json({ error: "Owners only" }, { status: 403 });
  }
  const list = (await db.joinRequest.findMany({ where: { workspaceId: params.id } }) as unknown as { id: string; userId: string; role: string; message: string; status: string }[]);
  const out = [];
  for (const r of list) {
    const u = (await db.user.findUnique({ where: { id: r.userId } }) as unknown as { name: string; email: string } | null);
    out.push({ ...r, user: u });
  }
  return NextResponse.json(out);
}
