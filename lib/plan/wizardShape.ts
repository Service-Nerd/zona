import type { GeneratorInput } from '@/types/plan'
import {
  WIZARD_DISTANCES, WIZARD_INJURY_WIRE, MAX_WEEKDAY_CHIPS, WIZARD_DAY_BUDGET_MINS,
  WIZARD_TRAINING_AGES, WIZARD_RECENT_QUALITY, WIZARD_HARD_SESSIONS, WIZARD_TERRAINS, WIZARD_LEVELS,
} from './wizardOptions'
import { GENERATION_CONFIG, raceDistanceKey } from './generationConfig'
import { volumePairProblem } from './volumeConsistency'
import { BENCHMARK_DISTANCES, benchmarkProblem } from './benchmarkCheck'
import { ACK_FIELD } from './warnAcknowledgement'

/**
 * ADR027-B0-GOLDEN-CORPUS — "could the wizard have posted this row?", answered by one predicate.
 *
 * `corpusProductionShape.test.ts` held two of these checks as separate arms (`fitness_level`
 * set; `day_budgets` without its derived cap), each written after a corpus was found measuring a
 * runner the product cannot build. ARCH-ENG-007 makes the general rule binding — every corpus
 * row must be producible by a product path — so the general check lives here, as data about the
 * wizard, and the test runs it over every corpus.
 *
 * Every rule below is read off `GeneratePlanScreen.handleGenerate` and the owners it calls
 * (`weekPlanToInputs`, the ruler config, `volumePairProblem`, `benchmarkFromFields` /
 * `benchmarkProblem`, `hrGuardableAge`, `wizardOptions.ts`). A violation names the CODE and why.
 *
 * ⚠️ It describes TODAY'S wizard. A row captured from production under an earlier wizard (short
 * day names, no `user_declared_level`) is a real product row and still fails here; that is a
 * statement about the wizard having changed, not about the row being fake.
 *
 * ⚠️ What it cannot see: anything decided by the clock beyond the benchmark date (a race date
 * in the past is postable and refused by the route), and HealthKit-sourced heart rates beyond
 * "positive number" — there is no wizard control to read a range from.
 */

export interface WizardShapeViolation {
  code: string
  detail: string
}

/** Fields `handleGenerate` puts on the payload, plus the two acknowledgement flags a refusal
 *  screen adds on its re-send (`ACK_FIELD`) and P-15's accept flag. */
const WIZARD_KEYS = new Set<string>([
  'race_date', 'race_distance_km', 'race_name', 'goal', 'target_time', 'age',
  'current_weekly_km', 'longest_recent_run_km', 'days_available',
  'resting_hr', 'max_hr', 'max_hr_source', 'training_age', 'recent_quality_training',
  'user_declared_level', 'preferred_long_run_day', 'benchmark', 'days_cannot_train',
  'max_weekday_mins', 'day_budgets', 'hard_session_relationship', 'injury_history', 'terrain',
  ...Object.values(ACK_FIELD), 'accept_base_build',
  // Not posted by the wizard, but put on EVERY generation's input by the route itself
  // (`resolveAthleteFirstName`), so it is on the product path. It changes no prescription.
  'athlete_name',
])

/** Fields that exist on `GeneratorInput` and that the wizard NEVER sends, each with its code. */
const NOT_WIZARD: Record<string, string> = {
  fitness_level: 'FITNESS_LEVEL_SET',
  fitness_intensity_level: 'FITNESS_INTENSITY_LEVEL_SET',
  weeks_at_current_volume: 'WEEKS_AT_VOLUME_SET',
  volume_observed: 'VOLUME_OBSERVED_SET',
  after_walk_run_start: 'AFTER_WALK_RUN_START_SET',
  foundation_decision: 'FOUNDATION_DECISION_SET',
  training_style: 'TRAINING_STYLE_SET',
  motivation_type: 'MOTIVATION_TYPE_SET',
}

const REQUIRED = ['race_date', 'race_distance_km', 'goal', 'current_weekly_km', 'longest_recent_run_km',
  'days_available', 'user_declared_level', 'preferred_long_run_day'] as const

