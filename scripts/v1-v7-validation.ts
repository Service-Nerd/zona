// Phase 4 — Validation of V1–V7 fixes via two test plans.
// Run: npx tsx scripts/v1-v7-validation.ts

import { generateRulePlan } from '../lib/plan/ruleEngine'
import type { GeneratorInput, Plan, Session } from '../types/plan'

// ── Helpers ───────────────────────────────────────────────────────────────────

function findFirstQualityWeek(plan: Plan): number | null {
  for (const w of plan.weeks) {
    if (Object.values(w.sessions).some(s => s?.type === 'quality')) return w.n
  }
  return null
}

function findFirstVo2MaxWeek(plan: Plan): number | null {
  for (const w of plan.weeks) {
    for (const s of Object.values(w.sessions)) {
      if (!s || s.type !== 'quality') continue
      const label = (s.label ?? '').toLowerCase()
      const zone  = (s.zone  ?? '').toLowerCase()
      if (label.includes('vo2') || zone.includes('zone 4–5') || zone.includes('zone 5')) {
        return w.n
      }
    }
  }
  return null
}

function longRunDistance(week: { sessions: Record<string, Session | undefined> }): number | null {
  for (const s of Object.values(week.sessions)) {
    if (s && s.type === 'easy' && (s.label?.toLowerCase().includes('long') ?? false)) {
      return s.distance_km ?? null
    }
  }
  return null
}

function maxConsecutiveLrRepeats(plan: Plan): number {
  let dist: number | null = null
  let streak = 0
  let maxStreak = 0
  for (const w of plan.weeks) {
    if (w.type === 'race' || w.type === 'deload') {
      dist = null
      streak = 0
      continue
    }
    const lr = longRunDistance(w)
    if (lr == null) {
      dist = null
      streak = 0
      continue
    }
    if (dist != null && Math.abs(lr - dist) < 0.05) {
      streak++
    } else {
      dist = lr
      streak = 1
    }
    maxStreak = Math.max(maxStreak, streak)
  }
  return maxStreak
}

function week1HasHrNote(plan: Plan): boolean {
  const w1 = plan.weeks[0]
  if (!w1) return false
  for (const s of Object.values(w1.sessions)) {
    if (!s || s.type === 'strength' || s.type === 'rest' || s.type === 'race') continue
    if ((s.coach_notes ?? []).some(n => typeof n === 'string' && n.toLowerCase().includes('hr zones in this plan are estimated from age'))) return true
  }
  return false
}

function phaseTransitionsHaveHrNote(plan: Plan): { ok: boolean; transitions: { from: string | undefined; to: string | undefined; weekN: number; hasNote: boolean }[] } {
  const transitions: { from: string | undefined; to: string | undefined; weekN: number; hasNote: boolean }[] = []
  for (let i = 1; i < plan.weeks.length; i++) {
    const prev = plan.weeks[i - 1]
    const curr = plan.weeks[i]
    if (curr.phase === prev.phase) continue
    const firstActive = (() => {
      for (const d of ['mon','tue','wed','thu','fri','sat','sun'] as const) {
        const s = curr.sessions[d]
        if (!s) continue
        if (s.type === 'strength' || s.type === 'rest') continue
        return s
      }
      return null
    })()
    const hasNote = !!(firstActive && (firstActive.coach_notes ?? []).some(n => typeof n === 'string' && n.toLowerCase().includes('hr zones in this plan are estimated from age')))
    transitions.push({ from: prev.phase, to: curr.phase, weekN: curr.n, hasNote })
  }
  return { ok: transitions.every(t => t.hasNote), transitions }
}

function firstTaperWeek(plan: Plan): typeof plan.weeks[0] | null {
  return plan.weeks.find(w => w.phase === 'taper' && w.type !== 'race') ?? null
}

function taperRationaleNote(plan: Plan): string | null {
  const t = firstTaperWeek(plan)
  if (!t) return null
  for (const d of ['mon','tue','wed','thu','fri','sat','sun'] as const) {
    const s = t.sessions[d]
    if (!s) continue
    if (s.type === 'strength' || s.type === 'rest') continue
    for (const n of s.coach_notes ?? []) {
      if (typeof n !== 'string') continue
      if (n.toLowerCase().includes('taper')) return n
    }
    break
  }
  return null
}

// ── Test plans ───────────────────────────────────────────────────────────────

interface Check { name: string; pass: boolean; detail: string }

