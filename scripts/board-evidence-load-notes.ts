/**
 * EVIDENCE for the Coaching Board, 2026-10-09 sitting. READ-ONLY, generates only.
 *
 * Three questions, one grid, so the cohorts are comparable:
 *   Q1  LR-TAPER-BUMP-01       — V4 bumps a long run in the TAPER. How often, and
 *                                what does restricting it to base/build/peak cost?
 *   Q2  FINISH-WORDING-FLOOR-01 — the "gets you round" note has no magnitude floor.
 *                                What is the distribution of the shortfall it fires on?
 *   Q3  V1-LOAD-STEP-SHAPE-01  — when V1 blocks a volume step, what curve results?
 *
 * ⚠️ NODE_ENV=production. Some real inputs are self-contradictory (longest > weekly),
 * which INV-INPUT-LONGEST-LE-WEEKLY throws on in dev/test and only logs in production.
 * Under NODE_ENV=test the constrained cohort refuses and every answer reads zero.
 */
import { generateRulePlan } from '../lib/plan/ruleEngine'
import { isLongRun } from '../lib/plan/sessionRole'
import { GENERATION_CONFIG as C } from '../lib/plan/generationConfig'
import { easyPaceFromPlan } from '../lib/plan/easyPace'

// ⚠️ `plan.meta` CARRIES NO PACE GUIDE. My first cut read
// `plan.meta.pace_guide.minPerKmEasy`, got `undefined`, and every minutes figure
// silently became 0 — which printed as `-Infinity%` for the Q2 shortfall and went
// unnoticed in earlier scans because the beginner cohort is 95.8%
// duration-anchored, so `duration_mins` answered without ever needing a pace.
// `easyPaceFromPlan` is the repo's own owner for "what easy pace is this plan on".

const CONSTRAINED: any = { age: 34, goal: 'finish', terrain: 'road',
  benchmark: { time: '2:20:00', type: 'race', distance_km: 21.1 },
  race_date: '2027-04-25', race_name: 'R', training_age: '<6mo', days_available: 3,
  injury_history: ['plantar fasciitis'], max_weekday_mins: 45, race_distance_km: 42.2,
  current_weekly_km: 10, days_cannot_train: ['tuesday','wednesday','friday','saturday'],
  user_declared_level: 'beginner', longest_recent_run_km: 20, preferred_long_run_day: 'sun',
  recent_quality_training: 'none', hard_session_relationship: 'neutral' }
const PS = '2026-12-07'

const mins = (s: any, mpk: number) => s.duration_mins ?? ((s.distance_km ?? 0) * mpk)
const paceOf = (plan: any): number => easyPaceFromPlan(plan) ?? 0

type Row = { plan: any; input: any }
const rows: Row[] = []
for (const dist of [10, 21.1, 42.2])
 for (const cwk of [10, 15, 20, 30, 45, 60])
  for (const lrr of [6, 10, 16, 24])
   for (const days of [3, 4, 5])
    for (const mwm of [30, 45, 60, undefined])
     for (const goal of ['finish', 'time_target'])
      for (const ta of ['<6mo', '1-2yr', '5yr+']) {
  const input: any = { ...CONSTRAINED, race_distance_km: dist, current_weekly_km: cwk,
    longest_recent_run_km: lrr, days_available: days, max_weekday_mins: mwm, training_age: ta,
    goal, days_cannot_train: days === 3 ? ['tuesday','wednesday','friday','saturday'] : [] }
  if (goal === 'time_target') input.target_time = dist >= 42 ? '4:30:00' : dist >= 21 ? '2:00:00' : '0:55:00'
  else delete input.target_time
  try { rows.push({ plan: generateRulePlan(input, 'paid', PS), input }) } catch { /* refused by design */ }
}
console.log(`GRID: ${rows.length} plans generated\n`)

// ── Q1 ───────────────────────────────────────────────────────────────────────
console.log('── Q1  LR-TAPER-BUMP-01 ──────────────────────────────────────────')
let v4 = 0; const phases: Record<string, number> = {}
let taperPlans = 0, lrOutsidePeak = 0, kmOutsidePeak = 0, taperIsPlanMax = 0
for (const { plan } of rows) {
  const a = (plan.meta?.rule_adjustments ?? []).find((x: any) => x.rule === 'V4-long-run-repeat-ceiling')
  const mpk = paceOf(plan)
  const byN = new Map<number, any>(plan.weeks.map((w: any) => [w.n, w]))
  if (a) {
    v4++
    let hitTaper = false
    for (const n of a.weeks_affected ?? []) {
      const ph = byN.get(n)?.phase ?? '?'
      phases[ph] = (phases[ph] ?? 0) + 1
      if (ph === 'taper') hitTaper = true
    }
    if (hitTaper) taperPlans++
  }
  let peakLr = 0, planLr = 0, planLrPhase = '', peakKm = 0, planKm = 0
  for (const w of plan.weeks) {
    if (w.n <= 0) continue
    planKm = Math.max(planKm, w.weekly_km ?? 0)
    if (w.phase === 'peak' && w.type !== 'deload') peakKm = Math.max(peakKm, w.weekly_km ?? 0)
    for (const s of Object.values(w.sessions ?? {}) as any[]) {
      if (!s || s.type !== 'easy' || !isLongRun(s)) continue
      const m = mins(s, mpk)
      if (m > planLr) { planLr = m; planLrPhase = w.phase }
      if (w.phase === 'peak' && w.type !== 'deload') peakLr = Math.max(peakLr, m)
    }
  }
  if (planLr > peakLr + 0.5) lrOutsidePeak++
  if (planKm > peakKm + 0.05) kmOutsidePeak++
  if (planLrPhase === 'taper') taperIsPlanMax++
}
const pc = (n: number) => `${n} (${(100 * n / rows.length).toFixed(1)}%)`
console.log(`V4 fired:                              ${pc(v4)}`)
console.log(`  bumped a TAPER week:                 ${pc(taperPlans)}`)
console.log(`  phases V4 touched:                   ${JSON.stringify(phases)}`)
console.log(`plan's LONGEST RUN outside peak phase: ${pc(lrOutsidePeak)}`)
console.log(`plan's PEAK WEEKLY outside peak phase: ${pc(kmOutsidePeak)}`)
console.log(`plan's longest run IS IN THE TAPER:    ${pc(taperIsPlanMax)}`)
console.log(`config says: LR_MAX_CONSECUTIVE_REPEATS=${C.LR_MAX_CONSECUTIVE_REPEATS}, increment=${C.LR_REPEAT_INCREMENT_KM}km`)

