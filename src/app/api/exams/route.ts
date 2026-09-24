import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const bodies = (await db.examBody.findMany({ take: 50 }) as unknown as { id: string; name: string }[]);
  const out = [];
  for (const b of bodies) {
    const exams = (await db.exam.findMany({ where: { bodyId: b.id } }) as unknown as { id: string; name: string }[]);
    out.push({ ...b, exams });
  }
  return NextResponse.json(out);
}
