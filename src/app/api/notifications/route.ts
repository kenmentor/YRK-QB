import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const list = (await db.notification.findMany({ where: { userId: user.id }, take: 30 }) as unknown as { createdAt: string }[]);
  list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return NextResponse.json(list);
}

export async function POST(req: Request) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const { id } = await req.json();
  if (id) await db.notification.update({ where: { id }, data: { read: true } });
  else {
    const all = (await db.notification.findMany({ where: { userId: user.id } }) as unknown as { id: string }[]);
    for (const n of all) await db.notification.update({ where: { id: n.id }, data: { read: true } });
  }
  return NextResponse.json({ ok: true });
}
