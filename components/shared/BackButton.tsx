import type { CSSProperties } from 'react'
import IconButton from '@/components/ui/IconButton'

/**
 * BackButton — the one back arrow (UI-BACKARROW-01).
 *
 * THE PROBLEM THIS EXISTS FOR. `ui-patterns.md` § Screen Templates has said
 * for months: *"Full screen, back arrow top-left (44px circle, `--bg-soft`
 * bg)."* A census of every `onClick={onBack}` chevron across the screen files
 * found **6 of 13 obeying it**. The rest were two 36px circles/squares (below
 * our own documented 44px iOS HIG minimum, which `ui-patterns.md` § What Not
 * to Build states in those words), two 8px squares on `--accent-soft`, one on
 * `--moss-soft` — moss-adjacent, on a control that is not a CTA — and two with
 * no container at all.
 *
 * ⚠️ THIS IS NOT `ScreenHeader`. That is title + subtitle with **no back
 * arrow**, for tab roots. Conflating the two was a retracted finding in the
 * review that produced this item, and the mistake is easy to repeat because
 * both live at the top-left of a screen.
 *
 * ⚠️ THE GLYPH IS 20px, NOT 18px. Four of the six conforming arrows drew an
 * 18px chevron and two drew 20px. A single owner has to pick one, and the
 * backlog item names `FounderNoteScreen` as the version to extract — it is the
 * one that got a frontend-design brief. So four screens gain a 2px glyph. That
 * is a real visual delta on arrows that were already legal, and it is the
 * price of there being one answer.
 *
 * ⚠️ AS OF 2026-09-25 THIS IS A WRAPPER, NOT A RIVAL (ICON-BUTTON-01). The
 * finding was that this component already WAS the general primitive and was
 * carrying the name of one of its uses, so 13 other controls that needed the
 * same 44px circle could not reuse it and were hand-rolled. `IconButton` is
 * that primitive; this passes the chevron and defaults the label to "Back".
 * The spec below is unchanged and its contract stays valid.
 *
 * `style` is merged, not replaced, and exists for the LAYOUT the call site
 * owns (`marginBottom`, a negative `marginLeft` inside a tile). It is
 * deliberately not a route to a different appearance: the container, size and
 * colour are this component's.
 *
 * ⚠️ `caption` (BACKARROW-WIZARD-01, 2026-09-27) exists because the wizard's
 * hand-rolled copy had one — a back arrow reading "Adjust inputs" on the plan
 * preview, where "back" alone is ambiguous between the previous STEP and the
 * inputs. Deleting it to conform would have been a design change smuggled in as
 * a conformance fix, so it is supported here instead.
 *
 * 🔴 THE CAPTION IS NOT A SECOND TAP TARGET, and that is a real change from the
 * copy it replaces. The wizard wrapped arrow AND text in one `<Button>`, so the
 * whole ~150px row was tappable; here the 44px circle is the control and the
 * text is `aria-hidden` beside it. A `<div onClick>` around both would restore
 * the area and is refused: LINK-HIERARCHY-01 ruled exactly that shape a defect
 * ("no role, no tabIndex, no focus ring"). The accessible name carries the
 * meaning instead — pass `ariaLabel` when the caption says more than "Back".
 * The labelled-header question proper belongs to `BACK-HEADER-OWNER-01`.
 */
export default function BackButton({
  onClick,
  ariaLabel = 'Back',
  caption,
  style,
}: {
  onClick: () => void
  ariaLabel?: string
  /** Optional text beside the arrow. A LABEL, not a target — see above. */
  caption?: string
  style?: CSSProperties
}) {
  const button = (
    <IconButton
      onClick={onClick}
      ariaLabel={ariaLabel}
      shape="circle"
      style={caption ? undefined : style}
      icon={
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M13 4L7 10L13 16"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      }
    />
  )

  if (!caption) return button

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', ...style }}>
      {button}
      <span
        aria-hidden="true"
        style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)' }}
      >
        {caption}
      </span>
    </div>
  )
}
