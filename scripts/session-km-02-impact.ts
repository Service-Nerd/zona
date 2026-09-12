// SESSION-KM-02 — what do the two remaining `?? 0` sites actually COST a runner?
//
//   npx tsx scripts/session-km-02-impact.ts
//
// WHY THIS SCRIPT EXISTS, AND WHY THE LAST ONE DID NOT COUNT. A first attempt
// at this measurement reported no movement — and also reported 0% long-run
// step-backs for NON-beginners, which cannot be right. The detector was wrong,
// not the finding, and a wrong detector that prints a clean table is worse than
// no detector (see `feedback: measurement scripts are checks too`). So this one
// carries a cross-check it must pass before any number it prints is worth
// reading, printed at the top, every run:
//
//   SELF-CHECK — on sessions the invariant CAN see (`distance_km != null`), this
//   script must find ZERO §52 breaches, because the sweep reports
//   INV-PLAN-LR-MAX-WEEKLY-PCT clean over 16,038 plans. If it finds any, MY
//   ARITHMETIC IS WRONG and every other number below is void.
//
// THE TWO SITES, both in `ruleEngine.ts`, both reading a duration-anchored
// session's distance as 0:
//
//   §47 `applyPeakLongRunAlternation` — `peakMaxLrKm <= 0 → return`, so a
//        beginner never gets a peak long-run step-back week.
//   §52 `lrKm = lr?.session.distance_km ?? 0` → `weeklyFloorFromLR = 0`, so the
//        floor protecting the 60% lopsidedness cap is inert.
//
// ⚠️ WHAT THIS MEASUREMENT ACTUALLY FOUND, 2026-09-12 — READ BEFORE RE-FILING.
// The filed fix (use `sessionKmOrZero` at both sites) is a PROVABLE NO-OP.
// Applied on a scratch basis it produced ZERO differences across two
// independent grids: `verify:parity` 2,916 cases byte-identical, and all 648
// cohort plans identical on their peak long runs and weekly volumes. The reason
// is a THIRD gate nobody had filed, inside the mutation itself:
//
//   ruleEngine.ts ~3609:  if (!lr || lr.session.distance_km == null) continue
//   ruleEngine.ts ~3637:  if (s.distance_km == null) continue   (the §9 easy clamp)
//
// So reaching the alternation is not the same as the alternation DOING
// anything. §47 is gated on `distance_km` in at least three places on one path,
// and the mutation WRITES `distance_km` — meaning a real fix has to decide
// whether a beginner's step-back is expressed in kilometres (turning one week
// of an otherwise duration-anchored plan into "14 km" where every other week
// says "90 minutes") or in minutes. That is a coaching and product decision,
// not a mechanical one, and it is the actual question for the Coaching Board.
//
// The `zero-lr` and counterfactual numbers below therefore describe WHICH GATE
// each plan dies at today. They do NOT predict post-fix behaviour — this script
// classifies a FINISHED plan, and a step-back on a duration-anchored long run
// would move `duration_mins`, which this cannot see. Do not read the
// counterfactual as "99 plans would change"; read it as "99 plans are stopped
// by this gate FIRST, and would then meet the next one".
//
// AND A THIRD DEFECT, FOUND WHILE BUILDING THIS — not previously catalogued.
// `INV-PLAN-LR-MAX-WEEKLY-PCT` (invariants.ts, §52's own checker) opens its
// per-session loop with `if (s.distance_km == null) continue`. So the invariant
// that would catch the lopsidedness the inert floor allows **skips the exact
// sessions the floor fails to protect**. The producer and its checker are blind
// to the same cohort for the same reason, which is why this has never shown up
// as a violation.
import { runCohort } from './cohort-shape'
import { sessionKmSelfPaced } from '../lib/plan/sessionDistance'
import { isLongRun } from '../lib/plan/sessionRole'
import { GENERATION_CONFIG } from '../lib/plan/generationConfig'
import type { Plan, Week, Session } from '../types/plan'

const CAP = GENERATION_CONFIG.LONG_RUN_MAX_PCT_OF_WEEKLY / 100
const pct = (n: number, d: number) => (d > 0 ? +((n / d) * 100).toFixed(1) : 0)

/** Mirrors INV-PLAN-LR-MAX-WEEKLY-PCT's own exemptions, deliberately verbatim. */
function weekIsInScope(plan: Plan, w: Week): boolean {
  if (plan.meta.volume_profile === 'maintenance') return false
  if (w.type === 'race' || w.type === 'deload') return false
  if (w.weekly_km <= 0) return false
  if (w.phase === 'foundation') {
    const runCount = Object.values(w.sessions ?? {}).filter(
      (x: any) => x && x.type !== 'rest' && x.type !== 'cross-train',
    ).length
    if (runCount < 3) return false
  }
  return true
}

const cases = runCohort()
const generated = cases.filter(c => c.plan)
const refused = cases.filter(c => c.refused).length
const failed = cases.length - generated.length - refused

// ── §52: lopsidedness the checker cannot see ────────────────────────────────
let visibleChecked = 0, visibleBreaches = 0      // the SELF-CHECK arm
let hiddenChecked = 0, hiddenBreaches = 0        // duration-anchored: invisible
const hiddenBreachByLevel: Record<string, { weeks: number; breaches: number }> = {}
const worst: { level: string; frac: number; km: number; weekly: number; label: string }[] = []

