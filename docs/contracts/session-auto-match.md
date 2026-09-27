# `lib/coaching/sessionAutoMatch.ts`

**Written 2026-09-27 (`LOG-ONE-INTENTION-01`).** The single owner of *"which run is this
session?"* asked **client-side**, before the runner is made to choose.

```ts
resolveAutoMatch(session, weekStartDate, dayKey, activities): AutoMatch | null
sessionDateFor(weekStartDate, dayKey): Date | null
```

## Why it exists

`DashboardClient` computed this inline for the **session screen only**, keyed on
`activeSessionData`. Today already held `stravaRuns` and today's session and could have
answered the same question — it just never asked, and so offered the runner a choice
instead: *"Log this session"* or *"Log manually"*. **Two words for one intention.**

🔴 **Copying the twelve lines into `TodayScreen` was the obvious move and would have created a
parallel classifier** — this repo's most expensive recorded duplication class (the tier order
written three times, the deload cadence in five places, `sumWeeklyKm` by hand in six). Two
classifiers of the same thing both look right in isolation and drift in production.

## ⚠️ This is NOT the server's matcher, and must not become it

| | `autoMatchAndAnalyse` (ingest) | `resolveAutoMatch` (this) |
|---|---|---|
| Consequence | **Links silently**, no human present | **Shows** a runner who is looking at the screen |
| Confidence gate | **HIGH only** — *"wrong link is worse than a picker tap"* (POST-RUN-01) | **high or medium** — the run's name, distance and time are visible and tapping is consent (AUTO-MATCH-02) |

Same source data, different consequence. **The gates differ for that reason** — do not
"harmonise" them.

## `null` means "we do not know", never "there was no run"

The caller opens manual entry on `null`. It must **not** render *"we could not find a run"*:
that taxes the runner whose runs never reach HealthKit (ADR-011 §5) for our failure to find
them, and it is the condition the `LOG-ONE-INTENTION-01` collapse turned on.

A throw is caught and returns `null` for the same reason.

## Callers

`DashboardClient` — the session screen's `activeAutoMatch`, and `TodayScreen`'s
`todayAutoMatch`. Gated by `lib/coaching/logOneIntention.test.ts`, which fails if
`findMatchCandidates` is called anywhere outside this module.