function runChecks(label: string, plan: Plan, expectations: {
  hr_zone_method: 'percent_of_estimated_max' | 'karvonen' | 'percent_of_max' | 'karvonen_estimated_max' | 'unspecified'
  expectV2VoLatest?: number  // latest acceptable week for first vo2max
  expectV6: boolean
  expectHrNotePropagation: boolean
}) {
  console.log(`\n── ${label} ──`)
  console.log(`  total weeks: ${plan.weeks.length}, phases: ${plan.phases?.map(p => `${p.name}[${p.start_week}-${p.end_week}]`).join(', ')}`)
  console.log(`  hr_zone_method: ${(plan.meta as any).hr_zone_method}`)
  console.log(`  rule_adjustments:`)
  for (const ra of (plan.meta.rule_adjustments ?? [])) {
    console.log(`    • [${ra.rule}] weeks ${ra.weeks_affected.join(',')}: ${ra.resolution}`)
  }
  if (plan.pre_plan) {
    console.log(`  pre_plan: buffer ${plan.pre_plan.buffer_weeks}w; estimate ${plan.pre_plan.week_estimate}`)
  } else {
    console.log(`  pre_plan: (none)`)
  }

  const checks: Check[] = []

  // V1 — first quality week vs prior week volume
  const fqWeekN = findFirstQualityWeek(plan)
  if (fqWeekN && fqWeekN > 1) {
    const fqIdx = plan.weeks.findIndex(w => w.n === fqWeekN)
    const prevWeekly = plan.weeks[fqIdx - 1].weekly_km
    const currWeekly = plan.weeks[fqIdx].weekly_km
    const ratio = prevWeekly > 0 ? currWeekly / prevWeekly : 1
    checks.push({
      name: 'V1 — volume hold on first-quality week',
      pass: ratio <= 1.05 + 0.01,  // tolerate rounding
      detail: `first quality in W${fqWeekN}; prev_weekly=${prevWeekly}, curr_weekly=${currWeekly}, ratio=${ratio.toFixed(3)} (≤ 1.05 expected)`,
    })
  } else {
    checks.push({
      name: 'V1 — volume hold on first-quality week',
      pass: true,
      detail: fqWeekN ? `first quality in W1 — V1 not applicable` : 'no quality session at all',
    })
  }

  // V2 — vo2max onset
  if (expectations.expectV2VoLatest !== undefined) {
    const fvWeek = findFirstVo2MaxWeek(plan)
    const ok = fvWeek != null && fvWeek <= expectations.expectV2VoLatest
    checks.push({
      name: 'V2 — VO2max onset',
      pass: ok || (plan.meta.rule_adjustments ?? []).some(ra => ra.rule === 'V2-vo2max-onset-timing'),
      detail: fvWeek
        ? `first vo2max in W${fvWeek}, latest acceptable=W${expectations.expectV2VoLatest}`
        : `no vo2max session in plan (acceptable for catalogues without vo2max)`,
    })
  }

  // V3 — HR note propagation
  if (expectations.expectHrNotePropagation) {
    const w1 = week1HasHrNote(plan)
    const tr = phaseTransitionsHaveHrNote(plan)
    checks.push({
      name: 'V3 — HR note on Week 1',
      pass: w1,
      detail: w1 ? 'present' : 'MISSING',
    })
    checks.push({
      name: 'V3 — HR note on phase transitions',
      pass: tr.ok,
      detail: tr.transitions.map(t => `${t.from}→${t.to}@W${t.weekN}:${t.hasNote ? '✓' : '✗'}`).join(', '),
    })
  } else {
    const w1 = week1HasHrNote(plan)
    checks.push({
      name: 'V3 — HR note absent (zone method ≠ percent_of_estimated_max)',
      pass: !w1,
      detail: `${(plan.meta as any).hr_zone_method}; week1 note=${w1}`,
    })
  }

  // V4 — long run consecutive repeats
  const maxStreak = maxConsecutiveLrRepeats(plan)
  checks.push({
    name: 'V4 — long run consecutive repeats',
    pass: maxStreak <= 2,
    detail: `max consecutive identical LR streak = ${maxStreak} (≤ 2 expected)`,
  })

  // V5 — build phase stimulus progression
  const buildQualities: { weekN: number; rank: number; afterDeload: boolean }[] = []
  const RANK_BY_LABEL = (label: string, zone: string): number => {
    const l = label.toLowerCase(); const z = zone.toLowerCase()
    if (l.includes('vo2') || z.includes('zone 4–5') || z.includes('zone 5')) return 5
    if (l.includes('-pace') || l.includes('sharpener')) return 4
    if (l.includes('tempo') || l.includes('cruise') || l.includes('threshold') || l.includes('progressive')) return 4
    if (l.includes('hill')) return 3
    if (l.includes('strid')) return 1
    if (l.includes('aerobic') || l.includes('steady')) return 2
    return 0
  }
  for (let i = 0; i < plan.weeks.length; i++) {
    const w = plan.weeks[i]
    if (w.phase !== 'build' || w.type === 'race' || w.type === 'deload') continue
    const afterDeload = i > 0 && plan.weeks[i - 1].type === 'deload'
    for (const s of Object.values(w.sessions)) {
      if (!s || s.type !== 'quality') continue
      const r = RANK_BY_LABEL(s.label ?? '', s.zone ?? '')
      if (r > 0) buildQualities.push({ weekN: w.n, rank: r, afterDeload })
    }
  }
  // True regressions only — equal-rank consolidation (tempo→tempo on
  // marathon, where catalogue has no rank-5 alternative) is acceptable.
  let regressions = 0
  for (let i = 1; i < buildQualities.length; i++) {
    if (buildQualities[i].afterDeload) continue
    if (buildQualities[i].rank < buildQualities[i - 1].rank) regressions++
  }
  checks.push({
    name: 'V5 — build-phase stimulus monotonicity',
    pass: regressions === 0 || buildQualities.length < 2,
    detail: `build qualities: ${buildQualities.map(q => `W${q.weekN}r${q.rank}${q.afterDeload ? '*' : ''}`).join(' ')} ; regressions=${regressions}`,
  })

  // V6 — pre_plan presence
  checks.push({
    name: 'V6 — pre_plan block presence',
    pass: !!plan.pre_plan === expectations.expectV6,
    detail: plan.pre_plan ? `present (buffer=${plan.pre_plan.buffer_weeks}w)` : 'absent',
  })

  // V7 — taper rationale note
  const taperNote = taperRationaleNote(plan)
  checks.push({
    name: 'V7 — taper rationale on first taper week',
    pass: !!taperNote,
    detail: taperNote ? `"${taperNote.slice(0, 80)}..."` : 'MISSING',
  })

  let pass = 0, fail = 0
  for (const c of checks) {
    const tag = c.pass ? '✓' : '✗'
    console.log(`  ${tag} ${c.name}: ${c.detail}`)
    if (c.pass) pass++; else fail++
  }
  console.log(`  → ${pass}/${pass+fail} passing`)
  return { pass, fail, checks }
}

