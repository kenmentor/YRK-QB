import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { validateQuestion, bandFromIndex } from "@/lib/validation";

export const dynamic = "force-dynamic";

function norm(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

// POST: create a question file directly in my bank. Body matches QuestionEditor form + folderId?.
export async function POST(req: Request) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { type, stem, options, correct, explanation, difficulty, difficultyIndex, category, sector, topicId, folderId, tags, parts, mediaUrl } = body ?? {};

  const parsed = validateQuestion({
    type, stem, options: options ?? [], correct: correct ?? [],
    parts: parts ?? [],
    explanation, difficulty: difficulty ?? "medium",
    difficultyIndex: Number(difficultyIndex) || 3,
    category: category ?? "tertiary", sector: sector ?? "",
    tags: tags ?? [], mediaUrl: mediaUrl ?? "",
  });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid question" }, { status: 400 });

  let folder: string | null = null;
  if (folderId) {
    const f = (await db.folder.findUnique({ where: { id: String(folderId) } }) as unknown as { id: string; ownerId: string } | null);
    if (!f) return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    // Own folder: always fine. Shared folder: reviewer+ may file here.
    if (f.ownerId !== user.id) {
      const { getFolderAccess, rankOf } = await import("@/lib/share");
      const access = await getFolderAccess(user.id, f);
      if (!access || rankOf(access) < 2) return NextResponse.json({ error: "No access to that folder" }, { status: 403 });
    }
    folder = f.id;
  }
  // folderId null files at the creator's own root (shared roots open via folder).

  // Topic is optional in Drive (general file); validate only when provided.
  let topic: string | null = null;
  if (topicId) {
    const t = (await db.topic.findUnique({ where: { id: String(topicId) } }) as unknown as { id: string } | null);
    if (!t) return NextResponse.json({ error: "Topic not found" }, { status: 404 });
    topic = t.id;
  }

  const created = await db.question.create({
    data: {
      topicId: topic,
      type: parsed.data.type,
      stem: parsed.data.stem,
      normStem: norm(parsed.data.stem),
      options: JSON.stringify(parsed.data.options),
      correct: JSON.stringify(parsed.data.correct),
      parts: JSON.stringify(parsed.data.parts),
      explanation: parsed.data.explanation,
      difficulty: bandFromIndex(parsed.data.difficultyIndex),
      difficultyIndex: parsed.data.difficultyIndex,
      category: parsed.data.category,
      sector: parsed.data.sector,
      mediaUrl: parsed.data.mediaUrl,
      tags: JSON.stringify(parsed.data.tags),
      creatorId: user.id,
      folderId: folder,
    },
  });
  return NextResponse.json(created, { status: 201 });
}
