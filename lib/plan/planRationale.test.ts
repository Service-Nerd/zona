import { describe, it, expect } from 'vitest'
import { planRationaleNotes, levelFitNote, PLAN_RATIONALE_MAX_NOTES } from './planRationale'
import type { Plan } from '@/types/plan'

const meta = (o: Partial<Plan['meta']>) => o as Plan['meta']

describe('planRationaleNotes — the single owner of "why this plan"', () => {
  it('empty plan → no notes (renderer shows nothing, no empty card)', () => {
    expect(planRationaleNotes(meta({}))).toEqual([])
    expect(planRationaleNotes(undefined)).toEqual([])
  })

  it('surfaces an engine-stamped note verbatim under its topic label', () => {
    const notes = planRationaleNotes(meta({ terrain_effort_note: 'Off-road, effort leads.' }))
    expect(notes).toEqual([{ label: 'Off-road', text: 'Off-road, effort leads.' }])
  })

  // FIRSTRUN-MOMENTS-01a — the uncovered-runway note is surfaced ONCE, at the plan
  // reveal (RunwayRevealCard), led by the number. It must NOT also appear in the
  // "Why this plan" surface, or a first-timer reads the same relief twice. This
  // locks the "render once" decision the spec asked to assert.
  it('does NOT surface the uncovered-runway note (it belongs to the reveal, not here)', () => {
    const notes = planRationaleNotes(meta({
      uncovered_runway_weeks: 11,
      uncovered_runway_note: 'You have 11 weeks before this plan starts.',
    }))
    expect(notes).toEqual([])
  })

  it('honest constraints rank ABOVE the "shaped for you" line (Wood: never a brag first)', () => {
    const notes = planRationaleNotes(meta({
      early_quality_onset: true,                 // → "Shaped for you"
      volume_constraint_note: 'Maintenance because…',
    }))
    expect(notes[0].label).toBe('Maintenance')
    expect(notes[notes.length - 1].label).toBe('Shaped for you')
  })

  it('caps at PLAN_RATIONALE_MAX_NOTES — a plan does not become a wall of notes', () => {
    const notes = planRationaleNotes(meta({
      volume_constraint_note: 'a', volume_shortfall_note: 'b', long_run_shortfall_note: 'c',
      fitness_signal_note: 'd', hard_pref_note: 'e', terrain_effort_note: 'f', early_quality_onset: true,
    }))
    expect(notes).toHaveLength(PLAN_RATIONALE_MAX_NOTES)
    // The lowest-priority "shaped for you" line is the one dropped by the cap.
    expect(notes.map(n => n.label)).not.toContain('Shaped for you')
  })

  it('levelFitNote is DERIVED, honest, and only fires on a real level decision', () => {
    expect(levelFitNote(meta({ early_quality_onset: true }))?.toLowerCase()).toContain('training history')
    expect(levelFitNote(meta({}))).toBeNull()
  })
})

describe('§98 — the §1 yield is visible to the runner (ONSET-YIELD-NOTE-01)', () => {
  const yielded = (over: any = {}) => ({
    early_quality_onset: true,
    onset_yield: { rungs: 2, bound: 5, effective: 4 },
    ...over,
  }) as any

  it('a trimmed plan says so', () => {
    const notes = planRationaleNotes(yielded())
    const note = notes.find(n => n.label === 'Quality timing')
    expect(note).toBeDefined()
    expect(note!.text).toContain('starts later here')
  })

  it('an UNTRIMMED gated plan says nothing — 84% of the cohort', () => {
    const notes = planRationaleNotes({ early_quality_onset: true } as any)
    expect(notes.find(n => n.label === 'Quality timing')).toBeUndefined()
    // and still gets to claim the early start, because it is true for them
    expect(notes.find(n => n.label === 'Shaped for you')).toBeDefined()
  })

  it('STOPS the "earlier than a novice plan" claim when the trim reached a tie', () => {
    // effective === bound: quality starts exactly when it would for an ungated
    // runner, so the claim would be false. This is the case that would have
    // silently shipped a untrue sentence.
    const notes = planRationaleNotes(yielded({ onset_yield: { rungs: 3, bound: 5, effective: 5 } }))
    expect(notes.find(n => n.label === 'Shaped for you')).toBeUndefined()
    expect(notes.find(n => n.label === 'Quality timing')).toBeDefined()
  })

  it('keeps the claim when the trimmed plan is still genuinely earlier', () => {
    const notes = planRationaleNotes(yielded({ onset_yield: { rungs: 1, bound: 6, effective: 4 } }))
    expect(notes.find(n => n.label === 'Shaped for you')).toBeDefined()
  })

  it('a fell-through plan (rung 0, gate suppressed) explains itself and claims nothing', () => {
    const notes = planRationaleNotes({
      early_quality_onset: false,
      onset_yield: { rungs: 0, bound: 5, effective: 5 },
    } as any)
    expect(notes.find(n => n.label === 'Quality timing')).toBeDefined()
    expect(notes.find(n => n.label === 'Shaped for you')).toBeUndefined()
  })

  it('a plan the ladder never touched is completely unchanged', () => {
    expect(planRationaleNotes({} as any)).toEqual([])
  })
})

