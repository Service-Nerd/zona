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

## 🔴 THREE QUESTIONS, THREE OWNERS, ONE SCORER (`MATCH-LIST-WINDOW-01`, 2026-10-05)

This contract used to end *"fails if `findMatchCandidates` is called anywhere outside this
module"*, which read as **one entry point**. There are three questions and they are not the
same question. Confusing them is what produced the defect below.

| Question | Owner | Shape |
|---|---|---|
| Which run **IS** this session? | `findMatchCandidates` (`sessionMatch.ts`) | ±2 days, distance-aware **0.75–1.40**, confidence-ranked |
| Which single run do I **OFFER** as a CTA? | `resolveAutoMatch` (this module) | the top candidate, `high` or `medium` |
| Which runs may a runner **BROWSE** to link? | `isInLinkPool` + `rankLinkCandidates` (`sessionMatch.ts`) | **wider on purpose** (`LINK_POOL_LOOKBACK_DAYS = 5`), ranked by the scorer above |

⚠️ **The browse pool is deliberately wider than the matcher and must stay so.** A runner does a
Tuesday session on Saturday and must still be able to link it. Narrowing it to ±2 days is a
**capability** change and belongs to the 🧭 Design Board, not to a defect fix.

🔴 **The defect this replaced.** `SessionPopupInner` hand-rolled the browse window as an
asymmetric **−5/+0-day** date test with **no distance component** — a second answer to question 1,
parallel to the matcher. The founder's capture is explained by it exactly: a **20 Sep / 14 km** run
offered for a **Fri 25 Sep / 8 km** session, because 25 Sep − 5 = 20 Sep (the boundary) and
14/8 = 1.75 was never tested. ⚠️ **And the parent had ALREADY run the matcher** and passed its
ranked top candidate in as `autoMatch`, so the screen showed the right answer as a CTA above a
recency-sorted list that contradicted it. The item was filed as *"no date filter"*; **there was a
filter, and a second answer is harder to see than a missing one.**

## Callers

`DashboardClient` — the session screen's `activeAutoMatch`, and `TodayScreen`'s
`todayAutoMatch`. `SessionPopupInner` — the browse pool and its order.

**Gated by `lib/coaching/logOneIntention.test.ts`:**
- `findMatchCandidates` has **zero** call sites in the dashboard tree (it belongs to
  `sessionAutoMatch.ts` and `sessionMatch.ts` alone);
- **no component rolls its own date window** — ⚠️ this arm exists because the first one greps a
  SYMBOL and was green throughout the defect it was written to prevent, which used none. **A gate
  that greps one symbol cannot hold an intent.** The relative-time display formatter is exempt
  **by its exact expression**, so `getDate() - 2` still fails.
