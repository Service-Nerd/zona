/**
 * Coaching Board evidence, 2026-10-10 — two items, one corpus. READ-ONLY.
 *
 *  Q1 `LR-PEAK-NOT-LONGEST-01` — how often does the plan's longest run sit
 *     outside the peak phase, and is that cohort doctrine or defect?
 *  Q2 `ADR022-V1-DELIVERED-RISE-01` — is V1's §2 delivered-rise breach rate a
 *     NEW defect, or ADR-022's declared §52 long-run residual amplified?
 *
 * ⚠️ NODE_ENV=production — the corpus includes inputs the dev-only input
 * invariants throw on.
 */
import { generateRulePlan } from '../lib/plan/ruleEngine'
import { isLongRun, classifyStimulus } from '../lib/plan/sessionRole'
import { cohortGrid, COHORT_PLAN_START } from '../lib/plan/cohortGrid'
import { easyPaceFromPlan } from '../lib/plan/easyPace'
import { GENERATION_CONFIG as C } from '../lib/plan/generationConfig'
import type { GeneratorInput, Plan, Week } from '../types/plan'

const N = Number(process.argv[2] ?? 6000)
const STRIDE = 7919
const all = cohortGrid()
const sample: GeneratorInput[] = Array.from({ length: N }, (_, i) => all[(i * STRIDE) % all.length])

const lrMins = (w: Week): number => {
  let m = 0
  for (const s of Object.values(w.sessions ?? {})) if (s && isLongRun(s)) m = Math.max(m, s.duration_mins ?? 0)
  return m
}
const loading = (w: Week) => (w.n ?? 0) >= 1 && w.type !== 'race'

// ── Q1 ──────────────────────────────────────────────────────────────────────
interface Q1 { total: number; inv: number; byPhase: Record<string, number>; byGoalDist: Record<string, [number, number]> }
const q1: Q1 = { total: 0, inv: 0, byPhase: {}, byGoalDist: {} }
// Does the peak long run also carry §24b's race-pace segments? If a 5K/10K peak
// long run is RESTRUCTURED, a smaller peak maximum may be doctrine, not defect.

// ── Q2 ──────────────────────────────────────────────────────────────────────
interface Q2 { v1: number; v1Breach: number; v1BreachExLr: number; v1ExLrN: number; ctl: number; ctlBreach: number; ctlBreachExLr: number; ctlExLrN: number }
const q2: Q2 = { v1: 0, v1Breach: 0, v1BreachExLr: 0, v1ExLrN: 0, ctl: 0, ctlBreach: 0, ctlBreachExLr: 0, ctlExLrN: 0 }
const RISE = 1 + C.MAX_WEEKLY_VOLUME_INCREASE_PCT / 100