// ── Q2 ───────────────────────────────────────────────────────────────────────
console.log('\n── Q2  FINISH-WORDING-FLOOR-01 ───────────────────────────────────')
const gaps: number[] = []
let fired = 0, noPace = 0
for (const { plan } of rows) {
  const note = plan.meta?.long_run_shortfall_note as string | undefined
  if (!note) continue
  fired++
  const mpk = paceOf(plan)
  if (!(mpk > 0)) { noPace++; continue }
  const projected = plan.meta.race_distance_km * mpk
  const floor = projected * C.FINISH_GOAL_PEAK_LR_RATIO_VS_RACE_DURATION
  let peakLr = 0
  for (const w of plan.weeks) {
    if (w.phase !== 'peak' || w.type === 'deload') continue
    for (const s of Object.values(w.sessions ?? {}) as any[])
      if (s && s.type === 'easy' && isLongRun(s)) peakLr = Math.max(peakLr, mins(s, mpk))
  }
  if (peakLr > 0) gaps.push(100 * (floor - peakLr) / floor)
}
gaps.sort((a, b) => a - b)
const q = (p: number) => gaps.length ? gaps[Math.floor(p * (gaps.length - 1))].toFixed(1) + '%' : 'n/a'
console.log(`note fired on:                         ${pc(fired)}`)
console.log(`  of which no derivable easy pace:     ${noPace}  (excluded — a 0 pace is what produced -Infinity in the first cut)`)
console.log(`shortfall vs the §80 floor — p10 ${q(0.1)}  median ${q(0.5)}  p90 ${q(0.9)}  max ${gaps.length ? gaps[gaps.length-1].toFixed(1)+'%' : 'n/a'}`)
for (const floorPct of [5, 10, 15, 20]) {
  const silenced = gaps.filter(g => g < floorPct).length
  console.log(`  a ${String(floorPct).padStart(2)}% materiality floor would SILENCE ${silenced} of ${gaps.length} (${gaps.length ? (100*silenced/gaps.length).toFixed(1) : 0}%)`)
}
console.log(`(§80 Am.1 already uses LONG_RUN_SHORTFALL_MATERIAL_PCT=${C.LONG_RUN_SHORTFALL_MATERIAL_PCT} on the SAME note's cap arm)`)

// ── Q3 ───────────────────────────────────────────────────────────────────────
console.log('\n── Q3  V1-LOAD-STEP-SHAPE-01 ─────────────────────────────────────')
let v1 = 0, reanchor = 0
const stepAfterHold: number[] = []
const dipThenJump: string[] = []
for (const { plan } of rows) {
  const adjs = (plan.meta?.rule_adjustments ?? [])
  const a = adjs.find((x: any) => x.rule === 'V1-volume-quality-split')
  if (adjs.find((x: any) => x.rule === 'V1-volume-quality-split-reanchor')) reanchor++
  if (!a) continue
  v1++
  const weeks = plan.weeks.filter((w: any) => w.n > 0)
  for (const n of a.weeks_affected ?? []) {
    const i = weeks.findIndex((w: any) => w.n === n)
    if (i < 1 || i + 1 >= weeks.length) continue
    const prev = weeks[i - 1].weekly_km ?? 0, held = weeks[i].weekly_km ?? 0, next = weeks[i + 1].weekly_km ?? 0
    if (held > 0) stepAfterHold.push(100 * (next - held) / held)
    if (held < prev && next > prev && dipThenJump.length < 5)
      dipThenJump.push(`w${weeks[i-1].n}→${n}→w${weeks[i+1].n}: ${Math.round(prev)}→${Math.round(held)}→${Math.round(next)}km`)
  }
}
stepAfterHold.sort((a, b) => a - b)
const sq = (p: number) => stepAfterHold.length ? stepAfterHold[Math.floor(p * (stepAfterHold.length - 1))].toFixed(1) + '%' : 'n/a'
console.log(`V1-volume-quality-split fired:         ${pc(v1)}`)
console.log(`V1-...-reanchor ALSO fired:            ${pc(reanchor)}  ← this rule exists to stop the dip-then-jump`)
console.log(`the step AFTER the held week — median ${sq(0.5)}  p90 ${sq(0.9)}  max ${stepAfterHold.length ? stepAfterHold[stepAfterHold.length-1].toFixed(1)+'%' : 'n/a'}`)
console.log(`  over §2's weekly-increase ceiling (${C.MAX_WEEKLY_VOLUME_INCREASE_PCT}%): ${stepAfterHold.filter(s => s > C.MAX_WEEKLY_VOLUME_INCREASE_PCT).length} of ${stepAfterHold.length}`)
console.log('dip-then-jump examples (prev → HELD → next):')
dipThenJump.forEach(x => console.log('   ' + x))