const WEEK_FULL = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
const WEEKDAY_FULL_TO_SHORT: Record<string, 'mon' | 'tue' | 'wed' | 'thu' | 'fri'> = {
  monday: 'mon', tuesday: 'tue', wednesday: 'wed', thursday: 'thu', friday: 'fri',
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const HMS = /^\d+:\d{2}:\d{2}$/

const onRuler = (v: unknown, min: number, max: number, step: number) =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max && Number.isInteger((v - min) / step)

export function wizardShapeViolations(
  raw: GeneratorInput | Record<string, unknown>,
  opts: { tier?: 'free' | 'paid' | 'trial'; today?: Date } = {},
): WizardShapeViolation[] {
  const out: WizardShapeViolation[] = []
  const add = (code: string, detail: string) => out.push({ code, detail })
  // The wire drops `undefined`, so a key holding it is absent, exactly as JSON.stringify sends it.
  const i: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) if (v !== undefined) i[k] = v

  // ── Keys ────────────────────────────────────────────────────────────────────────────
  for (const k of Object.keys(i)) {
    if (NOT_WIZARD[k]) add(NOT_WIZARD[k], `\`${k}\` is not sent by the wizard (value ${JSON.stringify(i[k])})`)
    else if (!WIZARD_KEYS.has(k)) add('UNKNOWN_KEY', `\`${k}\` is not a field the wizard posts`)
  }
  for (const k of REQUIRED) if (!(k in i)) add('MISSING_FIELD', `\`${k}\` is always sent by the wizard`)
  for (const k of [...Object.values(ACK_FIELD), 'accept_base_build']) {
    if (k in i && i[k] !== true) add('FLAG_NOT_TRUE', `\`${k}\` is only ever sent as true`)
  }

  // ── Race ────────────────────────────────────────────────────────────────────────────
  const dist = WIZARD_DISTANCES.find(d => d.value === i.race_distance_km)
  if ('race_distance_km' in i && !dist) add('RACE_DISTANCE_NOT_A_TILE', `${i.race_distance_km} is not a distance tile`)
  if (dist?.paid && opts.tier === 'free') add('PAID_DISTANCE_ON_FREE', `${dist.label} is locked for a free runner`)
  if ('race_date' in i && !(typeof i.race_date === 'string' && ISO_DATE.test(i.race_date))) {
    add('RACE_DATE_FORMAT', `race_date ${JSON.stringify(i.race_date)} is not the date input's YYYY-MM-DD`)
  }
  if ('goal' in i && i.goal !== 'finish' && i.goal !== 'time_target') add('GOAL_ENUM', `goal ${JSON.stringify(i.goal)}`)
  if ('target_time' in i) {
    if (i.goal !== 'time_target') add('TARGET_WITHOUT_TIME_GOAL', 'target_time is only built for a time goal')
    if (!(typeof i.target_time === 'string' && HMS.test(i.target_time))) {
      add('TARGET_TIME_FORMAT', `target_time ${JSON.stringify(i.target_time)} is not H:MM:SS`)
    }
  }

  // ── Volume rulers ───────────────────────────────────────────────────────────────────
  const R = GENERATION_CONFIG.WIZARD_VOLUME_RULER
  if ('current_weekly_km' in i && !onRuler(i.current_weekly_km, R.WEEKLY_KM_MIN, R.WEEKLY_KM_MAX, R.WEEKLY_KM_STEP)) {
    add('WEEKLY_KM_OFF_RULER', `${i.current_weekly_km} is not a stop on the ${R.WEEKLY_KM_MIN}–${R.WEEKLY_KM_MAX} step-${R.WEEKLY_KM_STEP} ruler`)
  }
  if ('longest_recent_run_km' in i
    && !onRuler(i.longest_recent_run_km, R.LONGEST_RUN_KM_MIN, R.LONGEST_RUN_KM_MAX, R.LONGEST_RUN_KM_STEP)) {
    add('LONGEST_RUN_OFF_RULER', `${i.longest_recent_run_km} is not a stop on the longest-run ruler`)
  }
  if (volumePairProblem(i.current_weekly_km as number, i.longest_recent_run_km as number)) {
    add('VOLUME_PAIR', `longest ${i.longest_recent_run_km} > weekly ${i.current_weekly_km}; the longest-run step refuses it`)
  }

  // ── The week grid (`weekPlanToInputs`) ──────────────────────────────────────────────
  let rest: string[] = []
  if ('days_cannot_train' in i) {
    const d = i.days_cannot_train
    if (!Array.isArray(d) || d.length === 0) {
      add('REST_DAYS_SHAPE', 'days_cannot_train is sent only as a non-empty list (undefined when none)')
    } else {
      rest = d.map(String)
      const bad = rest.filter(x => !(WEEK_FULL as readonly string[]).includes(x))
      if (bad.length) add('REST_DAY_SPELLING', `${bad.join(', ')}: the wizard sends full lowercase day names`)
      const canonical = WEEK_FULL.filter(x => rest.includes(x))
      if (!bad.length && (new Set(rest).size !== rest.length || canonical.join() !== rest.join())) {
        add('REST_DAY_ORDER', 'rest days come out of the grid once each, Monday first')
      }
    }
  }
  if ('days_available' in i) {
    const n = i.days_available
    if (!(typeof n === 'number' && Number.isInteger(n)) || n !== 7 - rest.length) {
      add('DAY_SPLIT', `days_available ${n} is not 7 − ${rest.length} rest days; the grid derives one from the other`)
    }
    const thr = dist ? GENERATION_CONFIG.DAYS_AVAILABILITY_THRESHOLDS[raceDistanceKey(dist.value)] : null
    if (typeof n === 'number' && thr && n < thr.block) add('DAYS_BLOCKED', `${n} days is blocked for this distance on the your-week step`)
  }
  if ('preferred_long_run_day' in i) {
    const l = i.preferred_long_run_day
    if (l !== 'sat' && l !== 'sun') add('LONG_DAY_ENUM', `preferred_long_run_day ${JSON.stringify(l)}`)
    // `longDay ?? 'sun'`: Saturday is only ever sent because Saturday was MARKED long, so it runs.
    // Sunday is also the default with no long day marked, so a resting Sunday is legal.
    if (l === 'sat' && rest.includes('saturday')) add('LONG_DAY_ON_REST', 'a Saturday long run on a rest Saturday')
  }

  // ── Weekday cap and per-day budgets ─────────────────────────────────────────────────
  const chipMins = MAX_WEEKDAY_CHIPS.map(c => c.mins).filter((m): m is number => m != null)
  if ('max_weekday_mins' in i && !chipMins.includes(i.max_weekday_mins as number)) {
    add('WEEKDAY_CAP_NOT_A_CHIP', `max_weekday_mins ${i.max_weekday_mins} is not a chip value`)
  }
  const runningWeekdays = Object.keys(WEEKDAY_FULL_TO_SHORT).filter(d => !rest.includes(d))
    .map(d => WEEKDAY_FULL_TO_SHORT[d])
  if ('day_budgets' in i) {
    const b = i.day_budgets as Record<string, unknown>
    const keys = b && typeof b === 'object' ? Object.keys(b) : []
    if (!keys.length) add('DAY_BUDGETS_SHAPE', 'day_budgets is sent only non-empty (undefined when none)')
    for (const k of keys) {
      if (!(runningWeekdays as string[]).includes(k)) add('DAY_BUDGET_ON_REST_DAY', `${k} is not a running weekday; the wizard prunes it`)
      if (!WIZARD_DAY_BUDGET_MINS.includes(b[k] as number)) add('DAY_BUDGET_NOT_AN_OPTION', `${k}: ${b[k]}`)
    }
    // `maxWeekdayMins = min(budget ?? default)` over running weekdays. With every running weekday
    // budgeted the default drops out, so the cap must EQUAL the minimum; with some unbudgeted it is
    // min(budgets, chip), so it can be no higher than the minimum and must exist.
    const vals = keys.map(k => b[k]).filter((v): v is number => typeof v === 'number')
    if (vals.length) {
      const lo = Math.min(...vals)
      const cap = i.max_weekday_mins as number | undefined
      const allBudgeted = runningWeekdays.every(d => keys.includes(d))
      if (cap === undefined) add('DAY_BUDGETS_WITHOUT_CAP', 'budgets set but no max_weekday_mins; the wizard derives the cap from them')
      else if (allBudgeted ? cap !== lo : cap > lo) {
        add('DAY_BUDGETS_CAP_MISMATCH', `max_weekday_mins ${cap} is not the minimum the grid derives (${lo})`)
      }
    }
  }

  // ── Single answers ──────────────────────────────────────────────────────────────────
  if ('injury_history' in i) {
    const inj = i.injury_history
    if (!Array.isArray(inj) || inj.length === 0) add('INJURY_SHAPE', 'injury_history is sent only as a non-empty list')
    else {
      const bad = inj.filter(x => !WIZARD_INJURY_WIRE.includes(String(x)))
      if (bad.length) add('INJURY_SPELLING', `${bad.join(', ')}: not a chip's posted spelling (${WIZARD_INJURY_WIRE.join(', ')})`)
      if (new Set(inj).size !== inj.length) add('INJURY_DUPLICATE', 'a chip toggles, so it appears once')
    }
  }
  if ('age' in i && !(typeof i.age === 'number' && Number.isInteger(i.age) && i.age >= 10 && i.age <= 100)) {
    add('AGE_RANGE', `age ${i.age} is outside what hrGuardableAge returns (10–100)`)
  }
  const enumCheck = (k: string, allowed: readonly unknown[], code: string) => {
    if (k in i && !allowed.includes(i[k])) add(code, `${k} ${JSON.stringify(i[k])}`)
  }
  enumCheck('training_age', WIZARD_TRAINING_AGES, 'TRAINING_AGE_ENUM')
  enumCheck('recent_quality_training', WIZARD_RECENT_QUALITY, 'RECENT_QUALITY_ENUM')
  enumCheck('user_declared_level', WIZARD_LEVELS, 'DECLARED_LEVEL_ENUM')
  enumCheck('hard_session_relationship', WIZARD_HARD_SESSIONS, 'HARD_SESSION_ENUM')
  enumCheck('terrain', WIZARD_TERRAINS, 'TERRAIN_ENUM')
  enumCheck('max_hr_source', ['observed', 'user_confirmed'], 'MAX_HR_SOURCE_ENUM')
  if (opts.tier === 'free') {
    for (const k of ['hard_session_relationship', 'terrain']) {
      if (k in i) add('PAID_ONLY_FIELD', `\`${k}\` is asked only with paid access`)
    }
  }
  for (const k of ['resting_hr', 'max_hr']) {
    if (k in i && !(typeof i[k] === 'number' && (i[k] as number) > 0)) add('HR_VALUE', `${k} ${i[k]}`)
  }
  if ('max_hr_source' in i && !('max_hr' in i)) add('MAX_HR_SOURCE_WITHOUT_MAX', 'provenance is only stamped on a max the wizard sends')

  // ── Benchmark (`benchmarkFromFields` → `benchmarkProblem`) ─────────────────────────
  if ('benchmark' in i) {
    const b = i.benchmark as Record<string, unknown>
    const raceKms: number[] = [...BENCHMARK_DISTANCES.map(d => d.value), ...WIZARD_DISTANCES.map(d => d.value)]
    if (b?.type === 'race') {
      // A race at a BENCHMARK_DISTANCES value, or CI-4's estimate at the plan's own distance.
      if (!raceKms.includes(b.distance_km as number)) add('BENCHMARK_DISTANCE', `race benchmark distance ${b.distance_km} is not one the step offers`)
      if (!(typeof b.time === 'string' && HMS.test(b.time))) add('BENCHMARK_TIME_FORMAT', `race time ${JSON.stringify(b.time)} is not H:MM:SS`)
    } else if (b?.type === 'tt_30min') {
      if (b.time !== '30:00') add('BENCHMARK_TIME_FORMAT', 'a 30-minute trial is always sent as "30:00"')
      if (!(typeof b.distance_km === 'number' && b.distance_km > 0)) add('BENCHMARK_DISTANCE', `tt distance ${b.distance_km}`)
    } else {
      add('BENCHMARK_TYPE', `benchmark type ${JSON.stringify(b?.type)}`)
    }
    if ('benchmark_date' in (b ?? {}) && !(typeof b.benchmark_date === 'string' && ISO_DATE.test(b.benchmark_date))) {
      add('BENCHMARK_DATE_FORMAT', `benchmark_date ${JSON.stringify(b.benchmark_date)}`)
    }
    const extra = Object.keys(b ?? {}).filter(k => !['type', 'distance_km', 'time', 'benchmark_date'].includes(k))
    if (extra.length) add('BENCHMARK_UNKNOWN_KEY', extra.join(', '))
    if (b && (b.type === 'race' || b.type === 'tt_30min')) {
      const p = benchmarkProblem(b as never, opts.today)
      if (p) add('BENCHMARK_REFUSED', `the benchmark step refuses it (${p})`)
    }
  }
  return out
}
