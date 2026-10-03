/**
 * FOUNDATION-BUDGET-01 step 0 — partition the population, and pin the CONTROL.
 *
 *   npm run partition:foundation            # measure and diff against the baseline
 *   npm run partition:foundation -- --write # (re)write the baseline, a DECLARED act
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * The founder asked the one question the build plan could not answer: *where is
 * the confidence this will not impact plans that do NOT carry the symptom?*
 *
 * Coaching Board sitting 2 (2026-10-03) ruled that foundation weekday sessions
 * must carry a duration and be sized against the runner's stated day budgets at
 * construction. That changes `buildFoundationSessions`, which runs for EVERY plan
 * with a >28-day runway — not only the slow runners who overrun. So the risk is
 * not "does the fix work", it is "does the fix touch plans that were already fine".
 *
 * So the population is split in two and the CONTROL half is pinned by hash:
 *
 *   SYMPTOMATIC   at least one foundation weekday session whose implied duration
 *                 (distance_km x the plan's own easy pace) exceeds that day's
 *                 budget. These are expected to change.
 *   ASYMPTOMATIC  none. ⚠️ THESE MUST BE BYTE-IDENTICAL AFTER THE CHANGE.
 *                 Not "similar", not "no new violations" — identical hashes, the
 *                 same claim `verify:parity` makes. A plan with nothing to fix
 *                 that moves anyway is the definition of collateral damage.
 *
 * ── WHY A HASH AND NOT A RE-MEASURE ─────────────────────────────────────────
 * Re-running the symptom predicate after the change would prove the symptom is
 * gone and say NOTHING about what else moved. The hash is the only form of the
 * claim that cannot be satisfied by accident.
 *
 * Volatile fields are stripped exactly as `verify:parity` strips them, for the
 * same reason: the first version of that script reported all 2,592 plans changed
 * because it hashed a wall-clock stamp.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { generateRulePlan } from '../lib/plan/ruleEngine'
import { composePlanWithFoundation } from '../lib/plan/foundationCompose'
import { isLongRun } from '../lib/plan/sessionRole'
import type { GeneratorInput } from '../types/plan'

const BASELINE = join(__dirname, '..', 'lib', 'plan', '__fixtures__', 'foundationPartitionBaseline.json')
const WRITE = process.argv.includes('--write')

/** Same list `verify:parity` strips, and for the same reason. */
const STRIP_META = ['generated_at', 'created_at', 'updated_at']
const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri'] as const

/** TEST-CLOCK — pinned. `today` sits well before `plan_start` so a runway exists. */
const TODAY = '2026-10-03'
const PLAN_START = '2026-12-07'

interface Row { key: string; symptomatic: boolean; hash: string; overs: number; worstPct: number }
type Baseline = { version: number; today: string; plan_start: string; rows: Record<string, Omit<Row, 'key'>> }
const REPORT_VERSION = 1

/**
 * The plan's OWN easy pace, read from its first duration-bearing weekday easy
 * session. ⚠️ Derived from the artifact rather than recomputed: a second pace
 * owner is the DELOAD-OWNER-01 class, and the engine's own number is the one the
 * runner will experience.
 */
function easyPaceOf(plan: { weeks: any[] }): number | null {
  for (const w of plan.weeks) {
    if (w.n <= 0) continue
    for (const d of WEEKDAYS) {
      const s = w.sessions?.[d]
      if (s && s.type === 'easy' && !isLongRun(s) && s.duration_mins > 0 && s.distance_km > 0) {
        return s.duration_mins / s.distance_km
      }
    }
  }
  return null
}

function stableHash(plan: unknown): string {
  const stable = JSON.parse(JSON.stringify(plan))
  for (const f of STRIP_META) {
    if (stable?.meta) delete stable.meta[f]
    delete stable[f]
  }
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex').slice(0, 16)
}

