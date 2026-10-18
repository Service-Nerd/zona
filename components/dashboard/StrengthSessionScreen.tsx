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

import EasedMark from '@/components/shared/EasedMark'
import { isEasedForRecovery } from '@/lib/ui/easedMark'
import { useState } from 'react'
import ScreenHeader from '@/components/ui/ScreenHeader'
import { TAP_TARGET_MIN_PX } from '@/components/ui/tapTarget'
import Button from '@/components/ui/Button'
import { InlineError } from '@/components/shared/InlineError'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { StepSection } from '@/components/shared/SessionSteps'
import CoachNoteBlock from '@/components/shared/CoachNoteBlock'
import { MICRO_LABELS } from '@/components/shared/microLabels'
import { formatDuration } from '@/lib/format'
import {
  STRENGTH_AFTER_RUN_LINE, STRENGTH_BLOCK_TITLE, STRENGTH_KIND_TITLE,
  doseLine, effortLine, exerciseCount, exerciseCues, exerciseName,
  LIFT_FEEL_LABEL, LIFT_LOGGED, LIFT_WEIGHT_LABEL, liftSuggestionLine,
} from '@/lib/strength-bridge/display'
import { isLoadedLift, type Block, type LiftFeel, type LiftLog, type LiftSuggestion, type Prescription, type StrengthSession } from '@/packages/strength'
import { TextField } from '@/components/shared/TextField'
import { Chip } from '@/components/shared/Chip'
import { formatWeight, weightToKg, weightUnit } from '@/lib/format'
import { PLAN_CHANGE_SAVE_FAILED } from '@/lib/ui/planChangeCopy'
import type { StrengthCompletion } from './useStrengthPlan'

const FONT = 'var(--font-ui)'
const ACCENT = 'var(--s-strength)'

/** STRENGTH-PROGRESSION-01 — what a main lift's row needs to show and log (absent on every other row). */
export interface LiftLogging {
  suggestion?: LiftSuggestion
  today?: LiftLog
  units: 'km' | 'mi'
  /** Resolves false when the save failed. Absent: logging is not offered (a future session, or strength off). */
  onLog?: (exerciseId: string, loadKg: number | null, feel: LiftFeel) => Promise<boolean>
}

