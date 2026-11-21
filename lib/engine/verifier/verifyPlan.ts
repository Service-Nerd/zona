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
import type { RunnerProfile } from '@/lib/engine/contracts/profile'
import { RULES } from '@/lib/engine/catalogue/rules'
import { GENERATION_CONFIG, raceDistanceKey } from '@/lib/plan/generationConfig'
import { isLongRun, isShakeout, isSecondaryQuality, isQualitySession, isStructuredSession, isTimeTrial, isVo2maxSession } from '@/lib/plan/sessionRole'
import { V1_SESSION_CATALOGUE } from '@/lib/plan/sessionCatalogueData'
import { FUELLING_PRACTICE_NOTE, ULTRA_FUELLING_PREFIX } from '@/lib/plan/fuellingNotes'
import { PLAN_SIGNATURES } from '@/lib/plan/planSignatures'
import { normaliseDays } from '@/lib/plan/days'
import { sessionKmSelfPaced } from '@/lib/plan/sessionDistance'
import { hasInjuryKeyword, hasDeliveredCapInjury } from '@/lib/plan/injuryScope'
import { BENCHMARK_VDOT_MAX } from '@/lib/plan/benchmarkCheck'

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
   *  `coherentGoal`; the verifier may not import that. A goal-dependent rule reads `profile.race.goal`
   *  (normalised) and NEVER `input.goal`. */
  input: GeneratorInput
  /** L1's view of the runner (B3 batch 4). A rule that needs the runner's LEVEL reads it here, never from
   *  the plan's own `meta`: checking a plan against the label the plan gave itself is circular.
   *  ⚠️ BUILD IT AS OF THE PLAN'S GENERATION DATE. §10's staleness ramp makes the level depend on the instant
   *  the profile is built, so a nightly run against an old plan (step 3) must not use "now". No ported rule
   *  reads the level: QUALITY-PER-WEEK, with the normalised goal from `profile.race.goal`. */
  profile: RunnerProfile
}

type Week = Plan['weeks'][number]
type Raw = Omit<VerifierFinding, 'severity'>
type Predicate = (plan: Plan, ctx: VerifyContext) => Raw[]

const DAYS: readonly VerifierDay[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const WEEKDAYS = new Set<VerifierDay>(['mon', 'tue', 'wed', 'thu', 'fri'])

/** Weeks the §9/§64 session rules govern: a maintenance or base-build week has its own rules. */
const governed = (w: Week) =>
  w.phase !== 'maintenance_restoration' && w.phase !== 'maintenance_base' && w.phase !== 'base_build'

/** A week's days in the plan's OWN key order, as `validatePlan` reads them: where a rule takes "the first"
 *  long run or race and a broken plan has two, the same one is chosen (measured: two rules disagreed in
 *  Mon–Sun order on the all-easy and all-race mutations). */
const daysOf = (w: Week) =>
  // EVERY key, as validatePlan walks them (code review): a session stored under a non-day key is still
  // checked by the rules that iterate entries. Day-specific logic (weekdays, ordering) treats it as none.
  Object.entries((w.sessions ?? {}) as Record<string, Session | undefined>)
    .map(([d, session]) => ({ day: d as VerifierDay, session }))
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

/** The plan's own easy pace (min/km), read from its first main-week easy run with both anchors. */
function easyMinPerKm(plan: Plan): number | null {
  for (const w of plan.weeks) {
    if (w.n <= 0) continue
    for (const { session: s } of daysOf(w)) {
      if (!s || s.type !== 'easy' || isLongRun(s)) continue
      const mins = s.duration_mins, km = s.distance_km
      if (mins == null || km == null || !Number.isFinite(mins) || !Number.isFinite(km) || mins <= 0 || km <= 0) continue
      return mins / km
    }
  }
  return null
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

/** A §82 floor hold the planner licensed: the session sits at (or under, within the held minutes) the easy floor. */
const licensedFloorHold = (s: Session, floorKm: number) =>
  s.floor_protected === true && (s.distance_km === floorKm
    || (s.distance_km != null && s.distance_km < floorKm && (s.duration_mins ?? Infinity) <= GENERATION_CONFIG.EASY_FLOOR_HELD_MINS))

const weekdayCap = (input: GeneratorInput, d: VerifierDay) =>
  WEEKDAYS.has(d) ? (input.day_budgets?.[d as 'mon'] ?? input.max_weekday_mins ?? null) : null

/** A plan-local date: `YYYY-MM-DD` read as local midnight, as the plan's own dates are. */
const localDate = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d) }

const BATCH_2: Partial<Record<RuleId, Predicate>> = {
  // §9: outside race week, the long run is at least LONG_RUN_MIN_RATIO_VS_EASY × every easy run, in km…
  'INV-PLAN-LONG-IS-LONGEST': plan => plan.weeks.filter(governed).flatMap(w => {
    if (w.type === 'race') return []
    const placed = running(w), long = placed.find(x => isLongRun(x.session))
    if (long?.session.distance_km == null) return []
    const r = GENERATION_CONFIG.LONG_RUN_MIN_RATIO_VS_EASY
    return placed.filter(x => x.session.type === 'easy' && !isLongRun(x.session) && !isShakeout(x.session))
      .filter(x => x.session.distance_km != null && x.session.distance_km * r > long.session.distance_km! + 0.01)
      .map(x => ({ rule_id: 'INV-PLAN-LONG-IS-LONGEST', week: w.n, day: x.day, detail: 'easy run inverts the long-vs-easy ratio (km)' }))
  }),

  // …and in minutes, for an easy run anchored by duration alone (§9 Am. 2), with half a minute of rounding.
  'INV-PLAN-LONG-IS-LONGEST-MINS': plan => plan.weeks.filter(governed).flatMap(w => {
    if (w.type === 'race') return []
    const placed = running(w), long = placed.find(x => isLongRun(x.session))
    if (long?.session.duration_mins == null) return []
    const r = GENERATION_CONFIG.LONG_RUN_MIN_RATIO_VS_EASY
    return placed.filter(x => x.session.type === 'easy' && !isLongRun(x.session) && !isShakeout(x.session))
      .filter(x => x.session.distance_km == null && x.session.duration_mins != null
        && x.session.duration_mins * r > long.session.duration_mins! + 0.5 * r + 0.5)
      .map(x => ({ rule_id: 'INV-PLAN-LONG-IS-LONGEST-MINS', week: w.n, day: x.day, detail: 'easy run inverts the long-vs-easy ratio (minutes)' }))
  }),

  // §18: nothing but rest or the race on a day the runner cannot train.
  'INV-PLAN-NO-SESSIONS-ON-BLOCKED-DAYS': (plan, { input }) => {
    const blocked = normaliseDays(input.days_cannot_train)
    return plan.weeks.filter(governed).flatMap(w => daysOf(w)
      .filter(x => x.session && x.session.type !== 'rest' && x.session.type !== 'race' && blocked.has(x.day))
      .map(x => ({ rule_id: 'INV-PLAN-NO-SESSIONS-ON-BLOCKED-DAYS', week: w.n, day: x.day, detail: 'session on a blocked day' })))
  },

  // §81: an unstructured weekday run fits the time the runner gave that day, unless held at the easy floor.
  'INV-PLAN-MAX-WEEKDAY-MINS': (plan, { input }) => {
    if (input.max_weekday_mins == null && input.day_budgets == null) return []
    const floor = floors(input.longest_recent_run_km).easy
    return plan.weeks.filter(governed).flatMap(w => daysOf(w).flatMap(({ day, session: s }) => {
      const cap = weekdayCap(input, day)
      if (cap == null || !s?.duration_mins || isLongRun(s) || isStructuredSession(s) || licensedFloorHold(s, floor)) return []
      return s.duration_mins > cap ? [{ rule_id: 'INV-PLAN-MAX-WEEKDAY-MINS', week: w.n, day, detail: `${s.duration_mins} min over a ${cap} min day` }] : []
    }))
  },

  // §122: a foundation weekday run carries a duration whenever the plan's easy pace can give it one…
  'INV-PLAN-FOUNDATION-WEEKDAY-HAS-DURATION': plan => {
    if (easyMinPerKm(plan) == null) return []
    return plan.weeks.filter(w => w.n <= 0).flatMap(w => daysOf(w)
      .filter(x => WEEKDAYS.has(x.day) && x.session && x.session.type !== 'rest'
        && x.session.distance_km != null && x.session.duration_mins == null)
      .map(x => ({ rule_id: 'INV-PLAN-FOUNDATION-WEEKDAY-HAS-DURATION', week: w.n, day: x.day, detail: 'distance with no duration' })))
  },

  // …and fits the day's budget, unless it is the long run, structured, or held at the floor.
  'INV-PLAN-FOUNDATION-WEEKDAY-WITHIN-BUDGET': (plan, { input }) => {
    const paced = easyMinPerKm(plan) != null
    const floor = floors(input.longest_recent_run_km).easy
    return plan.weeks.filter(w => w.n <= 0).flatMap(w => daysOf(w).flatMap(({ day, session: s }) => {
      if (!WEEKDAYS.has(day) || !s || s.type === 'rest') return []
      if (paced && s.distance_km != null && s.duration_mins == null) return []   // HAS-DURATION's finding
      const cap = weekdayCap(input, day)
      if (cap == null || s.duration_mins == null || isLongRun(s) || isStructuredSession(s) || licensedFloorHold(s, floor)) return []
      return s.duration_mins > cap ? [{ rule_id: 'INV-PLAN-FOUNDATION-WEEKDAY-WITHIN-BUDGET', week: w.n, day, detail: `${s.duration_mins} min over a ${cap} min day` }] : []
    }))
  },

  // §12: every easy-family run (anything not rest, strength, cross-train, quality, hard or the race) has a pace.
  'INV-PLAN-EASY-PACE-PRESENT': plan => plan.weeks.flatMap(w => daysOf(w)
    .filter(({ session: s }) => !!s && !['rest', 'strength', 'cross-train', 'hard', 'race'].includes(s.type)
      && !isQualitySession(s) && !(typeof s.pace_target === 'string' && s.pace_target.trim().length > 0))
    .map(x => ({ rule_id: 'INV-PLAN-EASY-PACE-PRESENT', week: w.n, day: x.day, detail: 'no pace target' }))),

  // §77: the race sits on the race date's weekday, and nothing is scheduled after it.
  'INV-PLAN-RACE-ON-RACE-DAY': plan => {
    const iso = plan.meta.race_date
    const main = plan.weeks.filter(w => w.n > 0)
    const last = main[main.length - 1]
    if (!iso || !last?.date) return []
    // NOT gated on the race date falling in the final week (code review): validatePlan raises COVERS-RACE-DATE
    // for that AND still checks the weekday here, so both findings stand together.
    const race = localDate(iso)
    const placed = daysOf(last).find(x => x.session?.type === 'race')
    if (!placed) return []
    const raceDay = DAYS[(race.getDay() + 6) % 7]
    const out: Raw[] = []
    if (placed.day !== raceDay) out.push({ rule_id: 'INV-PLAN-RACE-ON-RACE-DAY', week: last.n, day: placed.day, detail: `race on ${placed.day}, race date is a ${raceDay}` })
    for (const x of daysOf(last)) {
      if (!x.session || x.session.type === 'race' || x.session.type === 'rest') continue
      if (DAYS.indexOf(x.day) > DAYS.indexOf(raceDay)) out.push({ rule_id: 'INV-PLAN-RACE-ON-RACE-DAY', week: last.n, day: x.day, detail: 'scheduled after the race' })
    }
    return out
  },

  // §80: a duration-anchored session keeps its minutes and stays duration-primary.
  'INV-PLAN-DURATION-ANCHORED-KEEPS-MINUTES': plan => plan.weeks.filter(governed).flatMap(w => running(w)
    .filter(({ session: s }) => s.duration_anchored
      && (!(typeof s.duration_mins === 'number' && s.duration_mins > 0) || s.primary_metric !== 'duration'))
    .map(x => ({ rule_id: 'INV-PLAN-DURATION-ANCHORED-KEEPS-MINUTES', week: w.n, day: x.day, detail: 'lost its minutes or its duration metric' }))),
}
Object.assign(PREDICATES, BATCH_2)

