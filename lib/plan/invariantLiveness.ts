import { generateRulePlan } from '@/lib/plan/ruleEngine'
import { validatePlan, INVARIANT_CODES } from '@/lib/plan/invariants'
import { cohortGrid, COHORT_PLAN_START } from '@/lib/plan/cohortGrid'
import type { GeneratorInput, Plan, Session } from '@/types/plan'

/**
 * INVARIANT LIVENESS — can each rule still be made to fail? (test-coverage #5)
 *
 * `verify:invariants` proves every invariant is registered, declared, and passes
 * on three canonical cases. That is a check that they do not FALSE-fire. Nothing
 * proved the opposite and more important property: **that a rule can fire at
 * all.** An invariant that cannot be made to fail is not a safety net, it is a
 * green tick with nothing behind it — and this repo has shipped that exact thing
 * before (`--section-gap`, the decorative config family, D9's `flexShrink` that
 * never fired, §97's two inert gates).
 *
 * ⚠️ "NEVER FIRES ON A VALID PLAN" IS NOT THE SIGNAL, and reading it that way
 * would have been the wrong answer. Measured 2026-09-11: **86 of 93 invariants
 * never fire across 621 generated plans** — which is exactly what a healthy
 * engine looks like. A silent invariant is indistinguishable from a dead one
 * until you try to break the thing it guards.
 *
 * So this deliberately BREAKS valid plans, in ways the engine would never
 * produce, and records which rules wake up. A rule no mutation can wake is not
 * proven dead — it is UNPROVEN, and lands in the baseline with a reason:
 *
 *   corpus       the harness never builds this plan SHAPE (maintenance blocks
 *                have their own generator; foundation, recalibration and ultra
 *                paths are not in the cohort grid). Not a defect in the check.
 *   mutation     the battery does not yet perturb the field this rule reads.
 *                Add a mutation, not a fixture.
 *   unclassified nobody has looked yet. **This is the column that should shrink.**
 *
 * The baseline can only shrink — a NEW invariant that nothing can wake fails the
 * build, so the next one has to prove itself on the way in. Same debt-register
 * pattern as SWEEP-BASELINE-01, for the same reason: an unanswerable 93-item
 * audit becomes a tracked list that gets shorter.
 */

const clone = (p: Plan): Plan => JSON.parse(JSON.stringify(p))
const sessionsOf = (p: Plan) => p.weeks.flatMap(w => Object.values(w.sessions ?? {}).filter(Boolean) as Session[])
const realWeeks = (p: Plan) => p.weeks.filter(w => w.n > 0)
const anyOf = (p: Plan) => sessionsOf(p)[0]
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

type Poke = Record<string, unknown>

export interface Mutation { name: string; apply: (p: Plan) => void }

