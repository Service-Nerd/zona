/**
 * BLOCKED-DAYS-CHECKER-SPELLING-01 — the validator must read the spelling the
 * WIZARD sends, not the one the corpus happens to use.
 *
 * 🔴 THE DEFECT. `GeneratePlanScreen.tsx` maps day keys through `FULL_BY_SHORT`
 * before submitting, so `days_cannot_train` arrives as `['monday','tuesday',…]`.
 * Confirmed in production: 11 of 13 stored plans carry full names.
 * `invariants.ts` CAST that array to `Day[]` instead of converting it —
 * `'monday' as Day` type-checks and never equals `'mon'` — so the blocked-day
 * set inside `INV-PLAN-QUALITY-EXPECTED` was effectively empty for every real
 * runner, and that ERROR-severity invariant fired on plans that were correct.
 *
 * ⚠️ THE ENGINE WAS RIGHT THROUGHOUT (`ruleEngine.ts:806` calls the owner), so
 * the PLAN never differed — only the report on it. That is why it sat latent:
 * zero firings across 85 live plan-audit events.
 *
 * ⚠️ NO HARNESS COULD REACH IT. `cohortGrid` uses `['tue','thu']`, `['tue']`,
 * `[]` — short codes only, and it never blocks all five weekdays, which is the
 * only shape that diverges (3 of 420 swept cases). `verify-parity` does not vary
 * the field at all. **Fourth surface of "the code's spelling written down as if
 * it were the product's"**, after the injury predicate, the parity grid and the
 * API contract.
 *
 * ── WHY THE PLAN IS FORGED RATHER THAN GENERATED ────────────────────────────
 *
 * The only shape that diverges is a weekend-only runner, and that runner's plan
 * legitimately trips `INV-PLAN-QUALITY-NOT-ZERO` (§110/§1 — a 2-day runner gets
 * zero quality), so `generateRulePlan` THROWS under `NODE_ENV=test` before any
 * comparison can run — in BOTH spellings. Building the guard on a fixture that
 * throws for an unrelated reason would make it worthless, which is the argument
 * `userDeclaredLevel.test.ts` already records for its own forged-plan test.
 *
 * So: generate a real plan, strip its quality sessions to reach the state the
 * invariant judges, and call `validatePlan` twice with inputs differing ONLY in
 * how the same blocked days are spelled. That isolates the thing that changed.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { normaliseDays } from './days'
import type { GeneratorInput, Plan } from '@/types/plan'

const PLAN_START = '2026-09-14'
const SHORT = ['mon', 'tue', 'wed', 'thu', 'fri']
const FULL = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']

/** A runner who CAN generate cleanly, so the fixture exists at all. */
const CLEAN: GeneratorInput = {
  goal: 'finish', age: 40, resting_hr: 55, max_hr: 180, preferred_long_run_day: 'sun',
  race_date: '2026-12-06', race_distance_km: 21.1, current_weekly_km: 30,
  longest_recent_run_km: 12, days_available: 4, fitness_level: 'intermediate',
  injury_history: [],
} as unknown as GeneratorInput

/** The plan state the invariant judges: build/peak weeks carrying no quality. */
function planWithNoQuality(): Plan {
  const plan: Plan = JSON.parse(JSON.stringify(generateRulePlan(CLEAN, 'paid', PLAN_START)))
  let removed = 0
  for (const w of plan.weeks) {
    for (const [day, s] of Object.entries(w.sessions ?? {})) {
      if (s && s.type === 'quality') { delete (w.sessions as Record<string, unknown>)[day]; removed++ }
    }
  }
  // Guard the fixture, not just the assertion: with nothing removed the
  // comparison below would pass in every state and prove nothing.
  expect(removed, 'fixture carries no quality sessions to strip').toBeGreaterThan(0)
  return plan
}

const errorsFor = (plan: Plan, days_cannot_train: string[]) =>
  validatePlan(plan, { ...CLEAN, days_available: 2, days_cannot_train } as GeneratorInput)
    .filter(v => v.severity === 'error')

const codesOf = (vs: ReturnType<typeof errorsFor>) => vs.map(v => `${v.code}@${v.week}`).sort()

describe('the wizard sends full day names, and the validator must read them', () => {
  it('GeneratePlanScreen really does submit full names — read from source, not assumed', () => {
    const src = readFileSync('app/dashboard/GeneratePlanScreen.tsx', 'utf8')
    expect(src, 'the wizard no longer maps through FULL_BY_SHORT — this test rests on it')
      .toContain('week.restShort.map(k => FULL_BY_SHORT[k])')
    expect(src, 'FULL_BY_SHORT no longer maps mon -> monday').toContain("mon: 'monday'")
  })

  // 🔴 THE REGRESSION CASE. Red against the `as Day[]` cast, green on the fix.
  it('reports IDENTICALLY for both spellings of the same blocked days', () => {
    const plan = planWithNoQuality()
    expect(codesOf(errorsFor(plan, FULL)),
      'the wizard spelling must not report violations the corpus spelling does not',
    ).toEqual(codesOf(errorsFor(plan, SHORT)))
  })

  it('specifically: INV-PLAN-QUALITY-EXPECTED does not fire when every eligible day IS blocked', () => {
    const plan = planWithNoQuality()
    const fired = errorsFor(plan, FULL).filter(v => v.code === 'INV-PLAN-QUALITY-EXPECTED')
    expect(fired.length,
      'the runner blocked every eligible quality day, so placing 0 quality sessions is correct — '
      + 'firing here blames the engine for honouring the input',
    ).toBe(0)
  })

  it('and it DOES still fire when eligible days remain — the rule is intact, not disabled', () => {
    const plan = planWithNoQuality()
    const fired = errorsFor(plan, ['monday', 'tuesday']).filter(v => v.code === 'INV-PLAN-QUALITY-EXPECTED')
    expect(fired.length, 'wed/thu/fri are free, so zero quality IS a real violation').toBeGreaterThan(0)
  })
})

describe('day normalisation has ONE owner', () => {
  it('no engine file casts days_cannot_train instead of converting it', () => {
    const CAST = /days_cannot_train[^\n]*\bas\s+Day\[\]/
    const offenders: string[] = []
    for (const f of ['lib/plan/invariants.ts', 'lib/plan/ruleEngine.ts', 'lib/plan/foundationBlock.ts']) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (CAST.test(line)) offenders.push(`${f}:${i + 1}  ${line.trim()}`)
      })
    }
    expect(offenders, `casts days_cannot_train instead of calling normaliseDays:\n${offenders.join('\n')}`)
      .toEqual([])
  })

  it('invariants.ts holds no second day lookup table', () => {
    expect(readFileSync('lib/plan/invariants.ts', 'utf8'),
      'a local full-name map is a second parser that can drift from lib/plan/days.ts',
    ).not.toContain('FULL_TO_SHORT_DAY')
  })

  it('the deleted local mirror was WEAKER than the owner — the case it lost', () => {
    // `parseBlockedDays` did not trim, so a padded value normalised to nothing.
    // Recorded so the improvement is visible rather than asserted.
    expect(Array.from(normaliseDays(['  monday  ']))).toEqual(['mon'])
  })
})