for (const input of sample) {
  let p: Plan
  try { p = generateRulePlan(input, 'paid', COHORT_PLAN_START) } catch { continue }
  const weeks = p.weeks.filter(loading)
  if (!weeks.length) continue

  // ── Q1
  const byPhase: Record<string, number> = {}
  let max = 0, maxPhase = ''
  for (const w of weeks) {
    const phase = w.phase; if (!phase) continue
    const m = lrMins(w)
    byPhase[phase] = Math.max(byPhase[phase] ?? 0, m)
    if (m > max) { max = m; maxPhase = phase }
  }
  const peak = byPhase['peak'] ?? 0
  if (peak > 0) {
    q1.total++
    // 🔴 THE §24b DETECTOR WAS REMOVED, NOT FIXED, AND THAT IS THE HONEST
    // OUTCOME. Two attempts both returned 100.0% of peak long runs: the first
    // matched `JSON.stringify(s).includes('pace_target')`, which hits the FIELD
    // NAME; the second required a non-empty `pace_target` string — and EVERY
    // session carries one ("6:30-7:00 /km"), so it is still a detector that
    // cannot say no. §24b's real marker is a pace SEGMENT inside the main-set
    // structure, which is not reachable from this shape without re-deriving
    // `resolveMainSet`. A number that cannot return false is not evidence and
    // must not reach a board; §24b's own text is the authority instead.
    if (max > peak + 1) {
      q1.inv++
      q1.byPhase[maxPhase] = (q1.byPhase[maxPhase] ?? 0) + 1
      const k = `${input.goal}/${input.race_distance_km}`
      const cur = q1.byGoalDist[k] ?? [0, 0]
      q1.byGoalDist[k] = [cur[0] + 1, cur[1]]
    }
    const k = `${input.goal}/${input.race_distance_km}`
    const cur = q1.byGoalDist[k] ?? [0, 0]
    q1.byGoalDist[k] = [cur[0], cur[1] + 1]
  }

  // ── Q2: is this a V1 plan? V1's trigger is the first week carrying quality
  // (or the first carrying VO2max) — index > 0, i.e. not week 1.
  const idxQuality = weeks.findIndex(w => Object.values(w.sessions ?? {}).some(s => s?.type === 'quality'))
  const idxVo2 = weeks.findIndex(w => Object.values(w.sessions ?? {}).some(s =>
    s?.type === 'quality' && classifyStimulus(s) === 'vo2max'))
  const isV1 = idxQuality > 0 || idxVo2 > 0

  // §2's DELIVERED week-on-week rise, loading weeks only (a deload is meant to fall).
  const easyPace = easyPaceFromPlan(p)
  let breach = false, breachExLr = false, exLrMeasurable = false
  for (let i = 1; i < weeks.length; i++) {
    const prev = weeks[i - 1], curr = weeks[i]
    if (curr.type === 'deload' || prev.type === 'deload') continue
    const pk = prev.weekly_km ?? 0, ck = curr.weekly_km ?? 0
    if (pk <= 0) continue
    if (ck > pk * RISE + 0.01) breach = true
    // The same comparison with the §52-protected long run REMOVED from both
    // sides — ADR-022's declared residual is precisely that the long run
    // inflates the whole-week delivered rise.
    // ⚠️ THE PACE COMES FROM `easyPaceFromPlan`, THE OWNER, AND A NULL DECLINES.
    // The first version read a non-existent `p.meta.pace_guide.minPerKmEasy` and
    // fell back to a hardcoded 6 min/km for every plan — the identical defect I
    // recorded in another board-evidence script earlier the same day. A `?? 6`
    // does not fail, it fabricates.
    if (easyPace !== null && easyPace > 0) {
      const pkEx = pk - lrMins(prev) / easyPace
      const ckEx = ck - lrMins(curr) / easyPace
      if (pkEx > 0 && ckEx > pkEx * RISE + 0.01) breachExLr = true
      exLrMeasurable = true
    }
  }
  if (isV1) { q2.v1++; if (breach) q2.v1Breach++; if (exLrMeasurable) { q2.v1ExLrN++; if (breachExLr) q2.v1BreachExLr++ } }
  else      { q2.ctl++; if (breach) q2.ctlBreach++; if (exLrMeasurable) { q2.ctlExLrN++; if (breachExLr) q2.ctlBreachExLr++ } }
}

const pct = (a: number, b: number) => b ? `${(a / b * 100).toFixed(1)}%` : 'n/a'

console.log(`\n═══ Q1 · LR-PEAK-NOT-LONGEST-01 ═══  sample ${N}, with a peak long run ${q1.total}`)
console.log(`  plan's longest run OUTSIDE the peak phase: ${q1.inv} (${pct(q1.inv, q1.total)})`)
console.log(`  where it sits: ${JSON.stringify(q1.byPhase)}`)
console.log('  ⚠️ §24b pace-segment share NOT measured — both detectors returned 100% (see the note in this file)')
console.log('  by goal/distance  (inverted / cohort):')
for (const k of Object.keys(q1.byGoalDist).sort()) {
  const [i, t] = q1.byGoalDist[k]
  console.log(`    ${k.padEnd(22)} ${String(i).padStart(4)} / ${String(t).padStart(4)}  ${pct(i, t)}`)
}

console.log(`\n═══ Q2 · ADR022-V1-DELIVERED-RISE-01 ═══  §2 ceiling ${C.MAX_WEEKLY_VOLUME_INCREASE_PCT}%`)
console.log(`  V1 plans     ${q2.v1}: breach ${q2.v1Breach} (${pct(q2.v1Breach, q2.v1)})   · long run EXCLUDED: ${q2.v1BreachExLr}/${q2.v1ExLrN} (${pct(q2.v1BreachExLr, q2.v1ExLrN)})`)
console.log(`  non-V1 ctrl  ${q2.ctl}: breach ${q2.ctlBreach} (${pct(q2.ctlBreach, q2.ctl)})   · long run EXCLUDED: ${q2.ctlBreachExLr}/${q2.ctlExLrN} (${pct(q2.ctlBreachExLr, q2.ctlExLrN)})`)
console.log(`  ⚠️ a plan with no resolvable easy pace is EXCLUDED from the right-hand column, never counted as clean`)
