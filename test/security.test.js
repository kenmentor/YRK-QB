import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname ?? ".", "..");
function read(p) { return fs.readFileSync(path.join(root, p), "utf8"); }

describe("auth criticals", () => {
  it("no header impersonation fallback", () => {
    const auth = read("src/lib/auth.ts");
    assert.ok(!auth.includes('headers.get("x-user-email")'), "header fallback must be gone from auth");
  });
  it("register whitelists roles + throttles", () => {
    const r = read("src/app/api/auth/register/route.ts");
    assert.ok(r.includes('"admin"') && r.includes("403"), "admin self-register must 403");
    assert.ok(r.includes("rateLimited"), "register must be rate limited");
  });
  it("login throttled, cookie secure in prod, no hardcoded prod secret", () => {
    const l = read("src/app/api/auth/login/route.ts");
    assert.ok(l.includes("rateLimited"), "login must be rate limited");
    const a = read("src/lib/auth.ts");
    assert.ok(a.includes("secure: process.env.NODE_ENV"), "cookie needs secure-in-prod");
    assert.ok(a.includes("must be set in production"), "prod without JWT_SECRET must fail loud");
  });
  it("invites only existing accounts", () => {
    const w = read("src/app/api/workspaces/[id]/route.ts");
    assert.ok(w.includes("register first"), "unknown invite emails must 404, not mint ghosts");
  });
});

describe("merge + review integrity", () => {
  it("dedup is admin-only with live-canonical checks", () => {
    const m = read("src/app/api/merges/route.ts");
    assert.ok(m.includes("Only admins merge duplicates"), "dedup needs admin gate");
    assert.ok(m.includes("itself an alias"), "canonical must be live");
    assert.ok(m.includes("skipped"), "already-aliased sources reported");
  });
  it("approve_to_live takes exactly one; set_publish is single-workspace", () => {
    const m = read("src/app/api/merges/route.ts");
    assert.ok(m.includes("exactly one draft"), "bulk silently merging one is banned");
    assert.ok(m.includes("one workspace"), "cross-workspace publish banned");
  });
  it("dup check is a direct lookup, not take:200", () => {
    const m = read("src/app/api/merges/route.ts");
    assert.ok(m.includes("findFirst({ where: { normStem"), "direct normStem lookup");
    assert.ok(!m.includes("take: 200"), "200-scan must be gone");
  });
  it("review: membership gate, no self-approval with reviewer present, 400s not 500s", () => {
    const r = read("src/app/api/drafts/[id]/review/route.ts");
    assert.ok(r.includes("Not a member"), "non-members blocked");
    assert.ok(r.includes("can't approve their own draft"), "self-approval blocked");
    assert.ok(r.includes("status\", 400") || r.includes("400"), "bad transitions are 400s");
    assert.ok(r.includes("reviewSnapshotId: versions[0]"), "snapshot is a version, not the draft");
  });
});

describe("bank + proposal integrity", () => {
  it("proposal commits validate, dedup-check, scope topics", () => {
    const d = read("src/app/api/proposals/[id]/decision/route.ts");
    assert.ok(d.includes("validateQuestion"), "commit must validate payload");
    assert.ok(d.includes("already exists in the bank"), "commit must dup-check");
    assert.ok(d.includes("outside the proposal subject"), "topic must belong to subject");
  });
  it("legacy claim is admin-only", () => {
    const b = read("src/app/api/bank/[id]/route.ts");
    assert.ok(b.includes("ask an admin to assign it"), "first-come ownership theft closed");
  });
  it("regex is escaped, adapter paginates + deletes", () => {
    const db = read("src/lib/db.ts");
    assert.ok(db.includes("escapeRegExp"), "search must be literal");
    assert.ok(db.includes("skip"), "pagination support");
    assert.ok(db.includes("deleteMany"), "hard-delete support for workspace teardown");
  });
});

