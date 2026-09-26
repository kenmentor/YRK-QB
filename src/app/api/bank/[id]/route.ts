import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const q = (await db.question.findUnique({ where: { id: params.id } }) as unknown as {
    id: string; stem: string; options: string; correct: string; explanation: string;
    difficulty: string; type: string; creatorId?: string; allowApplications?: boolean; editorIds?: string;
  } | null);
  if (!q || (q as { mergedIntoId?: string }).mergedIntoId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  let creator = null;
  if (q.creatorId) creator = await db.user.findUnique({ where: { id: q.creatorId } });
  let editors: { id: string; name: string; email: string }[] = [];
  try {
    const ids = JSON.parse(q.editorIds ?? "[]") as string[];
    for (const eid of ids.slice(0, 10)) {
      const u = (await db.user.findUnique({ where: { id: eid } }) as unknown as { id: string; name: string; email: string } | null);
      if (u) editors.push(u);
    }
  } catch { /* ignore */ }
  return NextResponse.json({ question: q, creator, editors });
}

// Creator/editor/admin updates. Body may include:
// { allowApplications } and/or { folderId (string|null), stem, options, correct, explanation, difficulty }
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = (await getAuthUser(req) as unknown as { id: string; role: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const q = (await db.question.findUnique({ where: { id: params.id } }) as unknown as { creatorId?: string; editorIds?: string; folderId?: string | null } | null);
  if (!q) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const { allowApplications, folderId, stem, options, correct, explanation, difficulty, parts, difficultyIndex, category, sector, tags, mediaUrl } = body ?? {};
  const me = (await db.user.findUnique({ where: { id: user.id } }) as unknown as { role: string });
  // Creators, approved editors, and admins. editorIds is granted by the
  // edit-application flow, so approving someone must actually empower them.
  let isEditor = false;
  try { isEditor = (JSON.parse(q.editorIds ?? "[]") as string[]).includes(user.id); } catch { /* corrupt list = no access */ }
  // Shared-space editors: editor+ access to the folder the file lives in.
  let folderEditor = false;
  if (!isEditor && q.creatorId !== user.id && q.folderId) {
    const src = (await db.folder.findUnique({ where: { id: q.folderId } }) as unknown as { id: string; ownerId: string } | null);
    if (src && src.ownerId !== user.id) {
      const { getFolderAccess, rankOf } = await import("@/lib/share");
      const a = await getFolderAccess(user.id, src);
      folderEditor = !!a && rankOf(a) >= 3;
    } else if (src) folderEditor = true; // own folder
  }
  // Unclaimed legacy questions can only be claimed by admins, otherwise
  // the first visitor to find one would own it.
  if (!q.creatorId) {
    if (me?.role !== "admin") return NextResponse.json({ error: "Unclaimed question, ask an admin to assign it" }, { status: 403 });
    const updated = await db.question.update({ where: { id: params.id }, data: { creatorId: user.id, allowApplications: !!allowApplications } });
    return NextResponse.json(updated);
  }
  if (q.creatorId !== user.id && !isEditor && !folderEditor && me?.role !== "admin") return NextResponse.json({ error: "Only the creator can change appliable" }, { status: 403 });
  const data: Record<string, unknown> = {};
  if (allowApplications !== undefined) data.allowApplications = !!allowApplications;
  // Move between folders (folderId null = own Bank root).
  // Editors need editor+ on BOTH the source folder and the destination.
  if (folderId !== undefined) {
    if (folderId === null || folderId === "") {
      if (q.creatorId !== user.id && !isEditor && me?.role !== "admin") {
        // Moving someone else's file to my root takes it: source-editor only.
        if (!folderEditor) return NextResponse.json({ error: "No access to move that file" }, { status: 403 });
      }
      data.folderId = null;
    } else {
      const f = (await db.folder.findUnique({ where: { id: String(folderId) } }) as unknown as { id: string; ownerId: string } | null);
      if (!f) return NextResponse.json({ error: "Destination folder not found" }, { status: 404 });
      if (f.ownerId !== user.id) {
        const { getFolderAccess, rankOf } = await import("@/lib/share");
        const a = await getFolderAccess(user.id, f);
        if (!a || rankOf(a) < 3) return NextResponse.json({ error: "Destination folder not found" }, { status: 404 });
        if (!folderEditor && q.creatorId !== user.id && !isEditor && me?.role !== "admin") return NextResponse.json({ error: "No access to move that file" }, { status: 403 });
      } else if (q.creatorId !== user.id && !isEditor && !folderEditor && me?.role !== "admin") {
        return NextResponse.json({ error: "No access to move that file" }, { status: 403 });
      }
      data.folderId = String(folderId);
    }
  }
  // In-place content edit from the Drive viewer.
  if (stem !== undefined) {
    const s = String(stem ?? "").trim();
    if (s.length < 8) return NextResponse.json({ error: "Stem needs 8+ characters" }, { status: 400 });
    data.stem = s;
    data.normStem = s.toLowerCase().replace(/\s+/g, " ");
  }
  if (options !== undefined) data.options = JSON.stringify(options);
  if (correct !== undefined) data.correct = JSON.stringify(correct);
  if (parts !== undefined) data.parts = typeof parts === "string" ? parts : JSON.stringify(parts ?? []);
  if (difficultyIndex !== undefined) {
    const di = Math.min(5, Math.max(1, Number(difficultyIndex) || 3));
    data.difficultyIndex = di;
    data.difficulty = di <= 2 ? "easy" : di >= 4 ? "hard" : "medium";
  }
  if (category !== undefined) data.category = String(category);
  if (sector !== undefined) data.sector = String(sector).slice(0, 80);
  if (tags !== undefined) data.tags = JSON.stringify(tags);
  if (mediaUrl !== undefined) data.mediaUrl = String(mediaUrl).slice(0, 500);
  if (explanation !== undefined) {
    if (String(explanation ?? "").trim().length < 4) return NextResponse.json({ error: "Explanation required" }, { status: 400 });
    data.explanation = explanation;
  }
  if (difficulty !== undefined) data.difficulty = difficulty;
  if (!Object.keys(data).length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  const updated = await db.question.update({ where: { id: params.id }, data });
  return NextResponse.json(updated);
}

// DELETE a bank file: creator, containing-folder owner, or admin.
// Attempt history rows stay (history resolves missing questions as Untagged).
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = (await getAuthUser(req) as unknown as { id: string; role: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const q = (await db.question.findUnique({ where: { id: params.id } }) as unknown as { creatorId?: string; folderId?: string | null; mergedIntoId?: string } | null);
  if (!q || q.mergedIntoId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const me = (await db.user.findUnique({ where: { id: user.id } }) as unknown as { role: string });
  let allowed = q.creatorId === user.id || me?.role === "admin";
  if (!allowed && q.folderId) {
    const f = (await db.folder.findUnique({ where: { id: q.folderId } }) as unknown as { ownerId: string } | null);
    allowed = !!f && f.ownerId === user.id;
  }
  if (!allowed) return NextResponse.json({ error: "Only the creator or folder owner deletes" }, { status: 403 });
  await db.question.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
