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
import { isLongRun, isShakeout, isSecondaryQuality, isQualitySession, isStructuredSession, isTimeTrial, isVo2maxSession, classifyStimulus, isHardEffort, workClassFor } from '@/lib/plan/sessionRole'
import { V1_SESSION_CATALOGUE } from '@/lib/plan/sessionCatalogueData'
import { FUELLING_PRACTICE_NOTE, ULTRA_FUELLING_PREFIX } from '@/lib/plan/fuellingNotes'
import { PLAN_SIGNATURES } from '@/lib/plan/planSignatures'
import { normaliseDays } from '@/lib/plan/days'
import { sessionKmSelfPaced } from '@/lib/plan/sessionDistance'
import { hasInjuryKeyword, hasDeliveredCapInjury, hasVolumeCappedInjuryHistory } from '@/lib/plan/injuryScope'
import { BENCHMARK_VDOT_MAX } from '@/lib/plan/benchmarkCheck'
import { parsePaceMidpoint } from '@/lib/plan/paceParse'
import { catalogueRowFor } from '@/lib/plan/catalogueLink'
import { SESSION_FORMAT } from '@/lib/plan/sessionFormat'
import { workAnchorsOf, goalPaceShapeWord, isV2Structure, StructureV2Schema } from '@/lib/plan/sessionStructureV2'
import { isEffortGovernedRow } from '@/lib/plan/hrBand'
import { zoneStringFromZoneKeys } from '@/lib/coaching/zoneRules'

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
/** A predicate's finding. `severity` is set only by a rule whose severity is CONDITIONAL (its catalogue entry has a
 *  severity_note); every other rule takes the catalogue's. */
type Raw = Omit<VerifierFinding, 'severity'> & { severity?: 'error' | 'warn' }
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

/** §9 (+ Am. 3): the long run's minute ceiling: a race distance's cap, lowered by any injury on the profile. One
 *  owner for every verifier rule that needs it (the race distance is passed, since one rule reads it from meta). */
function longCapMinsFor(km: number, profile: RunnerProfile): number {
  const injuries = profile.injuries?.value ?? []
  const caps = Object.entries(GENERATION_CONFIG.LONG_RUN_CAP_MINUTES_BY_INJURY)
    .filter(([k]) => hasInjuryKeyword(injuries, k)).map(([, m]) => m as number)
  return Math.min(GENERATION_CONFIG.LONG_RUN_CAP_MINUTES[raceDistanceKey(km)], ...caps)
}
const longCapMins = (input: GeneratorInput, profile: RunnerProfile) => longCapMinsFor(input.race_distance_km, profile)

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

const BATCH_17: Partial<Record<RuleId, Predicate>> = {
  // §66 Am. 1: every long run has an axis: a positive, finite distance or duration.
  'INV-PLAN-LONG-RUN-HAS-AN-AXIS': plan => plan.weeks.flatMap(w => daysOf(w).filter(({ session: s }) => !!s && isLongRun(s)
    && !(s.distance_km != null && Number.isFinite(s.distance_km) && s.distance_km > 0)
    && !(s.duration_mins != null && Number.isFinite(s.duration_mins) && s.duration_mins > 0))
    .map(() => ({ rule_id: 'INV-PLAN-LONG-RUN-HAS-AN-AXIS' as RuleId, week: w.n, day: null, detail: 'long run with no distance or duration' }))),

  // §25 Am. 1: a race-pace long run's "Final N% at" note sits inside the ratified band.
  'INV-PLAN-LR-RACE-SEGMENT-PCT': plan => plan.weeks.flatMap(w => daysOf(w).flatMap(({ session: s }) => {
    if (!s || !isLongRun(s) || !s.lr_segment_pace) return []
    const note = (s.coach_notes ?? []).find(n => typeof n === 'string' && /^Final \d+% at /.test(n))
    const pct = note ? Number(/^Final (\d+)%/.exec(note)?.[1]) : NaN
    if (!Number.isFinite(pct)) return []
    return pct < GENERATION_CONFIG.LR_RACE_SEGMENT_PCT_MIN || pct > GENERATION_CONFIG.LR_RACE_SEGMENT_PCT_MAX
      ? [{ rule_id: 'INV-PLAN-LR-RACE-SEGMENT-PCT' as RuleId, week: w.n, day: null, detail: `final ${pct}% at race pace` }] : []
  })),

  // §1: an ordinary build or peak week for an intermediate or experienced runner (who does not avoid hard sessions
  // and has no Achilles history) carries quality when an eligible weekday is free, unless intentionally downgraded.
  // ⚠️ Ported faithfully: the level is the plan's own meta, and the Achilles test matches injury text. Both raised.
  'INV-PLAN-QUALITY-EXPECTED': (plan, { input }) => {
    const level = plan.meta.fitness_intensity_level ?? plan.meta.fitness_level
    const achilles = (input.injury_history ?? []).some(i => i.toLowerCase().includes('achilles'))
    if (!(level === 'intermediate' || level === 'experienced') || input.hard_session_relationship === 'avoid' || achilles) return []
    const blocked = normaliseDays(input.days_cannot_train)
    if (!(['wed', 'thu', 'tue', 'mon', 'fri'] as const).some(d => !blocked.has(d))) return []
    return plan.weeks.filter(w => governed(w) && w.type !== 'race' && w.phase && w.phase !== 'base' && w.phase !== 'foundation'
      && w.type !== 'deload' && !w.quality_downgraded && !running(w).some(x => x.session.type === 'quality'))
      .map(w => ({ rule_id: 'INV-PLAN-QUALITY-EXPECTED' as RuleId, week: w.n, day: null, detail: 'no quality in a build or peak week' }))
  },
}
Object.assign(PREDICATES, BATCH_17)

// ⚠️ SELF-LABEL READ (recorded): the plan's stamped injury list, as validatePlan reads it, not the request's.
const metaInjuries = (plan: Plan) => (plan.meta.injury_history ?? []).map(i => String(i).toLowerCase())

const BATCH_18: Partial<Record<RuleId, Predicate>> = {
  // §117 Am. 2: a finish-goal run-walk plan's biggest main-week session reaches the floor.
  // ⚠️ Ported faithfully: "peak" is the largest SESSION of any kind, not the long run.
  'INV-PLAN-RUNWALK-ADEQUATE': plan => {
    if (!plan.meta.finish_goal_run_walk) return []
    let peak = 0
    for (const w of plan.weeks.filter(x => x.n > 0 && x.type !== 'race' && x.type !== 'deload'))
      for (const { session: s } of daysOf(w)) peak = Math.max(peak, sessionKmSelfPaced(s) ?? 0)
    return peak > 0 && peak < GENERATION_CONFIG.FINISH_GOAL_RUNWALK_MIN_PEAK_LR_KM
      ? [{ rule_id: 'INV-PLAN-RUNWALK-ADEQUATE', week: PLAN, day: null, detail: `peak session ${peak.toFixed(1)} km` }] : []
  },

  // §117 Am. 4: run-walk is never the answer for a volume-capped injury. (Reads the plan's stamped injury list.)
  'INV-PLAN-RUNWALK-CAP-NOT-REDUCED': plan => plan.meta.finish_goal_run_walk && hasVolumeCappedInjuryHistory(metaInjuries(plan))
    ? [{ rule_id: 'INV-PLAN-RUNWALK-CAP-NOT-REDUCED', week: PLAN, day: null, detail: 'run-walk with a volume-capped injury' }] : [],

  // §80 Am. 1: a long-run shortfall note that blames weekly volume is wrong when an injury caps the volume, and
  // wrong when the long run already sits at its minute cap.
  'INV-PLAN-LR-SHORTFALL-CAUSE': (plan, { profile }) => {
    const note = plan.meta.long_run_shortfall_note
    if (typeof note !== 'string' || !note.length || !note.includes('your weekly volume is what limits it')) return []
    const km = plan.meta.race_distance_km
    const cap = typeof km === 'number' && km > 0 ? longCapMinsFor(km, profile) : 0
    let lr = 0
    for (const w of plan.weeks.filter(x => x.n >= 1 && x.type !== 'race'))
      for (const { session: s } of daysOf(w)) if (s && isLongRun(s) && typeof s.duration_mins === 'number') lr = Math.max(lr, s.duration_mins)
    const out: Raw[] = []
    if (hasVolumeCappedInjuryHistory(metaInjuries(plan))) out.push({ rule_id: 'INV-PLAN-LR-SHORTFALL-CAUSE', week: PLAN, day: null, detail: 'blames volume for an injury cap' })
    if (cap > 0 && lr > 0 && lr + GENERATION_CONFIG.LONG_RUN_AT_CAP_TOLERANCE_MINS >= cap) out.push({ rule_id: 'INV-PLAN-LR-SHORTFALL-CAUSE', week: PLAN, day: null, detail: 'blames volume at the minute cap' })
    return out
  },
}
Object.assign(PREDICATES, BATCH_18)

