import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// DELETE: the granting owner removes any share; the invitee leaves their own.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const s = (await db.folderShare.findUnique({ where: { id: params.id } }) as unknown as { ownerId: string; userId: string } | null);
  if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (s.ownerId !== user.id && s.userId !== user.id) return NextResponse.json({ error: "Not yours" }, { status: 403 });
  await db.folderShare.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true, left: s.userId === user.id });
}