for (const c of generated) {
  const plan = c.plan as Plan
  const level = String((c.input as any).fitness_level ?? 'unknown')
  hiddenBreachByLevel[level] ??= { weeks: 0, breaches: 0 }
  for (const w of plan.weeks) {
    if (!weekIsInScope(plan, w)) continue
    for (const s of Object.values(w.sessions ?? {}) as (Session | undefined)[]) {
      if (!s) continue
      if (s.type === 'strength' || s.type === 'rest') continue
      const visible = s.distance_km != null
      const km = visible ? (s.distance_km as number) : sessionKmSelfPaced(s)
      if (km == null) continue // no pace to convert with — never counted as 0
      const frac = km / w.weekly_km
      const breach = frac > CAP + 0.005
      if (visible) {
        visibleChecked++
        if (breach) visibleBreaches++
      } else {
        hiddenChecked++
        hiddenBreachByLevel[level].weeks++
        if (breach) {
          hiddenBreaches++
          hiddenBreachByLevel[level].breaches++
          worst.push({ level, frac, km, weekly: w.weekly_km, label: s.label ?? '(unlabelled)' })
        }
      }
    }
  }
}

// ── §47: which gate does each plan actually die at? ─────────────────────────
const labelHasRacePace = (label: string): boolean => {
  const l = label.toLowerCase()
  return l.includes('pace') || l.includes(' mp') || l.startsWith('mp') || l.includes('hm-pace')
}
const longRunOf = (w: Week): Session | null => {
  for (const s of Object.values(w.sessions ?? {}) as (Session | undefined)[]) {
    if (s && isLongRun(s)) return s
  }
  return null
}

const exits: Record<string, number> = {}
const counterfactual: Record<string, number> = {}
for (const c of generated) {
  const plan = c.plan as Plan
  const peaks = plan.weeks.filter(w => w.phase === 'peak' && w.type !== 'deload')
  if (peaks.length < 2) { exits['single-peak-week'] = (exits['single-peak-week'] ?? 0) + 1; continue }
  const lrs = peaks.map(longRunOf)
  const maxToday = Math.max(0, ...lrs.map(s => s?.distance_km ?? 0))
  const maxFixed = Math.max(0, ...lrs.map(s => sessionKmSelfPaced(s) ?? 0))
  const anyRacePace = lrs.some(s => (s ? labelHasRacePace(s.label ?? '') : false))
  if (maxToday <= 0) {
    exits['zero-lr (THE DEFECT)'] = (exits['zero-lr (THE DEFECT)'] ?? 0) + 1
    const key = maxFixed <= 0 ? 'still no long run — no change'
      : !anyRacePace ? 'blocked by !anyPeakIsRacePace anyway — NO CHANGE'
      : 'would reach the alternation — REAL CHANGE'
    counterfactual[key] = (counterfactual[key] ?? 0) + 1
    continue
  }
  if (!anyRacePace) { exits['not-race-pace'] = (exits['not-race-pace'] ?? 0) + 1; continue }
  exits['reaches alternation'] = (exits['reaches alternation'] ?? 0) + 1
}

// ── report ──────────────────────────────────────────────────────────────────
console.log('\nSESSION-KM-02 — impact of the two remaining `?? 0` sites\n')
console.log(`Inputs attempted : ${cases.length}`)
console.log(`Plans generated  : ${generated.length}   refused: ${refused}   failed: ${failed}`)

console.log(`\n── SELF-CHECK ─────────────────────────────────────────────`)
console.log(`§52 breaches among sessions the invariant CAN see: ${visibleBreaches} / ${visibleChecked}`)
if (visibleBreaches === 0) {
  console.log(`✓ agrees with the sweep (INV-PLAN-LR-MAX-WEEKLY-PCT clean). Numbers below are readable.`)
} else {
  console.log(`✗ DISAGREES WITH THE SWEEP. My arithmetic is wrong; every number below is VOID.`)
}

console.log(`\n── §52: lopsidedness nothing can see ──────────────────────`)
console.log(`Duration-anchored sessions in scope : ${hiddenChecked}`)
console.log(`Of those, over the ${GENERATION_CONFIG.LONG_RUN_MAX_PCT_OF_WEEKLY}% cap : ${hiddenBreaches}  (${pct(hiddenBreaches, hiddenChecked)}%)`)
for (const [lvl, v] of Object.entries(hiddenBreachByLevel).sort()) {
  if (v.weeks === 0) continue
  console.log(`   ${lvl.padEnd(14)} ${String(v.breaches).padStart(5)} / ${String(v.weeks).padStart(5)}  (${pct(v.breaches, v.weeks)}%)`)
}
worst.sort((a, b) => b.frac - a.frac)
if (worst.length) {
  console.log(`\n   Worst five:`)
  for (const w of worst.slice(0, 5)) {
    console.log(`   ${Math.round(w.frac * 100)}% of week — ${w.km.toFixed(1)}km of ${w.weekly}km  [${w.level}] ${w.label}`)
  }
}

console.log(`\n── §47: which gate does each plan exit at, today ──────────`)
for (const [k, v] of Object.entries(exits).sort((a, b) => b[1] - a[1])) {
  console.log(`   ${k.padEnd(36)} ${String(v).padStart(4)}  (${pct(v, generated.length)}%)`)
}
if (Object.keys(counterfactual).length) {
  console.log(`\n   Of the 'zero-lr' plans, what a FIXED site would do:`)
  for (const [k, v] of Object.entries(counterfactual).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${k.padEnd(46)} ${String(v).padStart(4)}`)
  }
}
console.log()
