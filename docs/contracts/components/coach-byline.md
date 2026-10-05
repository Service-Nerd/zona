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
  /** The byline's own EMPTY state: Kit's identity, NO AIMark badge, dimmed as one
   *  unit. Use where a coach surface has nothing generated yet.
   *  ⚠️ Mutually exclusive with `working` by construction — `empty` wins, so a
   *  caller passing both degrades to the honest state, never to a false claim. */
  empty?: boolean
}
```

## 🔴 The provenance rule is the point of this component, not the styling

It carries the `AIMark` sparkle, so **rendering it is a claim that a model wrote the content
beside it.**

| Allowed | Never |
|---|---|
Run feedback, weekly report, daily coach note, race readiness, phase summary, plan adjust | **Rule-engine output**, race projections, hand-authored copy, Strava data |

⚠️ **This rule CREATED A STATE the component could not express, and that is worth keeping in
mind before adding another rule to it.** An empty line is hand-authored, so it must not claim
provenance — and for a long time there was no way to render this component without the mark.

## ✅ RESOLVED — `COACHBYLINE-EMPTY-VARIANT-01`, shipped 2026-10-05

**`<CoachByline empty />` is the answer.** `app/dashboard/DashboardClient.tsx` used to hand-roll
the 22px avatar + name + role as the empty state — **23 lines**, dimmed to 0.45, with no AIMark,
*because of the rule above*. 🎓 **Sierra, at the sitting that found it (2026-10-02):** *"the
component does not cover its own empty state, so someone copied it — that is the system's fault,
not the author's."* The fix was the variant **here**, exactly as predicted, not a rewrite of the
call site.

| Detail | Why it is not arbitrary |
|---|---|
| **The whole badge is suppressed, not just the glyph** | The white circle anchoring the sparkle *is* the provenance marker. A circle with nothing in it reads as a rendering fault, not an absence |
| **The dim is on the wrapper** | Per child it compounds where they nest, and the avatar and the name end up at different opacities |
| **`empty` beats `working`** | An empty line cannot be being generated |

**Held by `components/shared/coachBylineOwner.test.ts`** — fails if anything outside this
component draws Kit's avatar initial, population derived from git.
⚠️ **`components/marketing/PhoneFrame.tsx` is exempt by name**: its `KitByline` declares itself a
*"copy of CoachByline"*, while `TabbedPhone.tsx` beside it renders the real one. Whether a
marketing still tracks the live component is a 🧭 Design Board question, filed as
**`MKT-KITBYLINE-COPY-01`**. The exemption names its item so it cannot be quietly forgotten.

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
