# `AIMark` — contract

**Component:** `components/shared/AIMark.tsx`

The AI-provenance glyph: sparkle plus accent dot. **7 importers.**

⚠️ **Written 2026-11-08 (`CONTRACT-COVERAGE-03`, highest-reach first).**

## Prop interface

```typescript
interface AIMarkProps {
  size?: number
  color?: string
  working?: boolean
  label?: string
}
```

## Invariants

1. 🔴 **IT MARKS ACTUAL MODEL OUTPUT AND NOTHING ELSE.** `CLAUDE.md` § UI Principles: *"Apply
   only to actual model output; never to rule-engine, hand-authored copy, or Strava data."*
   A glyph on rule-engine output is a false claim about where a number came from — and this app
   degrades silently to rule-engine copy by design (ADR-006), so the mark is the only thing that
   tells a runner which they are reading. **The reframe risk gate renders an amber rail with NO
   AIMark for exactly this reason.**
2. **`working` replaces a spinner, it does not accompany one.** The pulse
   (`ai-mark-pulse 1.6s ease-in-out infinite`) *is* the in-flight state; `ui-patterns.md` §
   AIMark and `CLAUDE.md` both bar spinners.
3. **The accessible name flips with `working`** — "AI generating" while in flight, "AI
   generated" at rest, and `label` overrides both. `role="img"` plus `aria-label` is always
   present, so the glyph is never an unnamed image.
4. ⚠️ **`color` is typed `string` and documented as "token or hex", which is the one loose edge
   here.** Every call site passes a token (`var(--moss)` default, `var(--warn)` on coach-amber
   surfaces). A hex would pass the type and **would pass `npm run sweep:colours` too**, because
   the guard reads component source and this value arrives as a prop. The defence is the
   default plus review, not a mechanical check — stated rather than implied.
5. **12px default, for inline eyebrow contexts**, with the viewBox scaled to 14 to give the
   accent dot room top-right.

## Gates

`lib/contracts/componentContracts.test.ts` · `npm run sweep:colours` (the component's own
colours; ⚠️ not the `color` prop, by invariant 4).
