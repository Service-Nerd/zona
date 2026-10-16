'use client'
// STRENGTH-ENGINE-01 Phase 2 — one strength session's full brief (Design Board STRENGTH-APP-01 D).
//
// SessionScreen's anatomy, so it reads as the same app: pinned header with the one
// BackButton, eyebrow (day · week), compact title, type chip; the 2-up metric tiles;
// blocks in the SessionSteps section language. It is a separate screen, not a
// SessionScreen variant, because every run block (zone, pace, auto-match, run
// feedback) would have to branch.
//
// Board rulings carried here: cues one tap deep, NO media placeholder until Phase 3,
// actions at the end of content (7a), done or skipped only (no RPE until Phase 4).
// Every string comes from `lib/strength-bridge/display.ts`.

import { useState } from 'react'
import ScreenHeader from '@/components/ui/ScreenHeader'
import { TAP_TARGET_MIN_PX } from '@/components/ui/tapTarget'
import Button from '@/components/ui/Button'
import { InlineError } from '@/components/shared/InlineError'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { StepSection } from '@/components/shared/SessionSteps'
import { MICRO_LABELS } from '@/components/shared/microLabels'
import { formatDuration } from '@/lib/format'
import {
  STRENGTH_AFTER_RUN_LINE, STRENGTH_BLOCK_TITLE, STRENGTH_KIND_TITLE,
  doseLine, effortLine, exerciseCount, exerciseCues, exerciseName,
} from '@/lib/strength-bridge/display'
import type { Block, Prescription, StrengthSession } from '@/packages/strength'
import type { StrengthCompletion } from './useStrengthPlan'

const FONT = 'var(--font-ui)'
const ACCENT = 'var(--s-strength)'

function ExerciseRow({ num, item }: { num: number; item: Prescription }) {
  const [open, setOpen] = useState(false)
  const cues = exerciseCues(item.exercise_id)
  const support = effortLine(item)
  return (
    <button
      type="button"
      onClick={() => setOpen(o => !o)}
      aria-expanded={open}
      style={{
        position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)',
        width: '100%', minHeight: TAP_TARGET_MIN_PX, padding: '11px 13px', border: 0, borderTop: '1px solid var(--line)',
        background: 'var(--card)', textAlign: 'left', cursor: 'pointer',
        fontFamily: FONT,
      }}
    >
      <span style={{ flex: 'none', width: '20px', textAlign: 'center', fontSize: '14px', fontWeight: 800, fontStyle: 'italic', color: 'var(--mute-2)', fontVariantNumeric: 'tabular-nums' }}>
        {num}
      </span>
      <span style={{ flex: 1, minWidth: 0, display: 'block' }}>
        <span style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', paddingTop: '1px' }}>{exerciseName(item.exercise_id)}</span>
          <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, flex: 'none', whiteSpace: 'nowrap' }}>
            {doseLine(item)}
          </span>
        </span>
        {support && (
          <span style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--ink-2)', marginTop: '5px', lineHeight: 1.4 }}>{support}</span>
        )}
        {open && cues.length > 0 && (
          <span style={{ display: 'block', marginTop: 'var(--space-2)' }}>
            {cues.map(c => (
              <span key={c} style={{ display: 'block', fontSize: '12px', color: 'var(--ink-2)', lineHeight: 1.5 }}>{c}</span>
            ))}
          </span>
        )}
      </span>
    </button>
  )
}

function BlockCard({ block, mobilitySession }: { block: Block; mobilitySession: boolean }) {
  const prep = block.role === 'warmup' || block.role === 'mobility'
  const name = mobilitySession && block.role === 'mobility' ? STRENGTH_KIND_TITLE.mobility : STRENGTH_BLOCK_TITLE[block.role]
  const n = block.items.length
  return (
    <StepSection name={name} accent={prep ? 'var(--moss)' : ACCENT} tintPct={8} totalStr={`${n} ${n === 1 ? 'exercise' : 'exercises'}`} zoneStr="">
      {block.items.map((item, i) => <ExerciseRow key={`${item.exercise_id}-${i}`} num={i + 1} item={item} />)}
    </StepSection>
  )
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--card)', borderRadius: '10px', padding: '10px 12px', border: '1px solid var(--line)' }}>
      <div style={{ ...MICRO_LABELS.dataLabel, fontFamily: FONT, color: 'var(--mute)', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontFamily: FONT, fontSize: '17px', fontWeight: 700, color: 'var(--ink)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  )
}

export interface StrengthSessionScreenProps {
  session: StrengthSession
  /** e.g. "Thursday". */
  dayLabel: string
  /** e.g. 4. */
  weekN: number | null
  status: StrengthCompletion | null
  /** Logging is offered on the day and after it, as on a run. */
  canLog: boolean
  onBack: () => void
  onSetStatus: (status: StrengthCompletion | null) => Promise<boolean>
}

export default function StrengthSessionScreen({ session, dayLabel, weekN, status, canLog, onBack, onSetStatus }: StrengthSessionScreenProps) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const mobility = session.kind === 'mobility'

  async function set(next: StrengthCompletion | null) {
    setBusy(true); setFailed(false)
    const ok = await onSetStatus(next)
    setBusy(false)
    if (!ok) setFailed(true)
  }

  return (
    <div style={{ minHeight: '100%', background: 'var(--bg)' }}>
      {/* The app's pushed-screen header owner: arrow, title and sub pin as one group. The
          type is said in the sub, not in a separate chip: one less thing on the line. */}
      <ScreenHeader
        title={STRENGTH_KIND_TITLE[session.kind]}
        sub={['Strength', dayLabel, weekN ? `Week ${weekN}` : ''].filter(Boolean).join(' · ')}
        onBack={onBack}
      />

      <div style={{ padding: '0 16px var(--space-6)' }}>
        {session.after_quality_run && (
          <p style={{ fontFamily: FONT, fontSize: '14px', color: 'var(--ink-2)', lineHeight: 1.5, margin: '0 0 var(--space-3)' }}>
            {STRENGTH_AFTER_RUN_LINE}.
          </p>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
          <Tile label="Duration" value={formatDuration(session.estimated_minutes) ?? '–'} />
          <Tile label="Exercises" value={String(exerciseCount(session))} />
        </div>

        {session.blocks.map((b, i) => <BlockCard key={`${b.role}-${i}`} block={b} mobilitySession={mobility} />)}

        {canLog && (
          <div style={{ marginTop: 'var(--space-5)' }}>
            {status ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                <StatusBadge label={status === 'done' ? 'Done' : 'Skipped'} tone={status === 'done' ? 'held' : 'none'} />
                <Button variant="ghost" onClick={() => void set(null)} disabled={busy}>Undo</Button>
              </div>
            ) : (
              <>
                <Button variant="primary" fullWidth onClick={() => void set('done')} busy={busy}>Mark complete</Button>
                <Button variant="secondary" fullWidth onClick={() => void set('skipped')} disabled={busy} style={{ marginTop: 'var(--space-2)' }}>Skip</Button>
              </>
            )}
            {failed && <InlineError style={{ marginTop: 'var(--space-2)' }}>Couldn&apos;t save that. Try again.</InlineError>}
          </div>
        )}
      </div>
    </div>
  )
}
