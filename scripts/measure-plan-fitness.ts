/**
 * PLAN-FITNESS-01 — is a generated plan actually fit for purpose?
 *
 * `verify` proves plans are VALID. `cohort:shape` proves the population has not
 * silently reclassified. NEITHER asks the question a coach asks first: **does
 * this plan build the runner, and does it build them far enough to finish the
 * race safely?**
 *
 * It did not, and nothing could see it. Measured 2026-09-17, before the fix:
 *   · an injury-history runner built **+6%** over 18 weeks against **+91%** for
 *     an identical healthy twin — the knee flag alone, nothing else changed;
 *   · 29% of injury plans NEVER exceeded their own week-1 volume;
 *   · a first-time marathoner with a 24-week runway and no constraints peaked at
 *     a **21 km** long run, 50% of race distance, against a 30-32 km norm.
 *
 * Run: `npm run measure:fitness [-- --json | --write]`
 *
 * ⚠️ GATED ON EVERY BUILD by `lib/plan/planFitness.test.ts`, inside
 * `npm run verify`. It was NOT, for the first few hours of its life, and this
 * repo's whole history says a check that only runs when someone remembers is a
 * check that does not run.
 */
import { join } from 'node:path'
import { CHARITY_PERSONAS, charityInput, CHARITY_PLAN_START } from '../lib/plan/charityCohort'
import { cohortGrid, targetedGrid, COHORT_PLAN_START } from '../lib/plan/cohortGrid'
import { generateRulePlan } from '../lib/plan/ruleEngine'
import { GENERATION_CONFIG as G } from '../lib/plan/generationConfig'
import { isLongRun } from '../lib/plan/sessionRole'
import { sessionKmSelfPaced } from '../lib/plan/sessionDistance'
import type { GeneratorInput, Plan, Week } from '../types/plan'

const km = (s: unknown) => sessionKmSelfPaced(s as never) ?? 0
const longOf = (w: Week) => km(Object.values(w.sessions).find(s => s && isLongRun(s)))
const isDeload = (w: Week) => w.type === 'deload' || w.badge === 'deload'

/** Weeks that represent the runner's actual training load — deloads, taper and
 *  race week are excluded, because "did the plan build you" is a question about
 *  the building weeks. */
const buildingWeeks = (p: Plan) =>
  p.weeks.filter(w => w.n >= 1 && w.type !== 'race' && w.phase !== 'taper' && !isDeload(w))

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
/** Coprime stride — a PREFIX of an ordered grid is not a sample (LIVENESS-DEBT-01). */
const spread = <T,>(c: readonly T[]): T[] => {
  const n = c.length
  if (n < 3) return [...c]
  let step = Math.max(1, Math.round(n * 0.6180339887))
  while (step > 1 && gcd(step, n) !== 1) step--
  return Array.from({ length: n }, (_, k) => c[(k * step) % n] as T)
}

interface Row { n: number; gains: number[]; flat: number; peakLrPct: number[] }
const blank = (): Row => ({ n: 0, gains: [], flat: 0, peakLrPct: [] })
const med = (a: number[]) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]! : 0)

