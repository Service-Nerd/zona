// SESSION-INTERVALS-HUE-01 (Design Board 2026-10-22, 6t-f step 2). The catalogue rows whose category is `vo2max`, as
// plain ids, so `getSessionColor` can colour VO2 work by what it IS without pulling the whole catalogue into the website
// bundle (BUNDLE-BOUNDARY-01: `getSessionColor` reaches the homepage through `SessionCard`).
//
// ⚠️ A hand list, so it is held by `vo2CatalogueIds.test.ts`, which DERIVES the set from `V1_SESSION_CATALOGUE` and
// fails on any difference in either direction. Add a VO2 row to the catalogue and that test names it.
export const VO2_CATALOGUE_IDS: ReadonlySet<string> = new Set([
  'intervals_classic', 'intervals_short', 'intervals_long', 'intervals_30_30', 'intervals_rolling', 'hill_reps',
])
