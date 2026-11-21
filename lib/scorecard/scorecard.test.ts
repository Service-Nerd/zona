import { describe, it, expect } from 'vitest'
import type { Plan } from '@/types/plan'
import { existingCorpora } from './corpora'
import { runPlanRead } from './planRead'
import { compare, failing, readBaseline, verdictFor } from './ratchet'
import { isQualitySession, isTimeTrial } from '@/lib/plan/sessionRole'
import { runsOf } from './metrics'

/**
 * ADR027-B0-SCORECARD — the never-worse gate, fast subset.
 *
 * The full scorecard (`npm run scorecard`) composes seven harnesses and takes minutes; this is its
 * plan-read step on the gate-sized sample, compared against the `fast` mode of the SAME baseline
 * file. Any line WORSE / MOVED / NEW / MISSING / NOT MEASURED fails.
 *
 * ⚠️ It proves only what the fast sample reaches (~400 plans, 3 run plans × 16 strength profiles,
 * 120 maintenance blocks). A defect confined to rows the sample skips passes here and fails the full run.
 */
const base = readBaseline()
const fast = base?.modes.fast

describe('scorecard v2 — never worse (fast subset)', () => {
  it('has a committed fast baseline', () => {
    expect(fast, 'run: npm run scorecard -- --write --reason "<why>"').toBeTruthy()
  })

  it('no plan-read line is worse than the baseline', () => {
    const r = runPlanRead(existingCorpora('fast'), { mode: 'fast' })
    const bad = failing(compare(r.lines, fast))
    expect(bad.map(x => `${x.id}: ${x.today} vs ${x.baseline} (${x.verdict})`)).toEqual([])
  }, 60_000)
})

describe('scorecard v2 — the gate can go red (falsification)', () => {
  // One small corpus keeps these cheap; each plants a defect in memory and shows the predicate fires
  // AND the ratchet reads the line WORSE against the real baseline's value for that line.
  const corpus = () => existingCorpora('fast').filter(c => c.name === 'cohortGrid')
  const lineOf = (lines: { id: string; value: number | null }[], id: string) => lines.find(l => l.id === id)?.value ?? null

  it('a planted FALSE NOTE ("no hard sessions" on a plan with a time trial) fires and is WORSE', () => {
    const plant = (p: Plan): Plan => {
      const hasTT = p.weeks.some(w => runsOf(w).some(r => isTimeTrial(r.s)))
      return hasTT ? { ...p, meta: { ...p.meta, hard_pref_note: 'This plan has no hard sessions in it.' } } : p
    }
    const clean = runPlanRead(corpus(), { mode: 'fast' }).lines
    const dirty = runPlanRead(corpus(), { mode: 'fast', mutatePlan: plant }).lines
    const id = 'planread.NT-NO-HARD-SESSIONS-FALSE@cohortGrid'
    expect(lineOf(dirty, id)!).toBeGreaterThan(lineOf(clean, id)!)
    const row = compare(dirty.filter(l => l.id === id), fast).find(r => r.id === id)!
    expect(row.verdict).toBe('WORSE')
  }, 60_000)

  it('a planted STAMP (run-walk interval on a quality session) fires and is WORSE', () => {
    const plant = (p: Plan): Plan => ({
      ...p,
      weeks: p.weeks.map(w => ({
        ...w,
        sessions: Object.fromEntries(Object.entries(w.sessions).map(([d, s]) =>
          [d, s && isQualitySession(s) ? { ...s, run_walk_strategy: 'Run 4 min, walk 1 min' } : s])),
      })),
    })
    const dirty = runPlanRead(corpus(), { mode: 'fast', mutatePlan: plant }).lines
    const id = 'planread.RUN-WALK-ON-QUALITY@cohortGrid'
    expect(lineOf(dirty, id)!).toBeGreaterThan(0)
    expect(compare(dirty.filter(l => l.id === id), fast)[0]!.verdict).toBe('WORSE')
  }, 60_000)

  it('the ratchet rules: zero, lower, higher, stable, pass, and unverified is never a pass', () => {
    expect(verdictFor({ id: 'a', value: 1, better: 'zero' }, { value: 0, better: 'zero' })).toBe('WORSE')
    expect(verdictFor({ id: 'a', value: 5, better: 'lower' }, { value: 4, better: 'lower' })).toBe('WORSE')
    expect(verdictFor({ id: 'a', value: 3, better: 'lower' }, { value: 4, better: 'lower' })).toBe('BETTER')
    expect(verdictFor({ id: 'a', value: 90, better: 'higher', tol: 0.6 }, { value: 90.5, better: 'higher' })).toBe('OK')
    expect(verdictFor({ id: 'a', value: 89, better: 'higher', tol: 0.6 }, { value: 90.5, better: 'higher' })).toBe('WORSE')
    expect(verdictFor({ id: 'a', value: 11, better: 'stable' }, { value: 10, better: 'stable' })).toBe('MOVED')
    expect(verdictFor({ id: 'a', value: 0, better: 'pass' }, { value: 1, better: 'pass' })).toBe('WORSE')
    expect(verdictFor({ id: 'a', value: null, better: 'lower' }, { value: 1, better: 'lower' })).toBe('NOT MEASURED')
    expect(verdictFor({ id: 'a', value: 0, better: 'lower' }, undefined)).toBe('NEW')
    expect(compare([], { gone: { value: 1, better: 'lower' } })[0]!.verdict).toBe('MISSING')
  })
})
