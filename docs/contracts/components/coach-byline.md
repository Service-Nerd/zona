# Contract — CoachByline

**Authority**: This document defines the canonical AI-coach authorship signal's props and the
provenance rule that governs where it may appear. Any change to its props must update this
document in the same commit — `lib/contracts/componentContracts.test.ts` compares the two
prop-for-prop, both directions.

**Component:** `components/shared/CoachByline.tsx`

```typescript
interface CoachBylineProps {
  /** Animated pulse — use while AI is generating. Adds "· thinking" to the role line. */
  working?: boolean
  /** Surface colour variant. 'moss' (default) for --card and --bg-soft;
   *  'warn' for --warn-bg surfaces (CoachNoteBlock, weekly report card). */
  color?: 'moss' | 'warn'
  /** Role line under the name. Defaults to "YOUR COACH". Override for context —
   *  e.g. "MOVED YOUR TEMPO" on a plan adjustment, "THIS WEEK" on the report. */
  role?: string
  /** When provided the byline becomes a button and navigates to Coach.
   *  OMIT on the Coach screen itself — the runner is already there. */
  onClick?: () => void
  /** Tooltip on hover (desktop) and long-press (iOS). */
  title?: string
}
```

## 🔴 The provenance rule is the point of this component, not the styling

It carries the `AIMark` sparkle, so **rendering it is a claim that a model wrote the content
beside it.**

| Allowed | Never |
|---|---|
Run feedback, weekly report, daily coach note, race readiness, phase summary, plan adjust | **Rule-engine output**, race projections, hand-authored copy, Strava data |

⚠️ **This is the rule that forces the duplicate described below.** An empty state's line is
hand-authored, so it must not claim provenance — and this component has no way to render
without the mark.

## Known duplicate, filed not fixed — `COACHBYLINE-EMPTY-VARIANT-01`

`app/dashboard/DashboardClient.tsx` hand-rolls the 22px avatar + name + role as the **empty
state** of this component, dimmed to 0.45 and with **no AIMark**, because of the rule above. The
reasoning is correct and is written above the copy. 🎓 **Sierra, at the sitting that found it
(2026-10-02):** *"the component does not cover its own empty state, so someone copied it — that
is the system's fault, not the author's."* The fix is a dimmed / no-provenance variant **here**,
not a rewrite of the call site.

## Why it replaced a chip, which matters if you are tempted to shrink it

It replaced `AICoachChip`. The 11px pill **read as a category tag, not as authorship** — the
byline gives provenance a face. Shrinking it back toward a pill undoes the only reason it
exists.

⚠️ **The avatar gradient's dark stop was two hardcoded hex values** — the thing ADR-007 forbids
and the pre-commit hook blocks. It is `--moss-strong` / `--warn-strong` now, the existing darker
steps of the same two hues. Do not reintroduce a literal.

## What this contract does not cover

Where each surface places the byline, and the `MICRO_LABELS.eyebrow` role-line treatment, which
`microLabel.test.ts` owns. Nothing here has run on a device.
