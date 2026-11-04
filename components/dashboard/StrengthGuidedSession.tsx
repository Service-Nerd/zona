'use client'
// STRENGTH-GUIDED-SESSION-01 (Design Board 2026-10-28 F; founder-approved canvas and wording) — a strength session
// done one part at a time: the round being counted as the headline, the part's moves, a weight stepper on each loaded
// main lift, a timer on timed moves, the rest counting down by itself, Back and the next step at the bottom, End
// session always there. The first screen in the app built for DOING rather than reading (Collins).
//
// The flow is `lib/strength-bridge/guidedSession.ts`'s pure step model; this file owns only the clock, the device
// (screen awake, today's progress on this device) and the paint. The end page logs each main lift through the same
// `LiftLogPanel` the overview uses, so a lift is logged one way everywhere. Every string comes from `display.ts`.

import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import Button from '@/components/ui/Button'
import Sheet from '@/components/shared/Sheet'
import { Glyph } from '@/components/shared/RowIcon'
import { InlineError } from '@/components/shared/InlineError'
import { MICRO_LABELS } from '@/components/shared/microLabels'
import { TAP_TARGET_MIN_PX } from '@/components/ui/tapTarget'
import { formatClockTime, formatWeight, weightToKg, weightUnit } from '@/lib/format'
import {
  STRENGTH_GUIDED_COPY as COPY, STRENGTH_SUPERSET_LINK, exerciseName, guidedNextLine, guidedPartLine,
  liftSuggestionLine, partDose, partTitle,
} from '@/lib/strength-bridge/display'
import { sessionParts, trainingParts, type SessionPart } from '@/lib/strength-bridge/sessionParts'
import {
  STRENGTH_GUIDED, guidedReduce, guidedSteps, guidedTally, resumeGuided, secondsLeft, staleGuidedKeys, startGuided,
  type GuidedAction, type GuidedState, type GuidedStep,
} from '@/lib/strength-bridge/guidedSession'
import { isLoadedLift, type StrengthSession } from '@/packages/strength'
import { LiftLogPanel, type LiftLogging } from './StrengthSessionScreen'
import { PLAN_CHANGE_SAVE_FAILED } from '@/lib/ui/planChangeCopy'
import { Z_LAYERS } from '@/lib/ui/zLayers'

const FONT = 'var(--font-ui)'
const ACCENT = 'var(--s-strength)'

export interface StrengthGuidedSessionProps {
  session: StrengthSession
  /** The session's title, e.g. "Full body". */
  title: string
  lifts?: { suggestions: Record<string, LiftLogging['suggestion']>; today: Record<string, NonNullable<LiftLogging['today']>>; units: 'km' | 'mi'; onLog?: LiftLogging['onLog'] }
  /** Leave without ending: today's progress is kept on this device. */
  onExit: () => void
  /** Done on the end page: mark the session done with its times. Resolves false when the save failed. */
  onFinish: (times: { started_at: string; ended_at: string }) => Promise<boolean>
  /** Test seam: the clock. */
  now?: () => number
  /** Test seam: where today's progress is kept. */
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
}

function safeStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null {
  try { return typeof window !== 'undefined' ? window.localStorage : null } catch { return null }
}

/** Keep the screen awake while a session runs (Wroblewski). Best effort: the webview may not support it. */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined') return
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock
    if (!wl) return
    let lock: { release: () => Promise<void> } | null = null
    const take = () => { wl.request('screen').then(l => { lock = l }).catch(() => {}) }
    const onVisible = () => { if (document.visibilityState === 'visible') take() }
    take()
    document.addEventListener('visibilitychange', onVisible)
    return () => { document.removeEventListener('visibilitychange', onVisible); lock?.release().catch(() => {}) }
  }, [active])
}

