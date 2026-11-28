// ARCH-ENG-001 for L3 — ONE boundary arm, ONE allow-list, globbed population.
//
// 🔴 THERE WERE FOUR HAND-TYPED COPIES OF THIS CHECK WITH FOUR MUTUALLY INCONSISTENT ALLOW-LISTS,
// one added by each of B4a–B4d, each widened only enough for its own module. Code review falsified
// the result: a new `lib/engine/planner/__reviewProbe.ts` importing `@/lib/plan/ruleEngine` passed
// **all four planner suites, 50/50 green**. Four copies of a guard are not four guards.
//
// This is `DELOAD-OWNER-01`'s own lesson applied to a test: the thing being checked has one answer,
// so the check has one owner. The population is globbed from git, never listed.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

/**
 * What L3 may reach DOWN to. Every entry is a module the HLD names as becoming "L3's metrics owner,
 * used by the planner and the verifier alike", or L2 config that a rule REFERENCES (ARCH-ENG-003).
 * ⚠️ Adding to this list is a decision: it widens what the strangler permits. Reaching
 * `ruleEngine.ts` or `invariants.ts` is what it exists to forbid — that is the old planner, and an
 * L3 module importing it has no grip on anything.
 */
const ALLOWED = [
  '@/lib/plan/generationConfig',   // L2 data (ARCH-ENG-003)
  '@/lib/plan/deloadCadence',      // §87's cadence owner — HLD: becomes L3's metrics owner
  '@/lib/plan/sessionDistance',    // SESSION-KM-01's owner
  '@/lib/plan/sessionRole',        // isLongRun / isStructuredSession — the classifiers
  '@/lib/plan/sessionFloors',      // §82's floor owner
  '@/lib/plan/weekdayOverrunNote', // weekdayBudgetFor — one owner shared with the note
  '@/lib/plan/days',               // the Day type
  '@/lib/plan/paceBands',          // the PaceGuide type
] as const

describe('ARCH-ENG-001 — L3 depends downward only', () => {
  // ⚠️ FROM GIT, NOT `readdirSync`. A directory listing includes untracked scratch files: code
  // review verified that restoring an equivalence probe took the look-alike count 8 → 9 and
  // produced a wrong diagnosis ("add a THIRTEENTH to the docstring"). A probe is never a module.
  const modules = execSync("git ls-files 'lib/engine/planner/*.ts'", { cwd: process.cwd(), encoding: 'utf8' })
    .trim().split('\n').filter(f => f && !f.endsWith('.test.ts'))

  it('the population comes from git and is not empty', () => {
    expect(modules.length, 'no tracked L3 modules found — every arm below would be vacuous').toBeGreaterThanOrEqual(4)
    expect(modules.every(m => m.startsWith('lib/engine/planner/'))).toBe(true)
    expect(modules.some(m => m.includes('.probe.')), 'a probe is tracked — it must never be committed').toBe(false)
  })

  it('🔴 no L3 module imports the engine it replaces', () => {
    const offenders: string[] = []
    for (const m of modules) {
      const src = readFileSync(join(process.cwd(), m), 'utf8')
      const imports = Array.from(src.matchAll(/^\s*import[^;]*?from\s+'([^']+)'/gm)).map(x => x[1])
      expect(imports.length, `${m}: no imports read — this file would pass vacuously`).toBeGreaterThan(0)
      for (const i of imports) {
        if (/^@\/lib\/(plan|coaching)\//.test(i) && !(ALLOWED as readonly string[]).includes(i)) {
          offenders.push(`${m} → ${i}`)
        }
      }
    }
    expect(offenders, 'an L3 module reached back into the old engine').toEqual([])
  })

  it('every allowed path still exists, so the list cannot rot into permissiveness', () => {
    // A stale entry is worse than a missing one: it reads as a considered decision and permits a
    // path nobody checked. `resolveRuleConfigKey` exists for the same reason one layer down.
    for (const a of ALLOWED) {
      const f = a.replace('@/', '') + '.ts'
      expect(() => readFileSync(join(process.cwd(), f), 'utf8'), `${a} no longer exists`).not.toThrow()
    }
  })
})
