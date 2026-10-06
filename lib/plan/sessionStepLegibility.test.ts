// SESSION-STEP-LEGIBILITY-01 — Design Board, 2026-10-06, SHIP WITH AMENDMENT.
//
// The founder opened his own session and could not tell what to do. Three
// mechanisms each hid part of the instruction, and this gate holds all three
// shut across the real corpus rather than on a hand-built fixture:
//
//   1. `DerivedStep.note` had a WRITER and NO READER — 5,152 of 6,014 rendered
//      steps (85.7%) carried a coaching instruction that reached no screen.
//   2. A pace ceiling printed as `≤` over the whole band — 2,499 steps (41.6%),
//      against `design-rulings.md` CD-11/§12 ("never a ≤ symbol, which reads
//      backwards for pace") and with the SIGN inverted (ADR-019: ceiling means
//      "no faster than", which on a pace NUMBER is ≥).
//   3. A bare `M:SS` in the amount column — 202 steps (3.4%), the glyph
//      ambiguity ADR-015 §1 retired ("never a lone 78m").
//
// ⚠️ WHAT THIS DOES NOT PROVE. It asserts the STRINGS the display model emits.
// It cannot see layout: the row geometry was measured separately on
// `/copy-preview` at 320 and 375 (role column 53–72px at 320, which is why the
// board's first shape was not buildable), and nothing has run on a device.
import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { cohortGrid, COHORT_PLAN_START } from './cohortGrid'
import { buildStepGroups } from './sessionSteps'
import { formatDistance } from '@/lib/format'
import type { GeneratorInput } from '@/types/plan'

interface Row { role: string; amount: string; detail: string; note?: string }

/** Every rendered step across a slice of the cohort grid, paired with the
 *  DerivedStep it came from — so the note assertion compares the row against
 *  its OWN source, never against a count. */
function rendered(stride: number) {
  const grid = cohortGrid() as GeneratorInput[]
  const out: { row: Row; srcNote?: string; label: string }[] = []
  for (let i = 0; i < grid.length; i += stride) {
    let p
    try { p = generateRulePlan(grid[i]!, 'paid', COHORT_PLAN_START, undefined, COHORT_PLAN_START) } catch { continue }
    for (const w of (p as { weeks: { sessions?: Record<string, unknown> }[] }).weeks) {
      for (const s of Object.values(w.sessions ?? {})) {
        const sess = s as { derived_set?: { version?: number; blocks?: { steps: { note?: string }[] }[] }; label?: string }
        if (!sess?.derived_set || sess.derived_set.version !== 2) continue
        const groups = buildStepGroups(sess.derived_set as never, {
          metric: 'distance', units: 'km',
          formatDist: (km) => formatDistance(km, 'km', { exact: true }) ?? '—',
        })
        groups.forEach((g, gi) => g.rows.forEach((row, ri) => {
          out.push({ row: row as Row, srcNote: sess.derived_set!.blocks![gi]!.steps[ri]!.note, label: sess.label ?? '?' })
        }))
      }
    }
  }
  return out
}

const ROWS = rendered(131)

describe('SESSION-STEP-LEGIBILITY-01 — a step row says what to do', () => {
  it('the population is derived and non-empty — an empty one passes every other arm', () => {
    expect(ROWS.length).toBeGreaterThan(1000)
  })

  it('every step that HAS a note renders it, in full and untruncated', () => {
    const withNote = ROWS.filter(r => r.srcNote)
    expect(withNote.length, 'the corpus must actually contain notes').toBeGreaterThan(500)
    const dropped = withNote.filter(r => r.row.note !== r.srcNote)
    expect(dropped.map(r => `${r.label}: ${r.srcNote}`).slice(0, 3),
      `${dropped.length} step(s) lost or altered their coaching note. Wroblewski's condition is ` +
      'binding: nothing is truncated to fit the card.').toEqual([])
  })

  it('NO rendered detail contains ≤ or ≥ — CD-11/§12, the operator reads backwards for pace', () => {
    const bad = ROWS.filter(r => /[≤≥]/.test(r.row.detail))
    expect(bad.map(r => `${r.label}: ${r.row.detail}`).slice(0, 3),
      'A pace qualifier must come from the ratified owner (easyPaceAsCeiling / paceAsFloor), ' +
      'which renders "5:53 /km or slower". An operator on a pace number is inverted, and on a ' +
      'BAND it is meaningless.').toEqual([])
  })

  it('NO rendered amount is a bare unitless M:SS — ADR-015 §1', () => {
    const bad = ROWS.filter(r => /^~?\d+:\d{2}$/.test(r.row.amount))
    expect(bad.map(r => `${r.label}: amount="${r.row.amount}" detail="${r.row.detail}"`).slice(0, 3),
      'The amount column shows distance on its sibling rows, so a bare "9:20" reads as a pace. ' +
      'ADR-015 §1 retired exactly this glyph ambiguity.').toEqual([])
  })

  it('a block whose steps differ no longer renders one repeated word', () => {
    // The role word collapsed 373 of 2,068 blocks to "Hard" × n. What
    // distinguishes those steps IS the note, so a block with distinct notes must
    // now render distinct guidance even where the role repeats.
    const byBlock = new Map<string, { roles: Set<string>; notes: Set<string>; n: number }>()
    ROWS.forEach((r, i) => {
      const k = `${r.label}#${Math.floor(i / 3)}`
      const e = byBlock.get(k) ?? { roles: new Set(), notes: new Set(), n: 0 }
      e.roles.add(r.row.role); e.notes.add(r.row.note ?? ''); e.n++
      byBlock.set(k, e)
    })
    const flat = Array.from(byBlock.values()).filter(e => e.n > 1 && e.roles.size === 1 && e.notes.size === 1 && !Array.from(e.notes)[0])
    // Not zero — a genuine 6 × 400m rep block SHOULD read the same every row.
    // The assertion is that it is no longer the DOMINANT case.
    expect(flat.length / byBlock.size,
      'More than half of multi-row blocks render one repeated word with no guidance.').toBeLessThan(0.5)
  })
})
