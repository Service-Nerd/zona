'use client'

// DASHBOARD-SCREEN-EXTRACT-01 — lifted verbatim out of `DashboardClient.tsx`.
//
// It was a module-level function in a 14,447-line file, so it closed over nothing and
// this move changes no behaviour. What it changes is REACH: nothing could import it,
// so it could not be rendered by a harness, a mounting test, or anything but a live
// signed-in session. Fourteen screens were in that position.
//
// ⚠️ The body below is UNCHANGED. If it needs editing, edit it in a separate commit,
// so the move stays reviewable as a move.

import CoachByline from '@/components/shared/CoachByline'
import { MICRO_LABELS } from '@/components/shared/microLabels'

// Loading-state sibling of RunFeedbackCard — shown while analyse-run is in flight.
// Uses the CoachByline pulse instead of a spinner (per ui-patterns.md § CoachByline).
// Rendered on a white card with moss rail to match the post-completion AI card —
// the thing that's coming is the LLM read of your run.
export default function PendingAnalysisCard({ onOpenCoach }: { onOpenCoach?: () => void }) {
  return (
    <div style={{
      position: 'relative',
      marginTop: 'var(--space-3)',
      background: 'var(--card)', boxShadow: 'var(--shadow-card)',
      borderRadius: '14px',
      border: '1px solid var(--line)',
      padding: '14px 16px 14px 22px',
    }}>
      <span aria-hidden="true" style={{
        position: 'absolute', left: '8px', top: '14px', bottom: '14px',
        width: '3px', borderRadius: '2px', background: 'var(--moss)',
      }} />
      <div style={{ marginBottom: 'var(--space-3)' }}>
        <CoachByline working role="Reading your run" onClick={onOpenCoach} />
      </div>
      <div style={{
        fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 400,
        color: 'var(--ink-2)', lineHeight: 1.55,
        marginBottom: 'var(--space-4)',
      }}>
        Analysing your run. Usually takes 15–30 seconds.
      </div>
      {/* Skeleton metric row — hint at what's coming */}
      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
        {['HR', 'Distance', 'Pace', 'Efficiency'].map(label => (
          <div key={label} style={{ flex: 1 }}>
            <div style={{ ...MICRO_LABELS.dataLabel, fontFamily: 'var(--font-ui)',
              color: 'var(--mute)',
              marginBottom: 'var(--space-2)' }}>{label}</div>
            <div style={{
              height: '3px', background: 'var(--line)', borderRadius: '2px',
              animation: 'ai-mark-pulse 1.6s ease-in-out infinite',
            }} />
          </div>
        ))}
      </div>
    </div>
  )
}
