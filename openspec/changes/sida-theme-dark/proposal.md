## Why

The app ships one light slate/indigo look. Adopting the reference token system (1School purple `#7853da`, semantic light/dark tokens) with a real light/dark mode brings brand consistency and night usability.

## What Changes

- Token foundation (`--yrk-*`, light + `.dark`), `brand` purple scale replaces indigo accents, class dark mode + persisted toggle with no-flash boot.
- Shell, primitives, and screens gain dark surfaces; signup removed (login-only + default-account picker); creation dialog gets a grabber + roomier mobile layout.

## Capabilities

### New Capabilities
- `theme-system`: tokens, brand scale, dark mode + toggle.
- `login-only`: register removed, default-account quick pick.

### Modified Capabilities
- None.

## Impact

- globals.css, tailwind.config, layout, header/nav, primitives, scripted dark-surface pass; register route deleted (security test updated).
