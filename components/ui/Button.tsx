// ⚠️ DELIBERATELY NOT `'use client'` (Design Board, WEBSITE-BUTTON-UNIFY-01,
// 2026-09-25). This component uses no hook, no state and no browser API — it
// spreads props onto a `<button>`. The directive was here out of habit, and it
// was a live `BUNDLE-BOUNDARY-01` hazard: `SiteHeader.tsx` and
// `app/charity-runners/page.tsx` are SERVER components, so the first person to
// import this into a marketing page would have pushed a client boundary onto a
// static page. That class has cost this repo 110 kB -> 249 kB and 114 kB ->
// 251 kB, both times silently, both times found by measuring rather than by
// looking. Every app importer is already a client component, so nothing moves.

import React from 'react'

/**
 * Button — THE SINGLE OWNER of every control that asks a runner to do something.
 *
 * 🔴 WHY THIS EXISTS (BUTTON-COMPONENT-01, Design Board 2026-09-24, built
 * 2026-09-25 at the founder's chosen direction B).
 *
 * The founder said the CTAs looked flat. The board measured and found something
 * larger: there was no Button component at all. 66 `<button>` elements carried
 * `var(--moss)`, 27 of them the primary-CTA shape, each one a nine-line inline
 * style object written out again from whatever was nearby. `--shadow-lifted`
 * was authored for a raised state and had ZERO consumers while `--shadow-card`
 * had 19 — **the product elevated its cards and gave its buttons nothing**, so
 * a moss button sat visually behind the card it was on.
 *
 * 🔴 AND ALL 42 TEXT-CARRYING MOSS CONTROLS FAILED WCAG AA. That is not why the
 * item was filed and it is why it had to ship: white on `--moss` is 3.68:1, and
 * `--moss` as a label is 3.24:1 on `--bg` / 3.04:1 on `--bg-soft`, against AA's
 * 4.5:1. Nothing in this product reaches the 18.66px-bold large-text exemption.
 *
 * ⚠️ THE FIX WAS ALREADY IN THE REPO, APPLIED TO ONE SURFACE. `A11Y-CONTRAST-01`
 * measured this exact failure ("the primary 'Get the app' button failed AA at
 * 13.5px bold") and added `--moss-strong` and `--moss-deep` for it. It then
 * fixed the marketing button: 28 uses across the site, **0 in `app/dashboard`,
 * 0 in `lib/email`**. A remedy applied to one case and not its twin, which is
 * the fifth instance of that shape recorded this week.
 *
 * ⚠️ WHY `lib/a11yContrast.test.ts` STAYED GREEN THROUGHOUT, and why it is not
 * at fault: it asserts `white on --moss-strong >= 4.5`, which is TRUE and is a
 * fact about a token the app never used. Its own header says it checks the
 * TOKENS, not where they are used. The checker read a different source from the
 * producer. `buttonOwnership.test.ts` is the half that reads the producer.
 *
 * ⚠️ NOT EVERY MOSS BUTTON IS THIS COMPONENT. 15 of the 66 use moss as the
 * SELECTED affordance (`WeekGrid`, `DayGridSelector`, `CardSelect`, `RPEScale`,
 * `ZoneRings`). `ui-patterns.md` makes that active fill the only selected
 * affordance, and a fill is graphics at 3:1, not text at 4.5:1. They are
 * correct as they are. Converting them would reverse a standing rule while
 * looking like tidying.
 *
 * ⚠️ PRESS IS THE RULING'S 1px, NOT THE MOCK-UP'S 2px. The 2026-09-25 mock-up
 * drew a 2px sink and a 3px email rule; the ruling says `translateY(1px)` and a
 * 1px email border. The ruling binds and the mock-up chose the DIRECTION.
 *
 * All styling lives in `app/globals.css` under `.btn`, deliberately: pseudo
 * states (`:hover`, `:focus-visible`, `:active`, `:disabled`) cannot be
 * expressed inline, and splitting them across two places is how `.cta-pill`'s
 * hover and focus would have drifted. This component is the vocabulary; the
 * stylesheet is the paint.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'soft' | 'destructive'
export type ButtonSize = 'regular' | 'compact'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** `primary` is ONE PER SCREEN. If a screen wants two, one of them is secondary. */
  variant?: ButtonVariant
  /** `compact` is 44px, the floor. Never go below it (Wroblewski, ADR-023). */
  size?: ButtonSize
  /** Stretch to the container. The stacked-CTA case on Today and Session. */
  fullWidth?: boolean
  /**
   * In flight. Disables the button and marks it `aria-busy`, so a screen reader
   * is told the same thing the dimmed label tells everyone else. Pass
   * `busyLabel` when the verb should change ("Start run" -> "Starting").
   */
  busy?: boolean
  busyLabel?: React.ReactNode
}

export default function Button({
  variant = 'primary',
  size = 'regular',
  fullWidth = false,
  busy = false,
  busyLabel,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    'btn',
    `btn--${variant}`,
    `btn--${size}`,
    fullWidth ? 'btn--full' : '',
    busy ? 'btn--busy' : '',
    className ?? '',
  ].filter(Boolean).join(' ')

  return (
    <button
      {...rest}
      className={classes}
      // A busy button must not fire twice. This is the behaviour, not decoration.
      disabled={disabled || busy}
      aria-busy={busy || undefined}
    >
      {busy && busyLabel !== undefined ? busyLabel : children}
    </button>
  )
}