/** Plan-level findings carry week 0, as `validatePlan` does (no live week has n = 0). */
const PLAN = 0

const BATCH_3: Partial<Record<RuleId, Predicate>> = {
  // §18: the stated longest run cannot exceed the stated week.
  'INV-INPUT-LONGEST-LE-WEEKLY': (_plan, { input }) => {
    const weekly = input.current_weekly_km ?? 0, longest = input.longest_recent_run_km ?? 0
    return weekly > 0 && longest > weekly
      ? [{ rule_id: 'INV-INPUT-LONGEST-LE-WEEKLY', week: PLAN, day: null, detail: 'longest run above the weekly total' }] : []
  },

  // §76: the final main week contains the race date.
  'INV-PLAN-COVERS-RACE-DATE': plan => {
    const iso = plan.meta.race_date
    const main = plan.weeks.filter(w => w.n > 0)
    const last = main[main.length - 1]
    if (!iso || !last?.date) return []
    const start = localDate(last.date), race = localDate(iso)
    const end = new Date(start); end.setDate(end.getDate() + 6)
    return race < start || race > end
      ? [{ rule_id: 'INV-PLAN-COVERS-RACE-DATE', week: last.n, day: null, detail: 'final week does not contain the race date' }] : []
  },

  // §36: consecutive taper weeks (race week aside) do not repeat the same quality session at the same pace.
  'INV-PLAN-TAPER-VARIETY': plan => {
    const out: Raw[] = []
    let prev: { label: string; pace: string } | null = null
    for (const w of plan.weeks.filter(x => x.phase === 'taper' && x.type !== 'race')) {
      const q = Object.values(w.sessions as Record<string, Session | undefined>).find(x => x?.type === 'quality')
      if (!q) { prev = null; continue }
      const label = q.catalogue_id ?? q.label ?? '', pace = q.pace_target ?? ''
      if (prev && prev.label === label && prev.pace === pace) out.push({ rule_id: 'INV-PLAN-TAPER-VARIETY', week: w.n, day: null, detail: 'repeats the previous taper quality' })
      prev = { label, pace }
    }
    return out
  },

  // §49: the taper (race week included) is no longer than its distance allows.
  'INV-PLAN-TAPER-DURATION-CAP': (plan, { input }) => {
    const cap = GENERATION_CONFIG.MAX_TAPER_PHASE_WEEKS[raceDistanceKey(input.race_distance_km) as keyof typeof GENERATION_CONFIG.MAX_TAPER_PHASE_WEEKS]
    const n = plan.weeks.filter(w => w.phase === 'taper').length
    return n > cap ? [{ rule_id: 'INV-PLAN-TAPER-DURATION-CAP', week: PLAN, day: null, detail: `${n} taper weeks over a cap of ${cap}` }] : []
  },

  // §39 Am. 1: in the protected days before a race, nothing longer than the shakeout cap.
  'INV-PLAN-NO-RACE-EVE-SESSION': plan => plan.weeks.flatMap(w => {
    const entries = daysOf(w)
    const race = entries.find(x => x.session?.type === 'race')
    const raceIdx = race ? DAYS.indexOf(race.day) : -1
    if (raceIdx < 0) return []
    return entries.filter(({ day, session: s }) => {
      if (!s || s.type === 'rest' || s.type === 'race') return false
      const idx = DAYS.indexOf(day)
      if (idx < 0 || idx >= raceIdx || raceIdx - idx > GENERATION_CONFIG.RACE_EVE_PROTECTED_DAYS) return false
      return (s.duration_mins ?? 0) > GENERATION_CONFIG.RACE_WEEK_SHAKEOUT_MAX_MINS
    }).map(x => ({ rule_id: 'INV-PLAN-NO-RACE-EVE-SESSION', week: w.n, day: x.day, detail: 'over the shakeout cap before the race' }))
  }),

  // §4: main-week phases each form one block, in the order base, build, peak, taper.
  'INV-PLAN-PHASE-STRUCTURE': plan => {
    const blocks: string[] = []
    for (const w of plan.weeks) {
      if (w.n < 1) continue
      const ph = w.phase ?? 'base'
      if (blocks[blocks.length - 1] !== ph) blocks.push(ph)
    }
    const out: Raw[] = []
    if (blocks.some((ph, i) => blocks.indexOf(ph) !== i)) out.push({ rule_id: 'INV-PLAN-PHASE-STRUCTURE', week: PLAN, day: null, detail: `phase returns: ${blocks.join(' > ')}` })
    const order = ['base', 'build', 'peak', 'taper']
    const ranks = blocks.map(ph => order.indexOf(ph)).filter(r => r >= 0)
    if (!ranks.every((r, i) => i === 0 || r > ranks[i - 1])) out.push({ rule_id: 'INV-PLAN-PHASE-STRUCTURE', week: PLAN, day: null, detail: `phases out of order: ${blocks.join(' > ')}` })
    return out
  },

  // §87 (with the recovery cadence): no deload opens a base or build phase, and placement never yields fewer
  // deloads than the cadence calls for. The masters cadence applies when age is absent.
  'INV-PLAN-DELOAD-PLACEMENT': (plan, { input }) => {
    const masters = typeof input.age !== 'number' || !Number.isFinite(input.age) || input.age >= GENERATION_CONFIG.MASTERS_AGE_THRESHOLD
    const every = masters ? GENERATION_CONFIG.RECOVERY_WEEK_FREQUENCY_MASTERS : GENERATION_CONFIG.RECOVERY_WEEK_FREQUENCY_STANDARD
    const phase = new Map<number, string>()
    for (const w of plan.weeks) if (w.phase) phase.set(w.n, w.phase)
    const inScope = (n: number) => n >= 1 && (phase.get(n) === 'base' || phase.get(n) === 'build')
    const due = plan.weeks.filter(w => inScope(w.n) && w.n % every === 0).length
    const deloads = plan.weeks.filter(w => w.type === 'deload')
    const out: Raw[] = deloads
      .filter(w => w.n > 1 && inScope(w.n) && phase.get(w.n - 1) != null && phase.get(w.n) !== phase.get(w.n - 1))
      .map(w => ({ rule_id: 'INV-PLAN-DELOAD-PLACEMENT', week: w.n, day: null, detail: 'deload opens a phase' }))
    if (deloads.length < due) out.push({ rule_id: 'INV-PLAN-DELOAD-PLACEMENT', week: PLAN, day: null, detail: `cadence: ${deloads.length} deloads, ${due} due` })
    return out
  },
}
Object.assign(PREDICATES, BATCH_3)

