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

## 🔴 AND THE SCORER MUST SCORE AGAINST THE WEEK THE RUNNER SEES (`AUTOLINK-OVERRIDE-BLIND-01`, 2026-10-07)

A fourth question, and it is upstream of all three above: **which week is being scored?**

`autoMatchAndAnalyse` read `week.sessions[day]` straight out of `plan_json` and never
consulted `session_overrides`, so a session the runner had **moved** was scored against the
day the plan still thought it lived on.

🔴 **Measured on the founder's own run.** Week 3 `wed → tue` (override live,
`superseded_at: null`); the Progressive tempo moved to Tuesday; 9.88 km / 61 min / HR 154
run on **Tue 6 Oct**. The matcher scored it against **Wednesday**, so `sameWeekday` paid
**0 of its 40 points**:

| Day tried | Score | Reasons |
|---|---|---|
| Mon 5 Oct, Easy 7 km | **10** | `effort match` only; 9.88/7 = **1.41**, just past the 1.40 ceiling |
| Wed 7 Oct, Progressive tempo 8.5 km | **30** | `distance match` only |

⚠️ **`sameWeekday` IS 40 OF THE 70 NEEDED, so the ceiling for that session off-day was 30:
not unlucky, arithmetically impossible.** It is `quality` (no effort points) and
`primary_metric: 'distance'` (no duration points). **The general rule, which nothing had
written down: any distance-primary session that is moved can never auto-link** — **927 of
1,705 sessions (54.4%)** across every live plan. A duration-primary easy run can just reach
70 off-day (30 + 30 + 10) if both ratios and HR land, which is why this never presented as a
universal failure.

⚠️ **`lib/plan/effectiveSessions.ts` was already the owner of this question and had TEN
importers** — dashboard, daily coach note, daily push, widget, plan calendar, day picker.
**Everything that SHOWS the runner their week respected the move; the only thing that ACTS
on it did not.** The two-writer split (`session_overrides` vs `plan_json`) applied to one
side. `autoMatchAndAnalyse` is now the eleventh importer.

🔴 **MATCH ON THE SLOT, WRITE ON THE ORIGINAL DAY.** `session_completions` is keyed
`(user_id, week_n, session_day)` on the day the session is **defined** on, and so are the
post-run deep link and the analyse-run payload. `resolveEffectiveSessions` preserves
`originalDay` for exactly this reason. **Keying the completion to the slot would write a row
the UI can never find — a silent phantom completion, worse than the defect.**

Overrides are filtered to the matched week and to `superseded_at is null`
(`PLAN-WEEK-COLLISION-01`), the same filter `daily-coach-note` uses. The 70-point threshold
and the ±2-day window are **unchanged**: this fix makes the matcher look at the right day, it
does not make it more willing to match.

**Gate:** `lib/coaching/autoLinkOverride.test.ts` — 8 arms, built on the founder's real week
and real activity row, **driving the real `autoMatchAndAnalyse`** through a fake client that
captures the completion row at the `claim_session_completion` RPC. ⚠️ **The first version
re-implemented the loop as a local helper and the helper diverged immediately** (it did not
filter overrides by week), so an arm failed against a wrong copy rather than against the
code — `TIER-OWNER-01`'s flaw. Falsified three ways: revert to `plan_json` · write the slot
instead of the original day · drop the per-week filter.

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
