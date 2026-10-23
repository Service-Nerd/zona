import { GENERATION_CONFIG } from './generationConfig'
import type { Session } from '@/types/plan'

/**
 * How far is this session? — the single owner (SESSION-KM-01).
 *
 * A Zonna session is anchored EITHER by distance OR by duration. Beginners get
 * duration-anchored plans: `duration_mins` set, `distance_km` null. The engine
 * has always known this — `sumWeeklyKm` reads
 * `distance_km ?? duration_mins / minPerKmEasy` — but that expression was
 * written out by hand in six places, and a SECOND, incompatible answer to the
 * same question, `distance_km ?? 0`, was written out in fourteen more.
 *
 * `?? 0` is not a safe default here. It is the assertion "this session covered
 * no ground", and on a duration-anchored plan it is wrong for EVERY session.
 * Measured consequences found on 2026-09-11, all from that one expression:
 *
 *   · §24's peak long-run floor read 0 km for a 2h12 long run, so `lrFails` was
 *     unconditionally true and **33.3% of all HM/marathon time-target plans
 *     (45 of 135) were forced to `volume_profile: 'maintenance'` on a false
 *     premise** — and told the runner "Peak long run 0 km is below the 17.9 km
 *     floor".
 *   · The `cohort:shape` harness understated mean delivered peak by 30%
 *     (30.13 against the true 39.26) on its first cut.
 *   · A measurement concluded a `current_weekly_km: 0` runner gets an empty
 *     week 1. They do not; the week was duration-anchored.
 *
 * Three separate defects, one missing owner. Hence this module.
 *
 * `easyMinPerKm` is supplied by the caller because the two consumers hold it
 * differently: the engine has a `PaceGuide` (`pace.minPerKmEasy`), and the
 * validator derives it from `plan.meta.vdot`. Callers that genuinely have no
 * pace must pass `null` and get `null` back — **not 0**, so "unknown" cannot be
 * silently read as "zero" a fourth time.
 */

/** Session types that cover no ground even when they carry a duration. */
const NON_RUNNING = new Set(['strength', 'rest'])

export function sessionKm(
  session: Pick<Session, 'type' | 'distance_km' | 'duration_mins'> | null | undefined,
  easyMinPerKm: number | null | undefined,
): number | null {
  if (!session) return 0
  if (session.type && NON_RUNNING.has(session.type)) return 0
  if (session.distance_km != null && Number.isFinite(session.distance_km)) return session.distance_km
  const mins = session.duration_mins
  if (mins == null || !Number.isFinite(mins) || mins <= 0) return 0
  if (easyMinPerKm == null || !Number.isFinite(easyMinPerKm) || easyMinPerKm <= 0) return null
  return mins / easyMinPerKm
}

/**
 * The same question, for a caller that must have a number. Returns 0 only when
 * the session genuinely covers no ground — never as a stand-in for "no pace".
 */
export function sessionKmOrZero(
  session: Pick<Session, 'type' | 'distance_km' | 'duration_mins'> | null | undefined,
  easyMinPerKm: number | null | undefined,
): number {
  return sessionKm(session, easyMinPerKm) ?? 0
}

/**
 * Midpoint of a pace band like "6:30–7:00 /km", in minutes per km.
 *
 * A second copy of this parse already lives in `invariants.ts`. It stays there
 * (it is used for pace checks that have nothing to do with distance); this one
 * exists so `sessionKmSelfPaced` below can be the SINGLE place that turns a
 * duration-anchored session into kilometres, rather than three call sites each
 * doing their own parse-and-divide.
 */
export function paceBandMidpointMinPerKm(band: string | null | undefined): number | null {
  if (!band) return null
  const range = band.match(/^(\d+):(\d+)\s*[–-]\s*(\d+):(\d+)/)
  if (range) {
    const fast = parseInt(range[1]!, 10) + parseInt(range[2]!, 10) / 60
    const slow = parseInt(range[3]!, 10) + parseInt(range[4]!, 10) / 60
    return (fast + slow) / 2
  }
  const single = band.match(/^(\d+):(\d+)/)
  if (!single) return null
  return parseInt(single[1]!, 10) + parseInt(single[2]!, 10) / 60
}

/**
 * How far did this session cover, using the session's OWN prescribed pace band.
 *
 * For any consumer that has a `Session` but no `PaceGuide` — the validator, the
 * cohort-shape harness, the reshape-magnitude classifier. The session's own band
 * is a better conversion than a plan-level easy pace anyway: a long run with a
 * race-pace segment is not run at easy pace.
 *
 * Returns `null` when the session is duration-anchored AND carries no pace to
 * convert with, so the caller decides between skipping the check and defaulting.
 * Never silently zero.
 */
