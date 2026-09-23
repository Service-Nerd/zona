# Contract — LoadShape

**Authority**: This document defines the prop interface and rendering contract for the Coach
screen's load visualisation. Any change to props must update this document in the same commit.

**Component:** `components/shared/LoadShape.tsx`

---

## Prop Interface

```typescript
type Props = {
  ratio: number | null   // acute:chronic. NULL renders the empty track, never a marker
  color: string          // the verdict colour from loadRatioContext — the single owner
  label?: string         // the accessible description; falls back to a generated sentence
}
```

---

## Why this exists

**A5 (Design Board, app review 2026-09-22) — shape, never score.** Sierra: *"a number that has to
be tapped to mean anything has taught nobody anything."* The bare load ratio is **killed** as a
headline; the verdict is the hero and this shows where the week sits against the runner's own
normal, with the ratio demoted to evidence underneath. **Demoted, not deleted.**

## The contract

| | |
|---|---|
| Band edges | `LOAD_RATIO.under` / `LOAD_RATIO.watch` — **the constants the coaching layer actually flags on.** A band drawn at numbers the engine does not use is a picture of nothing |
| `ratio: null` | Renders the **empty track with no marker**. Never a marker at a default position |
| `color` | Comes from `loadRatioContext`, so the marker and the words above it can never disagree |

⚠️ **`LOAD_RATIO.under` was a bare `0.8` inside a display function** — governing what the runner is
told, and invisible to every config check this repo owns. Naming it was a no-behaviour-delta
refactor.

⚠️ **The Sessions tile deliberately keeps its NUMBER.** `3/5` means something without a tap, which
is exactly Sierra's test; the asymmetry is asserted so nobody "makes them consistent".

## Check

`lib/contracts/componentContracts.test.ts`. ⚠️ **Registering this contract immediately found a dead
prop**: `ariaLabel?: string` was declared in the type, never destructured, never read, and passed
by no caller — so a future override would have been silently ignored. Removed. The gate compares
the **destructure** against the document, which is why it could see what the type alone could not.

## Spacing (APP-SPACE-01, 2026-09-23)

Internal gaps use `var(--space-1…7)` = `4 · 8 · 12 · 16 · 24 · 32 · 48`, swept from hand-typed px on
2026-09-23 when the app was measured at **zero** token uses against the marketing site's 17. Values
shifted by at most 4px. ⚠️ **Horizontal page padding is the SCREEN's, not this component's**, and was
not swept — the shorthand `padding: '0 16px'` is outside the sweep's property list. Gated by
`lib/appSpacingScale.test.ts`.
