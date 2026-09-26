import { db } from "./db";
import { isBankQuestion } from "./shape";
export const ACTIVITY_MODES = ["practice", "selftest", "exam"] as const;
export type ActivityMode = (typeof ACTIVITY_MODES)[number];

export const CURRICULUM = ["primary", "secondary", "tertiary", "professional", "other"] as const;
export const CURRICULUM_LABEL: Record<string, string> = {
  primary: "Primary", secondary: "Secondary", tertiary: "Tertiary",
  professional: "Professional", other: "Other",
};

export const BANNERS = [
  "indigo", "emerald", "amber", "rose", "sky", "violet",
] as const;

export const DEFAULT_RULES_PRACTICE =
  "Instant feedback after each answer. Guides and explanations show immediately. No timer and no score pressure — learn at your pace. Your misses group by topic in History.";
export const DEFAULT_RULES_TEST =
  "Strict timed run. Questions follow the set order and blank answers count wrong. Submitting after time scores zero. Your attempt is recorded to History.";

export interface ActivityDoc {
  id: string;
  ownerId: string;
  title: string;
  banner?: string;
  details?: string;
  rulesPractice?: string;
  rulesTest?: string;
  modes?: string[];
  visibility?: string;
  category?: string;
  sector?: string;
  subject?: string;
  assembly?: string;
  questionIds?: string;
  folderIds?: string;
}

// Parse a JSON-string-or-array field into string[].
export function strArr(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === "string") {
    try {
      const a = JSON.parse(raw);
      return Array.isArray(a) ? a.map(String).filter(Boolean) : [];
    } catch { return []; }
  }
  return [];
}

// Can userId view this activity? Public (logged in), owner, or share.
export async function canViewActivity(userId: string | null, a: ActivityDoc): Promise<boolean> {
  if (a.visibility === "public" && userId) return true;
  if (userId && a.ownerId === userId) return true;
  if (!userId) return false;
  const s = (await db.activityShare.findFirst({ where: { activityId: a.id, userId } }) as unknown as { id: string } | null);
  return !!s;
}

export async function activityRole(userId: string, a: ActivityDoc): Promise<"owner" | "editor" | "viewer" | null> {
  if (a.ownerId === userId) return "owner";
  const s = (await db.activityShare.findFirst({ where: { activityId: a.id, userId } }) as unknown as { role: string } | null);
  if (s?.role === "editor") return "editor";
  if (s) return "viewer";
  if (a.visibility === "public") return "viewer";
  return null;
}

// Folders the resolver may pull questions from for this user:
// own, shared (any role — playing is reading), public-use.
export async function playableFolderIds(userId: string, ownerId: string): Promise<Set<string>> {
  const out = new Set<string>();
  const all = (await db.folder.findMany({ where: { ownerId }, take: 500 }) as unknown as { id: string }[]);
  if (ownerId === userId) {
    all.forEach((f) => out.add(f.id));
    return out;
  }
  const shares = (await db.folderShare.findMany({ where: { userId }, take: 200 }) as unknown as { folderId?: string | null; ownerId: string }[]);
  const mine = shares.filter((s) => s.ownerId === ownerId);
  if (mine.some((s) => !s.folderId)) all.forEach((f) => out.add(f.id));
  else {
    // Ancestry walk for folder-scoped shares.
    const full = (await db.folder.findMany({ where: { ownerId }, take: 500 }) as unknown as { id: string; parentId?: string | null }[]);
    const parentOf = new Map(full.map((f) => [f.id, f.parentId ?? null] as const));
    const roots = mine.map((s) => s.folderId).filter(Boolean) as string[];
    for (const f of full) {
      const chain = new Set<string>([f.id]);
      let cur = parentOf.get(f.id) ?? null;
      const seen = new Set<string>();
      while (cur && !seen.has(cur)) {
        seen.add(cur);
        chain.add(cur);
        cur = parentOf.get(cur) ?? null;
      }
      if (roots.some((r) => chain.has(r))) out.add(f.id);
    }
  }
  // Public-use folders are always playable.
  const pub = (await db.folder.findMany({ where: { ownerId, isPublic: true }, take: 500 }) as unknown as { id: string; publicAccess?: string }[]);
  for (const f of pub) {
    if ((f.publicAccess ?? "view") === "use") out.add(f.id);
  }
  return out;
}

