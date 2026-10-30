# Contract — EasyShareHeader, EasyShareBars

**Authority**: This document defines the prop interface and rendering contract for the Coach zone rings' headline and
weekly record. Any change to props must update this document in the same commit.

**Component:** `components/shared/EasyShare.tsx` · **Ruled:** Design Board (Coach review, Pattern 32 amended) and
Coaching Board §130, 2026-10-30 · **Item:** `COACH-DISCIPLINE-HEADLINE-01`

---

## Prop Interface

```typescript
EasyShareHeader: {
  share: number   // easyShare(split): round(z1 + z2) of this week's distance-weighted zone split
  runs: number    // runs carrying a split this week; the caller renders this only when ≥ COACH_EASY_SHARE_MIN_RUNS
}
EasyShareBars: {
  weeks: (number | null)[]   // weeklyEasyShares(...): oldest first, this week last; null = too few runs that week
}
export const EASY_SHARE_BARS = 8
```

---

## Rendering contract

| | |
|---|---|
| **Headline** | `{share}%` at 56/800 in `--ink`, "easy" 17/600 `--moss-strong`, "of this week's running sat in Zones 1–2." Body 14. **Described, never graded** (§130): no colour verdict, no target, no good/bad word |
| **Heading** | The header owns "This week in zones" and "across N runs"; the rings beneath render `headless` so it is said once |
| **Bars** | Always `EASY_SHARE_BARS` slots, filled from the right. `null` is an empty slot, never a zero-height value. This week solid `--moss`, past weeks at 0.35 opacity. No line, no number per bar, no peak emphasis. Fewer than two weeks renders nothing |
| **Accessibility** | The bar row is `role="img"` with every week read out, including "not enough runs" |
| **Data** | Same rows, dedupe and weighting as the rings (`weekZoneSplitRows` / `weeklyEasyShares` in `lib/coaching/weeklyZoneAggregate.ts`) |

**Held by:** `components/shared/easyShare.markup.test.ts`.