const BATCH_19: Partial<Record<RuleId, Predicate>> = {
  // §1: across the main plan, quality sessions are at most the distance's share of running sessions (not on a
  // maintenance profile). The COUNT is done here (planQualityCounts is the producer's too); the per-session
  // classification still goes through isQualitySession, the shared classification owner the HLD allows, so a
  // misclassification there is shared by both sides.
  'INV-PLAN-INTENSITY-DISTRIBUTION': (plan, { input }) => {
    const dist = GENERATION_CONFIG.INTENSITY_DISTRIBUTION[raceDistanceKey(input.race_distance_km) as keyof typeof GENERATION_CONFIG.INTENSITY_DISTRIBUTION]
    if (!dist || plan.meta.volume_profile === 'maintenance') return []
    const weeks = GENERATION_CONFIG.INTENSITY_DISTRIBUTION_COUNTS_FOUNDATION_WEEKS ? plan.weeks : plan.weeks.filter(w => w.n >= 1)
    let runs = 0, hard = 0
    for (const w of weeks) for (const { session: s } of daysOf(w)) {
      if (!s || s.type === 'rest' || s.type === 'strength' || s.type === 'cross-train') continue
      runs++
      if (isQualitySession(s)) hard++
    }
    return runs > 0 && (hard / runs) * 100 > dist.max_quality_session_pct
      ? [{ rule_id: 'INV-PLAN-INTENSITY-DISTRIBUTION', week: PLAN, day: null, detail: `${((hard / runs) * 100).toFixed(1)}% quality` }] : []
  },

  // §25: race-pace long runs in the build sit only in its last RACE_PACE_LR_BUILD_WEEKS non-deload weeks, and never
  // three weeks running.
  'INV-PLAN-RACE-PACE-LR-BUILD-WINDOW': plan => {
    const main = plan.weeks.filter(w => w.n >= 1)
    const seg = (w: Week) => daysOf(w).some(x => !!x.session && isLongRun(x.session) && Boolean(x.session.lr_segment_pace))
    const out: Raw[] = []
    const build = (plan.phases ?? []).find(p => p.name === 'build')
    if (build?.end_week != null) {
      const legal = new Set<number>()
      for (let n = build.end_week, placed = 0; n >= (build.start_week ?? 1) && placed < GENERATION_CONFIG.RACE_PACE_LR_BUILD_WEEKS; n--) {
        const wk = main.find(x => x.n === n)
        if (!wk || isDeloadWeek(wk)) continue
        legal.add(n); placed++
      }
      for (const w of main) if (w.phase === 'build' && seg(w) && !legal.has(w.n)) out.push({ rule_id: 'INV-PLAN-RACE-PACE-LR-BUILD-WINDOW', week: w.n, day: null, detail: 'segment long run outside the build window' })
    }
    let run = 0
    for (const w of main) {
      run = seg(w) ? run + 1 : 0
      // The FIRST streak only, as validatePlan reports it (it breaks after one finding).
      if (run >= 3) { out.push({ rule_id: 'INV-PLAN-RACE-PACE-LR-BUILD-WINDOW', week: w.n, day: null, detail: 'three segment long runs in a row' }); break }
    }
    return out
  },
}
Object.assign(PREDICATES, BATCH_19)

const BATCH_20: Partial<Record<RuleId, Predicate>> = {
  // §106: across base/build/peak (no taper, deload or race week) no week falls more than MAX_DELIVERED_DECLINE_PCT
  // below week 1. Always a warning today (the registry notes a planned promotion; that is not a condition).
  'INV-PLAN-NOT-DETRAINING': plan => {
    const prog = plan.weeks.filter(w => w.n >= 1 && w.phase !== 'taper' && !isDeloadWeek(w) && w.type !== 'race'
      && !daysOf(w).some(x => x.session?.type === 'race'))
    if (prog.length < 2) return []
    const w1 = prog[0].weekly_km ?? 0, low = Math.min(...prog.map(w => w.weekly_km ?? 0))
    if (!(w1 > 0 && low > 0)) return []
    const pct = ((w1 - low) / w1) * 100
    return pct > GENERATION_CONFIG.MAX_DELIVERED_DECLINE_PCT
      ? [{ rule_id: 'INV-PLAN-NOT-DETRAINING', week: prog.find(w => (w.weekly_km ?? 0) === low)?.n ?? PLAN, day: null, detail: `${pct.toFixed(0)}% below week 1` }] : []
  },

  // §23: the peak phase reaches the plan's highest volume (within a plateau tolerance). CONDITIONAL severity: a
  // warning on a maintenance profile, an error otherwise.
  'INV-PLAN-PEAK-IN-PEAK-PHASE': plan => {
    const nd = plan.weeks.filter(w => w.n > 0 && w.type !== 'race' && w.type !== 'deload')
    const peak = nd.filter(w => w.phase === 'peak')
    if (nd.length <= 1 || !peak.length) return []
    const max = Math.max(...nd.map(w => w.weekly_km))
    if (peak.some(w => w.weekly_km >= max * (1 - GENERATION_CONFIG.PEAK_INVERSION_MATERIAL_PCT / 100))) return []
    return [{ rule_id: 'INV-PLAN-PEAK-IN-PEAK-PHASE', week: (nd.find(w => w.weekly_km === max) ?? nd[0]).n, day: null,
      detail: 'peak phase short of the plan max', severity: plan.meta.volume_profile === 'maintenance' ? 'warn' : 'error' }]
  },
}
Object.assign(PREDICATES, BATCH_20)

const BATCH_21: Partial<Record<RuleId, Predicate>> = {
  // §52: no single session (of any running kind) is more than LONG_RUN_MAX_PCT_OF_WEEKLY of its week; a foundation
  // week with under three runs is exempt. CONDITIONAL severity: warn on a maintenance profile, error otherwise.
  'INV-PLAN-LR-MAX-WEEKLY-PCT': plan => {
    const cap = GENERATION_CONFIG.LONG_RUN_MAX_PCT_OF_WEEKLY / 100
    const severity = plan.meta.volume_profile === 'maintenance' ? 'warn' as const : 'error' as const
    return plan.weeks.filter(w => w.type !== 'race' && w.type !== 'deload' && w.weekly_km > 0).flatMap(w => {
      if (w.phase === 'foundation' && daysOf(w).filter(x => x.session && x.session.type !== 'rest' && x.session.type !== 'cross-train').length < 3) return []
      return daysOf(w).flatMap(({ day, session: s }) => {
        if (!s || s.type === 'strength' || s.type === 'rest') return []
        const km = sessionKmSelfPaced(s)
        return km != null && km / w.weekly_km > cap + 0.005
          ? [{ rule_id: 'INV-PLAN-LR-MAX-WEEKLY-PCT' as RuleId, week: w.n, day, detail: `a session at ${Math.round((km / w.weekly_km) * 100)}% of the week`, severity }] : []
      })
    })
  },

  // §47 Am. 2–3: a peak step-back week (stamped, or by its legacy note) delivers less than the week before it, unless
  // every easy run is at the floor; when the long run's §52 share floor sits above the previous week, it is a declared
  // residual (warn), otherwise an error. Non-injury runners only. CONDITIONAL severity.
  'INV-PLAN-PEAK-STEPBACK-VOLUME': (plan, { input }) => {
    if ((input.injury_history ?? []).length !== 0) return []
    const tol = GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM, minEasy = GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.easy
    const out: Raw[] = []
    for (let i = 1; i < plan.weeks.length; i++) {
      const w = plan.weeks[i], prev = plan.weeks[i - 1]
      if (w.phase !== 'peak' || w.type === 'deload') continue
      const lr = Object.values((w.sessions ?? {}) as Record<string, Session | undefined>).find(s => !!s && isLongRun(s))
      const stepBack = w.peak_stepback === true || (lr?.coach_notes ?? []).some(n => n?.includes('Step-back week. Easy aerobic'))
      if (!lr || !stepBack || !prev || prev.type === 'deload' || w.weekly_km <= prev.weekly_km + tol) continue
      const easies = daysOf(w).map(x => x.session).filter((s): s is Session => !!s && s.type === 'easy' && s.role !== 'long_run')
      if (easies.every(s => (s.distance_km != null ? s.distance_km <= minEasy + 0.01 : true))) continue
      const floor = lr.distance_km != null && lr.distance_km > 0 ? lr.distance_km / (GENERATION_CONFIG.LONG_RUN_MAX_PCT_OF_WEEKLY / 100) : null
      out.push(floor != null && floor > prev.weekly_km + tol
        ? { rule_id: 'INV-PLAN-PEAK-STEPBACK-VOLUME', week: w.n, day: null, detail: '§52 share floor above the previous week', severity: 'warn' }
        : { rule_id: 'INV-PLAN-PEAK-STEPBACK-VOLUME', week: w.n, day: null, detail: 'step-back week climbs', severity: 'error' })
    }
    return out
  },
}
Object.assign(PREDICATES, BATCH_21)

/** A step length in minutes: `"8 min"` or `"m:ss"`; anything else is 0, as validatePlan reads it. */
const stepMins = (len: unknown): number => {
  const t = String(len ?? '')
  const m = /^(\d+(?:\.\d+)?)\s*min/.exec(t)
  if (m) return Number(m[1])
  const c = /^(\d+):(\d{2})$/.exec(t)
  return c ? Number(c[1]) + Number(c[2]) / 60 : 0
}
const LEVEL_RANK = { beginner: 0, intermediate: 1, experienced: 2 } as const

/** A week's quality sessions with their day, tolerating a day that holds a list (validatePlan's goal-pace block). */
const qualityOf = (w: Week) => daysOf(w).flatMap(({ day, session: v }) =>
  ((Array.isArray(v) ? v : [v]) as (Session | undefined)[]).filter((s): s is Session => !!s && s.type === 'quality').map(s => ({ day, s })))