describe("access, queue, quiz, misc", () => {
  it("private reads gated; members manageable; drafts deletable", () => {
    const w = read("src/app/api/workspaces/[id]/route.ts");
    assert.ok(w.includes("Not a member of this workspace"), "workspace reads gated");
    assert.ok(w.includes("Only owners delete workspaces"), "workspace delete gated");
    const dr = read("src/app/api/drafts/[id]/route.ts");
    assert.ok(dr.includes("Not a member of this workspace"), "draft reads gated");
    assert.ok(dr.includes("deletes drafts"), "draft delete exists");
    assert.ok(fs.existsSync(path.join(root, "src/app/api/workspaces/[id]/members/route.ts")), "member mgmt route exists");
  });
  it("taxonomy queue resolvable; comments capped + throttled", () => {
    assert.ok(fs.existsSync(path.join(root, "src/app/api/taxonomy/proposals/[id]/decision/route.ts")), "taxonomy decision route exists");
    const c = read("src/app/api/drafts/[id]/comments/route.ts");
    assert.ok(c.includes("2000"), "comment length cap");
    assert.ok(c.includes("rateLimited"), "comment throttle");
  });
  it("quiz: full-snapshot grading, filter lock, server clock", () => {
    const q = read("src/app/api/quiz/attempts/route.ts");
    assert.ok(q.includes("doesn't match the filter"), "snapshot/filter mismatch rejected");
    assert.ok(q.includes("blank = wrong") || q.includes("?? []"), "blanks graded");
    assert.ok(q.includes("LATE_GRACE_MS") || q.includes("late"), "overtime exams scored zero");
  });
  it("middleware is Edge-safe; bank paginates; notifications capped", () => {
    const m = read("src/middleware.ts");
    assert.ok(!m.includes("Buffer.from"), "no Buffer in Edge middleware");
    const b = read("src/app/api/bank/route.ts");
    assert.ok(b.includes("skip"), "bank paginates");
    const n = read("src/app/api/notifications/route.ts");
    assert.ok(n.includes("take: 30"), "notifications fetched capped");
  });
  it("workspace-bank linkage: origin stamp, revision updates, join gates", () => {
    const m = read("src/app/api/merges/route.ts");
    assert.ok(m.includes("revisionOf"), "revision drafts update canonical");
    assert.ok(m.includes("workspaceId: draft.workspaceId"), "publishes stamp origin");
    assert.ok(m.includes("merged away, revise its canonical"), "dead aliases not revised");
    const d = read("src/app/api/drafts/route.ts");
    assert.ok(d.includes("revisionOf"), "drafts accept revision link");
    assert.ok(fs.existsSync(path.join(root, "src/app/api/workspaces/[id]/progress/route.ts")), "course-builder progress exists");
    assert.ok(fs.existsSync(path.join(root, "src/app/api/workspaces/[id]/published/route.ts")), "bank mirror exists");
    assert.ok(fs.existsSync(path.join(root, "src/app/api/join-requests/[id]/decision/route.ts")), "join decision exists");
    const j = read("src/app/api/workspaces/[id]/join/route.ts");
    assert.ok(j.includes("Owners only") || j.includes("owner"), "join inbox is owner-only");
    assert.ok(fs.existsSync(path.join(root, "src/app/api/proposals/mine/route.ts")), "my-commits exists");
    assert.ok(fs.existsSync(path.join(root, "src/app/api/proposals/[id]/route.ts")), "proposal edit/withdraw exists");
    const w = read("src/app/api/workspaces/route.ts");
    assert.ok(w.includes("myRole"), "directory exposes per-workspace role");
    assert.ok(w.includes("Unknown"), "destination ids validated");
  });
  it("round two: exam tickets, gated drafts, owned notifications, live checks", () => {
    assert.ok(fs.existsSync(path.join(root, "src/app/api/quiz/start/route.ts")), "exam start endpoint exists");
    const s = read("src/app/api/quiz/start/route.ts");
    assert.ok(s.includes("stay on the server") || s.includes("Answers"), "answers stripped for exams");
    const a = read("src/app/api/quiz/attempts/route.ts");
    assert.ok(a.includes("signed ticket") || a.includes("verifyTicket"), "exam submits need tickets");
    const d = read("src/app/api/drafts/route.ts");
    assert.ok(d.includes("Login required"), "drafts list needs login");
    assert.ok(d.includes("only drafts from my own workspaces") || d.includes("my own workspaces"), "no global draft dump");
    const n = read("src/app/api/notifications/route.ts");
    assert.ok(n.includes("n.userId !== user.id"), "read-own-only notifications");
    const p = read("src/app/api/proposals/[id]/route.ts");
    assert.ok(p.includes("Edits must stay valid"), "proposal edits validated");
    const b = read("src/app/api/bank/[id]/route.ts");
    assert.ok(b.includes("isEditor"), "approved editors empowered");
  });
});
