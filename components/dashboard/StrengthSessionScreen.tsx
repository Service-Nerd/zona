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
// STRENGTH-SESSION-PARTS-01 (Design Board 2026-10-28 E): the work is shown in PARTS
// (`sessionParts`), each part saying its rounds and rest once; a row says the exercise and
// its dose; the effort is a tile; a superset's rows are linked.
// Every string comes from `lib/strength-bridge/display.ts`.

import { STRENGTH_DELOAD_LINE } from '@/lib/coaching/weekVoice'
import EasedMark from '@/components/shared/EasedMark'
import { isEasedForRecovery } from '@/lib/ui/easedMark'
import { useRef, useState } from 'react'
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
  STRENGTH_AFTER_RUN_LINE, STRENGTH_KIND_TITLE, strengthSessionTitle,
  exerciseCount, exerciseCues, exerciseName,
  LIFT_FEEL_LABEL, LIFT_LOGGED, LIFT_WEIGHT_LABEL, liftSuggestionLine,
  STRENGTH_GUIDED_COPY, STRENGTH_NEW_LIFTS_LINE, STRENGTH_SUPERSET_LINK, effortWords, isNewLift, lostItsHeavyLegs, noLegsLine, partDose, partHeader, partTitle,
} from '@/lib/strength-bridge/display'
import { sessionEffort, sessionParts, trainingParts, type SessionPart } from '@/lib/strength-bridge/sessionParts'
import { Glyph } from '@/components/shared/RowIcon'
import { isLoadedLift, type LiftFeel, type LiftLog, type LiftSuggestion, type Prescription, type StrengthPlan, type StrengthSession } from '@/packages/strength'
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