const BATCH_22: Partial<Record<RuleId, Predicate>> = {
  // §98: the onset yield ladder never walks past its ungated bound. ⚠️ A SELF-LABEL READ, ported faithfully: both
  // numbers are the planner's own `meta.onset_yield` stamp. Raised for the board batch.
  'INV-PLAN-ONSET-YIELD-BOUNDED': plan => {
    const y = plan.meta.onset_yield
    return y && y.effective > y.bound ? [{ rule_id: 'INV-PLAN-ONSET-YIELD-BOUNDED', week: PLAN, day: null, detail: `effective ${y.effective} over bound ${y.bound}` }] : []
  },

  // §7: a quality session sits at least MIN_HOURS_BETWEEN_QUALITY_AND_LONG (in whole days) from the week's first
  // long run, counting round the week. Written here, not shared: the old helper is also the reshape path's.
  'INV-PLAN-QUALITY-LONG-SPACING': plan => {
    const minDays = Math.ceil(GENERATION_CONFIG.MIN_HOURS_BETWEEN_QUALITY_AND_LONG / 24)
    return plan.weeks.filter(governed).flatMap(w => {
      const week = DAYS.map(d => w.sessions?.[d])
      const li = week.findIndex(s => !!s && isLongRun(s))
      if (li < 0) return []
      return week.flatMap((s, qi) => {
        if (s?.type !== 'quality') return []
        const gap = Math.min(Math.abs(qi - li), 7 - Math.abs(qi - li))
        return gap < minDays ? [{ rule_id: 'INV-PLAN-QUALITY-LONG-SPACING' as RuleId, week: w.n, day: DAYS[qi], detail: `${gap} day(s) from the long run` }] : []
      })
    })
  },

  // Every placed catalogue row sits inside its distance and level eligibility, except a taper race-specific row
  // where no race-specific taper row fits this runner at all. ⚠️ The level is the plan's own meta (self-label
  // read), as validatePlan reads it.
  'INV-PLAN-CATALOGUE-ELIGIBLE': (plan, { input }) => {
    const level = (plan.meta.fitness_intensity_level ?? plan.meta.fitness_level ?? 'beginner') as keyof typeof LEVEL_RANK
    const dk = raceDistanceKey(input.race_distance_km)
    const R = LEVEL_RANK as Record<string, number>
    const fits = (r: (typeof V1_SESSION_CATALOGUE)[number]) => R[r.fitness_level_min] <= R[level]
      && (r.fitness_level_max == null || R[level] <= R[r.fitness_level_max])
    return plan.weeks.filter(w => w.n >= 1).flatMap(w => qualityOf(w).flatMap(({ day, s }) => {
      const row = s.catalogue_id ? V1_SESSION_CATALOGUE.find(r => r.id === s.catalogue_id) : undefined
      if (!row) return []
      const fitsDistance = row.distance_eligibility.includes(dk)
      const noFittingTaperRow = w.phase === 'taper' && row.category === 'race_specific' && fitsDistance
        && !V1_SESSION_CATALOGUE.some(r => r.category === 'race_specific' && r.phase_eligibility.includes('taper') && r.distance_eligibility.includes(dk) && fits(r))
      return (!fitsDistance || !fits(row)) && !noFittingTaperRow
        ? [{ rule_id: 'INV-PLAN-CATALOGUE-ELIGIBLE' as RuleId, week: w.n, day, detail: `${row.id} outside its eligibility` }] : []
    }))
  },

  // §22 Am. 3: on a 5K time goal (or a beginner's 10K), second-half build/peak goal-pace work comes as reps, never one
  // long continuous step; beginner goal-pace reps stay under their session total. The SCOPE reads the goal as the
  // runner STATED it, as validatePlan does (not the normalised one), and the level is the plan's meta (self-label).
  'INV-PLAN-GOAL-PACE-SHAPE': (plan, { input, profile }) => {
    const level = plan.meta.fitness_intensity_level ?? plan.meta.fitness_level ?? 'beginner'
    const dk = raceDistanceKey(input.race_distance_km)
    const half = Math.ceil(plan.weeks.filter(w => w.n >= 1).length / 2)
    const scope = profile.race.goal_stated === 'time_target' && (dk === '5K' || (dk === '10K' && level === 'beginner'))
    return plan.weeks.filter(w => w.n >= 1).flatMap(w => qualityOf(w).flatMap(({ day, s }) => {
      if (classifyStimulus(s) !== 'race_pace') return []
      const work = (s.derived_set?.blocks ?? []).flatMap(b => (b.steps ?? []).map(st => ({ st, repeat: typeof b.repeat === 'number' ? b.repeat : 1 })))
        .filter(x => x.st.role === 'work' && x.st.pace_mode === 'target')
      const out: Raw[] = []
      if (scope && w.n > half && (w.phase === 'build' || w.phase === 'peak')) {
        const longest = Math.max(0, ...work.filter(x => x.repeat <= 1).map(x => stepMins(x.st.length)))
        if (longest > GENERATION_CONFIG.GOAL_PACE_CONTINUOUS_MAX_MINS) out.push({ rule_id: 'INV-PLAN-GOAL-PACE-SHAPE', week: w.n, day, detail: `${longest} min continuous` })
      }
      if (s.catalogue_id === 'beginner_goal_pace_reps') {
        const mins = work.reduce((n, x) => n + stepMins(x.st.length) * x.repeat, 0)
        if (mins > GENERATION_CONFIG.BEGINNER_GOAL_PACE_MAX_SESSION_MINS) out.push({ rule_id: 'INV-PLAN-GOAL-PACE-SHAPE', week: w.n, day, detail: `${mins} min at goal pace` })
      }
      return out
    }))
  },

  // §120: HM-pace reps on a time-goal plan run within 3% of the goal pace.
  'INV-PLAN-RACE-ANCHOR-MATCHES-GOAL': (plan, { profile }) => {
    const goal = profile.race.goal === 'time_target' && plan.meta.goal_pace_per_km ? parsePaceMidpoint(plan.meta.goal_pace_per_km) : null
    if (goal == null) return []
    return plan.weeks.flatMap(w => daysOf(w).flatMap(({ session: s }) => {
      if (!s || s.catalogue_id !== 'hm_pace_intervals') return []
      const step = s.derived_set?.blocks.flatMap(b => b.steps).find(st => st.role === 'work' && st.pace)
      const mid = step?.pace ? parsePaceMidpoint(step.pace) : null
      return mid != null && Math.abs(mid - goal) / goal > 0.03 ? [{ rule_id: 'INV-PLAN-RACE-ANCHOR-MATCHES-GOAL' as RuleId, week: w.n, day: null, detail: `work at ${step!.pace}` }] : []
    }))
  },

  // §120, §85: a quality header pace is its single work pace, within 3%. CONDITIONAL severity: warn when the header
  // is the goal pace (the goal-pace override against §85's shield, still open), error otherwise.
  'INV-PLAN-HEADER-PACE-MATCHES-WORK': plan => {
    const goal = plan.meta.goal_pace_per_km ? parsePaceMidpoint(plan.meta.goal_pace_per_km) : null
    return plan.weeks.flatMap(w => daysOf(w).flatMap(({ session: s }) => {
      if (!s || s.type !== 'quality' || !s.pace_target || !s.derived_set) return []
      const paces = new Set(s.derived_set.blocks.flatMap(b => b.steps).filter(st => st.role === 'work' && st.pace).map(st => st.pace as string))
      if (paces.size !== 1) return []
      const work = parsePaceMidpoint(Array.from(paces)[0]), header = parsePaceMidpoint(s.pace_target)
      if (work == null || header == null || Math.abs(work - header) / work <= 0.03) return []
      const override = goal != null && Math.abs(header - goal) / goal <= 0.03
      return [{ rule_id: 'INV-PLAN-HEADER-PACE-MATCHES-WORK' as RuleId, week: w.n, day: null, detail: `header ${s.pace_target}`, severity: override ? 'warn' as const : 'error' as const }]
    }))
  },

  // §93 (§5): a time-goal plan over 6 km has SOME race-specific work in its peak key sessions (quality, plus any
  // long run that is itself race-specific). ⚠️ Distance read from the plan's own meta, as validatePlan does.
  'INV-PLAN-PEAK-SPECIFICITY': (plan, { profile }) => {
    if (profile.race.goal !== 'time_target' || !(plan.meta.race_distance_km && plan.meta.race_distance_km > 6)) return []
    let key = 0, specific = 0
    for (const w of plan.weeks.filter(x => x.n >= 1 && x.phase === 'peak' && x.type !== 'deload' && x.type !== 'race')) {
      for (const { session: s } of daysOf(w)) {
        if (!s) continue
        const lr = isLongRun(s)
        if (s.type !== 'quality' && !lr) continue
        const row = catalogueRowFor(s, V1_SESSION_CATALOGUE)
        const isSpecific = row?.category === 'race_specific' || row?.category === 'ultra_specific'
        if (lr && !isSpecific) continue
        key++
        if (isSpecific) specific++
      }
    }
    return key > 0 && specific === 0 ? [{ rule_id: 'INV-PLAN-PEAK-SPECIFICITY', week: PLAN, day: null, detail: `0 of ${key} peak key sessions race-specific` }] : []
  },

  // §19 Am. 2: a rep-scaled v2 row is delivered with at least REP_ROW_MIN_REPS reps in each rep block.
  'INV-PLAN-REPEATS-REPEAT': plan => plan.weeks.flatMap(w => daysOf(w).flatMap(({ day, session: s }) => {
    if (!s?.derived_set) return []
    const row = catalogueRowFor(s)
    const shape = row?.main_set_structure as { version?: number; sizing?: { scaling?: string }; blocks?: { label?: string; repeat?: unknown }[] } | undefined
    if (!shape || shape.version !== 2 || shape.sizing?.scaling !== 'reps') return []
    const labels = new Set((shape.blocks ?? []).filter(b => typeof b.repeat === 'object' && b.repeat !== null).map(b => b.label))
    return (s.derived_set.blocks ?? []).filter(b => labels.has(b.label) && typeof b.repeat === 'number' && b.repeat < GENERATION_CONFIG.REP_ROW_MIN_REPS)
      .map(b => ({ rule_id: 'INV-PLAN-REPEATS-REPEAT' as RuleId, week: w.n, day, detail: `${b.repeat} rep` }))
  })),

  // §19 Am. 2: a race-specific v2 row priced at the rep floor runs at most RACE_SPECIFIC_MAX_RACE_SHARE of the race
  // distance at race pace. A row whose work is not all distance-measured, or is band-sized, is not priced here.
  'INV-PLAN-RACE-SPECIFIC-RACE-SHARE': (plan, { input }) => {
    const cap = GENERATION_CONFIG.RACE_SPECIFIC_MAX_RACE_SHARE, raceKm = input.race_distance_km
    if (!(raceKm > 0)) return []
    return plan.weeks.flatMap(w => daysOf(w).flatMap(({ day, session: s }) => {
      if (!s?.derived_set) return []
      const row = catalogueRowFor(s)
      if (!row || row.category !== 'race_specific') return []
      const shape = row.main_set_structure as { version?: number; blocks?: { label?: string; steps?: { role?: string; length?: { kind?: string; m?: number } }[] }[] }
      if (shape.version !== 2) return []
      let km = 0
      for (const rb of shape.blocks ?? []) {
        const work = (rb.steps ?? []).filter(st => st.role === 'work')
        if (work.length === 0) continue
        const got = (s.derived_set.blocks ?? []).find(b => b.label === rb.label)
        if (!work.every(st => st.length?.kind === 'distance') || !got || got.repeat !== GENERATION_CONFIG.REP_ROW_MIN_REPS) return []
        km += got.repeat * work.reduce((a, st) => a + (st.length?.m ?? 0), 0) / 1000
      }
      return km > cap * raceKm + 1e-9 ? [{ rule_id: 'INV-PLAN-RACE-SPECIFIC-RACE-SHARE' as RuleId, week: w.n, day, detail: `${km.toFixed(1)} km at race pace` }] : []
    }))
  },
}
Object.assign(PREDICATES, BATCH_22)

