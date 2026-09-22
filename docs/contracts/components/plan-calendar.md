# Contract — PlanCalendar Component

**Authority**: This document defines the prop interface and rendering contract for `components/training/PlanCalendar.tsx`. Any change to props or session tap shape must update this document in the same commit.

**Component:** `components/training/PlanCalendar.tsx`

---

## Prop Interface

```typescript
interface Props {
  weeks: Week[]
  allOverrides: { week_n: number; original_day: string; new_day: string }[]
  allCompletions: Record<number, Record<string, any>>   // keyed by week number, then day
  onOverrideChange: (overrides: { week_n: number; original_day: string; new_day: string }[]) => void
  onSessionTap: (session: SessionTapPayload, weekN: number, weekTheme: string) => void

  // Corrected 2026-09-18: these four were on the component and NOT in this
  // contract. Found by hand during a docs audit, because the audit script
  // checks API routes against docs/contracts/api only and never looks at
  // docs/contracts/components.
  overridesReady?: boolean                          // false while overrides are still loading
  units?: DistanceUnits                             // 'km' | 'mi' — INV-PREF-001
  preferredMetric?: SessionMetric                   // distance vs duration (ADR-015)
  sessionMetricOverrides?: SessionMetricOverrides   // per-session metric override
}
```

**Units (INV-PREF-001).** Every distance this component renders resolves through
`lib/format.ts` with `units` — the prescribed session distance, the week header
total (`sumRoundedDistance`), and, since PREF-SWEEP-01 (2026-09-18), the linked
**Strava activity distance** on a completed day, which previously hardcoded `km`
and so showed km to a miles runner.

### SessionTapPayload (passed to onSessionTap)

```typescript
{
  key: string           // original day key (e.g. 'mon') — respects overrides
  day: string           // display label (e.g. 'Mon')
  title: string         // session.label
  detail: string        // session.detail ?? ''
  type: string          // session.type
  date: string          // formatted date (e.g. "5 Jan")
  rawDate: string       // ISO date string
  today: boolean
  completion: Completion | undefined
  isPast: boolean
  isFuture: boolean
  // Structured session fields — always pass through so SessionScreen renders
  // identically regardless of whether it was opened from Today or Plan.
  // catalogue_id/derived_set/label are what catalogueRowFor()/mainSetDescription()
  // need to resolve real main-set instructions — without them the detail screen
  // falls back to a generic "Quality main set." placeholder (D-08 bug, fixed
  // 2026-09-03; see lib/plan/sessionDetailPayload.test.ts for the regression test).
  label?: string
  catalogue_id?: string
  derived_set?: DerivedSet   // from lib/plan/resolveMainSet.ts
  zone?: string
  distance_km?: number
  duration_mins?: number
  primary_metric?: 'distance' | 'duration'
  hr_target?: string
  pace_target?: string
  rpe_target?: number
  coach_notes?: [string, string?, string?]
}
```

---

## Rendering Contract

- Past weeks are collapsed behind a "Load N past weeks" button. Shown when tapped.
- Current week is determined by `week.type === 'current'`. Highlighted with teal left border.
- Completed/deload_done weeks render at 50% opacity.
- Sessions are rendered in `mon–sun` order regardless of plan JSON key order.
- Overrides are applied before render: `original_day` sessions appear at `new_day` slots. Overridden slots show the moved session.
- Rest sessions and empty days render a rest label — they are not tappable.
- **The week-header total resolves through `sessionKmSelfPaced()`** (`lib/plan/sessionDistance.ts`),
  never `session.distance_km` directly, at **both** week-header sites. A session is anchored
  EITHER by distance OR by duration, and a beginner's plan is duration-anchored on 95.8% of
  sessions; `distance_km ?? 0` asserts "this session covered no ground", which summed a real
  week to 0 and — because the total renders behind `intendedKm > 0` — made it vanish entirely.
  That read to the runner as *"some weeks have a total and some don't"* and, separately, as
  *"everything shows duration even though my profile says distance"*. The owner returns
  **null, never 0**, when nothing resolves, so an unresolvable session refuses rather than
  under-reporting. `lib/marketing/appReviewDefects.test.ts` counts both sites (APP-REVIEW-W2,
  2026-09-22; the `?? 0` class, SESSION-KM-01/02).
