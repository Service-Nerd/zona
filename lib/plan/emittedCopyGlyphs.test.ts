import { describe, it, expect } from 'vitest'
import { cohortGrid, COHORT_PLAN_START } from './cohortGrid'
import { generateRulePlan } from './ruleEngine'
import type { Plan } from '@/types/plan'

// COPY-GLYPH-01 — typography rules, enforced on what the engine EMITS.
//
// `lib/marketing/noEmDash.test.ts` covers marketing SURFACES by reading source
// files. That cannot see the engine's runner-facing copy, which is assembled at
// generation time from templates and numbers — so `brand.md` has carried
// "Currently out of scope: the app" as a known gap, and BRAND-EMDASH-01 filed
// the right fix: guard the emitted copy, not the source.
//
// THE SECTION SYMBOL, founder-reported 2026-09-17. `§45` was reaching the Plan
// screen inside a "Why this plan" tile: *"week-on-week long-run cap (§45)
// prevented reaching the ratio."* A statute reference is how the constitution
// talks to US. It means nothing to a runner and reads as a glitch.
//
// ⚠️ WHY THIS READS GENERATED PLANS RATHER THAN SOURCE. A source grep cannot
// tell a doctrine reference in a comment (correct, wanted, ~259 of them) from
// one inside a runner-facing template, and it cannot see a string assembled
// from parts. Generating the plans answers the only question that matters:
// did a runner see it?

const STRIDE = 53

/** Every string a runner can read on a generated plan. */
function runnerStrings(plan: Plan): [string, string][] {
  const out: [string, string][] = []
  const yieldPair = (a: string, b: string) => out.push([a, b])
  for (const [k, v] of Object.entries(plan.meta ?? {})) {
    if (typeof v === 'string') yieldPair(`meta.${k}`, v)
  }
  for (const wk of plan.weeks ?? []) {
    if (typeof wk.theme === 'string') yieldPair(`week${wk.n}.theme`, wk.theme)
    if (typeof wk.label === 'string') yieldPair(`week${wk.n}.label`, wk.label)
    for (const [day, s] of Object.entries(wk.sessions ?? {})) {
      if (!s || typeof s !== 'object') continue
      for (const f of ['label', 'description', 'why', 'difficulty_note'] as const) {
        const v = (s as unknown as Record<string, unknown>)[f]
        if (typeof v === 'string') yieldPair(`w${wk.n}.${day}.${f}`, v)
      }
      for (const n of s.coach_notes ?? []) {
        if (typeof n === 'string') yieldPair(`w${wk.n}.${day}.coach_notes`, n)
      }
    }
  }
  return out
}

function scan(glyph: string): Map<string, string> {
  const grid = cohortGrid()
  const found = new Map<string, string>()
  for (let i = 0; i < grid.length; i += STRIDE) {
    let plan: Plan
    try { plan = generateRulePlan(grid[i], 'paid', COHORT_PLAN_START) } catch { continue }
    for (const [field, text] of runnerStrings(plan)) {
      if (!text.includes(glyph)) continue
      const key = field.replace(/^w\d+\.\w+\./, 'session.').replace(/^week\d+\./, 'week.')
      if (!found.has(key)) found.set(key, text.slice(0, 180))
    }
  }
  return found
}

describe('COPY-GLYPH-01 — the engine does not emit developer typography', () => {
  it('no runner-facing string contains a section symbol (§)', () => {
    const hits = scan('§')
    const report = Array.from(hits, ([f, s]) => `\n  ${f}\n    "${s}"`).join('')
    expect(hits.size, `§ reached a runner in ${hits.size} field(s):${report}\n\n` +
      'A § is a reference to OUR constitution. Say the rule in words, or say ' +
      'nothing — CoachingPrinciples is not a document the runner can open.').toBe(0)
  })

  // ⚠️ KNOWN OPEN, NOT A PASSING CLAIM. Em dashes are in 100% of plans (26,727
  // session labels alone, e.g. "Easy run — Zone 2"). The founder standard is
  // 2026-09-11 and brand.md records the app as out of scope; BRAND-EMDASH-01
  // holds the decision. This asserts the debt does not GROW while it is open,
  // the same register pattern as SWEEP-BASELINE-01. Re-baseline DOWN only.
  // RATCHET, not a tolerance: lower it whenever the count falls, or the debt
  // creeps back into the space it just vacated.
  //
  // ⚠️ 12 is THIS TEST'S OWN SCAN. A scratch probe said 11 and it was wrong —
  // it omitted `week.label`, and `meta.volume_constraint_note` still carries an
  // em dash in its prescription half ("give your weekday runs more room — you
  // have capped them at 60 minutes"), which the pending tile rewrite will take
  // out. Read the number from the failure message, never from a side count.
  const EM_DASH_FIELD_BASELINE = 12

  it('the em-dash debt does not grow while BRAND-EMDASH-01 is open', () => {
    const hits = scan('—')
    const report = Array.from(hits.keys()).sort().join(', ')
    expect(hits.size, `em dash now in ${hits.size} runner-facing fields ` +
      `(baseline ${EM_DASH_FIELD_BASELINE}): ${report}\n\n` +
      'A NEW field means new copy was written with an em dash. Fix the copy; ' +
      'do not raise the baseline. Lowering it is always welcome.')
      .toBeLessThanOrEqual(EM_DASH_FIELD_BASELINE)
  })
})
