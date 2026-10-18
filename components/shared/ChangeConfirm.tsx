'use client'

// SAVE-PATTERN-01 (Design Board 2026-10-18) — the frame of every "Here is what changes" consent screen.
//
// Changing a plan, run or strength, is one journey: edit, see what changes, accept, land on Plan with a readback. This
// is the middle step's frame, owned once so the two consent screens cannot drift: back arrow top-left (edits intact),
// the title and its promise, the body the caller owns, then Accept and Keep. While saving, the primary button carries
// the whole state and nothing else moves (no progress animation: MODIFY-CONFIRM-DIFF-01 declined it). A failure is an
// InlineError directly under Accept, saying what was not saved.

import type { ReactNode } from 'react'
import Button from '@/components/ui/Button'
import BackButton from '@/components/shared/BackButton'
import { InlineError } from './InlineError'
import { MICRO_LABELS } from './microLabels'

/** A section label naming WHICH SCALE the block below reports on (MODIFY-CONFIRM-DIFF-01 rule 1). */
export function ScaleLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{
      fontFamily: 'var(--font-ui)',
      ...MICRO_LABELS.eyebrow,
      color: 'var(--mute)',
      marginBottom: 'var(--space-2)',
    }}>{children}</div>
  )
}

export default function ChangeConfirm({ onBack, backLabel, onAccept, onCancel, applying, error = null, children }: {
  /** Back to the edit screen WITH THE EDITS INTACT (MODIFY-CONFIRM-01 clause 1). */
  onBack: () => void
  backLabel: string
  onAccept: () => void
  /** Discard. The one genuinely destructive exit. */
  onCancel: () => void
  applying: boolean
  /** What was not saved, said where the action is. */
  error?: string | null
  children: ReactNode
}) {
  return (
    <div style={{ padding: '0 20px 24px' }}>
      <BackButton onClick={onBack} ariaLabel={backLabel} style={{ marginBottom: 'var(--space-4)' }} />
      <div style={{ fontFamily: 'var(--font-brand)', fontSize: '26px', fontWeight: 800, color: 'var(--ink)' }}>
        Here is what changes
      </div>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.5, marginTop: '4px', marginBottom: 'var(--space-4)' }}>
        Nothing is saved until you accept.
      </div>
      {children}
      <Button variant="primary" fullWidth
        onClick={onAccept} busy={applying} busyLabel="Saving your plan…" style={{ marginTop: 'var(--space-5)' }}>
        Accept and save
      </Button>
      {error && <InlineError style={{ marginTop: 'var(--space-2)' }}>{error}</InlineError>}
      <Button variant="secondary" fullWidth
        onClick={onCancel}
        disabled={applying} style={{ marginTop: '4px' }}>
        Keep my current plan
      </Button>
    </div>
  )
}
