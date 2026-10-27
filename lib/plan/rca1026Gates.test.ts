// RCA-1026 prevention (docs/investigations/2026-10-26-coach-engine-digest-rca.md § So it doesn't happen again, gate 2).
// Every defect in the 26 Oct ops report was a fix applied to ONE member of a family and missed on the rest: the goal-pace
// cap on one HM row, the §9 floor in 2 of 4 shape builders, the overrun note on structured sessions only. These gates
// enumerate each family from the code, so a new member fails the build until it is covered or its gap is named here.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runEngine } from './engine'
import { V1_SESSION_CATALOGUE, requiredPaceAnchors } from './sessionCatalogueData'
import { slowGoalDates, slowGoalGrid } from './slowGoalGrid'
import type { GeneratorInput, Plan } from '@/types/plan'

/** Source with comments blanked, so a builder cannot pass by NAMING the owner in a comment. */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')

describe('gate 2b — every quality shape builder sizes its session through the §9 floor owner', () => {
  const src = readFileSync(join(__dirname, 'ruleEngine.ts'), 'utf8')
  // The family, derived: every top-level `function xxxPlan(` in the engine except the entry point.
  const starts = Array.from(src.matchAll(/^(?:export )?function (\w+Plan)\(/gm)).filter(m => m[1] !== 'generateRulePlan')
  const body = (i: number) => src.slice(starts[i].index!, src.indexOf('\nfunction ', starts[i].index! + 10) > 0
    ? Math.min(...[src.indexOf('\nfunction ', starts[i].index! + 10), src.indexOf('\nexport function ', starts[i].index! + 10)].filter(n => n > 0))
    : src.length)
  const builders = starts.map((m, i) => ({ name: m[1], usesOwner: /\bmeetsQualityFloor\(/.test(code(body(i))) }))

  /** Builders that do NOT go through `meetsQualityFloor`, each with why. Their sessions pass INV-PLAN-MIN-SESSION-SIZE
   *  today only because the check accepts 35 minutes; nothing grows them to the floor. A fixed entry must be removed. */
  const DEBT: Record<string, string> = {
    progressiveTempoPlan: 'S9-QUALITY-FLOOR-REACH-01 (1): growing it was built and reverted; it changed 177 unmeasured plans',
    fixedShapePlan: 'S9-QUALITY-FLOOR-REACH-01 (pyramid): the 26 Oct report named it beside progressive tempo; not grown either',
    effortGovernedPlan: 'S9-QUALITY-FLOOR-REACH-01 (hills): effort-governed, no pace to price a km floor; unruled',
  }

  it('the family is the one the code has (five builders as of 2026-10-27)', () => {
    expect(builders.map(b => b.name).sort()).toEqual(
      ['continuousThresholdPlan', 'effortGovernedPlan', 'fixedShapePlan', 'pacedRepPlan', 'progressiveTempoPlan'])
  })
  it('🔴 every builder uses the owner, or is named here with its reason', () => {
    for (const b of builders) if (!b.usesOwner) expect(DEBT[b.name], `${b.name} sizes nothing through meetsQualityFloor`).toBeTruthy()
  })
  it('🔴 and an entry is removed when its builder is fixed (the list only shrinks)', () => {
    for (const name of Object.keys(DEBT)) {
      const b = builders.find(x => x.name === name)
      expect(b, `${name} no longer exists`).toBeTruthy()
      expect(b!.usesOwner, `${name} now uses the owner: remove it from DEBT`).toBe(false)
    }
  })
})

describe('gate 2a — every goal-anchored session row is reached, so "none past the line" is not vacuous', () => {
  const { planStart, benchmarkDate } = slowGoalDates()
  const today = new Date(Date.parse(`${planStart}T00:00:00Z`) - 7 * 864e5).toISOString().slice(0, 10)
  // The family, derived from the catalogue: every row whose work is anchored to the goal or HM pace.
  const ROWS = V1_SESSION_CATALOGUE.filter(r => requiredPaceAnchors(r).some(a => a === 'goal' || a === 'HM')).map(r => r.id)
  // Inside the line (goal at current fitness): where a goal-anchored row SHOULD appear. Built once.
  const seen = new Map<string, number>(ROWS.map(r => [r, 0]))
  for (const c of slowGoalGrid(planStart, benchmarkDate).filter(c => c.gap === 0)) {
    const { gap, ...input } = c
    const o = runEngine({ input: input as unknown as GeneratorInput, tier: 'paid', displayUnits: 'km', planStart, today })
    if (o.kind === 'refusal') continue
    for (const w of (o.plan as Plan).weeks) for (const s of Object.values(w.sessions)) {
      const id = (s as { catalogue_id?: string } | undefined)?.catalogue_id
      if (id && seen.has(id)) seen.set(id, seen.get(id)! + 1)
    }
  }
  /** Rows the slow grid never generates, so goalPaceReach.test.ts's past-the-line assertion proves nothing for them. */
  const UNREACHED: Record<string, string> = {
    beginner_goal_pace_reps: 'GRID-GOAL-INSIDE-LINE-01: no slow-grid case selects it (5K/10K beginner reps)',
    tenk_race_simulation: 'GRID-GOAL-INSIDE-LINE-01: no slow-grid case selects it',
  }

  it('the family is non-empty and derived (seven rows as of 2026-10-27)', () => expect(ROWS.length).toBe(7))
  it('🔴 every goal-anchored row is generated inside the line, or named here with its reason', () => {
    for (const r of ROWS) if (!seen.get(r)) expect(UNREACHED[r], `${r} is never generated on the slow grid`).toBeTruthy()
  })
  it('🔴 and an entry is removed once the grid reaches it (the list only shrinks)', () => {
    for (const r of Object.keys(UNREACHED)) {
      expect(ROWS.includes(r), `${r} is no longer goal-anchored`).toBe(true)
      expect(seen.get(r), `${r} is reached now: remove it from UNREACHED`).toBe(0)
    }
  })
})
