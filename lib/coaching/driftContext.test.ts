// POST-RUN-CONTEXT-01 — the post-run line that carries block-level meaning.
//
// Competitive research 2026-09-13: none of Runna, Trenara, Garmin, Coopah,
// Planzy or Runzy joins the individual run to the block. Garmin's Training
// Effect is UNSIGNED and cannot say an easy run was too hard; we hold the
// directional columns that can. This is the one empty square in the category.
//
// Every board binding is a test here, because a ruling that lives only in a
// decision doc is a ruling that gets reinterpreted by the next person to touch
// the file.
import { describe, it, expect } from 'vitest'
import { driftContextFor, DRIFT_PATTERN_MIN_RUNS, type DriftRun } from './loadCalc'
import { ZONE_DRIFT_ABOVE_CEILING_PCT } from './constants'

const T = ZONE_DRIFT_ABOVE_CEILING_PCT
const drifted = (): DriftRun => ({ aboveCeilingPct: T + 25 })
const clean   = (): DriftRun => ({ aboveCeilingPct: 2 })
const noHr    = (): DriftRun => ({ aboveCeilingPct: null })

const ctx = (runs: DriftRun[]) => driftContextFor(runs, T)

describe('binding 4 — silence is the default', () => {
  it('says nothing when no easy run drifted', () => {
    expect(ctx([clean(), clean(), clean()]).show).toBe(false)
  })

  it('says nothing on a SINGLE drifted run — one run is not a pattern', () => {
    expect(ctx([clean(), clean(), drifted()]).show).toBe(false)
  })

  it('says nothing when there are no runs at all', () => {
    expect(ctx([]).show).toBe(false)
  })

  it('says nothing when the latest run did not drift, even if earlier ones did', () => {
    // The line is about THIS run. A clean run must not be handed someone else's
    // pattern — that would be scolding a runner for a run they got right.
    expect(ctx([drifted(), drifted(), clean()]).show).toBe(false)
  })
})

describe('binding 5 — never twice in a row (Wood, binding)', () => {
  it('speaks when the pattern is established', () => {
    expect(ctx([drifted(), drifted()]).show).toBe(true)
  })

  it('then goes QUIET on the very next drifted run', () => {
    // "A counter the runner sees every run stops being information and becomes
    // wallpaper." Three in a row must not produce three lines.
    expect(ctx([drifted(), drifted(), drifted()]).show).toBe(false)
  })

  it('speaks again after a gap, not every other run mechanically', () => {
    const four = ctx([drifted(), drifted(), drifted(), drifted()])
    expect(four.show, 'run 4: run 3 was silent, so this one speaks').toBe(true)
    const five = ctx([drifted(), drifted(), drifted(), drifted(), drifted()])
    expect(five.show, 'run 5: run 4 spoke, so this one is silent').toBe(false)
  })

  it('a clean run in between does not reset it into speaking twice running', () => {
    // drift, drift(speak), clean, drift -> the clean run is silent, so the next
    // drift may speak. It has been at least two runs since the last line.
    expect(ctx([drifted(), drifted(), clean(), drifted()]).show).toBe(true)
  })
})

describe('binding 3 — directional, and the threshold is shared', () => {
  it('a run BELOW the cap is never drift, however far below', () => {
    expect(ctx([{ aboveCeilingPct: 0 }, { aboveCeilingPct: 0 }]).show).toBe(false)
  })

  it('sits exactly on the same constant the trigger and the card use', () => {
    // If these ever diverge, the post-run line and the Coach card would disagree
    // about what drift is for the same run.
    const justUnder = ctx([{ aboveCeilingPct: T }, { aboveCeilingPct: T }])
    const justOver  = ctx([{ aboveCeilingPct: T + 1 }, { aboveCeilingPct: T + 1 }])
    expect(justUnder.show).toBe(false)
    expect(justOver.show).toBe(true)
  })
})

describe('runs with no HR are excluded, not counted as clean', () => {
  it('a no-HR run does not break the pattern', () => {
    // §108 Amendment 1: unmeasured is not "fine". Treating it as a clean run
    // would silently reset the count and hide a real pattern.
    const withGap = ctx([drifted(), noHr(), drifted()])
    expect(withGap.total, 'the unmeasured run is excluded from the denominator').toBe(2)
    expect(withGap.drifted).toBe(2)
    expect(withGap.show).toBe(true)
  })

  it('all-unmeasured says nothing and claims no total', () => {
    const r = ctx([noHr(), noHr()])
    expect(r.show).toBe(false)
    expect(r.total).toBe(0)
  })
})

describe('the count is a COUNT — binding 1, count never conclude', () => {
  it('reports drifted and total so the copy can state a fact, not a mechanism', () => {
    const r = ctx([drifted(), clean(), drifted()])
    expect(r.drifted).toBe(2)
    expect(r.total).toBe(3)
    // Nothing here returns a cause, a reason, or a prediction. If a future
    // caller wants "which is why Saturday felt heavy", it cannot get it from
    // this function — Hutchinson vetoed the claim AND its hedged form.
    expect(Object.keys(r).sort()).toEqual(['drifted', 'show', 'total'])
  })

  it('DRIFT_PATTERN_MIN_RUNS is the pattern floor, exported so copy can cite it', () => {
    expect(DRIFT_PATTERN_MIN_RUNS).toBe(2)
  })
})
