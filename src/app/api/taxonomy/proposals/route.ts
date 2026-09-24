import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalize } from "@/lib/types";

export async function POST(req: Request) {
  const { kind, parentId, name } = await req.json();
  const normName = normalize(name);
  // suggest existing instead of duplicating
  let existing = null;
  if (kind === "topic") existing = await db.topic.findFirst({ where: { subjectId: parentId, normName } });
  if (existing) return NextResponse.json({ suggestion: existing, queued: false });
  const proposal = await db.taxonomyProposal.create({ data: { kind, parentId, name, normName } });
  return NextResponse.json({ proposal, queued: true }, { status: 201 });
}

export async function GET() {
  const queue = await db.taxonomyProposal.findMany({ where: { status: "pending" } });
  return NextResponse.json(queue);
}
