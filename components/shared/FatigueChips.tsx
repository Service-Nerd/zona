'use client'

// FatigueChips — the ONE Fresh / Fine / Heavy / Wrecked row.
//
// 🔴 WHY IT EXISTS (FATIGUE-CHIP-DUPLICATE-01, Design Board 2026-11-16). The item said the row
// *"exists twice"* and that *"both render identically today"*. Re-measured: **six surfaces, four
// different colour scales**, and the divergence was visible, not theoretical.
//
//   A  DashboardClient              moss / s-easy / warn / DANGER
//   B  SessionPopupInner:752        s-recov / moss / warn / s-inter   · ManualRunModal the same
//   C  SessionPopupInner:1585       moss / MOSS / warn / DANGER
//   D  SessionCompleteCard + its OG s-recov / s-easy / warn / s-inter
//
// 📐 **D is the only scale that satisfies every rule already written**, and the numbers decided it
// rather than taste:
//   · `--danger` is forbidden in the training UI (*"amber for warnings, coral for high intensity;
//     `--danger` for form/error states only"*), which rules out A and C.
//   · A four-step scale needs four steps. Measured as CIE Lab ΔE76 between adjacent steps, the
//     smallest step is **A 43.2 · B 9.8 · C 0.0 · D 30.4**. **C renders Fresh and Fine in the
//     SAME colour** and B's first two steps are two greens under the ~10 at which a hue reads as a
//     shade of its neighbour — which is Silvanto's own *"a scale rendered in one colour is a
//     list"*, the ruling that refused `Chip` a colour axis on 2026-10-05.
//   · All four scales pass AA on the active label (4.75–9.96 on the 12% tint), so legibility did
//     not decide it. That is worth stating: the defect was never contrast.
//
// ⚠️ AND `fatigueChipColour`'s COMMENT CLAIMED TO BE CANONICAL WHILE BEING ONE OF THE FOUR.
// It read *"Mirrors the chip palette in SessionPopupInner reflect view — kept canonical so the chip
// reads the same across surfaces."* That view has `Fine → --moss`; it has `Fine → --s-easy`. The
// comment is true now because everything reads `FATIGUE_HUE`.
//
// ⚠️ **The hue is the CONTENT here, which is why this is not a `Chip`.** The board refused to give
// `Chip` a colour axis (2026-10-05, unanimous, and explicitly NOT by veto): `Chip` is a selection
// chip and selection is binary. Do not convert this.
//
// ui-patterns.md § FatigueChips. Scale owner: `FATIGUE_HUE` below.

import { MICRO_LABELS } from '@/components/shared/microLabels'
import { TAP_TARGET_MIN_PX } from '@/components/ui/tapTarget'
import { hueText } from '@/lib/ui/hueText'
import { FATIGUE_TAGS, type FatigueTag } from '@/lib/coaching/completionVocab'

/**
 * The fatigue scale's hue, and the single owner of it.
 *
 * ⚠️ **Both greens are session hues and that is a deliberate, named cost.** `--s-recov` and
 * `--s-easy` also carry meanings in the session colour map. The board has already ruled the palette
 * spent (*"six session hues and four phase hues are already spent"*, `PHASE-ON-TODAY-01`), so a
 * fifth distinct fatigue hue is not available; borrowing is the trade and it is recorded rather
 * than discovered. The two surfaces live in different contexts (a session rail vs a reflect row).
 *
 * ⚠️ Changing a value here changes the shareable complete-card image too. `lib/ui/fatigueScale.test.ts`
 * holds the OG route's resolved hex against these tokens, because that mirror is how the scale
 * drifted in the first place.
 */
export const FATIGUE_HUE: Record<FatigueTag, string> = {
  Fresh:   'var(--s-recov)',
  Fine:    'var(--s-easy)',
  Heavy:   'var(--warn)',
  Wrecked: 'var(--s-inter)',
}

export default function FatigueChips({
  value,
  onChange,
  disabled = false,
  label = 'Body state',
}: {
  /**
   * ⚠️ `string | null`, NOT `FatigueTag | null`, and the looseness is deliberate. Every caller holds
   * `useState<string | null>` because the value is READ BACK FROM THE DATABASE, where a legacy
   * `'Cooked'` exists (`LEGACY_FATIGUE_TAGS`) — which is why `isFatigueTag` is a guard rather than a
   * cast. A narrower prop forced `value={x as FatigueTag | null}` at all three call sites: an
   * assertion the compiler cannot check, about data that genuinely can fail it. Nothing here needs
   * the value to BE a tag; it only compares.
   */
  value: string | null
  /** `null` when the runner taps the active tag again — the row is clearable. */
  onChange: (next: FatigueTag | null) => void   // what it EMITS is always a real tag
  disabled?: boolean
  /**
   * ⚠️ The caption is the control's, as `RPEScale` beside it already owns *"Effort (RPE)"*.
   * Three sites said **Body state** and one said **Body feeling**; the majority spelling is the
   * default and the odd one adopts it. A different word here is a voice decision, not a layout one.
   */
  label?: string
}) {
  return (
    <div>
      <div style={{ ...MICRO_LABELS.eyebrow, fontFamily: 'var(--font-ui)', color: 'var(--mute)', marginBottom: 'var(--space-3)' }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        {FATIGUE_TAGS.map(tag => {
          const isActive = value === tag
          const hue = FATIGUE_HUE[tag]
          return (
            <button
              key={tag}
              type="button"
              aria-pressed={isActive}
              disabled={disabled}
              onClick={() => onChange(isActive ? null : tag)}
              style={{
                // The four sites had four geometries. Canonical: the 12% tint the board measured
                // (one site had drifted to 9%), a 1px `--line` hairline (two had 0.5px on the
                // legacy `--border-col`), `--mute` off-text (two had the legacy `--text-muted`),
                // and weight 500 active (one had 600, which is heavy at 12px).
                minHeight: TAP_TARGET_MIN_PX, display: 'inline-flex', alignItems: 'center',
                fontFamily: 'var(--font-ui)', fontSize: '12px',
                // 📐 16px, NOT the 18px two sites used, and the number is measured. The four pills
                // need **294.3px** and the gaps 24px; at 18px that is **318.3px** against a
                // **311px** container at 375pt, so the row wrapped **three and one** — the orphan
                // `DayGridSelector` was explicitly fixed for (*"an orphan reads as a mistake"*).
                // 16px needs **302.3px** and fits with 8.7px to spare; 17px leaves 0.7px, which is
                // not a margin. **A four-step scale wants one line: the progression IS the
                // information.** `flexWrap` stays, so a narrower container degrades rather than
                // clips. `ManualRunModal` already used 16px, so this is its value, measured.
                padding: '8px 16px',
                borderRadius: '20px',
                border: `1px solid ${isActive ? hue : 'var(--line)'}`,
                background: isActive ? `color-mix(in srgb, ${hue} 12%, transparent)` : 'transparent',
                // 6t-h — the hue never appears as raw small text; `hueText` is the one owner.
                color: isActive ? hueText(hue) : 'var(--mute)',
                cursor: disabled ? 'default' : 'pointer',
                fontWeight: isActive ? 500 : 400,
                transition: 'all 0.12s',
              }}
            >
              {tag}
            </button>
          )
        })}
      </div>
    </div>
  )
}
