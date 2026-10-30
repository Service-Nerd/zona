# Contract — EarnedLine

**Authority**: This document defines the prop interface and rendering contract for the earned sentence on Coach. Any
change to props must update this document in the same commit.

**Component:** `components/shared/EarnedLine.tsx` · **Ruled:** Design Board 2026-10-30 (placement, SHIP WITH AMENDMENT)
and Coaching Board §131 · **Item:** `COACH-SEEN-MOMENTS-01`

---

## Prop Interface

```typescript
type EarnedLineProps = {
  text: string   // the earned sentence, built by lib/coaching/moments.ts; the caller renders this only in the week it is earned
}
```

## Rendering contract

- Ink sentence, Body 15/600 (6t-g: a hue is never small text); one `EARNED_DOT_PX` (6) `--moss` dot, `aria-hidden`.
- No motion, no AIMark (rule-based copy).
- Draws nothing conditional itself: whether it is earned is decided by the caller from `easiestWeekSpan` /
  `easyCostMoment`. Callers: `EasyShareHeader` (`easiestSpan`) and the live `TrendCard` (`moment`).
- Enforced by `components/shared/earnedLine.markup.test.ts`.
