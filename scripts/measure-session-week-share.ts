// SESSION-WEEK-SHARE-01 — what share of a week does ONE session carry?
//
//   npx tsx scripts/measure-session-week-share.ts [--stride N]
//
// THE BOARD ASKED FOR THIS AND DID NOT HAVE IT. Willy named the gap at the
// `SESSION-ACHIEVABLE-01` sitting (2026-10-06, item c): an 86-minute threshold
// session for a runner on 20 km/week is "approaching half their weekly volume
// in one session", and **no check anywhere looks at a single session as a share
// of the week.** §2 and §12 are measured WEEKLY and are green throughout, so
// the quantity in his objection has never been counted.
//
// ⚠️ TWO DENOMINATORS, AND THEY DISAGREE — both are reported, because picking
// one silently is how a claim fails (`feedback_the_denominator_is_where_claims_fail`):
//   · share of DELIVERED week — the session's km over the week's placed total.
//     This is what the runner experiences.
//   · share EXCLUDING the long run — §52 already governs the long run's share
//     and deliberately never trims it, so a long-run-inclusive denominator
//     answers a question §52 has already ruled on.
// A long run is EXCLUDED from the numerator population for the same reason:
// §52 owns it, at a ratified ceiling. What is unowned is a QUALITY or EASY
// midweek session taking a share nobody bounded.
//
// ⚠️ THE CLOCK IS PINNED — `generateRulePlan(input, tier, COHORT_PLAN_START)`.
// The first cut of this script omitted the third argument and every one of 783
// inputs came back "refused": -13 weeks isn't enough to build a 5K safely,
// because the grid's plan_start is in the past and "today" defaulted to now.
// It printed `plans 0 · refused 783` and a table of NaN, which is the only
// reason I caught it. A harness that silently measures an empty population is
// the recorded failure class (`feedback_an_empty_population_must_not_render`),
// so the assertion below refuses to report on zero plans.
//
// Duration-anchored sessions are the cohort that matters here (beginners are
// 95.8% duration-anchored), so km come from the `sessionKm` owner with the
// plan's own pace guide — never `distance_km ?? 0`, which asserts a session
// covered no ground (SESSION-KM-01).

import { generateRulePlan } from '../lib/plan/ruleEngine'
import { cohortGrid, COHORT_PLAN_START } from '../lib/plan/cohortGrid'
import { sessionKm } from '../lib/plan/sessionDistance'
import { isLongRun } from '../lib/plan/sessionRole'
import { isDesignedRefusal } from '../lib/plan/designedRefusal'

const strideArg = process.argv.indexOf('--stride')
const STRIDE = strideArg > -1 ? Number(process.argv[strideArg + 1]) : 53

type Row = {
  shareDelivered: number
  shareExLong: number
  km: number
  weekKm: number
  type: string
  label: string
  level: string
  weeklyKm: number
  cap: number | null
  distance: number
}

const rows: Row[] = []
let plans = 0, refused = 0, threw = 0, races = 0

const grid = cohortGrid()
for (let i = 0; i < grid.length; i += STRIDE) {
  const input = grid[i]
  let plan: any
  try { plan = generateRulePlan(input as any, 'paid', COHORT_PLAN_START) } catch (e) {
    if (isDesignedRefusal(e)) { refused++; continue }
    threw++; continue
  }
  if (!plan?.weeks?.length) { refused++; continue }
  plans++
  const guide = plan.pace_guide ?? plan.meta?.pace_guide
  for (const wk of plan.weeks) {
    if ((wk.n ?? 1) <= 0) continue              // foundation / plan-level, not a main week
    const sessions = Object.values(wk.sessions ?? {}).filter(Boolean) as any[]
    const kms = sessions.map(s => sessionKm(s, guide) ?? 0)
    const weekKm = kms.reduce((a, b) => a + b, 0)
    if (weekKm <= 0) continue
    const longKm = sessions.reduce((a, s, j) => a + (isLongRun(s) ? kms[j] : 0), 0)
    const exLong = weekKm - longKm
    sessions.forEach((s, j) => {
      if (isLongRun(s)) return                  // §52 owns it
      // 🔴 THE RACE IS EXCLUDED, AND THE FIRST RUN OF THIS SCRIPT PROVED WHY.
      // Without it the top of the distribution was 90.4% / 85.8% / 84.1% — every
      // one a 42.2 km RACE in a 46–50 km week for a 20 km/week runner. That is
      // the race being the point, not a session mis-sized, and it would have been
      // carried to the board as the worst case. A time trial is excluded on the
      // same ground (§78 ratifies that its parts differ in KIND by design).
      if (s.type === 'rest' || s.type === 'strength' || s.type === 'cross') return
      if (s.type === 'race' || /race|time trial|\bTT\b/i.test(String(s.label ?? ''))) { races++; return }
      const km = kms[j]
      if (km <= 0) return
      rows.push({
        shareDelivered: km / weekKm,
        shareExLong: exLong > 0 ? km / exLong : 0,
        km, weekKm, type: s.type, label: s.label ?? s.session_type ?? '?',
        level: String(input.fitness_level), weeklyKm: Number(input.current_weekly_km),
        cap: input.max_weekday_mins ?? null, distance: Number(input.race_distance_km),
      })
    })
  }
}

if (plans === 0 || rows.length === 0) {
  console.error(`\nREFUSING TO REPORT: plans ${plans}, sessions ${rows.length}. ` +
    `An empty population answers nothing — check the pinned clock and the plan shape.`)
  process.exit(2)
}

const pct = (x: number) => (x * 100).toFixed(1)
const q = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]
}
const share = rows.map(r => r.shareDelivered)
const shareEx = rows.map(r => r.shareExLong)

console.log(`\nSESSION-WEEK-SHARE-01 — stride ${STRIDE}`)
console.log(`plans ${plans} · refused ${refused} · threw ${threw} · non-long non-race sessions ${rows.length} · races/TTs excluded ${races}\n`)
for (const [name, xs] of [['share of DELIVERED week', share], ['share EXCLUDING long run', shareEx]] as const) {
  console.log(`${name}: median ${pct(q(xs, 0.5))}% · p90 ${pct(q(xs, 0.9))}% · p99 ${pct(q(xs, 0.99))}% · max ${pct(Math.max(...xs))}%`)
  for (const t of [0.25, 0.3, 0.4, 0.5]) {
    const n = xs.filter(x => x > t).length
    console.log(`   > ${t * 100}% of the week: ${n} (${pct(n / xs.length)}% of sessions)`)
  }
  console.log()
}
// Willy's actual case: a time-capped runner on low volume.
const willy = rows.filter(r => r.weeklyKm <= 25 && r.cap !== null && r.cap <= 30)
console.log(`WILLY'S COHORT (weekly <= 25 km AND a stated cap <= 30 min): ${willy.length} sessions`)
if (willy.length) {
  const w = willy.map(r => r.shareDelivered)
  console.log(`   median ${pct(q(w, 0.5))}% · p90 ${pct(q(w, 0.9))}% · max ${pct(Math.max(...w))}%`)
  console.log(`   > 40% of the week: ${w.filter(x => x > 0.4).length}`)
  const worst = [...willy].sort((a, b) => b.shareDelivered - a.shareDelivered).slice(0, 5)
  for (const r of worst) console.log(`   ${pct(r.shareDelivered)}%  ${r.km.toFixed(1)}km of ${r.weekKm.toFixed(1)}km  ${r.label} (${r.level}, ${r.weeklyKm}km/wk, cap ${r.cap})`)
}
