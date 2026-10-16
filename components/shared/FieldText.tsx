import type { ReactNode } from 'react'
import { FIELD_HINT } from './microLabels'

// BENCHMARK-INPUT-01 (Design Board, 2026-10-16) — the three pieces of text around a
// form input, moved here from `GeneratePlanScreen` unchanged. `BenchmarkUpdateScreen`
// carried its own `FieldLabel` that had drifted (no weight, a different margin), and the
// shared `BenchmarkFields` needs all three. Second use is the rule for generalising
// `FieldReadback` (WIZARD-WEEKDAY-CONFIRM-01 (b)), and this is it.

/** The label above an input. */
export function FieldLabel({ children, optional }: { children: ReactNode; optional?: boolean }) {
  return (
    <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 700, color: 'var(--mute)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
      {children}
      {optional && <span style={{ ...FIELD_HINT, opacity: 0.7 }}>optional</span>}
    </div>
  )
}

/**
 * The reason line below an input. `FIELD_HINT` owns the values
 * (MICRO-LABEL-FIELDHINT-01); layout is this note's own.
 */
export function FieldNote({ children }: { children: ReactNode }) {
  return (
    <div style={{ ...FIELD_HINT, lineHeight: 1.5, marginTop: 'var(--space-2)' }}>
      {children}
    </div>
  )
}

/**
 * `WIZARD-WEEKDAY-CONFIRM-01` (b) — Design Board 2026-10-09, SHIP WITH AMENDMENT.
 *
 * A date field reads its value back in full, **including the weekday**. A runner
 * typing `2027-06-20` into a native date input is shown their keystrokes, not
 * their decision, and the weekday is the half of a race date that actually
 * shapes the plan: every long run is placed backwards from it.
 *
 * 🔴 WHAT THE BOARD KILLED, PERMANENTLY: a weekday **confirmation** step. It
 * measured a **37.5% fire rate**, and the two most common race weekdays are
 * Saturday (12 live) and Sunday (13) — so a confirm would interrupt a third of
 * runners to tell them something that is almost always right, which is Wood's
 * standing objection in its purest form. **The board ruled on SEEN, not
 * CONFIRMED.** Do not re-propose a prompt, a modal or a step here.
 *
 * ⚠️ AND IT KEEPS THE REASON (Silvanto's amendment, verbatim): *"we have traded
 * a reason for a readback. Both, or the readback goes somewhere else."* So this
 * sits ABOVE the existing `FieldNote` rather than replacing it, and the two are
 * separated by WEIGHT AND COLOUR rather than size — 14px/600/`--ink` against
 * 12px/400/`--mute`. A 13px-against-12px step would be the 1.02x failure this
 * repo has already measured twice: too small to read as hierarchy and too large
 * to be nothing.
 *
 * The value comes from `formatDate` (ADR-015 / INV-FMT-001 — `lib/format.ts` is
 * the sole owner of every date string, and `'weekday-long'` already existed, so
 * no new formatter was written). `formatDate` returns **null** on a missing or
 * unparseable value, which is also this component's empty state: the wizard
 * restores `raceDate` from `zona_wizard_draft` in sessionStorage, so a corrupt
 * draft is a real path and must render nothing rather than "Invalid Date".
 *
 * BENCHMARK-INPUT-01 (2026-10-16) — second use, so generalised here. `alert` renders a
 * refusal in the SAME slot, in the form-error colour and announced to assistive tech:
 * still SEEN, never a confirmation step.
 */
export function FieldReadback({ children, alert }: { children: ReactNode; alert?: boolean }) {
  return (
    <div
      role={alert ? 'alert' : undefined}
      style={{
        fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 600,
        color: alert ? 'var(--danger-strong)' : 'var(--ink)', lineHeight: 1.4, marginTop: 'var(--space-2)',
      }}
    >
      {children}
    </div>
  )
}