export function measure() {
  const pool = [
    ...spread(cohortGrid()).slice(0, 1400),
    ...spread(targetedGrid()).slice(0, 600),
  ] as GeneratorInput[]

  const buckets = new Map<string, Row>()
  // ⚠️ The injury x masters cell exists in NEITHER grid (cohortGrid does not vary
  // injury; targetedGrid is all age 40) and the arithmetic says it is the WORST
  // case. Constructed explicitly so the worst case is never again unmeasured.
  const constructed: GeneratorInput[] = []
  for (const age of [40, 52])
    for (const injury_history of [[], ['knee']])
      for (const dist of [10, 21.1, 42.2])
        constructed.push({
          athlete_name: 'X', age, race_name: 'R', primary_metric: 'distance',
          plan_start: COHORT_PLAN_START, race_distance_km: dist,
          race_date: new Date(Date.parse(COHORT_PLAN_START) + 18 * 7 * 864e5).toISOString().slice(0, 10),
          goal: 'finish', resting_hr: 52, max_hr: 180, current_weekly_km: 30,
          longest_recent_run_km: 14, fitness_level: 'intermediate',
          recent_quality_training: 'occasional', hard_session_relationship: 'neutral',
          training_age: '2-5yr', days_available: 4, days_cannot_train: [],
          injury_history: [...injury_history],
        } as unknown as GeneratorInput)

  for (const input of [...pool, ...constructed]) {
    let plan: Plan
    try { plan = generateRulePlan(input, 'trial', COHORT_PLAN_START, undefined, COHORT_PLAN_START) }
    catch { continue }
    const ws = buildingWeeks(plan)
    if (ws.length < 4) continue
    const injured = (input.injury_history ?? []).some(i => /knee|shin/i.test(i))
    const masters = (input.age ?? 0) >= GENERATION_CONFIG_MASTERS
    const key = `${injured ? 'INJURY ' : 'healthy'} ${masters ? 'masters ' : 'standard'}`
    const row = buckets.get(key) ?? blank()
    const first = ws[0]!.weekly_km
    const peak = Math.max(...ws.map(w => w.weekly_km))
    row.n++
    if (first > 0) row.gains.push(peak / first)
    if (peak <= first * 1.02) row.flat++
    if (input.race_distance_km > 40) {
      const lr = Math.max(...plan.weeks.filter(w => w.n >= 1).map(longOf), 0)
      row.peakLrPct.push(lr / input.race_distance_km * 100)
    }
    buckets.set(key, row)
  }

  const personas = CHARITY_PERSONAS.filter(p => p.input.race_distance_km > 40).map(p => {
    try {
      const plan = generateRulePlan(charityInput(p, CHARITY_PLAN_START), 'trial',
        CHARITY_PLAN_START, undefined, CHARITY_PLAN_START)
      const ws = buildingWeeks(plan)
      const lr = Math.max(...plan.weeks.filter(w => w.n >= 1).map(longOf), 0)
      const first = ws[0]?.weekly_km ?? 0
      const peak = Math.max(...ws.map(w => w.weekly_km), 0)
      return { id: p.id, peakLr: lr, pctOfRace: lr / 42.2 * 100,
               netBuildPct: first > 0 ? (peak / first - 1) * 100 : 0, refused: false }
    } catch { return { id: p.id, peakLr: 0, pctOfRace: 0, netBuildPct: 0, refused: true } }
  })

  return { buckets: Object.fromEntries(Array.from(buckets.entries()).sort().map(([k, r]) => [k, {
    n: r.n,
    medianBuildPct: +((med(r.gains) - 1) * 100).toFixed(1),
    neverBuildsPct: +(r.flat / r.n * 100).toFixed(1),
    medianMarathonLrPctOfRace: r.peakLrPct.length ? +med(r.peakLrPct).toFixed(1) : null,
  }])), personas }
}

const GENERATION_CONFIG_MASTERS = (G as unknown as { MASTERS_AGE_THRESHOLD: number }).MASTERS_AGE_THRESHOLD

if (process.argv[1]?.includes('measure-plan-fitness')) {
  const r = measure()
  // Re-baseline. ONLY with a declared reason, exactly as cohort:shape requires —
  // never to turn a red test green. The JSON diff is the statement.
  if (process.argv.includes('--write')) {
    const { writeFileSync } = require('node:fs') as typeof import('node:fs')
    const out = join(process.cwd(), 'lib/plan/__fixtures__/planFitnessBaseline.json')
    writeFileSync(out, JSON.stringify(r, null, 2) + '\n')
    console.log(`baseline written: ${out}`)
  } else if (process.argv.includes('--json')) { console.log(JSON.stringify(r, null, 2)); }
  else {
    console.log('NET BUILD — peak building week vs week 1 (deloads/taper/race excluded)\n')
    console.log('cohort               n      median build   never builds   marathon peak LR (% of race)')
    for (const [k, v] of Object.entries(r.buckets) as [string, { n: number; medianBuildPct: number; neverBuildsPct: number; medianMarathonLrPctOfRace: number | null }][]) {
      console.log(`  ${k.padEnd(18)}${String(v.n).padStart(5)}${String(v.medianBuildPct + '%').padStart(14)}` +
        `${String(v.neverBuildsPct + '%').padStart(15)}${String(v.medianMarathonLrPctOfRace ?? '-').padStart(22)}`)
    }
    console.log('\nMARATHON REVIEW PERSONAS — peak long run vs the 30-32km first-marathon norm\n')
    for (const p of r.personas) {
      console.log(p.refused ? `  ${p.id.padEnd(52)} refused by design`
        : `  ${p.id.padEnd(52)} ${p.peakLr.toFixed(1).padStart(5)}km  ${p.pctOfRace.toFixed(0).padStart(3)}% of race   net build ${p.netBuildPct.toFixed(0)}%`)
    }
  }
}
