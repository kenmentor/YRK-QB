import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { getFolderAccess, rankOf, type FolderDoc } from "@/lib/share";

export const dynamic = "force-dynamic";

async function folderAccess(userId: string, id: string) {
  const f = (await db.folder.findUnique({ where: { id } }) as unknown as FolderDoc | null);
  if (!f) return { folder: null, access: null };
  return { folder: f, access: await getFolderAccess(userId, f) };
}

// Walk ancestors of `id`; returns true if `maybeAncestor` is an ancestor (cycle check).
async function isDescendant(maybeAncestor: string, id: string): Promise<boolean> {
  let cur: string | null | undefined = id;
  const seen = new Set<string>();
  while (cur) {
    if (seen.has(cur)) break;
    seen.add(cur);
    if (cur === maybeAncestor) return true;
    const f = (await db.folder.findUnique({ where: { id: cur } }) as unknown as { parentId?: string | null } | null);
    cur = f?.parentId ?? null;
  }
  return false;
}

// PATCH: rename needs editor+; reparent needs folder ownership + editor+ on dest.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const { folder: f, access } = await folderAccess(user.id, params.id);
  if (!f || !access) return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) {
    if (rankOf(access) < 3) return NextResponse.json({ error: "Editors and above rename folders" }, { status: 403 });
    const clean = String(body.name ?? "").trim().slice(0, 80);
    if (!clean) return NextResponse.json({ error: "Folder name required" }, { status: 400 });
    data.name = clean;
  }
  // Publishing: owner-only. publicAccess view = read-only browsing,
  // use = playable + addable to activities.
  if (body.isPublic !== undefined || body.publicAccess !== undefined) {
    if (access !== "owner") return NextResponse.json({ error: "Only the folder owner publishes" }, { status: 403 });
    if (body.isPublic !== undefined) data.isPublic = !!body.isPublic;
    if (body.publicAccess !== undefined) {
      if (!["view", "use"].includes(body.publicAccess)) return NextResponse.json({ error: "Access must be view or use" }, { status: 400 });
      data.publicAccess = body.publicAccess;
    }
  }
  if (body.parentId !== undefined) {    // Only the folder's owner reparents it (editors can't drag it away).
    if (access !== "owner") return NextResponse.json({ error: "Only the folder owner moves it" }, { status: 403 });
    if (body.parentId === null || body.parentId === "") {
      if (f.ownerId !== user.id) return NextResponse.json({ error: "Only the folder owner moves it" }, { status: 403 });
      data.parentId = null;
    } else {
      const target = String(body.parentId);
      if (target === params.id) return NextResponse.json({ error: "Can't move a folder into itself" }, { status: 400 });
      const p = (await db.folder.findUnique({ where: { id: target } }) as unknown as FolderDoc | null);
      if (!p) return NextResponse.json({ error: "Destination not found" }, { status: 404 });
      const destAccess = await getFolderAccess(user.id, p);
      if (!destAccess || rankOf(destAccess) < 3) return NextResponse.json({ error: "Can't move there" }, { status: 403 });
      if (p.ownerId !== f.ownerId) return NextResponse.json({ error: "Can't move across banks" }, { status: 400 });
      if (await isDescendant(params.id, target)) return NextResponse.json({ error: "Can't move a folder into its own subfolder" }, { status: 400 });
      data.parentId = target;
    }
  }
  if (!Object.keys(data).length) return NextResponse.json(f);
  const updated = await db.folder.update({ where: { id: params.id }, data });
  return NextResponse.json(updated);
}

// DELETE: only the folder owner, and only when empty.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const { folder: f, access } = await folderAccess(user.id, params.id);
  if (!f || !access) return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  if (access !== "owner") return NextResponse.json({ error: "Only the folder owner deletes it" }, { status: 403 });
  const kids = await db.folder.findMany({ where: { ownerId: f.ownerId, parentId: params.id }, take: 1 });
  if (kids.length) return NextResponse.json({ error: "Folder isn't empty — move or delete its subfolders first" }, { status: 400 });
  const files = await db.question.findMany({ where: { folderId: params.id }, take: 1 });
  if (files.length) return NextResponse.json({ error: "Folder isn't empty — move or delete its questions first" }, { status: 400 });
  await db.folder.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