/** validatePlan's `fitness`: the plan's intensity level, then the request's, then the request's and the plan's structural
 *  level. ⚠️ It starts at the plan's own meta, so it is partly a self-label read. */
const checkerFitness = (plan: Plan, input: GeneratorInput) =>
  plan.meta.fitness_intensity_level ?? input.fitness_intensity_level ?? input.fitness_level ?? plan.meta.fitness_level

const BATCH_23: Partial<Record<RuleId, Predicate>> = {
  // §5: on a race of 21 km or less, the first VO2max session leaves VO2MAX_ONSET_MIN_ADAPTATION_WEEKS before the taper,
  // when the plan is long enough to (and an intensity re-entry window does not cover the deadline).
  'INV-PLAN-VO2MAX-ONSET': (plan, { input }) => {
    const firstBuild = plan.weeks.find(w => w.phase === 'build')?.n
    const taperStart = plan.weeks.find(w => w.phase === 'taper')?.n
    if (firstBuild == null || taperStart == null || !(input.race_distance_km <= 21)) return []
    const vo2 = plan.weeks.filter(w => Object.values(w.sessions ?? {}).some(s => s && s.type === 'quality' && classifyStimulus(s) === 'vo2max')).map(w => w.n)
    if (vo2.length === 0) return []
    const min = GENERATION_CONFIG.VO2MAX_ONSET_MIN_ADAPTATION_WEEKS
    const deadline = plan.weeks.length - ((plan.weeks.length - taperStart) + 1) - min
    let firstUnprotected: number | null = null
    if (plan.meta.intensity_reentry_active) {
      const budget = plan.meta.intensity_reentry_weeks ?? 0
      let seen = 0
      for (const w of plan.weeks) {
        if (w.n < 1 || !Object.values(w.sessions ?? {}).some(s => s && s.type === 'quality')) continue
        if (seen >= budget) { firstUnprotected = w.n; break }
        seen++
      }
    }
    const blocked = !!plan.meta.intensity_reentry_active && (firstUnprotected === null || firstUnprotected > deadline)
    return deadline >= firstBuild && !blocked && taperStart - vo2[0] < min
      ? [{ rule_id: 'INV-PLAN-VO2MAX-ONSET', week: vo2[0], day: null, detail: `first VO2max ${taperStart - vo2[0]} week(s) before the taper` }] : []
  },

  // §105: on a time-goal race over 30 km, marathon-pace work exists away from the long run.
  'INV-PLAN-MARATHON-RACE-PACE-NOT-ONLY-LONG-RUN': (plan, { input, profile }) => {
    if (!(input.race_distance_km > 30) || profile.race.goal !== 'time_target') return []
    const rp = plan.weeks.filter(w => w.n >= 1).flatMap(w => Object.values(w.sessions ?? {}))
      .filter((s): s is Session => !!s && s.type !== 'rest' && s.type !== 'race' && classifyStimulus(s) === 'race_pace')
    return rp.length > 0 && rp.every(s => isLongRun(s)) ? [{ rule_id: 'INV-PLAN-MARATHON-RACE-PACE-NOT-ONLY-LONG-RUN', week: PLAN, day: null, detail: `all ${rp.length} in the long run` }] : []
  },

  // ADR-018: a quality session whose label names a catalogue row carries that row's stamp.
  'INV-PLAN-CATALOGUE-LINK': plan => plan.weeks.flatMap(w => daysOf(w).flatMap(({ day, session: s }) =>
    s && isQualitySession(s) && !s.catalogue_id && V1_SESSION_CATALOGUE.some(r => r.name === s.label)
      ? [{ rule_id: 'INV-PLAN-CATALOGUE-LINK' as RuleId, week: w.n, day, detail: 'named row, no stamp' }] : [])),

  // ADR-019: a session from a version-2 row carries a non-empty derived set.
  'INV-PLAN-DERIVED-SET': plan => plan.weeks.flatMap(w => daysOf(w).flatMap(({ day, session: s }) => {
    if (!s?.catalogue_id) return []
    const row = V1_SESSION_CATALOGUE.find(r => r.id === s.catalogue_id)
    const shape = row?.main_set_structure as { version?: unknown } | undefined
    if (!shape || typeof shape !== 'object' || shape.version !== 2) return []
    const d = s.derived_set as { blocks?: unknown[] } | undefined
    return !d || !Array.isArray(d.blocks) || d.blocks.length === 0 ? [{ rule_id: 'INV-PLAN-DERIVED-SET' as RuleId, week: w.n, day, detail: `${row!.id} with no derived set` }] : []
  })),

  // §104: a time-goal peak does not fill two or more race-specific slots with one row while another eligible row exists.
  // ⚠️ The level is validatePlan's four-step fallback: plan meta, then the request, then the plan's structural level.
  'INV-PLAN-RACE-SPECIFIC-VARIETY': (plan, { input, profile }) => {
    if (profile.race.goal !== 'time_target') return []
    const dk = raceDistanceKey(input.race_distance_km)
    const fitness = checkerFitness(plan, input)
    const R = LEVEL_RANK as Record<string, number>
    const slots = plan.weeks.filter(w => w.phase === 'peak' && w.type !== 'race')
      .flatMap(w => Object.values(w.sessions ?? {}).filter((s): s is Session => s != null && !!s.catalogue_id && !isLongRun(s)).map(s => ({ week: w.n, id: s.catalogue_id! })))
      .filter(x => V1_SESSION_CATALOGUE.find(r => r.id === x.id)?.category === 'race_specific')
    const used = new Set(slots.map(x => x.id))
    if (!(slots.length >= 2 && used.size === 1)) return []
    const only = Array.from(used)[0]
    const rank = fitness ? R[fitness] : undefined
    const alt = V1_SESSION_CATALOGUE.filter(r => r.category === 'race_specific' && r.id !== only
      && (r.distance_eligibility as readonly string[]).includes(dk) && (r.phase_eligibility as readonly string[]).includes('peak')
      && (r.main_set_structure as { type?: string } | undefined)?.type !== 'long_run_with_segment'
      && (rank === undefined || (R[r.fitness_level_min] <= rank && (r.fitness_level_max == null || rank <= R[r.fitness_level_max]))))
    return alt.length > 0 ? [{ rule_id: 'INV-PLAN-RACE-SPECIFIC-VARIETY', week: slots[0].week, day: null, detail: `${slots.length} slots, one row (${only})` }] : []
  },

  // §79: an upward level declaration never raises the peak target above the assessed level's band. ⚠️ Three
  // self-label reads (declared, structural and target all from meta), copied.
  'INV-PLAN-USER-LEVEL-NO-UPWARD-TONNAGE': plan => {
    const declared = plan.meta.fitness_level_declared, structural = plan.meta.fitness_level, target = plan.meta.peak_km_target
    const R = LEVEL_RANK as Record<string, number>
    if (!declared || !structural || typeof target !== 'number' || !(R[declared] > R[structural])) return []
    const band = GENERATION_CONFIG.PEAK_KM_BY_LEVEL[raceDistanceKey(plan.meta.race_distance_km ?? 0)]
    return target > band[structural] ? [{ rule_id: 'INV-PLAN-USER-LEVEL-NO-UPWARD-TONNAGE', week: PLAN, day: null, detail: `peak target ${target} over the ${structural} band` }] : []
  },

  // §117 (Am. 3, Am. 9): on a run-walk plan every run carries the interval, except a quality session, which never does.
  'INV-PLAN-RUNWALK-PRESCRIBED': plan => !plan.meta.run_walk_prescribed ? [] : plan.weeks.flatMap(w => daysOf(w).flatMap(({ session: s }) => {
    if (!s || s.type === 'rest' || s.type === 'cross-train' || s.type === 'strength') return []
    if (isQualitySession(s)) return s.run_walk_strategy ? [{ rule_id: 'INV-PLAN-RUNWALK-PRESCRIBED' as RuleId, week: w.n, day: null, detail: 'interval on a quality session' }] : []
    return !s.run_walk_strategy ? [{ rule_id: 'INV-PLAN-RUNWALK-PRESCRIBED' as RuleId, week: w.n, day: null, detail: 'no interval' }] : []
  })),

  // §83, §44: the fastest Zone-3 quality session is not faster than the fastest Zone-4/5 one beyond the tolerance,
  // unless the plan declares the goal beyond measured fitness with a non-comfortable difficulty band.
  'INV-PLAN-INTENSITY-ORDERING': plan => {
    const tol = GENERATION_CONFIG.INTENSITY_ORDERING_TOLERANCE_PCT / 100
    let vo2: { mid: number; week: number } | null = null, thr: { mid: number; week: number } | null = null
    for (const w of plan.weeks) for (const s of Object.values(w.sessions ?? {})) {
      if (!s || s.type !== 'quality' || !s.pace_target) continue
      const mid = parsePaceMidpoint(s.pace_target)
      if (mid == null) continue
      const z = (s.zone ?? '').toLowerCase()
      const isVo2 = z.includes('zone 4') || z.includes('zone 5'), isThr = z.includes('zone 3') && !isVo2
      if (isVo2 && (vo2 == null || mid < vo2.mid)) vo2 = { mid, week: w.n }
      if (isThr && (thr == null || mid < thr.mid)) thr = { mid, week: w.n }
    }
    if (!vo2 || !thr || !(thr.mid < vo2.mid * (1 - tol))) return []
    const surfaced = plan.meta.goal_beyond_measured_fitness === true && plan.meta.difficulty_band !== undefined && plan.meta.difficulty_band !== 'comfortable'
    return surfaced ? [] : [{ rule_id: 'INV-PLAN-INTENSITY-ORDERING', week: thr.week, day: null, detail: 'threshold faster than VO2' }]
  },
}
Object.assign(PREDICATES, BATCH_23)

/** A quality session's main set in minutes, from the universal format (rule data), written here rather than through the
 *  session builder's `sessionSplit`: warm-up is the larger of its floor and its share, cool-down its share. */
