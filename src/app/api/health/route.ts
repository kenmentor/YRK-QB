import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongo";

export const dynamic = "force-dynamic";

// Production probe: visit /api/health on the deployed URL. If ok:false,
// the app can't reach Mongo (usually a missing/wrong DATABASE_URL in
// Vercel env). Never leaks the connection string.
export async function GET() {
  const raw = process.env.DATABASE_URL ?? "";
  const host = (() => {
    try {
      const u = new URL(raw);
      return u.hostname || "unset";
    } catch {
      return raw ? "unparseable" : "unset";
    }
  })();
  const dbName = (() => {
    try {
      return new URL(raw).pathname.replace("/", "") || "yrk-question-bank";
    } catch {
      return "yrk-question-bank";
    }
  })();
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    const [users, questions, workspaces] = await Promise.all([
      db.collection("users").countDocuments(),
      db.collection("questions").countDocuments(),
      db.collection("workspaces").countDocuments()
    ]);
    return NextResponse.json({ ok: true, host, dbName, users, questions, workspaces });
  } catch (e) {
    return NextResponse.json({ ok: false, host, dbName, error: (e as Error).message.slice(0, 200) }, { status: 500 });
  }
}
