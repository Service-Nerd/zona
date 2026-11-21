// ADR027-B3-VERIFIER — each ported rule agrees with `validatePlan`, finding for finding.
//
// 🔑 TWO POPULATIONS, because one cannot show agreement on its own:
//   · VALID plans from the golden corpus (the wizard's own answer space). An engine plan is meant to be
//     silent, so this proves the verifier raises nothing the old checker does not (no false positives).
//   · BROKEN plans: the liveness battery's mutations applied to those plans. This is where the rules FIRE,
//     so this proves the verifier catches what the old checker catches.
// The comparison is a multiset of (rule, week, day, severity). An arm also asserts each ported rule fired
// at least once, because two checkers that both say nothing agree perfectly and prove nothing.
//
// ⚠️ The work runs in `beforeAll`, not at import, so its cost is billed to a test and `check:slow` sees it.
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { goldenSample, GOLDEN_AS_OF } from '@/lib/corpus/goldenCorpus'
import { runEngine } from '@/lib/plan/engine'
import { validatePlan } from '@/lib/plan/invariants'
import { MUTATIONS } from '@/lib/plan/invariantLiveness'
import type { Plan, GeneratorInput, Session } from '@/types/plan'
import { isLongRun, isStructuredSession, isTimeTrial } from '@/lib/plan/sessionRole'
import { GENERATION_CONFIG, raceDistanceKey } from '@/lib/plan/generationConfig'
import { hasInjuryKeyword } from '@/lib/plan/injuryScope'
import { BENCHMARK_VDOT_MAX } from '@/lib/plan/benchmarkCheck'
import { RULES } from '@/lib/engine/catalogue/rules'
import { verifyPlan, PORTED_RULES } from './verifyPlan'
import { buildRunnerProfile, factsFromInput } from '@/lib/engine/profile/buildRunnerProfile'

const clone = (p: Plan): Plan => JSON.parse(JSON.stringify(p))
const key = (rule: string, week: number, day: string | null | undefined, sev: string) => `${rule}|${week}|${day ?? '-'}|${sev}`

/** Breakages the shared liveness battery does not make, added for ported rules it cannot wake or whose
 *  line it never reaches. Kept here, not in `invariantLiveness.ts`, so the liveness baseline does not move.
 *  Each returns whether it changed a session the rule actually checks; `hits` counts them, and an arm
 *  asserts every one landed somewhere, so a mutation that silently does nothing fails the file. */
const governedWeek = (w: Plan['weeks'][number]) =>
  w.phase !== 'maintenance_restoration' && w.phase !== 'maintenance_base' && w.phase !== 'base_build'
const checkedEasy = (s: Session | undefined) =>
  !!s && s.type === 'easy' && !isLongRun(s) && !isStructuredSession(s) && !s.floor_protected && !!s.duration_mins
