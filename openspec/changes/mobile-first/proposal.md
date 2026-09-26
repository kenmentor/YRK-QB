## Why

Desktop-first layouts punish phones: top-heavy nav, centered modals, small targets, clipped toolbars. Users spend most time on mobile — it must feel native: thumb navigation, bottom sheets, safe areas, no sideways scroll.

## What Changes

- App shell goes mobile-first: bottom tab bar (Bank/Play/Archive/Me) on small screens, `viewport-fit=cover` + theme color, safe-area insets, tab clearance.
- All dialogs become bottom sheets on mobile via one shared class.
- Touch targets ≥44px, sticky bars respect safe area, horizontal scrollers scroll cleanly, grids/typography tuned at 360px.

## Capabilities

### New Capabilities
- `mobile-shell`: bottom tabs, safe areas, viewport, sheet system, touch sizing.

### Modified Capabilities
- None.

## Impact

- Layout, globals.css, one new nav component, class-only modal updates, runner/bank toolbar polish. No API changes.
