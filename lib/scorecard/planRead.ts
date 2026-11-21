/**
 * The "plan-read predicates" step: generate every corpus case through the PRODUCT path
 * (`runEngine`, and on a refusal that offers the get-running plan, the wizard's accept), then count
 * each predicate. Returns scorecard lines; it does not compare (`ratchet.ts` owns that).
 *
 * Hard rules ride along: `validatePlan` error-severity violations and unexpected throws are lines
 * whose only acceptable value is 0.
 */
import type { GeneratorInput, Plan, Week } from '@/types/plan'
import { runEngine } from '@/lib/plan/engine'
import { validatePlan } from '@/lib/plan/invariants'
import { generateMaintenanceBlock, type MaintenanceBlockOptions } from '@/lib/plan/maintenance'
import { planToRunContext } from '@/lib/strength-bridge/runContext'
import { strengthProfileGrid } from '@/lib/strength-bridge/profileGrid'
import { generateStrengthPlan } from '@/packages/strength'
import { MAINTENANCE_PREDICATES, PLAN_PREDICATES, STRENGTH_PREDICATES } from './predicates'
import { spread } from './corpora'
import type { Corpus, Line, PlanKind, PlanPredicate } from './types'

export interface PlanReadOptions {
  mode: 'full' | 'fast'
  /** Override the registry (the falsification tests plant a predicate or a mutated plan). */
  predicates?: readonly PlanPredicate[]
  /** Applied to every generated plan before the predicates read it. Falsification only. */
  mutatePlan?: (p: Plan, i: GeneratorInput) => Plan
}

export interface PlanReadResult {
  lines: Line[]
  /** First few firing cases per predicate, for the report. */
  examples: Record<string, string[]>
  plansRead: number
}

interface Generated { input: GeneratorInput; plan: Plan; kind: PlanKind }

function generate(c: { input: GeneratorInput; planStart: string; today: string }): { g?: Generated; outcome: 'plan' | 'base_build' | 'refused' | 'thrown' } {
  const req = { input: c.input, tier: 'paid' as const, displayUnits: 'km' as const, planStart: c.planStart, today: c.today }
  try {
    const o = runEngine(req)
    if (o.kind === 'plan') return { g: { input: c.input, plan: o.plan, kind: 'race' }, outcome: 'plan' }
    if (o.kind === 'base_build') return { g: { input: c.input, plan: o.plan, kind: 'base_build' }, outcome: 'base_build' }
    // The wizard's sequence: a refusal that offers the get-running plan is accepted (§118).
    if ((o.body as { get_running?: unknown }).get_running) {
      const a = runEngine({ ...req, acceptBaseBuild: true })
      if (a.kind === 'base_build') return { g: { input: c.input, plan: a.plan, kind: 'base_build' }, outcome: 'base_build' }
    }
    return { outcome: 'refused' }
  } catch {
    return { outcome: 'thrown' }
  }
}

const bump = (m: Record<string, number>, k: string, n = 1) => { m[k] = (m[k] ?? 0) + n }
const label = (i: GeneratorInput) =>
  `${i.race_distance_km}km ${i.goal} cwk${i.current_weekly_km} lr${i.longest_recent_run_km} d${i.days_available}`
  + ` cap${i.max_weekday_mins ?? '-'} age${i.age ?? '-'} inj${(i.injury_history ?? []).join('+') || '-'}`

/** A strength-profile stride and run-plan count per mode. `full` approximates `verify:strength`'s
 *  population (60 run plans × every profile); `fast` is a gate-sized sample. */
const STRENGTH_N = { full: { runPlans: 60, profiles: Infinity }, fast: { runPlans: 3, profiles: 16 } } as const
const MAINT_N = { full: Infinity, fast: 120 } as const