/** Does this composed plan carry the symptom, and how badly? */
function symptom(plan: any, input: GeneratorInput) {
  const budgets = (input as any).day_budgets as Record<string, number> | undefined
  const flat = (input as any).max_weekday_mins as number | undefined
  const pace = easyPaceOf(plan)
  if (pace == null) return { overs: 0, worstPct: 0, measurable: false }
  let overs = 0, worstPct = 0
  for (const w of plan.weeks) {
    if (w.n > 0) continue                     // foundation weeks only
    for (const d of WEEKDAYS) {
      const s = w.sessions?.[d]
      if (!s || isLongRun(s) || !s.distance_km) continue
      const cap = budgets?.[d] ?? flat
      if (cap == null) continue
      const implied = s.distance_km * pace
      if (implied <= cap) continue
      overs++
      worstPct = Math.max(worstPct, Math.round(100 * (implied - cap) / cap))
    }
  }
  return { overs, worstPct, measurable: true }
}

// ── The grid. Widened on PACE and BUDGET specifically, because those are what
// decide the symptom — so a control cohort only exists if both are varied.
const BENCHMARKS = [
  ['fast10k', { type: 'race', distance_km: 10, time: '0:42:00' }],
  ['mid10k', { type: 'race', distance_km: 10, time: '0:52:00' }],
  ['hm150', { type: 'race', distance_km: 21.1, time: '1:50:00' }],
  ['hm216', { type: 'race', distance_km: 21.1, time: '2:16:00' }],
  ['hm230', { type: 'race', distance_km: 21.1, time: '2:30:00' }],
] as const
const BUDGETS: Array<[string, Record<string, number> | undefined]> = [
  ['flat', undefined],
  ['tight', { mon: 30, tue: 30, wed: 30, thu: 30, fri: 30 }],
  ['uneven', { mon: 30, wed: 60, thu: 90 }],
  ['roomy', { mon: 75, tue: 75, wed: 75, thu: 90, fri: 75 }],
]
const CAPS = [30, 45, 60, 90]
const VOLUMES = [12, 20, 30, 45]
const INJURIES: Array<[string, string[] | undefined]> = [
  ['none', undefined],
  ['knee+shin', ['knee', 'shin splints']],
]
const DISTANCES: Array<[string, number, string]> = [
  ['mara', 42.2, '2027-04-24'],
  ['hm', 21.1, '2027-03-14'],
]

const BASE = {
  age: 38, goal: 'finish', max_hr: 190, terrain: 'road', resting_hr: 57,
  training_age: '6-18mo', max_hr_source: 'observed', days_available: 4,
  user_declared_level: 'intermediate', longest_recent_run_km: 12,
  preferred_long_run_day: 'sat', recent_quality_training: 'none',
  hard_session_relationship: 'neutral', days_cannot_train: ['tuesday', 'sunday'],
} as unknown as GeneratorInput

const rows: Row[] = []
let refused = 0, noFoundation = 0, unmeasurable = 0

for (const [bl, bench] of BENCHMARKS)
  for (const [budl, budgets] of BUDGETS)
    for (const cap of CAPS)
      for (const vol of VOLUMES)
        for (const [injl, injuries] of INJURIES)
          for (const [dl, dist, raceDate] of DISTANCES) {
            const key = `${dl}/${bl}/${budl}/cap${cap}/v${vol}/${injl}`
            const input = {
              ...(BASE as any), benchmark: bench, race_distance_km: dist, race_date: raceDate,
              current_weekly_km: vol, max_weekday_mins: cap,
              ...(budgets ? { day_budgets: budgets } : {}),
              ...(injuries ? { injury_history: injuries } : {}),
            } as GeneratorInput
            let plan: any
            try { plan = generateRulePlan(input, 'paid', PLAN_START) } catch { refused++; continue }
            let composed: any
            try { composed = composePlanWithFoundation(plan, input, TODAY, 'add').plan } catch { refused++; continue }
            if (!composed.weeks.some((w: any) => w.n <= 0)) { noFoundation++; continue }
            const s = symptom(composed, input)
            if (!s.measurable) { unmeasurable++; continue }
            rows.push({ key, symptomatic: s.overs > 0, hash: stableHash(composed), overs: s.overs, worstPct: s.worstPct })
          }