function ExerciseRow({ num, item, logging }: { num: number; item: Prescription; logging?: LiftLogging }) {
  const [open, setOpen] = useState(false)
  const cues = exerciseCues(item.exercise_id)
  const support = effortLine(item)
  // Design Board 2026-10-18 — the suggestion sits on the collapsed row, before the set.
  const suggestion = logging ? liftSuggestionLine(logging.suggestion, item.reps, logging.units) : null
  return (
    <div style={{ position: 'relative', zIndex: 1, borderTop: '1px solid var(--line)', background: 'var(--card)' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)',
          width: '100%', minHeight: TAP_TARGET_MIN_PX, padding: '11px 13px', border: 0,
          background: 'transparent', textAlign: 'left', cursor: 'pointer',
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
          {suggestion && (
            <span data-lift-suggestion style={{ display: 'block', fontSize: '12px', fontWeight: 400, color: 'var(--ink-2)', marginTop: '3px', lineHeight: 1.4, fontVariantNumeric: 'tabular-nums' }}>{suggestion}</span>
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
      {open && logging?.onLog && <LiftLogPanel item={item} logging={logging} />}
    </div>
  )
}

/** The opened main-lift row's log: the weight (loaded lifts), then a feel. The feel tap is the save. */
export function LiftLogPanel({ item, logging }: { item: Prescription; logging: LiftLogging }) {
  const loaded = isLoadedLift(item.exercise_id)
  const prefill = logging.today?.load_kg ?? logging.suggestion?.load_kg ?? null
  const [weight, setWeight] = useState(prefill != null ? String(Number(formatWeight(prefill, logging.units)?.split(' ')[0])) : '')
  const [feel, setFeel] = useState<LiftFeel | null>(logging.today?.feel ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const value = Number(weight.replace(',', '.'))
  const weightOk = !loaded || (Number.isFinite(value) && value > 0)

  async function log(next: LiftFeel) {
    if (!weightOk || busy) return
    setBusy(true); setError(false)
    const ok = await logging.onLog!(item.exercise_id, loaded ? weightToKg(value, logging.units) : null, next)
    setBusy(false)
    if (ok) setFeel(next); else setError(true)
  }

  return (
    <div data-lift-log style={{ padding: '0 13px 12px 45px', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      {loaded && (
        <TextField value={weight} onChange={setWeight} inputMode="decimal" unit={weightUnit(logging.units)} ariaLabel={LIFT_WEIGHT_LABEL} placeholder={LIFT_WEIGHT_LABEL} />
      )}
      <div role="group" aria-label="How it felt" style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        {(['easy', 'right', 'hard'] as const).map(f => (
          <Chip key={f} label={LIFT_FEEL_LABEL[f]} active={feel === f} onClick={() => void log(f)} />
        ))}
      </div>
      {feel && !error && <span style={{ fontFamily: FONT, fontSize: '12px', color: 'var(--mute)' }}>{LIFT_LOGGED}</span>}
      {error && <InlineError>{PLAN_CHANGE_SAVE_FAILED}</InlineError>}
    </div>
  )
}

function BlockCard({ block, mobilitySession, logging }: { block: Block; mobilitySession: boolean; logging?: (exerciseId: string) => LiftLogging | undefined }) {
  const prep = block.role === 'warmup' || block.role === 'mobility'
  const name = mobilitySession && block.role === 'mobility' ? STRENGTH_KIND_TITLE.mobility : STRENGTH_BLOCK_TITLE[block.role]
  const n = block.items.length
  return (
    <StepSection name={name} accent={prep ? 'var(--moss)' : ACCENT} tintPct={8} totalStr={`${n} ${n === 1 ? 'exercise' : 'exercises'}`} zoneStr="">
      {block.items.map((item, i) => <ExerciseRow key={`${item.exercise_id}-${i}`} num={i + 1} item={item} logging={block.role === 'main' ? logging?.(item.exercise_id) : undefined} />)}
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
  /** STRENGTH-NOTE-01 — this week's AI note, or null (absent, loading or failed all render nothing). */
  note?: string | null
  /** STRENGTH-PROGRESSION-01 — suggestions + today's logs per main lift, and the save. Absent: no logging. */
  lifts?: { suggestions: Record<string, LiftSuggestion>; today: Record<string, LiftLog>; units: 'km' | 'mi'; onLog?: LiftLogging['onLog'] }
}

export default function StrengthSessionScreen({ session, dayLabel, weekN, status, canLog, onBack, onSetStatus, note = null, lifts }: StrengthSessionScreenProps) {
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
        {/* STRENGTH-RECOVERY-01 — the record, as on the run's session screen (ui-patterns § 10e). */}
        {isEasedForRecovery(session) && <p style={{ margin: '0 0 var(--space-3)' }}><EasedMark /></p>}
        {session.after_quality_run && (
          <p style={{ fontFamily: FONT, fontSize: '14px', color: 'var(--ink-2)', lineHeight: 1.5, margin: '0 0 var(--space-3)' }}>
            {STRENGTH_AFTER_RUN_LINE}.
          </p>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
          <Tile label="Duration" value={formatDuration(session.estimated_minutes) ?? '–'} />
          <Tile label="Exercises" value={String(exerciseCount(session))} />
        </div>

        {/* STRENGTH-NOTE-01 — the week's note, said once, here (Design Board: not on Today, which
            already shows the session, nor on Plan, whose coach card is the run's). */}
        {note && (
          <div style={{ marginTop: 'var(--space-3)' }}>
            <CoachNoteBlock aiGenerated>{note}</CoachNoteBlock>
          </div>
        )}

        {session.blocks.map((b, i) => <BlockCard key={`${b.role}-${i}`} block={b} mobilitySession={mobility}
          logging={lifts ? id => ({ suggestion: lifts.suggestions[id], today: lifts.today[id], units: lifts.units, onLog: canLog ? lifts.onLog : undefined }) : undefined} />)}

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
