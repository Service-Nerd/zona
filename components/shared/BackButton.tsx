import type { CSSProperties } from 'react'
import IconButton from '@/components/ui/IconButton'
import Button from '@/components/ui/Button'

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
 * 🔴 A CAPTIONED BACK ARROW IS ONE BUTTON, NOT A BUTTON BESIDE A LABEL.
 *
 * The first cut of `caption` rendered an `IconButton` with an `aria-hidden`
 * span next to it, which shrank the tap target from the whole ~150px row to the
 * 44px circle. Founder, asked directly: restore it. **He is right — that screen
 * is where a runner decides whether to accept a plan, one-handed.**
 *
 * ⚠️ THE TWO OBVIOUS FIXES ARE BOTH WRONG, which is why this looks the way it
 * does. A `<div onClick>` around both is the exact shape `LINK-HIERARCHY-01`
 * ruled a defect ("no role, no tabIndex, no focus ring"). Two adjacent buttons
 * sharing one handler makes a screen reader announce the same action twice.
 *
 * So the whole row is ONE `<button>`, and the circle is a `<span>` wearing the
 * SHARED `.icon-btn` classes — not a hand-rolled one. That matters twice over:
 * `ICON-EDGE-01`'s chrome edge arrives for free, and the hand-rolled-circle gate
 * stays silent for the right reason (there is no inline geometry here to catch)
 * rather than by luck. **Using the shared class IS the compliant path.**
 *
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
  /** Optional text beside the arrow. Part of the SAME button — see above. */
  caption?: string
  style?: CSSProperties
}) {
  const chevron = (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )

  if (caption) {
    // ⚠️ `<Button>`, not a hand-written `<button className="btn">`.
    // `buttonArchitecture.test.ts` caught that on the first cut and was right:
    // the component owns the pseudo-states, and a copy drifts.
    return (
      <Button
        variant="ghost"
        size="compact"
        onClick={onClick}
        aria-label={ariaLabel}
        style={{ gap: 'var(--space-3)', padding: '0', ...style }}
      >
        {/* The SHARED circle classes on a span: same 44px, same `--bg-soft`,
            same `--chrome-edge`. A span cannot nest inside a button as a second
            button, and the appearance stays owned by `globals.css`. */}
        <span className="icon-btn icon-btn--circle icon-btn--regular" aria-hidden="true">
          {chevron}
        </span>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)' }}>
          {caption}
        </span>
      </Button>
    )
  }

  const button = (
    <IconButton
      onClick={onClick}
      ariaLabel={ariaLabel}
      shape="circle"
      style={style}
      icon={chevron}
    />
  )

  return button
}
