// §28 + §28 Amendment 1 — the single owner of "which run carries this week's
// neuromuscular stimulus, and what does it say?"
//
// WHY THIS MODULE EXISTS. `INV-PLAN-BEGINNER-NEUROMUSCULAR` has to know whether
// a plan COULD have carried strides before it can fault a plan for not carrying
// them. The first cut re-implemented that eligibility inside the invariant —
// "is there an easy run that is not the long run or a shakeout" — and it was
// wrong in a way the cohort grid could not see and the property sweep could:
// **12 cases, every one a 2-day plan.** §28 also requires the day to be in
// `STRIDE_PREFERRED_DAYS` (which excludes Saturday and Sunday) and not blocked
// by the day-before-long-run or day-after-quality rules. A two-day runner on
// Saturday and Sunday has an eligible easy run by the invariant's reading and
// no carrier by §28's.
//
// A checker re-deriving the producer's predicate is this repo's most repeated
// defect class (deloadCadence, supersedeCoverage, tierResolution). So the
// predicate lives here and BOTH sides call it.

import type { Session, Week } from '@/types/plan'
import type { Day } from './days'
import { GENERATION_CONFIG } from './generationConfig'
import { isLongRun, isShakeout } from './sessionRole'

/** DAY_ORDER-aligned. Sat and Sun are absent on purpose: Sunday is the long run
 *  for most runners and Saturday is the day before it. */
export const STRIDE_PREFERRED_DAYS: readonly Day[] = ['wed', 'tue', 'thu', 'mon', 'fri']

const DAYS: readonly Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

/**
 * The day that carries this week's stride/hill note, or `null` when the week
 * cannot carry one.
 *
 * `null` is a legitimate, common answer — see the 2-day case above. §34: the
 * gap is recorded, not enforced.
 */
export function strideCarrierDay(
  sessions: Partial<Record<Day, Session | undefined>>,
  longDay: Day,
  blocked: ReadonlySet<Day>,
): Day | null {
  const blockedFromStrides = new Set<Day>()
  // Not the day before the long run (heavy legs)...
  blockedFromStrides.add(DAYS[(DAYS.indexOf(longDay) - 1 + 7) % 7]!)
  // ...nor the day after a quality session (recovery day).
  for (const d of DAYS) {
    if (sessions[d]?.type === 'quality') {
      blockedFromStrides.add(DAYS[(DAYS.indexOf(d) + 1) % 7]!)
    }
  }
  for (const d of STRIDE_PREFERRED_DAYS) {
    if (blocked.has(d) || blockedFromStrides.has(d)) continue
    const s = sessions[d]
    if (!s || s.type !== 'easy') continue
    if (isLongRun(s) || isShakeout(s)) continue
    return d
  }
  return null
}

/**
 * §28 Am.1 — for a BEGINNER, every Nth stride week becomes a hill-stride week.
 *
 * ⚠️ ALTERNATES, NEVER ADDS. On a hill week the stride run BECOMES the hill
 * run. A hill run alongside the stride run would double the weekly
 * neuromuscular dose; the board authorised hills "dosed like §28's strides".
 */
export function isHillStrideWeek(weekN: number, fitnessLevel: string | undefined): boolean {
  if (fitnessLevel !== 'beginner') return false
  return (weekN - GENERATION_CONFIG.STRIDES_FIRST_WEEK)
    % GENERATION_CONFIG.BEGINNER_HILL_STRIDE_EVERY_N_WEEKS === 0
}

export function neuromuscularNote(weekN: number, fitnessLevel: string | undefined): string {
  return isHillStrideWeek(weekN, fitnessLevel)
    ? '6×10s hill strides up a moderate gradient, walk back down. Not a hard session: short, fast, then recover fully.'
    : '4×20s strides at 5K effort, full recovery between.'
}

/** Does any session in this week carry the note? Used by the invariant. */
export function weekHasNeuromuscular(w: Week): boolean {
  return Object.values(w.sessions).some(s =>
    (s as Session | undefined)?.coach_notes?.some(n => typeof n === 'string' && /strides/i.test(n)) ?? false)
}
