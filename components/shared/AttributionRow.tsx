'use client'

// OPS-ATTRIB-01 (2026-09-28) — "How did you hear about Zonna?", once, in one tap.
//
// ── WHY IT EXISTS ───────────────────────────────────────────────────────────
// 27 accounts and no idea how any of them arrived. A LinkedIn post, a
// Make-A-Wish charity place and a Google search are indistinguishable in the
// data, so when installs move there is no way to know which effort moved them.
//
// ── DESIGN BOARD, 2026-09-28: SHIP WITH AMENDMENT ───────────────────────────
// Every condition below is a ruling, not a preference:
//
//   · Today, BELOW the session card. Silvanto: "today's job is the next
//     decision; this is admin." It renders LAST, after the voice-anchor strip,
//     because admin goes last and it must not interrupt the closing moment.
//   · VISUALLY INERT. No icon, no Moss accent, `--mute` label. Moss would give
//     it a weight it has not got.
//   · ONE TAP to answer, ONE TAP to dismiss, ZERO TYPING. Wroblewski: a
//     free-text field is a keyboard outdoors. `other` is a tap, not a prompt.
//   · NEVER RETURNS once either happens.
//   · BEHAVIOUR-TRIGGERED — the caller renders it only once a plan exists.
//     `design-rulings.md:266` applied to a non-upgrade prompt.
//   · HONEST COPY. Sierra: "this makes the runner no better at running, and I'd
//     rather we admit that than dress it up." So the line says it helps US.
//
// ⚠️ NOT A MODAL, AND THAT IS A RULE. CLAUDE.md § UI Principles: no popups;
// modals are for destructive confirmations, never for information. This is an
// inline row on an existing screen.
//
// ⚠️ IT IS NOT A COUNTER, A STREAK OR A PROGRESS NUMBER. It displays no number
// at all, so `design-rulings.md:208` (aggregating numbers are forbidden) is
// untouched rather than argued with.
//
// SUCCESS CONDITION, stated before the design as the chair required:
// **40% of new accounts answer within 30 days.** Below that, this row taught us
// nothing and cost a screen.

import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  ATTRIBUTION_SOURCES, trackEvent, markAttributionAnswered,
  type AttributionSource,
} from '@/lib/analytics'

export default function AttributionRow({ supabase, userId, onResolved }: {
  supabase: SupabaseClient
  userId: string | null
  /** Told to the parent so the row disappears for the rest of the session
   *  without waiting on a re-read of storage. */
  onResolved: () => void
}) {
  const [busy, setBusy] = useState(false)

  function resolve(source: AttributionSource | null) {
    if (busy) return
    setBusy(true)
    // Recorded BEFORE the row goes, so a dropped event cannot be caused by the
    // component unmounting. `trackEvent` never throws and never blocks.
    if (source) trackEvent(supabase, userId, 'attribution_answered', { source })
    else trackEvent(supabase, userId, 'attribution_dismissed')
    markAttributionAnswered()
    onResolved()
  }

  return (
    <div style={{ padding: '24px 16px 0' }}>
      <div style={{
        fontFamily: 'var(--font-ui)',
        fontSize: '13px',
        fontWeight: 600,
        color: 'var(--ink-2)',
        letterSpacing: '-0.005em',
      }}>
        How did you hear about Zonna?
      </div>

      {/* The honest half. It says what this is for, which is us. */}
      <div style={{
        fontFamily: 'var(--font-ui)',
        fontSize: '12px',
        fontWeight: 400,
        color: 'var(--mute)',
        marginTop: '2px',
        lineHeight: 1.4,
      }}>
        One tap. It tells us where to put our effort.
      </div>

      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        // APP-SPACE-01: 6px is equidistant from 4 and 8 and the ruling breaks
        // the tie UPWARD — whitespace is a documented feature.
        gap: 'var(--space-2)',
        // APP-SPACE-01: 10px is equidistant from 8 and 12; tie breaks upward.
        marginTop: 'var(--space-3)',
      }}>
        {ATTRIBUTION_SOURCES.map(s => (
          <button
            key={s.id}
            type="button"
            disabled={busy}
            onClick={() => resolve(s.id)}
            style={{
              // Inert by ruling: a line border and ink-2 text, never a Moss fill.
              fontFamily: 'var(--font-ui)',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--ink-2)',
              background: 'var(--card)',
              border: '1px solid var(--line)',
              borderRadius: '999px',
              // 44px tall: the documented minimum tap target, which a 13px pill
              // does not reach on padding alone.
              minHeight: '44px',
              padding: '0 14px',
              cursor: busy ? 'default' : 'pointer',
              opacity: busy ? 0.5 : 1,
            }}
          >
            {s.label}
          </button>
        ))}

        <button
          type="button"
          disabled={busy}
          onClick={() => resolve(null)}
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--mute)',
            background: 'transparent',
            border: 'none',
            minHeight: '44px',
            padding: '0 8px',
            cursor: busy ? 'default' : 'pointer',
          }}
        >
          Skip
        </button>
      </div>
    </div>
  )
}
