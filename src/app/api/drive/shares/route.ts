import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ROLES = ["viewer", "reviewer", "editor"];

// GET /api/drive/shares?folderId=<id> (absent = bank root). Owner lists shares they granted.
export async function GET(req: Request) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const folderId = searchParams.get("folderId") || null;

  if (folderId) {
    const f = (await db.folder.findUnique({ where: { id: folderId } }) as unknown as { ownerId: string } | null);
    if (!f || f.ownerId !== user.id) return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }
  const shares = (await db.folderShare.findMany({ where: { ownerId: user.id, folderId }, take: 200 }) as unknown as { id: string; userId: string; role: string }[]);
  const out = [];
  for (const s of shares) {
    const u = (await db.user.findUnique({ where: { id: s.userId } }) as unknown as { name: string; email: string } | null);
    out.push({ ...s, user: u ? { name: u.name, email: u.email } : null });
  }
  return NextResponse.json(out);
}

// POST { email, role, folderId? } — owner invites (or re-roles). Unknown emails 404.
export async function POST(req: Request) {
  const user = (await getAuthUser(req) as unknown as { id: string; name: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const { email, role, folderId } = await req.json().catch(() => ({}));
  if (!ROLES.includes(role)) return NextResponse.json({ error: "Role must be viewer, reviewer, or editor" }, { status: 400 });
  const target = (await db.user.findUnique({ where: { email: String(email ?? "").toLowerCase().trim() } }) as unknown as { id: string; name: string } | null);
  if (!target) return NextResponse.json({ error: "No account with that email — they must register first" }, { status: 404 });
  if (target.id === user.id) return NextResponse.json({ error: "That's your own bank" }, { status: 400 });

  let scopeName = "bank root";
  const fid = folderId ? String(folderId) : null;
  if (fid) {
    const f = (await db.folder.findUnique({ where: { id: fid } }) as unknown as { ownerId: string; name: string } | null);
    if (!f || f.ownerId !== user.id) return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    scopeName = `folder “${f.name}”`;
  }
  const existing = (await db.folderShare.findFirst({ where: { ownerId: user.id, folderId: fid, userId: target.id } }) as unknown as { id: string } | null);
  const share = existing
    ? await db.folderShare.update({ where: { id: existing.id }, data: { role } })
    : await db.folderShare.create({ data: { ownerId: user.id, folderId: fid, userId: target.id, role } });
  await db.notification.create({
    data: {
      userId: target.id, kind: "share",
      title: existing ? "Bank share updated" : "Bank shared with you",
      body: `${user.name} gave you ${role} access to ${scopeName}.`,
      link: "/bank", read: false,
    },
  });
  return NextResponse.json(share, { status: 201 });
}
