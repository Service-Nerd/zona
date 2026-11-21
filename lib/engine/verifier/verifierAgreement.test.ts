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
import { describe, it, expect, beforeAll } from 'vitest'
import { goldenSample } from '@/lib/corpus/goldenCorpus'
import { runEngine } from '@/lib/plan/engine'
import { validatePlan } from '@/lib/plan/invariants'
import { MUTATIONS } from '@/lib/plan/invariantLiveness'
import type { Plan, GeneratorInput } from '@/types/plan'
import { RULES } from '@/lib/engine/catalogue/rules'
import { verifyPlan, PORTED_RULES } from './verifyPlan'

const clone = (p: Plan): Plan => JSON.parse(JSON.stringify(p))
const key = (rule: string, week: number, day: string | null | undefined, sev: string) => `${rule}|${week}|${day ?? '-'}|${sev}`

/** Breakages the shared liveness battery does not make, added for a ported rule it cannot wake. Kept here,
 *  not in `invariantLiveness.ts`, so the liveness baseline does not move under this work. */
const EXTRA_MUTATIONS: { name: string; apply: (p: Plan) => void }[] = [
  { name: 'duration-anchored session loses its minutes', apply: p => {
    for (const w of p.weeks) for (const s of Object.values(w.sessions ?? {})) {
      if (s && s.type === 'easy') { s.duration_anchored = true; s.duration_mins = undefined; return }
    }
  } },
  // The weekday-time boundary: one minute over the runner's own limit. Without it, a check loosened by a
  // minute stayed green, because no battery mutation lands near the line (falsified 2026-11-21).
  ...([false, true] as const).map(foundation => ({
    name: `a ${foundation ? 'foundation' : 'main'}-week weekday easy run one minute over its limit`,
    apply: (p: Plan) => {
    const gi = (p.meta as { generator_input?: GeneratorInput }).generator_input
    for (const w of p.weeks.filter(x => foundation ? x.n <= 0 : x.n > 0)) for (const d of ['mon', 'tue', 'wed', 'thu', 'fri'] as const) {
      const cap = gi?.day_budgets?.[d] ?? gi?.max_weekday_mins
      const s = w.sessions?.[d]
      if (cap == null || !s || s.type !== 'easy' || s.floor_protected || !s.duration_mins) continue
      s.duration_mins = cap + 1
      return
    }
  } })),
]

const tally = { rows: 0, threw: [] as string[], refused: 0, base: 0, foundation: 0 }
let runs: { label: string; old: { rule: string; k: string }[]; new: { rule: string; k: string }[] }[] = []

beforeAll(() => {
  const cases: { label: string; plan: Plan; input: GeneratorInput }[] = []
  for (const row of goldenSample({ perGroup: 8 })) {
    tally.rows++
    let o: ReturnType<typeof runEngine>
    // Under test the engine throws on its own error-severity violations. Counted, never hidden.
    try {
      o = runEngine({ input: row.input, tier: row.tier, displayUnits: 'km', planStart: row.planStart, today: row.asOf })
    } catch { tally.threw.push(row.id); continue }
    if (o.kind !== 'plan') { tally.refused++; continue }
    tally.base++
    if (o.plan.weeks.some(w => w.n <= 0)) tally.foundation++
    cases.push({ label: row.id, plan: o.plan, input: row.input })
    for (const m of [...MUTATIONS, ...EXTRA_MUTATIONS]) {
      const p = clone(o.plan)
      try { m.apply(p) } catch { continue }
      cases.push({ label: `${row.id} / ${m.name}`, plan: p, input: row.input })
    }
  }
  runs = cases.flatMap(c => {
    let old: ReturnType<typeof validatePlan>
    // Only the OLD checker may be excused: a mutation it cannot read is not a comparison. A verifier throw
    // is not caught here, so it fails the file.
    try { old = validatePlan(c.plan, c.input) } catch { return [] }
    return [{ label: c.label,
      old: old.map(v => ({ rule: v.code, k: key(v.code, v.week, v.day, v.severity) })),
      new: verifyPlan(c.plan, { input: c.input }).map(f => ({ rule: f.rule_id as string, k: key(f.rule_id, f.week, f.day, f.severity) })) }]
  })
}, 120_000)

function compare(rule: string) {
  const fired = { old: 0, new: 0 }
  const diffs: string[] = []
  for (const c of runs) {
    const oldKeys = c.old.filter(x => x.rule === rule).map(x => x.k)
    const newKeys = c.new.filter(x => x.rule === rule).map(x => x.k)
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
    expect(tally.base + tally.refused + tally.threw.length).toBe(tally.rows)
    expect(tally.threw.length, tally.threw.slice(0, 3).join(', ')).toBeLessThanOrEqual(Math.ceil(tally.rows / 10))
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
