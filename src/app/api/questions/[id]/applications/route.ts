import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

// List applications for a question (creator sees all; applicant sees own)
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const q = (await db.question.findUnique({ where: { id: params.id } }) as unknown as { creatorId?: string } | null);
  if (!q) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const all = (await db.editApplication.findMany({ where: { questionId: params.id } }) as unknown as { applicantId: string; status: string }[]);
  const isCreator = q.creatorId === user.id;
  const mine = all.filter((a) => a.applicantId === user.id);
  const list = isCreator ? all : mine;
  // attach applicant names
  const out = [];
  for (const a of list as unknown as { id: string; applicantId: string; message: string; status: string; createdAt: string }[]) {
    const u = (await db.user.findUnique({ where: { id: a.applicantId } }) as unknown as { name: string; email: string } | null);
    out.push({ ...a, applicant: u });
  }
  return NextResponse.json(out);
}

// Apply to edit. Body: { message }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const q = (await db.question.findUnique({ where: { id: params.id } }) as unknown as { creatorId?: string; allowApplications?: boolean } | null);
  if (!q) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!q.allowApplications) return NextResponse.json({ error: "Creator has not made this appliable" }, { status: 403 });
  if (q.creatorId === user.id) return NextResponse.json({ error: "Creators don't need to apply" }, { status: 400 });
  const existing = (await db.editApplication.findMany({ where: { questionId: params.id } }) as unknown as { applicantId: string; status: string }[]);
  if (existing.some((a) => a.applicantId === user.id && a.status === "pending")) {
    return NextResponse.json({ error: "You already have a pending application" }, { status: 409 });
  }
  const { message } = await req.json();
  const app = await db.editApplication.create({ data: { questionId: params.id, applicantId: user.id, message: message ?? "", status: "pending" } });
  return NextResponse.json(app, { status: 201 });
}
