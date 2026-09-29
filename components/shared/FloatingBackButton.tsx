'use client'

import BackButton from '@/components/shared/BackButton'
import { Z_LAYERS } from '@/lib/ui/zLayers'

/**
 * FloatingBackButton — the back arrow that stays put while the screen scrolls
 * (BACK-ARROW-FLOAT-01).
 *
 * ⚖️ THE BOARD RULED A PINNED BAR AND THE FOUNDER OVERTURNED IT, WHICH IS HIS CALL AND
 * IS RECORDED (`design-rulings.md`). The board's reasoning was Silvanto's: a lone circle
 * has no ground of its own, so over a `--card` surface a `--bg-soft` fill reads as a
 * smudge. The founder wants the arrow hovering, not a strip. Both are defensible; the
 * overturn is logged so a pattern of design losing to preference stays visible rather
 * than accumulating as a feeling.
 *
 * ⚠️ SILVANTO'S CRAFT CONDITION STILL BINDS, and it is the only reason this looks like
 * anything other than the old arrow: the circle carries `--shadow-card` so it survives
 * passing over a card.
 *
 * 🥇 MEASURED, NOT ASSERTED — and the number is why the shadow is not optional. The
 * circle's `--bg-soft` fill against the `--card` white it scrolls over is **1.21:1**, and
 * against the screen's own `--bg` ground **1.07:1**. The fill CANNOT separate the arrow
 * from what passes beneath it at any point on these screens. Remove the shadow and the
 * arrow does not become subtle, it becomes invisible. That is the whole content of the
 * board's objection, and it is the reason the founder's choice works rather than a
 * reason it does not. That is a DOCUMENTED elevation, not a new one — *"Elevation is
 * `--shadow-card` / `--shadow-lifted`. Do not design a new elevation system"* — and "no
 * chrome" forbids STACKED shadows and gradient-on-gradient, not a single elevation.
 *
 * 🔴 WHAT THIS COMPONENT IS ACTUALLY FOR, which is not the hovering.
 * `BackButton` was already the one arrow (UI-BACKARROW-01) — but its PLACEMENT was
 * hand-written at 25 call sites in EIGHT different wrapper shapes:
 *
 *     padding: '16px 16px 0'          padding: '16px 16px 8px'
 *     padding: '16px 20px 0'          padding: '16px 16px 0', flexShrink: 0
 *     display: flex, alignItems, gap  …and three more
 *
 * Floating is a property of the wrapper, so with the wrapper hand-written there was no
 * single place to make this change. Same class as `SectionLabel` and `ACTION-ROW-01`:
 * a pattern that is a local variable cannot travel.
 *
 * ⚠️ THE INSET IS DELIBERATELY EQUAL TO THE STICK POINT. `marginTop` and `top` are both
 * `--space-4`, so the arrow sits in exactly the position it occupied before and does not
 * jump on the first scroll event. A 4px shift the moment a screen moves would be a
 * visible flinch on precisely the screens this is meant to calm — the same reason
 * `.pinned-chrome`'s border starts transparent.
 *
 * ⚠️ `width: 'fit-content'` because a sticky full-width strip would sit over the whole
 * top of the screen and swallow taps meant for the content behind it. The wrapper is the
 * circle's size and nothing more.
 *
 * ⚠️ NOT FOR TILES OR CONFIRM SURFACES. `RecalibrationTile` and `ModifyPlanConfirm` use
 * `BackButton` directly and must keep doing so: they are not pushed screens, they do not
 * own a scroller, and a hovering arrow inside a tile is meaningless. Enforced by
 * `floatingBackButton.test.ts`.
 *
 * 🔴 STICKY RESOLVES AGAINST THE NEAREST ANCESTOR WITH `overflow` OTHER THAN `visible` —
 * EVEN ONE THAT CAN NEVER SCROLL. Four screens in this app once declared `overflow-y:
 * auto` with `min-height: 100%` and no height, and a header pinned to one of them was
 * never sticky at all. `stickyScroller.test.ts` exists for that, and this component
 * inherits the hazard: if a caller's scroller is fake, the arrow silently stops floating
 * and NOTHING goes red. That is the residual risk, and it is named rather than solved.
 */
export default function FloatingBackButton({ onClick, ariaLabel, caption }: {
  onClick: () => void
  ariaLabel?: string
  /** BACK-ARROW-FLOAT-02 — the plan preview's "Adjust inputs". See the note below;
   *  a captioned float is a CHIP, not a circle, and it is shaped differently. */
  caption?: string
}) {
  return (
    <div
      style={{
        position:  'sticky',
        top:       'var(--space-4)',
        zIndex:    Z_LAYERS.screenHeader,
        width:     'fit-content',
        margin:    'var(--space-4) 0 0 var(--space-4)',
        boxShadow: 'var(--shadow-card)',
        // 🔴 A CAPTIONED FLOAT NEEDS A GROUND, AND THIS IS NOT A PREFERENCE.
        // `BackButton`'s captioned form is a GHOST button: only the 44px circle carries
        // `--bg-soft`, and the label span carries NOTHING. Floated as-is, the words
        // "Adjust inputs" would sit directly on whatever scrolls beneath them — bare
        // text over plan content, which is worse than the smudge the shadow was added
        // to prevent. So the wrapper becomes a small card: `--card` ground, pill radius,
        // the same `--shadow-card`. The circle keeps its own
        // `border: 1px solid var(--chrome-edge)`, which is what lets it read on a card
        // rather than melting into it at 1.21:1.
        //
        // ⚠️ This is the system's existing pairing, not a new surface — a circle on a
        // card is what every IconButton in the app already does. The uncaptioned float
        // stays a bare circle precisely because it has no label needing a ground.
        ...(caption
          ? { background: 'var(--card)', borderRadius: '999px', padding: '0 var(--space-4) 0 0' }
          : { borderRadius: '50%' }),
      }}
    >
      <BackButton onClick={onClick} ariaLabel={ariaLabel} caption={caption} />
    </div>
  )
}