const mainSetMins = (durationMins: number) => {
  const u = SESSION_FORMAT.UNIVERSAL
  return Math.max(0, durationMins - Math.max(u.quality_warmup_min_mins, durationMins * u.warmup_pct / 100) - durationMins * u.cooldown_pct / 100)
}

/** A VO2max session's WORK minutes: reps of the row's first work step, by time, or by distance at the session pace. */
function vo2WorkMins(s: Session): number | null {
  const reps = (s.derived_set as { blocks?: { repeat?: number }[] } | undefined)?.blocks?.[0]?.repeat
  if (typeof reps !== 'number') return null
  const row = s.catalogue_id ? V1_SESSION_CATALOGUE.find(r => r.id === s.catalogue_id) : undefined
  if (!row) return null
  const len = (row.main_set_structure as { blocks?: { steps?: { role?: string; length?: { kind?: string; secs?: number; m?: number } }[] }[] })
    .blocks?.[0]?.steps?.find(x => x.role === 'work')?.length
  if (!len) return null
  if (len.kind === 'duration' && typeof len.secs === 'number') return reps * (len.secs / 60)
  if (len.kind === 'distance' && typeof len.m === 'number') {
    const mid = parsePaceMidpoint(s.pace_target ?? '')
    return mid == null ? null : reps * (len.m / 1000) * mid
  }
  return null
}

const BATCH_24: Partial<Record<RuleId, Predicate>> = {
  // §93 Am. 1: a time-goal plan at a distance whose peak prefers race-specific work has at least one race-specific peak
  // quality session, unless a withheld anchor leaves no eligible race-specific row at all.
  'INV-PLAN-PEAK-RACE-SPECIFIC-REACHED': (plan, { input, profile }) => {
    const dk = raceDistanceKey(input.race_distance_km)
    const prefers = (GENERATION_CONFIG.TIME_TARGET_PEAK_RACE_SPECIFIC_DISTANCES as readonly string[]).includes(dk)
    const goalWithheld = plan.meta.goal_pace_withheld != null
    const withheld = plan.meta.hm_goal_anchor_withheld === true || goalWithheld
    const f = checkerFitness(plan, input), R = LEVEL_RANK as Record<string, number>
    const rank = f ? R[f] : undefined
    const surviving = !withheld ? 1 : V1_SESSION_CATALOGUE.filter(r => r.category === 'race_specific'
      && (r.distance_eligibility as readonly string[]).includes(dk) && (r.phase_eligibility as readonly string[]).includes('peak')
      && (r.main_set_structure as { type?: string } | undefined)?.type !== 'long_run_with_segment'
      && !workAnchorsOf(r).includes('HM' as never) && !(goalWithheld && workAnchorsOf(r).includes('goal' as never))
      && (rank === undefined || (R[r.fitness_level_min] <= rank && (r.fitness_level_max == null || rank <= R[r.fitness_level_max])))).length
    if (profile.race.goal !== 'time_target' || !prefers || (withheld && surviving === 0)) return []
    const q = plan.weeks.filter(w => w.n >= 1 && w.phase === 'peak' && w.type !== 'deload')
      .flatMap(w => Object.values(w.sessions ?? {}).filter((s): s is Session => s?.type === 'quality'))
    return q.length > 0 && !q.some(s => catalogueRowFor(s, V1_SESSION_CATALOGUE)?.category === 'race_specific')
      ? [{ rule_id: 'INV-PLAN-PEAK-RACE-SPECIFIC-REACHED', week: PLAN, day: null, detail: `0 of ${q.length} peak quality race-specific` }] : []
  },

  // §8: the plan's largest paced VO2max work never exceeds its largest tempo or race-pace main set beyond the tolerance.
  'INV-PLAN-MAIN-SET-ORDERING': plan => {
    const max: Record<string, { mins: number; week: number }> = {}
    for (const w of plan.weeks) for (const s of Object.values(w.sessions ?? {})) {
      if (!s || !isQualitySession(s)) continue
      const stim = classifyStimulus(s)
      if (!stim || (stim === 'vo2max' && !s.pace_target)) continue
      const mins = stim === 'vo2max' ? (vo2WorkMins(s) ?? mainSetMins(s.duration_mins ?? 0)) : mainSetMins(s.duration_mins ?? 0)
      if (!max[stim] || mins > max[stim].mins) max[stim] = { mins, week: w.n }
    }
    const vo2 = max['vo2max']
    return (['tempo', 'race_pace'] as const).flatMap(k => vo2 && max[k] && vo2.mins > max[k].mins + GENERATION_CONFIG.MAIN_SET_ORDERING_TOLERANCE_MINS
      ? [{ rule_id: 'INV-PLAN-MAIN-SET-ORDERING' as RuleId, week: vo2.week, day: null, detail: `VO2 over ${k}` }] : [])
  },

  // §8, §88: paced VO2max work sits inside its dose band; a session whose work cannot be counted is held to the legacy
  // main-set ceiling instead.
  'INV-PLAN-VO2MAX-MAIN-SET-CAP': plan => {
    const tol = GENERATION_CONFIG.MAIN_SET_ORDERING_TOLERANCE_MINS
    return plan.weeks.flatMap(w => daysOf(w).flatMap(({ day, session: s }) => {
      if (!s || !isQualitySession(s) || classifyStimulus(s) !== 'vo2max' || !s.pace_target) return []
      const work = vo2WorkMins(s)
      const over = work == null
        ? mainSetMins(s.duration_mins ?? 0) > GENERATION_CONFIG.VO2MAX_MAIN_SET_MAX_MINS + tol
        : work < GENERATION_CONFIG.VO2MAX_WORK_MIN_MINS - tol || work > GENERATION_CONFIG.VO2MAX_WORK_MAX_MINS + tol
      return over ? [{ rule_id: 'INV-PLAN-VO2MAX-MAIN-SET-CAP' as RuleId, week: w.n, day, detail: work == null ? 'over the legacy ceiling' : 'outside the work band' }] : []
    }))
  },
}
Object.assign(PREDICATES, BATCH_24)

/** Every shape noun a catalogue row can put in a label. */
const SHAPE_WORDS = new Set(V1_SESSION_CATALOGUE.map(r => goalPaceShapeWord(r)).filter((x): x is string => !!x))

const BATCH_25: Partial<Record<RuleId, Predicate>> = {
  // §40b Am. 4: an effort-governed session shows its row's declared zone and carries no HR band.
  'INV-PLAN-EFFORT-GOVERNED-NO-INVENTED-BAND': plan => plan.weeks.flatMap(w => daysOf(w).flatMap(({ day, session: s }) => {
    if (!s) return []
    const row = catalogueRowFor(s)
    if (!row || !isEffortGovernedRow(row)) return []
    const declared = zoneStringFromZoneKeys(row.intensity_zones)
    const out: Raw[] = []
    if (declared && s.zone !== declared) out.push({ rule_id: 'INV-PLAN-EFFORT-GOVERNED-NO-INVENTED-BAND', week: w.n, day, detail: `zone ${s.zone} against ${declared}` })
    if (typeof s.hr_target === 'string' && s.hr_target.trim().length > 0) out.push({ rule_id: 'INV-PLAN-EFFORT-GOVERNED-NO-INVENTED-BAND', week: w.n, day, detail: 'an HR target' })
    return out
  })),

  // §40b: a session from an effort-governed row carries no pace and is not named as goal-pace work. The row is found
  // by its stamp only (no label fallback), as validatePlan reads it.
  'INV-PLAN-EFFORT-GOVERNED-NOT-GOAL-PACED': plan => plan.weeks.flatMap(w => daysOf(w).flatMap(({ day, session: s }) => {
    if (!s?.catalogue_id) return []
    const row = V1_SESSION_CATALOGUE.find(r => r.id === s.catalogue_id)
    if (!row || !isEffortGovernedRow(row)) return []
    const pace = typeof s.pace_target === 'string' && s.pace_target.trim().length > 0
    return pace || /-pace /.test(s.label ?? '') ? [{ rule_id: 'INV-PLAN-EFFORT-GOVERNED-NOT-GOAL-PACED' as RuleId, week: w.n, day, detail: pace ? 'a pace target' : 'a goal-pace name' }] : []
  })),

  // §19, §53: a renamed label ending "-pace <shape>" names the shape the session delivers (its derived set, else its
  // row). The generic word, a purpose word, and a word no row produces are skipped.
  'INV-PLAN-LABEL-MATCHES-STRUCTURE': plan => plan.weeks.flatMap(w => daysOf(w).flatMap(({ day, session: s }) => {
    if (!s?.catalogue_id) return []
    const row = V1_SESSION_CATALOGUE.find(r => r.id === s.catalogue_id)
    if (!row || s.label === row.name) return []
    const m = /-pace ([a-z]+)$/i.exec((s.label ?? '').trim())
    if (!m) return []
    const claimed = m[1].toLowerCase()
    if (claimed === 'intervals' || claimed === 'sharpener') return []
    const delivered = s.derived_set?.blocks?.length ? goalPaceShapeWord({ main_set_structure: { version: 2, blocks: s.derived_set.blocks } }) : null
    const actual = delivered ?? goalPaceShapeWord(row)
    return actual && SHAPE_WORDS.has(claimed) && claimed !== actual ? [{ rule_id: 'INV-PLAN-LABEL-MATCHES-STRUCTURE' as RuleId, week: w.n, day, detail: `claims ${claimed}, is ${actual}` }] : []
  })),
}
Object.assign(PREDICATES, BATCH_25)

/** Can the runner's open days hold a quality session spaced from the plan's long-run day (the first one in a main
 *  week, in the plan's key order)? Written here; the planner's placement helper is not shared. */
function geometryHoldsQuality(plan: Plan, input: GeneratorInput): boolean {
  const blocked = normaliseDays(input.days_cannot_train)
  const open = DAYS.filter(d => !blocked.has(d))
  const longDay = plan.weeks.filter(w => w.n >= 1).flatMap(w => daysOf(w)).find(x => x.session && isLongRun(x.session))?.day
  if (longDay == null) return true
  const min = Math.ceil(GENERATION_CONFIG.MIN_HOURS_BETWEEN_QUALITY_AND_LONG / 24)
  const gap = (a: VerifierDay, b: VerifierDay) => { const d = Math.abs(DAYS.indexOf(a) - DAYS.indexOf(b)); return Math.min(d, 7 - d) }
  return open.some(d => d !== longDay && gap(d, longDay) >= min)
}

