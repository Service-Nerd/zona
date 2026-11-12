'use client'

// DASHBOARD-SCREEN-EXTRACT-01 — lifted verbatim out of `DashboardClient.tsx`.
//
// It was a module-level function in a 14,447-line file, so it closed over nothing and
// this move changes no behaviour. What it changes is REACH: nothing could import it,
// so it could not be rendered by a harness, a mounting test, or anything but a live
// signed-in session. Fourteen screens were in that position.
//
// ⚠️ The body was UNCHANGED by that move. `ACT-FREE-TEASE-01` (2026-11-12) is the separate
// commit that edits it, and the reason is below.

import CoachByline from '@/components/shared/CoachByline'
import Button from '@/components/ui/Button'
import { BRAND } from '@/lib/brand'

// Shown for free users on completed sessions — communicates the value of
// coaching without exposing any actual coaching data (INV-GATE-005).
//
// 🔴 ITS ONE SENTENCE WAS FALSE FOR HALF THE RUNNERS WHO SAW IT (`ACT-FREE-TEASE-01`). It read
// *"He needs your runs first: Strava or Apple Health"* — and this card renders only on a
// COMPLETED session, so for every runner who completed by LINKING a run, we had their run and
// were telling them we did not. Measured 2026-11-12: free/trial runners hold 146 activities,
// 122 of them carrying a full heart-rate zone split. The sentence is true for a MANUAL tick and
// false for a linked one, and the component could not tell the two apart because nothing passed
// it the difference.
//
// ⚠️ AND THE HONEST VERSION IS NOT "KIT READ IT". On the free tier `activity_intelligence` is
// PAID, so `analyse-run` never ran and there is no read — claiming one would be the same class of
// false claim in the other direction. What is true is that we do not read it, and that is the
// thing being sold.
export default function LockedCoachingPreview({ onUpgrade, onOpenCoach, hasLinkedRun = false }: {
  onUpgrade?: () => void
  onOpenCoach?: () => void
  /** A Strava or Apple Health run is linked to this completion, so we already have the run. */
  hasLinkedRun?: boolean
}) {
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
        {hasLinkedRun
          ? `${BRAND.coachName} doesn’t read your runs on the free plan. That’s the part you’d be paying for.`
          : `${BRAND.coachName} reads here. He needs your runs first: Strava or Apple Health.`}
      </div>
      {onUpgrade && (
        <Button variant="quiet" onClick={onUpgrade}>
          Unlock coaching →
        </Button>
      )}
    </div>
  )
}
