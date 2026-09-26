## ADDED Requirements

### Requirement: Token theme with light and dark mode
The app SHALL define semantic theme tokens (light + `.dark`), render a persistent toggle with system default and no-flash boot, and support dark surfaces across shell, primitives, and screens.

#### Scenario: Toggle
- **WHEN** a user flips to dark mode
- **THEN** surfaces, text, and borders re-map and the choice persists reloads

### Requirement: Login-only with default accounts
Signup SHALL be removed; login SHALL offer one-tap default accounts with prefilled credentials.

#### Scenario: Reviewer login
- **WHEN** a reviewer taps Ama
- **THEN** credentials fill and Login signs them in