export default function StrengthGuidedSession({ session, title, lifts, onExit, onFinish, now = Date.now, storage }: StrengthGuidedSessionProps) {
  const store = storage === undefined ? safeStorage() : storage
  const parts = useMemo(() => sessionParts(session), [session])
  const steps = useMemo(() => guidedSteps(parts), [parts])
  const training = useMemo(() => trainingParts(parts), [parts])
  const key = STRENGTH_GUIDED.storageKey(session.date ?? '')

  const [state, dispatch] = useReducer(
    (s: GuidedState, a: GuidedAction | { type: 'replace'; s: GuidedState }) => (a.type === 'replace' ? a.s : guidedReduce(s, steps, a, now()) ?? s),
    null,
    () => {
      let raw: string | null = null
      try { raw = store?.getItem(key) ?? null } catch { /* private mode */ }
      const weights: Record<string, number> = {}
      for (const b of session.blocks) if (b.role === 'main') for (const i of b.items) {
        const kg = lifts?.today[i.exercise_id]?.load_kg ?? lifts?.suggestions[i.exercise_id]?.load_kg
        if (kg != null && isLoadedLift(i.exercise_id)) weights[i.exercise_id] = kg
      }
      return resumeGuided(raw, session, steps.length) ?? startGuided(session, now(), weights)
    },
  )
  // Today's progress, kept as it changes; cleared on Done. Other days' leftovers are removed once, on open.
  useEffect(() => { try { store?.setItem(key, JSON.stringify(state)) } catch { /* full or blocked */ } }, [state, store, key])
  useEffect(() => {
    try {
      const ls = store as Storage | null
      if (!ls || typeof ls.length !== 'number') return
      const keys = Array.from({ length: ls.length }, (_, i) => ls.key(i)).filter((k): k is string => !!k)
      for (const k of staleGuidedKeys(keys, session.date ?? '')) ls.removeItem(k)
    } catch { /* blocked */ }
  }, [store, session.date])

  // The clock: one tick a quarter-second while anything counts.
  const [t, setT] = useState(now())
  const running = state.endedAt == null
  useEffect(() => { if (!running) return; const id = setInterval(() => setT(now()), 250); return () => clearInterval(id) }, [now, running])
  useWakeLock(state.endedAt == null)

  // STRENGTH-GUIDED-DEVICE-01 — the contents sheet. Founder, from a real gym session: "I
  // can't always get access to machines in the order you prescribe, so you can't move forward
  // and back or see what they are without quitting."
  const [contentsOpen, setContentsOpen] = useState(false)

  const go = (a: GuidedAction) => {
    if (a.type === 'back' && guidedReduce(state, steps, a, now()) == null) { onExit(); return }
    dispatch(a)
  }

  if (state.endedAt != null) return <EndPage state={state} steps={steps} parts={parts} title={title} lifts={lifts} onFinish={onFinish} onExit={onExit} onDone={() => { try { store?.removeItem(key) } catch { /* */ } }} />

  const step = steps[state.step]
  const part = parts[step.part]
  const n = training.indexOf(part)
  const name = partTitle(part, n >= 0 ? n + 1 : null)

  return (
    <div data-guided style={{ minHeight: '100%', background: 'var(--bg)', display: 'flex', flexDirection: 'column', fontFamily: FONT }}>
      {/* The top band: End session, the clock, the progress strip. Its own band, not PinnedBackHeader: ruling F puts
          Back at the bottom and End session here, so there is no back arrow to pin (declared in screenHeaderPinned). */}
      <div className="pinned-chrome" style={{ padding: 'var(--space-3) 16px var(--space-2)', zIndex: Z_LAYERS.screenHeader }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Button variant="ghost" size="compact" onClick={() => go({ type: 'end' })}>{COPY.end}</Button>
          <Button data-guided-contents variant="secondary" size="compact" onClick={() => setContentsOpen(true)}
            aria-label={COPY.contentsLabel}>{COPY.contentsAt(trainingIndexOf(steps, parts, training, state.step), training.length)}</Button>
          <span data-guided-elapsed style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums' }}>
            {formatClockTime((t - state.startedAt) / 1000)}
          </span>
        </div>
        <Progress parts={parts} at={step.part} />
      </div>

      {/* STRENGTH-GUIDED-DEVICE-01 (Design Board 2026-11-04) — ONE PAGE PER ROUND, AND REST
          LIVES ON IT. Rest used to be its own step and therefore its own page, so resting took
          the runner off the lift they were doing and onto a page holding a number. Silvanto:
          "rest is not a step; it is the state between two steps". The part heading and the
          prescription stay put and the countdown appears below them. */}
      <div style={{ flex: 1, padding: '0 16px var(--space-5)' }}>
        <div style={{ ...MICRO_LABELS.sectionLabel, color: 'var(--ink-2)', marginTop: 'var(--space-4)' }}>{name}</div>
        <WorkPage part={part} step={step} state={state} t={t} lifts={lifts} go={go} />
        {state.restEndsAt != null && <RestBand state={state} t={t} go={go} />}
        {steps[state.step + 1] && (
          <p data-guided-next style={{ margin: 'var(--space-4) 0 0', fontSize: '14px', color: 'var(--mute)', lineHeight: 1.5 }}>
            {guidedNextLine(parts[steps[state.step + 1]!.part], steps[state.step + 1]!.round,
              partTitle(parts[steps[state.step + 1]!.part], training.indexOf(parts[steps[state.step + 1]!.part]) >= 0 ? training.indexOf(parts[steps[state.step + 1]!.part]) + 1 : null))}
          </p>
        )}
      </div>

      {/* Back and the next step at the bottom, where a thumb reaches (Wroblewski). */}
      {/* Sticky at the BOTTOM: not `.pinned-chrome`, whose `top: 0` pins to the top (found by screenHeaderPinned). */}
      <div style={{ position: 'sticky', bottom: 0, zIndex: Z_LAYERS.screenHeader, display: 'flex', gap: 'var(--space-2)', padding: 'var(--space-3) 16px calc(var(--space-3) + env(safe-area-inset-bottom))', background: 'var(--bg)', borderTop: '1px solid var(--line)' }}>
        <Button variant="secondary" onClick={() => go({ type: 'back' })}>{COPY.back}</Button>
        <div style={{ flex: 1 }}>
          <Button variant="primary" fullWidth onClick={() => go({ type: 'next' })}>
            {state.restEndsAt != null
              ? COPY.startNext(nextLabel(steps[state.step + 1], parts, training))
              : COPY.roundDone(step.round, step.restAfter_s > 0)}
          </Button>
        </div>
      </div>

      {contentsOpen && (
        <ContentsSheet steps={steps} parts={parts} training={training} at={state.step}
          onJump={i => { setContentsOpen(false); go({ type: 'jump', step: i }) }}
          onClose={() => setContentsOpen(false)} />
      )}
    </div>
  )
}

/**
 * STRENGTH-GUIDED-DEVICE-01 — every part, where the runner is, and a tap to any of them.
 *
 * ⚠️ BUILT ON `Sheet`, NOT HAND-ROLLED. The first cut of this wrote its own scrim, panel and
 * close bar, and **six ratchets caught it at once**: the type scale (a new size entered the
 * app), `buttonSizeScope`, `scrollNative`, `stickyScroller` and the geometry baseline. Every
 * one of those was telling me the same thing — `components/shared/Sheet.tsx` already exists,
 * carries the drag pill, the nav-aware height, the animated close and the required
 * `ariaLabel`, and is the documented answer to "no popups, use a slide-up sheet".
 *
 * One row per PART, landing on that part's FIRST round: the runner is picking a machine, not
 * a set. Rows are real `<button>`s — a div with `onClick` is skipped by Tab, and a sheet you
 * cannot reach by keyboard is a sheet you cannot leave.
 */
function ContentsSheet({ steps, parts, training, at, onJump, onClose }: {
  steps: GuidedStep[]; parts: SessionPart[]; training: SessionPart[]; at: number
  onJump: (step: number) => void; onClose: () => void
}) {
  const firstRound = new Map<number, number>()
  steps.forEach((st, i) => { if (!firstRound.has(st.part)) firstRound.set(st.part, i) })
  const here = steps[at]?.part
  return (
    <Sheet onClose={onClose} ariaLabel={COPY.contentsLabel}>
      {(close) => (
        <div data-guided-contents-sheet style={{ padding: '4px 20px var(--space-5)' }}>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: '20px', fontWeight: 700, color: 'var(--ink)' }}>
            {COPY.contentsLabel}
          </div>
          <p style={{ margin: 'var(--space-1) 0 var(--space-4)', fontFamily: FONT, fontSize: '14px', color: 'var(--mute)' }}>
            {COPY.contentsHint}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {Array.from(firstRound.entries()).map(([partIdx, stepIdx]) => {
              const p = parts[partIdx]
              const n = training.indexOf(p)
              const current = partIdx === here
              return (
                <button key={partIdx} type="button" data-contents-row
                  onClick={() => { onJump(stepIdx); close() }}
                  aria-current={current ? 'step' : undefined}
                  style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', width: '100%', minHeight: `${TAP_TARGET_MIN_PX}px`, padding: 'var(--space-3)', textAlign: 'left', fontFamily: FONT, background: 'var(--card)', border: current ? '2px solid var(--moss)' : '1px solid var(--line)', borderRadius: '12px', cursor: 'pointer' }}>
                  <span style={{ flex: 1, fontSize: '15px', fontWeight: current ? 700 : 400, color: 'var(--ink)' }}>
                    {partTitle(p, n >= 0 ? n + 1 : null)}
                  </span>
                  <span style={{ fontSize: '14px', color: 'var(--mute)' }}>{p.rounds > 1 ? `${p.rounds} rounds` : '1 round'}</span>
                </button>
              )
            })}
          </div>
          <Button variant="secondary" fullWidth onClick={close} style={{ marginTop: 'var(--space-5)' }}>{COPY.contentsClose}</Button>
        </div>
      )}
    </Sheet>
  )
}

