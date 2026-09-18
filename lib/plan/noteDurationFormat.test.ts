import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { generateRulePlan } from './ruleEngine'
import { composePlanWithFoundation } from './foundationCompose'
import { cohortGrid, COHORT_PLAN_START, COHORT_REFUSAL } from './cohortGrid'

// ADR-015 / INV-FMT-001 — a plan NOTE is a display surface.
//
// `lib/format.ts` owns every duration a runner reads and the rule is locked:
// under 60 minutes reads "45 min", at or above it reads in hours ("3h 28").
// The engine's constraint notes ignored it and printed raw minute counts.
// MEASURED on 2026-09-18, before the fix, across 35,952 plans from both grids:
// 29,624 notes carried 42,444 minute values, 48.2% of them >= 60, the largest
// 338 ("moving for around 338 minutes" — 5h 38). The founder read one on his
// own London Marathon plan and it was the first thing he noticed.
//
// Two checks, because either alone is weak: the STATIC scan is precise and
// fails at the moment someone writes it, the LIVE one proves the formatter is
// actually in the path of what ships. The live one asserts a floor on how many
// notes it saw, because a guard that passes because nothing generated is this
// repo's SWEEP-VACUOUS-01 all over again.

const RAW_MINUTES = /\$\{[^}]*\}\s*-?\s*minutes?\b/

describe('plan notes never print raw minutes (ADR-015)', () => {
  it('no template literal in the engine puts an interpolation next to "minutes"', () => {
    const src = readFileSync(join(process.cwd(), 'lib/plan/ruleEngine.ts'), 'utf8')
    const offenders: string[] = []
    // Template literals only; a comment mentioning "${x} minutes" is not copy.
    for (const m of Array.from(src.matchAll(/`(?:[^`\\]|\\.)*`/g))) {
      const lit = m[0]
      if (!RAW_MINUTES.test(lit)) continue
      // A RANGE in the sub-hour band reads naturally and is not a duration of a
      // run: "Fuel every 20–25 minutes". formatDuration would give
      // "20 min–25 min", which is worse. Deliberate, and narrow.
      if (/every \$\{[^}]*\}[–-]\$\{[^}]*\} minutes/.test(lit)) continue
      offenders.push(`${src.slice(0, m.index).split('\n').length}: ${lit.slice(0, 90)}`)
    }
    expect(
      offenders,
      'route it through durationText()/formatDuration — the rule is <60 "45 min", >=60 "3h 28":\n  ' +
      offenders.join('\n  ')
    ).toEqual([])
  })

  it('generated notes read in hours past the hour, and still exist', () => {
    // A deterministic slice: enough to hit the constraint notes, small enough
    // to belong in the unit suite.
    const inputs = cohortGrid().filter((_, i) => i % 37 === 0)
    const notes: string[] = []
    for (const input of inputs) {
      let plan
      try {
        const raw = generateRulePlan(input, 'trial', COHORT_PLAN_START, undefined, COHORT_PLAN_START)
        plan = composePlanWithFoundation(raw, input, COHORT_PLAN_START, 'add').plan
      } catch (e: any) {
        if (COHORT_REFUSAL.test(e?.message ?? '')) continue
        throw e
      }
      for (const v of Object.values(plan.meta ?? {})) {
        if (typeof v === 'string' && v.length > 60) notes.push(v)
      }
    }

    // Anti-vacuous: this test is worthless if the grid stopped producing notes.
    expect(notes.length, 'no notes generated — this check would pass on nothing').toBeGreaterThan(50)

    const raw = notes.filter(n => /\d\s*-?\s*minutes?\b/.test(n))
    expect(raw.slice(0, 3), `${raw.length} note(s) still print raw minutes`).toEqual([])

    // Proof the formatter is in the path, not just that the word is absent.
    expect(notes.some(n => /\b\d+h(\s\d{2})?\b/.test(n)), 'no note rendered an hours duration').toBe(true)
  })
})
