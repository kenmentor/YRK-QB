## Why

The platform is a web app with no landing page: logged-out visitors go to a public archive of published artifacts (group questions/folders, as owners publish them); logged-in users land in their personal root and reach the archive, shared activities, and public folders from Play. Each artifact carries a banner, title, contributors, details, and owner-written rules (practice vs test); accepting the rules starts the quiz.

## What Changes

- `/` redirects: logged in → `/bank`, else → `/archive` (public: artifacts + public folders, browsable logged-out).
- **Artifacts (activities)**: banner preset, title, details, practice/test rules, modes, visibility, ordered questions + linked folders; owner + activity shares (viewer plays, editor co-builds); contributors derived from content authorship.
- **Public folders**: owners publish folders (`isPublic`, access view/use); `use` folders can be pulled into activities and played; archive lists them.
- **Play** shows activities (mine, shared with me, public) above the quick-round config; `?activity=` + `?mode=` deep-link with rules-accept gate.
- Artifact detail: banner, title, contributors, details → rules screen → Accept → quiz starts (login required to record).

## Capabilities

### New Capabilities
- `public-archive`: public artifact/folder listing + artifact detail with rules-accept-to-play.
- `activities`: activity CRUD, shares, folder/question assembly, set/order-preserving play incl. strict tickets.

### Modified Capabilities
- None (additive; exam sets stay).

## Impact

- New `activities`, `activityShares` collections; folders gain `isPublic`/`publicAccess`.
- New APIs: `/api/archive`, `/api/activities*`, activity tickets in quiz/start; contents gains a public read path.
- UI: home becomes a redirect; header Bank/Play/Archive; archive + builder pages; Play activities section. No new deps.
