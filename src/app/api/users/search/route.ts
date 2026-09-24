import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").toLowerCase();
  if (q.length < 1) return NextResponse.json([]);
  const users = (await db.user.findMany({ take: 50 }) as unknown as { id: string; name: string; email: string; role: string }[]);
  const hit = users
    .filter((u) => u.name?.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    .slice(0, 8)
    .map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role }));
  return NextResponse.json(hit);
}
