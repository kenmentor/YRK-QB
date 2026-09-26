import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { validateQuestion, bandFromIndex } from "@/lib/validation";
import { getFolderAccess, rankOf, type FolderDoc } from "@/lib/share";
import type { BundleFolder, BundleQuestion } from "../export/route";

export const dynamic = "force-dynamic";

function norm(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

interface ValidatedQ {
  type: string; stem: string; options: string[]; correct: string[];
  parts: { stem?: string; label?: string; max?: number }[];
  explanation: string; difficultyIndex: number; category: string; sector: string;
  tags: string[]; mediaUrl: string; topicPath: unknown;
}

// Resolve a topic path [body?, exam?, subject?, topic] to an id by name walk.
async function resolveTopic(path: unknown): Promise<string | null> {
  if (!Array.isArray(path) || !path.length) return null;
  const names = path.map(String);
  const topicName = names[names.length - 1];
  const topics = (await db.topic.findMany({ where: {}, take: 500 }) as unknown as { id: string; name: string; subjectId: string }[]);
  const candidates = topics.filter((t) => t.name.toLowerCase() === topicName.toLowerCase());
  for (const t of candidates) {
    const s = (await db.subject.findUnique({ where: { id: t.subjectId } }) as unknown as { name: string; examId: string } | null);
    if (!s) continue;
    if (names.length >= 2 && s.name.toLowerCase() !== String(names[names.length - 2]).toLowerCase()) continue;
    if (names.length < 3) return t.id;
    const e = (await db.exam.findUnique({ where: { id: s.examId } }) as unknown as { name: string; bodyId: string } | null);
    if (!e || e.name.toLowerCase() !== String(names[names.length - 3]).toLowerCase()) continue;
    if (names.length < 4) return t.id;
    const b = (await db.examBody.findUnique({ where: { id: e.bodyId } }) as unknown as { name: string } | null);
    if (b && b.name.toLowerCase() === String(names[names.length - 4]).toLowerCase()) return t.id;
  }
  return candidates[0]?.id ?? null;
}

function checkQuestion(raw: unknown, path: string): { ok: ValidatedQ | null; error?: string } {
  const q = raw as Partial<BundleQuestion>;
  if (!q || typeof q !== "object") return { ok: null, error: `${path}: not an object` };
  if (q.format !== "yrk-question/1") return { ok: null, error: `${path}: bad format tag (want yrk-question/1)` };
  const parsed = validateQuestion({
    type: q.type, stem: q.stem, options: q.options ?? [], correct: q.correct ?? [],
    parts: q.parts ?? [], explanation: q.explanation,
    difficultyIndex: Number(q.difficultyIndex) || 3,
    category: q.category ?? "tertiary", sector: q.sector ?? "",
    tags: q.tags ?? [], mediaUrl: q.mediaUrl ?? "",
  });
  if (!parsed.success) return { ok: null, error: `${path}: ${parsed.error.issues[0]?.message ?? "invalid"}` };
  return {
    ok: {
      type: parsed.data.type, stem: parsed.data.stem,
      options: parsed.data.options, correct: parsed.data.correct, parts: parsed.data.parts,
      explanation: parsed.data.explanation, difficultyIndex: parsed.data.difficultyIndex,
      category: parsed.data.category, sector: parsed.data.sector,
      tags: parsed.data.tags, mediaUrl: parsed.data.mediaUrl,
      topicPath: q.topicPath ?? null,
    },
  };
}

// POST /api/drive/import { parentId?, bundle } — validated create.
// parent: my folder, or shared folder with reviewer+ (inherits bank owner).
export async function POST(req: Request) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const { parentId, bundle } = await req.json().catch(() => ({}));
  const b = bundle as Partial<BundleFolder>;
  if (!b || b.format !== "yrk-folder/1" || typeof b.name !== "string" || !b.name.trim()) {
    return NextResponse.json({ error: "Not a folder bundle (want format yrk-folder/1 with a name)" }, { status: 400 });
  }

  let parent: string | null = null;
  let ownerId = user.id;
  if (parentId) {
    const p = (await db.folder.findUnique({ where: { id: String(parentId) } }) as unknown as FolderDoc | null);
    if (!p) return NextResponse.json({ error: "Destination not found" }, { status: 404 });
    const access = await getFolderAccess(user.id, p);
    if (!access || rankOf(access) < 2) return NextResponse.json({ error: "No access to that destination" }, { status: 403 });
    parent = p.id;
    ownerId = p.ownerId;
  }

  // Validate everything BEFORE creating anything.
  const errors: string[] = [];
  let folderCount = 0;
  let questionCount = 0;
  const walk = (node: Partial<BundleFolder>, path: string, depth: number) => {
    if (depth > 6) { errors.push(`${path}: too deep (max 6)`); return; }
    if (typeof node.name !== "string" || !node.name.trim()) errors.push(`${path}: folder needs a name`);
    if (!Array.isArray(node.folders) || !Array.isArray(node.questions)) { errors.push(`${path}: needs folders[] + questions[]`); return; }
    folderCount++;
    node.questions.forEach((qq, i) => {
      questionCount++;
      const r = checkQuestion(qq, `${path} › Q${i + 1}`);
      if (!r.ok && r.error) errors.push(r.error);
    });
    node.folders.forEach((ff, i) => walk(ff as Partial<BundleFolder>, `${path} › ${typeof ff === "object" && ff ? String((ff as { name?: unknown }).name ?? `folder${i + 1}`) : `folder${i + 1}`}`, depth + 1));
  };
  walk(b, b.name!.trim(), 0);
  if (folderCount > 100) errors.push("Too many folders (max 100)");
  if (questionCount > 500) errors.push("Too many questions (max 500)");
  if (errors.length) return NextResponse.json({ error: "Bundle invalid", issues: errors.slice(0, 20) }, { status: 422 });

  // Create top folder, then recurse.
  const top = (await db.folder.create({ data: { ownerId, name: b.name!.trim().slice(0, 80), parentId: parent } }) as unknown as { id: string });
  let created = 0;
  async function build(node: BundleFolder, parentFid: string): Promise<void> {
    for (const qq of node.questions) {
      const v = checkQuestion(qq, "q").ok!;
      const topicId = await resolveTopic(v.topicPath);
      await db.question.create({
        data: {
          topicId, type: v.type, stem: v.stem, normStem: norm(v.stem),
          options: JSON.stringify(v.options), correct: JSON.stringify(v.correct),
          parts: JSON.stringify(v.parts), explanation: v.explanation,
          difficulty: bandFromIndex(v.difficultyIndex), difficultyIndex: v.difficultyIndex,
          category: v.category, sector: v.sector, mediaUrl: v.mediaUrl,
          tags: JSON.stringify(v.tags), creatorId: user!.id, folderId: parentFid,
        },
      });
      created++;
    }
    for (const ff of node.folders) {
      const kid = (await db.folder.create({ data: { ownerId, name: String(ff.name).slice(0, 80), parentId: parentFid } }) as unknown as { id: string });
      await build(ff, kid.id);
    }
  }
  await build(b as BundleFolder, top.id);
  return NextResponse.json({ folderId: top.id, folders: folderCount, questions: created }, { status: 201 });
}
