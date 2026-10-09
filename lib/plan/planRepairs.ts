import type { Plan, Session } from '@/types/plan'
import type { Day } from './days'
import type { PaceGuide } from './paceBands'
import { fitnessAnchorMap } from './fitnessAnchorMap'
import { alignDerivedToStructure } from './derivedSetAnchors'
import { qualityHeaderPace } from './qualityHeaderPace'

/**
 * THE FOUR REPAIRS A PLAN DAMAGED BY `RECAL-PACE-TWO-WRITER-01` NEEDS.
 *
 * 🔴 EVERY ONE IS DRIVEN BY THE INVARIANT'S OWN VERDICTS, AND THAT IS NOT A
 * STYLE CHOICE. The first repair written here re-derived its own test — "is this
 * band one the guide produces?" — which is LOOSER than the check, and it would
 * have re-priced two sessions whose steps sat exactly on the runner's GOAL band:
 * §22's deliberate substitution, which the invariant admits by name. **The
 * invariant was right and the fix was wrong.** Taking `violations` as a parameter
 * makes the scope and the remedy the same predicate by construction, so they
 * cannot drift again.
 *
 * ⚠️ PURE AND IN-PLACE. These mutate the plan they are given and touch no I/O, so
 * they are testable without a database — which matters because their only caller
 * writes to live runner data.
 *
 * Measured on the plan that motivated them (`8a2858ab`, a 10K runner who
 * recalibrated DOWN mid-plan): applying all four takes **9 error-severity
 * violations to 1**, and the one that remains is a pre-existing long-run step-back
 * of **0.375 km** — less than a single rounding increment.
 */

/**
 * THE CODES THESE REPAIRS CAN FIX — the population filter and the remedies read
 * the SAME list.
 *
 * ⚠️ THE FIRST VERSION OF THE CALLER SELECTED PLANS BY ONE CODE ONLY, and after
 * that code was fixed on the motivating plan the plan stopped being selected at
 * all — so the remaining 8 of its 9 violations were invisible to the tool written
 * to repair them. "The checker's population excludes the cases at risk", in the
 * repair tool rather than a check. One exported list is the fix.
 */
export const REPAIRABLE_CODES = [
  'INV-PLAN-STEP-PACE-FROM-GUIDE',
  'INV-PLAN-HEADER-PACE-MATCHES-WORK',
  'INV-PLAN-EFFORT-GOVERNED-NOT-GOAL-PACED',
  'INV-PLAN-5K10K-LR-PACE-CAP',
] as const

export interface RepairViolation {
  code: string
  week?: number | null
  day?: string | null
  actual?: unknown
}

/** Every non-rest session in a week, with its day key. */
function sessionsOf(plan: Plan, week: number, day?: string | null): [Day, Session][] {
  const w = plan.weeks.find(x => x.n === week)
  if (!w) return []
  const entries = Object.entries(w.sessions) as [Day, Session | undefined][]
  return entries
    .filter((e): e is [Day, Session] => !!e[1] && e[1].type !== 'rest')
    .filter(e => (day ? e[0] === day : true))
}

const workPacesOf = (s: Session): string[] =>
  (s.derived_set?.blocks ?? []).flatMap(b => b.steps)
    .filter(st => st.role === 'work' && st.pace)
    .map(st => st.pace as string)

/**
 * `INV-PLAN-STEP-PACE-FROM-GUIDE` — a work step priced at a fitness the runner no
 * longer has, re-priced to the band its OWN anchor means now.
 *
 * The anchor comes from the catalogue structure, so no guess is involved: the
 * provenance of the stale value is unrecoverable, the correct value is not.
 */
export function repriceStaleSteps(
  plan: Plan, violations: RepairViolation[], guide: PaceGuide,
): number {
  const anchors = fitnessAnchorMap(guide)
  let n = 0
  for (const v of violations) {
    if (v.code !== 'INV-PLAN-STEP-PACE-FROM-GUIDE' || v.week == null) continue
    const bands = new Set(String(v.actual ?? '').split(',').map(x => x.trim()).filter(Boolean))
    for (const [, s] of sessionsOf(plan, v.week, v.day)) {
      const aligned = alignDerivedToStructure(s)
      if (!aligned) continue
      for (const { derived, structural } of aligned) {
        if (structural.role !== 'work' || structural.target.kind !== 'pace') continue
        if (!derived.pace || !bands.has(derived.pace)) continue
        const want = anchors[structural.target.anchor]
        if (!want) continue
        derived.pace = want
        n++
      }
    }
  }
  return n
}

