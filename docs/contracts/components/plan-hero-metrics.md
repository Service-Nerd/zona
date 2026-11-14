# Contract — PlanHeroMetrics Component

**Authority**: This document defines the prop interface and rendering contract for the plan preview's three-up metric
row. Any change to props or to what the figures mean must update this document in the same commit.

**Component:** `components/shared/PlanHeroMetrics.tsx`
**Pattern:** `docs/canonical/ui-patterns.md` §37d

---

## Prop Interface

```typescript
type Props = {
  plan: Plan
  units: 'km' | 'mi'
  canReshape: boolean   // dynamic_reshape_r20: false for free, true for trial and paid; gates the adaptation line
}
```

## Rendering contract

- **A race plan:** `plan.weeks.length` weeks, the biggest week, and the total, from `plan.weeks` at render.
- **A staged plan** (`stagedRaceOf(plan)`, Design Board 2026-10-25, S2): the **weeks to the race**
  (`stagedDisplay(plan).totalWeeks`, the same denominator `PlanArc` shows), the **checkpoint target**
  (`staged.door_km`, labelled *"a week by the checkpoint"*) and the **checkpoint date** (labelled *"checkpoint"*).
  Never the built weeks' "in total": on a marathon that read *"33 km in total"* above *"Wk 1 of 26"*. Labels from
  `lib/plan/checkpointCopy.ts`, founder-approved 2026-10-25.
- The adaptation line renders only when `canReshape`, and is the `/pricing` row's own sentence.

## Callers

`GeneratePlanScreen` (the plan preview) and the local harness `/staged-preview` (404 in production).
Tested by `components/shared/planHeroMetrics.test.ts` and `components/shared/stagedRaceScreens.markup.test.ts`.

## The total is withheld, never estimated (`HERO-WALKRUN-TOTAL-01`, 2026-11-14)

The generic branch prints **two** metrics, not three, when any week has no stated distance:
`weeksWithoutStatedDistance(plan) > 0` suppresses *"in total"*.

⚠️ **Keyed on the ABSENCE OF A DISTANCE, not on a plan kind.** The 2026-10-25 (S2) ruling behind
this keyed on `stagedRaceOf(plan)`, so a §118 walk-run plan — no `staged_race` — fell straight
through to the hero that ruling existed to prevent. A §116 walk-run week carries no `weekly_km`
by doctrine (time on feet; a distance would be invented), and `weekly_km ?? 0` summed past it.

Gate: `lib/ui/screenStatesTruth.test.ts`, which fails if the suppression is re-keyed on a plan kind.
