import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateUser, signToken, setSessionCookie } from "@/lib/auth";
import { rateLimited } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: Request) {
  if (rateLimited(req, "login", 15, 60 * 1000)) {
    return NextResponse.json({ error: "Too many attempts, try again in a minute" }, { status: 429 });
  }
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });
  try {
    const user = await authenticateUser(parsed.data.email, parsed.data.password);
    const token = signToken({ id: user.id, email: user.email, role: user.role });
    setSessionCookie(token);
    return NextResponse.json({ id: user.id, email: user.email, name: user.name, role: user.role });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 401 });
  }
}
