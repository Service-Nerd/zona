// EASY-PACE-OWNER-01 (2026-10-03, FOUNDATION-BUDGET-01) — "how long does an easy
// kilometre take this runner?", answered in ONE place.
//
// ⚠️ WHY IT IS READ FROM THE PLAN AND NOT RECOMPUTED. The engine already derived this
// runner's easy pace through `buildPaceFromVDOT` and spent it on every easy session it
// placed. Re-deriving it here from VDOT would be a second producer of the same quantity,
// and this repo has paid for that four times over (`DELOAD-OWNER-01`, `TIER-OWNER-01`,
// `SESSION-KM-01/02`, `OPS-AI-OWNER-01`). Worse, a second derivation could disagree with
// the number the runner is actually looking at on their card.
//
// So the pace is read back OUT of the finished plan: distance over duration on a placed
// easy weekday session. That is the engine's own answer, by construction.
import { isLongRun } from './sessionRole'

type PaceReadableSession = {
  type?: string
  duration_mins?: number | null
  distance_km?: number | null
  role?: string | null
  label?: string | null
}
type PaceReadablePlan = { weeks?: Array<{ n: number; sessions?: Record<string, PaceReadableSession | undefined> }> }

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri'] as const

/**
 * Minutes per kilometre at this runner's easy pace, read from the plan's own first
 * duration-AND-distance-bearing weekday easy run.
 *
 * ⚠️ MAIN-PLAN WEEKS ONLY (`n > 0`). Foundation weeks are precisely the weeks whose
 * duration this is used to COMPUTE, so reading one would be circular — and before
 * FOUNDATION-BUDGET-01 they carried no duration at all.
 *
 * ⚠️ Returns `null`, never a fallback. "We do not know this runner's pace" must not read
 * as "this runner runs at some default speed": that is the `?? 0` class, which has
 * produced four measured defects here. A caller that cannot get a pace must decline to
 * act, not guess.
 *
 * The LONG RUN is excluded: §24b/§24d can embed a faster pace segment in it, so its
 * average is not the easy pace.
 */
export function easyPaceFromPlan(plan: PaceReadablePlan | null | undefined): number | null {
  // ⚠️ ALL DAYS, not only weekdays. The first cut searched weekdays only and came back
  // NULL on 26,158 sweep plans, because a session needs BOTH a distance and a duration to
  // yield a pace and plenty of plans are anchored by one or the other (SESSION-KM-01:
  // beginners are 95.8% duration-anchored, with `distance_km` null). A weekend easy run is
  // the same runner at the same easy pace, so excluding it threw away the evidence.
  const ALL_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
  for (const w of plan?.weeks ?? []) {
    if (w.n <= 0) continue
    for (const d of ALL_DAYS) {
      const s = w.sessions?.[d]
      if (!s || s.type !== 'easy') continue
      if (isLongRun(s as Parameters<typeof isLongRun>[0])) continue
      const mins = s.duration_mins
      const km = s.distance_km
      if (mins == null || km == null) continue
      if (!Number.isFinite(mins) || !Number.isFinite(km) || mins <= 0 || km <= 0) continue
      return mins / km
    }
  }
  return null
}

/**
 * This runner's easy TARGETS as the runner sees them — the pace band and the HR
 * ceiling — read from the plan's own first main-week easy session.
 *
 * ⚠️ A SIBLING OF `easyPaceFromPlan`, NOT A SECOND DERIVATION. Same module, same
 * main-weeks-only rule, same refusal to invent a default. That function answers
 * "how many minutes per km" for SIZING; this one answers "what strings does the
 * card show" for DISPLAY. Both read the generated plan rather than recomputing
 * from a VDOT, which is EASY-PACE-OWNER-01's whole point: the number that sized
 * the session and the number the runner reads must be the same one.
 *
 * ⚠️ WHY IT EXISTS. `generateFoundationBlock` built easy sessions with a zone, a
 * distance and a duration and NEVER a `pace_target` or `hr_target` — measured
 * across 33 composed plans, **381 of 381 foundation easy sessions carried
 * neither, against 0 of 1,355 main-plan easy sessions**. So the on-ramp, the
 * three weeks before a plan starts, told the runner "Zone 2, conversational
 * pace" and gave them no number to hold it to, while the identical easy run in
 * week 1 showed both (FOUNDATION-PACE-STRIPPED-01).
 *
 * ⚠️ MAIN-PLAN WEEKS ONLY (`n > 0`), for the same reason as its sibling: the
 * foundation weeks are the ones being built, so reading one is circular.
 *
 * ⚠️ `null` for a field the plan does not carry, never a fallback string. "We do
 * not know this runner's easy pace" must not render as a number they could act
 * on — the `?? 0` class, which has four measured defects here. A caller that
 * gets null must omit the field, exactly as the engine omits it today.
 */
export function easyTargetsFromPlan(
  plan: { weeks?: Array<{ n: number; sessions?: Record<string, {
    type?: string; role?: string; label?: string
    pace_target?: string | null; hr_target?: string | null
  } | undefined> }> } | null | undefined,
): { paceTarget: string | null; hrTarget: string | null } {
  const ALL_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
  for (const w of plan?.weeks ?? []) {
    if (w.n <= 0) continue
    for (const d of ALL_DAYS) {
      const s = w.sessions?.[d]
      if (!s || s.type !== 'easy') continue
      // ⚠️ THE LONG RUN IS NOT EXCLUDED HERE, AND IT IS IN THE SIBLING. There the
      // exclusion matters because a long run's minutes-per-km would misprice a
      // weekday budget; here both carry the SAME easy band and HR ceiling (§12,
      // one easy zone), so skipping it would only narrow the search for nothing.
      const paceTarget = typeof s.pace_target === 'string' && s.pace_target.trim() ? s.pace_target : null
      const hrTarget   = typeof s.hr_target   === 'string' && s.hr_target.trim()   ? s.hr_target   : null
      if (paceTarget || hrTarget) return { paceTarget, hrTarget }
    }
  }
  return { paceTarget: null, hrTarget: null }
}