export function runPlanRead(corpora: Corpus[], opts: PlanReadOptions): PlanReadResult {
  const preds = opts.predicates ?? PLAN_PREDICATES
  const lines: Line[] = []
  const examples: Record<string, string[]> = {}
  const total: Record<string, number> = {}
  const strengthPool: Generated[] = []
  let plansRead = 0

  const quiet = console.error, warn = console.warn
  console.error = () => {}; console.warn = () => {}
  try {
    for (const c of corpora) {
      const n: Record<string, number> = {}
      const perPred: Record<string, number> = {}
      let errors = 0
      for (const cs of c.cases) {
        const r = generate(cs)
        bump(n, r.outcome)
        if (!r.g) continue
        plansRead++
        const plan = opts.mutatePlan ? opts.mutatePlan(r.g.plan, r.g.input) : r.g.plan
        if (r.g.kind === 'race') {
          errors += validatePlan(plan, r.g.input).filter(v => v.severity === 'error').length
          if (c.name !== 'beginnerMarathon') strengthPool.push({ ...r.g, plan })
        }
        for (const p of preds) {
          if (!(p.kinds ?? ['race']).includes(r.g.kind)) continue
          let hit: string | null = null
          try { hit = p.test(plan, r.g.input) } catch (e) { hit = `PREDICATE THREW: ${(e as Error).message.slice(0, 80)}` }
          if (hit) {
            bump(perPred, p.id); bump(total, p.id)
            const ex = (examples[p.id] ??= [])
            if (ex.length < 3) ex.push(`${c.name}: ${label(r.g.input)} :: ${hit}`)
          }
        }
      }
      lines.push(
        { id: `planread.corpus.${c.name}.cases`, value: c.cases.length, better: 'stable' },
        { id: `planread.corpus.${c.name}.race_plans`, value: n.plan ?? 0, better: 'stable' },
        { id: `planread.corpus.${c.name}.base_build`, value: n.base_build ?? 0, better: 'stable' },
        { id: `planread.corpus.${c.name}.refused`, value: n.refused ?? 0, better: 'stable' },
        { id: `planread.hard.${c.name}.thrown`, value: n.thrown ?? 0, better: 'zero', headline: true },
        { id: `planread.hard.${c.name}.error_violations`, value: errors, better: 'zero', headline: true },
      )
      for (const p of preds) lines.push({ id: `planread.${p.id}@${c.name}`, value: perPred[p.id] ?? 0, better: 'lower' })
    }
    for (const p of preds) lines.push({ id: `planread.${p.id}`, value: total[p.id] ?? 0, better: 'lower', headline: true })

    // ── Strength: placed around a sample of the race plans just generated ──
    const sN = STRENGTH_N[opts.mode]
    const runPlans = spread(strengthPool, sN.runPlans)
    // Production shape: strength setup sends no injury tags of its own (they come from the run plan).
    const profiles = spread(strengthProfileGrid().map(p => ({ ...p, injury_tags: [] })), sN.profiles)
    const sTotal: Record<string, number> = {}
    let sPlans = 0
    for (const g of runPlans) {
      const ctx = planToRunContext(g.plan)
      for (const prof of profiles) {
        const sp = generateStrengthPlan(prof, ctx)
        sPlans++
        for (const p of STRENGTH_PREDICATES) {
          const hit = p.test(sp, ctx, prof, g.input)
          if (hit) { bump(sTotal, p.id); const ex = (examples[p.id] ??= []); if (ex.length < 3) ex.push(`${label(g.input)} · ${prof.focus}/${prof.session_minutes}/${prof.sessions_per_week}x :: ${hit}`) }
        }
      }
    }
    lines.push({ id: 'planread.corpus.strength.plans', value: sPlans, better: 'stable' })
    for (const p of STRENGTH_PREDICATES) lines.push({ id: `planread.${p.id}`, value: sTotal[p.id] ?? 0, better: 'lower', headline: true })

    // ── Maintenance block: the read's option grid ──
    const mTotal: Record<string, number> = {}
    let blocks = 0, mThrown = 0
    for (const o of spread(maintenanceGrid(), MAINT_N[opts.mode])) {
      let weeks: Week[]
      try { weeks = generateMaintenanceBlock(o) } catch { mThrown++; continue }
      blocks++
      for (const p of MAINTENANCE_PREDICATES) {
        const hit = p.test(weeks, o)
        if (hit) { bump(mTotal, p.id); const ex = (examples[p.id] ??= []); if (ex.length < 3) ex.push(`${o.raceDistanceKm}km base${o.baseWeeklyKm} d${o.daysAvailable} ${o.intent} :: ${hit}`) }
      }
    }
    lines.push({ id: 'planread.corpus.maintenance.blocks', value: blocks, better: 'stable' },
      { id: 'planread.hard.maintenance.thrown', value: mThrown, better: 'zero', headline: true })
    for (const p of MAINTENANCE_PREDICATES) lines.push({ id: `planread.${p.id}`, value: mTotal[p.id] ?? 0, better: 'lower', headline: true })
  } finally {
    console.error = quiet; console.warn = warn
  }
  return { lines, examples, plansRead }
}

/** `planread/ramps/count_mb.ts`'s grid, with the run days a wizard week shape would give. */
const DAY_SETS: Record<number, MaintenanceBlockOptions['trainingDays']> = {
  2: ['wed', 'sun'], 3: ['tue', 'thu', 'sun'], 4: ['mon', 'wed', 'fri', 'sun'],
  5: ['mon', 'tue', 'thu', 'fri', 'sun'], 6: ['mon', 'tue', 'wed', 'thu', 'fri', 'sun'],
}
export function maintenanceGrid(): MaintenanceBlockOptions[] {
  const lastRaceWeek = { n: 16, date: '2027-03-08', label: 'Race', theme: '', type: 'race', sessions: {}, long_run_hrs: null, weekly_km: 30 } as unknown as Week
  const out: MaintenanceBlockOptions[] = []
  for (const intent of ['rest', 'tick_over', 'stay_sharp'] as const)
    for (const outcome of ['finished', 'dnf'] as const)
      for (const dist of [5, 10, 21.1, 42.2])
        for (const base of [8, 15, 25, 40, 60, 80])
          for (const days of [2, 3, 4, 5, 6])
            for (const inj of [[], ['knee'], ['achilles']])
              for (const withDays of [false, true])
                out.push({
                  raceResult: { outcome, finish_time: '1:00:00', distance_km: dist, date: '2027-03-14' } as MaintenanceBlockOptions['raceResult'],
                  lastRaceWeek, baseWeeklyKm: base, raceDistanceKm: dist, daysAvailable: days, injuryHistory: inj, intent,
                  ...(withDays ? { trainingDays: DAY_SETS[days] } : {}),
                })
  return out
}
