// coaching-deviation-scan.ts — the REVIEW half of the coaching-review loop.
//
// `coaching-review-round.ts` GENERATES the packet and runs `validatePlan`. It
// reports "0 error violations" and that is exactly the trap: a plan can obey the
// constitution perfectly and still be a bad plan. RACE-WEEK-FITNESS-01 is the
// proof — 17 plans, zero violations, and one of them told a first-time
// marathoner to run 72 minutes the day before their race. The founder's
// instruction after it: a coaching review must not stop at "0 errors".
//
// So this scans for the things a COACH would catch and no invariant asserts.
// Every check here is deliberately NOT an invariant — if one of these ever
// deserves to be binding it should be promoted to `validatePlan` and deleted
// from here, not duplicated.
//
// Run: NODE_ENV=production npx tsx scripts/coaching-deviation-scan.ts

import { generateRulePlan } from '../lib/plan/ruleEngine'
import { GENERATION_CONFIG as G } from '../lib/plan/generationConfig'
import { CHARITY_PERSONAS, charityInput, CHARITY_PLAN_START } from '../lib/plan/charityCohort'
import { CANONICAL_CASES } from './generate-coaching-review'
import { isLongRun, classifyStimulus } from '../lib/plan/sessionRole'
import type { GeneratorInput, Plan, Session } from '../types/plan'

type Day = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

const DAYS: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const HARD = new Set(['quality', 'intervals', 'tempo', 'hard'])

export interface Dev { severity: 'HIGH' | 'MED' | 'LOW'; what: string; detail: string }

const mainWeeks = (p: Plan) => p.weeks.filter(w => w.n >= 1)
const dayIndex = (d: string) => DAYS.indexOf(d as Day)
const mins = (s: Session, easyPace = 6.5) =>
  s.duration_mins ?? (s.distance_km != null ? Math.round(s.distance_km * easyPace) : 0)

/**
 * The coach's eye, as a pure function. EXPORTED 2026-09-16 so a one-off review
 * can run the same checks instead of copying them — this file's own header says
 * a check here should be promoted to validatePlan or deleted, never duplicated,
 * and that applies to callers too.
 *
 * The run block below is guarded by `require.main === module`, so importing this
 * gives you `scan` WITHOUT executing the whole standalone scan. No behaviour
 * change when run directly: `npm run verify:coaching` output is byte-identical
 * before and after (checked).
 */
