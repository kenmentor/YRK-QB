import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { getFolderAccess, rankOf, type FolderDoc } from "@/lib/share";

export const dynamic = "force-dynamic";

// POST /api/drive/folders/[id]/copy { parentId? } — deep copy in place.
// Copies inherit the destination bank owner; copied files credit the copier.
// Caps: 50 folders, 200 questions.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const src = (await db.folder.findUnique({ where: { id: params.id } }) as unknown as FolderDoc | null);
  if (!src) return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  const access = await getFolderAccess(user.id, src);
  if (!access || rankOf(access) < 2) return NextResponse.json({ error: "No access to copy that" }, { status: 403 });

  const { parentId } = await req.json().catch(() => ({}));
  let parent: string | null = src.parentId ?? null;
  let ownerId = src.ownerId;
  if (parentId !== undefined) {
    if (parentId === null || parentId === "") {
      parent = null;
      ownerId = user.id;
    } else {
      const dest = (await db.folder.findUnique({ where: { id: String(parentId) } }) as unknown as FolderDoc | null);
      if (!dest) return NextResponse.json({ error: "Destination not found" }, { status: 404 });
      const destAccess = await getFolderAccess(user.id, dest);
      if (!destAccess || rankOf(destAccess) < 2) return NextResponse.json({ error: "No access to that destination" }, { status: 403 });
      parent = dest.id;
      ownerId = dest.ownerId;
    }
  }

  let folders = 0;
  let questions = 0;
  async function copyFolder(srcId: string, destParent: string | null, owner: string, topName?: string): Promise<string> {
    if (++folders > 50) throw new Error("Too many folders (max 50)");
    const s = (await db.folder.findUnique({ where: { id: srcId } }) as unknown as FolderDoc | null);
    if (!s) throw new Error("Source vanished");
    const created = (await db.folder.create({ data: { ownerId: owner, name: (topName ?? s.name).slice(0, 80), parentId: destParent } }) as unknown as { id: string });
    const docs = (await db.question.findMany({ where: { folderId: srcId, mergedIntoId: null }, take: 300, orderBy: { createdAt: "asc" } }) as unknown as Record<string, unknown>[]);
    for (const qd of docs) {
      if (++questions > 200) throw new Error("Too many questions (max 200)");
      const { id: _drop, _id: _drop2, creatorId: _drop3, folderId: _drop4, ...rest } = qd as Record<string, unknown> & { id: string };
      void _drop; void _drop2; void _drop3; void _drop4;
      await db.question.create({ data: { ...(rest as Record<string, unknown>), creatorId: user!.id, folderId: created.id } });
    }
    const kids = (await db.folder.findMany({ where: { ownerId: s.ownerId, parentId: srcId }, take: 200, orderBy: { createdAt: "asc" } }) as unknown as FolderDoc[]);
    for (const k of kids) {
      await copyFolder(k.id, created.id, owner);
    }
    return created.id;
  }

  try {
    const newId = await copyFolder(src.id, parent, ownerId, `${src.name} (copy)`);
    return NextResponse.json({ folderId: newId, folders, questions }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
