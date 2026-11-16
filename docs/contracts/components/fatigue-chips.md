# `FatigueChips` — contract

**Component:** `components/shared/FatigueChips.tsx`

The single owner of *"how did that feel?"* — the Fresh / Fine / Heavy / Wrecked row, and of
`FATIGUE_HUE`, the scale it is painted in. **4 importers** (`DashboardClient`,
`SessionPopupInner` ×2, `ManualRunModal`, plus `SessionCompleteCard` for the scale alone).

⚠️ **Written 2026-11-16 with the component (`FATIGUE-CHIP-DUPLICATE-01`, Design Board).**

## Prop interface

```typescript
interface FatigueChipsProps {
  value: string | null
  onChange: (next: FatigueTag | null) => void
  disabled?: boolean
  label?: string
}
```

⚠️ Declared inline on the component; the name above is the contract's, for the prop-for-prop gate.

⚠️ **`value` is `string | null` and `onChange` emits `FatigueTag | null`, and the asymmetry is
deliberate.** Every caller holds `useState<string | null>` because the value is read back from
`session_completions`, where a legacy `'Cooked'` exists (`LEGACY_FATIGUE_TAGS`) — which is why
`isFatigueTag` is a **guard** and not a cast. A narrower prop forced `value={x as FatigueTag | null}`
at all three call sites: an assertion the compiler cannot check, about data that genuinely can fail
it. Nothing here needs the value to **be** a tag; it only compares. What the control **emits** is
always a real tag, or `null` when the runner clears it by tapping the active one again.

`label` defaults to **"Body state"**. The control owns its caption, as `RPEScale` beside it owns
*"Effort (RPE)"*.

## Invariants

1. 🔴 **IT EXISTS BECAUSE FOUR SURFACES DISAGREED ABOUT WHAT THE SCALE WAS.** The item that filed
   it said the row *"exists twice"* and that *"both render identically today"*. Measured: **six
   surfaces, four scales** — one rendering **Fresh and Fine in the same token**, two painting
   Wrecked in `--danger`, the error red the design system forbids in the training UI.
2. 🔴 **`FATIGUE_HUE` IS THE SCALE AND MUST STAY A SCALE.** Fresh `--s-recov` · Fine `--s-easy` ·
   Heavy `--warn` · Wrecked `--s-inter`. Two rules bind it, each with its number: **never
   `--danger`**, and **every adjacent step perceptibly distinct** — measured as CIE Lab ΔE76, the
   four live scales scored a smallest step of **43.2 / 9.8 / 0.0 / 30.4**. ✋ *"A scale rendered in
   one colour is a list."*
3. ⚠️ **ALL FOUR OF THE OLD SCALES PASSED AA** (4.75–9.96 on the 12% tint), so **the defect was
   never contrast**. Stated here because "fix the colours" invites the contrast checker, and the
   contrast checker would have cleared every one of them.
4. ⛔ **NOT A `Chip`, AND THIS MAY NOT BE RE-PROPOSED.** The Design Board refused `Chip` a colour
   axis on 2026-10-05, unanimously and explicitly **not** by veto: `Chip` is a selection chip and
   selection is binary, while here **the hue is the content**.
5. 📱 **ONE LINE AT 375pt.** The four pills need **294.3px** plus 24px of gaps; at the 18px side
   padding two of the old sites used that is **318.3px against a 311px container**, which wrapped
   **three and one** — the orphan `DayGridSelector` was explicitly fixed for. 16px needs
   **302.3px** and fits with 8.7px spare; 17px leaves 0.7px, which is not a margin. `flexWrap`
   stays, so a narrower container degrades rather than clips.
6. ⚠️ **THE HUE NEVER APPEARS AS RAW SMALL TEXT.** The active label is `hueText(hue)` (6t-h), which
   resolves a ratified `-strong` shade where one exists and `--ink-2` otherwise. Do not inline a
   text colour here.
7. 🔴 **THE OG MIRROR IS CHECKED, NOT TRUSTED.** `app/api/og/session-complete-card/route.tsx` must
   hold the scale as resolved hex, because `next/og` cannot read CSS variables. Being a hand-kept
   mirror **under a comment claiming it was canonical** is exactly how the scale reached four
   versions: `fatigueChipColour` said it *"mirrors the chip palette in SessionPopupInner"* while
   disagreeing with that view on `Fine`. `lib/ui/fatigueScale.test.ts` resolves each token out of
   `globals.css` and fails if the route's hex disagrees.

## States

| State | Treatment |
|---|---|
| **Off** | 1px `--line` border, transparent fill, `--mute` text, weight 400 |
| **Active** | 1px hue border, `color-mix(in srgb, <hue> 12%, transparent)` fill, `hueText(hue)` text, weight 500 |
| **Cleared** | Tapping the active tag emits `null`; the row has no "none" chip |
| **Disabled** | `disabled` blocks the tap and sets `cursor: default`. **No visual dim**, which is the behaviour the one caller that uses it (`DashboardClient`, while `savingRPE`) already had; a dim treatment is a board question nobody has asked |

Every pill is `minHeight: TAP_TARGET_MIN_PX` (44), floored by `TAP-TARGET-DECISIONS-01`.

## Gate

`lib/ui/fatigueScale.test.ts` — 8 arms, 8 mutations falsified, **including each of the three broken
scales that were live**, each caught by the arm that names its defect.

Pattern: `ui-patterns.md` § FatigueChips. Ruling: `design-rulings.md` 2026-11-16.
