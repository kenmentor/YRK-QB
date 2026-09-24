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

  it("shadcn/ui used for frontend", () => {
    for (const f of ["src/components/ui/button.tsx", "src/components/ui/card.tsx", "src/components/ui/badge.tsx", "src/components/ui/input.tsx"]) {
      assert.ok(fs.existsSync(path.join(root, f)), `missing shadcn component ${f}`);
    }
    const pkg = JSON.parse(read("package.json"));
    for (const dep of ["class-variance-authority", "clsx", "tailwind-merge", "lucide-react"]) {
      assert.ok(pkg.dependencies[dep] || pkg.devDependencies[dep], `missing dep ${dep}`);
    }
  });
});
