import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { generateRulePlan } from '@/lib/plan/ruleEngine'
import { validatePlan } from '@/lib/plan/invariants'
import type { Plan, GeneratorInput } from '@/types/plan'
import type { Tier } from '@/lib/plan/ruleEngine'

// DASHBOARD-HARNESS-01 — the fixture cannot silently stop being real engine output.
//
// 🔴 WHY THIS FILE EXISTS. A committed JSON fixture is a photograph. The engine keeps
// moving — this repo changed what it prescribes several times this month alone — and a
// photograph does not go red when the subject changes. Left alone, `/copy-preview` would
// drift into showing screens filled with a plan no current engine would produce, which is
// exactly the hand-authored-fixture defect (`'Shin splints'` vs `'shin_splints'`) arriving
// by a slower route.
//
// So the fixture is re-derived here and compared. When the engine legitimately changes,
// this fails and the fix is one command:
//
//     npx tsx scripts/build-harness-fixture.ts
//
// ⚠️ Regenerating is the RIGHT response to a red here. Editing the JSON by hand is not.

const CASE_ID = '8333720c'
const ROOT = join(__dirname, '..', '..', '..')

const corpus = JSON.parse(
  readFileSync(join(ROOT, 'lib/plan/__fixtures__/real-inputs.json'), 'utf8'),
) as { cases: Array<{ id: string; input: GeneratorInput; tier: string; plan_start: string }> }

const committed = JSON.parse(
  readFileSync(join(__dirname, 'harnessPlan.json'), 'utf8'),
) as Plan

describe('DASHBOARD-HARNESS-01 — the harness plan is real engine output', () => {
  it('the source case still exists in the real-input corpus', () => {
    // The corpus is refreshed from production. If this case is ever dropped, the fixture
    // loses its provenance and quietly becomes hand-authored data nobody chose.
    const c = corpus.cases.find(x => x.id === CASE_ID)
    expect(c, `case ${CASE_ID} has left real-inputs.json — pick another and regenerate`)
      .toBeTruthy()
  })

  // 🔴 `meta.generated_at` IS A WALL CLOCK AND MUST BE STRIPPED FROM THE COMPARISON,
  // NOT FROM THE FIXTURE. `verify:parity` has this exact note: its first version reported
  // all 2,592 plans as changed because of this one field. Stripping it from the stored
  // JSON instead would make the fixture a thing the engine never emitted, which is the
  // defect this whole file exists to prevent — so the fixture keeps it and the comparison
  // ignores it.
  const withoutClock = (p: Plan) => {
    const copy = JSON.parse(JSON.stringify(p)) as Plan & { meta?: Record<string, unknown> }
    if (copy.meta) delete copy.meta.generated_at
    return copy
  }

  it('regenerating from that input reproduces the committed fixture exactly', () => {
    const c = corpus.cases.find(x => x.id === CASE_ID)!
    const fresh = generateRulePlan(c.input, c.tier as Tier, c.plan_start)
    expect(
      withoutClock(fresh),
      'the engine no longer produces this plan. Regenerate:\n' +
        '  npx tsx scripts/build-harness-fixture.ts\n' +
        'Do NOT hand-edit harnessPlan.json.',
    ).toEqual(withoutClock(committed))
  })

  it('and the committed fixture passes the engine’s own constitution', () => {
    // 🔴 Asserted against the COMMITTED json, not the freshly generated plan. Checking the
    // fresh one would only prove the engine validates its own output, which
    // `generateRulePlan` already does. The question here is whether the thing the harness
    // actually renders is a valid plan.
    const c = corpus.cases.find(x => x.id === CASE_ID)!
    const errors = validatePlan(committed, c.input).filter(v => v.severity === 'error')
    expect(errors.map(e => e.message), 'the harness renders an invalid plan').toEqual([])
  })

  it('is substantial enough to exercise a screen', () => {
    // An empty or one-week plan would mount every screen and show nothing, which passes
    // every assertion above while making the harness useless.
    expect(committed.weeks.length, 'weeks').toBeGreaterThanOrEqual(8)
    const sessions = committed.weeks.flatMap(w => Object.values(w.sessions ?? {}))
    expect(sessions.length, 'sessions').toBeGreaterThan(20)
    expect(new Set(sessions.map(s => s?.type)).size, 'distinct session types')
      .toBeGreaterThan(2)
  })
})