/** The total session length that yields a given main set: the inverse of `mainSetMins`, from SESSION_FORMAT. */
function totalForMainSet(main: number): number {
  const u = SESSION_FORMAT.UNIVERSAL
  const floored = (main + u.quality_warmup_min_mins) / (1 - u.cooldown_pct / 100)
  return floored * u.warmup_pct / 100 > u.quality_warmup_min_mins ? main / (1 - (u.warmup_pct + u.cooldown_pct) / 100) : floored
}

/** Minutes for a closed step length ("8 min", "1:30", "90 s", "400 m", "2 km", "same as the <x>"); null when open. */
function closedMins(raw: string, pace: number | null, siblings: { length?: string }[]): number | null {
  const s = raw.trim()
  const mirror = /^same as the (.+)$/i.exec(s)
  if (mirror) {
    const named = siblings.find(x => typeof x.length === 'string' && x.length !== s && x.length.includes(mirror[1]))
    return closedMins(named?.length ?? mirror[1], pace, [])
  }
  let m = /^(\d+(?:\.\d+)?)\s*min$/i.exec(s); if (m) return parseFloat(m[1])
  m = /^(\d+):(\d{2})$/.exec(s); if (m) return parseInt(m[1], 10) + parseInt(m[2], 10) / 60
  m = /^(\d+)\s*s$/i.exec(s); if (m) return parseInt(m[1], 10) / 60
  m = /^(\d+(?:\.\d+)?)\s*m$/i.exec(s); if (m) return pace == null ? null : (parseFloat(m[1]) / 1000) * pace
  m = /^(\d+(?:\.\d+)?)\s*km$/i.exec(s); if (m) return pace == null ? null : parseFloat(m[1]) * pace
  return null
}

const BATCH_26: Partial<Record<RuleId, Predicate>> = {
  // §110 (§1): a non-beginner plan long enough to carry quality, with build or peak weeks, has some quality in them,
  // when the week can hold it. ⚠️ "Beginner" is the plan's own meta (self-label read), as validatePlan reads it.
  'INV-PLAN-QUALITY-NOT-ZERO': (plan, { input }) => {
    const n = plan.weeks.filter(w => w.n >= 1 && (w.phase === 'build' || w.phase === 'peak')).flatMap(w => Object.values(w.sessions ?? {})).filter(s => s?.type === 'quality').length
    const bp = plan.weeks.some(w => w.phase === 'build' || w.phase === 'peak')
    const long = plan.weeks.filter(w => w.n >= 1).length >= GENERATION_CONFIG.QUALITY_FLOOR_MIN_PLAN_WEEKS
    const beginner = (plan.meta.fitness_intensity_level ?? plan.meta.fitness_level) === 'beginner'
    return !beginner && bp && long && n === 0 && geometryHoldsQuality(plan, input) ? [{ rule_id: 'INV-PLAN-QUALITY-NOT-ZERO', week: PLAN, day: null, detail: 'no quality' }] : []
  },

  // §110 Am. 2, §22: a time-goal plan that can carry quality prescribes at least one quality session. ⚠️ The goal is the
  // plan's own stored request first, then the normalised one, as validatePlan reads it.
  'INV-PLAN-TIME-TARGET-QUALITY-FLOOR': (plan, { input, profile }) => {
    if ((plan.meta.generator_input?.goal ?? profile.race.goal) !== 'time_target') return []
    const bp = plan.weeks.some(w => w.phase === 'build' || w.phase === 'peak')
    const long = plan.weeks.filter(w => w.n >= 1).length >= GENERATION_CONFIG.QUALITY_FLOOR_MIN_PLAN_WEEKS
    const n = plan.weeks.filter(w => w.n >= 1).flatMap(w => Object.values(w.sessions ?? {})).filter(s => s?.type === 'quality').length
    const carry = plan.weeks.some(w => (w.weekly_km ?? 0) >= GENERATION_CONFIG.BEGINNER_QUALITY_MIN_WEEKLY_KM)
    return bp && long && carry && n === 0 && geometryHoldsQuality(plan, input) ? [{ rule_id: 'INV-PLAN-TIME-TARGET-QUALITY-FLOOR', week: PLAN, day: null, detail: 'no quality on a time goal' }] : []
  },

  // §16, §40b: an effort-governed session's duration holds its closed work plus the universal warm-up and cool-down.
  'INV-PLAN-EFFORT-GOVERNED-DURATION-LOWER-BOUND': plan => {
    const tol = GENERATION_CONFIG.MAIN_SET_ORDERING_TOLERANCE_MINS
    return plan.weeks.flatMap(w => daysOf(w).flatMap(({ day, session: s }) => {
      if (!s?.catalogue_id || s.duration_mins == null) return []
      const row = V1_SESSION_CATALOGUE.find(r => r.id === s.catalogue_id)
      if (!row || !isEffortGovernedRow(row)) return []
      const ds = s.derived_set as { blocks?: { repeat?: number; steps?: { length?: string; pace?: string | null }[] }[] } | undefined
      if (!ds?.blocks?.length) return []
      const pace = parsePaceMidpoint(ds.blocks.flatMap(b => b.steps ?? []).find(x => x.pace)?.pace ?? '')
      const closed = ds.blocks.reduce((t, b) => t + (typeof b.repeat === 'number' ? b.repeat : 1)
        * (b.steps ?? []).reduce((a, st) => a + (typeof st.length === 'string' ? (closedMins(st.length, pace, b.steps ?? []) ?? 0) : 0), 0), 0)
      if (!(closed > 0)) return []
      return s.duration_mins < totalForMainSet(closed) - tol ? [{ rule_id: 'INV-PLAN-EFFORT-GOVERNED-DURATION-LOWER-BOUND' as RuleId, week: w.n, day, detail: `${s.duration_mins} min under ${totalForMainSet(closed).toFixed(0)}` }] : []
    }))
  },
}
Object.assign(PREDICATES, BATCH_26)

const BATCH_27: Partial<Record<RuleId, Predicate>> = {
  // §47: on a half or full marathon, two consecutive peak weeks do not both carry a peak-level long run (at least the
  // alternation share of the peak long run, with race-pace work), except once for an eligible runner. ⚠️ A long run
  // with no segment stamp is read by its LABEL (legacy plans), as validatePlan reads it: raised, a label read.
  'INV-PLAN-PEAK-LR-ALTERNATION': (plan, { input }) => {
    const dk = raceDistanceKey(input.race_distance_km)
    if (dk !== 'HM' && dk !== 'MARATHON') return []
    const peak = plan.weeks.filter(w => w.phase === 'peak' && w.type !== 'deload')
    if (peak.length < 2) return []
    const lrOf = (w: Week) => Object.values(w.sessions ?? {}).find(s => !!s && isLongRun(s))
    const max = Math.max(...peak.map(w => sessionKmSelfPaced(lrOf(w)) ?? 0))
    const threshold = (GENERATION_CONFIG.PEAK_LR_ALTERNATION_THRESHOLD_PCT / 100) * max
    const level = (w: Week) => {
      const lr = lrOf(w)
      const km = lr ? sessionKmSelfPaced(lr) : null
      if (!lr || km == null || km + 0.01 < threshold) return false
      if (lr.lr_segment_pace) return true
      const l = (lr.label ?? '').toLowerCase()
      return l.includes('pace') || l.includes(' mp') || l.startsWith('mp') || l.includes('hm-pace')
    }
    const eligible = input.hard_session_relationship === 'love' && (input.injury_history ?? []).length === 0 && input.training_age === '5yr+'
    let used = false
    const out: Raw[] = []
    for (let i = 1; i < peak.length; i++) {
      if (!(level(peak[i - 1]) && level(peak[i]))) continue
      if (eligible && !used) { used = true; continue }
      out.push({ rule_id: 'INV-PLAN-PEAK-LR-ALTERNATION', week: peak[i].n, day: null, detail: 'two peak-level long runs in a row' })
    }
    return out
  },

  // §78, §33: a time trial's notes say it is a measurement and to log the result; a VO2 or goal-pace quality session
  // carries no aerobic cue; a goal-paced work step is not told it is threshold work. ⚠️ VO2 and goal pace are detected
  // from the LABEL here, as validatePlan does: raised, a label read.
  'INV-PLAN-COACH-NOTES-MATCH-INTENT': plan => plan.weeks.filter(governed).flatMap(w => {
    const out: Raw[] = []
    const placed = running(w)
    for (const { day, session: s } of placed) {
      if (!isTimeTrial(s)) continue
      const notes = (s.coach_notes ?? []).join(' ').toLowerCase()
      if (!/measurement/.test(notes) || !/log the (result|time)/.test(notes)) out.push({ rule_id: 'INV-PLAN-COACH-NOTES-MATCH-INTENT', week: w.n, day, detail: 'time trial lost its instruction' })
    }
    for (const { day, session: s } of placed) {
      if (s.type !== 'quality') continue
      const label = (s.label ?? '').toLowerCase(), notes = (s.coach_notes ?? []).join(' ').toLowerCase()
      const hard = label.includes('vo2max') || label.includes('vo2 max') || label.includes('-pace ') || label.includes('mp ') || label.includes('mp.')
      if (!hard) continue
      for (const phrase of ['boring is the point', 'if it feels productive']) {
        if (notes.includes(phrase)) out.push({ rule_id: 'INV-PLAN-COACH-NOTES-MATCH-INTENT', week: w.n, day, detail: `aerobic cue "${phrase}"` })
      }
    }
    for (const { day, session: s } of placed) {
      if (classifyStimulus(s) !== 'race_pace' || !s.derived_set) continue
      if (s.derived_set.blocks.flatMap(b => b.steps).some(st => st.role === 'work' && st.note && /threshold|not a race pace/i.test(st.note)))
        out.push({ rule_id: 'INV-PLAN-COACH-NOTES-MATCH-INTENT', week: w.n, day, detail: 'goal-paced step called threshold' })
    }
    return out
  }),
}
Object.assign(PREDICATES, BATCH_27)

