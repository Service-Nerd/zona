// StatusBadge — TIER-BADGE-01 (Design Board, 2026-09-29).
//
// The one micro-label that reports a STATE. Not a control, not a selection: `Chip` is the
// select chip (`onClick` required, moss active fill) and was the wrong reuse for this.
//
// ── 🔴 WHY IT IS A COMPONENT AND NOT A STYLE OBJECT ──────────────────────────
// Two hand-rolled status badges already existed and had already diverged: the discipline
// ledger's `pending` (10px / 600 / 0.06em / --mute) and `CardSelect`'s `lockLabel`
// (9px / 700 / 0.08em / --moss). Neither was a component. That is the chevron shape —
// a pattern that is a local constant cannot travel, so the second surface re-implements
// it from memory and loses the part that made it consistent.
//
// ── ⛔ SILVANTO'S BINDING AMENDMENT, and it is the whole reason for the constant ──
// `ui-patterns.md` documents exactly ONE micro-label: **10px / 700 / uppercase / 0.08em**.
// Measured at the sitting: **36 distinct size/weight/tracking combinations across 171
// uses** under `components/` and `app/`, of which AT MOST 64 conform. He named the rule
// and declined to veto, on the grounds that a component which does not exist cannot
// regress — and converted it into a condition: this ships at the documented values or
// not at all, because **a component that codifies a 37th variant is the version that
// spreads.** `MICRO-LABEL-DRIFT-01` carries the rest.

import type { CSSProperties } from 'react'

/**
 * The documented micro-label (`ui-patterns.md` § type table, "Section label").
 * ⚠️ These four values are the amendment. Changing any of them here changes every
 * status badge in the product, which is the point — and needs the board.
 */
export const MICRO_LABEL = {
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
} as const

/** `held` = the runner has access. `none` = they do not. ⚠️ TWO values, never five. */
export type StatusTone = 'held' | 'none'

/**
 * 🔴 THE RULING'S HARD CONSTRAINT LIVES HERE. "Celebrating the peak week" forbids
 * emphasis at a high point, and the board ruled a tier badge is a CATEGORY marker, not a
 * rank: **the moment any state is styled UP relative to another it becomes celebration
 * and the ruling is void.**
 *
 * So tone changes the COLOUR and nothing else. Size, weight and tracking are identical
 * for every state, and there is no fill — "type accent, not flood" is standing.
 * ⚠️ `--warn` is coaching-only and `--danger` errors-only (CLAUDE.md), so neither is
 * available here even if a state felt like it wanted one.
 */
const TONE_COLOUR: Record<StatusTone, string> = {
  held: 'var(--moss)',
  none: 'var(--mute)',
}

export function StatusBadge({ label, tone = 'none', style }: {
  label: string
  tone?: StatusTone
  /** Positioning only — the caller owns where it sits, never how it reads. */
  style?: CSSProperties
}) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-ui)',
        fontSize: MICRO_LABEL.fontSize,
        fontWeight: MICRO_LABEL.fontWeight,
        letterSpacing: MICRO_LABEL.letterSpacing,
        textTransform: MICRO_LABEL.textTransform,
        color: TONE_COLOUR[tone],
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {label}
    </span>
  )
}
