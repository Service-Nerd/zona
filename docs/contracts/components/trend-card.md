# `TrendCard` — contract

**Component:** `components/shared/TrendCard.tsx`

Two-metric aerobic-trend card: how the runner's average HR on same-effort long runs has moved
across a multi-month window. **TIER-DIVERGENT.** 4 importers.

⚠️ **Written 2026-11-15 (`CONTRACT-COVERAGE-03`, highest reach first).**

## Prop interface

```typescript
interface TrendCardProps {
  state: 'live' | 'pending' | 'steady' | 'locked' | 'skeleton'
  label?: string
  sessionLabel?: string
  onUpgrade?: () => void
  earlierMonth?: string
  earlierHr?: number
  nowHr?: number
  cohortSize?: number
  windowMonths?: number
  gloss?: string
  glossless?: boolean
  moment?: string
  earlierPace?: number | null
  nowPace?: number | null
  preferredUnits?: 'km' | 'mi'
  series?: SparkBucket[]
  progress?: { runs: number; needRuns: number }
  sinceMonth?: string
  noiseFloorBpm?: number
}
```

🔴 **THE REAL TYPE IS A FIVE-MEMBER DISCRIMINATED UNION, AND THE BLOCK ABOVE IS ITS FLATTENED
PROP SET — read the states table below for what is actually required.** `export type
TrendCardProps = TrendCardLive | TrendCardPending | TrendCardSteady | TrendCardLocked |
TrendCardSkeleton`, four of which extend `TrendCardLabels`. A flat `interface` cannot express a
union whose required props differ per `state`; it is written this way because the prop-parity
gate compares NAME SETS, and the union of the members is exactly what a caller may legally pass.
Every `?` above is therefore *"optional in the union"*, **not** *"optional in its own state"*.

⚠️ **`zone-rings.md` faced the same problem and took the other route** — a `**Components:**`
contract, which the gate exempts from prop parity. That was right there (it governs two real
exports) and would be wrong here: `TrendCard.tsx` has one component, and using the list form to
skip the check would be gaming the gate rather than documenting the component.

🔴 **WRITING THIS CONTRACT WIDENED THE GATE'S PARSER FOR THE FOURTH TIME**, which
`componentProps`'s own comment predicted in as many words (*"a parser widened by hand three
times is a parser with a fourth shape in it"*). It could read `interface Props`, a
`<Name>Props` interface, a destructured default export, a propless one, a named export and a
generic — but not a **non-destructured default export over a union type**, so it returned `null`
and this contract could not exist without turning the gate red. 📐 Measured: `components/` holds
**exactly one** union prop type and it is this one.

## States

| `state` | Required beyond `state` | What renders |
|---|---|---|
| `live` | `earlierMonth`, `earlierHr`, `nowHr`, `cohortSize`, `windowMonths` | the two metrics, the sparkline when `series` has ≥ 3 usable months, and the model gloss |
| `pending` | — (`progress` optional) | dashes, plus how close the series is when `progress` is supplied |
| `steady` | `earlierHr`, `nowHr`, `sinceMonth`, `cohortSize`, `noiseFloorBpm` | the numbers with the word *"steady"*: no colour, no up/down word |
| `locked` | — (`onUpgrade` optional) | FREE: hand-authored body copy and the upgrade CTA |
| `skeleton` | — | shimmer; `onUpgrade?: never` |

`onUpgrade` is declared `never` on `live`, `pending`, `steady` and `skeleton` — the union makes
an upgrade handler on a paid state a type error rather than a convention.

## Invariants

1. 🔴 **BOTH `useCountUp` CALLS ARE HOISTED ABOVE EVERY EARLY RETURN, AND MOVING THEM IS REACT
   ERROR 310.** `useCountUp` contains five hooks, so with the calls below the skeleton / locked /
   pending returns this component rendered **1 hook in `skeleton` and 11 in `live`**. On Coach it
   mounts as `skeleton` and flips to `live` when the fetch lands, so that transition took down
   the whole screen through the error boundary — deterministically, for any runner with enough
   history for the trend to return, and invisibly for everyone without it (`HOOKS-ORDER-01`).
   The live fields are read through a narrowed `live` local, never asserted.
2. 🧭 **THE COUNT-UP HONOURS `prefers-reduced-motion`** (`A11Y-REDUCED-MOTION-01`): the number is
   set to its target and `done` flips immediately, so the gloss that fades in *"after count-up
   completes"* still arrives instead of waiting on a loop that never runs. ⚠️ **This is the
   house shape, not an invention** — `globals.css`'s own reduced-motion block describes the JS
   half as *"the loop never starts and the value is set immediately"*.
3. ⚠️ **`TrendCard` IS EXEMPT FROM `lib/ui/rafRelease.ts` BY NAME, and the reason is the
   distinction that module exists to draw.** A recursive rAF driving a count-up is a **loop**,
   not a one-shot **release**: a loop that has not started is a value that has not moved, and it
   resumes correctly on visibility. `rafRelease` is for a rAF that frees a state the runner can
   otherwise see stuck (`SHEET-RAF-FALLBACK-01`).
4. 🔴 **THE COHORT MATCHES ON DISTANCE, NOT ON PACE, SO THE CARD CANNOT KNOW THE COMPARISON IS
   FAIR WITHOUT `earlierPace`/`nowPace`** (`TREND-PACE-CLAIM-01`). When both are present and
   differ by at least `TREND_PACE_CONFOUND_SEC_PER_KM`, the qualifier says so. The verdict comes
   from one owner, `paceContext`, and `'unknown'` is a real answer rather than a silent omission.
5. **AIMark sits on the model content only**, via `CoachByline` below the metric pair — never on
   the metrics, which are formula-derived. `glossless` (CO-ONE) hides the gloss section entirely
   so Coach reads the trend as raw evidence with no second coach voice at the top of the screen.
6. **`preferredUnits` is a prop, not a hook.** Settings are fetched once at `DashboardClient`
   level and passed down (CLAUDE.md § Global State Pattern).
7. **No hardcoded colour.** Every surface and text colour is a token.

## Pattern

`ui-patterns.md` §29 — TrendCard. Two-metric variant of RestraintCard (Pattern 11).
Rulings: `HOOKS-ORDER-01`, `TREND-PACE-CLAIM-01`, `A11Y-REDUCED-MOTION-01`, `COACH-TREND-PENDING-01`.
