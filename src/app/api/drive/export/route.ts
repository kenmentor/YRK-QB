import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { getFolderAccess, type FolderDoc } from "@/lib/share";
import { isBankFolder, isBankQuestion } from "@/lib/shape";

export const dynamic = "force-dynamic";

// Bundle format (also the on-disk transport):
// folder: { format: "yrk-folder/1", name, folders: [...], questions: [...] }
// question: { format: "yrk-question/1", type, stem, options, correct, parts,
//   explanation, difficultyIndex, category, sector, tags, mediaUrl, topicPath }
export interface BundleQuestion {
  format: "yrk-question/1";
  type: string;
  stem: string;
  options: string[];
  correct: string[];
  parts: { stem?: string; label?: string; max?: number }[];
  explanation: string;
  difficultyIndex: number;
  category: string;
  sector: string;
  tags: string[];
  mediaUrl: string;
  topicPath: string[] | null;
}

export interface BundleFolder {
  format: "yrk-folder/1";
  name: string;
  folders: BundleFolder[];
  questions: BundleQuestion[];
}

function js<T>(raw: string | undefined, fb: T): T {
  try { return raw ? (JSON.parse(raw) as T) : fb; } catch { return fb; }
}

async function topicPath(topicId?: string | null): Promise<string[] | null> {
  if (!topicId) return null;
  const t = (await db.topic.findUnique({ where: { id: topicId } }) as unknown as { name: string; subjectId: string } | null);
  if (!t) return null;
  const s = (await db.subject.findUnique({ where: { id: t.subjectId } }) as unknown as { name: string; examId: string } | null);
  if (!s) return [t.name];
  const e = (await db.exam.findUnique({ where: { id: s.examId } }) as unknown as { name: string; bodyId: string } | null);
  if (!e) return [s.name, t.name];
  const b = (await db.examBody.findUnique({ where: { id: e.bodyId } }) as unknown as { name: string } | null);
  return [b?.name ?? "", e.name, s.name, t.name].filter(Boolean);
}

// GET /api/drive/export?folderId=<id> — access-checked bundle (caps: 500 Qs, depth 6).
export async function GET(req: Request) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const folderId = searchParams.get("folderId");
  if (!folderId) return NextResponse.json({ error: "folderId required" }, { status: 400 });
  const root = (await db.folder.findUnique({ where: { id: folderId } }) as unknown as FolderDoc | null);
  if (!root) return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  const access = await getFolderAccess(user.id, root);
  if (!access) return NextResponse.json({ error: "Folder not found" }, { status: 404 });

  let count = 0;
  async function build(fid: string, depth: number): Promise<BundleFolder | null> {
    if (depth > 6 || count > 500) return null;
    const f = (await db.folder.findUnique({ where: { id: fid } }) as unknown as FolderDoc | null);
    if (!f || f.ownerId !== root!.ownerId) return null;
    const kids = ((await db.folder.findMany({ where: { ownerId: f.ownerId, parentId: fid }, take: 200, orderBy: { createdAt: "asc" } }) as unknown as FolderDoc[])).filter(isBankFolder);
    const docs = ((await db.question.findMany({ where: { folderId: fid, mergedIntoId: null }, take: 500, orderBy: { createdAt: "asc" } }) as unknown as {
      type: string; stem: string; options: string; correct: string; parts?: string; explanation: string;
      difficultyIndex?: number; difficulty: string; category?: string; sector?: string; tags?: string; mediaUrl?: string; topicId?: string;
    }[])).filter(isBankQuestion);
    const questions: BundleQuestion[] = [];
    for (const qd of docs) {
      if (count++ > 500) break;
      questions.push({
        format: "yrk-question/1",
        type: qd.type, stem: qd.stem,
        options: js<string[]>(qd.options, []), correct: js<string[]>(qd.correct, []),
        parts: js(qd.parts, []),
        explanation: qd.explanation,
        difficultyIndex: qd.difficultyIndex ?? (qd.difficulty === "easy" ? 2 : qd.difficulty === "hard" ? 4 : 3),
        category: qd.category ?? "tertiary", sector: qd.sector ?? "",
        tags: js<string[]>(qd.tags, []), mediaUrl: qd.mediaUrl ?? "",
        topicPath: await topicPath(qd.topicId),
      });
    }
    const folders: BundleFolder[] = [];
    for (const k of kids) {
      const b = await build(k.id, depth + 1);
      if (b) folders.push(b);
    }
    return { format: "yrk-folder/1", name: f.name, folders, questions };
  }

  const bundle = await build(root.id, 0);
  if (!bundle) return NextResponse.json({ error: "Folder too large to export" }, { status: 400 });
  return NextResponse.json({ bundle, truncated: count > 500 });
}
