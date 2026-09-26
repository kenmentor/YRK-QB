## Context

Builder tabs exist; editor is a single long card; creation entries differ per page.

## Goals / Non-Goals

**Goals:** minimal editor, guided-but-free creation, one entry component.

**Non-Goals:** editor autosave, templates — deferred.

## Decisions

### 1. Stepper augments tabs, never gates (over wizard lock-in)
Tabs stay clickable; stepper adds numbered order + Back/Next; Publish hero-wide always.
Rationale: "next next done but not restricted" literally.

### 2. Profile collapses unless filled (over always-open)
`<details>`-style toggle; summary shows category · band; expands automatically when validation touches it? No — manual toggle only, plus auto-open when initial carries values.
Rationale: the profile is per-question metadata, not the main task; one tap when needed.

### 3. One creation component (over per-page modals)
`NewActivityButton` owns title/category/sector/visibility + POST + redirect; Archive and Play drop their bespoke versions.
Rationale: identical start everywhere, one place to evolve.

## Risks / Trade-offs

- [Collapsed profile hides required-ish fields] → Mitigation: all profile fields optional with defaults; summary line shows current values.
- [Stepper implies forced order] → Mitigation: every step clickable + Publish always available; copy says "in any order".
