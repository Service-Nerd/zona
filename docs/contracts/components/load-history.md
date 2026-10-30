# Contract — LoadHistory

**Authority**: This document defines the prop interface and rendering contract for the load tile's history row on
Coach. Any change to props must update this document in the same commit.

**Component:** `components/shared/LoadHistory.tsx` · **Ruled:** Design Board 2026-10-30 (the history row); SLT condition
measured and met the same day; founder approved the mockup (bars, not a line) · **Item:** `RUNKED-LOAD-VIEW-01`

---

## Prop Interface

```typescript
type LoadHistoryProps = {
  history: { km: number; plannedEasy: boolean }[]  // computeLoadPicture(...).history: oldest first, this 7-day window last
  normalKm: number                                  // computeLoadPicture(...).normalKm; the caller renders only with a verdict
  thisWeekColor: string                             // loadRatioContext(...).markerColor, so bar and track agree
  units?: 'km' | 'mi'                               // reader's unit for the accessible label (ADR-015)
}
```

## Rendering contract

- Always `LOAD_HISTORY_WEEKS` (8) slots, filled from the right; fewer than two weeks draws nothing.
- Only this week takes `thisWeekColor`; past weeks `--ink-2` at 0.25. No line, no number per bar, no peak emphasis.
- The normal band spans `normalKm × LOAD_RATIO.under … LOAD_RATIO.watch` (the track's own edges).
- ▲ under a planned lighter week, with a key; `role="img"` label lists every week in the reader's unit.
- Coach hides it with no verdict and in race week. Enforced by `components/shared/loadHistory.markup.test.ts`.
