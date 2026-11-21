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
import { isLongRun, isShakeout, isSecondaryQuality, isQualitySession, isStructuredSession, isTimeTrial } from '@/lib/plan/sessionRole'
import { normaliseDays, dayGap } from '@/lib/plan/days'
import { sessionKmSelfPaced } from '@/lib/plan/sessionDistance'
import { hasInjuryKeyword } from '@/lib/plan/injuryScope'
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

  // §81: an unstructured weekday run fits the time the runner gave that day, unless held at §82's floor.
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
  // §18/§10: the stated longest run cannot exceed the stated week.
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

  // §39 Am. 1 / §26: in the protected days before a race, nothing longer than the shakeout cap.
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

  // §87 (with §3's cadence): no deload opens a base or build phase, and placement never yields fewer
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
    if (deloads.length < due) out.push({ rule_id: 'INV-PLAN-DELOAD-PLACEMENT', week: PLAN, day: null, detail: `${deloads.length} deloads, cadence calls for ${due}` })
    return out
  },
}
Object.assign(PREDICATES, BATCH_3)

const BATCH_4: Partial<Record<RuleId, Predicate>> = {
  // §8 (+ §110): quality sessions per week stay under the ceiling for the runner's INTENSITY level. A
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
    if (m.prep_time_status === 'warned' && (!m.prep_time_warning || !m.prep_time_alternatives))
      out.push({ rule_id: 'INV-PLAN-PREP-TIME-STATUS-ANNOTATED', week: PLAN, day: null, detail: 'warned without its warning or alternatives' })
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
      ? [{ rule_id: 'INV-PLAN-HR-ASSUMPTIONS-SURFACED', week: PLAN, day: null, detail: `${method} with no assumption note` }] : []
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
      return entries.filter(x => x.session && isTimeTrial(x.session) && dayGap(x.day as never, long.day as never) < min)
        .map(() => ({ rule_id: 'INV-PLAN-TT-LONG-RUN-SPACING', week: w.n, day: null, detail: 'time trial beside the long run' }))
    })
  },
}
Object.assign(PREDICATES, BATCH_7)

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
