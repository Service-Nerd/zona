# `RaceTimesCard` — contract

**Component:** `components/shared/RaceTimesCard.tsx`

Race projections: *"where you stand today"*. **PAID.** Same data, three surfaces. **4 importers.**

⚠️ **Written 2026-11-15 (`CONTRACT-COVERAGE-03`, highest reach first).**

## Prop interface

```typescript
interface RaceTimesCardProps {
  variant?: RaceProjectionsVariant
  stravaConnected: boolean
  benchmarkRecalDismissedAt?: string | null
  onOpenBenchmark?: () => void
  onDismissRecal?: () => void
  previewData?: RaceTimeData
}
```

⚠️ Declared inline; the name above is the contract's, for the prop-for-prop gate.

## The three variants are three surfaces, not three looks

| `variant` | Surface | Framing |
|---|---|---|
| `status` *(default)* | Coach screen — the canonical home | *"Where you stand today"* |
| `anchor` | Benchmark entry | *"Where you are now"* — the anchor for the recalibrate form rendered **below** it |
| `result` | Benchmark result | post-update confirmation |

⚠️ **The R32 recalibration nudge renders on `status` ONLY, and that is not a styling choice:
the other two variants ARE recalibration.** Offering a nudge to recalibrate on the screen the
runner is already recalibrating from is the kind of thing that reads as a bug.

## Invariants

1. **All copy lives in `raceProjectionsCopy.ts` — nothing user-facing is hardcoded here.**
   `RACE_PROJECTIONS_COPY[variant]` is the single lookup, so adding a surface is a copy entry
   rather than a branch in this file.
2. ⚠️ **`previewData` IS A FIXTURE SEAM FOR `/coach-preview` ONLY AND IS NEVER PASSED FROM THE
   APP.** 📐 Verified 2026-11-15: its only two call sites are `app/coach-preview/page.tsx` and
   `app/coach-preview/full/page.tsx`. It exists because this card is PAID **and** auth-gated, so
   every state of it was previously unviewable without being a user in that state — which is how
   **the wizard-bracket state, the MAJORITY path at 58% of plans**, went unexamined until the
   founder read it on a test account. When set, the card renders it instead of fetching
   (`loading` starts false and the effect early-returns), so a preview is never one network
   failure away from an error state.
3. **The tier gate is the server's, not this component's.** `/api/race-times` gates by tier; on
   free this is not rendered at all — the Coach screen swaps in `CoachTeaser`, and the benchmark
   flow is paid-only. Do not add a tier branch here: that would be a second answer to a question
   `resolveTier` already owns (`TIER-OWNER-01`).
4. **It fetches on mount through `authedFetch`**, never a bare `fetch` — the session token has to
   be attached, and `authedFetch` is the one owner of that.
5. ⚠️ **`data.state` IS A 1–5 ENUM AND `5` IS THE EMPTY CASE**, handled in the same branch as
   `error || !data`. A runner with nothing to project sees the honest empty state, not a zero.
6. **`stravaConnected` is required** — the empty and low-confidence copy differs depending on
   whether connecting Strava would actually help, and a default would silently pick one.
7. ⚠️ **`benchmarkRecalDismissedAt` is a TIMESTAMP, not a boolean.** The nudge returns after a
   dismissal has aged, so a boolean could not express the state.
8. **The arc is its own owner.** `buildRaceProgressArc` computes the points and
   `RaceProgressArcRow` renders them; the arc may sit at a **different distance from the race**
   when the race distance cannot be projected (ultra), which is why `TargetRace.arc` carries its
   own `distanceKm`.
9. **`minHeight: TAP_TARGET_MIN_PX`** on the interactive rows (44px, iOS HIG).
10. **No hardcoded colour.** Times are formatted by `formatClockTime` (`lib/format.ts`, ADR-015's
    sole owner), never by local arithmetic.

## Pattern

`ui-patterns.md` § metric pair + arc. Rulings: R31 (target race with delta vs plan-creation
baseline), R32 (recalibration nudge).
