import { NextResponse } from "next/server";
import { getCurrentUser, clearSessionCookie } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
}

export async function POST() {
  clearSessionCookie();
  return NextResponse.json({ ok: true });
}
