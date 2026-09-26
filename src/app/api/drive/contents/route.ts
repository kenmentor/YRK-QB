import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { getFolderAccess, type FolderDoc } from "@/lib/share";

export const dynamic = "force-dynamic";

// GET /api/drive/contents?folderId=<id>&ownerId=<id>.
// Own bank: folders mine + questions I created at this level.
// Shared: `ownerId` (root of their bank) or a shared folderId — children of
// the bank owner, files scoped by folder (contributors included).
// Public: logged-out read of isPublic folders (viewer; public subfolders only).
// Always returns { folders, questions, breadcrumbs, current, access, owner }.
export async function GET(req: Request) {
  const user = (await getAuthUser(req) as unknown as { id: string; name: string } | null);
  const { searchParams } = new URL(req.url);
  const folderId = searchParams.get("folderId") || null;
  const explicitOwner = searchParams.get("ownerId") || null;
  // When opening a folder directly, its bank is authoritative (lets shared
  // and public folders resolve without passing ownerId around).
  let ownerId: string | null = explicitOwner || user?.id || null;
  if (folderId && !explicitOwner) {
    const probe = (await db.folder.findUnique({ where: { id: folderId } }) as unknown as FolderDoc | null);
    if (probe) ownerId = probe.ownerId;
  }
  if (!ownerId && !folderId) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const shared = !!user && !!ownerId && ownerId !== user.id;

  // Owner display.
  let ownerName = user?.name ?? "Someone";
  if (ownerId && (!user || ownerId !== user.id)) {
    const o = (await db.user.findUnique({ where: { id: ownerId } }) as unknown as { name: string } | null);
    if (!o) return NextResponse.json({ error: "Bank not found" }, { status: 404 });
    ownerName = o.name;
  }

  let current: FolderDoc | null = null;
  let access = "";
  let viaShare = false;
  if (folderId) {
    const f = (await db.folder.findUnique({ where: { id: folderId } }) as unknown as FolderDoc & { isPublic?: boolean } | null);
    if (!f || (ownerId && f.ownerId !== ownerId)) return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    current = f;
    if (user && f.ownerId === user.id) { access = "owner"; viaShare = true; }
    else if (user) {
      const a = await getFolderAccess(user.id, f);
      if (a) { access = a; viaShare = true; }
    }
    // Public fallback: logged-out (or no-share) viewers may read public folders.
    if (!access && f.isPublic) access = "viewer";
    if (!access) return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  } else if (shared) {
    // Root share required for another bank's root.
    const rootShare = (await db.folderShare.findFirst({ where: { userId: user!.id, ownerId, folderId: null } }) as unknown as { role: string } | null);
    if (!rootShare) return NextResponse.json({ error: "Bank not found" }, { status: 404 });
    access = rootShare.role;
    viaShare = true;
  } else if (user) {
    access = "owner";
    viaShare = true;
  }

  // Effective bank owner (logged-out public reads resolve from the folder).
  const bankOwner = ownerId ?? current?.ownerId ?? null;
  if (!bankOwner) return NextResponse.json({ error: "Login required" }, { status: 401 });

  const folders = (await db.folder.findMany({
    where: folderId ? { ownerId: bankOwner, parentId: folderId } : { ownerId: bankOwner, parentId: null },
    take: 500,
    orderBy: { createdAt: "asc" },
  }) as unknown as { id: string; name: string; createdAt?: string; isPublic?: boolean }[]);
  // Public viewers (no grant) only see public subfolders.
  const visibleFolders = !viaShare
    ? folders.filter((f) => f.isPublic)
    : folders;

  // Files filed at this level. Own bank: everything here is mine or was
  // contributed into my shared space. Shared space: everything filed here
  // (owner's + contributors'), so shared work shows.
  // NOTE: where { folderId: null } matches root-level docs (incl. legacy
  // docs without the field, since Mongo treats missing == null).
  const questions = (await db.question.findMany({
    where: { mergedIntoId: null, folderId },
    take: 500,
    orderBy: { createdAt: "desc" },
  }) as unknown as { id: string; creatorId?: string; folderId?: string | null }[]);

  // Breadcrumb trail root → current (within the viewed bank).
  const breadcrumbs: { id: string | null; name: string; ownerId: string }[] = [
    { id: null, name: shared ? `${ownerName}'s bank` : "My Bank", ownerId: bankOwner },
  ];
  if (current) {
    const trail: { id: string; name: string; ownerId: string }[] = [];
    let cur: FolderDoc | null = current;
    const seen = new Set<string>();
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      trail.unshift({ id: cur.id, name: cur.name, ownerId: bankOwner });
      if (!cur.parentId) break;
      const p = (await db.folder.findUnique({ where: { id: cur.parentId } }) as unknown as FolderDoc | null);
      cur = p && p.ownerId === bankOwner ? p : null;
    }
    breadcrumbs.push(...trail);
  }

  // Shared entries for my own root: folders shared with me + shared banks.
  let sharedEntries: { kind: "folder" | "bank"; id: string | null; name: string; ownerId: string; ownerName: string; role: string }[] = [];
  if (user && !folderId && !shared) {
    const shares = (await db.folderShare.findMany({ where: { userId: user.id }, take: 200 }) as unknown as { folderId?: string | null; ownerId: string; role: string }[]);
    const seenBank = new Set<string>();
    for (const s of shares) {
      if (!s.folderId) {
        if (seenBank.has(s.ownerId)) continue;
        seenBank.add(s.ownerId);
        const o = (await db.user.findUnique({ where: { id: s.ownerId } }) as unknown as { name: string } | null);
        sharedEntries.push({ kind: "bank", id: null, name: `${o?.name ?? "Someone"}'s bank`, ownerId: s.ownerId, ownerName: o?.name ?? "Someone", role: s.role });
      } else {
        const f = (await db.folder.findUnique({ where: { id: s.folderId } }) as unknown as FolderDoc | null);
        if (!f || f.ownerId !== s.ownerId) continue;
        const o = (await db.user.findUnique({ where: { id: s.ownerId } }) as unknown as { name: string } | null);
        sharedEntries.push({ kind: "folder", id: f.id, name: f.name, ownerId: s.ownerId, ownerName: o?.name ?? "Someone", role: s.role });
      }
    }
  }

  return NextResponse.json({
    folders: visibleFolders, questions, breadcrumbs, current,
    access, owner: { id: bankOwner, name: ownerName, shared },
    sharedEntries,
  });
}
