import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET() {
  const workspaces = await db.workspace.findMany({ take: 50 });
  return NextResponse.json(workspaces);
}

export async function POST(req: Request) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const body = await req.json();
  const ws = await db.workspace.create({
    data: { name: body.name, focus: body.focus ?? "", examId: body.examId ?? null }
  });
  await db.membership.create({ data: { userId: user.id, workspaceId: ws.id, role: "owner" } });
  return NextResponse.json(ws, { status: 201 });
}
