# API Contract — /api/recalibrate-hr

**Method:** POST
**Auth:** Bearer token. Any authenticated user.
**Gate:** none. Re-deriving a figure the runner already owns is not a paid feature.

> 🔴 **WRITTEN 2026-10-08 because §123 changed this route and it had no contract.**
> `audit-docs.sh` flagged it (*"MISSING contract for /api/recalibrate-hr (route changed, no
> contract names it)"*), which is the check doing its job: it was one of the 14 routes in
> `CONTRACT-COVERAGE-01`'s declared debt, and a changed route may not stay in it.

## Request body

None. The route reads the caller's own zones and recent activities.

## What it does

When a runner's HR inputs change (max HR, resting HR), the zone boundaries move — so the
**already-stored** per-run figures were computed against bands that no longer exist. This
route re-derives them for the last **`LOOKBACK_DAYS = 90`** days from each activity's
stored `hr_bpm_histogram`.

🔴 **IT IS A WRITER, AND THAT IS THE WHOLE REASON IT MATTERS.** It updates
`run_analysis.hr_in_zone_pct`, `hr_above_ceiling_pct` and `hr_below_floor_pct` in place.

## Columns written

| Column | Note |
|---|---|
| `run_analysis.hr_in_zone_pct` | share inside the band(s) the session prescribed |
| `run_analysis.hr_above_ceiling_pct` | share above every prescribed band |
| `run_analysis.hr_below_floor_pct` | ⚠️ **added 2026-10-08.** Previously left untouched, so a recalibrated row carried two figures from the new rule and one from the old |

⛔ **It does NOT touch `strava_activities.hr_in_zone_pct` / `hr_above_ceiling_pct`.** Those
are Z2-anchored by definition and `lib/coaching/limiter.ts` reads them as an overload signal
(`PACING_HOT_PCT_THRESHOLD`). Re-anchoring them per session type would make a
correctly-executed tempo read as *"ran hot"* — Willy's binding condition on §123.

## The band logic is NOT this route's

**§123.** The split comes from `lib/coaching/prescribedZoneFigures.ts`, the single owner,
and the **whole session** is passed to it — not just `session.type`.

> 🔴 **THIS ROUTE CARRIED A RE-IMPLEMENTATION UNTIL 2026-10-08, AND SAID SO IN ITS OWN
> COMMENT:** *"Re-implementation of derivePrescribedZoneHrFigures (private in analyse-run).
> Kept local so we don't need to export it from a heavy route file."*
>
> ⚠️ **Because this route WRITES those columns, the copy was not merely untidy.** Left in
> place, it would have kept the type-only logic while `/api/analyse-run` moved to the
> structure-aware owner — so **a single recalibration would have silently reverted §123 on
> every row it touched**, and the three figures in one row would have come from two
> different rules. The drift the singularity doctrine exists to prevent, by the shortest
> available route.

## Response — 200

```json
{ "ok": true, "updated": 7 }
```

`updated` is the number of `run_analysis` rows rewritten.

**Early returns, both 200 with `updated: 0`** — neither is an error, and each names its cause
so a caller is never left inferring it:

| `reason` | Meaning |
|---|---|
| `no_zones` | the runner has no `zone2Ceiling`, so there is nothing to recalibrate against |
| `no_activities` | no activities inside the 90-day window |

## Error responses

| Status | Condition |
|---|---|
| 401 | No valid session |

⚠️ **A per-activity failure does not fail the request.** It is logged
(`[recalibrate-hr] activity failed`) and the loop continues, so a single bad row cannot cost
the runner the other 89 days. The count in `updated` is therefore the number that
**succeeded**, not the number attempted.

## Related

`docs/contracts/api/analyse-run.md` (the other consumer of the same owner) ·
`CoachingPrinciples.md` §123 · `docs/canonical/coaching-rulings.md` §
`READ-DIRECTION-OVERCLAIM-01` + Amendment 1.
