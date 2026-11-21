import type { GeneratorInput, BenchmarkInput, TrainingAge } from '@/types/plan'
import realInputs from '@/lib/plan/__fixtures__/real-inputs.json'
import {
  WEEKDAYS, weekPlanToInputs, dayCountVerdict,
  type WeekPlan, type DayState, type DayBudgets, type DayKey,
} from '@/components/shared/WeekGrid.logic'
import {
  WIZARD_DISTANCES, WIZARD_INJURY_WIRE, MAX_WEEKDAY_CHIPS, WIZARD_DAY_BUDGET_MINS,
  WIZARD_TRAINING_AGES, WIZARD_RECENT_QUALITY, WIZARD_HARD_SESSIONS, WIZARD_TERRAINS,
  WIZARD_LEVELS, WIZARD_BIRTH_YEAR_AGE_MIN, WIZARD_BIRTH_YEAR_AGE_MAX,
} from '@/lib/plan/wizardOptions'
import { GENERATION_CONFIG, raceDistanceKey } from '@/lib/plan/generationConfig'
import { volumePairProblem } from '@/lib/plan/volumeConsistency'
import { recommendFitnessLevel, type FitnessLevel } from '@/lib/plan/fitnessAssessment'
import { hrGuardableAge } from '@/lib/plan/hrSaveResolution'
import { BENCHMARK_DISTANCES, benchmarkFromFields, benchmarkProblem } from '@/lib/plan/benchmarkCheck'
import { estimateRaceSeconds } from '@/lib/plan/aerobicEstimate'
import { addDays, formatDate, nextMonday } from '@/lib/plan/length'

/**
 * ADR027-B0-GOLDEN-CORPUS — the golden corpus: `GeneratorInput` rows built from the WIZARD'S OWN
 * answer space, so every row is one a runner can actually post (ARCH-ENG-007).
 *
 * 🔴 WHY IT EXISTS. Every measurement corpus this repo has was hand-authored, and each one was
 * wrong about what the product sends in a different way: six set `fitness_level`, which no
 * production caller sends (COHORT-GRID-UNSET-LEVEL-01); one sent `day_budgets` without the cap
 * the wizard derives from them (GRID-DAY-BUDGET-NO-CAP-01); the property sweep tested weekday
 * caps of 45/60/90 while both real users chose 30 (`real-inputs.json`'s readme). ADR-027's
 * Scorecard v2 is measured on THIS corpus, so it derives every value from the owners the wizard
 * itself uses rather than from a description of them:
 *
 *   · options            → `wizardOptions.ts` (the wizard imports the same lists)
 *   · the week grid      → `weekPlanToInputs`, the wizard's one engine touch, over every legal
 *                          Rest/Run/Long layout, gated by `dayCountVerdict` exactly as the step is
 *   · volume rulers      → `GENERATION_CONFIG.WIZARD_VOLUME_RULER`, pairs gated by `volumePairProblem`
 *   · declared level     → `recommendFitnessLevel`, called exactly as `handleGenerate` calls it
 *   · age                → `hrGuardableAge(birthYear)`, absent when the step is skipped
 *   · benchmark          → `benchmarkFromFields` + `benchmarkProblem`, the step's own gate
 *
 * ⚠️ `fitness_level` IS NEVER SET. The wizard sends the level on `user_declared_level` and
 * `wizardShape.ts` refuses a row that sets the API's structural override.
 *
 * ── THE SPACE ────────────────────────────────────────────────────────────────────────────
 * A mixed-radix index over the ANSWER space, partitioned into strata of
 * (tier × distance × budget mode). It counts answer COMBINATIONS: the wizard prunes a per-day
 * budget set on a day later marked Rest (`pruneDayBudgets`), so distinct posted inputs are fewer
 * than the index count. The size exceeds 2^53, so indices are `bigint`.
 *
 * ── THE SAMPLE ───────────────────────────────────────────────────────────────────────────
 * Stratified and deterministic: every stratum gets its share, and within a stratum row k is
 * index `k × stride mod size` with the stride the coprime nearest `size / φ` (a Kronecker
 * sequence), so every prefix is spread across every digit. 🔴 An even stride on a structured
 * grid aliases (a stride of 32 on a 2⁹×81 grid reached 0 VDOTs in 1,260 plans), so coprimality
 * is CHECKED, not assumed: `strideFor` throws if it cannot find one.
 *
 * ── WHY IT LIVES IN `lib/corpus/`, NOT `lib/plan/` ──────────────────────────────────────
 * It must call the wizard's own grid mapping, `weekPlanToInputs`, which lives in
 * `components/shared/WeekGrid.logic.ts`. `ENGINE-PURITY-GATE-01` forbids `lib/plan` importing
 * `@/components/`, and its baseline may only fall. A measurement corpus is not engine code and
 * should not ship in the extracted engine package (ADR-027), so it sits beside the engine.
 *
 * ── WHAT IT DOES NOT COVER ───────────────────────────────────────────────────────────────
 * The follow-up POSTs a refusal screen makes (`accept_base_build`, the §44/§52 acknowledgement
 * flags), the base-build checkpoint flow, the Update Paces and Adjust paths, and HealthKit values
 * beyond five fixed heart-rate profiles. `race_name` is omitted (redacted, no engine effect).
 */