const BATCH_4: Partial<Record<RuleId, Predicate>> = {
  // §8: quality sessions per week stay under the ceiling for the runner's INTENSITY level. A
  // beginner with a time goal has its own small ceiling. Level AND goal come from the profile: the goal as
  // the engine normalises it (a time target with no time is a finish goal), never the plan's own meta.
  'INV-PLAN-QUALITY-PER-WEEK': (plan, { profile }) => {
    const level = profile.levels.intensity.value
    const max = level === 'beginner' && profile.race.goal === 'time_target'
      ? GENERATION_CONFIG.BEGINNER_TIME_TARGET_QUALITY_PER_WEEK_MAX
      : GENERATION_CONFIG.QUALITY_SESSIONS_PER_WEEK_MAX[level]
    // Unverified is never a pass: an unknown level has no ceiling to compare against.
    if (typeof max !== 'number') throw new Error(`QUALITY-PER-WEEK: no ceiling for level ${String(level)}`)
    return plan.weeks.filter(governed).flatMap(w => {
      const n = running(w).filter(x => x.session.type === 'quality').length
      return n > max ? [{ rule_id: 'INV-PLAN-QUALITY-PER-WEEK', week: w.n, day: null, detail: `${n} quality sessions over a ceiling of ${max}` }] : []
    })
  },

  // §9/§10/§113: in weeks 1 and 2 the long run stays within a multiple of the runner's longest recent run
  // (never below the long-run floor).
  'INV-PLAN-WEEK-1-2-LONG-CAP': (plan, { input }) => {
    const longest = input.longest_recent_run_km
    if (typeof longest !== 'number') return []
    const cap = Math.max(longest * GENERATION_CONFIG.WEEK_1_2_LONG_RUN_CAP_MULTIPLIER, floors(longest).long)
    return plan.weeks.filter(w => governed(w) && w.n > 0 && w.n <= 2).flatMap(w => {
      const long = running(w).find(x => isLongRun(x.session))
      return long && long.session.distance_km != null && long.session.distance_km > cap + 0.01
        ? [{ rule_id: 'INV-PLAN-WEEK-1-2-LONG-CAP', week: w.n, day: long.day, detail: `long run over ${cap.toFixed(1)} km` }] : []
    })
  },

  // §23: peak volume is at least PEAK_OVER_BASE_RATIO of week 1's, unless the plan is a maintenance profile.
  // Only on a plan of PEAK_OVERLOAD_MIN_PLAN_WEEKS main weeks or more (code review: the first port missed it).
  // ⚠️ Trusts the plan's own `volume_profile` label, as validatePlan does: a self-label read, recorded.
  'INV-PLAN-PEAK-OVER-BASE': plan => {
    const total = plan.weeks.filter(w => w.n > 0).length || plan.weeks.length
    if (total < GENERATION_CONFIG.PEAK_OVERLOAD_MIN_PLAN_WEEKS) return []
    const w1 = (plan.weeks.find(w => w.phase !== 'foundation') ?? plan.weeks[0])?.weekly_km ?? 0
    const peaks = plan.weeks.filter(w => w.phase === 'peak')
    if (!(w1 > 0) || !peaks.length || plan.meta.volume_profile === 'maintenance') return []
    const ratio = Math.max(...peaks.map(w => w.weekly_km)) / w1
    return ratio < GENERATION_CONFIG.PEAK_OVER_BASE_RATIO
      ? [{ rule_id: 'INV-PLAN-PEAK-OVER-BASE', week: PLAN, day: null, detail: `peak at ${Math.round(ratio * 100)}% of week 1` }] : []
  },

  // §8/§9: a second quality session needs MIN_TRAINING_DAYS_FOR_SECOND_QUALITY training days.
  'INV-PLAN-SECOND-QUALITY-MIN-DAYS': (plan, { input }) => {
    const days = Math.min(input.days_available ?? 7, GENERATION_CONFIG.MAX_TRAINING_DAYS_PER_WEEK)
    if (days >= GENERATION_CONFIG.MIN_TRAINING_DAYS_FOR_SECOND_QUALITY) return []
    return plan.weeks.flatMap(w => {
      const n = daysOf(w).filter(x => x.session?.type === 'quality').length
      return n > 1 ? [{ rule_id: 'INV-PLAN-SECOND-QUALITY-MIN-DAYS', week: w.n, day: null, detail: `${n} quality sessions on a ${days}-day week` }] : []
    })
  },
}
Object.assign(PREDICATES, BATCH_4)

const BATCH_5: Partial<Record<RuleId, Predicate>> = {
  // §45 (+ Am. 2): the long run grows at most LONG_RUN_PROGRESSION_CAP_PCT, or an absolute step that tapers with
  // the run's length, plus one rounding step. After a step-back or deload week the bar is the week BEFORE it,
  // within a tolerance. Not across the foundation-to-main boundary, and not into race week.
  'INV-PLAN-LR-PROGRESSION-CAP': plan => {
    const pct = GENERATION_CONFIG.LONG_RUN_PROGRESSION_CAP_PCT / 100
    const tol = 1 + GENERATION_CONFIG.LONG_RUN_DELOAD_STEP_BACK_TOLERANCE_PCT / 100
    const lr = (w: Week): number | null => {
      const s = Object.values((w.sessions ?? {}) as Record<string, Session | undefined>).find(x => !!x && isLongRun(x))
      return s ? sessionKmSelfPaced(s) ?? null : null
    }
    const out: Raw[] = []
    for (let i = 1; i < plan.weeks.length; i++) {
      const prev = plan.weeks[i - 1], curr = plan.weeks[i]
      if (curr.type === 'race' || (prev.phase === 'foundation' && curr.phase !== 'foundation')) continue
      const a = lr(prev), b = lr(curr)
      if (a == null || b == null) continue
      const before = i >= 2 ? lr(plan.weeks[i - 2]) : null
      const stepBack = prev.type === 'deload' || (before != null && prev.type !== 'race' && a < before - 0.01)
      if (stepBack && before != null && b <= before * tol + 0.01) continue
      const abs = Math.min(GENERATION_CONFIG.LONG_RUN_PROGRESSION_CAP_ABS_KM, a * GENERATION_CONFIG.LONG_RUN_ABS_STEP_MAX_PCT_OF_LR / 100)
      const allowed = Math.max(a * pct, abs) + GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM
      if (b - a <= allowed + 0.01) continue
      // Name the arm that BOUND (DUNCAN-RESIDUAL-LOAD-01): a small miss over the step-back allowance once read
      // as a +59% spike because the raw week-on-week jump was reported instead.
      const detail = stepBack && before != null
        ? `long run ${b} km over the step-back allowance of ${(before * tol).toFixed(2)} km by ${(b - before * tol).toFixed(2)} km`
        : `long run +${(b - a).toFixed(1)} km over an allowed +${allowed.toFixed(1)} km`
      out.push({ rule_id: 'INV-PLAN-LR-PROGRESSION-CAP', week: curr.n, day: null, detail })
    }
    return out
  },

  // §46: a time-targeted marathon or ultra peaks at or above its distance's floor (not on a maintenance profile).
  'INV-PLAN-PEAK-VOLUME-FLOOR-LONG-RACES': (plan, { input, profile }) => {
    if (profile.race.goal !== 'time_target' || plan.meta.volume_profile === 'maintenance') return []
    const d = input.race_distance_km
    const floor = d >= 40 && d <= 43 ? d * GENERATION_CONFIG.MARATHON_PEAK_VOLUME_FLOOR_RATIO
      : d > 43 && d <= 55 ? d * GENERATION_CONFIG.ULTRA_50K_PEAK_VOLUME_FLOOR_RATIO
      : d > 55 ? Math.min(d * GENERATION_CONFIG.ULTRA_LONG_PEAK_VOLUME_FLOOR_RATIO, GENERATION_CONFIG.ULTRA_PEAK_VOLUME_FLOOR_CAP_KM)
      : 0
    if (!(floor > 0)) return []
    const peaks = plan.weeks.filter(w => w.phase === 'peak')
    // A peak week with no usable volume cannot be checked; throwing makes verifyPlan report it UNVERIFIED
    // (validatePlan lets the NaN pass silently, so the two differ on such a plan by design).
    if (peaks.some(w => !Number.isFinite(w.weekly_km))) throw new Error('a peak week has no weekly_km')
    // ⚠️ Reads the plan's own weekly_km, not the placed sessions (ADR-022's divergence); recorded.
    const peak = peaks.length ? Math.max(...peaks.map(w => w.weekly_km)) : 0
    return peak + 0.01 < floor ? [{ rule_id: 'INV-PLAN-PEAK-VOLUME-FLOOR-LONG-RACES', week: PLAN, day: null, detail: `peak ${peak} km under ${Math.round(floor)} km` }] : []
  },

  // §53: across the plan (race week aside) no one quality row repeats more than its share allows; the
  // allowance rises when the catalogue pools are too small to avoid it (the pigeonhole bound).
  'INV-PLAN-QUALITY-VARIETY-FULL-PLAN': plan => {
    const counts = new Map<string, number>()
    let total = 0
    for (const w of plan.weeks) {
      if (w.type === 'race') continue
      for (const s of Object.values((w.sessions ?? {}) as Record<string, Session | undefined>)) {
        if (!s || s.type !== 'quality') continue
        const k = (s.catalogue_id ?? s.label ?? '').trim()
        if (!k) continue
        counts.set(k, (counts.get(k) ?? 0) + 1); total++
      }
    }
    if (!total) return []
    const share = Math.floor(total / GENERATION_CONFIG.QUALITY_VARIETY_DENOMINATOR) + GENERATION_CONFIG.QUALITY_VARIETY_ALLOWANCE
    const pools = plan.meta.quality_pool_sizes ?? []
    let pigeon = 0
    for (const size of Array.from(new Set(pools))) {
      if (size <= 0) continue
      pigeon = Math.max(pigeon, Math.ceil(pools.filter(x => x <= size).length / size))
    }
    const cap = Math.max(share, pigeon)
    return Array.from(counts).filter(([, n]) => n > cap)
      .map(([k, n]) => ({ rule_id: 'INV-PLAN-QUALITY-VARIETY-FULL-PLAN', week: PLAN, day: null, detail: `${k} ${n} times over ${cap}` }))
  },
}
Object.assign(PREDICATES, BATCH_5)

/** §9 (+ Am. 3): the long run's minute ceiling: the race distance's cap, lowered by any injury on the profile. */
function longCapMins(input: GeneratorInput, profile: RunnerProfile): number {
  const injuries = profile.injuries?.value ?? []
  const caps = Object.entries(GENERATION_CONFIG.LONG_RUN_CAP_MINUTES_BY_INJURY)
    .filter(([k]) => hasInjuryKeyword(injuries, k)).map(([, m]) => m as number)
  return Math.min(GENERATION_CONFIG.LONG_RUN_CAP_MINUTES[raceDistanceKey(input.race_distance_km)], ...caps)
}

