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
import Button from '@/components/ui/Button'

// Shown for free users on completed sessions — communicates the value of
// coaching without exposing any actual coaching data (INV-GATE-005).
export default function LockedCoachingPreview({ onUpgrade, onOpenCoach }: { onUpgrade?: () => void; onOpenCoach?: () => void }) {
  return (
    <div style={{
      marginTop: 'var(--space-3)',
      background: 'var(--bg-soft)',
      borderRadius: '14px',
      padding: '16px 18px',
      border: '1px solid var(--line)',
    }}>
      <div style={{ marginBottom: 'var(--space-3)', opacity: 0.4 }}>
        <CoachByline onClick={onOpenCoach} />
      </div>
      <div style={{
        fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 400,
        color: 'var(--mute)', lineHeight: 1.55, marginBottom: 'var(--space-4)',
      }}>
        Kit reads here. He needs your runs first: Strava or Apple Health.
      </div>
      {onUpgrade && (
        <Button variant="quiet" onClick={onUpgrade}>
          Unlock coaching →
        </Button>
      )}
    </div>
  )
}
