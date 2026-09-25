import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Directory: open spaces are public; invite-only spaces only show to members.
// Each row carries myRole so the UI groups Owner / Editor / Reviewer.
export async function GET(req: Request) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  const workspaces = (await db.workspace.findMany({ take: 100 }) as unknown as { id: string; visibility?: string }[]);
  const out = [];
  for (const w of workspaces) {
    const vis = w.visibility ?? "invite-only";
    let myRole: string | null = null;
    if (user) {
      const m = (await db.membership.findFirst({ where: { userId: user.id, workspaceId: w.id } }) as unknown as { role: string } | null);
      if (m) myRole = m.role;
    }
    if (vis === "open" || myRole) {
      const members = (await db.membership.findMany({ where: { workspaceId: w.id } }) as unknown as unknown[]);
      const drafts = (await db.questionDraft.findMany({ where: { workspaceId: w.id } }) as unknown as unknown[]);
      out.push({ ...w, visibility: vis, myRole, memberCount: members.length, draftCount: drafts.length });
    }
  }
  return NextResponse.json(out);
}

export async function POST(req: Request) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const body = await req.json();
  if (!body.name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 422 });
  const ws = await db.workspace.create({
    data: {
      name: body.name.trim(), focus: body.focus ?? "",
      examId: body.examId ?? null, subjectId: body.subjectId ?? null, topicId: body.topicId ?? null,
      visibility: body.visibility === "open" ? "open" : "invite-only"
    }
  });
  await db.membership.create({ data: { userId: user.id, workspaceId: (ws as { id: string }).id, role: "owner" } });
  return NextResponse.json(ws, { status: 201 });
}
