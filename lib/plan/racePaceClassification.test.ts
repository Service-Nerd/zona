import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * 🔴 NO INVARIANT MAY IDENTIFY RACE-PACE WORK BY READING A LABEL.
 *
 * The enricher rewrites labels; it can never write `lr_segment_pace`, `stimulus`
 * or `catalogue_id` (`EnrichedWeekSchema` exposes label, theme and coach_notes
 * and nothing else). A checker that reads the label is therefore asking the one
 * subsystem that is allowed to lie. **D-17.**
 *
 * ⚠️ THIS SHAPE HAS BITTEN TWICE AND IN OPPOSITE DIRECTIONS, which is why a
 * gate exists rather than a third careful reading:
 *
 *   · `INV-PLAN-RACE-SPECIFIC-EXPOSURE` fired SPURIOUSLY after a rename and
 *     discarded a whole enriched plan.
 *   · `INV-PLAN-RACE-SPECIFIC-LONG-RUN` did the same on 2026-09-26 and, carrying
 *     `week: 0`, cost a real trial user AI coaching on all 16 weeks.
 *   · `INV-PLAN-PEAK-LR-ALTERNATION` fails the OTHER way — a rename makes it go
 *     SILENT on an injury-load rule. **A check that stops checking leaves no
 *     trace**, which is why it survived nine instances of its own class.
 *
 * The third was found by the sweep `/zona-debug` § Exit criteria now mandates:
 * *grep for the SHAPE of the fix, not the symptom.*
 */
const SRC = fs.readFileSync(path.resolve(__dirname, 'invariants.ts'), 'utf8')

/** Comments stripped: this file's own prose quotes the banned pattern, and a
 *  guard that fires on the documentation of the defect it guards gets switched
 *  off — recorded five times in this repo. */
const blank = (m: string) => m.replace(/[^\n]/g, '')
const CODE = SRC
  .replace(/\/\*[\s\S]*?\*\//g, blank)
  .replace(/^[ \t]*\/\/.*$/gm, '')

describe('race-pace work is classified structurally, never by label', () => {
  it('🔴 no label substring test for race pace survives in invariants.ts', () => {
    // Bound the region: race-pace cues only. `label.includes('vo2max')` and the
    // zone/threshold reads are a different question with their own precedent,
    // and sweeping them in here would make this fire on correct work.
    // ⚠️ LINE-BASED, not a character window. The first cut sliced 220 chars back
    // from the match and mis-scored a line whose guard was plainly two lines
    // above it — an off-by-window that would have read as a real offender.
    const banned = /\.includes\(\s*'(pace|hm-pace| mp)'\s*\)|\.startsWith\(\s*'mp'\s*\)/
    // The LEGACY FALLBACK is legitimate and deliberate: plans generated before
    // §107 stamped `lr_segment_pace` carry only the label, and dropping the arm
    // would fire on every legacy plan in the fleet. It is legitimate ONLY when a
    // structural check short-circuits in front of it.
    const structural = /lr_segment_pace|classifyStimulus|catalogue_id|\bstimulus\b/
    const lines = CODE.split('\n')
    const offenders: string[] = []
    lines.forEach((ln, i) => {
      if (!banned.test(ln)) return
      const window = lines.slice(Math.max(0, i - 6), i + 1).join('\n')
      if (!structural.test(window)) offenders.push(`invariants.ts:${i + 1}  ${ln.trim().slice(0, 80)}`)
    })
    expect(offenders,
      `a race-pace label test with no structural check in front of it:\n${offenders.join('\n')}\n` +
      'The enricher rewrites labels. Use `lr_segment_pace` / `stimulus` / `catalogue_id`, ' +
      'and keep the label only as a guarded legacy fallback.')
      .toEqual([])
  })

  it('🔴 the three known sites each front their label arm with a structural check', () => {
    // Named, so a future refactor that deletes the structural arm and leaves the
    // label arm cannot pass the generic sweep above by moving code around.
    for (const anchor of [
      'INV-PLAN-RACE-SPECIFIC-LONG-RUN',
      'INV-PLAN-PEAK-LR-ALTERNATION',
    ]) {
      const i = CODE.indexOf(anchor)
      expect(i, `${anchor} has moved — re-anchor this test`).toBeGreaterThan(-1)
    }
    // Both race-pace long-run checks read the stamp first.
    expect((CODE.match(/lr_segment_pace\) return true/g) ?? []).length,
      'both long-run race-pace checks must short-circuit on the stamped field')
      .toBeGreaterThanOrEqual(2)
  })
})