/** 🔻 A literal in validatePlan, not in config: the foundation block's week-to-week ceiling (+10%). Copied so the two
 *  checkers agree; raised for the board (FOUNDATION_WEEKLY_INCREASE_PCT says the same today, by coincidence of value). */
export const FOUNDATION_WEEK_TO_WEEK_LITERAL = 1.10

/** A row whose paced work (easy steps aside) is all CV-anchored. */
function rowIsCvAnchored(id: string): boolean {
  const row = V1_SESSION_CATALOGUE.find(r => r.id === id)
  if (!row || !isV2Structure(row.main_set_structure)) return false
  const parsed = StructureV2Schema.safeParse(row.main_set_structure)
  if (!parsed.success) return false
  const anchors = new Set(parsed.data.blocks.flatMap(b => b.steps).filter(st => st.role === 'work' && st.target.kind === 'pace')
    .map(st => (st.target as { anchor: string }).anchor).filter(a => a !== 'E'))
  return anchors.size > 0 && Array.from(anchors).every(a => a === 'CV')
}

const BATCH_28: Partial<Record<RuleId, Predicate>> = {
  // §57, §92: a foundation week holds no hard effort or race, no strides unless the readiness gate passed (and never
  // with injury history), stays within the stated volume plus FOUNDATION_WEEKLY_INCREASE_PCT, keeps its longest run
  // under FOUNDATION_LONG_RUN_MAX_PCT of the week (three runs or more), and ramps week to week by at most the literal.
  'INV-PLAN-FOUNDATION-BLOCK': (plan, { input }) => {
    const fws = plan.weeks.filter(w => w.phase === 'foundation')
    const out: Raw[] = []
    const R = 'INV-PLAN-FOUNDATION-BLOCK' as RuleId
    for (const fw of fws) {
      for (const { day, session: s } of daysOf(fw)) {
        if (!s) continue
        if (isHardEffort(s) || s.type === 'race') out.push({ rule_id: R, week: fw.n, day, detail: `forbidden ${s.type}` })
        const notes = Array.isArray(s.coach_notes) ? s.coach_notes.join(' ') : String(s.coach_notes ?? '')
        if (/strides/i.test(notes)) {
          if (!plan.meta.early_quality_onset) out.push({ rule_id: R, week: fw.n, day, detail: 'strides without the readiness gate' })
          if ((input.injury_history ?? []).length > 0) out.push({ rule_id: R, week: fw.n, day, detail: 'strides with injury history' })
        }
      }
      const stated = input.current_weekly_km ?? 0
      const ceiling = stated * (1 + GENERATION_CONFIG.FOUNDATION_WEEKLY_INCREASE_PCT / 100)
      if (stated > 0 && fw.weekly_km > ceiling + 0.01) out.push({ rule_id: R, week: fw.n, day: null, detail: 'over the stated-volume ceiling' })
      const runs = Object.values(fw.sessions ?? {}).filter(s => s && s.type !== 'rest' && s.type !== 'cross-train').map(s => sessionKmSelfPaced(s) ?? 0)
      const cap = fw.weekly_km * (GENERATION_CONFIG.FOUNDATION_LONG_RUN_MAX_PCT / 100)
      if (runs.length >= 3 && fw.weekly_km > 0 && Math.max(0, ...runs) > cap + 0.01) out.push({ rule_id: R, week: fw.n, day: null, detail: 'long run over its share' })
    }
    for (let i = 1; i < fws.length; i++) {
      const prev = fws[i - 1], curr = fws[i]
      const dl = (w: Week) => w.type === 'deload' || w.badge === 'deload'
      if (dl(curr) || dl(prev) || !(prev.weekly_km > 0)) continue
      if (curr.weekly_km > prev.weekly_km * FOUNDATION_WEEK_TO_WEEK_LITERAL + 0.01) out.push({ rule_id: R, week: curr.n, day: null, detail: 'ramps over the week-to-week ceiling' })
    }
    return out
  },

  // §22: in the second half's build and peak, at least half the non-VO2, non-CV quality sessions run within 5% of goal
  // pace, on a time-goal plan whose goal pace is not withheld.
  'INV-PLAN-RACE-SPECIFIC-EXPOSURE-RATIO': (plan, { profile }) => {
    if (profile.race.goal !== 'time_target' || plan.meta.goal_pace_withheld != null || !plan.meta.goal_pace_per_km) return []
    const goal = parsePaceMidpoint(plan.meta.goal_pace_per_km)
    if (goal == null) return []
    const main = plan.weeks.filter(w => w.n > 0)
    const half = Math.ceil((main.length || plan.weeks.length) / 2)
    let total = 0, atGoal = 0
    for (const w of plan.weeks) {
      if (w.n < half || (w.phase !== 'build' && w.phase !== 'peak') || w.type === 'deload') continue
      for (const s of Object.values(w.sessions ?? {})) {
        if (!s || s.type !== 'quality' || isVo2maxSession(s, V1_SESSION_CATALOGUE) || (s.catalogue_id && rowIsCvAnchored(s.catalogue_id))) continue
        total++
        const mid = s.pace_target ? parsePaceMidpoint(s.pace_target) : null
        if (mid != null && Math.abs(mid - goal) / goal <= 0.05) atGoal++
      }
    }
    return total > 0 && atGoal / total < 0.5 ? [{ rule_id: 'INV-PLAN-RACE-SPECIFIC-EXPOSURE-RATIO', week: PLAN, day: null, detail: `${atGoal} of ${total} at goal pace` }] : []
  },
}
Object.assign(PREDICATES, BATCH_28)

/** A row whose paced work (easy steps aside) runs at more than one anchor (§85 over-unders). */
function rowHasMixedWorkAnchors(id: string): boolean {
  const row = V1_SESSION_CATALOGUE.find(r => r.id === id)
  if (!row || !isV2Structure(row.main_set_structure)) return false
  const parsed = StructureV2Schema.safeParse(row.main_set_structure)
  if (!parsed.success) return false
  return new Set(parsed.data.blocks.flatMap(b => b.steps).filter(st => st.role === 'work' && st.target.kind === 'pace')
    .map(st => (st.target as { anchor: string }).anchor).filter(a => a !== 'E')).size > 1
}

const BATCH_29: Partial<Record<RuleId, Predicate>> = {
  // §22: on a time-goal plan whose goal pace is not withheld, second-half build/peak quality is goal-pace work (VO2,
  // effort-governed, mixed-anchor, CV-anchored and adaptation-displaced sessions aside); and (§5) a distance whose race
  // pace differs from interval pace has a race-specific catalogue row of its own. That second arm reads only rule data.
  'INV-PLAN-RACE-SPECIFIC-EXPOSURE': (plan, { input, profile }) => {
    const out: Raw[] = []
    const timeGoal = profile.race.goal === 'time_target'
    const expects = timeGoal && plan.meta.goal_pace_withheld == null
    const half = Math.ceil((plan.weeks.filter(w => w.n > 0).length || plan.weeks.length) / 2)
    for (const w of plan.weeks.filter(governed)) {
      if (!expects || w.n < half || (w.phase !== 'build' && w.phase !== 'peak') || w.type === 'deload') continue
      for (const { day, session: s } of running(w)) {
        if (s.type !== 'quality' || isVo2maxSession(s, V1_SESSION_CATALOGUE)) continue
        const row = s.catalogue_id ? V1_SESSION_CATALOGUE.find(r => r.id === s.catalogue_id) : undefined
        if (s.catalogue_id && (isEffortGovernedRow(row ?? null) || rowHasMixedWorkAnchors(s.catalogue_id) || rowIsCvAnchored(s.catalogue_id))) continue
        if (s.displaced_by_adaptation_window) continue
        if (classifyStimulus(s) !== 'race_pace') out.push({ rule_id: 'INV-PLAN-RACE-SPECIFIC-EXPOSURE', week: w.n, day, detail: 'second-half quality not at goal pace' })
      }
    }
    const dk = raceDistanceKey(input.race_distance_km)
    if (timeGoal && (GENERATION_CONFIG.RACE_PACE_DISTINCT_FROM_INTERVAL_PACE as readonly string[]).includes(dk)) {
      const all = Object.keys(GENERATION_CONFIG.INTENSITY_DISTRIBUTION).length
      if (!V1_SESSION_CATALOGUE.some(r => r.category === 'race_specific' && (r.distance_eligibility as readonly string[]).includes(dk) && r.distance_eligibility.length < all))
        out.push({ rule_id: 'INV-PLAN-RACE-SPECIFIC-EXPOSURE', week: PLAN, day: null, detail: `no ${dk}-specific race row` })
    }
    return out
  },
}
Object.assign(PREDICATES, BATCH_29)

/** The old checker's own Daniels inverse (pace in min/km at a fraction of VO2max), copied: it is checker code, not
 *  planner code. 🔻 The fractions its callers pass (0.855 T, 0.84 HM, 0.975 I, 0.97 discount) are literals there too. */
function danielsPace(vdot: number, fraction: number): number {
  const a = 0.000104, b = 0.182258, c = -4.60 - fraction * vdot
  const disc = b * b - 4 * a * c
  if (disc < 0) return 100
  return 1000 / ((-b + Math.sqrt(disc)) / (2 * a))
}

/** What a label claims, by word. Written here: the enricher uses validatePlan's copy. */
const labelSays = (label?: string | null) => {
  const l = (label ?? '').toLowerCase()
  return {
    vo2: l.includes('vo2max') || l.includes('vo2 max'),
    threshold: l.includes('threshold') || l.includes('tempo') || l.includes('cruise'),
    easy: l.includes('easy') || l.includes('steady') || l.includes('aerobic') || l.includes('recovery'),
  }
}

