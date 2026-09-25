import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, getMembership } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Course-builder progress: for the workspace's subject, every topic with
// draft / in-review / approved / published counts. This is how a course
// (and rolled up, a semester) visibly gets built.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const ws = (await db.workspace.findUnique({ where: { id: params.id } }) as unknown as {
    id: string; subjectId?: string; topicId?: string; examId?: string;
  } | null);
  if (!ws) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await getMembership(user.id, params.id))) {
    return NextResponse.json({ error: "Not a member of this workspace" }, { status: 403 });
  }

  // Resolve the subject: explicit topic > explicit subject > course's subjects.
  let subjectId = ws.subjectId ?? null;
  let onlyTopic: string | null = ws.topicId ?? null;
  if (onlyTopic && !subjectId) {
    const t = (await db.topic.findUnique({ where: { id: onlyTopic } }) as unknown as { subjectId: string } | null);
    if (t) subjectId = t.subjectId;
  }
  let subjects: { id: string; name: string }[] = [];
  if (subjectId) {
    const s = (await db.subject.findUnique({ where: { id: subjectId } }) as unknown as { id: string; name: string } | null);
    if (s) subjects = [s];
  } else if (ws.examId) {
    subjects = (await db.subject.findMany({ where: { examId: ws.examId } }) as unknown as { id: string; name: string }[]);
  }
  if (!subjects.length) return NextResponse.json({ subjects: [], note: "Attach this workspace to a subject to track the build." });

  const drafts = (await db.questionDraft.findMany({ where: { workspaceId: params.id } }) as unknown as { topicId?: string; status: string }[]);
  const published = (await db.question.findMany({ where: { workspaceId: params.id } }) as unknown as { topicId?: string; mergedIntoId?: string }[]);
  const rows = [];
  for (const s of subjects) {
    let topics = (await db.topic.findMany({ where: { subjectId: s.id } }) as unknown as { id: string; name: string }[]);
    if (onlyTopic) topics = topics.filter((t) => t.id === onlyTopic);
    const tRows = topics.map((t) => {
      const dd = drafts.filter((d) => d.topicId === t.id);
      return {
        id: t.id, name: t.name,
        draft: dd.filter((d) => d.status === "draft" || d.status === "changes_requested").length,
        inReview: dd.filter((d) => d.status === "in_review").length,
        approved: dd.filter((d) => d.status === "approved").length,
        published: published.filter((q) => q.topicId === t.id && !q.mergedIntoId).length
      };
    });
    rows.push({ id: s.id, name: s.name, topics: tRows });
  }
  return NextResponse.json({ subjects: rows });
}
