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
 */
export default function BackButton({
  onClick,
  ariaLabel = 'Back',
  style,
}: {
  onClick: () => void
  ariaLabel?: string
  style?: CSSProperties
}) {
  return (
    <IconButton
      onClick={onClick}
      ariaLabel={ariaLabel}
      shape="circle"
      style={style}
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
}
