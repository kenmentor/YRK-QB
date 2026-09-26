import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { annotateFolders, visibleFolders, type FolderDoc } from "@/lib/share";

export const dynamic = "force-dynamic";

// GET: my folders (access owner) + folders shared with me (access annotated).
export async function GET(req: Request) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const mine = (await db.folder.findMany({ where: { ownerId: user.id }, take: 500, orderBy: { createdAt: "asc" } }) as unknown as FolderDoc[]);
  const shares = (await db.folderShare.findMany({ where: { userId: user.id }, take: 200 }) as unknown as { ownerId: string }[]);
  const owners = Array.from(new Set(shares.map((s) => s.ownerId))).filter((id) => id !== user.id).slice(0, 20);
  let shared: FolderDoc[] = [];
  for (const oid of owners) {
    shared.push(...(await visibleFolders(user.id, oid)));
  }
  const annotated = await annotateFolders(user.id, [...mine, ...shared]);
  const out = [];
  for (const f of annotated) {
    if (!f.access) continue;
    let ownerName = "";
    if (f.ownerId !== user.id) {
      const o = (await db.user.findUnique({ where: { id: f.ownerId } }) as unknown as { name: string } | null);
      ownerName = o?.name ?? "Someone";
    }
    out.push({ ...f, shared: f.ownerId !== user.id, ownerName });
  }
  return NextResponse.json(out);
}

// POST: { name, parentId?, ownerId? } — parent must be owned by me, or shared
// with editor/reviewer access (new folder inherits the bank owner's id).
// ownerId without parentId files at another bank's root (needs root share).
export async function POST(req: Request) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const { name, parentId, ownerId } = await req.json().catch(() => ({}));
  const clean = String(name ?? "").trim().slice(0, 80);
  if (!clean) return NextResponse.json({ error: "Folder name required" }, { status: 400 });
  let parent: string | null = null;
  let owner = user.id;
  if (parentId) {
    const p = (await db.folder.findUnique({ where: { id: String(parentId) } }) as unknown as FolderDoc | null);
    if (!p) return NextResponse.json({ error: "Parent folder not found" }, { status: 404 });
    const { getFolderAccess, rankOf } = await import("@/lib/share");
    const access = await getFolderAccess(user.id, p);
    if (!access || rankOf(access) < 2) return NextResponse.json({ error: "No access to that folder" }, { status: 403 });
    parent = p.id;
    owner = p.ownerId;
  } else if (ownerId && String(ownerId) !== user.id) {
    const rootShare = (await db.folderShare.findFirst({ where: { userId: user.id, ownerId: String(ownerId), folderId: null } }) as unknown as { role: string } | null);
    if (!rootShare || !["reviewer", "editor"].includes(rootShare.role)) return NextResponse.json({ error: "No access to that bank" }, { status: 403 });
    owner = String(ownerId);
  }
  const created = await db.folder.create({ data: { ownerId: owner, name: clean, parentId: parent } });
  return NextResponse.json(created, { status: 201 });
}
