## Context

Slate/indigo single-theme app; reference system is token-based with light + `.dark` mappings and a purple brand accent.

## Goals / Non-Goals

**Goals:** token foundation, purple brand accent, working dark mode with toggle, login-only entry.

**Non-Goals:** font/radius rebrand (Inter + rounded stays), per-screen dark perfection — structural pass first.

## Decisions

### 1. Tokens as foundation, utilities as mapping (over full rewrite)
`:root` / `.dark` token block mirrors the reference; surfaces map to tokens via `dark:` variants. `darkMode: ["class"]` (already configured) drives it.
Rationale: incremental, building, no visual change in light mode.

### 2. Brand scale + codemod (over hand edits)
`brand` 50–900 scale around `#7853da`; scripted `indigo-` → `brand-` (64 sites); preset keys/data values untouched.
Rationale: one accent everywhere, zero drift.

### 3. Toggle + blocking boot script (over effect-only theme)
`localStorage` → `documentElement.dark`, system default, `beforeInteractive` paint — no flash, no hydration mismatch.
Rationale: theme must be correct before first paint.

### 4. Signup deleted, not hidden (over unlinked routes)
Register page + API removed; login gains default-account picker.
Rationale: reviewer flow is login-only; dead endpoints are a liability.

## Risks / Trade-offs

- [Codemod shade collisions (`-50` in `-500`)] → Mitigation: found 8, restored by hand, added a no-corruption test.
- [Colored tints in dark mode] → Mitigation: *-50 → *-950 mappings; second polish pass later.
- [`bg-slate-900` intentional darks] → Mitigation: left as-is (readable in both); only the button primitive inverts.