const BATCH_6: Partial<Record<RuleId, Predicate>> = {
  // §55 Am. 1: the plan's VDOT is one a human can have.
  'INV-PLAN-VDOT-PLAUSIBLE': plan => {
    const vdot = (plan.meta as { vdot?: number }).vdot
    return typeof vdot === 'number' && Number.isFinite(vdot) && vdot > BENCHMARK_VDOT_MAX
      ? [{ rule_id: 'INV-PLAN-VDOT-PLAUSIBLE', week: PLAN, day: null, detail: `vdot ${vdot.toFixed(1)}` }] : []
  },

  // §9: a main-week long run stays under its minute ceiling.
  'INV-PLAN-LONG-CAP-MINS': (plan, { input, profile }) => {
    const cap = longCapMins(input, profile)
    return plan.weeks.filter(w => governed(w) && w.n > 0).flatMap(w => {
      const long = running(w).find(x => isLongRun(x.session))
      return long?.session.duration_mins != null && long.session.duration_mins > cap
        ? [{ rule_id: 'INV-PLAN-LONG-CAP-MINS', week: w.n, day: long.day, detail: `${long.session.duration_mins} min over ${cap}` }] : []
    })
  },

  // §24: a time-targeted half or marathon's peak long run reaches its share of the race distance, or the
  // minute ceiling's worth of easy running if that is lower (less one rounding step). Not on maintenance.
  'INV-PLAN-PEAK-LR-RACE-RATIO': (plan, { input, profile }) => {
    const key = raceDistanceKey(input.race_distance_km)
    if (profile.race.goal !== 'time_target' || (key !== 'HM' && key !== 'MARATHON') || plan.meta.volume_profile === 'maintenance') return []
    const peaks = plan.weeks.filter(w => w.phase === 'peak' && w.type !== 'deload')
    if (!peaks.length) return []
    const lrKm = peaks.map(w => {
      const long = Object.values((w.sessions ?? {}) as Record<string, Session | undefined>).find(x => !!x && isLongRun(x))
      if (!long) return 0
      return long.distance_km != null ? long.distance_km : sessionKmSelfPaced(long)
    })
    if (lrKm.some(k => k == null)) return []
    const peakKm = Math.max(...(lrKm as number[]))
    const hrs = peaks[0].long_run_hrs ?? 0
    const pace = peakKm > 0 && hrs > 0 ? (hrs * 60) / peakKm : 7
    const capKm = longCapMins(input, profile) / Math.max(pace, 1)
    const need = Math.min(input.race_distance_km * GENERATION_CONFIG.PEAK_LR_RATIO_VS_RACE[key], capKm) - GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM
    return peakKm + 0.01 < need ? [{ rule_id: 'INV-PLAN-PEAK-LR-RACE-RATIO', week: PLAN, day: null, detail: `peak long run ${peakKm.toFixed(1)} km under ${need.toFixed(1)} km` }] : []
  },
}
Object.assign(PREDICATES, BATCH_6)

type Meta = Record<string, unknown>

const BATCH_7: Partial<Record<RuleId, Predicate>> = {
  // §44: every plan states its prep-time status, and a warned plan states its warning and alternatives.
  'INV-PLAN-PREP-TIME-STATUS-ANNOTATED': plan => {
    const m = plan.meta
    const out: Raw[] = []
    if (!m.prep_time_status) out.push({ rule_id: 'INV-PLAN-PREP-TIME-STATUS-ANNOTATED', week: PLAN, day: null, detail: 'no prep_time_status' })
    // Two conditions, two details, so each can be shown to fire on its own (code review).
    if (m.prep_time_status === 'warned' && !m.prep_time_warning) out.push({ rule_id: 'INV-PLAN-PREP-TIME-STATUS-ANNOTATED', week: PLAN, day: null, detail: 'warned without its warning' })
    else if (m.prep_time_status === 'warned' && !m.prep_time_alternatives) out.push({ rule_id: 'INV-PLAN-PREP-TIME-STATUS-ANNOTATED', week: PLAN, day: null, detail: 'warned without its alternatives' })
    return out
  },

  // §44: every plan states its difficulty band…
  'INV-PLAN-DIFFICULTY-ANNOTATED': plan => plan.meta.difficulty_band ? []
    : [{ rule_id: 'INV-PLAN-DIFFICULTY-ANNOTATED', week: PLAN, day: null, detail: 'no difficulty_band' }],

  // …and never reads easier than its own warnings: warned means very demanding; input-constrained or a declared
  // shortfall means not comfortable.
  'INV-PLAN-DIFFICULTY-NEVER-FRONTS-UNSAFE': plan => {
    const m = plan.meta
    if (!m.difficulty_band) return []
    const out: Raw[] = []
    const f = (detail: string) => out.push({ rule_id: 'INV-PLAN-DIFFICULTY-NEVER-FRONTS-UNSAFE', week: PLAN, day: null, detail })
    if (m.prep_time_status === 'warned' && m.difficulty_band !== 'very_demanding') f('warned plan not very demanding')
    if (m.compression_classification === 'constrained_by_inputs' && m.difficulty_band === 'comfortable') f('constrained plan reads comfortable')
    if ([m.long_run_shortfall_note, m.peak_shortfall_note, m.volume_shortfall_note].some(Boolean) && m.difficulty_band === 'comfortable') f('shortfall declared, reads comfortable')
    // ⚠️ validatePlan checks `!prep_time_alternatives`, so an EMPTY list passes (arrays are truthy); copied, raised.
    return out
  },

  // §50 Am.: the plan's age is the one it was built with, never invented, and a plan built with no age says so.
  // ⚠️ PORTED FAITHFULLY, INCLUDING A DUPLICATION: validatePlan runs this inside its per-week loop, so it raises
  // the same finding once per governed week, all at the first week's n. Raised, not changed.
  'INV-PLAN-NO-INVENTED-AGE': (plan, { input }) => {
    const age = input.age, meta = plan.meta as unknown as Meta
    const has = typeof age === 'number' && Number.isFinite(age)
    const week = plan.weeks[0]?.n ?? 1
    const once: Raw[] = []
    if (has && meta.age != null && meta.age !== age) once.push({ rule_id: 'INV-PLAN-NO-INVENTED-AGE', week, day: null, detail: 'meta age differs from the input' })
    if (!has && meta.age != null) once.push({ rule_id: 'INV-PLAN-NO-INVENTED-AGE', week, day: null, detail: 'meta age with no input age' })
    if (!has && !meta.hr_assumption_note) once.push({ rule_id: 'INV-PLAN-NO-INVENTED-AGE', week, day: null, detail: 'no age and no assumption note' })
    return plan.weeks.filter(governed).flatMap(() => once)
  },

  // §50: the plan names its HR method, and any method but Karvonen carries an assumption note.
  'INV-PLAN-HR-ASSUMPTIONS-SURFACED': plan => {
    const method = plan.meta.hr_zone_method
    if (!method) return [{ rule_id: 'INV-PLAN-HR-ASSUMPTIONS-SURFACED', week: PLAN, day: null, detail: 'no hr_zone_method' }]
    return method !== 'karvonen' && !plan.meta.hr_assumption_note
      ? [{ rule_id: 'INV-PLAN-HR-ASSUMPTIONS-SURFACED', week: PLAN, day: null, detail: `no assumption note for ${method}` }] : []
  },

  // §50: a max HR below the age estimate is a floor unless the runner confirmed it.
  'INV-PLAN-MAX-HR-NOT-BELOW-ESTIMATE-FLOOR': plan => {
    const { hr_derived_max: d, hr_estimated_max: e, hr_max_source: src } = plan.meta
    return typeof d === 'number' && typeof e === 'number' && d < e && src !== 'user_confirmed'
      ? [{ rule_id: 'INV-PLAN-MAX-HR-NOT-BELOW-ESTIMATE-FLOOR', week: PLAN, day: null, detail: `${d} below the ${e} estimate` }] : []
  },

  // §78: every listed recalibration week exists and holds a time trial.
  'INV-PLAN-RECALIBRATION-HAS-SESSION': plan => (plan.meta.recalibration_weeks ?? []).flatMap(n => {
    const w = plan.weeks.find(x => x.n === n)
    if (!w) return [{ rule_id: 'INV-PLAN-RECALIBRATION-HAS-SESSION', week: n, day: null, detail: 'listed week does not exist' }]
    return daysOf(w).some(x => x.session && isTimeTrial(x.session)) ? []
      : [{ rule_id: 'INV-PLAN-RECALIBRATION-HAS-SESSION', week: n, day: null, detail: 'no time trial' }]
  }),

  // §78 Am. 2 / §7: a time trial sits at least the configured number of days from the long run.
  'INV-PLAN-TT-LONG-RUN-SPACING': plan => {
    const min = GENERATION_CONFIG.RECALIBRATION_TIME_TRIAL.min_gap_days_from_long_run
    return plan.weeks.flatMap(w => {
      const entries = daysOf(w)
      const long = entries.find(x => !!x.session && isLongRun(x.session))
      if (!long) return []
      // The circular day gap, computed HERE (code review): `dayGap` is the producer's own placement predicate.
      const gap = (a: string, b: string) => { const d = Math.abs(DAYS.indexOf(a as VerifierDay) - DAYS.indexOf(b as VerifierDay)); return Math.min(d, 7 - d) }
      return entries.filter(x => x.session && isTimeTrial(x.session) && gap(x.day, long.day) < min)
        .map(() => ({ rule_id: 'INV-PLAN-TT-LONG-RUN-SPACING', week: w.n, day: null, detail: 'time trial beside the long run' }))
    })
  },
}
Object.assign(PREDICATES, BATCH_7)

