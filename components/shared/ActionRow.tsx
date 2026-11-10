/**
 * ACTION-ROW-01 — the one pattern for "tap this to go and do something".
 *
 * 🔴 WHY IT EXISTS. The founder, on the Plan screen: *"that is an action tile.
 * It's not clear you can click on it. We have them under Me profile so we
 * should have a standard pattern for these."* He was right, and the cause was
 * structural rather than an oversight: **the chevron was a local `const` inside
 * the Me screen's component.** Seven rows there used it; the Plan screen could
 * not reach it, so its tile shipped with no affordance at all — on a screen
 * where every session row beside it carries one.
 *
 * ⚠️ A PATTERN THAT IS A LOCAL VARIABLE CANNOT TRAVEL. That is the whole
 * finding. The shape was already agreed and already rendered correctly in one
 * place; nothing was available to reuse, so the second surface re-implemented
 * it from memory and lost the part that makes it legible as a control.
 *
 * The CONTAINER stays with the caller, deliberately. Me groups several rows
 * inside one card with hairline separators; Plan has a single standalone card.
 * Both are cards — what they share is the ROW: title, optional subtitle, and
 * the chevron that says this is a control.
 */

import type { ReactNode } from 'react'
// CHEVRON-OWNER-01 — was a local `const` here, which is the very trap this component's
// own comment was written about. Extracted so `row()` and anything else can reach it.
import { Chevron } from './Chevron'
import { TAP_TARGET_MIN_PX } from '@/components/ui/tapTarget'

export interface ActionRowProps {
  /** The verb. What the runner is about to do. */
  title: ReactNode
  /** One line under it — the consequence, never a restatement of the title. */
  subtitle?: ReactNode
  onClick: () => void
  /** Hairline under the row. Set when stacking rows inside one card (Me). */
  divider?: boolean
  ariaLabel?: string
  /** STRENGTH-ENTRY-01 — a leading `RowIcon` (location, Me) or `Glyph` (meaning). ICON-RULE-01
   *  decides whether a row may carry one; this only gives it a place, so no surface draws its own. */
  icon?: ReactNode
}

// ⚠️ THE DOCBLOCK THAT USED TO SIT HERE DESCRIBED THE CHEVRON — *"16px chevron, `flexShrink: 0`
// so a long title never squashes the affordance"* — and was left behind when `CHEVRON-OWNER-01`
// moved the chevron out, so a comment about a 16px SVG read as the documentation for `ActionRow`.
// The behaviour was never lost (`flexShrink: 0` lives on the `<svg>` in `Chevron.tsx`); only the
// prose went stale, which is the `BACK-HEADER-OWNER-01` class in a comment. Found 2026-11-10
// while writing this component's contract — writing a contract is a code review.

export default function ActionRow({ title, subtitle, onClick, divider = false, ariaLabel, icon }: ActionRowProps) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px', background: 'none', border: 'none',
        borderBottom: divider ? '1px solid var(--line)' : 'none',
        // 44px is the documented minimum tap target — a row whose content is
        // short must still be reachable with a thumb.
        minHeight: TAP_TARGET_MIN_PX,
        cursor: 'pointer', textAlign: 'left',
      }}
    >
      {icon && <div style={{ marginRight: 'var(--space-3)', display: 'flex' }}>{icon}</div>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 500, color: 'var(--ink)', lineHeight: 1.4 }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.5 }}>
            {subtitle}
          </div>
        )}
      </div>
      <div style={{ color: 'var(--mute)', marginLeft: 'var(--space-3)' }}><Chevron /></div>
    </button>
  )
}
