/**
 * `WEEKDAY-OVERRUN-BOUND-01` — Coaching Board readiness evidence, 2026-11-20. READ-ONLY (plans built in memory).
 *
 * Re-derives the population the item states (2026-10-06, cohortGrid stride 53): 499 capped plans · 246 with a
 * structured weekday session over the stated cap · 182 past the 50% tolerance · 675 such sessions · every one
 * at a 30-minute cap · worst 86 min vs 30 (+187%). Same sweep as `lib/plan/weekdayOverrunDeclared.test.ts`.
 *
 * It does NOT measure what a bound COSTS — that needs the selector to choose under a bound, i.e. engine code.
 *
 * Run: npx tsx scripts/board-evidence-weekday-overrun-bound-01.ts
 */
import { generateRulePlan } from '../lib/plan/ruleEngine'
import { cohortGrid, COHORT_PLAN_START } from '../lib/plan/cohortGrid'
import { GENERATION_CONFIG } from '../lib/plan/generationConfig'
import { isLongRun, isStructuredSession } from '../lib/plan/sessionRole'
import type { GeneratorInput, Session } from '../types/plan'

const TOL = GENERATION_CONFIG.LONG_RUN_WEEKDAY_OVERRUN_MAINTENANCE_PCT
const grid = cohortGrid() as GeneratorInput[]
let plans = 0, plansOver = 0, plansPast = 0, over = 0, past = 0
const caps: Record<string, number> = {}
const labels: Record<string, number> = {}
let worst = { mins: 0, cap: 0, label: '' }
for (let i = 0; i < grid.length; i += 53) {
  const g = grid[i]!
  const cap = Number((g as any).max_weekday_mins ?? 0)
  if (!cap) continue
  let p: any
  try { p = generateRulePlan(g, 'paid', COHORT_PLAN_START, undefined, COHORT_PLAN_START) } catch { continue }
  plans++
  let o = false, t = false
  for (const w of p.weeks) {
    if (w.type === 'race') continue
    for (const [d, sn] of Object.entries(w.sessions)) {
      if (!sn || d === 'sat' || d === 'sun') continue
      const s = sn as Session
      if (isLongRun(s) || !isStructuredSession(s)) continue
      const mins = s.duration_mins ?? 0
      if (mins > cap) { over++; o = true }
      if (mins > cap * (1 + TOL / 100)) {
        past++; t = true
        caps[cap] = (caps[cap] ?? 0) + 1
        const l = String(s.label ?? '?').replace(/\s+—.*$/, '')
        labels[l] = (labels[l] ?? 0) + 1
        if (mins - cap > worst.mins - worst.cap || (worst.cap && mins / cap > worst.mins / worst.cap)) worst = { mins, cap, label: l }
      }
    }
  }
  if (o) plansOver++
  if (t) plansPast++
}
console.log(`capped plans ${plans} · with an over-cap structured weekday session ${plansOver} · past ${TOL}% tolerance ${plansPast}`)
console.log(`sessions over cap ${over} · past tolerance ${past} · by cap`, caps)
console.log(`worst ${worst.mins} min vs ${worst.cap} (+${Math.round((worst.mins / worst.cap - 1) * 100)}%) ${worst.label}`)
console.log('top labels past tolerance', Object.entries(labels).sort((a, b) => b[1] - a[1]).slice(0, 6))
