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

/**
 * STRENGTH-GUIDED-DEVICE-01 (Design Board 2026-11-04) — REST IS NOT A STEP.
 *
 * It used to be: `{ kind: 'rest' }` was a sibling of `{ kind: 'work' }`, so resting took the
 * runner off the page holding the lift they were doing and onto a page holding a number.
 * Silvanto: *"rest is not a step; it is the state between two steps"*. A step is now always a
 * round of work, and the rest that follows it is `restAfter_s` ON that step, rendered in place.
 *
 * ⚠️ `restAfter_s` is 0 on the session's last round, exactly as the old `!last` guard was: there
 * is nothing to rest before.
 */
export type GuidedStep = { kind: 'work'; part: number; round: number; restAfter_s: number }

export function guidedSteps(parts: SessionPart[]): GuidedStep[] {
  const out: GuidedStep[] = []
  parts.forEach((p, part) => {
    for (let round = 1; round <= p.rounds; round++) {
      const last = part === parts.length - 1 && round === p.rounds
      out.push({ kind: 'work', part, round, restAfter_s: last ? 0 : p.rest_s })
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
  /** Set while the rest countdown is running. */
  restEndsAt: number | null
  /**
   * The step whose rest has already been SERVED — started, then finished or skipped.
   *
   * 🔴 Without it, `skipRest` then `next` restarts the same rest, because both states have
   * `restEndsAt == null` and the reducer cannot tell "not rested yet" from "rest done". That
   * is an infinite loop for the runner, and it is what the round-trip arm in
   * `guidedSession.test.ts` caught before this shipped.
   */
  restedStep: number | null
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
  return { date: session.date ?? '', signature: sessionSignature(session), startedAt: now, step: 0, restEndsAt: null, restedStep: null, weights, timers: {}, endedAt: null }
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
    return { ...s, weights: s.weights ?? {}, timers: s.timers ?? {}, restEndsAt: s.restEndsAt ?? null, restedStep: s.restedStep ?? null, endedAt: s.endedAt ?? null }
  } catch { return null }
}

export type GuidedAction =
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'extendRest' }
  | { type: 'skipRest' }
  | { type: 'setWeight'; exerciseId: string; kg: number }
  | { type: 'toggleTimer'; exerciseId: string; seconds: number }
  /** STRENGTH-GUIDED-DEVICE-01 — the gym does not hand you the machines in our order. */
  | { type: 'jump'; step: number }
  | { type: 'end' }

/** Leaving the first page goes back to the overview: the caller sees `null`, and today's progress is kept. */
export function guidedReduce(s: GuidedState, steps: GuidedStep[], a: GuidedAction, now: number): GuidedState | null {
  const at = (i: number) => ({ ...s, step: i, restEndsAt: null, restedStep: null })
  switch (a.type) {
    // Done with a round: if rest follows, STAY on this step and start resting — the runner never
    // leaves the lift they are doing. The next `next` advances. The last round's done finishes the
    // session: the step moves PAST the end, so every finished round sits before `step`.
    case 'next': {
      const here = steps[s.step]
      if (here && here.restAfter_s > 0 && s.restedStep !== s.step) {
        return { ...s, restEndsAt: now + here.restAfter_s * 1000, restedStep: s.step }
      }
      return s.step + 1 >= steps.length ? { ...s, step: steps.length, restEndsAt: null, endedAt: now } : at(s.step + 1)
    }
    // Skip ends the countdown; it does NOT advance. The runner is back on the work page, ready.
    case 'skipRest': return s.restEndsAt == null ? s : { ...s, restEndsAt: null }   // `restedStep` stays set: the rest is served
    case 'back': return s.step - 1 < 0 ? null : at(s.step - 1)
    // Jump to any round, forward or back. Out of range is ignored rather than clamped: a stale
    // index from a rebuilt session must not silently land somewhere plausible.
    case 'jump': return a.step >= 0 && a.step < steps.length ? at(a.step) : s
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

