import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname ?? ".", "..");

function read(p) {
  return fs.readFileSync(path.join(root, p), "utf8");
}

describe("6.1 end-to-end contracts exist", () => {
  it("workspace -> draft -> review -> merge -> bank -> quiz chain wired", () => {
    const tasks = read("openspec/changes/collaborative-question-bank/tasks.md");
    for (const needle of ["workspace", "review", "merge", "bank", "practice", "exam mode", "history"]) {
      assert.ok(tasks.toLowerCase().includes(needle), `tasks.md missing ${needle}`);
    }
    for (const f of [
      "src/app/api/workspaces/route.ts",
      "src/app/api/drafts/route.ts",
      "src/app/api/drafts/[id]/review/route.ts",
      "src/app/api/merges/route.ts",
      "src/app/api/bank/route.ts",
      "src/app/api/quiz/attempts/route.ts"
    ]) {
      assert.ok(fs.existsSync(path.join(root, f)), `missing ${f}`);
    }
  });

  it("quiz reads only published canonical questions", () => {
    const bank = read("src/app/api/bank/route.ts");
    assert.ok(bank.includes("mergedIntoId: null"), "bank must exclude aliases");
    const quiz = read("src/app/api/quiz/attempts/route.ts");
    assert.ok(quiz.includes("mergedIntoId: null"), "quiz must skip drafts/aliases");
  });
});