export function scan(input: GeneratorInput, plan: Plan): Dev[] {
  const out: Dev[] = []
  const weeks = mainWeeks(plan)
  const raceWeek = weeks[weeks.length - 1]

  // 1. RACE EVE — the RACE-WEEK-FITNESS-01 class. Nothing long the day before.
  if (raceWeek) {
    const raceEntry = Object.entries(raceWeek.sessions).find(([, s]) => s?.type === 'race')
    if (raceEntry) {
      const raceDayIdx = dayIndex(raceEntry[0])
      for (const [d, s] of Object.entries(raceWeek.sessions) as [string, Session | undefined][]) {
        if (!s || s.type === 'race' || s.type === 'rest') continue
        if (dayIndex(d) !== raceDayIdx - 1) continue
        const m = mins(s)
        if (m > 30) out.push({ severity: 'HIGH', what: 'race-eve session too long',
          detail: `${d} "${s.label}" ${m} min the day before the race` })
        if (HARD.has(s.type)) out.push({ severity: 'HIGH', what: 'hard session on race eve',
          detail: `${d} "${s.label}" (${s.type})` })
      }
    }
  }

  // 2. LONGEST RUN vs what the runner has actually done. Not an invariant — §45
  //    caps week-on-week growth, nothing caps the jump from their REAL history.
  const longest = Math.max(0, ...weeks.flatMap(w =>
    Object.values(w.sessions).filter((s): s is Session => !!s && isLongRun(s))
      .map(s => s.distance_km ?? 0)))
  const recent = input.longest_recent_run_km ?? 0
  if (recent > 0 && longest > recent * 3) {
    out.push({ severity: 'MED', what: 'peak long run far beyond proven distance',
      detail: `peak long run ${longest} km vs longest recent ${recent} km (${(longest / recent).toFixed(1)}x)` })
  }

  // 3. TWO HARD DAYS IN A ROW (§7). There IS an invariant for quality spacing,
  //    but it does not see a time trial (`type: 'hard'`) beside a quality day.
  for (const w of weeks) {
    const hardDays = DAYS.filter(d => { const s = w.sessions[d]; return s && HARD.has(s.type) })
    for (let i = 1; i < hardDays.length; i++) {
      if (dayIndex(hardDays[i]) - dayIndex(hardDays[i - 1]) === 1) {
        out.push({ severity: 'HIGH', what: '§7 two hard days back to back',
          detail: `wk${w.n} ${hardDays[i - 1]}+${hardDays[i]}` })
      }
    }
  }

  // 4. WEEKDAY TIME BUDGET — the runner told us how long they have.
  const cap = input.max_weekday_mins
  if (cap) {
    for (const w of weeks) {
      for (const d of ['mon', 'tue', 'wed', 'thu', 'fri'] as Day[]) {
        const s = w.sessions[d]
        if (!s || s.type === 'rest') continue
        const m = mins(s)
        if (m > cap + 5) out.push({ severity: 'MED', what: 'session overruns the stated weekday budget',
          detail: `wk${w.n} ${d} "${s.label}" ${m} min vs cap ${cap}` })
      }
    }
  }

  // 5. TAPER MUST REDUCE (§6).
  //
  // DENOMINATOR FIXED 2026-09-15 (TAPER-DEPTH-02). `peak` was the max over ALL
  // weeks INCLUDING RACE WEEK — and for an ultra the race week is the biggest
  // week in the plan by a distance (a 100K race week carries 100 km). So the
  // comparison was 0.9 x something enormous and this check was structurally
  // incapable of firing at 50K/100K, which is where the taper matters most.
  // Race and deload weeks are now excluded, matching how every §6 invariant
  // filters. The §6 Am.2 mechanical check is INV-PLAN-TAPER-DELIVERED-DEPTH;
  // this stays as the coach's-eye version at a rounder threshold.
  const taper = weeks.filter(w => w.phase === 'taper' && w.type !== 'race')
  const peak = Math.max(0, ...weeks
    .filter(w => w.type !== 'race' && w.type !== 'deload')
    .map(w => w.weekly_km ?? 0))
  for (const w of taper) {
    if ((w.weekly_km ?? 0) > peak * 0.9) out.push({ severity: 'MED', what: '§6 taper barely reduces',
      detail: `wk${w.n} ${w.weekly_km} km vs peak ${peak} km` })
  }

  // 6. A SESSION THE RUNNER CANNOT EXECUTE — no pace and no HR to run it by.
  for (const w of weeks) {
    for (const [d, s] of Object.entries(w.sessions) as [string, Session | undefined][]) {
      if (!s || s.type === 'rest' || s.type === 'race' || s.type === 'strength') continue
      if (!s.pace_target && !s.hr_target && !s.zone) {
        out.push({ severity: 'HIGH', what: 'session has no pace, HR or zone',
          detail: `wk${w.n} ${d} "${s.label}"` })
      }
    }
  }

  // 7. A STRUCTURAL BEGINNER MEETING Z4-5 FIRST — §8's spirit. The ordering is
  //    not asserted anywhere; §79 Amendment 3 fixed the declared-level route,
  //    this watches every other route to the same place.
  if (plan.meta.fitness_level === 'beginner') {
    outer: for (const w of weeks) {
      for (const d of DAYS) {
        const s = w.sessions[d]
        if (!s || !HARD.has(s.type)) continue
        if (s.type === 'hard') break outer            // the §78 time trial is a benchmark, not a session
        const z = String(s.zone ?? '')
        if (z.includes('4') || z.includes('5')) {
          out.push({ severity: 'HIGH', what: 'structural beginner meets Zone 4-5 first',
            detail: `wk${w.n} ${d} "${s.label}" ${z} RPE${s.rpe_target ?? '?'}` })
        }
        break outer
      }
    }
  }

  // 8. RACE WEEK CARRYING REAL TRAINING LOAD.
  if (raceWeek) {
    const load = Object.values(raceWeek.sessions)
      .filter((s): s is Session => !!s && s.type !== 'race' && s.type !== 'rest')
      .reduce((a, s) => a + mins(s), 0)
    if (load > 120) out.push({ severity: 'MED', what: 'race week carries heavy training load',
      detail: `${load} min of non-race work in race week` })
  }

  return out
}

// ── run ──────────────────────────────────────────────────────────────────────
if (require.main === module) {
console.log('COACHING DEVIATION SCAN — things a COACH catches that no invariant asserts')
console.log('(the packet says "0 error violations"; this asks the other question)\n')

let high = 0, med = 0, low = 0
// Arrow, not a declaration: function declarations are illegal inside a block
// under ES5 strict mode (TS1252), and the run block is now guarded.
const run = (label: string, input: GeneratorInput, tier: 'free' | 'trial' | 'paid'): void => {
  let plan: Plan
  try { plan = generateRulePlan(input, tier, CHARITY_PLAN_START, undefined, CHARITY_PLAN_START) }
  catch { console.log(`  ${label.padEnd(46)} refused by design`); return }
  const devs = scan(input, plan)
  high += devs.filter(d => d.severity === 'HIGH').length
  med += devs.filter(d => d.severity === 'MED').length
  low += devs.filter(d => d.severity === 'LOW').length
  console.log(`  ${devs.length === 0 ? '✅' : '⚠️ '} ${label.padEnd(46)}${devs.length === 0 ? 'clean' : `${devs.length} deviation(s)`}`)
  for (const d of devs) console.log(`        [${d.severity}] ${d.what} — ${d.detail}`)
}

console.log('── CHARITY COHORT ──')
for (const p of CHARITY_PERSONAS) {
  run(p.id.slice(0, 44), { ...charityInput(p), plan_start: CHARITY_PLAN_START } as GeneratorInput, 'paid')
}

console.log('\n── CANONICAL CASES ──')
for (const c of CANONICAL_CASES) {
  run(c.title.slice(0, 44), { ...c.input, plan_start: CHARITY_PLAN_START } as GeneratorInput, c.tier)
}

console.log(`\nHIGH ${high} · MED ${med} · LOW ${low}`)
console.log(high === 0
  ? '✅ No HIGH-severity coaching deviation on any test plan.'
  : '❌ HIGH-severity deviations present — these reach a runner.')
process.exit(high === 0 ? 0 : 1)
}
