import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const topics = (await db.topic.findMany({ take: 100 }) as unknown as { id: string; name: string; subjectId: string }[]);
  const out = [];
  for (const t of topics) {
    const s = (await db.subject.findUnique({ where: { id: t.subjectId } }) as unknown as { name: string; examId: string } | null);
    let examName = "";
    if (s) {
      const e = (await db.exam.findUnique({ where: { id: s.examId } }) as unknown as { name: string } | null);
      if (e) examName = e.name;
    }
    out.push({ id: t.id, name: t.name, subject: s?.name ?? "", exam: examName });
  }
  return NextResponse.json(out);
}