// ─── Row shape ─────────────────────────────────────────────────────────────────────────

export type GoldenTier = 'free' | 'paid'
export type BudgetMode = 'none' | 'set'

export interface GoldenRow {
  /** Stable: `w:<tier>:<distance>:<budget>:<index>` for wizard rows, `p:<id>` for production. */
  id: string
  source: 'wizard' | 'production'
  /** `paid` means `hasPaidAccess` in the wizard (trial, subscription or charity grant). */
  tier: GoldenTier
  /** The date the row is generated against. Pass it as the engine's `todayOverride`. */
  asOf: string
  /** The engine's `planStart` for this row: next Monday after `asOf` for wizard rows (what
   *  `runEngine` derives), the captured start for production rows. */
  planStart: string
  input: GeneratorInput
  /** What the runner picks if the plan comes back in the >28-day `choice` foundation band. */
  foundation_choice: 'add' | 'as_is'
}

/** Pinned so the corpus is the same corpus every day. A Monday; `nextMonday` gives 2026-11-23. */
export const GOLDEN_AS_OF = '2026-11-16'

/** Per (tier × distance) group. 3/4 of it to budget mode `none`, 1/4 to `set`. */
export const GOLDEN_DEFAULT_PER_GROUP = 128

// ─── Axes ──────────────────────────────────────────────────────────────────────────────

const parseIso = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Every Rest/Run/Long layout the grid can hold: weekdays rest|run, weekend rest|run|long,
 *  at most one long (`cycleDay` demotes a second). 2⁵ × 8 = 256. */
export function allWeekLayouts(): WeekPlan[] {
  const weekend: [DayState, DayState][] = []
  for (const sat of ['rest', 'run', 'long'] as const) {
    for (const sun of ['rest', 'run', 'long'] as const) {
      if (sat === 'long' && sun === 'long') continue
      weekend.push([sat, sun])
    }
  }
  const out: WeekPlan[] = []
  for (let mask = 0; mask < 32; mask++) {
    for (const [sat, sun] of weekend) {
      const p = {} as WeekPlan
      WEEKDAYS.forEach((d, i) => { p[d] = (mask >> i) & 1 ? 'run' : 'rest' })
      p.sat = sat
      p.sun = sun
      out.push(p)
    }
  }
  return out
}

/** The layouts the `your-week` step lets through for this distance (`canProceed`). */
export function wizardLayoutsFor(distanceKm: number): WeekPlan[] {
  const key = raceDistanceKey(distanceKm)
  const thr = GENERATION_CONFIG.DAYS_AVAILABILITY_THRESHOLDS[key] ?? null
  return allWeekLayouts().filter(p =>
    dayCountVerdict(weekPlanToInputs(p).daysAvailable, thr, key, false).state !== 'blocked')
}