const BATCH_8: Partial<Record<RuleId, Predicate>> = {
  // §40c: when the weekday cap materially binds (most weekday easy runs pinned at it) and costs enough
  // volume, the plan says so.
  'INV-PLAN-VOLUME-SHORTFALL-DECLARED': (plan, { input }) => {
    if (!input.max_weekday_mins) return []
    let easy = 0, pinned = 0
    for (const w of plan.weeks.filter(x => x.type !== 'deload' && x.type !== 'race' && x.badge !== 'deload')) {
      for (const { day, session: s } of daysOf(w)) {
        if (!s || s.type !== 'easy' || day === 'sat' || day === 'sun') continue
        easy++
        const cap = input.day_budgets?.[day as 'mon'] ?? input.max_weekday_mins
        if ((s.duration_mins ?? 0) >= cap - 1) pinned++
      }
    }
    const binding = easy > 0 && pinned / easy >= GENERATION_CONFIG.VOLUME_SHORTFALL_PINNED_SHARE
    const costly = (plan.meta.volume_shortfall_pct ?? 0) >= GENERATION_CONFIG.VOLUME_SHORTFALL_NOTE_THRESHOLD_PCT
    return binding && costly && !plan.meta.volume_shortfall_note
      ? [{ rule_id: 'INV-PLAN-VOLUME-SHORTFALL-DECLARED', week: PLAN, day: null, detail: 'binding weekday cap, no shortfall note' }] : []
  },

  // §82: a plan held at the easy floor for enough weeks is a declared maintenance profile with its note.
  'INV-PLAN-EASY-FLOOR-PROTECTION-DECLARED': plan => {
    const held = plan.weeks.filter(w => daysOf(w).some(x => x.session?.floor_protected)).length
    if (held < GENERATION_CONFIG.EASY_RUN_FLOOR_PROTECTION_MAINTENANCE_WEEKS) return []
    return plan.meta.volume_profile !== 'maintenance' || !plan.meta.volume_constraint_note
      ? [{ rule_id: 'INV-PLAN-EASY-FLOOR-PROTECTION-DECLARED', week: PLAN, day: null, detail: `${held} floor-held weeks, not declared` }] : []
  },

  // §29 / §37: the plan declares a fresh return exactly when the input says so (explicitly, or by the deep-
  // training-age, low-volume heuristic).
  'INV-PLAN-FRESH-RETURN-GATE': (plan, { input }) => {
    const explicit = input.weeks_at_current_volume !== undefined && input.weeks_at_current_volume < GENERATION_CONFIG.FRESH_RETURN_WEEKS_THRESHOLD
    const heuristic = (input.training_age === '2-5yr' || input.training_age === '5yr+')
      && input.current_weekly_km < GENERATION_CONFIG.HEURISTIC_FRESH_RETURN_WEEKLY_KM
      && input.longest_recent_run_km < GENERATION_CONFIG.HEURISTIC_FRESH_RETURN_LONG_RUN_KM
    return (explicit || heuristic) !== (plan.meta.fresh_return_active === true)
      ? [{ rule_id: 'INV-PLAN-FRESH-RETURN-GATE', week: PLAN, day: null, detail: 'fresh return declared against the inputs' }] : []
  },

  // §31: the compression class is stated, agrees with the two shortfall flags, and an input-constrained plan
  // does not read comfortable. One finding at most, in that order.
  'INV-PLAN-COMPRESSION-CLASSIFICATION': plan => {
    const c = plan.meta.compression_classification
    const short = plan.meta.time_compressed === true || plan.meta.volume_constrained === true
    const f = (detail: string) => [{ rule_id: 'INV-PLAN-COMPRESSION-CLASSIFICATION' as RuleId, week: PLAN, day: null, detail }]
    if (c === undefined) return f('no compression_classification')
    if ((c === 'optimal') !== !short) return f('class disagrees with the shortfall flags')
    if (c === 'constrained_by_inputs' && plan.meta.difficulty_band === 'comfortable') return f('constrained class reads comfortable')
    return []
  },

  // §101: the two compression flags are both stated, and the legacy `compressed` equals their OR.
  'INV-PLAN-COMPRESSION-SPLIT': plan => {
    const t = plan.meta.time_compressed, v = plan.meta.volume_constrained
    if (typeof t !== 'boolean' || typeof v !== 'boolean') return [{ rule_id: 'INV-PLAN-COMPRESSION-SPLIT', week: PLAN, day: null, detail: 'split flags not both stated' }]
    return plan.meta.compressed !== undefined && plan.meta.compressed !== (t || v)
      ? [{ rule_id: 'INV-PLAN-COMPRESSION-SPLIT', week: PLAN, day: null, detail: 'compressed is not the OR of the split' }] : []
  },

  // §57: enough uncovered runway before the plan is declared with its note.
  'INV-PLAN-UNCOVERED-RUNWAY-DECLARED': plan => {
    const u = plan.meta.uncovered_runway_weeks
    return typeof u === 'number' && u >= GENERATION_CONFIG.FOUNDATION_UNCOVERED_WEEKS_NOTE_THRESHOLD && !plan.meta.uncovered_runway_note
      ? [{ rule_id: 'INV-PLAN-UNCOVERED-RUNWAY-DECLARED', week: PLAN, day: null, detail: `${u} uncovered weeks, no note` }] : []
  },
}
Object.assign(PREDICATES, BATCH_8)

const BATCH_9: Partial<Record<RuleId, Predicate>> = {
  // §89: early quality onset only for a ready runner: no injury, regular recent quality, a deep training age, and
  // an intensity level above beginner. One finding however many conditions fail.
  // ⚠️ PORTED FAITHFULLY, INCLUDING A SAFETY HOLE (code review, batch 9): validatePlan reads the level as
  // `meta.fitness_intensity_level ?? input.user_declared_level ?? meta.fitness_level`. A beginner plan leaves the
  // first unset, so a runner who DECLARED a higher level but was assessed beginner passes the beginner veto. The
  // profile's intensity level would catch them; that change is a ruling, raised, not made here. Self-label read.
  'INV-PLAN-EARLY-ONSET-GATED': (plan, { input }) => {
    if (!plan.meta.early_quality_onset) return []
    const deep = input.training_age === '2-5yr' || input.training_age === '5yr+'
    const level = plan.meta.fitness_intensity_level ?? input.user_declared_level ?? plan.meta.fitness_level
    const fails = (input.injury_history ?? []).length > 0 || input.recent_quality_training !== 'regular'
      || !deep || level === 'beginner'
    return fails ? [{ rule_id: 'INV-PLAN-EARLY-ONSET-GATED', week: PLAN, day: null, detail: 'early onset for a runner who is not ready' }] : []
  },

  // §96: a runner who overdoes hard sessions never gets early onset.
  'INV-PLAN-OVERDO-BRAKE': (plan, { input }) => plan.meta.early_quality_onset && input.hard_session_relationship === 'overdo'
    ? [{ rule_id: 'INV-PLAN-OVERDO-BRAKE', week: PLAN, day: null, detail: 'early onset for an overdo runner' }] : [],

  // §91: base weeks (plus foundation credit) meet the floor; a gated early onset at a short distance has its own.
  'INV-PLAN-ONRAMP-FLOOR': (plan, { input }) => {
    const ramp = plan.weeks.filter(w => w.n >= 1 && w.phase === 'base').length + (plan.meta.foundation_weeks_planned ?? 0)
    const short = plan.meta.early_quality_onset
      && (GENERATION_CONFIG.ONSET_SHORT_ONRAMP_DISTANCES as readonly string[]).includes(raceDistanceKey(input.race_distance_km))
    const floor = short ? GENERATION_CONFIG.MIN_ONRAMP_WEEKS_GATED : GENERATION_CONFIG.MIN_BASE_WEEKS_FLOOR
    return ramp < floor ? [{ rule_id: 'INV-PLAN-ONRAMP-FLOOR', week: PLAN, day: null, detail: `${ramp} on-ramp weeks under ${floor}` }] : []
  },

  // §119 Am. 1: a short opening block is stamped exactly when it is noted, and never one without the other.
  'INV-PLAN-SHORT-OPENING-BLOCK-DECLARED': plan => {
    const stamp = plan.meta.short_opening_block_weeks
    const has = Array.isArray(stamp) && stamp.length > 0
    const note = typeof plan.meta.short_opening_block_note === 'string' && plan.meta.short_opening_block_note.length > 0
    if (has === note) return []
    return [{ rule_id: 'INV-PLAN-SHORT-OPENING-BLOCK-DECLARED', week: has ? (stamp![0] as number) : PLAN, day: null,
      detail: has ? 'stamped short block with no note' : 'note with no stamp' }]
  },

  // §24 Am. 1: a time-targeted half or marathon never declares a long-run floor miss that is only a rounding step.
  'INV-PLAN-LR-FLOOR-NOT-ROUNDING': (plan, { input, profile }) => {
    const key = raceDistanceKey(input.race_distance_km)
    if (profile.race.goal !== 'time_target' || (key !== 'HM' && key !== 'MARATHON')) return []
    const m = /Peak long run ([\d.]+) km is below the ([\d.]+) km floor/.exec(plan.meta.volume_constraint_note ?? '')
    if (!m) return []
    const short = Number(m[2]) - Number(m[1])
    return Number.isFinite(short) && short > 0 && short < GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM - 0.05
      ? [{ rule_id: 'INV-PLAN-LR-FLOOR-NOT-ROUNDING', week: PLAN, day: null, detail: `a ${short.toFixed(2)} km miss declared` }] : []
  },

  // §79: an intensity re-entry with no VO2 session in the plan says why.
  'INV-PLAN-REENTRY-OMISSION-DECLARED': plan => {
    if (!plan.meta.intensity_reentry_active) return []
    const vo2 = plan.weeks.some(w => w.n >= 1 && daysOf(w).some(x => x.session && x.session.type === 'quality' && isVo2maxSession(x.session, V1_SESSION_CATALOGUE)))
    return !vo2 && !plan.meta.intensity_reentry_omission_note
      ? [{ rule_id: 'INV-PLAN-REENTRY-OMISSION-DECLARED', week: PLAN, day: null, detail: 're-entry with no VO2 session and no note' }] : []
  },
}
Object.assign(PREDICATES, BATCH_9)

const longRuns = (plan: Plan, keep: (w: Week) => boolean) => plan.weeks.filter(keep).flatMap(w =>
  daysOf(w).filter((x): x is { day: VerifierDay; session: Session } => !!x.session && isLongRun(x.session)).map(x => ({ w, ...x })))
const longKm = (w: Week) => {
  const s = Object.values((w.sessions ?? {}) as Record<string, Session | undefined>).find(x => !!x && isLongRun(x))
  return s ? sessionKmSelfPaced(s) ?? 0 : 0
}

