import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Exam sets: owner-scoped, profiled after the iQueBS form (institution,
// department, domain, level, term, title, subject) + ordered live questions.
export async function GET(req: Request) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const sets = await db.examSet.findMany({ where: { ownerId: user.id }, take: 200, orderBy: { createdAt: "desc" } });
  return NextResponse.json(sets);
}

export async function POST(req: Request) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const title = String(body.title ?? "").trim().slice(0, 120);
  if (!title) return NextResponse.json({ error: "Exam title required" }, { status: 400 });
  const created = await db.examSet.create({
    data: {
      ownerId: user.id,
      title,
      institution: String(body.institution ?? "").slice(0, 120),
      department: String(body.department ?? "").slice(0, 120),
      domain: String(body.domain ?? "").slice(0, 60),
      level: String(body.level ?? "").slice(0, 60),
      term: String(body.term ?? "").slice(0, 60),
      subject: String(body.subject ?? "").slice(0, 120),
      questionIds: JSON.stringify([]),
    },
  });
  return NextResponse.json(created, { status: 201 });
}