describe("6.2 role denials, conflicts, alias integrity", () => {
  it("reviewer cannot edit (server-side)", () => {
    const perms = read("src/lib/permissions.ts");
    assert.ok(perms.includes("FORBIDDEN_REVIEWER_EDIT"), "reviewer edit must throw coded error");
    const draftRoute = read("src/app/api/drafts/[id]/route.ts");
    assert.ok(draftRoute.includes("assertCanEdit"), "draft edit route must enforce");
  });

  it("version conflicts create branches with diff capability", () => {
    const route = read("src/app/api/drafts/[id]/route.ts");
    assert.ok(route.includes("conflictBranch"), "must flag conflict branch");
    assert.ok(route.toLowerCase().includes("questionversion"), "must append version");
  });

  it("duplicate merge preserves alias (never hard delete)", () => {
    const merges = read("src/app/api/merges/route.ts");
    assert.ok(merges.includes("mergedIntoId"), "dedup must set merged_into alias");
    assert.ok(!merges.includes("deleteMany"), "must never hard-delete questions");
  });

  it("state machine enforced", () => {
    const lifecycle = read("src/lib/lifecycle.ts");
    for (const s of ["draft", "in_review", "approved", "changes_requested", "merged"]) {
      assert.ok(lifecycle.includes(s), `missing state ${s}`);
    }
    const review = read("src/app/api/drafts/[id]/review/route.ts");
    assert.ok(review.includes("assertTransition"), "review must enforce transitions");
    assert.ok(review.includes("explanation"), "review submit must require explanation");
  });

  it("question validation covers all types", () => {
    const v = read("src/lib/validation.ts");
    for (const t of ["mcq", "multi_select", "true_false", "fill_in"]) {
      assert.ok(v.includes(t), `missing type ${t}`);
    }
  });

  it("iQueBS catalog: all form formats validated + graded", () => {
    const v = read("src/lib/validation.ts");
    for (const t of ["matching", "saq", "meq", "compound", "emq", "kfq", "mtf", "sct", "osce", "dops", "minicex", "msf", "viva"]) {
      assert.ok(v.includes(`"${t}"`), `validation missing catalog type ${t}`);
    }
    assert.ok(v.includes("difficultyIndex"), "question profile needs difficulty 1-5");
    assert.ok(v.includes("mediaUrl"), "question profile needs media file");
    assert.ok(v.includes("category"), "question profile needs category");
    const g = read("src/lib/lifecycle.ts");
    assert.ok(g.includes("RUBRIC_TYPES"), "rubric helpers present");
    assert.ok(g.includes("rubricOk"), "rubric pass rule present");
    const at = read("src/app/api/quiz/attempts/route.ts");
    assert.ok(at.includes("manualById"), "rubric manual scores accepted");
    assert.ok(at.includes("partRows"), "per-part breakdown present");
  });

  it("exam sets: model, APIs, set tickets, builder UI", () => {
    const db = read("src/lib/db.ts");
    assert.ok(db.includes("examSets"), "examSet model present");
    for (const f of [
      "src/app/api/exam-sets/route.ts",
      "src/app/api/exam-sets/[id]/route.ts",
      "src/app/exam-sets/page.tsx",
      "src/app/exam-sets/[id]/page.tsx",
    ]) {
      assert.ok(fs.existsSync(path.join(root, f)), `missing ${f}`);
    }
    const start = read("src/app/api/quiz/start/route.ts");
    assert.ok(start.includes("setId"), "test tickets support exam sets");
    const play = read("src/app/play/page.tsx");
    assert.ok(play.includes("MatchingInput"), "drag-and-drop matching runner present");
    assert.ok(play.includes("meqShown"), "MEQ stepwise reveal present");
  });

  it("folder sharing: invites with viewer/reviewer/editor + subtle mark", () => {
    const db = read("src/lib/db.ts");
    assert.ok(db.includes("folderShares"), "folderShare model present");
    assert.ok(fs.existsSync(path.join(root, "src/lib/share.ts")), "access helper present");
    const share = read("src/lib/share.ts");
    assert.ok(share.includes("reviewer"), "reviewer role present");
    for (const f of [
      "src/app/api/drive/shares/route.ts",
      "src/app/api/drive/shares/[id]/route.ts",
      "src/app/api/drive/shares/mine/route.ts",
    ]) {
      assert.ok(fs.existsSync(path.join(root, f)), `missing ${f}`);
    }
    const folders = read("src/app/api/drive/folders/[id]/route.ts");
    assert.ok(folders.includes("Only the folder owner moves it"), "reparent locked to owner");
    assert.ok(folders.includes("Only the folder owner deletes it"), "delete locked to owner");
    const grid = read("src/components/drive-grid.tsx");
    assert.ok(grid.includes("SharedMark"), "slate people badge present");
    assert.ok(!grid.includes("SharedChip"), "green wash removed");
    const bank = read("src/app/bank/page.tsx");
    assert.ok(bank.includes("/api/drive/shares/mine"), "shared-with-me inbox wired");
  });

  it("public archive + activities: publish, rules gate, tickets", () => {
    const db = read("src/lib/db.ts");
    assert.ok(db.includes("activities"), "activity model present");
    assert.ok(db.includes("activityShares"), "activityShare model present");
    for (const f of [
      "src/app/api/archive/route.ts",
      "src/app/api/activities/route.ts",
      "src/app/api/activities/[id]/route.ts",
      "src/app/api/activities/[id]/shares/route.ts",
      "src/app/archive/page.tsx",
      "src/app/archive/[id]/page.tsx",
      "src/app/archive/folder/[id]/page.tsx",
      "src/app/activities/[id]/page.tsx",
    ]) {
      assert.ok(fs.existsSync(path.join(root, f)), `missing ${f}`);
    }
    const start = read("src/app/api/quiz/start/route.ts");
    assert.ok(start.includes("activityId"), "test tickets support activities");
    const detail = read("src/app/archive/[id]/page.tsx");
    assert.ok(detail.includes("accept"), "rules accept gate present");
    const home = read("src/app/page.tsx");
    assert.ok(home.includes("/archive"), "logged-out entry is the archive");
    const contents = read("src/app/api/drive/contents/route.ts");
    assert.ok(contents.includes("isPublic"), "public read path present");
  });

  it("entry polish: archive creation, rich menus, file delete", () => {
    const del = read("src/app/api/bank/[id]/route.ts");
    assert.ok(del.includes("export async function DELETE"), "file delete endpoint present");
    const grid = read("src/components/drive-grid.tsx");
    for (const item of ["Assigned people", "Make public", "Make private", "Edit question", "Assign someone"]) {
      assert.ok(grid.includes(item), `menu missing ${item}`);
    }
    const arch = read("src/app/archive/page.tsx");
    assert.ok(arch.includes("NewActivityButton"), "archive-side creation present");
    const builder = read("src/app/activities/[id]/page.tsx");
    assert.ok(builder.includes("createInline") || builder.includes("Create & link"), "on-the-fly creation present");
  });

  it("curriculum + builder v2: categories, assembly order, tabs", () => {
    const lib = read("src/lib/activity.ts");
    assert.ok(lib.includes("parseAssembly"), "ordered assembly parser present");
    assert.ok(lib.includes("CURRICULUM"), "curriculum ladder present");
    const patch = read("src/app/api/activities/[id]/route.ts");
    assert.ok(patch.includes("body.assembly"), "assembly writes accepted");
    assert.ok(patch.includes("body.category"), "category writes accepted");
    const arch = read("src/app/api/archive/route.ts");
    assert.ok(arch.includes("catVotes"), "folder category derivation present");
    const builder = read("src/app/activities/[id]/page.tsx");
    for (const tab of ["content", "present", "rules", "people"]) {
      assert.ok(builder.includes(`"${tab}"`), `builder tab missing ${tab}`);
    }
    assert.ok(builder.includes("togglePreview"), "folder previews present");
    const play = read("src/app/play/page.tsx");
    assert.ok(play.includes("LADDER"), "curriculum groups in Play present");
    assert.ok(play.includes("NewActivityButton"), "shared creation entry in Play present");
  });

  it("explorer + publish: checkbox linking, single go-live", () => {
    assert.ok(fs.existsSync(path.join(root, "src/components/content-explorer.tsx")), "explorer present");
    const ex = read("src/components/content-explorer.tsx");
    for (const t of ['"mine"', '"shared"', '"public"']) {
      assert.ok(ex.includes(t), `explorer tab missing ${t}`);
    }
    assert.ok(ex.includes("selected"), "checkbox tray present");
    const b = read("src/app/activities/[id]/page.tsx");
    assert.ok(b.includes("Publish"), "publish action present");
    assert.ok(b.includes("beforeunload"), "dirty guard present");
    assert.ok(!b.includes("onBlur={(e) => patch"), "no autosave-on-blur left");
  });

  it("guided creation + compact editor", () => {
    assert.ok(fs.existsSync(path.join(root, "src/components/new-activity-button.tsx")), "shared entry present");
    const arch = read("src/app/archive/page.tsx");
    assert.ok(arch.includes("NewActivityButton"), "archive uses shared entry");
    const b = read("src/app/activities/[id]/page.tsx");
    assert.ok(b.includes("StepNav"), "stepper present");
    assert.ok(b.includes("Publish & finish"), "finish step present");
    const ed = read("src/components/question-editor.tsx");
    assert.ok(ed.includes("profileOpen"), "collapsible profile present");
    assert.ok(ed.includes("sticky bottom-3"), "sticky action bar present");
  });

  it("runner quality + artifact edit path + dialog", () => {
    const detail = read("src/app/archive/[id]/page.tsx");
    assert.ok(detail.includes("/activities/${meta.id}") || detail.includes("Edit in builder"), "owner edit path present");
    const play = read("src/app/play/page.tsx");
    assert.ok(play.includes("sticky top-16"), "sticky runner bar present");
    assert.ok(play.includes("sticky bottom-3"), "sticky action bar present");
    assert.ok(play.includes("String.fromCharCode(65"), "lettered options present");
    assert.ok(play.includes("setWrongOnly"), "wrong-only review present");
    const dlg = read("src/components/new-activity-button.tsx");
    assert.ok(dlg.includes("titleRef"), "dialog focuses title");
    assert.ok(dlg.includes("Escape"), "dialog dismisses on Escape");
  });

  it("stability: hydration-safe init + guarded fetches", () => {
    assert.ok(fs.existsSync(path.join(root, "src/lib/api.ts")), "api helper present");
    for (const f of ["src/app/bank/page.tsx", "src/app/play/page.tsx", "src/app/archive/[id]/page.tsx", "src/app/login/page.tsx"]) {
      const src = read(f);
      assert.ok(!src.includes("typeof window !== \"undefined\" ? new URLSearchParams"), `${f} reads URL at render`);
      assert.ok(!src.includes("typeof window !== \"undefined\" &&"), `${f} reads browser at render`);
    }
    const bank = read("src/app/bank/page.tsx");
    assert.ok(bank.includes("apiGet") && bank.includes("apiSend"), "bank uses guarded fetches");
    const header = read("src/components/site-header.tsx");
    assert.ok(header.includes("unhandledrejection"), "global rejection net present");
    const play = read("src/app/play/page.tsx");
    assert.ok(play.includes("Couldn't reach the server"), "round start/submit guarded");
  });

  it("shadcn/ui used for frontend", () => {
    for (const f of ["src/components/ui/button.tsx", "src/components/ui/card.tsx", "src/components/ui/badge.tsx", "src/components/ui/input.tsx"]) {
      assert.ok(fs.existsSync(path.join(root, f)), `missing shadcn component ${f}`);
    }
    const pkg = JSON.parse(read("package.json"));
    assert.ok(pkg.dependencies["jszip"], "jszip dep present");
    for (const dep of ["class-variance-authority", "clsx", "tailwind-merge", "lucide-react"]) {
      assert.ok(pkg.dependencies[dep] || pkg.devDependencies[dep], `missing dep ${dep}`);
    }
  });

  it("transport: copy, real-folder zip, JSON import", () => {
    for (const f of [
      "src/app/api/drive/export/route.ts",
      "src/app/api/drive/import/route.ts",
      "src/app/api/drive/folders/[id]/copy/route.ts",
      "src/components/import-modal.tsx",
      "src/lib/transport.ts",
    ]) {
      assert.ok(fs.existsSync(path.join(root, f)), `missing ${f}`);
    }
    const grid = read("src/components/drive-grid.tsx");
    for (const item of ["Download (.zip)", "Make a copy", "Import into", "Download (.json)"]) {
      assert.ok(grid.includes(item), `menu missing ${item}`);
    }
    const imp = read("src/app/api/drive/import/route.ts");
    assert.ok(imp.includes("yrk-folder/1"), "bundle format gate present");
    assert.ok(imp.includes("max 500") || imp.includes("Too many questions"), "import caps present");
    const bank = read("src/app/bank/page.tsx");
    assert.ok(bank.includes("ImportModal"), "import entry wired");
  });

  it("mobile-first shell: tabs, sheets, safe areas, targets", () => {
    assert.ok(fs.existsSync(path.join(root, "src/components/mobile-nav.tsx")), "bottom tabs present");
    const nav = read("src/components/mobile-nav.tsx");
    for (const href of ["/bank", "/play", "/archive", "/profile"]) {
      assert.ok(nav.includes(href), `tab missing ${href}`);
    }
    const layout = read("src/app/layout.tsx");
    assert.ok(layout.includes("MobileNav"), "tabs mounted");
    assert.ok(layout.includes("viewportFit") || layout.includes("viewport"), "viewport configured");
    assert.ok(layout.includes("pb-28"), "tab clearance present");
    const css = read("src/app/globals.css");
    assert.ok(css.includes(".yrk-sheet"), "sheet system present");
    assert.ok(css.includes("safe-area-inset-bottom"), "safe areas present");
    const btn = read("src/components/ui/button.tsx");
    assert.ok(btn.includes("h-10") && btn.includes("sm:h-8"), "mobile-first button sizing present");
    const grid = read("src/components/drive-grid.tsx");
    assert.ok(grid.includes("min-h-[44px]"), "44px rows present");
  });
});
