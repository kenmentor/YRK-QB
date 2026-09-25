import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, getMembership } from "@/lib/auth";

export const dynamic = "force-dynamic";

// What this workspace has put into the bank: published questions carrying
// this workspace as origin. The workspace-side mirror of the bank.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  if (!(await getMembership(user.id, params.id))) {
    return NextResponse.json({ error: "Not a member of this workspace" }, { status: 403 });
  }
  const questions = (await db.question.findMany({ where: { workspaceId: params.id }, take: 200 }) as unknown as { mergedIntoId?: string; topicId?: string; stem: string }[]);
  const live = questions.filter((q) => !q.mergedIntoId);
  const withTopics = [];
  for (const q of live as unknown as { id: string; topicId?: string; stem: string; type: string; difficulty: string }[]) {
    let topic = null;
    if (q.topicId) topic = (await db.topic.findUnique({ where: { id: q.topicId } }) as unknown as { name: string } | null);
    withTopics.push({ ...q, topicName: topic?.name ?? "" });
  }
  return NextResponse.json(withTopics);
}
