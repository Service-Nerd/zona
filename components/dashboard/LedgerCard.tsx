'use client'

// DASHBOARD-SCREEN-EXTRACT-03 — lifted verbatim out of `DashboardClient.tsx`.
//
// Module-level in the original, so it closed over nothing and this move changes no
// behaviour. It changes REACH: nothing could import it, so nothing could render it.
//
// ⚠️ Bodies UNCHANGED. Edit in a separate commit so the move stays a move.

import type { LedgerSnapshot } from '@/lib/coaching/useDisciplineLedger'
import { BRAND } from '@/lib/brand'
import { MICRO_LABELS } from '@/components/shared/microLabels'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useDisciplineLedger } from '@/lib/coaching/useDisciplineLedger'
import { useTrackOnce } from '@/components/shared/useTrackOnce'

// LEDGER-01 — "Weeks within the lines" RestraintCard.
//
// Moved 2026-05-23 from the Me/Profile screen to the Coach screen — the metric
// belongs with the rest of the execution / discipline data, not the admin /
// connections context where it originally landed. Counter, not a streak. No
// flames, no urgency, no celebration of milestones. Resets silently to 0 on a
// broken week. Voice anchor stamp at the bottom — same anatomy as Pattern 11
// (RestraintCard) in ui-patterns.md.
export default function LedgerCard({ ledger: ledgerProp, surface }: { ledger?: LedgerSnapshot | null; surface: 'me' | 'coach' }) {
  // Prefer the prefetched snapshot from the parent's orchestrated load so the
  // card is resolved on first paint. Fall back to the hook only when the prop
  // is absent (skip the hook's fetch when we already have the data).
  const hookLedger = useDisciplineLedger(ledgerProp != null)
  const ledger = ledgerProp ?? hookLedger
  // 🔴 LEDGER-REACH-01 — THE EVENT LIVES WITH THE CARD, NOT WITH ONE OF ITS CALLERS.
  // It fired from `CoachScreen` while the card rendered in two places would have left the
  // Me surface silent, and `OPS-ARTIFACT-PLACEMENT-01` is an SLT decision parked on
  // exactly this data — a second unmeasured surface makes that decision harder, not easier.
  // ⚠️ `surface` is REQUIRED, not optional with a default: a default is how the second
  // caller ships mislabelled, and this event's whole job is to tell the two apart.
  // The resolved-snapshot guard is preserved: `ledger` is null while fetching, and
  // "rendered a spinner" is not "saw the ledger".
  useTrackOnce('ledger_view', ledger != null, { surface })
  return (
    <div style={{
      background: 'var(--card)', boxShadow: 'var(--shadow-card)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--radius-lg)',
      padding: '20px',
    }}>
      {ledger == null ? (
        // Loading placeholder — same shape as the resolved card so the
        // surface doesn't reflow when the data lands.
        <>
          <div style={{
            fontFamily: 'var(--font-ui)', fontSize: '44px', fontWeight: 800,
            color: 'var(--mute)', opacity: 0.4,
            fontVariantNumeric: 'tabular-nums', lineHeight: 1,
            letterSpacing: '-0.05em',
            marginBottom: 'var(--space-2)',
          }}>—</div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)', lineHeight: 1.5 }}>
            weeks within the lines
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
            <div style={{
              fontFamily: 'var(--font-ui)', fontSize: '44px', fontWeight: 800,
              color: ledger.weeksWithinLines === 0 ? 'var(--mute)' : 'var(--ink)',
              opacity: ledger.weeksWithinLines === 0 ? 0.6 : 1,
              fontVariantNumeric: 'tabular-nums', lineHeight: 1,
              letterSpacing: '-0.05em',
            }}>
              {ledger.weeksWithinLines}
            </div>
            {ledger.currentWeekStatus === 'pending' && ledger.weeksWithinLines > 0 && (
              /* TIER-BADGE-01 — was 10px/600/0.06em, the SECOND divergent copy. Now the
                 documented micro-label. ⚠️ Visible delta: 600→700 weight and
                 0.06→0.08em tracking, which is the drift being corrected, not introduced. */
              <StatusBadge label="pending" tone="none" />
            )}
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: ledger.weeksWithinLines === 0 ? 'var(--ink-2)' : 'var(--mute)', lineHeight: 1.5, marginBottom: 'var(--space-4)' }}>
            {ledger.weeksWithinLines === 0
              ? 'This week starts the count.'
              : 'weeks within the lines'}
          </div>
          <div style={{ ...MICRO_LABELS.eyebrow, fontFamily: 'var(--font-ui)',
            color: 'var(--mute)' }}>
            {BRAND.voiceAnchor}
          </div>
        </>
      )}
    </div>
  )
}
