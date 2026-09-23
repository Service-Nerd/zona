# Contract — PlanArc Component

**Authority**: This document defines the prop interface and rendering contract for the plan progression strip. Any change to props or to what the bars encode must update this document in the same commit.

**Component:** `components/shared/PlanArc.tsx`
**Pattern:** `docs/canonical/ui-patterns.md` § 12
**Fixture:** `/plan-arc-preview` (production-gated)

---

## Prop Interface

```typescript
type Props = {
  totalWeeks: number
  currentWeek: number           // 1-indexed
  doneWeeks: number             // weeks before currentWeek counted as done
  weekKm: number[]              // REQUIRED — training km per week, plan order
  weekPhase: (string | null)[]  // REQUIRED — DISPLAY labels, plan order
  raceWeek?: number             // 1-indexed
  reveal?: boolean              // DESIGN-REVEAL-SHAPE-01 — reveal scale + one annotation
}
```

### `reveal` — the plan-arrival scale, and the only surface that annotates

`false` (default) renders at `PLOT` **36px**, which is a Plan-screen height: the arc sits in a
dense scroll among five other blocks. `true` renders at `PLOT_REVEAL` **88px** and adds **one**
annotation on the first dip — *"Week N is easier on purpose."*

Used by **`GeneratePlanScreen`'s plan preview only.** 🔴 Before `DESIGN-REVEAL-SHAPE-01` that
screen imported `PlanHeroMetrics` and **never `PlanArc`**, so at the one moment a plan arrives the
runner met its numbers and never its shape.

⚠️ **One annotation, and the number is measured**: bar pitch is 14.1–22.2px at the 320px content
width, and plans carry 2–5 scattered dips (mean 2.8). ⚠️ **Set in Inter** — the hand is the drawn
rule, not the letterforms; the second-typeface question is deferred, not refused. ⚠️ **Never the
peak** (Wood, binding). The rule is exported as **`firstDipWeek`** so
`lib/marketing/revealShape.test.ts` asserts the producer rather than a copy of it.

### `weekKm` — required, and the bars map over it

Produced by **`lib/plan/weekVolume.ts → planArcSeries(weeks)`**, the single owner both callers use, so the marketing still cannot draw a different shape from the app.

- ⚠️ **It is `trainingKm`, not `weekly_km`.** `weekly_km` includes the race, so a height-encoded race week would draw as the tallest bar of the taper — the rendering defect `weekVolume.ts` was written for.
- ⚠️ **Required, not optional.** With two callers an optional prop is a dead branch, and a silent flat fallback is precisely how this component came to lie about its own name for months.
- ⚠️ **The bars map over `weekKm`, not over `totalWeeks`.** A length mismatch therefore shows, rather than being padded with `?? 0` — which asserts "this week covered no ground" and is the documented wrong answer for a duration-anchored session (SESSION-KM-01).

### `weekPhase` — display labels, not raw keys

Pass `planArcSeries(weeks).phase.map(phaseDisplayLabel)`. `phaseDisplayLabel` (`lib/coaching/weekVoice.ts`) is the single owner of the mapping and handles ADR-013 maintenance keys; the rail renders `text-transform: uppercase`, so a raw key would read `MAINTENANCE_RESTORATION`.

Consecutive weeks sharing a label merge into one rail segment, flexed by week count. **The rail hides entirely when every entry is `null`** — an empty rail with blank labels is worse than no rail.

---

## Rendering contract

| Element | Rule |
|---|---|
| Bar height | `max(6px, km / peak × 36px)`. Floor is absolute, not a percentage. |
| Bar radius | `2px 2px 0 0` — top corners only. |
| Axis | continuous `1px --line` under the ridge. |
| Current week | `2px --moss` tick **below the axis**, not an outline on the bar. |
| Race week | true training height in `--s-race`. No special marker. |
| Deload | **no marking.** Height carries it. |
| Horizontal padding | **none.** The screen owns the 16px margin. |
| Motion | **none.** Nothing for reduced-motion to disable. |
| Tap | **not tappable** (UX-COACH-01, 2026-09-12). Do not re-attach a sheet. |

---

## Binding constraints (SLT 2026-09-21, `docs/decisions/plan-arc-v2.md`)

These are board rulings, not style preferences. `lib/plan/planArc.test.ts` enforces them and has been falsified against each.

1. **Shape, never completion.** No cumulative total, no `%` complete, no peak emphasis. The component was approved on *anticipation*, and that mechanism dies the moment the object becomes a score.
2. **The down-weeks are the message.** Do not smooth, average or de-emphasise the dips.
3. **The rail replaced the phase chain; it did not join it.** The label row states the week count once.

---

## Consumers

| Caller | Notes |
|---|---|
| `PlanScreen` (`app/dashboard/DashboardClient.tsx`) | inset `padding: '0 16px'` |
| `TabbedPhone` (`components/marketing/TabbedPhone.tsx`) | series computed **server-side** in `lib/marketing/demoPlanScreen.ts`; `clientBundleBoundary.test.ts` fails the build if the engine crosses into the marketing client bundle |

---

## Known limits

- A one-week phase inside a long plan gives its rail segment ~15px and the label ellipsises to `P…`. It degrades without breaking. Measuring text to hide the label instead was judged not worth a client-side measurement loop for a rare case.
- Future bars are `--mute-2` at full opacity, ≈2.16:1 on white. They must stay visible — the shape of what is *coming* is the anticipation mechanism. The information is carried by height and position rather than colour alone, so this is not a WCAG 1.4.11 case, but do not dim them further.

## Spacing (APP-SPACE-01, 2026-09-23)

Internal gaps use `var(--space-1…7)` = `4 · 8 · 12 · 16 · 24 · 32 · 48`, swept from hand-typed px on
2026-09-23 when the app was measured at **zero** token uses against the marketing site's 17. Values
shifted by at most 4px. ⚠️ **Horizontal page padding is the SCREEN's, not this component's**, and was
not swept — the shorthand `padding: '0 16px'` is outside the sweep's property list. Gated by
`lib/appSpacingScale.test.ts`.