const BATCH_10: Partial<Record<RuleId, Predicate>> = {
  // §107: a time-targeted 5K to marathon build or peak long run at "Zone 2–3" records the segment pace it implies.
  'INV-PLAN-LR-SEGMENT-RECORDED': (plan, { input, profile }) => {
    const key = raceDistanceKey(input.race_distance_km)
    if (profile.race.goal !== 'time_target' || !['5K', '10K', 'HM', 'MARATHON'].includes(key)) return []
    return longRuns(plan, w => (w.phase === 'peak' || w.phase === 'build') && w.type !== 'deload')
      .filter(x => x.session.zone === 'Zone 2\u20133' && !x.session.lr_segment_pace)
      .map(x => ({ rule_id: 'INV-PLAN-LR-SEGMENT-RECORDED', week: x.w.n, day: x.day, detail: 'Zone 2-3 long run with no segment pace' }))
  },

  // §24c: no race-pace segment in a 5K/10K build-phase long run.
  'INV-PLAN-BUILD-LR-SEGMENT-CAP': (plan, { input, profile }) => {
    const key = raceDistanceKey(input.race_distance_km)
    if (profile.race.goal !== 'time_target' || (key !== '5K' && key !== '10K')) return []
    return longRuns(plan, w => w.phase === 'build' && w.type !== 'deload').filter(x => x.session.lr_segment_pace)
      .map(x => ({ rule_id: 'INV-PLAN-BUILD-LR-SEGMENT-CAP', week: x.w.n, day: x.day, detail: 'segment in a build long run' }))
  },

  // §24d: a finish goal has no race-pace segments in its long runs.
  'INV-PLAN-FINISH-GOAL-LR-CAP': (plan, { profile }) => profile.race.goal !== 'finish' ? []
    : longRuns(plan, () => true).filter(x => x.session.lr_segment_pace)
      .map(x => ({ rule_id: 'INV-PLAN-FINISH-GOAL-LR-CAP', week: x.w.n, day: x.day, detail: 'segment on a finish goal' })),

  // §24e: an ultra's long runs carry no pace segments.
  'INV-PLAN-ULTRA-NO-PACE-SEGMENTS': (plan, { input }) => {
    const key = raceDistanceKey(input.race_distance_km)
    if (key !== '50K' && key !== '100K') return []
    return longRuns(plan, () => true).filter(x => x.session.lr_segment_pace)
      .map(x => ({ rule_id: 'INV-PLAN-ULTRA-NO-PACE-SEGMENTS', week: x.w.n, day: x.day, detail: 'segment in an ultra long run' }))
  },

  // §106: the delivered peak is at least PEAK_FLOOR_VS_START_RATIO of the stated start (race weeks aside).
  'INV-PLAN-PEAK-NOT-BELOW-START': (plan, { input }) => {
    const start = input.current_weekly_km
    const weeks = plan.weeks.filter(w => w.phase !== 'foundation' && w.type !== 'deload' && w.type !== 'race'
      && !daysOf(w).some(x => x.session?.type === 'race'))
    if (!(start != null && start > 0) || !weeks.length) return []
    const peak = Math.max(...weeks.map(w => w.weekly_km))
    const floor = start * GENERATION_CONFIG.PEAK_FLOOR_VS_START_RATIO
    return peak + 0.5 < floor ? [{ rule_id: 'INV-PLAN-PEAK-NOT-BELOW-START', week: PLAN, day: null, detail: `peak ${peak} km under ${floor.toFixed(1)} km` }] : []
  },

  // §20: with a benchmark, the raw VDOT is never below the training anchor (the anchor is the discounted value).
  'INV-PLAN-VDOT-RAW-EXCEEDS-ANCHOR': (plan, { input }) => {
    const { vdot, vdot_training_anchor: anchor } = plan.meta
    return input.benchmark && vdot !== undefined && anchor !== undefined && vdot < anchor - 0.05
      ? [{ rule_id: 'INV-PLAN-VDOT-RAW-EXCEEDS-ANCHOR', week: PLAN, day: null, detail: `raw ${vdot} below anchor ${anchor}` }] : []
  },

  // §6 / §9: a taper long run is never longer than the peak's, beyond a tolerance.
  'INV-PLAN-TAPER-LR-NOT-ABOVE-PEAK': plan => {
    const weeks = plan.weeks.filter(w => w.n > 0 && w.type !== 'race' && w.type !== 'deload')
    const peak = Math.max(0, ...weeks.filter(w => w.phase === 'peak').map(longKm))
    if (!(peak > 0)) return []
    return weeks.filter(w => w.phase === 'taper' && longKm(w) > peak + GENERATION_CONFIG.TAPER_LR_VS_PEAK_TOLERANCE_KM)
      .map(w => ({ rule_id: 'INV-PLAN-TAPER-LR-NOT-ABOVE-PEAK', week: w.n, day: null, detail: 'taper long run above the peak' }))
  },

  // §32: a long enough plan points at a tune-up race somewhere.
  'INV-PLAN-TUNE-UP-CALLOUT': plan => {
    const main = plan.weeks.filter(w => w.n >= 1)
    return main.length >= GENERATION_CONFIG.TUNE_UP_MIN_PLAN_WEEKS && !main.some(w => !!w.tune_up_callout)
      ? [{ rule_id: 'INV-PLAN-TUNE-UP-CALLOUT', week: PLAN, day: null, detail: 'no tune-up callout' }] : []
  },
}
Object.assign(PREDICATES, BATCH_10)

/** The placeholder vocabulary §-ruled copy must never carry, and an unresolved template token. */
const PLACEHOLDERS = ['Target Race', 'TBD', 'undefined', 'null']
const TOKEN_RE = /\{\{[^}]*\}\}/

const BATCH_11: Partial<Record<RuleId, Predicate>> = {
  // §24e: the peak's longest long run (by minutes), once it is long enough, carries the fuelling note.
  'INV-PLAN-LONG-SESSION-FUELLING-NOTE': plan => {
    let best: Session | null = null, week = 0
    for (const w of plan.weeks.filter(x => x.phase === 'peak')) for (const { session: s } of daysOf(w)) {
      if (s?.role === 'long_run' && (s.duration_mins ?? 0) > (best?.duration_mins ?? 0)) { best = s; week = w.n }
    }
    if (!best || (best.duration_mins ?? 0) < GENERATION_CONFIG.FUELLING_PRACTICE_MIN_SESSION_MINS) return []
    const fuelled = (best.coach_notes ?? []).some(n => !!n && (n === FUELLING_PRACTICE_NOTE || n.startsWith(ULTRA_FUELLING_PREFIX)))
    return fuelled ? [] : [{ rule_id: 'INV-PLAN-LONG-SESSION-FUELLING-NOTE', week, day: null, detail: 'peak long session with no fuelling note' }]
  },

  // §40b: terrain that governs effort is declared with its note.
  'INV-PLAN-TERRAIN-EFFORT-NOTE-DECLARED': plan =>
    (GENERATION_CONFIG.TERRAIN_EFFORT_GOVERNS as readonly string[]).includes(plan.meta.terrain ?? '') && !plan.meta.terrain_effort_note
      ? [{ rule_id: 'INV-PLAN-TERRAIN-EFFORT-NOTE-DECLARED', week: PLAN, day: null, detail: 'effort terrain with no note' }] : [],

  // §51: a returning or fresh-return plan carries the returning-runner note.
  'INV-PLAN-RETURNING-RUNNER-NOTE-PRESENT': plan =>
    (plan.meta.returning_runner_allowance_active || plan.meta.fresh_return_active) && !plan.meta.returning_runner_note
      ? [{ rule_id: 'INV-PLAN-RETURNING-RUNNER-NOTE-PRESENT', week: PLAN, day: null, detail: 'returning plan with no note' }] : [],

  // No placeholder or unresolved token reaches the runner: meta prose, week labels and themes, session labels and
  // notes (a coach note is exempt from the token arm only). One finding per text per arm.
  'INV-PLAN-NO-PLACEHOLDER-COPY': plan => {
    const scan: [string, string | undefined][] = []
    const m = plan.meta as unknown as Meta
    for (const k of Object.keys(m)) {
      if (k !== 'coach_intro' && k !== 'plan_intro' && k !== 'notes' && k !== 'race_name' && k !== 'confidence_risks' && !k.endsWith('_note')) continue
      if (typeof m[k] === 'string') { scan.push([`meta.${k}`, m[k] as string]); continue }
      if (Array.isArray(m[k])) (m[k] as unknown[]).forEach((v, i) => { if (typeof v === 'string') scan.push([`meta.${k}[${i}]`, v]) })
    }
    for (const w of plan.weeks) {
      scan.push([`w${w.n}.label`, w.label]); scan.push([`w${w.n}.theme`, w.theme])
      for (const { day, session: s } of daysOf(w)) {
        if (!s) continue
        scan.push([`w${w.n}.${day}.label`, s.label])
        for (const n of s.coach_notes ?? []) scan.push([`w${w.n}.${day}.coach_note`, n])
      }
    }
    const out: Raw[] = []
    for (const [where, text] of scan) {
      if (!text) continue
      if (!where.endsWith('.coach_note') && TOKEN_RE.test(text)) out.push({ rule_id: 'INV-PLAN-NO-PLACEHOLDER-COPY', week: PLAN, day: null, detail: `token in ${where}` })
      const hit = PLACEHOLDERS.find(ph => text.includes(ph))
      if (hit) out.push({ rule_id: 'INV-PLAN-NO-PLACEHOLDER-COPY', week: PLAN, day: null, detail: `placeholder in ${where}` })
    }
    return out
  },

  // §79: a re-entry omission note names its cause, and only a returning runner is told they are coming back.
  'INV-PLAN-REENTRY-NOTE-MATCHES-CAUSE': plan => {
    const note = plan.meta.intensity_reentry_omission_note
    if (!note) return []
    const cause = plan.meta.intensity_reentry_cause
    if (!cause) return [{ rule_id: 'INV-PLAN-REENTRY-NOTE-MATCHES-CAUSE', week: PLAN, day: null, detail: 'note with no cause' }]
    return cause !== 'returning' && /coming back/i.test(note)
      ? [{ rule_id: 'INV-PLAN-REENTRY-NOTE-MATCHES-CAUSE', week: PLAN, day: null, detail: 'coming-back wording for a non-returning cause' }] : []
  },

  // §80 Am. 1: a race's opening-pace note names RACE_OPENING_FRACTION of the race distance, within half a kilometre.
  'INV-PLAN-RACE-NOTE-SCALES': plan => plan.weeks.flatMap(w => daysOf(w).flatMap(({ session: s }) => {
    if (!s || s.type !== 'race') return []
    const note = (s.coach_notes ?? []).find(n => typeof n === 'string' && /First [\d.]+ km/.test(n))
    if (!note) return []
    const stated = Number(/First ([\d.]+) km/.exec(note)?.[1])
    const km = s.distance_km ?? plan.meta.race_distance_km
    if (!Number.isFinite(stated) || !km) return []
    return Math.abs(stated - km * GENERATION_CONFIG.RACE_OPENING_FRACTION) > 0.5
      ? [{ rule_id: 'INV-PLAN-RACE-NOTE-SCALES' as RuleId, week: w.n, day: null, detail: `opening note says ${stated} km` }] : []
  })),
}
Object.assign(PREDICATES, BATCH_11)

const isDeloadWeek = (w: Week) => w.type === 'deload' || w.badge === 'deload'