/**
 * `INV-PLAN-HEADER-PACE-MATCHES-WORK` — the HEADER is the wrong half.
 *
 * ⚠️ THIS IS THE GAP THAT LEFT 5 OF 9 ERRORS STANDING. The step repair above only
 * touches sessions whose STEPS are wrong, and the common damage is the opposite:
 * the broken writer overwrote a correct goal-band header with the generic
 * threshold band, leaving the steps untouched. Four such sessions on the motivating
 * plan — and fixing them also clears `INV-PLAN-RACE-SPECIFIC-EXPOSURE-RATIO`,
 * because §22's ratio arm classifies goal-pace work by READING `pace_target`.
 * §120's own source comment predicted exactly that coupling.
 *
 * Resolved through `qualityHeaderPace`, §120's owner, with the stored value as the
 * fallback so a §85 mixed-anchor row (whose header is a mean that equals no single
 * step, and which the invariant skips by design) is left alone.
 */
export function matchHeadersToSteps(plan: Plan, violations: RepairViolation[]): number {
  let n = 0
  for (const v of violations) {
    if (v.code !== 'INV-PLAN-HEADER-PACE-MATCHES-WORK' || v.week == null) continue
    for (const [, s] of sessionsOf(plan, v.week, v.day)) {
      if (s.type !== 'quality' || !s.derived_set || s.pace_target == null) continue
      // Only where the steps agree with each other — otherwise the header is a
      // §85 mean and this is not the repair for it.
      if (new Set(workPacesOf(s)).size !== 1) continue
      const want = qualityHeaderPace({
        derivedSet: s.derived_set, categoryBand: s.pace_target,
      })
      if (want === s.pace_target) continue
      s.pace_target = want
      n++
    }
  }
  return n
}

/**
 * `INV-PLAN-EFFORT-GOVERNED-NOT-GOAL-PACED` — a pace that must not exist, removed.
 *
 * ⚠️ THE ONLY REPAIR HERE THAT DELETES, AND NO MODE COULD DELETE BEFORE. §40b: on
 * an effort-governed row the terrain sets the intensity, so a pace is a number the
 * runner cannot act on. The broken writer added one to `hill_reps`, which had
 * correctly carried none since generation.
 *
 * ⚠️ ONE WRONGLY-WRITTEN FIELD, TWO ERRORS. Deleting it also clears
 * `INV-PLAN-VO2MAX-MAIN-SET-CAP`, because the presence of a pace is what made that
 * row classify as VO2max work at all — the `hill_reps` orphan family again.
 */
export function stripEffortGovernedPace(plan: Plan, violations: RepairViolation[]): number {
  let n = 0
  for (const v of violations) {
    if (v.code !== 'INV-PLAN-EFFORT-GOVERNED-NOT-GOAL-PACED' || v.week == null) continue
    for (const [, s] of sessionsOf(plan, v.week, v.day)) {
      if (s.pace_target == null) continue
      delete (s as { pace_target?: string }).pace_target
      n++
    }
  }
  return n
}

/**
 * `INV-PLAN-5K10K-LR-PACE-CAP` — a long-run segment pace left at the old fitness.
 *
 * ⚠️ `lr_segment_pace` WAS NOT IN THE RE-PRICING WALK AT ALL, which is why it
 * survived both the engine fix and the first repair: that walk reads
 * `derived_set` steps, and this is a field on the session.
 *
 * Re-priced to the runner's own HM band, which is what the cap is measured
 * against. ⚠️ I first assumed the check derived its ceiling separately from the
 * guide — the "checker reads a different source" class — and that was WRONG: they
 * agree to **0.1%**. My test had used a band from the wrong VDOT pairing. The
 * segment really is just stale.
 */
export function repriceLongRunSegments(
  plan: Plan, violations: RepairViolation[], guide: PaceGuide,
): number {
  if (!guide.hmPaceStr) return 0
  let n = 0
  for (const v of violations) {
    if (v.code !== 'INV-PLAN-5K10K-LR-PACE-CAP' || v.week == null) continue
    for (const [, s] of sessionsOf(plan, v.week, v.day)) {
      const seg = (s as { lr_segment_pace?: string }).lr_segment_pace
      if (!seg || seg === guide.hmPaceStr) continue
      ;(s as { lr_segment_pace?: string }).lr_segment_pace = guide.hmPaceStr
      n++
    }
  }
  return n
}

/** All four, in the order their couplings require. Returns what each did. */
export function repairPlan(
  plan: Plan, violations: RepairViolation[], guide: PaceGuide,
): { steps: number; headers: number; stripped: number; segments: number } {
  // Steps first: the header repair reads the steps, so it must see the repriced
  // ones. The other two are independent.
  const steps = repriceStaleSteps(plan, violations, guide)
  const headers = matchHeadersToSteps(plan, violations)
  const stripped = stripEffortGovernedPace(plan, violations)
  const segments = repriceLongRunSegments(plan, violations, guide)
  return { steps, headers, stripped, segments }
}
