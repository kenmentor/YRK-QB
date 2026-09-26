import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET: shares granted TO me (incoming) with folder/owner names for the sidebar.
export async function GET(req: Request) {
  const user = (await getAuthUser(req) as unknown as { id: string } | null);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const shares = (await db.folderShare.findMany({ where: { userId: user.id }, take: 200 }) as unknown as {
    id: string; folderId?: string | null; ownerId: string; role: string;
  }[]);
  const out = [];
  for (const s of shares) {
    const o = (await db.user.findUnique({ where: { id: s.ownerId } }) as unknown as { name: string } | null);
    let folderName: string | null = null;
    if (s.folderId) {
      const f = (await db.folder.findUnique({ where: { id: s.folderId } }) as unknown as { name: string; ownerId: string } | null);
      if (!f || f.ownerId !== s.ownerId) continue; // scope gone
      folderName = f.name;
    }
    out.push({ id: s.id, folderId: s.folderId ?? null, folderName, ownerId: s.ownerId, ownerName: o?.name ?? "Someone", role: s.role });
  }
  return NextResponse.json(out);
}