/** Which TRAINING part the runner is on, 1-based; 0 while in the warm-up. */
function trainingIndexOf(steps: GuidedStep[], parts: SessionPart[], training: SessionPart[], at: number): number {
  const p = parts[steps[at]?.part]
  return p ? training.indexOf(p) + 1 : 0
}

function nextLabel(next: GuidedStep | undefined, parts: SessionPart[], training: SessionPart[]): { round: number; part: number | null } {
  if (!next) return { round: 1, part: null }
  const i = training.indexOf(parts[next.part])
  return { round: next.round, part: i >= 0 ? i + 1 : null }
}

/** One segment per part; the current one is filled half (Design Board F: a progress strip). */
function Progress({ parts, at }: { parts: SessionPart[]; at: number }) {
  return (
    <div aria-hidden style={{ display: 'flex', gap: '4px', marginTop: 'var(--space-2)' }}>
      {parts.map((p, i) => (
        <span key={i} style={{ flex: 1, height: '4px', borderRadius: '2px', background: i < at ? ACCENT : i === at ? `color-mix(in srgb, ${ACCENT} 45%, var(--line))` : 'var(--line)' }} />
      ))}
    </div>
  )
}

function WorkPage({ part, step, state, t, lifts, go }: { part: SessionPart; step: Extract<GuidedStep, { kind: 'work' }>; state: GuidedState; t: number; lifts?: StrengthGuidedSessionProps['lifts']; go: (a: GuidedAction) => void }) {
  const line = guidedPartLine(part)
  return (
    <>
      <h1 style={{ margin: 'var(--space-1) 0 0', fontSize: '26px', fontWeight: 800, color: 'var(--ink)', lineHeight: 1.15 }}>{COPY.rounds(step.round, part.rounds)}</h1>
      {line && <p style={{ margin: 'var(--space-2) 0 0', fontSize: '14px', color: 'var(--ink-2)', lineHeight: 1.5 }}>{line}</p>}
      <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '12px', marginTop: 'var(--space-4)', overflow: 'hidden' }}>
        {/* A move with fewer sets than the part's rounds (1,580 measured pairs) is done in its first rounds only. */}
        {part.items.filter(item => item.sets >= step.round).map((item, i) => {
          const linked = part.kind === 'superset' && i > 0
          const main = item.role === 'main'
          const loaded = main && isLoadedLift(item.exercise_id)
          const suggestion = main && lifts ? liftSuggestionLine(lifts.suggestions[item.exercise_id], item.reps, lifts.units) : null
          const timerKey = `${state.step}:${item.exercise_id}`
          const left = secondsLeft(state.timers[timerKey] ?? null, t)
          // A set's dose is one round's: the rounds are the headline.
          const dose = partDose({ ...item, sets: part.rounds }, part.rounds)
          return (
            <div key={`${item.exercise_id}-${i}`} data-guided-move style={{ padding: '12px 14px', borderTop: i === 0 || linked ? undefined : '1px solid var(--line)' }}>
              {linked && (
                <div data-superset-link style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '12px', color: 'var(--mute)', marginBottom: 'var(--space-2)' }}>
                  <span aria-hidden style={{ display: 'inline-flex' }}><Glyph name="link" /></span>{STRENGTH_SUPERSET_LINK}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-3)' }}>
                <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)' }}>{exerciseName(item.exercise_id)}</span>
                <span style={{ fontSize: '17px', fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{dose}</span>
              </div>
              {suggestion && <div data-lift-suggestion style={{ fontSize: '12px', color: 'var(--ink-2)', marginTop: '3px', fontVariantNumeric: 'tabular-nums' }}>{suggestion}</div>}
              {loaded && lifts && <WeightStepper exerciseId={item.exercise_id} kg={state.weights[item.exercise_id] ?? null} units={lifts.units} onChange={kg => go({ type: 'setWeight', exerciseId: item.exercise_id, kg })} />}
              {item.seconds != null && (
                <div style={{ marginTop: 'var(--space-2)' }}>
                  <Button variant="soft" size="compact" data-guided-timer onClick={() => go({ type: 'toggleTimer', exerciseId: item.exercise_id, seconds: item.seconds! })}>
                    {left > 0 ? formatClockTime(left) : COPY.timer(item.seconds)}
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

/** − / the number / +. The number opens the keypad; the buttons move by the lift's own step (S14). */
function WeightStepper({ exerciseId, kg, units, onChange }: { exerciseId: string; kg: number | null; units: 'km' | 'mi'; onChange: (kg: number) => void }) {
  const step = STRENGTH_GUIDED.stepKg(exerciseId)
  const [typing, setTyping] = useState(false)
  const [text, setText] = useState('')
  const shown = formatWeight(kg, units)?.split(' ')[0] ?? '–'
  const commit = () => { const v = Number(text.replace(',', '.')); if (Number.isFinite(v) && v > 0) onChange(weightToKg(v, units)); setTyping(false) }
  return (
    <div data-weight-stepper style={{ marginTop: 'var(--space-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <Button variant="soft" size="compact" aria-label="Lighter" onClick={() => kg != null && kg - step > 0 && onChange(Math.round((kg - step) * 100) / 100)} disabled={kg == null || kg - step <= 0}>−</Button>
        {typing ? (
          <input autoFocus inputMode="decimal" aria-label="Weight" value={text} onChange={e => setText(e.target.value)} onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') commit() }}
            style={{ width: '88px', minHeight: TAP_TARGET_MIN_PX, textAlign: 'center', fontFamily: FONT, fontSize: '20px', fontWeight: 800, border: '1px solid var(--line)', borderRadius: '10px', background: 'var(--bg-soft)', color: 'var(--ink)' }} />
        ) : (
          <button type="button" aria-label="Type the weight" onClick={() => { setText(kg != null ? shown : ''); setTyping(true) }}
            style={{ minWidth: '88px', minHeight: TAP_TARGET_MIN_PX, border: 0, background: 'transparent', cursor: 'pointer', fontFamily: FONT, color: 'var(--ink)' }}>
            <span style={{ fontSize: '20px', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{shown}</span>
            <span style={{ fontSize: '12px', color: 'var(--ink-2)', marginLeft: '4px' }}>{weightUnit(units)}</span>
          </button>
        )}
        <Button variant="soft" size="compact" aria-label="Heavier" onClick={() => onChange(Math.round(((kg ?? 0) + step) * 100) / 100)}>+</Button>
      </div>
      <div style={{ fontSize: '11px', color: 'var(--mute)', marginTop: '4px' }}>{COPY.stepperHint(formatWeight(step, units)!)}</div>
    </div>
  )
}

/**
 * STRENGTH-GUIDED-DEVICE-01 — the rest BAND. Was `RestPage`, a whole screen of its own for a
 * countdown and two controls. It is now a card inside the part, so the lift, its dose and the
 * round counter never leave the screen while the runner rests.
 *
 * The clock is **26px**, down from the 56px it was: on its own page it was the only thing there,
 * and in place it must not out-shout the prescription above it. 26 and not 32, because the app
 * type scale is a CLOSED SET (`appTypeScale.test.ts`: 10/11/12/14/15/17/20/26/44/56) and 32 is
 * not in it — the gate caught that, which is what it is for.
 */
function RestBand({ state, t, go }: { state: GuidedState; t: number; go: (a: GuidedAction) => void }) {
  const left = secondsLeft(state.restEndsAt, t)
  return (
    <div data-guided-rest style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginTop: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '12px' }}>
      <div>
        <div style={{ ...MICRO_LABELS.sectionLabel, color: 'var(--mute)' }}>Resting</div>
        <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
          {formatClockTime(left)}
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <Button variant="secondary" fullWidth onClick={() => go({ type: 'extendRest' })}>{COPY.extendRest}</Button>
        <Button variant="secondary" fullWidth onClick={() => go({ type: 'skipRest' })}>{COPY.skipRest}</Button>
      </div>
    </div>
  )
}

function EndPage({ state, steps, parts, title, lifts, onFinish, onDone, onExit }: { state: GuidedState; steps: GuidedStep[]; parts: SessionPart[]; title: string; lifts?: StrengthGuidedSessionProps['lifts']; onFinish: StrengthGuidedSessionProps['onFinish']; onDone: () => void; onExit: () => void }) {
  const tally = guidedTally(state, steps, parts)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const done = useRef(false)
  const mains = parts.flatMap(p => p.items).filter(i => i.role === 'main')
  async function finish() {
    if (done.current) return
    setBusy(true); setFailed(false)
    const ok = await onFinish({ started_at: new Date(state.startedAt).toISOString(), ended_at: new Date(state.endedAt!).toISOString() })
    setBusy(false)
    if (ok) { done.current = true; onDone() } else setFailed(true)
  }
  return (
    <div data-guided-end style={{ minHeight: '100%', background: 'var(--bg)', padding: 'var(--space-5) 16px var(--space-6)', fontFamily: FONT }}>
      <div style={{ ...MICRO_LABELS.sectionLabel, color: 'var(--ink-2)' }}>{`${title} · ${COPY.done.toLowerCase()}`}</div>
      <h1 style={{ margin: 'var(--space-1) 0 0', fontSize: '26px', fontWeight: 800, color: 'var(--ink)' }}>{COPY.minutes(tally.minutes)}</h1>
      <p style={{ margin: 'var(--space-2) 0 0', fontSize: '14px', color: 'var(--ink-2)', lineHeight: 1.5 }}>
        {COPY.tally(tally.parts, tally.rounds)}{mains.length && lifts?.onLog ? ` ${COPY.feelAsk}` : ''}
      </p>
      {lifts?.onLog && mains.length > 0 && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '12px', marginTop: 'var(--space-4)', overflow: 'hidden' }}>
          {mains.map((item, i) => {
            const kg = state.weights[item.exercise_id]
            const suggestion = lifts.suggestions[item.exercise_id]
            // The weight the runner set on the stepper is what they lifted: it prefills the log.
            const logging: LiftLogging = {
              suggestion: suggestion && kg != null ? { ...suggestion, load_kg: kg } : suggestion,
              today: lifts.today[item.exercise_id] && kg != null ? { ...lifts.today[item.exercise_id], load_kg: kg } : lifts.today[item.exercise_id],
              units: lifts.units, onLog: lifts.onLog,
            }
            return (
              <div key={item.exercise_id} data-guided-log style={{ borderTop: i === 0 ? undefined : '1px solid var(--line)', paddingTop: 'var(--space-3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 13px var(--space-2)', fontSize: '15px' }}>
                  <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{exerciseName(item.exercise_id)}</span>
                  {!isLoadedLift(item.exercise_id) && <span style={{ fontSize: '14px', color: 'var(--ink-2)' }}>{COPY.bodyweight}</span>}
                </div>
                <LiftLogPanel item={item} logging={logging} />
              </div>
            )
          })}
        </div>
      )}
      {lifts?.onLog && mains.length > 0 && <p style={{ margin: 'var(--space-2) 0 0', fontSize: '12px', color: 'var(--mute)' }}>{COPY.logNote}</p>}
      <div style={{ marginTop: 'var(--space-5)' }}>
        <Button variant="primary" fullWidth busy={busy} onClick={() => void finish()}>{COPY.done}</Button>
        {failed && <InlineError style={{ marginTop: 'var(--space-2)' }}>{PLAN_CHANGE_SAVE_FAILED}</InlineError>}
        {/* An exit that is not Done: the end page stays for today, and the overview can still mark the session. */}
        <Button variant="quiet" fullWidth onClick={onExit} disabled={busy} style={{ marginTop: 'var(--space-2)' }}>{COPY.back}</Button>
      </div>
    </div>
  )
}
