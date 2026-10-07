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
      {/* 🔴 POSTRUN-JOURNEY-01 (2026-10-07) — A SKELETON IS THE SILHOUETTE OF ITS
        * RESULT, AND THIS ONE WAS THE SILHOUETTE OF A DELETED SCREEN.
        *
        * It rendered four labelled columns — HR / Distance / Pace / Efficiency — over
        * pulsing bars. They were NEVER DATA: a loading placeholder with four headings
        * and no values behind them. The founder, looking at his own run: "the card at
        * the top showing HR, distance, pace, efficiency are now gone and so I question
        * how valid they are." His instinct was right and the answer was worse than he
        * thought: there were no values at any point.
        *
        * ⚠️ AND THEY WERE THE GHOST OF THE DASHBOARD THE SLT DELETED. UX-POSTRUN-01
        * (2026-09-13) killed the four-column score panel on two MUST/NEVER violations —
        * "no dashboards or noise" and "deliberately omits gamification" — and replaced
        * it with one zone signal. Nobody rebuilt the WAITING screen when they rebuilt
        * the finished one, so the loading state kept advertising a result that can no
        * longer arrive. Removing it is COMPLIANCE with that ruling, not a reversal.
        *
        * What arrives is one zone-signal block and a short read, so that is what this
        * is the shape of. ✋ Silvanto: "a skeleton's only job is to be the silhouette
        * of what is coming." */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {/* the zone signal: one number, then its bar */}
        <div style={{
          width: '38%', height: '10px', background: 'var(--line)', borderRadius: '3px',
          animation: 'ai-mark-pulse 1.6s ease-in-out infinite',
        }} />
        <div style={{
          height: '6px', background: 'var(--line)', borderRadius: '3px',
          animation: 'ai-mark-pulse 1.6s ease-in-out infinite',
        }} />
      </div>
    </div>
  )
}