function ExerciseRow({ item, dose, logging, onOpen, newSaidOnce }: { item: Prescription; dose: string; logging?: LiftLogging; onOpen?: () => void; newSaidOnce: boolean }) {
  const [open, setOpen] = useState(false)
  const cues = exerciseCues(item.exercise_id)
  // Design Board 2026-10-18 — the suggestion sits on the collapsed row, before the set. When EVERY main lift is new,
  // "start light" is said once for the session, under the tiles (2026-10-28 E); when only some are, their rows say it.
  const suggestion = logging && !(newSaidOnce && isNewLift(logging.suggestion)) ? liftSuggestionLine(logging.suggestion, item.reps, logging.units) : null
  return (
    <div data-part-row style={{ position: 'relative', zIndex: 1, background: 'var(--card)' }}>
      <button
        type="button"
        onClick={() => { if (!open) onOpen?.(); setOpen(o => !o) }}
        aria-expanded={open}
        style={{
          display: 'block', width: '100%', minHeight: TAP_TARGET_MIN_PX, padding: '11px 13px', border: 0,
          background: 'transparent', textAlign: 'left', cursor: 'pointer', fontFamily: FONT,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', paddingTop: '1px' }}>{exerciseName(item.exercise_id)}</span>
          <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, flex: 'none', whiteSpace: 'nowrap' }}>
            {dose}
          </span>
        </span>
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
    <div data-lift-log style={{ padding: '0 13px 12px', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
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

function PartCard({ part, n, sessionRir, mobilitySession, logging, onOpen, newSaidOnce }: { part: SessionPart; n: number | null; sessionRir: number | null; mobilitySession: boolean; newSaidOnce: boolean; logging?: (exerciseId: string) => LiftLogging | undefined; onOpen?: (exerciseId: string) => void }) {
  const prep = part.kind === 'warmup' || part.kind === 'cooldown'
  const name = mobilitySession && part.kind === 'cooldown' ? STRENGTH_KIND_TITLE.mobility : partTitle(part, n)
  const linked = part.kind === 'superset'
  return (
    <StepSection name={name} accent={prep ? 'var(--moss)' : ACCENT} tintPct={8} totalStr={partHeader(part, sessionRir)} zoneStr="">
      {part.items.map((item, i) => (
        <div key={`${item.exercise_id}-${i}`} style={{ borderTop: i === 0 || linked ? undefined : '1px solid var(--line)' }}>
          {/* A superset's rows are one part done back to back: the link says so where the runner reads down. */}
          {linked && i > 0 && (
            <div data-superset-link style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: '0 13px', fontFamily: FONT, fontSize: '12px', color: 'var(--mute)' }}>
              <span aria-hidden style={{ display: 'inline-flex' }}><Glyph name="link" /></span>
              {STRENGTH_SUPERSET_LINK}
            </div>
          )}
          <ExerciseRow item={item} dose={partDose(item, part.rounds)}
            logging={item.role === 'main' ? logging?.(item.exercise_id) : undefined} onOpen={onOpen && (() => onOpen(item.exercise_id))} newSaidOnce={newSaidOnce} />
        </div>
      ))}
    </StepSection>
  )
}

function Tile({ label, value, words = false }: { label: string; value: string; words?: boolean }) {
  return (
    <div style={{ background: 'var(--card)', borderRadius: '10px', padding: '10px 12px', border: '1px solid var(--line)' }}>
      <div style={{ ...MICRO_LABELS.dataLabel, fontFamily: FONT, color: 'var(--mute)', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontFamily: FONT, fontSize: words ? '14px' : '17px', fontWeight: 700, color: 'var(--ink)', lineHeight: words ? 1.2 : 1, fontVariantNumeric: 'tabular-nums', whiteSpace: words ? 'nowrap' : undefined }}>{value}</div>
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
  /** STRENGTH-ROW-OPEN-01 — called the first time each exercise row is opened on this visit (the demand measure). */
  onExerciseOpen?: (exerciseId: string) => void
  /** PHASE-ON-TODAY-01 — the strength week is a deload: say the short session is on purpose. */
  deloadWeek?: boolean
  /** STRENGTH-GUIDED-SESSION-01 — open the guided session. Absent: not offered (another day, or already logged). */
  onStart?: () => void
  /** S3 Am.3 — on a session that lost its heavy legs: the hard run beside it, and the plan's swap day. */
  noLegs?: { beside: 'quality' | 'long' | null; swap?: StrengthPlan['legs_day_suggestion'] | null }
}

export default function StrengthSessionScreen({ session, dayLabel, weekN, status, canLog, onBack, onSetStatus, note = null, lifts, onExerciseOpen, deloadWeek = false, noLegs, onStart }: StrengthSessionScreenProps) {
  // Once per exercise per visit: reopening a row to re-read a cue is not a second look-up.
  const opened = useRef(new Set<string>())
  const onOpen = onExerciseOpen && ((id: string) => { if (opened.current.has(id)) return; opened.current.add(id); onExerciseOpen(id) })
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const mobility = session.kind === 'mobility'
  const parts = sessionParts(session)
  const training = trainingParts(parts)
  const effort = sessionEffort(parts)
  // Loaded mains only: a bodyweight main has no weight to start light with.
  const loadedMains = lifts ? session.blocks.filter(b => b.role === 'main').flatMap(b => b.items).filter(i => lifts.suggestions[i.exercise_id] && lifts.suggestions[i.exercise_id].kind !== 'bodyweight') : []
  const newLifts = loadedMains.length > 0 && loadedMains.every(i => isNewLift(lifts!.suggestions[i.exercise_id]))
  const lostLegs = !!noLegs && lostItsHeavyLegs(session)
  // The plan's swap fixes the day it replaces, not every converted day (code review 2026-10-29).
  const swap = noLegs?.swap && noLegs.swap.replaces === session.day ? noLegs.swap : null

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
        title={strengthSessionTitle(session)}
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

        <div style={{ display: 'grid', gridTemplateColumns: effort != null && !mobility ? '1fr 1fr auto' : '1fr 1fr', gap: 'var(--space-2)' }}>
          <Tile label="Duration" value={formatDuration(session.estimated_minutes) ?? '–'} />
          {mobility ? <Tile label="Exercises" value={String(exerciseCount(session))} /> : <Tile label="Parts" value={String(training.length)} />}
          {effort != null && !mobility && <Tile label="Effort" value={effortWords(effort)} words />}
        </div>
        {/* PHASE-ON-TODAY-01 — the founder read a deload's 33 minutes as his 60-minute setting ignored. */}
        {deloadWeek && (
          <p data-strength-deload style={{ fontFamily: FONT, fontSize: '14px', color: 'var(--ink-2)', lineHeight: 1.5, margin: 'var(--space-2) 0 0' }}>
            {STRENGTH_DELOAD_LINE}
          </p>
        )}

        {newLifts && (
          <p data-strength-new-lifts style={{ fontFamily: FONT, fontSize: '14px', color: 'var(--ink-2)', lineHeight: 1.5, margin: 'var(--space-2) 0 0' }}>
            {STRENGTH_NEW_LIFTS_LINE}
          </p>
        )}
        {lostLegs && (
          <p data-strength-no-legs style={{ fontFamily: FONT, fontSize: '14px', color: 'var(--ink-2)', lineHeight: 1.5, margin: 'var(--space-2) 0 0' }}>
            {noLegsLine(noLegs!.beside, swap)}
          </p>
        )}

        {/* STRENGTH-NOTE-01 — the week's note, said once, here (Design Board: not on Today, which
            already shows the session, nor on Plan, whose coach card is the run's). */}
        {note && (
          <div style={{ marginTop: 'var(--space-3)' }}>
            <CoachNoteBlock aiGenerated>{note}</CoachNoteBlock>
          </div>
        )}

        {parts.map((p, i) => <PartCard key={`${p.kind}-${i}`} part={p} n={training.includes(p) ? training.indexOf(p) + 1 : null} sessionRir={effort} mobilitySession={mobility} onOpen={onOpen} newSaidOnce={newLifts}
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
                {/* STRENGTH-GUIDED-SESSION-01 (Design Board F): one primary, Start session, on the day; marking it done
                    without the guided flow stays one tap away. */}
                {onStart ? (
                  <>
                    <Button variant="primary" fullWidth onClick={onStart} disabled={busy}>{STRENGTH_GUIDED_COPY.start}</Button>
                    <Button variant="secondary" fullWidth onClick={() => void set('done')} busy={busy} style={{ marginTop: 'var(--space-2)' }}>{STRENGTH_GUIDED_COPY.markWithoutStarting}</Button>
                  </>
                ) : (
                  <Button variant="primary" fullWidth onClick={() => void set('done')} busy={busy}>Mark complete</Button>
                )}
                <Button variant={onStart ? 'quiet' : 'secondary'} fullWidth onClick={() => void set('skipped')} disabled={busy} style={{ marginTop: 'var(--space-2)' }}>Skip</Button>
              </>
            )}
            {failed && <InlineError style={{ marginTop: 'var(--space-2)' }}>Couldn&apos;t save that. Try again.</InlineError>}
          </div>
        )}
      </div>
    </div>
  )
}
