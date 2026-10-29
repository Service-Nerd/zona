// STRENGTH-GUIDED-SESSION-01 (Design Board 2026-10-28 F) — the guided session as a pure step model, so the flow is
// tested without a browser (`vitest` runs in node). The screen (`StrengthGuidedSession.tsx`) renders one step at a
// time and owns nothing but the clock.
//
// A step is one ROUND of one part (a work page), or the REST after it. Rest is the part's own `rest_s`, the
// prescription's number (S10), and follows every round except the session's last; a part with no rest (the warm-up,
// "straight through") has no rest steps. Times are stored as END times, never counted down tick by tick, so a phone
// that sleeps or backgrounds the app comes back to the right number.
//
// Rounds live for the session only (Design Board F: "per-set results are held for the session only"); what is kept
// is the progress for the day, on this device, so leaving mid-session and coming back resumes. Client-safe.

import { STRENGTH_CONFIG, PATTERN_REGION, CATALOGUE_BY_ID, type StrengthSession } from '@/packages/strength'
import type { SessionPart } from './sessionParts'

const GUIDED_KEY_PREFIX = 'zona_strength_guided_'

/** Keys for other days: a session started and never finished leaves one, and nothing else would ever remove it. */
export function staleGuidedKeys(keys: readonly string[], today: string): string[] {
  return keys.filter(k => k.startsWith(GUIDED_KEY_PREFIX) && k !== GUIDED_KEY_PREFIX + today)
}

export const STRENGTH_GUIDED = {
  /** "+30 s" on the rest page. */
  REST_EXTEND_S: 30,
  /** The stepper moves a loaded lift by the engine's own step (S14), so the number it lands on is one S14 would offer. */
  stepKg: (exerciseId: string): number => {
    const ex = CATALOGUE_BY_ID.get(exerciseId)
    return ex && PATTERN_REGION[ex.pattern] === 'upper' ? STRENGTH_CONFIG.LOAD_STEP_KG_UPPER : STRENGTH_CONFIG.LOAD_STEP_KG_LOWER
  },
  /** Progress kept on this device for the day (a per-viewer convenience: losing it costs a restart, nothing else). */
  storageKey: (date: string) => `${GUIDED_KEY_PREFIX}${date}`,
}

export type GuidedStep =
  | { kind: 'work'; part: number; round: number }
  | { kind: 'rest'; part: number; round: number; rest_s: number }

export function guidedSteps(parts: SessionPart[]): GuidedStep[] {
  const out: GuidedStep[] = []
  parts.forEach((p, part) => {
    for (let round = 1; round <= p.rounds; round++) {
      out.push({ kind: 'work', part, round })
      const last = part === parts.length - 1 && round === p.rounds
      if (p.rest_s > 0 && !last) out.push({ kind: 'rest', part, round, rest_s: p.rest_s })
    }
  })
  return out
}

export interface GuidedState {
  date: string
  /** Which session this progress belongs to: a rebuilt plan with different lifts starts again. */
  signature: string
  startedAt: number
  step: number
  /** Set while on a rest step. */
  restEndsAt: number | null
  /** The weight on each loaded main lift's stepper, in kg. */
  weights: Record<string, number>
  /** A timed move's countdown, keyed `${step}:${exerciseId}`. */
  timers: Record<string, number>
  /** Set when the runner ends the session (the end page). */
  endedAt: number | null
}

/** Everything the steps are built from: a rebuilt session whose rounds or rests moved is a different session. */
export function sessionSignature(s: Pick<StrengthSession, 'blocks'>): string {
  return s.blocks.flatMap(b => b.items.map(i => `${b.role}:${i.exercise_id}:${i.sets}:${i.rest_s}:${i.superset ?? ''}`)).join('|')
}

export function startGuided(session: StrengthSession, now: number, weights: Record<string, number>): GuidedState {
  return { date: session.date ?? '', signature: sessionSignature(session), startedAt: now, step: 0, restEndsAt: null, weights, timers: {}, endedAt: null }
}