// ── PLAN-NOTE-LENGTH-01 — the wall guard, at the variable that binds ─────────
//
// SLT 2026-09-17, founder-reported. Wood's original guardrail capped the note
// COUNT at 3 and never capped LENGTH, so the wall arrived anyway, three items
// tall: **91.1% of plans showed a note, 74% showed two or three, the mean was
// 130 words and the worst case 254** — a page of shortfall read before the
// runner had seen a single session. Two tiles also blamed the same cause on
// **157 of the 200 plans (78.5%)** where they appeared together.
//
// ⚠️ THE RUNTIME BUDGET CANNOT DO THIS JOB. `PLAN_RATIONALE_MAX_WORDS` drops
// whole notes and always keeps the first, and the one-cause-one-tile rule left
// 510 of 513 plans carrying a single note — so at runtime it now decides almost
// nothing. A note the renderer must show is a note the renderer must show at
// whatever length it is. Only a test can hold copy short, so this is the guard.
//
// RATCHET, not a tolerance. Re-baseline DOWN whenever the worst case falls;
// never up. A new note longer than the current worst means new copy was written
// without the board's consequence-then-lever shape — fix the copy.
import { cohortGrid, COHORT_PLAN_START } from './cohortGrid'
import { generateRulePlan } from './ruleEngine'

describe('PLAN-NOTE-LENGTH-01 — no single rationale note becomes a wall', () => {
  const WORST_NOTE_WORDS = 117   // measured 2026-09-17, down from 254
  const MEAN_WORDS       = 70    // measured 67
  const STRIDE           = 53

  const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length

  const sample = (() => {
    const grid = cohortGrid()
    const out: { label: string; text: string }[][] = []
    for (let i = 0; i < grid.length; i += STRIDE) {
      try {
        const plan = generateRulePlan(grid[i], 'paid', COHORT_PLAN_START)
        const notes = planRationaleNotes(plan.meta)
        if (notes.length) out.push(notes)
      } catch { /* refusals carry no plan */ }
    }
    return out
  })()

  it('the sample actually contains rationale notes', () => {
    expect(sample.length, 'no plan in the sample carried a note — this asserts nothing').toBeGreaterThan(100)
  })

  it('no single note exceeds the measured worst case', () => {
    let worst = 0, worstText = ''
    for (const notes of sample) {
      for (const n of notes) {
        const w = words(n.text)
        if (w > worst) { worst = w; worstText = n.text }
      }
    }
    expect(worst, `longest note is now ${worst} words (ratchet ${WORST_NOTE_WORDS}):\n\n  "${worstText}"\n\n` +
      'Shorten the copy: consequence, then cause, then the one lever. Do not raise the ratchet.')
      .toBeLessThanOrEqual(WORST_NOTE_WORDS)
  })

  it('the MEAN stays low, so the tail cannot hide behind a good worst case', () => {
    let total = 0, n = 0
    for (const notes of sample) {
      total += notes.reduce((a, x) => a + words(x.text), 0)
      n++
    }
    const mean = total / n
    expect(mean, `mean ${mean.toFixed(1)} words per plan (ratchet ${MEAN_WORDS})`).toBeLessThanOrEqual(MEAN_WORDS)
  })

  it('the maintenance and volume tiles are never shown together', () => {
    // ONE CAUSE, ONE TILE. They blamed the same thing on 157 of the 200 plans
    // where they appeared together (78.5%), and prescribed the identical lever
    // on 68.
    //
    // ⚠️ ASSERTED ON SHORT SYNTHETIC NOTES, DELIBERATELY. Written first against
    // the generated corpus, this passed even with the de-dupe REMOVED — the word
    // budget was dropping the second note on length, so the test was green for a
    // reason that had nothing to do with the rule it names. Real notes are long
    // enough that the budget always masks the de-dupe. Six-word notes take the
    // budget out of the picture and leave only the rule under test.
    const both = planRationaleNotes(meta({
      volume_constraint_note: 'Short maintenance note here.',
      volume_shortfall_note:  'Short shortfall note here.',
    }))
    const labels = both.map(x => x.label)
    expect(labels, `both tiles shown: ${labels.join(' + ')}`).not.toContain('Volume')
    expect(labels).toContain('Maintenance')

    // The shortfall note still shows on its own when maintenance is absent —
    // de-duping must not silently delete a constraint that has no other teller.
    const alone = planRationaleNotes(meta({ volume_shortfall_note: 'Short shortfall note here.' }))
    expect(alone.map(x => x.label)).toEqual(['Volume'])

    // And it never happens on the real corpus either.
    for (const notes of sample) {
      const ls = notes.map(x => x.label)
      expect(ls.includes('Maintenance') && ls.includes('Volume'), `both on a real plan: ${ls.join(' + ')}`).toBe(false)
    }
  })
})
