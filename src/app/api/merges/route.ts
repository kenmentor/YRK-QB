import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, getMembership } from "@/lib/auth";
import { canMerge } from "@/lib/permissions";
import { normalizeStem } from "@/lib/types";

export const dynamic = "force-dynamic";

type DraftRow = { id: string; workspaceId: string; status: string; stem: string; topicId: string | null; type: string; options: string; correct: string; explanation: string; difficulty: string; tags: string; imageUrl: string | null; revisionOf?: string | null };

export async function POST(req: Request) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const me = (await db.user.findUnique({ where: { id: user.id } }) as unknown as { role: string } | null);
  const { type, draftIds, canonicalId, duplicateIds } = await req.json();

  if (type === "approve_to_live") {
    if (!Array.isArray(draftIds) || draftIds.length !== 1) {
      return NextResponse.json({ error: "Send exactly one draft, use set_publish for batches" }, { status: 400 });
    }
    const draft = (await db.questionDraft.findUnique({ where: { id: draftIds[0] } }) as unknown as DraftRow | null);
    if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    const role = await getMembership(user.id, draft.workspaceId);
    if (!canMerge(role)) return NextResponse.json({ error: "Only owner can merge" }, { status: 403 });
    if (draft.status !== "approved") return NextResponse.json({ error: "Draft must be approved" }, { status: 409 });
    // Direct normStem lookup instead of scanning 200 docs (missed dupes past 200).
    const dup = (await db.question.findFirst({ where: { normStem: normalizeStem(draft.stem) } }) as unknown as { id: string; mergedIntoId?: string } | null);
    const liveDup = dup && !dup.mergedIntoId && dup.id !== draft.revisionOf ? dup : null;
    // Revision: update the canonical question in place (origin preserved).
    // Dead aliases can't be revised, they'd update invisible questions.
    if (draft.revisionOf) {
      const target = (await db.question.findUnique({ where: { id: draft.revisionOf } }) as unknown as { mergedIntoId?: string } | null);
      if (!target) return NextResponse.json({ error: "Original question gone" }, { status: 404 });
      if (target.mergedIntoId) return NextResponse.json({ error: "Original was merged away, revise its canonical instead" }, { status: 409 });
      const question = await db.question.update({
        where: { id: draft.revisionOf },
        data: {
          topicId: draft.topicId, type: draft.type, stem: draft.stem, normStem: normalizeStem(draft.stem),
          options: draft.options, correct: draft.correct, explanation: draft.explanation,
          difficulty: draft.difficulty, tags: draft.tags, imageUrl: draft.imageUrl
        }
      });
      await db.questionDraft.update({ where: { id: draft.id }, data: { status: "merged" } });
      await db.mergeRecord.create({ data: { workspaceId: draft.workspaceId, type, sourceIds: JSON.stringify(draftIds), targetIds: JSON.stringify([(question as { id: string }).id]), actorId: user.id } });
      return NextResponse.json({ question, revised: true }, { status: 201 });
    }
    const question = await db.question.create({
      data: {
        topicId: draft.topicId, type: draft.type, stem: draft.stem, normStem: normalizeStem(draft.stem),
        options: draft.options, correct: draft.correct, explanation: draft.explanation,
        difficulty: draft.difficulty, tags: draft.tags, imageUrl: draft.imageUrl,
        workspaceId: draft.workspaceId, creatorId: user.id
      }
    });
    await db.questionDraft.update({ where: { id: draft.id }, data: { status: "merged" } });
    await db.mergeRecord.create({ data: { workspaceId: draft.workspaceId, type, sourceIds: JSON.stringify(draftIds), targetIds: JSON.stringify([(question as { id: string }).id]), actorId: user.id } });
    return NextResponse.json({ question, duplicateWarning: liveDup ? liveDup.id : null }, { status: 201 });
  }

  if (type === "deduplicate") {
    // Bank-wide and destructive-adjacent: admins only, canonical must be live,
    // already-aliased sources are reported, never re-aliased.
    if (me?.role !== "admin") return NextResponse.json({ error: "Only admins merge duplicates" }, { status: 403 });
    if (!canonicalId || !Array.isArray(duplicateIds) || !duplicateIds.length) {
      return NextResponse.json({ error: "canonicalId + non-empty duplicateIds required" }, { status: 400 });
    }
    const canonical = (await db.question.findUnique({ where: { id: canonicalId } }) as unknown as { mergedIntoId?: string } | null);
    if (!canonical) return NextResponse.json({ error: "Canonical not found" }, { status: 404 });
    if (canonical.mergedIntoId) return NextResponse.json({ error: "Canonical is itself an alias, pick a live question" }, { status: 409 });
    const merged: string[] = [];
    const skipped: string[] = [];
    for (const id of duplicateIds as string[]) {
      if (id === canonicalId) { skipped.push(id); continue; }
      const q = (await db.question.findUnique({ where: { id } }) as unknown as { mergedIntoId?: string } | null);
      if (!q || q.mergedIntoId) { skipped.push(id); continue; }
      await db.question.update({ where: { id }, data: { mergedIntoId: canonicalId } });
      merged.push(id);
    }
    await db.mergeRecord.create({ data: { type, sourceIds: JSON.stringify(merged), targetIds: JSON.stringify([canonicalId]), actorId: user.id } });
    return NextResponse.json({ canonicalId, merged, skipped }, { status: 201 });
  }

  if (type === "set_publish") {
    if (!Array.isArray(draftIds) || !draftIds.length) return NextResponse.json({ error: "draftIds required" }, { status: 400 });
    const drafts = (await db.questionDraft.findMany({ where: { id: { in: draftIds } } }) as unknown as DraftRow[]);
    if (!drafts.length) return NextResponse.json({ error: "No such drafts" }, { status: 404 });
    // Every draft must live in ONE workspace, and caller must own it.
    const wsIds = Array.from(new Set(drafts.map((d) => d.workspaceId)));
    if (wsIds.length !== 1) return NextResponse.json({ error: "All drafts must belong to one workspace" }, { status: 400 });
    const role = await getMembership(user.id, wsIds[0]);
    if (!canMerge(role)) return NextResponse.json({ error: "Only owner can publish sets" }, { status: 403 });
    const approved = drafts.filter((d) => d.status === "approved");
    const skipped = drafts.filter((d) => d.status !== "approved").map((d) => d.id);
    const created: string[] = [];
    for (const d of approved) {
      const q = (await db.question.create({
        data: { topicId: d.topicId, type: d.type, stem: d.stem, normStem: normalizeStem(d.stem), options: d.options, correct: d.correct, explanation: d.explanation, difficulty: d.difficulty, tags: d.tags, imageUrl: d.imageUrl, workspaceId: wsIds[0], creatorId: user.id }
      }) as unknown as { id: string });
      await db.questionDraft.update({ where: { id: d.id }, data: { status: "merged" } });
      created.push(q.id);
    }
    await db.mergeRecord.create({ data: { workspaceId: wsIds[0], type, sourceIds: JSON.stringify(draftIds), targetIds: JSON.stringify(created), actorId: user.id } });
    return NextResponse.json({ published: created, skipped }, { status: 201 });
  }

  return NextResponse.json({ error: "Unknown merge type" }, { status: 400 });
}