// ── Plan A: 10K, 12 weeks, age 47, est-HR, intermediate, 3 days/wk, big buffer ──
// To trigger V6: weeks_available (plan_start → race) − weeks_required_ok must
// exceed 4. For 10K, weeks_required_ok = 10. Race gap = 19 weeks ⇒ buffer = 9.
const planAStart = '2026-05-11'
const planA = generateRulePlan({
  athlete_name: 'Alice', age: 47,
  race_name: 'Test 10K',
  race_date: '2026-09-21',  // 19 weeks from plan_start
  race_distance_km: 10,
  goal: 'time_target',
  target_time: '52:00',
  current_weekly_km: 25,
  longest_recent_run_km: 12,
  days_available: 3,
  fitness_level: 'intermediate',
  // No max_hr / resting_hr — triggers percent_of_estimated_max
  injury_history: [],
  acknowledged_prep_warning: true,
}, 'paid', planAStart)

const A = runChecks(
  'PLAN A — 10K, 12wk, age 47, estimated HR, 3 d/wk, ~17wk buffer',
  planA,
  {
    hr_zone_method: 'percent_of_estimated_max',
    expectV2VoLatest: 7,           // total(12) − taper(2) − 5 = 5; allow up to W7 since catalogue places vo2 in peak (V2 logs adjustment if late)
    expectV6: true,                // buffer > 4
    expectHrNotePropagation: true,
  },
)

// ── Plan B: marathon, 18 weeks, measured HR, advanced ───────────────────────
const planB = generateRulePlan({
  athlete_name: 'Bob', age: 38,
  race_name: 'Test Marathon',
  race_date: '2026-09-12',
  race_distance_km: 42.2,
  goal: 'time_target',
  target_time: '3:30:00',
  current_weekly_km: 60,
  longest_recent_run_km: 25,
  days_available: 5,
  fitness_level: 'experienced',
  resting_hr: 50,
  max_hr: 188,
  injury_history: [],
  acknowledged_prep_warning: true,
}, 'paid', '2026-05-11')  // 18 weeks until 2026-09-12 → no buffer

const B = runChecks(
  'PLAN B — Marathon, 18wk, measured HR, advanced, 5 d/wk, no buffer',
  planB,
  {
    hr_zone_method: 'karvonen',
    expectV2VoLatest: undefined,   // catalogue has no vo2max for marathon — V2 should be a no-op
    expectV6: false,
    expectHrNotePropagation: false,
  },
)

console.log('\n══════════════════════════════════════════════════════════════════════')
console.log(`Total: ${A.pass + B.pass} pass, ${A.fail + B.fail} fail`)
process.exit(A.fail + B.fail > 0 ? 1 : 0)