const EXTRA_MUTATIONS: { name: string; apply: (p: Plan, input: GeneratorInput) => boolean }[] = [
  { name: 'duration-anchored session loses its minutes', apply: p => {
    for (const w of p.weeks.filter(governedWeek)) for (const s of Object.values(w.sessions ?? {})) {
      if (s && s.type === 'easy') { s.duration_anchored = true; s.duration_mins = undefined; return true }
    }
    return false
  } },
  // The weekday-time boundary: one minute over the runner's own limit. Without it a check loosened by a
  // minute stayed green, because no battery mutation lands near the line (falsified 2026-11-21).
  ...([false, true] as const).map(foundation => ({
    name: `a ${foundation ? 'foundation' : 'main'}-week weekday easy run one minute over its limit`,
    apply: (p: Plan, input: GeneratorInput) => {
      for (const w of p.weeks.filter(x => governedWeek(x) && (foundation ? x.n <= 0 : x.n > 0))) {
        for (const d of ['mon', 'tue', 'wed', 'thu', 'fri'] as const) {
          const cap = input.day_budgets?.[d] ?? input.max_weekday_mins
          const s = w.sessions?.[d]
          if (cap == null || !checkedEasy(s)) continue
          s!.duration_mins = cap + 1
          return true
        }
      }
      return false
    },
  })),
  // An INPUT breakage: the wizard cannot send a longest run above the weekly total, so no plan or plan
  // mutation reaches INV-INPUT-LONGEST-LE-WEEKLY. This one changes what both checkers are handed.
  { name: 'stated longest run above the stated week', apply: (_p, input) => {
    if (!(input.current_weekly_km && input.current_weekly_km > 0)) return false
    input.longest_recent_run_km = input.current_weekly_km + 1
    return true
  } },
  // §87: a deload on the FIRST week of a phase (the 'opens a phase' arm, which nothing else wakes).
  { name: 'a deload opens the build phase', apply: p => {
    const i = p.weeks.findIndex((w, k) => k > 0 && w.n > 1 && w.phase === 'build' && p.weeks[k - 1].phase === 'base')
    if (i < 0 || p.weeks[i].type === 'deload') return false
    p.weeks[i].type = 'deload'
    return true
  } },
  // §23's length gate: a plan one main week under PEAK_OVERLOAD_MIN_PLAN_WEEKS with a flat peak. The old
  // checker is silent below the gate; a verifier without it would raise PEAK-OVER-BASE.
  { name: 'a short plan with a flat peak', apply: p => {
    const main = p.weeks.filter(w => w.n > 0)
    const keep = GENERATION_CONFIG.PEAK_OVERLOAD_MIN_PLAN_WEEKS - 1
    if (main.length <= keep) return false
    const kept = new Set(main.slice(0, keep))
    p.weeks = p.weeks.filter(w => w.n <= 0 || kept.has(w))
    const last = main[keep - 1], first = main[0]
    last.phase = 'peak'; last.weekly_km = first.weekly_km
    return true
  } },
  // §46's line: a time-targeted long race whose peak sits half a kilometre under its floor.
  { name: 'a long-race peak half a kilometre under its floor', apply: (p, input) => {
    const d = input.race_distance_km
    if (input.goal !== 'time_target' || !input.target_time || d < 40) return false
    const floor = d <= 43 ? d * GENERATION_CONFIG.MARATHON_PEAK_VOLUME_FLOOR_RATIO
      : d <= 55 ? d * GENERATION_CONFIG.ULTRA_50K_PEAK_VOLUME_FLOOR_RATIO
      : Math.min(d * GENERATION_CONFIG.ULTRA_LONG_PEAK_VOLUME_FLOOR_RATIO, GENERATION_CONFIG.ULTRA_PEAK_VOLUME_FLOOR_CAP_KM)
    const peaks = p.weeks.filter(w => w.phase === 'peak')
    if (!peaks.length || p.meta.volume_profile === 'maintenance') return false
    for (const w of peaks) w.weekly_km = Math.round((floor - 0.5) * 10) / 10
    return true
  } },
  // §9's minute line: a main-week long run one minute over its (injury-lowered) cap.
  { name: 'a long run one minute over its minute cap', apply: (p, input) => {
    const caps = Object.entries(GENERATION_CONFIG.LONG_RUN_CAP_MINUTES_BY_INJURY)
      .filter(([k]) => hasInjuryKeyword(input.injury_history ?? [], k)).map(([, m]) => m as number)
    const cap = Math.min(GENERATION_CONFIG.LONG_RUN_CAP_MINUTES[raceDistanceKey(input.race_distance_km)], ...caps)
    for (const w of p.weeks.filter(x => x.n > 0 && governedWeek(x))) for (const s of Object.values(w.sessions ?? {})) {
      if (s && isLongRun(s)) { s.duration_mins = cap + 1; return true }
    }
    return false
  } },
  // §55 Am. 1's line: a VDOT half a point above the human ceiling.
  { name: 'a vdot half a point over the human ceiling', apply: p => {
    (p.meta as { vdot?: number }).vdot = BENCHMARK_VDOT_MAX + 0.5
    return true
  } },
  // The plan's statements about itself (§44, §50, §78): one breakage per check, so each arm is woken.
  ...([
    ['prep warned without its warning', (p: Plan) => { p.meta.prep_time_status = 'warned'; delete p.meta.prep_time_warning; return true }],
    ['prep warned with a warning but no alternatives', (p: Plan) => {
      p.meta.prep_time_status = 'warned'; p.meta.prep_time_warning = 'tight'; delete p.meta.prep_time_alternatives; return true
    }],
    ['warned plan reading demanding', (p: Plan) => { p.meta.prep_time_status = 'warned'; p.meta.difficulty_band = 'demanding'; return true }],
    // Short of target too, so COMPRESSION-CLASSIFICATION's ordered checks reach the third on every plan.
    ['constrained plan reading comfortable', (p: Plan) => {
      p.meta.compression_classification = 'constrained_by_inputs'; p.meta.difficulty_band = 'comfortable'; p.meta.time_compressed = true; return true
    }],
    ...(['long_run_shortfall_note', 'peak_shortfall_note', 'volume_shortfall_note'] as const).map(note =>
      [`${note} declared, reading comfortable`, (p: Plan) => {
        for (const k of ['long_run_shortfall_note', 'peak_shortfall_note', 'volume_shortfall_note'] as const) delete p.meta[k]
        p.meta[note] = 'short'; p.meta.difficulty_band = 'comfortable'; return true
      }] as const),
    ['no HR method', (p: Plan) => { delete p.meta.hr_zone_method; return true }],
    // Batch 8: the plan's declarations about its own limits.
    ['no compression class', (p: Plan) => { delete p.meta.compression_classification; return true }],
    ['optimal class on a compressed plan', (p: Plan) => { p.meta.compression_classification = 'optimal'; p.meta.time_compressed = true; return true }],
    ['split flags missing (time)', (p: Plan) => { delete p.meta.time_compressed; return true }],
    ['split flags missing (volume)', (p: Plan) => { delete p.meta.volume_constrained; return true }],
    ['a non-optimal class on a plan that reached its target', (p: Plan) => {
      p.meta.compression_classification = 'constrained_by_inputs'; p.meta.time_compressed = false; p.meta.volume_constrained = false; return true
    }],
    ['compressed disagreeing with the split', (p: Plan) => {
      p.meta.time_compressed = false; p.meta.volume_constrained = false; p.meta.compressed = true; return true
    }],
    ['fresh return flipped', (p: Plan) => { p.meta.fresh_return_active = !p.meta.fresh_return_active; return true }],
    ['uncovered runway at the note line, no note', (p: Plan) => {
      p.meta.uncovered_runway_weeks = GENERATION_CONFIG.FOUNDATION_UNCOVERED_WEEKS_NOTE_THRESHOLD; delete p.meta.uncovered_runway_note; return true
    }],
    ['floor-held weeks at the line, undeclared', (p: Plan) => {
      // Clear any existing holds first, so the count is EXACTLY the line on every plan.
      for (const w of p.weeks) for (const s of Object.values(w.sessions ?? {})) if (s) delete s.floor_protected
      const weeks = p.weeks.filter(w => Object.values(w.sessions ?? {}).some(s => s?.type === 'easy'))
      if (weeks.length < GENERATION_CONFIG.EASY_RUN_FLOOR_PROTECTION_MAINTENANCE_WEEKS) return false
      for (const w of weeks.slice(0, GENERATION_CONFIG.EASY_RUN_FLOOR_PROTECTION_MAINTENANCE_WEEKS)) {
        const s = Object.values(w.sessions ?? {}).find(x => x?.type === 'easy'); if (s) s.floor_protected = true
      }
      p.meta.volume_profile = 'build'; return true
    }],
    ['a max HR one beat under the age estimate, unconfirmed', (p: Plan) => {
      if (typeof p.meta.hr_estimated_max !== 'number') return false
      p.meta.hr_derived_max = p.meta.hr_estimated_max - 1; p.meta.hr_max_source = 'observed'; return true
    }],
    ['a non-Karvonen method with no note', (p: Plan) => { p.meta.hr_zone_method = 'percent_of_max'; delete p.meta.hr_assumption_note; return true }],
    ['a recalibration week that does not exist', (p: Plan) => { p.meta.recalibration_weeks = [999]; return true }],
    ['a recalibration week with no time trial', (p: Plan) => {
      const w = p.weeks.find(x => x.n > 0 && !Object.values(x.sessions ?? {}).some(s => s && isTimeTrial(s)))
      if (!w) return false
      p.meta.recalibration_weeks = [w.n]; return true
    }],
  ] as const).map(([name, f]) => ({ name, apply: (p: Plan) => f(p) })),
  ...([
    // §40c's two lines at once: runs pinned at `cap - 1` (the tolerance), and EXACTLY the pinned share of
    // weekday easy runs pinned, the rest well under. Returns whether it changed a run.
    ['a weekday cap binding at exactly its share and tolerance, no shortfall note', (p: Plan, i: GeneratorInput) => {
      if (!i.max_weekday_mins) return false
      const runs: { s: Session; cap: number }[] = []
      for (const w of p.weeks.filter(x => x.type !== 'deload' && x.type !== 'race' && x.badge !== 'deload')) {
        for (const d of ['mon', 'tue', 'wed', 'thu', 'fri'] as const) {
          const s = w.sessions?.[d]; if (s?.type === 'easy') runs.push({ s, cap: i.day_budgets?.[d] ?? i.max_weekday_mins })
        }
      }
      if (!runs.length) return false
      const need = Math.ceil(runs.length * GENERATION_CONFIG.VOLUME_SHORTFALL_PINNED_SHARE)
      runs.forEach((r, k) => { r.s.duration_mins = k < need ? r.cap - 1 : Math.max(1, r.cap - 10) })
      p.meta.volume_shortfall_pct = GENERATION_CONFIG.VOLUME_SHORTFALL_NOTE_THRESHOLD_PCT; delete p.meta.volume_shortfall_note; return true
    }],
    // §29 and §37 separately, with the plan's flag left as built, so each arm of the gate can disagree alone.
    ['the explicit fresh-return input alone', (p: Plan, i: GeneratorInput) => {
      i.weeks_at_current_volume = GENERATION_CONFIG.FRESH_RETURN_WEEKS_THRESHOLD - 1; i.training_age = '<6mo'; return true
    }],
    ['the fresh-return heuristic alone', (p: Plan, i: GeneratorInput) => {
      delete (i as { weeks_at_current_volume?: number }).weeks_at_current_volume
      i.training_age = '5yr+'
      i.current_weekly_km = GENERATION_CONFIG.HEURISTIC_FRESH_RETURN_WEEKLY_KM - 1
      i.longest_recent_run_km = GENERATION_CONFIG.HEURISTIC_FRESH_RETURN_LONG_RUN_KM - 1
      return true
    }],
    ['meta age differing from the input', (p: Plan, i: GeneratorInput) => {
      if (typeof i.age !== 'number') return false
      ;(p.meta as unknown as Record<string, unknown>).age = i.age + 1; return true
    }],
    ['meta age with no input age', (p: Plan, i: GeneratorInput) => {
      delete (i as { age?: number }).age; (p.meta as unknown as Record<string, unknown>).age = 40; return true
    }],
    ['no age and no assumption note', (p: Plan, i: GeneratorInput) => {
      delete (i as { age?: number }).age; delete p.meta.hr_assumption_note; return true
    }],
  ] as const).map(([name, f]) => ({ name, apply: (p: Plan, i: GeneratorInput) => f(p, i) })),
  // §49's line: exactly one taper week over the cap (relabel the weeks before the taper).
  { name: 'one taper week over the cap', apply: (p, input) => {
    const cap = GENERATION_CONFIG.MAX_TAPER_PHASE_WEEKS[raceDistanceKey(input.race_distance_km) as keyof typeof GENERATION_CONFIG.MAX_TAPER_PHASE_WEEKS]
    let n = p.weeks.filter(w => w.phase === 'taper').length
    if (n >= cap + 1) return false                       // already over: this mutation would change nothing
    const first = p.weeks.findIndex(w => w.phase === 'taper')
    for (let i = first - 1; i >= 0 && n < cap + 1; i--) {
      const w = p.weeks[i]
      if (w.n < 1 || w.type === 'race' || w.type === 'deload') return false
      w.phase = 'taper'; n++
    }
    return first > 0 && n === cap + 1
  } },
  // §39 Am. 1's line: a session inside the protected days, one minute over the shakeout cap.
  { name: 'a pre-race session one minute over the shakeout cap', apply: p => {
    for (const w of p.weeks) {
      const keys = Object.keys(w.sessions ?? {})
      const raceDay = keys.find(d => w.sessions[d as 'mon']?.type === 'race')
      if (!raceDay) continue
      const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
      const prior = days[days.indexOf(raceDay) - 1] as 'mon' | undefined
      const s = prior ? w.sessions[prior] : undefined
      if (!s || s.type === 'rest') continue
      s.duration_mins = GENERATION_CONFIG.RACE_WEEK_SHAKEOUT_MAX_MINS + 1
      raceEveDays.set(p, `${w.n}|${prior}`)
      return true
    }
    return false
  } },
  // The race date leaves the final week: COVERS-RACE-DATE fires and RACE-ON-RACE-DAY must still be checked.
  // Eight days, not seven: seven keeps the weekday, so no wrong-day finding exists to disagree about.
  { name: 'race date eight days after the plan ends', apply: p => {
    if (!p.meta.race_date) return false
    const [y, m, d] = p.meta.race_date.split('-').map(Number)
    const next = new Date(y, m - 1, d + 8)
    p.meta.race_date = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`
    return true
  } },
]
const hits = new Map<string, number>()
const GOAL_CASE = 'rebuilt as time target with no time, plus a quality session'
/** Where the race-eve mutation put its over-cap session, so the verifier's day can be checked against it. */
const raceEveDays = new WeakMap<Plan, string>()
/** Rules that make more than one independent check: each detail prefix must fire on its own. */
const ARMS: Record<string, string[]> = {
  'INV-PLAN-DELOAD-PLACEMENT': ['deload opens a phase', 'cadence:'],
  'INV-PLAN-PHASE-STRUCTURE': ['phase returns', 'phases out of order'],
  'INV-PLAN-PREP-TIME-STATUS-ANNOTATED': ['no prep_time_status', 'warned without its warning', 'warned without its alternatives'],
  'INV-PLAN-DIFFICULTY-NEVER-FRONTS-UNSAFE': ['warned plan not very demanding', 'constrained plan reads comfortable', 'shortfall declared'],
  'INV-PLAN-NO-INVENTED-AGE': ['meta age differs', 'meta age with no input age', 'no age and no assumption note'],
  'INV-PLAN-HR-ASSUMPTIONS-SURFACED': ['no hr_zone_method', 'no assumption note for'],
  'INV-PLAN-RECALIBRATION-HAS-SESSION': ['listed week does not exist', 'no time trial'],
  'INV-PLAN-COMPRESSION-CLASSIFICATION': ['no compression_classification', 'class disagrees', 'constrained class reads comfortable'],
  'INV-PLAN-COMPRESSION-SPLIT': ['split flags not both stated', 'compressed is not the OR'],
}

const tally = { rows: 0, threw: [] as string[], refused: 0, base: 0, foundation: 0, foundationCapped: 0 }
let runs: { label: string; eve: string | null; old: { rule: string; k: string }[]; new: { rule: string; k: string; detail: string }[] }[] = []

beforeAll(() => {
  // ONE CLOCK (code review): the engine prices a benchmark at the real clock (§10's staleness ramp) and
  // stamps the level into meta, while the verifier's profile is built at the row's asOf. Without this the
  // comparison drifts as the calendar moves, the GOALPACE-5K-CLOCK-01 class. Date only; timers stay real.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(`${GOLDEN_AS_OF}T12:00:00`))
  try { build() } finally { vi.useRealTimers() }
}, 120_000)

function build() {
  const cases: { label: string; plan: Plan; input: GeneratorInput; asOf: string; planStart: string; extra?: string }[] = []
  for (const row of goldenSample({ perGroup: 8 })) {
    tally.rows++
    let o: ReturnType<typeof runEngine>
    // Under test the engine throws on its own error-severity violations. Counted, never hidden.
    try {
      o = runEngine({ input: row.input, tier: row.tier, displayUnits: 'km', planStart: row.planStart, today: row.asOf })
    } catch { tally.threw.push(row.id); continue }
    if (o.kind !== 'plan') { tally.refused++; continue }
    tally.base++
    if (o.plan.weeks.some(w => w.n <= 0)) {
      tally.foundation++
      if (row.input.day_budgets || row.input.max_weekday_mins != null) tally.foundationCapped++
    }
    cases.push({ label: row.id, plan: o.plan, input: row.input, asOf: row.asOf, planStart: row.planStart })
    for (const m of MUTATIONS) {
      const p = clone(o.plan)
      try { m.apply(p) } catch { continue }
      cases.push({ label: `${row.id} / ${m.name}`, plan: p, input: row.input, asOf: row.asOf, planStart: row.planStart })
    }
    // The NORMALISED goal, on a CONSISTENT plan: rebuild from a time target with no time (the engine plans it
    // as a finish goal), then add one quality session. Mutating the request without rebuilding made the two
    // checkers read different runners, which tested nothing (found 2026-11-21).
    if (row.input.goal === 'time_target' || row.input.target_time) {
      const noTime = { ...row.input, goal: 'time_target' } as GeneratorInput
      delete (noTime as { target_time?: string }).target_time
      try {
        const r = runEngine({ input: noTime, tier: row.tier, displayUnits: 'km', planStart: row.planStart, today: row.asOf })
        if (r.kind === 'plan') {
          const p = clone(r.plan)
          const easy = p.weeks.filter(x => x.n > 0 && governedWeek(x)).flatMap(w => Object.values(w.sessions ?? {}))
            .find(x => x && x.type === 'easy' && !isLongRun(x))
          if (easy) {
            easy.type = 'quality'
            // Only a BEGINNER's ceiling depends on the goal, so only a beginner case proves the goal arm.
            const lvl = buildRunnerProfile(factsFromInput(noTime), { asOf: row.asOf, timezone: null, planStart: row.planStart }).levels.intensity.value
            if (lvl === 'beginner') hits.set(GOAL_CASE, (hits.get(GOAL_CASE) ?? 0) + 1)
            cases.push({ label: `${row.id} / ${GOAL_CASE}`, plan: p, input: noTime, asOf: row.asOf, planStart: row.planStart })
          }
        }
      } catch { /* the engine refusing this variant is not a comparison */ }
    }
    for (const m of EXTRA_MUTATIONS) {
      const p = clone(o.plan)
      const input = JSON.parse(JSON.stringify(row.input)) as GeneratorInput
      if (!m.apply(p, input)) continue
      cases.push({ label: `${row.id} / ${m.name}`, plan: p, input, asOf: row.asOf, planStart: row.planStart, extra: m.name })
    }
  }
  runs = cases.flatMap(c => {
    let old: ReturnType<typeof validatePlan>
    // Only the OLD checker may be excused: a mutation it cannot read is not a comparison. A verifier throw
    // is not caught here, so it fails the file.
    try { old = validatePlan(c.plan, c.input) } catch { return [] }
    // A mutation counts as LANDED only once its case is actually compared (code review, batch 8).
    if (c.extra) hits.set(c.extra, (hits.get(c.extra) ?? 0) + 1)
    return [{ label: c.label,
      old: old.map(v => ({ rule: v.code, k: key(v.code, v.week, v.day, v.severity) })),
      eve: raceEveDays.get(c.plan) ?? null,
      new: verifyPlan(c.plan, { input: c.input, profile: buildRunnerProfile(factsFromInput(c.input), { asOf: c.asOf, timezone: null, planStart: c.planStart }) }).map(f => ({ rule: f.rule_id as string, k: key(f.rule_id, f.week, f.day, f.severity), detail: f.detail })) }]
  })
}

/** Rules where `validatePlan` names no day but the verifier does. The same finding at finer grain: compared
 *  without the day, and listed so the exemption is a decision, not a drift. */
const OLD_OMITS_DAY = new Set<string>([
  'INV-PLAN-NO-RACE-EVE-SESSION',   // the old push carries week only; the verifier names the offending day
])
const dropDay = (k: string) => k.replace(/^([^|]+\|[^|]+)\|[^|]+\|/, '$1|-|')

function compare(rule: string) {
  const fired = { old: 0, new: 0 }
  const diffs: string[] = []
  for (const c of runs) {
    const oldKeys = c.old.filter(x => x.rule === rule).map(x => x.k)
    const newKeys = c.new.filter(x => x.rule === rule).map(x => (OLD_OMITS_DAY.has(rule) ? dropDay(x.k) : x.k))
    fired.old += oldKeys.length; fired.new += newKeys.length
    const a = [...oldKeys].sort().join(','), b = [...newKeys].sort().join(',')
    if (a !== b) diffs.push(`${c.label}: old [${a}] new [${b}]`)
  }
  return { fired, diffs }
}

describe('ADR027-B3-VERIFIER — agreement with validatePlan, per ported rule', () => {
  it('the corpus produced enough REAL plans to compare, and every row is accounted for', () => {
    // Measured 2026-11-21: perGroup 2 gave 8 plans and NONE with foundation weeks, so the foundation rules
    // were compared on broken plans only. perGroup 8 gives 37 plans, 5 with foundation weeks. The floors are
    // on BASE plans, because ~100 mutations of a single plan would satisfy a floor on total cases.
    expect(tally.base, `rows ${tally.rows}, refused ${tally.refused}, threw ${tally.threw.length}`).toBeGreaterThanOrEqual(30)
    expect(tally.foundation, 'valid plans with foundation weeks, which the foundation rules need').toBeGreaterThanOrEqual(3)
    // FOUNDATION-WEEKDAY-WITHIN-BUDGET runs only when the input carries a weekday limit (code review).
    expect(tally.foundationCapped, 'foundation plans whose input has a weekday limit').toBeGreaterThanOrEqual(2)
  })

  it('every extra mutation landed on a session its rule checks, in at least one plan', () => {
    for (const m of EXTRA_MUTATIONS) expect(hits.get(m.name) ?? 0, m.name).toBeGreaterThan(0)
    expect(hits.get(GOAL_CASE) ?? 0, GOAL_CASE).toBeGreaterThan(0)
    expect(tally.base + tally.refused + tally.threw.length).toBe(tally.rows)
    expect(tally.threw.length, tally.threw.slice(0, 3).join(', ')).toBeLessThanOrEqual(Math.ceil(tally.rows / 10))
  })

  it('the day exemption is used only where the old checker really omits the day', () => {
    for (const rule of Array.from(OLD_OMITS_DAY)) {
      const old = runs.flatMap(c => c.old.filter(x => x.rule === rule))
      expect(old.length, `${rule} never fired, so its exemption is unproven`).toBeGreaterThan(0)
      expect(old.every(x => x.k.split('|')[2] === '-'), `${rule}: the old checker names a day after all`).toBe(true)
    }
  })

  it('🔴 the race-eve finding names the day the over-cap session is on, not just the week', () => {
    let checked = 0
    for (const c of runs) {
      if (!c.eve) continue
      const [wk, day] = c.eve.split('|')
      const found = c.new.filter(x => x.rule === 'INV-PLAN-NO-RACE-EVE-SESSION' && x.k.startsWith(`INV-PLAN-NO-RACE-EVE-SESSION|${wk}|`))
      expect(found.map(x => x.k.split('|')[2]), c.label).toContain(day)
      checked++
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('🔴 every arm of a multi-check rule fires on its own', () => {
    for (const [rule, prefixes] of Object.entries(ARMS)) {
      if (!(PORTED_RULES as string[]).includes(rule)) continue
      for (const pre of prefixes) {
        const n = runs.reduce((t, c) => t + c.new.filter(x => x.rule === rule && x.detail.startsWith(pre)).length, 0)
        expect(n, `${rule}: "${pre}" never fires`).toBeGreaterThan(0)
      }
    }
  })

  it('🔴 no rule with a conditional severity is ported before its condition is a predicate', () => {
    const conditional = new Set(RULES.filter(r => r.severity_note).map(r => r.id))
    expect(PORTED_RULES.filter(r => conditional.has(r))).toEqual([])
  })

  for (const rule of PORTED_RULES) {
    it(`🔴 ${rule}: same findings and severity on every valid and broken plan, and it fires`, () => {
      const { fired, diffs } = compare(rule)
      expect(diffs.slice(0, 5), `${diffs.length} disagreements`).toEqual([])
      expect(fired.old, 'nothing in the battery wakes this rule, so agreement proves nothing').toBeGreaterThan(0)
    })
  }
})