/** Every (weekly km, longest run) pair the two rulers can hold that `longest-run` lets through. */
export function wizardVolumePairs(): [number, number][] {
  const R = GENERATION_CONFIG.WIZARD_VOLUME_RULER
  const out: [number, number][] = []
  for (let w = R.WEEKLY_KM_MIN; w <= R.WEEKLY_KM_MAX; w += R.WEEKLY_KM_STEP) {
    for (let l = R.LONGEST_RUN_KM_MIN; l <= R.LONGEST_RUN_KM_MAX; l += R.LONGEST_RUN_KM_STEP) {
      if (volumePairProblem(w, l) === null) out.push([w, l])
    }
  }
  return out
}

/** Three target times per distance: quick, middling, steady. The picker is free-form; these
 *  span the goals §120's ambition checks were written for. */
const TARGETS: Record<string, [number, number, number][]> = {
  '5K':       [[0, 22, 0], [0, 28, 0], [0, 38, 0]],
  '10K':      [[0, 45, 0], [0, 58, 0], [1, 15, 0]],
  'HM':       [[1, 40, 0], [2, 5, 0], [2, 40, 0]],
  'MARATHON': [[3, 30, 0], [4, 15, 0], [5, 30, 0]],
  '50K':      [[4, 30, 0], [5, 45, 0], [7, 30, 0]],
  '100K':     [[10, 0, 0], [13, 0, 0], [17, 0, 0]],
}

/** Benchmark finish times per BENCHMARK_DISTANCES entry (≈ VDOT 50 / 38 / 28). */
const BENCH_TIMES: Record<number, [number, number, number][]> = {
  5:    [[0, 20, 0], [0, 27, 0], [0, 36, 0]],
  10:   [[0, 42, 0], [0, 56, 0], [1, 15, 0]],
  21.1: [[1, 32, 0], [2, 5, 0], [2, 45, 0]],
  42.2: [[3, 15, 0], [4, 20, 0], [5, 45, 0]],
}
const TT_DISTANCES = ['4.5', '6', '7.5']

/** Five ways max/resting HR reach the payload: none; Profile resting only; HealthKit
 *  (`observed`); Profile-typed max (`user_confirmed`); a stored max with no provenance. */
const HR_PROFILES: Pick<GeneratorInput, 'resting_hr' | 'max_hr' | 'max_hr_source'>[] = [
  {},
  { resting_hr: 58 },
  { resting_hr: 52, max_hr: 186, max_hr_source: 'observed' },
  { resting_hr: 60, max_hr: 178, max_hr_source: 'user_confirmed' },
  { max_hr: 190 },
]

/** Weeks from plan start to race week: inside §44's refusal band, its warn band, ordinary,
 *  and long runways that land in the >28-day foundation `choice` band. */
const RUNWAY_WEEKS = [3, 6, 9, 12, 16, 20, 26, 34, 52]

/** Every benchmark the step can post, dated against `asOf`, minus what `benchmarkProblem` refuses. */
export function wizardBenchmarks(asOf: string, raceDistanceKm: number): (BenchmarkInput | undefined)[] {
  const today = parseIso(asOf)
  const dates = ['', formatDate(addDays(today, -21)), formatDate(addDays(today, -300))]
  const built: (BenchmarkInput | null)[] = []
  const base = { type: null, distKm: null, hours: 0, mins: 0, secs: 0, ttDistKm: '', date: '' }
  for (const d of BENCHMARK_DISTANCES) {
    for (const [hours, mins, secs] of BENCH_TIMES[d.value]) {
      for (const date of dates) {
        built.push(benchmarkFromFields({ ...base, type: 'race', distKm: d.value, hours, mins, secs, date }))
      }
    }
  }
  for (const ttDistKm of TT_DISTANCES) {
    for (const date of dates) {
      built.push(benchmarkFromFields({ ...base, type: 'tt_30min', ttDistKm, date }))
    }
  }
  // CI-4's native estimate: pre-fills a RACE at the plan's own distance, hours + minutes only,
  // no date (GeneratePlanScreen's `setBenchHours`/`setBenchMins` on `data.available`).
  const est = estimateRaceSeconds(38, raceDistanceKm)
  built.push(benchmarkFromFields({ ...base, type: 'race', distKm: raceDistanceKm,
    hours: Math.floor(est / 3600), mins: Math.floor((est % 3600) / 60) }))
  // Skipped step first; then every built benchmark the step's own gate accepts.
  return [undefined, ...built.filter((b): b is BenchmarkInput => b !== null && benchmarkProblem(b, today) === null)]
}

