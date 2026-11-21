// FREE — infrastructure. ADR-027 B3 step 2 (ADR027-B3-VERIFIER): L5, the independent verifier.
//
// Re-implements the rules in the catalogue as fresh predicates over a finished plan. It must NOT wrap or
// call `validatePlan`, and it may share only what the HLD allows: rule data (the catalogue, the config) and
// the fixture-tested classification/measurement owners. `verifierIndependence.test.ts` enforces the import
// list, so a predicate cannot quietly reuse the planner's construction logic and inherit its blind spots.
//
// WATCH-ONLY. Nothing reads its output yet: `verifierAgreement.test.ts` compares it with `validatePlan`,
// rule by rule, on valid and deliberately broken plans. It replaces `validatePlan` as the gate only after
// every rule is ported and the founder signs off the cut-over (HLD B3 exit).

import type { Plan, Session, GeneratorInput } from '@/types/plan'
import type { RuleId } from '@/lib/engine/contracts/rule'
import { RULES } from '@/lib/engine/catalogue/rules'
import { GENERATION_CONFIG } from '@/lib/plan/generationConfig'
import { isLongRun, isShakeout, isSecondaryQuality } from '@/lib/plan/sessionRole'

export type VerifierDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export interface VerifierFinding {
  rule_id: RuleId
  severity: 'error' | 'warn'
  /** The week's `n`, never its position (ARCH-ENG-015). Foundation weeks are n <= 0. */
  week: number
  day: VerifierDay | null
  detail: string
}

export interface VerifyContext {
  /** The request the plan was built from, RAW. ⚠️ `validatePlan` first normalises it with the planner's
   *  `coherentGoal`; the verifier may not import that. Harmless for the rules ported so far (none reads
   *  the goal). A goal-dependent rule must not be ported until the normalised goal reaches the verifier
   *  as data (the L1 profile is the intended carrier). */
  input: GeneratorInput
}

type Week = Plan['weeks'][number]
type Raw = Omit<VerifierFinding, 'severity'>
type Predicate = (plan: Plan, ctx: VerifyContext) => Raw[]

const DAYS: readonly VerifierDay[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const WEEKDAYS = new Set<VerifierDay>(['mon', 'tue', 'wed', 'thu', 'fri'])

/** Weeks the §9/§64 session rules govern: a maintenance or base-build week has its own rules. */
const governed = (w: Week) =>
  w.phase !== 'maintenance_restoration' && w.phase !== 'maintenance_base' && w.phase !== 'base_build'

const daysOf = (w: Week) =>
  DAYS.map(d => ({ day: d, session: (w.sessions as Record<string, Session | undefined>)[d] }))
const running = (w: Week) =>
  daysOf(w).filter((x): x is { day: VerifierDay; session: Session } =>
    !!x.session && x.session.type !== 'strength' && x.session.type !== 'rest')

/**
 * §9's per-type floors, derived HERE from the config rather than through the planner's `sessionFloorsFor`.
 * A declared longest run lowers the long and easy floors so a returning runner is not floored above what
 * they have run; the floors are snapped DOWN to the distance grid the engine rounds to.
 */
function floors(longest: unknown) {
  const cfg = GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM
  if (typeof longest !== 'number' || !Number.isFinite(longest) || longest < 0) return cfg
  const grid = GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM
  const down = (n: number) => Math.floor((n + 1e-9) / grid) * grid
  const long = down(Math.min(cfg.long, Math.max(longest, GENERATION_CONFIG.MIN_SESSION_DISTANCE_ABSOLUTE_KM)))
  return { ...cfg, long, easy: down(Math.min(cfg.easy, long / GENERATION_CONFIG.LONG_RUN_MIN_RATIO_VS_EASY)) }
}

/** §9's session-size rules do not govern the race itself, a race-week easy run, or a shakeout. */
const sizeExempt = (w: Week, s: Session) => s.type === 'race' || (w.type === 'race' && s.type === 'easy') || isShakeout(s)

export const PREDICATES: Partial<Record<RuleId, Predicate>> = {
  // §64: every week but race week keeps at least one day off.
  'INV-PLAN-WEEK-HAS-REST-DAY': plan => plan.weeks.filter(governed).flatMap(w => {
    if (w.type === 'race') return []
    const all = daysOf(w).map(x => x.session)
    const hasRest = all.some(s => s?.type === 'rest') || all.filter(s => s && s.type !== 'rest').length < DAYS.length
    return hasRest ? [] : [{ rule_id: 'INV-PLAN-WEEK-HAS-REST-DAY', week: w.n, day: null, detail: 'no rest day' }]
  }),

  // §9: a placed session carries a distance or a duration.
  // ⚠️ PORTED FAITHFULLY, INCLUDING A PROBABLE BLIND SPOT: `validatePlan` runs this inside the size loop,
  // so it skips the race, a race-week easy run and a shakeout, and an EMPTY race-week shakeout passes.
  // Kept identical so agreement means something; raised for a ruling rather than changed here.
  'INV-PLAN-EMPTY-SESSION': plan => plan.weeks.filter(governed).flatMap(w =>
    running(w).filter(({ session: s }) => !sizeExempt(w, s))
      .filter(({ session: s }) => (s.duration_mins ?? 0) === 0 && (s.distance_km ?? 0) === 0)
      .map(({ day }) => ({ rule_id: 'INV-PLAN-EMPTY-SESSION', week: w.n, day, detail: 'zero distance and zero duration' }))),

  // §9 (+ Am. on minutes): a distance-anchored session meets its type's floor, unless a quality session
  // holds the quality minutes or an easy weekday run fills its day's budget.
  'INV-PLAN-MIN-SESSION-SIZE': (plan, { input }) => {
    const f = floors(input.longest_recent_run_km)
    return plan.weeks.filter(governed).flatMap(w => {
      const placed = running(w)
      const all = daysOf(w).map(x => x.session)
      return placed.flatMap(({ day, session: s }) => {
        if (sizeExempt(w, s)) return []
        const long = isLongRun(s)
        const floor = long ? f.long
          : isSecondaryQuality(s, all) ? f.secondary_quality
          : s.type === 'quality' ? f.quality
          : f.easy
        const km = s.distance_km ?? 0
        if (!(km > 0 && km < floor)) return []
        const mins = s.duration_mins ?? 0
        const budget = WEEKDAYS.has(day)
          ? (input.day_budgets?.[day as 'mon'] ?? input.max_weekday_mins)
          : undefined
        const byMinutes = (s.type === 'quality' && mins >= GENERATION_CONFIG.QUALITY_FLOOR_MINS)
          || (s.type === 'easy' && !long && budget != null && mins >= Math.max(GENERATION_CONFIG.EASY_FLOOR_HELD_MINS, budget))
        return byMinutes ? [] : [{ rule_id: 'INV-PLAN-MIN-SESSION-SIZE', week: w.n, day, detail: `${km} km below a ${floor} km floor` }]
      })
    })
  },
}

const SEVERITY = new Map(RULES.map(r => [r.id, r.kind === 'soft' ? 'warn' as const : 'error' as const]))

/** Every finding the ported predicates raise, with the severity the catalogue gives the rule. */
export function verifyPlan(plan: Plan, ctx: VerifyContext): VerifierFinding[] {
  return Object.values(PREDICATES).flatMap(p => p!(plan, ctx))
    .map(f => ({ ...f, severity: SEVERITY.get(f.rule_id) ?? 'error' }))
}

export const PORTED_RULES = Object.keys(PREDICATES) as RuleId[]
