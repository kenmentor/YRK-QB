## 1. Backend

- [x] 1.1 `activities` + `activityShares` models; folders gain `isPublic`/`publicAccess` (PATCH owner-only)
- [x] 1.2 `GET /api/archive` (public activities + folders with counts/contributors)
- [x] 1.3 `GET/POST /api/activities`, `GET/PATCH/DELETE /api/activities/[id]` (resolve + authorize + contributors)
- [x] 1.4 `GET/POST /api/activities/[id]/shares`, `DELETE` leave/remove
- [x] 1.5 Contents public read path for `isPublic` folders; quiz/start `activityId` tickets

## 2. Frontend

- [x] 2.1 `/` redirect; header Bank/Play/Archive; middleware for `/activities/*`
- [x] 2.2 `/archive` + `/archive/[id]` (banner, contributors, details, rules gate)
- [x] 2.3 `/activities/[id]` builder (profile, banner, rules, modes, visibility, questions + folders)
- [x] 2.4 Play activities section + `?activity=` support; Share modal public-folder toggle
- [x] 2.5 Tests + tsc + `npm test` green
