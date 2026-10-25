# Contract — StagedRaceBlockCard Component

**Authority**: This document defines the prop interface and rendering contract for the card that stands in for a staged
plan's race block before it is built. Any change to props or to what it renders must update this document in the same
commit.

**Component:** `components/shared/StagedRaceBlockCard.tsx`
**Pattern:** `docs/canonical/ui-patterns.md` § Staged race plan (Design Board 2026-10-24, amendment 3)
**Item:** NO-RUNNER-TURNED-AWAY-01, Phase C-1

---

## Prop Interface

```typescript
type Props = {
  title: string   // raceBlockTitle(staged): "Marathon training"
  line: string    // raceBlockLine(raceBlockStart): "from 23 Nov. Built after your checkpoint."
}
```

Both strings come from `lib/plan/checkpointCopy.ts`, the single owner of the staged plan's words (founder-approved
2026-10-24). The card assembles no copy of its own.

## Rendering contract

- `PhaseSummaryCard` anatomy: card surface, `--line` border, a **3px dashed `--line-strong` left rail** (never a session
  colour: the weeks are not built, so they have no session type), title 15px/700 `--ink`, line 14px `--ink-2`.
- **No metrics**: no peak, no weeks count, no kilometres, no meter or progress element (Design Board amendment 5,
  Sierra). Asserted by `components/shared/stagedRaceScreens.markup.test.ts`.
- `data-staged-race-block` marks it for tests.

## Callers

The wizard preview (`GeneratePlanScreen`) and the Plan screen (`DashboardClient`'s `PlanScreen`), both only when
`stagedDisplay(plan)` is non-null. One component so the two screens cannot describe the same weeks differently.

## Day one (E0a, built 2026-10-25)

Callers pass `raceBlockLineFor(staged, start)`, never `raceBlockLine` directly: a plan whose target was not found reads
*"from 23 Nov, if your checkpoint allows."* (founder-approved). A gate in `walkRunStart.test.ts` fails if any file under
`app/`, `components/` or `lib/ui/` calls `raceBlockLine(` itself.