/** Ways to break a plan that the engine would never produce. */
export const MUTATIONS: Mutation[] = [
  { name: 'zero every distance',       apply: p => sessionsOf(p).forEach(s => { (s as unknown as Poke).distance_km = null }) },
  { name: 'zero every duration',       apply: p => sessionsOf(p).forEach(s => { (s as unknown as Poke).duration_mins = null }) },
  { name: 'halve every duration',      apply: p => sessionsOf(p).forEach(s => { const d = (s as unknown as {duration_mins?:number}).duration_mins; if (d) (s as unknown as Poke).duration_mins = Math.round(d / 2) }) },
  { name: 'treble every duration',     apply: p => sessionsOf(p).forEach(s => { const d = (s as unknown as {duration_mins?:number}).duration_mins; if (d) (s as unknown as Poke).duration_mins = d * 3 }) },
  { name: 'strip pace_target',         apply: p => sessionsOf(p).forEach(s => { delete (s as unknown as Poke).pace_target }) },
  { name: 'strip coach_notes',         apply: p => sessionsOf(p).forEach(s => { delete (s as unknown as Poke).coach_notes }) },
  { name: 'strip derived_set',         apply: p => sessionsOf(p).forEach(s => { delete (s as unknown as Poke).derived_set }) },
  { name: 'strip catalogue_id',        apply: p => sessionsOf(p).forEach(s => { delete (s as unknown as Poke).catalogue_id }) },
  { name: 'strip labels',              apply: p => sessionsOf(p).forEach(s => { (s as unknown as Poke).label = '' }) },
  { name: 'strip zone',                apply: p => sessionsOf(p).forEach(s => { delete (s as unknown as Poke).zone }) },
  { name: 'strip stimulus',            apply: p => sessionsOf(p).forEach(s => { delete (s as unknown as Poke).stimulus }) },
  { name: 'placeholder copy',          apply: p => sessionsOf(p).forEach(s => { (s as unknown as Poke).coach_notes = ['TODO', 'TBD']; (s as unknown as Poke).label = 'TBD' }) },
  { name: 'all sessions quality',      apply: p => sessionsOf(p).forEach(s => { (s as unknown as Poke).type = 'quality' }) },
  { name: 'all sessions easy',         apply: p => sessionsOf(p).forEach(s => { (s as unknown as Poke).type = 'easy' }) },
  { name: 'all sessions race',         apply: p => sessionsOf(p).forEach(s => { (s as unknown as Poke).type = 'race' }) },
  { name: 'all sessions hills',        apply: p => sessionsOf(p).forEach(s => { (s as unknown as Poke).label = 'Hill reps'; (s as unknown as Poke).stimulus = 'hills' }) },
  { name: 'long run 90% of week',      apply: p => realWeeks(p).forEach(w => { const l = Object.values(w.sessions ?? {}).find(Boolean) as Session | undefined; if (l) (l as unknown as Poke).distance_km = w.weekly_km * 0.9 }) },
  { name: 'long run +300% wk/wk',      apply: p => realWeeks(p).forEach((w, i) => { const l = Object.values(w.sessions ?? {}).find(Boolean) as Session | undefined; if (l) (l as unknown as Poke).distance_km = 5 * Math.pow(4, Math.min(i, 4)) }) },
  { name: 'every session 0.2km',       apply: p => sessionsOf(p).forEach(s => { (s as unknown as Poke).distance_km = 0.2; (s as unknown as Poke).duration_mins = 2 }) },
  { name: 'every session 60km',        apply: p => sessionsOf(p).forEach(s => { (s as unknown as Poke).distance_km = 60; (s as unknown as Poke).duration_mins = 400 }) },
  { name: 'weekly_km = 0',             apply: p => realWeeks(p).forEach(w => { w.weekly_km = 0 }) },
  { name: 'weekly_km x5',              apply: p => realWeeks(p).forEach(w => { w.weekly_km = w.weekly_km * 5 }) },
  { name: 'invert the volume curve',   apply: p => { const ws = realWeeks(p); const v = ws.map(w => w.weekly_km).reverse(); ws.forEach((w, i) => { w.weekly_km = v[i]! }) } },
  { name: 'deload bigger than prior',  apply: p => realWeeks(p).forEach((w, i, a) => { if (w.type === 'deload' && i > 0) w.weekly_km = a[i - 1]!.weekly_km * 1.5 }) },
  { name: 'no deload weeks',           apply: p => realWeeks(p).forEach(w => { if (w.type === 'deload') (w as unknown as Poke).type = undefined }) },
  { name: 'every week is peak',        apply: p => realWeeks(p).forEach(w => { (w as unknown as Poke).phase = 'peak' }) },
  { name: 'every week is base',        apply: p => realWeeks(p).forEach(w => { (w as unknown as Poke).phase = 'base' }) },
  { name: 'every week is taper',       apply: p => realWeeks(p).forEach(w => { (w as unknown as Poke).phase = 'taper' }) },
  { name: 'seven sessions a week',     apply: p => realWeeks(p).forEach(w => { const s = anyOf(p); if (s) for (const d of DAYS) (w.sessions as unknown as Poke)[d] = JSON.parse(JSON.stringify(s)) }) },
  { name: 'empty every week',          apply: p => realWeeks(p).forEach(w => { (w as unknown as Poke).sessions = {} }) },
  { name: 'one catalogue row only',    apply: p => sessionsOf(p).forEach(s => { (s as unknown as Poke).catalogue_id = 'tempo_continuous' }) },
  { name: 'drop volume_profile',       apply: p => { delete (p.meta as unknown as Poke).volume_profile } },
  { name: 'force volume_profile build', apply: p => { (p.meta as unknown as Poke).volume_profile = 'build' } },
  { name: 'drop constraint note',      apply: p => { delete (p.meta as unknown as Poke).volume_constraint_note } },
  { name: 'drop every meta note',      apply: p => { for (const k of Object.keys(p.meta as unknown as Poke)) if (/note|status|annotat/i.test(k)) delete (p.meta as unknown as Poke)[k] } },
  { name: 'drop vdot',                 apply: p => { delete (p.meta as unknown as Poke).vdot } },
  { name: 'vdot raw below anchor',     apply: p => { (p.meta as unknown as Poke).vdot = 1 } },
  { name: 'drop goal pace',            apply: p => { delete (p.meta as unknown as Poke).goal_pace_per_km } },
  { name: 'drop max_hr',               apply: p => { delete (p.meta as unknown as Poke).max_hr } },
  { name: 'truncate to 2 weeks',       apply: p => { p.weeks = p.weeks.slice(0, 2) } },
  { name: 'duplicate week 1 x20',      apply: p => { p.weeks = Array.from({ length: 20 }, () => JSON.parse(JSON.stringify(p.weeks[0]))) } },
  { name: 'drop the race week',        apply: p => { p.weeks = p.weeks.filter(w => w.type !== 'race') } },
]

export interface LivenessReport {
  woken: Map<string, string>
  unwoken: string[]
  plansProbed: number
}

/** Break `sampleSize` valid plans every way we know, and see what wakes up. */
export function probeLiveness(sampleSize = 14): LivenessReport {
  const sample: { input: GeneratorInput; plan: Plan }[] = []
  for (const input of cohortGrid()) {
    if (sample.length >= sampleSize) break
    try {
      sample.push({
        input: input as GeneratorInput,
        plan: generateRulePlan(input as GeneratorInput, 'trial', COHORT_PLAN_START, undefined, COHORT_PLAN_START),
      })
    } catch { /* a refusal is the engine working */ }
  }

  const woken = new Map<string, string>()
  for (const { input, plan } of sample) {
    for (const v of validatePlan(plan, input)) if (!woken.has(v.code)) woken.set(v.code, 'fires on a valid plan')
    for (const m of MUTATIONS) {
      const p = clone(plan)
      try { m.apply(p) } catch { continue }
      let vs
      try { vs = validatePlan(p, input) } catch { continue }   // a throw is not a wake
      for (const v of vs) if (!woken.has(v.code)) woken.set(v.code, m.name)
    }
  }
  const unwoken = (INVARIANT_CODES as readonly string[]).filter(c => !woken.has(c))
  return { woken, unwoken, plansProbed: sample.length }
}