/**
 * Resume today's progress for THIS session, or null (another day, another session, or nothing kept). An ENDED
 * session resumes to its end page, so a phone that locks between End session and Done still lets the lifts be logged;
 * Done clears it.
 */
export function resumeGuided(raw: string | null, session: StrengthSession, stepCount: number): GuidedState | null {
  if (!raw) return null
  try {
    const s = JSON.parse(raw) as GuidedState
    if (s.date !== session.date || s.signature !== sessionSignature(session)) return null
    if (typeof s.startedAt !== 'number' || typeof s.step !== 'number' || s.step < 0) return null
    // Past the last step only once finished; anything else is progress for steps that no longer exist.
    if (s.step > stepCount || (s.step === stepCount && s.endedAt == null)) return null
    return { ...s, weights: s.weights ?? {}, timers: s.timers ?? {}, restEndsAt: s.restEndsAt ?? null, endedAt: s.endedAt ?? null }
  } catch { return null }
}

export type GuidedAction =
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'extendRest' }
  | { type: 'skipRest' }
  | { type: 'setWeight'; exerciseId: string; kg: number }
  | { type: 'toggleTimer'; exerciseId: string; seconds: number }
  | { type: 'end' }

/** Leaving the first page goes back to the overview: the caller sees `null`, and today's progress is kept. */
export function guidedReduce(s: GuidedState, steps: GuidedStep[], a: GuidedAction, now: number): GuidedState | null {
  const at = (i: number) => {
    const step = steps[i]
    return { ...s, step: i, restEndsAt: step?.kind === 'rest' ? now + step.rest_s * 1000 : null }
  }
  switch (a.type) {
    // The last round's done finishes it: the step moves PAST the end, so every finished round sits before `step`.
    case 'next': return s.step + 1 >= steps.length ? { ...s, step: steps.length, restEndsAt: null, endedAt: now } : at(s.step + 1)
    case 'skipRest': return steps[s.step]?.kind === 'rest' ? at(s.step + 1) : s
    // Back steps over a rest: going back is to redo or check a round, not to sit the rest again.
    case 'back': {
      let i = s.step - 1
      while (i >= 0 && steps[i].kind === 'rest') i--
      return i < 0 ? null : { ...s, step: i, restEndsAt: null }
    }
    case 'extendRest': return s.restEndsAt == null ? s : { ...s, restEndsAt: Math.max(s.restEndsAt, now) + STRENGTH_GUIDED.REST_EXTEND_S * 1000 }
    case 'setWeight': return a.kg > 0 ? { ...s, weights: { ...s.weights, [a.exerciseId]: a.kg } } : s
    case 'toggleTimer': {
      const key = `${s.step}:${a.exerciseId}`
      const timers = { ...s.timers }
      if (timers[key] != null && timers[key] > now) delete timers[key]; else timers[key] = now + a.seconds * 1000
      return { ...s, timers }
    }
    case 'end': return { ...s, endedAt: now }
  }
}

/** Seconds left on an end time, never negative. */
export function secondsLeft(endsAt: number | null, now: number): number {
  return endsAt == null ? 0 : Math.max(0, Math.ceil((endsAt - now) / 1000))
}

/** What the end page reports: training parts started and rounds finished (the warm-up and cool-down are not parts). */
export function guidedTally(s: GuidedState, steps: GuidedStep[], parts: SessionPart[]): { minutes: number; parts: number; rounds: number } {
  const training = (i: number) => parts[i].kind !== 'warmup' && parts[i].kind !== 'cooldown'
  // Rounds before the current step are done; a round in progress when End session is tapped is not.
  const done = steps.filter((st, i) => st.kind === 'work' && training(st.part) && i < s.step)
  const end = s.endedAt ?? s.startedAt
  return { minutes: Math.max(1, Math.round((end - s.startedAt) / 60_000)), parts: new Set(done.map(d => d.part)).size, rounds: done.length }
}