const BATCH_12: Partial<Record<RuleId, Predicate>> = {
  // §119: a deload follows at least MIN_LOADING_BLOCK_WEEKS of loading (race weeks do not count as loading).
  'INV-PLAN-MIN-LOADING-BLOCK': plan => {
    const out: Raw[] = []
    let run = 0
    for (const w of plan.weeks.filter(x => x.n >= 1)) {
      if (isDeloadWeek(w)) {
        if (run < GENERATION_CONFIG.MIN_LOADING_BLOCK_WEEKS) out.push({ rule_id: 'INV-PLAN-MIN-LOADING-BLOCK', week: w.n, day: null, detail: `deload after ${run} loading weeks` })
        run = 0
      } else if (w.type !== 'race') run++
    }
    return out
  },

  // §64-family: an ordinary week places at least the runner's declared days (capped at the volume floor).
  'INV-PLAN-WEEK-DELIVERS-DECLARED-DAYS': (plan, { input }) => {
    const declared = Math.min(input.days_available ?? GENERATION_CONFIG.MAX_TRAINING_DAYS_PER_WEEK,
      GENERATION_CONFIG.MAX_TRAINING_DAYS_PER_WEEK, GENERATION_CONFIG.MIN_TRAINING_DAYS_VOLUME_FLOOR)
    return plan.weeks.filter(w => governed(w) && w.type !== 'race' && !isDeloadWeek(w) && w.phase !== 'foundation')
      .filter(w => running(w).length < declared)
      .map(w => ({ rule_id: 'INV-PLAN-WEEK-DELIVERS-DECLARED-DAYS', week: w.n, day: null, detail: `${running(w).length} days placed of ${declared}` }))
  },

  // §3: a deload (not following another) carries no more volume than the week before it.
  'INV-PLAN-DELOAD-IS-A-REDUCTION': plan => plan.weeks.slice(1).flatMap((w, k) => {
    const prev = plan.weeks[k]
    return isDeloadWeek(w) && !isDeloadWeek(prev) && w.weekly_km > prev.weekly_km
      ? [{ rule_id: 'INV-PLAN-DELOAD-IS-A-REDUCTION' as RuleId, week: w.n, day: null, detail: 'deload above the week before' }] : []
  }),

  // §95: no deload in the second week of the build phase.
  'INV-PLAN-DELOAD-PHASE-POSITION': plan => {
    const first = new Map<string, number>()
    for (const w of plan.weeks) { const ph = w.phase ?? 'base'; if (w.n >= 1 && !first.has(ph)) first.set(ph, w.n) }
    return plan.weeks.filter(w => w.n >= 1 && isDeloadWeek(w) && (w.phase ?? 'base') === 'build' && first.get('build') != null
      && w.n - first.get('build')! + 1 === 2)
      .map(w => ({ rule_id: 'INV-PLAN-DELOAD-PHASE-POSITION', week: w.n, day: null, detail: 'deload in build week 2' }))
  },

  // §7: the week's two largest sessions sit at least the configured gap apart.
  // ⚠️ PORTED FAITHFULLY: "size" is distance_km, else duration_mins, so km and minutes are compared; raised.
  'INV-PLAN-LARGEST-SESSIONS-SPACED': plan => {
    const min = Math.ceil(GENERATION_CONFIG.MIN_HOURS_BETWEEN_LARGEST_SESSIONS / 24)
    const size = (s: Session) => (s.type === 'race' ? 0 : (s.distance_km ?? s.duration_mins ?? 0))
    return plan.weeks.filter(w => w.n > 0 && w.type !== 'deload').flatMap(w => {
      const placed = daysOf(w).filter(x => !!x.session && size(x.session) > 0)
        .map(x => ({ day: x.day, size: size(x.session!) })).sort((a, b) => b.size - a.size)
      if (placed.length < 2) return []
      const ia = DAYS.indexOf(placed[0].day), ib = DAYS.indexOf(placed[1].day)
      if (ia < 0 || ib < 0) return []
      const gap = Math.min(Math.abs(ia - ib), 7 - Math.abs(ia - ib))
      return gap < min ? [{ rule_id: 'INV-PLAN-LARGEST-SESSIONS-SPACED' as RuleId, week: w.n, day: null, detail: `largest sessions ${gap} day(s) apart` }] : []
    })
  },

  // §23: the longest long run is not in base while later phases run shorter.
  'INV-PLAN-LONGEST-RUN-NOT-IN-BASE': plan => {
    const scored = plan.weeks.filter(w => w.n > 0 && w.type !== 'race' && w.type !== 'deload')
    const top = (ph: string) => Math.max(0, ...scored.filter(w => w.phase === ph).map(longKm))
    const base = top('base'), later = Math.max(top('build'), top('peak'), top('taper'))
    if (!(base > 0 && later > 0 && base > later)) return []
    return [{ rule_id: 'INV-PLAN-LONGEST-RUN-NOT-IN-BASE', week: scored.find(w => w.phase === 'base' && longKm(w) === base)?.n ?? PLAN, day: null, detail: 'longest long run is in base' }]
  },
}
Object.assign(PREDICATES, BATCH_12)

/** §90: an injury on the profile that the delivered-volume caps apply to, through the owner (a copied injury
 *  predicate drifted from its owner for nine days once, INJURY-GUARD-PREDICATE-01). */
const deliveredCapInjury = (profile: RunnerProfile) => hasDeliveredCapInjury(profile.injuries?.value ?? [])
/** ⚠️ A literal in validatePlan, not config: copied so the two agree, and raised with the shakeout RPE cap. */
export const DELIVERED_ROUNDING_TOLERANCE_PCT = 10

const BATCH_13: Partial<Record<RuleId, Predicate>> = {
  // §2: for a delivered-cap injury, the week after a deload never exceeds the week before the deload.
  'INV-PLAN-BOUNCEBACK-BOUNDED': (plan, { profile }) => {
    if (!deliveredCapInjury(profile)) return []
    const out: Raw[] = []
    for (let i = 2; i < plan.weeks.length; i++) {
      const bounce = plan.weeks[i], dl = plan.weeks[i - 1], pre = plan.weeks[i - 2]
      if (!isDeloadWeek(dl) || isDeloadWeek(bounce) || isDeloadWeek(pre) || bounce.phase === 'taper') continue
      if (bounce.weekly_km > pre.weekly_km + 0.01) out.push({ rule_id: 'INV-PLAN-BOUNCEBACK-BOUNDED', week: bounce.n, day: null, detail: 'bounce-back above the pre-deload week' })
    }
    return out
  },

  // §90: for a delivered-cap injury, the non-long volume rises at most the injury cap week on week (plus a
  // rounding tolerance and an absolute floor), deloads and taper aside.
  'INV-PLAN-INJURY-CAP-DELIVERED': (plan, { profile }) => {
    if (!deliveredCapInjury(profile)) return []
    const lk = (w: Week) => {
      const l = Object.values((w.sessions ?? {}) as Record<string, Session | undefined>).find(s => !!s && isLongRun(s))
      return sessionKmSelfPaced(l) ?? 0
    }
    const out: Raw[] = []
    for (let i = 1; i < plan.weeks.length; i++) {
      const w = plan.weeks[i], prev = plan.weeks[i - 1]
      if (isDeloadWeek(w) || isDeloadWeek(prev) || w.phase === 'taper') continue
      const now = w.weekly_km - lk(w), before = prev.weekly_km - lk(prev)
      if (before <= 0 || now <= before) continue
      const pct = ((now - before) / before) * 100
      if (pct > GENERATION_CONFIG.INJURY_WEEKLY_INCREASE_CAP_PCT + DELIVERED_ROUNDING_TOLERANCE_PCT && now - before > GENERATION_CONFIG.DELIVERED_ABSOLUTE_FLOOR_KM)
        out.push({ rule_id: 'INV-PLAN-INJURY-CAP-DELIVERED', week: w.n, day: null, detail: `non-long volume +${pct.toFixed(0)}%` })
    }
    return out
  },

  // §79: in a re-entry's first quality weeks (its budget), no VO2 catalogue row.
  'INV-PLAN-RETURNING-INTENSITY-REENTRY': plan => {
    if (!plan.meta.intensity_reentry_active) return []
    const budget = plan.meta.intensity_reentry_weeks ?? 0
    const weeks = new Set<number>()
    for (const w of plan.weeks) {
      if (w.n < 1 || weeks.size >= budget) continue
      if (daysOf(w).some(x => x.session?.type === 'quality')) weeks.add(w.n)
    }
    return plan.weeks.filter(w => governed(w) && weeks.has(w.n)).flatMap(w => running(w)
      .filter(x => x.session.catalogue_id && V1_SESSION_CATALOGUE.find(r => r.id === x.session.catalogue_id)?.category === 'vo2max')
      .map(x => ({ rule_id: 'INV-PLAN-RETURNING-INTENSITY-REENTRY' as RuleId, week: w.n, day: x.day, detail: 'VO2 session inside the re-entry window' })))
  },
}
Object.assign(PREDICATES, BATCH_13)

const TAPER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 }