const INJURY_SETS: (string[] | undefined)[] = Array.from({ length: 1 << WIZARD_INJURY_WIRE.length }, (_, m) => {
  const s = WIZARD_INJURY_WIRE.filter((_, i) => (m >> i) & 1)
  return s.length ? s : undefined
})

const AGES: (number | undefined)[] = [undefined]
for (let a = WIZARD_BIRTH_YEAR_AGE_MIN; a <= WIZARD_BIRTH_YEAR_AGE_MAX; a++) AGES.push(a)

const BUDGET_SET_PATTERNS = 7 ** WEEKDAYS.length - 1   // every per-day pattern bar "all absent"

// Literals, not bigint suffixes: the tsconfig target predates ES2020 bigint literals.
const B0 = BigInt(0)
const B1 = BigInt(1)

// ─── Strata ────────────────────────────────────────────────────────────────────────────

interface Axis<T> { name: string; values: readonly T[] }

interface Stratum {
  tier: GoldenTier
  distanceKm: number
  budget: BudgetMode
  axes: Axis<unknown>[]
  size: bigint
}

/** The axes in DIGIT order, least significant first. Order matters only for readability of an
 *  index; the Kronecker stride spreads every digit. */
function stratumAxes(asOf: string, tier: GoldenTier, distanceKm: number, budget: BudgetMode): Axis<unknown>[] {
  const key = raceDistanceKey(distanceKm)
  return [
    { name: 'goal', values: [null, ...TARGETS[key]] },
    // `accept` = the runner kept the recommended card; the other three are an explicit tap.
    { name: 'level', values: ['accept', ...WIZARD_LEVELS] },
    { name: 'training_age', values: [undefined, ...WIZARD_TRAINING_AGES] },
    { name: 'recent_quality', values: [undefined, ...WIZARD_RECENT_QUALITY] },
    { name: 'hr', values: HR_PROFILES },
    { name: 'foundation_choice', values: ['add', 'as_is'] },
    { name: 'race_weekday', values: [0, 1, 2, 3, 4, 5, 6] },
    { name: 'runway_weeks', values: RUNWAY_WEEKS },
    { name: 'hard', values: tier === 'paid' ? [undefined, ...WIZARD_HARD_SESSIONS] : [undefined] },
    { name: 'terrain', values: tier === 'paid' ? [undefined, ...WIZARD_TERRAINS] : [undefined] },
    { name: 'weekday_chip', values: MAX_WEEKDAY_CHIPS.map(c => c.mins) },
    { name: 'age', values: AGES },
    { name: 'benchmark', values: wizardBenchmarks(asOf, distanceKm) },
    { name: 'injuries', values: INJURY_SETS },
    { name: 'layout', values: wizardLayoutsFor(distanceKm) },
    { name: 'volume', values: wizardVolumePairs() },
    // Pattern p ≥ 1: base-7 digit per weekday, 0 = no override, k = WIZARD_DAY_BUDGET_MINS[k-1].
    { name: 'budgets', values: budget === 'none' ? [0] : Array.from({ length: BUDGET_SET_PATTERNS }, (_, i) => i + 1) },
  ]
}

const strataCache = new Map<string, Stratum[]>()

/** Every stratum, in a fixed order: free before paid, tile order, `none` before `set`. */
export function goldenStrata(asOf: string = GOLDEN_AS_OF): Stratum[] {
  const hit = strataCache.get(asOf)
  if (hit) return hit
  const out: Stratum[] = []
  for (const tier of ['free', 'paid'] as const) {
    // A free runner sees a paid tile locked (`canGenerateDistance`), so it is not an answer.
    for (const d of WIZARD_DISTANCES.filter(x => tier === 'paid' || !x.paid)) {
      for (const budget of ['none', 'set'] as const) {
        const axes = stratumAxes(asOf, tier, d.value, budget)
        const size = axes.reduce((n, a) => n * BigInt(a.values.length), B1)
        out.push({ tier, distanceKm: d.value, budget, axes, size })
      }
    }
  }
  strataCache.set(asOf, out)
  return out
}

