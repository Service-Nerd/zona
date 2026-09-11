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
  session: (Pick<Session, 'type' | 'distance_km' | 'duration_mins'> & { pace_target?: string | null }) | null | undefined,
): number | null {
  if (!session) return 0
  if (session.distance_km != null) return session.distance_km
  return sessionKm(session, paceBandMidpointMinPerKm(session.pace_target))
}
