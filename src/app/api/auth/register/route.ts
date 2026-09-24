import { NextResponse } from "next/server";
import { z } from "zod";
import { registerUser, signToken, setSessionCookie } from "@/lib/auth";
import { rateLimited } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// Self-service roles only. Admin is granted out-of-band (seeded);
// letting the request body choose it was a privilege-escalation hole.
const schema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(6),
  role: z.enum(["learner", "professor"]).default("learner")
});

export async function POST(req: Request) {
  if (rateLimited(req, "register", 10, 60 * 1000)) {
    return NextResponse.json({ error: "Too many signups, try again in a minute" }, { status: 429 });
  }
  const body = await req.json();
  if (body.role === "admin") {
    return NextResponse.json({ error: "Admin is granted by an existing admin, not self-service" }, { status: 403 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 422 });
  try {
    const user = (await registerUser(parsed.data.email, parsed.data.name, parsed.data.password, parsed.data.role) as unknown as { id: string; email: string; name: string; role: string });
    const token = signToken({ id: user.id, email: user.email, role: user.role });
    setSessionCookie(token);
    return NextResponse.json({ id: user.id, email: user.email, name: user.name, role: user.role }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
