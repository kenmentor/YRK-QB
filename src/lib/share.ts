import { db } from "./db";

export type ShareRole = "viewer" | "reviewer" | "editor";
export type Access = "owner" | ShareRole;

const RANK: Record<string, number> = { viewer: 1, reviewer: 2, editor: 3, owner: 4 };

export function rankOf(a: string): number {
  return RANK[a] ?? 0;
}

export interface ShareDoc {
  id: string;
  folderId?: string | null;
  ownerId: string;
  userId: string;
  role: ShareRole;
}

export interface FolderRef {
  id: string;
  ownerId: string;
  parentId?: string | null;
}

export interface FolderDoc extends FolderRef {
  name: string;
}

// Walk a folder's ancestry (ids, nearest first) within one owner's tree.
export async function ancestorIds(folder: FolderRef): Promise<string[]> {
  const ids: string[] = [];
  const seen = new Set<string>();
  let cur: string | null | undefined = folder.parentId ?? null;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    ids.push(cur);
    const p = (await db.folder.findUnique({ where: { id: cur } }) as unknown as FolderDoc | null);
    if (!p || p.ownerId !== folder.ownerId) break;
    cur = p.parentId ?? null;
  }
  return ids;
}

// Effective access of userId to a folder doc. Owner always wins; otherwise
// the highest applicable share (root share, or a share on the folder or any
// ancestor within the same owner's tree).
export async function getFolderAccess(userId: string, folder: FolderRef): Promise<Access | null> {
  if (folder.ownerId === userId) return "owner";
  const shares = (await db.folderShare.findMany({ where: { userId }, take: 200 }) as unknown as ShareDoc[]);
  const mine = shares.filter((s) => s.ownerId === folder.ownerId);
  if (!mine.length) return null;
  if (mine.some((s) => !s.folderId)) return topRole(mine.filter((s) => !s.folderId));
  const chain = new Set([folder.id, ...(await ancestorIds(folder))]);
  const hits = mine.filter((s) => s.folderId && chain.has(s.folderId));
  if (!hits.length) return null;
  return topRole(hits);
}

function topRole(shares: ShareDoc[]): ShareRole {
  let best: ShareRole = "viewer";
  for (const s of shares) {
    if (rankOf(s.role) > rankOf(best)) best = s.role;
  }
  return best;
}

// Annotate folders with the viewer's access (for tree/contents responses).
export async function annotateFolders(userId: string, folders: FolderDoc[]): Promise<(FolderDoc & { access: Access | null })[]> {
  const shares = (await db.folderShare.findMany({ where: { userId }, take: 200 }) as unknown as ShareDoc[]);
  // Ancestry per owner, built once.
  const byOwner = new Map<string, FolderDoc[]>();
  for (const f of folders) {
    if (!byOwner.has(f.ownerId)) byOwner.set(f.ownerId, []);
    byOwner.get(f.ownerId)!.push(f);
  }
  const parentOf = new Map<string, string | null>();
  for (const f of folders) parentOf.set(f.id, f.parentId ?? null);
  const chainOf = (f: FolderDoc): Set<string> => {
    const chain = new Set<string>([f.id]);
    let cur = f.parentId ?? null;
    const seen = new Set<string>();
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      chain.add(cur);
      cur = parentOf.get(cur) ?? null;
    }
    return chain;
  };
  return folders.map((f) => {
    if (f.ownerId === userId) return { ...f, access: "owner" as Access };
    const mine = shares.filter((s) => s.ownerId === f.ownerId);
    if (!mine.length) return { ...f, access: null };
    const roots = mine.filter((s) => !s.folderId);
    if (roots.length) return { ...f, access: topRole(roots) };
    const chain = chainOf(f);
    const hits = mine.filter((s) => s.folderId && chain.has(s.folderId));
    return { ...f, access: hits.length ? topRole(hits) : null };
  });
}

// All folders of an owner visible to userId (subtrees of shared roots).
export async function visibleFolders(userId: string, ownerId: string): Promise<FolderDoc[]> {
  const all = (await db.folder.findMany({ where: { ownerId }, take: 500, orderBy: { createdAt: "asc" } }) as unknown as FolderDoc[]);
  if (ownerId === userId) return all;
  const shares = (await db.folderShare.findMany({ where: { userId }, take: 200 }) as unknown as ShareDoc[]);
  const mine = shares.filter((s) => s.ownerId === ownerId);
  if (!mine.length) return [];
  if (mine.some((s) => !s.folderId)) return all;
  const parentOf = new Map(all.map((f) => [f.id, f.parentId ?? null] as const));
  const chainOf = (f: FolderDoc): Set<string> => {
    const chain = new Set<string>([f.id]);
    let cur = f.parentId ?? null;
    const seen = new Set<string>();
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      chain.add(cur);
      cur = parentOf.get(cur) ?? null;
    }
    return chain;
  };
  const roots = new Set(mine.map((s) => s.folderId).filter(Boolean) as string[]);
  return all.filter((f) => {
    const chain = chainOf(f);
    let hit = false;
    roots.forEach((r) => { if (chain.has(r)) hit = true; });
    return hit;
  });
}
