import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

/**
 * ADR027-B1-CONTRACTS — ARCH-ENG-005's known violations, as a ratchet.
 *
 * ARCH-ENG-005 says the engine reads no wall clock. Today it does, in the places listed
 * below (also in `docs/contracts/engine.md` § v2 · Determinism). The engine is frozen,
 * so none is removed in B1: this records them and FAILS ON A NEW ONE. A count per file
 * may only fall; a fall leaves the baseline stale and fails too, so it gets lowered.
 *
 * Population: every non-test `.ts` under `lib/plan`, `lib/engine`, `packages/strength`,
 * plus the adaptive engine's entry `lib/coaching/adjustmentEngine.ts`. The rest of
 * `lib/coaching` is app-side helpers (ingest, history, prompts) and is not the engine.
 *
 * Kinds: HARD = no override exists · DEFAULT = a parameter default a caller can pin
 * (a hard read wherever a caller does not) · STAMP = writes a timestamp into output.
 */

const BASELINE: Record<string, { n: number; kind: string }> = {
  'lib/plan/ruleEngine.ts':        { n: 4, kind: 'HARD vdotFor + applyRecalibration (applyVdotDiscount) · DEFAULT todayOverride · STAMP generated_at' },
  'lib/plan/engine.ts':            { n: 1, kind: 'DEFAULT req.today' },
  'lib/plan/baseBuildOnRamp.ts':   { n: 1, kind: 'STAMP last_updated' },
  'lib/plan/taperRecalibration.ts':{ n: 1, kind: 'STAMP taper_recalibrated_at' },
  'lib/plan/weekResolution.ts':    { n: 1, kind: 'HARD getCurrentWeek (read side, not generation)' },
  'lib/plan/benchmarkCheck.ts':    { n: 1, kind: 'DEFAULT today' },
  'lib/plan/hrSaveResolution.ts':  { n: 1, kind: 'DEFAULT now' },
  'lib/plan/inputs.ts':            { n: 1, kind: 'DEFAULT today (assertPlausibleBenchmark)' },
  'lib/plan/length.ts':            { n: 1, kind: 'DEFAULT nextMonday(from)' },
  'lib/plan/slowGoalGrid.ts':      { n: 1, kind: 'DEFAULT now (measurement corpus)' },
  'lib/plan/supersede.ts':         { n: 1, kind: 'DEFAULT now' },
  'lib/coaching/adjustmentEngine.ts': { n: 2, kind: 'DEFAULT req.now (twice)' },
}

const CLOCK = /new Date\(\s*\)|Date\.now\(\)/g

function population(): string[] {
  const listed = execSync(
    "git ls-files 'lib/plan/*.ts' 'lib/plan/**/*.ts' 'lib/engine/*.ts' 'lib/engine/**/*.ts' 'packages/strength/*.ts' 'packages/strength/**/*.ts' 'lib/coaching/adjustmentEngine.ts'",
    { encoding: 'utf8' },
  ).trim().split('\n')
  return Array.from(new Set(listed)).filter(f => f && !f.includes('.test.') && !f.includes('__fixtures__'))
}

/** Comments are prose: a comment naming `new Date()` is not a read. Line count kept. */
function strip(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length))
}

const countIn = (src: string) => (strip(src).match(CLOCK) ?? []).length

const FILES = population()
const found: Record<string, number> = {}
for (const f of FILES) {
  const n = countIn(readFileSync(f, 'utf8'))
  if (n) found[f] = n
}

describe('ARCH-ENG-005 — wall-clock reads in the engine (known violations, ratcheted)', () => {
  it('the population is real', () => {
    expect(FILES.length).toBeGreaterThanOrEqual(140) // 150 on 2026-11-21
    expect(FILES).toContain('lib/plan/ruleEngine.ts')
    expect(FILES).toContain('lib/engine/contracts/planV2.ts')
    expect(FILES).toContain('lib/coaching/adjustmentEngine.ts')
  })

  it('the matcher counts a read and ignores prose', () => {
    expect(countIn('const d = new Date()')).toBe(1)
    expect(countIn('const t = Date.now()')).toBe(1)
    expect(countIn('// new Date() would read the clock')).toBe(0)
    expect(countIn('new Date(iso)')).toBe(0)
  })

  it('🔴 no new wall-clock read', () => {
    const over = Object.entries(found)
      .filter(([f, n]) => n > (BASELINE[f]?.n ?? 0))
      .map(([f, n]) => `${f}: ${n} (baseline ${BASELINE[f]?.n ?? 0})`)
    expect(over, `ARCH-ENG-005: the engine may not read the wall clock. Take the date as an argument (as_of).\n${over.join('\n')}`).toEqual([])
  })

  it('a paid-down entry is lowered, not left to rot', () => {
    const stale = Object.entries(BASELINE)
      .filter(([f, b]) => (found[f] ?? 0) < b.n)
      .map(([f, b]) => `${f}: ${found[f] ?? 0} < baseline ${b.n}`)
    expect(stale).toEqual([])
  })

  it('lib/engine itself reads no clock', () => {
    expect(Object.keys(found).filter(f => f.startsWith('lib/engine/'))).toEqual([])
  })
})