- Sessions can be moved via a drag handle (≡ icon). Move mode shows "tap an empty day to move, or another session to swap" hint and highlights two kinds of target slots:
  - **Move target** (empty slot — rest day or undefined day): dashed teal outline, body text reads "Move here". On tap, the source session moves into the slot and the rest placeholder disappears.
  - **Swap target** (another non-rest, uncompleted, unskipped session): solid teal outline, source session label tinted teal with "tap to swap" hint and `⇄` glyph on the right. On tap, the two sessions exchange slots in one atomic write.
- Completed and skipped sessions never become targets in move mode.

## Supabase Writes

`PlanCalendar` writes session overrides directly to Supabase. Two flows:

> 🔴 **SUPABASE IS DYNAMICALLY IMPORTED, ON FIRST MOVE OR SWAP (2026-09-21).** `createClient` and
> `authedFetch` are loaded inside the handlers via `await import(...)`, not at module scope. Both
> handlers are already async and already make network round-trips, so it costs them nothing.
>
> **Why:** the marketing homepage renders the real week cards in its phone still (DESIGN-V3 — a
> marketing screen must be the app's screen), and a static import put `@supabase/supabase-js` in
> that page's bundle. Inside the app the chunk is already in flight for other reasons, so this is
> a marketing win and an app no-op. Do not restore the top-level import.
>
> ⚠️ **Supabase was NOT the main cost, and the measurement is the lesson.** Removing it saved
> ~2 kB. The other **135 kB** was `getCurrentWeekIndex` and `parseLocalDate` being imported from
> the `@/lib/plan` BARREL, which also exports `savePlanForUser` and therefore pulls the invariants
> engine, the zod schema, the ops recorder and the charity re-anchor. Those two date helpers now
> come from **`lib/plan/weekResolution.ts`**, a leaf module with no persistence imports; the
> barrel re-exports it so every other call site is unchanged. **Import the leaf, never the
> barrel, from a client component.** Guarded by `lib/marketing/clientBundleBoundary.test.ts`,
> which walks the import graph from every marketing client component and fails on either edge.

**Move** (drop into an empty slot):
```
session_overrides.delete where user_id = userId AND week_n = weekN AND (original_day OR new_day match)
session_overrides.insert { user_id, week_n, original_day, new_day, updated_at }
```

**Swap** (exchange two non-rest sessions):
```
session_overrides.delete where user_id = userId AND week_n = weekN AND original_day IN (sourceOriginal, targetOriginal)
session_overrides.insert ≤2 rows — one per session whose new slot differs from its original day.
  A session "going home" (original_day equals its new slot) gets no override row.
```

Both flows then `POST /api/adjust-plan { fromDay: sourceOriginal, toDay: newSlot }` to trigger the hard/easy adjacency check (paid-only; route 403s for free users).

After writing, calls `onOverrideChange` to update parent state. The parent (`DashboardClient`) is the source of truth for `allOverrides`.

## Known Issues

- `allCompletions` values are typed as `any` — should be `Completion`. Tech debt.
- `TYPE_ACCENT` colour map in `PlanCalendar` is a local duplicate of `session-types.ts`. Violates D-16. Should be removed and replaced with a call to `session-types.ts`. Tech debt.
- Rendered on the marketing homepage's phone still with no-op handlers (`onOverrideChange`, `onSessionTap`) and empty `allOverrides` / `allCompletions`. Move and swap sit behind a tap, so at rest the still shows exactly what a runner sees — no dead affordances on screen. If a future change surfaces a move/swap control *at rest*, that still becomes "a still pretending to be a demo", which the SLT has already cut once from `PhoneFrame`.
