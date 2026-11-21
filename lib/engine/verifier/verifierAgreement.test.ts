// ADR027-B3-VERIFIER — each ported rule agrees with `validatePlan`, finding for finding.
//
// 🔑 TWO POPULATIONS, because one cannot show agreement on its own:
//   · VALID plans from the golden corpus (the wizard's own answer space). An engine plan is meant to be
//     silent, so this proves the verifier raises nothing the old checker does not (no false positives).
//   · BROKEN plans: the liveness battery's mutations applied to those plans. This is where the rules FIRE,
//     so this proves the verifier catches what the old checker catches.
// The comparison is a multiset of (rule, week, day). An arm also asserts each ported rule fired at least
// once, because two checkers that both say nothing agree perfectly and prove nothing.
import { describe, it, expect } from 'vitest'
import { goldenSample } from '@/lib/corpus/goldenCorpus'
import { runEngine } from '@/lib/plan/engine'
import { validatePlan } from '@/lib/plan/invariants'
import { MUTATIONS } from '@/lib/plan/invariantLiveness'
import type { Plan, GeneratorInput } from '@/types/plan'
import { verifyPlan, PORTED_RULES } from './verifyPlan'

const clone = (p: Plan): Plan => JSON.parse(JSON.stringify(p))
const key = (rule: string, week: number, day: string | null | undefined) => `${rule}|${week}|${day ?? '-'}`

const cases: { label: string; plan: Plan; input: GeneratorInput }[] = []
/** Rows the engine itself throws on under test (it refuses its own error-severity violations there).
 *  Counted, not hidden: they are engine defects the old checker already reports, not comparisons. */
const engineThrew: string[] = []
for (const row of goldenSample({ perGroup: 2 })) {
  let o: ReturnType<typeof runEngine>
  try {
    o = runEngine({ input: row.input, tier: row.tier, displayUnits: 'km', planStart: row.planStart, today: row.asOf })
  } catch { engineThrew.push(row.id); continue }
  if (o.kind !== 'plan') continue
  cases.push({ label: row.id, plan: o.plan, input: row.input })
  for (const m of MUTATIONS) {
    const p = clone(o.plan)
    try { m.apply(p) } catch { continue }
    cases.push({ label: `${row.id} / ${m.name}`, plan: p, input: row.input })
  }
}

// Both checkers run ONCE per plan; each rule's arm filters the cached results.
const runs = cases.flatMap(c => {
  try {
    return [{ label: c.label,
      old: validatePlan(c.plan, c.input).map(v => ({ rule: v.code, k: key(v.code, v.week, v.day) })),
      new: verifyPlan(c.plan, { input: c.input }).map(f => ({ rule: f.rule_id as string, k: key(f.rule_id, f.week, f.day) })) }]
  } catch { return [] }   // a mutation the old checker cannot even read is not a comparison
})

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
  it('the corpus produced plans to compare', () => {
    expect(cases.length).toBeGreaterThan(100)
    // Stated, so a rise is seen: rows the engine refuses to build under test.
    expect(engineThrew.length, engineThrew.slice(0, 3).join(', ')).toBeLessThan(cases.length / 10)
  })

  for (const rule of PORTED_RULES) {
    it(`🔴 ${rule}: same findings on every valid and broken plan, and it fires`, () => {
      const { fired, diffs } = compare(rule)
      expect(diffs.slice(0, 5), `${diffs.length} disagreements`).toEqual([])
      expect(fired.old, 'nothing in the battery wakes this rule, so agreement proves nothing').toBeGreaterThan(0)
    })
  }
})
