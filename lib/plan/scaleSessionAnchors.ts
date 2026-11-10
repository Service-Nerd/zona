/**
 * SCALE-SESSION-OWNER-01 (2026-11-10) — the single owner of "make this session a factor
 * smaller, whichever way it is measured".
 *
 * 🔴 WHY IT EXISTS. There were THREE copies of this, and each carried a different subset of
 * the same four defects:
 *
 * | site | inert on duration | duration left stale | floor |
 * |---|---|---|---|
 * | `taperRecalibration.scaleSession` | yes, until 2026-11-10 | **yes, on the distance path** | runner-resolved |
 * | `postRaceReshape.scaleSession` | **yes** | **yes** | **hardcoded `3`** |
 * | `planAdjustment` readiness ease | yes, until 2026-11-10 | yes, until 2026-11-10 | none, by design |
 *
 * The `3` is the `MIN_SESSION_DISTANCE_KM` bypass that `TAPER-FLOOR-FLAT-01` fixed in the taper
 * on 2026-09-19 and nobody carried across. **This is `SESSION-KM-01/02`'s shape exactly** — one
 * expression written out by hand in several places, agreeing only by accident — and the fix is
 * the ordinary one: one owner, and the differences become arguments.
 *
 * 🔑 ONE FLOOR, IN KM, APPLIED AS A UNIT-FREE RATIO. `sessionKmSelfPaced` owns "how far is this
 * session" and prices a duration-anchored one through its own pace and structured steps. It is
 * **never inverted** — that mapping is one-way — so the floor is resolved in km and the
 * resulting ratio is applied to whichever anchors the session carries.
 *
 * ⚠️ BOTH ANCHORS MOVE TOGETHER WHEN BOTH ARE PRESENT. The engine derives duration FROM
 * distance (`distance × easy pace`), so cutting one and leaving the other produces a session
 * describing itself two ways at once — measured on the readiness ease as **71% of eased long
 * runs** before that site was fixed.
 *
 * ⚠️ A SESSION WITH NO PRICE IS RETURNED UNCHANGED **WHEN A FLOOR MUST BE HONOURED**, never
 * scaled on a guess: `sessionKmSelfPaced` returns null with no pace to convert with, and `?? 0`
 * there would assert the session covered no ground — the `SESSION-KM-01/02` trap. Without a
 * floor the scale is pure proportion and needs no price at all; demanding one would refuse to
 * ease a session it could ease perfectly well, which is what wiring the third caller exposed.
 *
 * ⚠️ IT RETURNS THE SAME OBJECT REFERENCE when nothing changes, because two call sites count
 * "did this session move?" by identity (`scaled !== session`).
 */
import { sessionKmSelfPaced } from './sessionDistance'
import type { Session } from '@/types/plan'

export interface ScaleSessionOptions {
  /**
   * Minimum km the session may be scaled to. Resolve it per runner with
   * `sessionFloorsFor(...)`; omit it for an operation that has no floor by design (the
   * readiness ease, which softens a single session by a fixed share).
   *
   * ⚠️ `Math.max(floorKm, …)` can RAISE a session above its original, which every previous
   * copy could also do. Preserved rather than quietly changed: if it is wrong it is wrong for
   * every anchor and every caller, and that is its own ruling.
   */
  floorKm?: number
  /** Rounding step for the km anchor. The taper and post-race paths use 0.5; the readiness ease uses 0.1. */
  kmPrecision?: number
  /** Clear `coach_notes` on a changed session (the AI enricher repopulates). Default false. */
  clearCoachNotes?: boolean
}

export function scaleSessionAnchors(
  session: Session,
  factor: number,
  opts: ScaleSessionOptions = {},
): Session {
  const { floorKm, kmPrecision = 0.1, clearCoachNotes = false } = opts
  const notes = clearCoachNotes ? { coach_notes: undefined } : {}

  if (session.distance_km != null) {
    const step = 1 / kmPrecision
    const scaled = Math.round(session.distance_km * factor * step) / step
    const newKm = floorKm != null ? Math.max(floorKm, scaled) : scaled
    if (newKm === session.distance_km) return session
    // The effective ratio, so a duration carried alongside moves by the same amount the
    // distance actually moved — including when the floor bound it.
    const effective = newKm / session.distance_km
    return {
      ...session,
      distance_km: newKm,
      ...(session.duration_mins != null
        ? { duration_mins: Math.round(session.duration_mins * effective) }
        : {}),
      ...notes,
    }
  }

  if (session.duration_mins != null && session.duration_mins > 0) {
    // 🔑 THE PRICE IS ONLY NEEDED TO HONOUR A FLOOR, and wiring the third caller is what
    // showed it. A fixed-share soften (the readiness ease, no floor by design) is pure
    // proportion: there is no km quantity to compare, so demanding a pace would refuse to ease
    // a session it could have eased perfectly well. With a floor there IS a km comparison, and
    // a session that cannot be priced is returned untouched rather than scaled past the floor.
    let effective = factor
    if (floorKm != null) {
      const km = sessionKmSelfPaced(session)
      if (km == null || !(km > 0)) return session
      effective = Math.max(floorKm, km * factor) / km
    }
    const newMins = Math.round(session.duration_mins * effective)
    if (newMins === session.duration_mins) return session
    return { ...session, duration_mins: newMins, ...notes }
  }

  return session
}

/**
 * Minutes per km the session itself implies, or null when it cannot be priced.
 *
 * 🔴 `postRaceReshape.toRecoveryRun` computed a converted session's duration as
 * `km / (duration_mins / distance_km)`. That is **km² per minute, not minutes**: a 20 km / 140
 * min long run converted to a 3 km recovery run came back as **0.4 minutes**, and the runner
 * was shown "3 km · 0 min". The quantity wanted is `km × minPerKm`.
 */
export function minPerKmOf(session: Session): number | null {
  const km = sessionKmSelfPaced(session)
  if (km == null || !(km > 0) || session.duration_mins == null || !(session.duration_mins > 0)) return null
  return session.duration_mins / km
}
