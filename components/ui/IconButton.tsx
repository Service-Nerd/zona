import type { CSSProperties, ReactNode, ButtonHTMLAttributes } from 'react'

/**
 * IconButton — THE SINGLE OWNER of a control whose whole label is a glyph.
 *
 * 🔴 WHY THIS EXISTS, and the finding is a NAMING ERROR rather than a missing
 * component (ICON-BUTTON-01, Design Board 2026-09-25).
 *
 * `BackButton` already WAS this primitive: 44px, circle, `--bg-soft`, a
 * required label, with its own contract. But it carried the name of ONE of its
 * uses, so everything else needing the same shape could not reuse it —
 * reusing it would have meant calling a close button a back button. Thirteen
 * controls were hand-rolled instead, and `ModifyPlanSheet`'s close is
 * `44 / 44 / 50% / --bg-soft`: byte-for-byte `BackButton`'s documented spec,
 * written out again. Collins: *"a taxonomy error at the naming layer produced
 * 13 hand-rolled controls."* Same shape as `.cta-pill` earlier the same day —
 * the right thing existed and was mis-scoped.
 *
 * 🔴 AND 7 OF THE 14 HAD NO ACCESSIBLE NAME. Measured: one truly silent (an
 * SVG with nothing to announce) and six announcing a bare glyph — on the
 * distance stepper a screen-reader user hears *"minus, plus, minus, plus"*
 * with nothing to say which number each one moves.
 *
 * ⚠️ `ariaLabel` IS REQUIRED, NOT OPTIONAL, AND THAT IS THE ENFORCEMENT.
 * An icon button that cannot be named cannot be constructed — the compiler
 * stops the next one, not a reviewer. This repo's own record is that a rule
 * which holds only while someone remembers is not a rule, and `:860` says this
 * exact rule was already standing and already ignored by half its instances.
 *
 * ⚠️ `BackButton` IS NOW A WRAPPER, NOT A RIVAL. It passes the chevron and
 * defaults the label to "Back"; its contract stays valid. Do not reintroduce a
 * second 44px circle.
 *
 * Styling lives in `globals.css` under `.icon-btn` — pseudo states cannot be
 * expressed inline, and this matches the split ruled the same day: the site
 * uses the classes, the app uses the component, one definition.
 */

export type IconButtonShape = 'circle' | 'square' | 'bare'

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'children'> {
  /** The glyph or SVG. Decorative by definition — mark it `aria-hidden`. */
  icon: ReactNode
  /**
   * 🔴 REQUIRED. What the control DOES, in the words a runner would use:
   * "Close", "Dismiss", "Increase distance". Never the glyph's name, and never
   * a description of the icon.
   */
  ariaLabel: string
  /** `circle` for a back/close on a surface · `square` inside a bordered group
   *  · `bare` for a glyph in a dense row. Default `bare`. */
  shape?: IconButtonShape
  /**
   * ⚠️ THE INLINE-MARK EXCEPTION, and the only sanctioned way to be under 44px
   * visually. `SessionSteps`' 15px ringed "i" sits inside a 12px uppercase
   * label; at 44px it stops being an inline mark and shoves the type around.
   * The GLYPH stays small and the HIT AREA is grown with padding plus a
   * compensating negative margin, so the runner sees 15px and taps 44.
   * Anything else owes the full 44px.
   */
  inlineMark?: boolean
  /** LAYOUT ONLY — margin, flex, alignSelf. Never a route to a different look. */
  style?: CSSProperties
}

export default function IconButton({
  icon,
  ariaLabel,
  shape = 'bare',
  inlineMark = false,
  className,
  ...rest
}: IconButtonProps) {
  const classes = [
    'icon-btn',
    `icon-btn--${shape}`,
    inlineMark ? 'icon-btn--inline-mark' : 'icon-btn--regular',
    className ?? '',
  ].filter(Boolean).join(' ')

  return (
    <button {...rest} type={rest.type ?? 'button'} className={classes} aria-label={ariaLabel}>
      {icon}
    </button>
  )
}
