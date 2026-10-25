'use client'
/**
 * NO-RUNNER-TURNED-AWAY-01 (Design Board 2026-10-24, amendment 3) — a STAGED plan's race block, before it exists.
 *
 * The PhaseSummaryCard anatomy (`ui-patterns.md` § Staged race plan) with a DASHED rail and no metrics: those weeks
 * have no peak to state because they are not built until the checkpoint passes. One component, used by the wizard
 * preview and the Plan screen, so the two cannot describe the same weeks differently. The words are the founder's,
 * from `lib/plan/checkpointCopy.ts`.
 */
export default function StagedRaceBlockCard({ title, line }: { title: string; line: string }) {
  return (
    <div data-staged-race-block="" style={{
      background: 'var(--card)', border: '1px solid var(--line)', borderLeft: '3px dashed var(--line-strong)',
      borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: 'var(--space-3)',
    }}>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 700, color: 'var(--ink)', marginBottom: '4px' }}>
        {title}
      </div>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--ink-2)', lineHeight: 1.5 }}>
        {line}
      </div>
    </div>
  )
}