const sym = rows.filter(r => r.symptomatic)
const asym = rows.filter(r => !r.symptomatic)
console.log(`\n═══ FOUNDATION-BUDGET-01 — population partition ═══\n`)
console.log(`  grid cells evaluated            ${rows.length + refused + noFoundation + unmeasurable}`)
console.log(`    refused / no foundation       ${refused} / ${noFoundation}`)
console.log(`    no derivable easy pace        ${unmeasurable}`)
console.log(`  PLANS IN THE PARTITION          ${rows.length}`)
console.log(``)
console.log(`  🔴 SYMPTOMATIC (expected to change)   ${sym.length}  (${rows.length ? (100 * sym.length / rows.length).toFixed(1) : 0}%)`)
console.log(`  ✅ ASYMPTOMATIC — THE CONTROL        ${asym.length}  (${rows.length ? (100 * asym.length / rows.length).toFixed(1) : 0}%)`)
console.log(``)
if (sym.length) {
  console.log(`  symptomatic: total over-budget sessions ${sym.reduce((a, r) => a + r.overs, 0)}`)
  console.log(`               worst single overrun       +${Math.max(...sym.map(r => r.worstPct))}%`)
}

const was: Baseline | null = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : null

if (WRITE) {
  const out: Baseline = {
    version: REPORT_VERSION, today: TODAY, plan_start: PLAN_START,
    rows: Object.fromEntries(rows.map(r => [r.key, { symptomatic: r.symptomatic, hash: r.hash, overs: r.overs, worstPct: r.worstPct }])),
  }
  writeFileSync(BASELINE, JSON.stringify(out, null, 1))
  console.log(`\n✓ baseline written: ${rows.length} plans (${asym.length} control)`)
  console.log(`  ⚠️ Say in the commit WHY. Never re-baseline to turn a run green.`)
  process.exit(0)
}

if (!was) { console.log(`\n· no baseline yet. Run with --write to create one.`); process.exit(0) }
if (was.version !== REPORT_VERSION || was.today !== TODAY || was.plan_start !== PLAN_START) {
  console.error(`\n✗ baseline is incomparable (version/clock changed). Re-baseline deliberately.`)
  process.exit(2)
}

// ── THE GATE. Two different failures, reported separately, because they mean
// opposite things: a control plan moving is COLLATERAL DAMAGE; a symptomatic
// plan not moving means the fix did not reach it.
const movedControl: string[] = []
const vanished: string[] = []
const appeared: string[] = []
for (const r of rows) {
  const prev = was.rows[r.key]
  if (!prev) { appeared.push(r.key); continue }
  if (!prev.symptomatic && !r.symptomatic && prev.hash !== r.hash) movedControl.push(r.key)
}
for (const k of Object.keys(was.rows)) if (!rows.find(r => r.key === k)) vanished.push(k)

let fail = false
if (movedControl.length) {
  fail = true
  console.error(`\n🔴 ${movedControl.length} ASYMPTOMATIC plan(s) CHANGED. These had nothing to fix.`)
  for (const k of movedControl.slice(0, 12)) console.error(`     ${k}`)
  if (movedControl.length > 12) console.error(`     … and ${movedControl.length - 12} more`)
  console.error(`   This is collateral damage, not a declarable move. Do not re-baseline.`)
}
if (appeared.length || vanished.length) {
  fail = true
  console.error(`\n✗ the grid itself moved: ${appeared.length} new cell(s), ${vanished.length} gone.`)
  console.error(`   A changed population cannot be compared. Re-baseline deliberately.`)
}
if (fail) process.exit(1)
console.log(`\n✓ all ${asym.length} control plans byte-identical; grid unchanged.`)
