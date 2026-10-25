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