/** The full answer-space size (answer combinations, not distinct inputs — see the header). */
export function goldenSpaceSize(asOf: string = GOLDEN_AS_OF): bigint {
  return goldenStrata(asOf).reduce((n, s) => n + s.size, B0)
}

// ─── Decoding ──────────────────────────────────────────────────────────────────────────

function budgetsFromPattern(p: number): DayBudgets {
  const out: DayBudgets = {}
  let rest = p
  for (const d of WEEKDAYS) {
    const k = rest % 7
    rest = Math.floor(rest / 7)
    if (k > 0) out[d] = WIZARD_DAY_BUDGET_MINS[k - 1]
  }
  return out
}

const FULL_BY_SHORT: Record<DayKey, string> = {
  mon: 'monday', tue: 'tuesday', wed: 'wednesday', thu: 'thursday',
  fri: 'friday', sat: 'saturday', sun: 'sunday',
}

/** Index → the wizard's posted input, built the way `handleGenerate` builds it. */
function decode(s: Stratum, index: bigint, asOf: string, id: string): GoldenRow {
  const pick: Record<string, unknown> = {}
  let rest = index
  for (const a of s.axes) {
    const r = BigInt(a.values.length)
    pick[a.name] = a.values[Number(rest % r)]
    rest /= r
  }
  const today = parseIso(asOf)
  const start = nextMonday(today)
  const [weekly, longest] = pick.volume as [number, number]
  const trainingAge = pick.training_age as TrainingAge | undefined
  const target = pick.goal as [number, number, number] | null
  const week = weekPlanToInputs(
    pick.layout as WeekPlan,
    pick.weekday_chip as number | undefined,
    budgetsFromPattern(pick.budgets as number),
  )
  // `recommendFitnessLevel` exactly as `handleGenerate` calls it; the runner then keeps it or
  // taps another card, and either way the result rides `user_declared_level`.
  const rec = recommendFitnessLevel(weekly, longest, trainingAge === '2-5yr' || trainingAge === '5yr+')
  const declared: FitnessLevel = pick.level === 'accept' ? rec.level : pick.level as FitnessLevel
  const age = pick.age as number | undefined
  const injuries = pick.injuries as string[] | undefined
  const raceDate = addDays(start, ((pick.runway_weeks as number) - 1) * 7 + (pick.race_weekday as number))

  const input: GeneratorInput = {
    race_date:              formatDate(raceDate),
    race_distance_km:       s.distanceKm,
    goal:                   target ? 'time_target' : 'finish',
    target_time:            target
      ? `${target[0]}:${String(target[1]).padStart(2, '0')}:${String(target[2]).padStart(2, '0')}`
      : undefined,
    age:                    age == null ? undefined
      : (hrGuardableAge(today.getFullYear() - age, today) ?? undefined),
    current_weekly_km:      weekly,
    longest_recent_run_km:  longest,
    days_available:         week.daysAvailable,
    ...(pick.hr as object),
    training_age:           trainingAge,
    recent_quality_training: pick.recent_quality as GeneratorInput['recent_quality_training'],
    user_declared_level:    declared,
    preferred_long_run_day: week.longDay ?? 'sun',
    benchmark:              pick.benchmark as BenchmarkInput | undefined,
    days_cannot_train:      week.restShort.length ? week.restShort.map(k => FULL_BY_SHORT[k]) : undefined,
    max_weekday_mins:       week.maxWeekdayMins,
    day_budgets:            week.dayBudgets,
    hard_session_relationship: pick.hard as GeneratorInput['hard_session_relationship'],
    injury_history:         injuries ? [...injuries] : undefined,
    terrain:                pick.terrain as GeneratorInput['terrain'],
  }
  // `JSON.stringify` drops undefined on the wire; drop it here so a row compares like a payload.
  for (const k of Object.keys(input) as (keyof GeneratorInput)[]) {
    if (input[k] === undefined) delete input[k]
  }
  return {
    id, source: 'wizard', tier: s.tier, asOf, planStart: formatDate(start), input,
    foundation_choice: pick.foundation_choice as 'add' | 'as_is',
  }
}