const BATCH_14: Partial<Record<RuleId, Predicate>> = {
  // A coach note that names the taper's length names the real one.
  'INV-PLAN-TAPER-COPY-MATCHES-DURATION': plan => {
    const actual = plan.weeks.filter(w => w.phase === 'taper').length
    if (!actual) return []
    return plan.weeks.flatMap(w => daysOf(w).flatMap(({ day, session: s }) => {
      const m = /\b(one|two|three|four|five|\d+)[\s-]week taper\b/i.exec((s?.coach_notes ?? []).filter(Boolean).join(' '))
      if (!m) return []
      const stated = TAPER_WORDS[m[1].toLowerCase()] ?? Number(m[1])
      return Number.isFinite(stated) && stated !== actual
        ? [{ rule_id: 'INV-PLAN-TAPER-COPY-MATCHES-DURATION' as RuleId, week: w.n, day, detail: `note says ${stated}-week taper, plan has ${actual}` }] : []
    }))
  },

  // A goal below the easy ceiling is declared with its note.
  'INV-PLAN-GOAL-BELOW-EASY-DECLARED': plan => {
    const m = plan.meta as { goal_below_easy_ceiling?: boolean; goal_below_easy_ceiling_note?: string }
    return m.goal_below_easy_ceiling === true && !m.goal_below_easy_ceiling_note
      ? [{ rule_id: 'INV-PLAN-GOAL-BELOW-EASY-DECLARED', week: PLAN, day: null, detail: 'goal below easy, no note' }] : []
  },

  // §81: the worst undeclared structured weekday session over the cap (plus the maintenance allowance) is named,
  // once per plan.
  'INV-PLAN-STRUCTURED-OVERRUN-DECLARED': (plan, { input }) => {
    if (!input.max_weekday_mins && !input.day_budgets) return []
    const cap = (d: string) => input.day_budgets?.[d as 'mon'] ?? input.max_weekday_mins
    const limit = (d: string) => { const c = cap(d); return c != null ? c * (1 + GENERATION_CONFIG.LONG_RUN_WEEKDAY_OVERRUN_MAINTENANCE_PCT / 100) : Infinity }
    let worst = 0, week = 0
    for (const w of plan.weeks) {
      if (w.type === 'race') continue
      for (const { day, session: s } of daysOf(w)) {
        if (!s || day === 'sat' || day === 'sun' || isLongRun(s) || !isStructuredSession(s)) continue
        const mins = s.duration_mins ?? 0
        if (mins > limit(day) && !s.weekday_overrun_note && mins > worst) { worst = mins; week = w.n }
      }
    }
    return worst > 0 ? [{ rule_id: 'INV-PLAN-STRUCTURED-OVERRUN-DECLARED', week, day: null, detail: `${worst} min structured session over its weekday` }] : []
  },

  // §81: an unstructured weekday run over its budget carries the overrun note, and one within it does not.
  'INV-PLAN-WEEKDAY-OVERRUN-DECLARED': (plan, { input }) => plan.weeks.filter(w => w.type !== 'race' && w.badge !== 'race').flatMap(w =>
    (['mon', 'tue', 'wed', 'thu', 'fri'] as const).flatMap(d => {
      const s = (w.sessions as Record<string, Session | undefined> | undefined)?.[d]
      const c = weekdayCap(input, d)
      if (!s || c == null || !s.duration_mins || s.type === 'strength' || s.type === 'rest' || s.type === 'race') return []
      const over = s.duration_mins > c
      if (over === !!s.weekday_overrun_note) return []
      if (over && isStructuredSession(s) && !isLongRun(s)) return []
      return [{ rule_id: 'INV-PLAN-WEEKDAY-OVERRUN-DECLARED' as RuleId, week: w.n, day: d, detail: over ? 'over budget, no note' : 'note on a run within budget' }]
    })),
}
Object.assign(PREDICATES, BATCH_14)

const BATCH_15: Partial<Record<RuleId, Predicate>> = {
  // §10 Am.: a benchmark with no date is declared, never discounted for age.
  'INV-PLAN-VDOT-DISCOUNT-DATELESS': (plan, { input }) =>
    input.benchmark && !input.benchmark.benchmark_date && typeof plan.meta.vdot_discount_applied_pct === 'number'
      ? [{ rule_id: 'INV-PLAN-VDOT-DISCOUNT-DATELESS', week: PLAN, day: null, detail: 'dateless benchmark discounted' }] : [],

  // §44 Am. 2: a withheld half-marathon goal anchor makes the plan read demanding or harder, with its note.
  'INV-PLAN-GOAL-PAST-CV-DECLARED': plan => {
    if (plan.meta.hm_goal_anchor_withheld !== true) return []
    const band = plan.meta.difficulty_band, note = plan.meta.difficulty_note
    if (band === 'comfortable' || !band) return [{ rule_id: 'INV-PLAN-GOAL-PAST-CV-DECLARED', week: PLAN, day: null, detail: 'withheld anchor reads comfortable' }]
    return typeof note !== 'string' || !note.length ? [{ rule_id: 'INV-PLAN-GOAL-PAST-CV-DECLARED', week: PLAN, day: null, detail: 'withheld anchor with no note' }] : []
  },

  // §121: a race week never carries more volume than the peak (beyond a kilometre).
  'INV-PLAN-RACE-NOT-VOLUME': plan => {
    const peaks = plan.weeks.filter(w => w.phase === 'peak' && w.type !== 'deload').map(w => w.weekly_km ?? 0)
    const races = plan.weeks.filter(w => daysOf(w).some(x => x.session?.type === 'race'))
    if (!peaks.length || !races.length) return []
    const max = Math.max(...peaks)
    return races.filter(w => (w.weekly_km ?? 0) > max + 1).map(w => ({ rule_id: 'INV-PLAN-RACE-NOT-VOLUME', week: w.n, day: null, detail: 'race week above the peak' }))
  },

  // §42: the applied VDOT discount sits on the staleness ladder, and a dateless benchmark gets only the base rung.
  'INV-PLAN-VDOT-STALENESS-LADDER': (plan, { input }) => {
    const d = plan.meta.vdot_discount_applied_pct
    if (d == null) return []
    const base = GENERATION_CONFIG.VDOT_CONSERVATIVE_DISCOUNT_PCT, step = GENERATION_CONFIG.VDOT_STALENESS_PER_4WK_PCT
    // Guarded (code review): a zero or negative step would loop forever, and a hang cannot be caught as unverified.
    if (!(step > 0)) throw new Error('VDOT_STALENESS_PER_4WK_PCT must be positive')
    const rungs: number[] = []
    for (let k = 0, x = base; x <= GENERATION_CONFIG.VDOT_STALENESS_MAX_DISCOUNT_PCT + 1e-9; k++, x = base + k * step) rungs.push(Math.round(x * 1e6) / 1e6)
    const out: Raw[] = []
    if (!rungs.some(r => Math.abs(r - d) < 1e-6)) out.push({ rule_id: 'INV-PLAN-VDOT-STALENESS-LADDER', week: PLAN, day: null, detail: `off the ladder: discount ${d}` })
    if (!input.benchmark?.benchmark_date && Math.abs(d - base) > 1e-6) out.push({ rule_id: 'INV-PLAN-VDOT-STALENESS-LADDER', week: PLAN, day: null, detail: 'dateless benchmark off the base rung' })
    return out
  },

  // §17 (STATIC: reads rule data, not the plan): every focus category of the distance's signature is reachable
  // outside base in the catalogue.
  'INV-PLAN-PHASE-FOCUS-REACHABLE': (_plan, { input }) => {
    const key = raceDistanceKey(input.race_distance_km)
    const sig = PLAN_SIGNATURES[key as keyof typeof PLAN_SIGNATURES] as { quality_categories_focus?: readonly string[] } | undefined
    return (sig?.quality_categories_focus ?? []).filter(focus => !V1_SESSION_CATALOGUE.some(r => r.category === focus
      && (r.distance_eligibility as readonly string[]).includes(key) && r.phase_eligibility.some(p => p !== 'base')))
      .map(focus => ({ rule_id: 'INV-PLAN-PHASE-FOCUS-REACHABLE', week: PLAN, day: null, detail: `${focus} unreachable` }))
  },
}
Object.assign(PREDICATES, BATCH_15)

type Step = Record<string, unknown>
const workSteps = (s: Session | undefined): Step[] => {
  const ds = (s as { derived_set?: { blocks?: Array<{ steps?: Step[] }> } } | null | undefined)?.derived_set
  return (ds?.blocks ?? []).flatMap(b => b.steps ?? []).filter(st => st.role === 'work')
}

const BATCH_16: Partial<Record<RuleId, Predicate>> = {
  // §19: every quality session tells the runner how hard, by a pace or an RPE.
  'INV-PLAN-EFFORT-OR-PACE': plan => plan.weeks.flatMap(w => daysOf(w).filter(({ session: s }) => !!s && isQualitySession(s)
    && !(typeof s.pace_target === 'string' && s.pace_target.trim().length > 0) && !(typeof s.rpe_target === 'number' && s.rpe_target > 0))
    .map(x => ({ rule_id: 'INV-PLAN-EFFORT-OR-PACE' as RuleId, week: w.n, day: x.day, detail: 'quality with no pace and no effort' }))),

  // §19: a derived WORK step authored against a pace anchor carries a resolved pace. One finding per step.
  'INV-PLAN-DERIVED-SET-PACED': plan => plan.weeks.flatMap(w => daysOf(w).flatMap(({ session: s }) =>
    workSteps(s).filter(st => st.pace_mode !== undefined && st.pace == null)
      .map(() => ({ rule_id: 'INV-PLAN-DERIVED-SET-PACED' as RuleId, week: w.n, day: null, detail: 'anchored work step with no pace' })))),

  // §8: a zone-described work step with no pace anchor shows its transition (an arrow), unless it is unpaced.
  'INV-PLAN-PROGRESSION-TRANSITION-PACED': plan => plan.weeks.flatMap(w => daysOf(w).flatMap(({ session: s }) =>
    workSteps(s).filter(st => st.pace_mode === undefined && typeof st.zone === 'string' && st.zone !== ''
      && !(typeof st.pace === 'string' && st.pace.includes('\u2192')) && st.pace != null)
      .map(() => ({ rule_id: 'INV-PLAN-PROGRESSION-TRANSITION-PACED' as RuleId, week: w.n, day: null, detail: 'progression step with a flat pace' })))),

  // §12: an easy run (not the long run) never names a zone above 2.
  'INV-PLAN-EASY-RUN-ZONE-CAP': plan => plan.weeks.flatMap(w => daysOf(w).filter(({ session: s }) => !!s && s.type === 'easy' && !!s.zone
    && !isLongRun(s) && /\b[3-5]\b/.test(String(s.zone)) && !/^Z?2\b/.test(String(s.zone)))
    .map(x => ({ rule_id: 'INV-PLAN-EASY-RUN-ZONE-CAP' as RuleId, week: w.n, day: x.day, detail: `easy run at ${x.session!.zone}` }))),
}
Object.assign(PREDICATES, BATCH_16)

const SEVERITY = new Map(RULES.map(r => [r.id, r.kind === 'soft' ? 'warn' as const : 'error' as const]))

/** Every finding the ported predicates raise, with the severity the catalogue gives the rule. */
export function verifyPlan(plan: Plan, ctx: VerifyContext): VerifierFinding[] {
  // Each predicate is isolated (code review): one that cannot evaluate returns an UNVERIFIED finding for
  // its own rule, rather than ending the run and losing every other rule's findings. Never a silent pass.
  return (Object.entries(PREDICATES) as [RuleId, Predicate][]).flatMap(([id, p]) => {
    try { return p(plan, ctx) } catch (e) {
      return [{ rule_id: id, week: PLAN, day: null, detail: `unverified: ${e instanceof Error ? e.message : String(e)}` }]
    }
  }).map(f => ({ ...f, severity: SEVERITY.get(f.rule_id) ?? 'error' }))
}

export const PORTED_RULES = Object.keys(PREDICATES) as RuleId[]