/** A rep-scaled v2 row's main set in minutes, from the row's steps and the session's reps and paces. */
function pacedRepMain(s: Session): number | null {
  const row = s.catalogue_id ? V1_SESSION_CATALOGUE.find(r => r.id === s.catalogue_id) : undefined
  if (!row || !isV2Structure(row.main_set_structure)) return null
  const parsed = StructureV2Schema.safeParse(row.main_set_structure)
  if (!parsed.success || parsed.data.sizing.scaling !== 'reps') return null
  const headline = parsePaceMidpoint(s.pace_target ?? '')
  const derived = (s.derived_set as { blocks?: { repeat?: number; steps?: { pace?: string | null }[] }[] } | undefined)?.blocks
  let total = 0
  for (let bi = 0; bi < parsed.data.blocks.length; bi++) {
    const block = parsed.data.blocks[bi]
    const repeat = typeof block.repeat === 'number' ? block.repeat : derived?.[bi]?.steps != null ? derived?.[bi]?.repeat : undefined
    if (typeof repeat !== 'number') return null
    let mins = 0
    for (let si = 0; si < block.steps.length; si++) {
      const st = block.steps[si]
      if (st.length.kind === 'duration') { mins += st.length.secs / 60; continue }
      if (st.length.kind === 'distance') {
        const p = parsePaceMidpoint(derived?.[bi]?.steps?.[si]?.pace ?? '') ?? headline
        if (p == null) return null
        mins += (st.length.m / 1000) * p
        continue
      }
      return null
    }
    total += repeat * mins
  }
  return total
}

/** 🔻 A literal in validatePlan: the two fixed-shape threshold rows whose main set is summed from their steps. */
const FIXED_SHAPE_ROWS = new Set(['threshold_pyramid', 'threshold_ladder'])

function fixedShapeMain(s: Session): number | null {
  if (!s.catalogue_id || !FIXED_SHAPE_ROWS.has(s.catalogue_id)) return null
  const blocks = s.derived_set?.blocks
  if (!blocks?.length) return null
  let mins = 0
  for (const b of blocks) {
    let per = 0
    for (const st of b.steps) {
      const len = (st.length ?? '').trim()
      const mmss = /^(\d+):(\d{2})$/.exec(len), unit = /^(\d+(?:\.\d+)?)\s*(min|s)\b/.exec(len)
      const m = mmss ? +mmss[1] + +mmss[2] / 60 : unit ? (unit[2] === 's' ? +unit[1] / 60 : +unit[1]) : null
      if (m == null) return null
      per += m
    }
    mins += per * (b.repeat || 1)
  }
  return mins > 0 ? mins : null
}

function continuousTempoMain(s: Session): number | null {
  if (s.catalogue_id !== 'tempo_continuous') return null
  const ds = s.derived_set as { blocks?: { repeat?: number; steps?: { length?: string }[] }[] } | undefined
  if (!ds?.blocks?.length) return null
  let total = 0
  for (const b of ds.blocks) {
    const r = typeof b.repeat === 'number' ? b.repeat : 1
    for (const st of b.steps ?? []) {
      if (typeof st.length !== 'string') return null
      const m = /^(\d+(?:\.\d+)?)\s*min$/i.exec(st.length.trim())
      if (!m) return null
      total += r * parseFloat(m[1])
    }
  }
  return total > 0 ? total : null
}

const BATCH_30: Partial<Record<RuleId, Predicate>> = {
  // §8: a structured session's duration is its main set plus the universal warm-up and cool-down, within the tolerance.
  // ⚠️ The progressive tempo's expected main set is keyed by the plan's own level (self-label read), as validatePlan does.
  'INV-PLAN-STRUCTURED-SESSION-DURATION-COHERENT': plan => {
    const tol = GENERATION_CONFIG.MAIN_SET_ORDERING_TOLERANCE_MINS
    const fitness = plan.meta.fitness_intensity_level ?? plan.meta.fitness_level
    return plan.weeks.flatMap(w => daysOf(w).flatMap(({ day, session: s }) => {
      if (!s || !s.derived_set || s.duration_mins == null) return []
      const progressive = s.catalogue_id === 'progressive_tempo' && fitness && w.phase
        ? ((GENERATION_CONFIG.PROGRESSIVE_TEMPO_MAIN_MINS as Record<string, Record<string, number>>)[fitness]?.[w.phase]
          ?? (GENERATION_CONFIG.PROGRESSIVE_TEMPO_MAIN_MINS as Record<string, Record<string, number>>)[fitness]?.build ?? null)
        : null
      const main = pacedRepMain(s) ?? progressive ?? continuousTempoMain(s) ?? fixedShapeMain(s)
      if (main == null) return []
      return Math.abs(s.duration_mins - totalForMainSet(main)) > tol ? [{ rule_id: 'INV-PLAN-STRUCTURED-SESSION-DURATION-COHERENT' as RuleId, week: w.n, day, detail: `${s.duration_mins} min against ${totalForMainSet(main).toFixed(0)}` }] : []
    }))
  },

  // §19: a quality label's claim (VO2, threshold, easy) matches the zone and the work it prescribes, and a VO2 or
  // threshold label's pace sits near vVO2max (±5%) or T pace (±3%) for the plan's VDOT.
  'INV-PLAN-LABEL-MATCHES-PACE': plan => plan.weeks.filter(governed).flatMap(w => running(w).flatMap(({ day, session: s }) => {
    if (s.type !== 'quality') return []
    const zone = (s.zone ?? '').toLowerCase()
    if (!s.zone && (plan.meta as unknown as Record<string, unknown>).hr_derived_max == null) return []
    const says = labelSays(s.label)
    const cls = workClassFor(s, V1_SESSION_CATALOGUE)
    const vo2Work = cls !== null ? cls === 'vo2max' : zone.includes('zone 4') || zone.includes('zone 5')
    const zVo2 = zone.includes('zone 4') || zone.includes('zone 5'), zThr = zone.includes('zone 3') && !zone.includes('zone 4')
    const out: Raw[] = []
    const R = 'INV-PLAN-LABEL-MATCHES-PACE' as RuleId
    if (says.vo2 && !vo2Work) out.push({ rule_id: R, week: w.n, day, detail: 'VO2 label, not VO2 work' })
    if (says.threshold && !says.vo2 && !zThr && !zVo2) out.push({ rule_id: R, week: w.n, day, detail: 'threshold label, no threshold zone' })
    if (says.easy && !(zone.includes('zone 1') || zone.includes('zone 2'))) out.push({ rule_id: R, week: w.n, day, detail: 'easy label on a quality zone' })
    if (plan.meta.vdot && s.pace_target) {
      const mid = parsePaceMidpoint(s.pace_target)
      if (mid != null) {
        if (says.vo2) {
          const e = danielsPace(plan.meta.vdot, 0.975)
          if (Math.abs(mid - e) / e > 0.05) out.push({ rule_id: R, week: w.n, day, detail: 'VO2 pace off vVO2max' })
        } else if (says.threshold) {
          const e = danielsPace(plan.meta.vdot_training_anchor ?? plan.meta.vdot, 0.855)
          if (Math.abs(mid - e) / e > 0.03) out.push({ rule_id: R, week: w.n, day, detail: 'threshold pace off T' })
        }
      }
    }
    return out
  })),

  // §85: an over-under's mean pace sits 0–3% faster than T pace.
  'INV-PLAN-OVER-UNDER-MEAN-NEAR-THRESHOLD': plan => plan.weeks.filter(governed).flatMap(w => running(w).flatMap(({ day, session: s }) => {
    if (s.catalogue_id !== 'tempo_over_under' || !plan.meta.vdot || !s.pace_target) return []
    const mid = parsePaceMidpoint(s.pace_target)
    if (mid == null) return []
    const t = danielsPace(plan.meta.vdot_training_anchor ?? plan.meta.vdot, 0.855)
    const d = ((t - mid) / t) * 100
    return d < 0 || d > 3 ? [{ rule_id: 'INV-PLAN-OVER-UNDER-MEAN-NEAR-THRESHOLD' as RuleId, week: w.n, day, detail: `${d.toFixed(1)}% from T` }] : []
  })),

  // §24b: on a 5K/10K time goal, a peak long run within two weeks of the taper carries no segment faster than HM pace.
  'INV-PLAN-5K10K-LR-PACE-CAP': (plan, { input, profile }) => {
    const dk = raceDistanceKey(input.race_distance_km)
    if (profile.race.goal !== 'time_target' || (dk !== '5K' && dk !== '10K') || !plan.meta.vdot) return []
    const ceiling = danielsPace(plan.meta.vdot * 0.97, 0.84)
    const taper = plan.weeks.find(w => w.phase === 'taper')
    return plan.weeks.flatMap(w => {
      if (w.phase !== 'peak' || w.type === 'deload' || (taper ? taper.n - w.n : 999) > 2) return []
      return daysOf(w).flatMap(({ day, session: s }) => {
        if (!s || !isLongRun(s) || !s.lr_segment_pace) return []
        const seg = parsePaceMidpoint(s.lr_segment_pace)
        return seg != null && seg < ceiling - 0.05 ? [{ rule_id: 'INV-PLAN-5K10K-LR-PACE-CAP' as RuleId, week: w.n, day, detail: `segment ${s.lr_segment_pace}` }] : []
      })
    })
  },
}
Object.assign(PREDICATES, BATCH_30)

const SEVERITY = new Map(RULES.map(r => [r.id, r.kind === 'soft' ? 'warn' as const : 'error' as const]))
/** Rules the catalogue marks as conditionally severe: only these may set a finding's severity (code review, batch 20). */
const CONDITIONAL = new Set(RULES.filter(r => r.severity_note).map(r => r.id))

/** Every finding the ported predicates raise, with the severity the catalogue gives the rule. */
export function verifyPlan(plan: Plan, ctx: VerifyContext): VerifierFinding[] {
  // Each predicate is isolated (code review): one that cannot evaluate returns an UNVERIFIED finding for
  // its own rule, rather than ending the run and losing every other rule's findings. Never a silent pass.
  return (Object.entries(PREDICATES) as [RuleId, Predicate][]).flatMap(([id, p]) => {
    try { return p(plan, ctx) } catch (e) {
      return [{ rule_id: id, week: PLAN, day: null, detail: `unverified: ${e instanceof Error ? e.message : String(e)}` }]
    }
  }).map(f => ({ ...f, severity: (CONDITIONAL.has(f.rule_id) ? f.severity : undefined) ?? SEVERITY.get(f.rule_id) ?? 'error' }))
}

export const PORTED_RULES = Object.keys(PREDICATES) as RuleId[]