/** Row at a GLOBAL index in `[0, goldenSpaceSize())` — the full space, enumerable by index. */
export function goldenRowAt(index: bigint, asOf: string = GOLDEN_AS_OF): GoldenRow {
  let i = index
  for (const s of goldenStrata(asOf)) {
    if (i < s.size) return decode(s, i, asOf, `w:${s.tier}:${s.distanceKm}:${s.budget}:${i}`)
    i -= s.size
  }
  throw new RangeError(`golden index ${index} is outside the space (${goldenSpaceSize(asOf)})`)
}

/** Lazily walk the whole space in index order. It does not end in any useful time; it exists so
 *  "the full space is enumerable" is a function rather than a claim. */
export function* enumerateGolden(asOf: string = GOLDEN_AS_OF): Generator<GoldenRow> {
  const total = goldenSpaceSize(asOf)
  for (let i = B0; i < total; i++) yield goldenRowAt(i, asOf)
}

// ─── Sampling ──────────────────────────────────────────────────────────────────────────

export function gcd(a: bigint, b: bigint): bigint {
  let x = a < B0 ? -a : a
  let y = b < B0 ? -b : b
  while (y) [x, y] = [y, x % y]
  return x
}

/** 1/φ to 18 digits, as a rational over 10^18. */
const INV_PHI_NUM = BigInt('618033988749894848')
const INV_PHI_DEN = BigInt('1000000000000000000')

/** The stride for a stratum of `size`: the coprime nearest `size / φ`. Throws if none is found
 *  within a generous window, rather than falling back to a stride that aliases. */
export function strideFor(size: bigint): bigint {
  if (size <= B1) return B1
  const centre = (size * INV_PHI_NUM) / INV_PHI_DEN
  for (let d = B0; d < BigInt('10000'); d++) {
    for (const s of [centre + d, centre - d]) {
      if (s > B0 && s < size && gcd(s, size) === B1) return s
    }
  }
  throw new Error(`no coprime stride near size/φ for size ${size}`)
}

/**
 * The deterministic stratified sample. Each (tier × distance) group gets `perGroup` rows:
 * three quarters with no per-day budgets, one quarter with them, because budgets are a recent
 * optional control and a uniform draw would put an override on almost every weekday.
 */
export function goldenSample(opts: { asOf?: string; perGroup?: number } = {}): GoldenRow[] {
  const asOf = opts.asOf ?? GOLDEN_AS_OF
  const perGroup = opts.perGroup ?? GOLDEN_DEFAULT_PER_GROUP
  const setShare = Math.floor(perGroup / 4)
  const out: GoldenRow[] = []
  for (const s of goldenStrata(asOf)) {
    const n = BigInt(s.budget === 'set' ? setShare : perGroup - setShare)
    const stride = strideFor(s.size)
    for (let k = B0; k < n; k++) {
      const i = (k * stride) % s.size
      out.push(decode(s, i, asOf, `w:${s.tier}:${s.distanceKm}:${s.budget}:${i}`))
    }
  }
  return out
}

// ─── Production rows ───────────────────────────────────────────────────────────────────

/**
 * The four production-captured inputs (`__fixtures__/real-inputs.json`, persisted
 * `meta.generator_input`). Included verbatim: they ARE product-path rows, from EARLIER wizard
 * versions, so `wizardShape.ts` reads some of them as off today's wizard (short day names, no
 * `user_declared_level`), and that is declared in the gate rather than edited away here.
 */
export function goldenProductionRows(): GoldenRow[] {
  const cases = (realInputs as { cases: { id: string; captured: string; plan_start: string; tier: string; input: GeneratorInput }[] }).cases
  return cases.map(c => ({
    id: `p:${c.id}`,
    source: 'production' as const,
    tier: c.tier === 'free' ? 'free' as const : 'paid' as const,
    asOf: c.captured,
    planStart: c.plan_start,
    input: c.input,
    foundation_choice: 'as_is' as const,
  }))
}

/** The default golden corpus: the stratified wizard sample plus the production rows. */
export function goldenCorpus(opts: { asOf?: string; perGroup?: number } = {}): GoldenRow[] {
  return [...goldenSample(opts), ...goldenProductionRows()]
}