export function sessionKmSelfPaced(
  session: (Pick<Session, 'type' | 'distance_km' | 'duration_mins'> & { pace_target?: string | null; derived_set?: Session['derived_set'] }) | null | undefined,
  easyMinPerKm?: number | null,
): number | null {
  if (!session) return 0
  if (session.distance_km != null) return session.distance_km
  const stepped = structuredKm(session, easyMinPerKm)
  if (stepped != null) return stepped
  return sessionKm(session, paceBandMidpointMinPerKm(session.pace_target))
}

/**
 * SESSION-KM-STRUCTURED-PACE-01 (2026-10-23) — a duration-anchored session with a structured main set, priced from
 * its steps. Converting the WHOLE duration at the headline `pace_target` priced the warm-up, cool-down and every jog
 * at work pace: a 34-minute goal-pace reps session read ~7 km. Measured on 5,664 cohort plans: 6,407 such quality
 * sessions, read a median 41% (max 65%) longer than at easy pace, every one on a duration-anchored plan. The engine
 * itself sizes them at easy pace (`sumWeeklyKm`), which is short the other way; this is the figure between them.
 *
 * Each step at its own pace; distance steps at their distance; the rest of the session (warm-up and cool-down) at
 * easy pace, taken from the caller or else from the session's own easy-anchored step (a jog ceiling, or the easy
 * ramp of a progression). Returns null, and the caller keeps the headline-pace answer, when any step cannot be sized
 * (a landmark or open length) or no easy pace is available: a continuous tempo called without one.
 */
function structuredKm(
  session: { duration_mins?: number | null; derived_set?: Session['derived_set'] },
  easyMinPerKm: number | null | undefined,
): number | null {
  const set = session.derived_set
  const mins = session.duration_mins
  if (!set?.blocks?.length || mins == null || !(mins > 0)) return null
  const steps = set.blocks.flatMap(b => b.steps)
  const easy = (easyMinPerKm != null && easyMinPerKm > 0 ? easyMinPerKm : null)
    ?? paceBandMidpointMinPerKm(steps.find(st => st.pace_mode === 'ceiling' && st.pace)?.pace ?? null)
  if (easy == null) return null
  let km = 0, secs = 0
  for (const block of set.blocks) {
    const reps = typeof block.repeat === 'number' && block.repeat > 0 ? block.repeat : 1
    for (const st of block.steps) {
      const pace = paceBandMidpointMinPerKm(st.pace) ?? easy
      const len = stepLength(st.length)
      if (!len) return null
      const stepKm = len.km ?? len.secs! / 60 / pace
      const stepSecs = len.secs ?? len.km! * pace * 60
      km += stepKm * reps
      secs += stepSecs * reps
    }
  }
  const restSecs = mins * 60 - secs
  // A main set longer than the session it sits in is a data fault, not a sizing question; keep the old answer.
  if (restSecs < -60) return null
  return km + Math.max(0, restSecs) / 60 / easy
}

/** The easy pace of a set of sessions (a week), from its first easy run that states one, for a caller that holds the
 *  week and wants a structured session's warm-up priced at easy pace. Null when the week has no easy run with a pace. */
export function weekEasyMinPerKm(sessions: ReadonlyArray<{ type?: string; pace_target?: string | null; derived_set?: unknown } | null | undefined>): number | null {
  const easy = sessions.find(s => s?.type === 'easy' && s.pace_target && !s.derived_set)
  return paceBandMidpointMinPerKm(easy?.pace_target ?? null)
}

/** A derived step's length in seconds or kilometres, or null for a length that is not a size ("to the top"). */
function stepLength(len: string): { secs?: number; km?: number } | null {
  let m = /^(\d+(?:\.\d+)?)\s*min\b/.exec(len)
  if (m) return { secs: Number(m[1]) * 60 }
  m = /^(\d+):(\d{2})$/.exec(len)
  if (m) return { secs: Number(m[1]) * 60 + Number(m[2]) }
  m = /^(\d+(?:\.\d+)?)\s*s(ec)?\b/.exec(len)
  if (m) return { secs: Number(m[1]) }
  m = /^(\d+(?:\.\d+)?)\s*km\b/.exec(len)
  if (m) return { km: Number(m[1]) }
  m = /^(\d+(?:\.\d+)?)\s*m\b/.exec(len)
  if (m) return { km: Number(m[1]) / 1000 }
  return null
}

/**
 * Round a distance to `GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM`.
 *
 * ⚠️ MOVED HERE FROM `ruleEngine`, where it was private, so the INVARIANT LAYER
 * can round the way the producer rounds. §125's size check asks whether any
 * admissible dose prices the stored distance, and "prices" means *rounds to* —
 * a second copy of this expression in the checker would be the "checker reads a
 * different source from the producer" class, which this repo has recorded three
 * times in one day. `invariants` cannot import `ruleEngine` (that is the cycle),
 * so the shared helper lives with the other distance questions.
 */
export function roundDistance(distKm: number): number {
  const p = GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM
  return Math.round(distKm / p) * p
}