export interface AssemblyRef { kind: "q" | "f"; id: string; }

export function parseAssembly(raw: unknown): AssemblyRef[] {
  let arr: unknown = raw;
  if (typeof raw === "string") {
    try { arr = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((x) => x && (x.kind === "q" || x.kind === "f") && typeof x.id === "string" && x.id)
    .map((x) => ({ kind: x.kind as "q" | "f", id: String(x.id) }));
}

// Resolve ordered live question docs for play. Assembly order is honored
// exactly (folders expand in place); legacy questionIds→folderIds apply
// when no assembly is stored. Returns { items, skipped }.
export async function resolveActivity(userId: string, a: ActivityDoc): Promise<{ items: ResolvedQ[]; skipped: number }> {
  const assembly = parseAssembly(a.assembly);
  const items: ResolvedQ[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  async function includeFolder(fid: string): Promise<void> {
    const allowed = await playableFolderIds(userId, a.ownerId);
    if (!allowed.has(fid)) {
      // Count live content the player can't reach as skipped.
      const probe = (await db.question.findMany({ where: { folderId: fid, mergedIntoId: null }, take: 200 }) as unknown as { id: string }[]);
      skipped += probe.length || 1;
      return;
    }
    const qs = ((await db.question.findMany({ where: { folderId: fid, mergedIntoId: null }, take: 200, orderBy: { createdAt: "asc" } }) as unknown as ResolvedQ[])).filter(isBankQuestion);
    for (const q of qs) {
      if (!seen.has(q.id)) { seen.add(q.id); items.push(q); }
    }
  }

  if (assembly.length) {
    for (const ref of assembly) {
      if (ref.kind === "q") {
        if (seen.has(ref.id)) continue;
        const q = (await db.question.findUnique({ where: { id: ref.id } }) as unknown as (ResolvedQ & { mergedIntoId?: string }) | null);
        if (q && !q.mergedIntoId && isBankQuestion(q)) { seen.add(ref.id); items.push(q); }
        else skipped++;
      } else {
        const f = (await db.folder.findUnique({ where: { id: ref.id } }) as unknown as { id: string } | null);
        if (!f) { skipped++; continue; }
        await includeFolder(ref.id);
      }
    }
    return { items, skipped };
  }

  // Legacy: explicit ids first, then linked folders.
  const qIds = Array.from(new Set(strArr(a.questionIds)));
  const fIds = Array.from(new Set(strArr(a.folderIds)));

  if (qIds.length) {
    const live = ((await db.question.findMany({ where: { id: { in: qIds }, mergedIntoId: null } }) as unknown as ResolvedQ[])).filter(isBankQuestion);
    const byId = new Map(live.map((q) => [q.id, q]));
    for (const id of qIds) {
      const q = byId.get(id);
      if (q && !seen.has(id)) { seen.add(id); items.push(q); }
      else skipped++;
    }
  }
  for (const fid of fIds) {
    const f = (await db.folder.findUnique({ where: { id: fid } }) as unknown as { id: string } | null);
    if (!f) { skipped++; continue; }
    await includeFolder(fid);
  }
  return { items, skipped };
}

export interface ResolvedQ {
  id: string;
  stem: string;
  options: string;
  correct: string;
  parts?: string;
  explanation: string;
  type: string;
  difficulty: string;
  topicId?: string;
  creatorId?: string;
}

// Contributors: owner + distinct authors of resolved questions.
export async function activityContributors(a: ActivityDoc): Promise<{ owner: { id: string; name: string }; others: { id: string; name: string }[]; total: number }> {
  const owner = ((await db.user.findUnique({ where: { id: a.ownerId } }) as unknown as { name: string } | null)?.name ?? "Someone");
  const { items } = await resolveActivity(a.ownerId, a);
  const authorIds = Array.from(new Set(items.map((q) => q.creatorId).filter(Boolean) as string[])).filter((id) => id !== a.ownerId).slice(0, 5);
  const others = [];
  for (const id of authorIds) {
    const u = (await db.user.findUnique({ where: { id } }) as unknown as { name: string } | null);
    if (u) others.push({ id, name: u.name });
  }
  return { owner: { id: a.ownerId, name: owner }, others, total: items.length };
}
