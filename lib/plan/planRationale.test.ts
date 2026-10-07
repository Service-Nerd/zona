import { describe, it, expect } from 'vitest'
import { planRationaleNotes, levelFitNote, PLAN_RATIONALE_MAX_NOTES, PLAN_RATIONALE_MAX_WORDS } from './planRationale'
import type { GeneratorInput } from '@/types/plan'

/** The length ratchet's own measured mean, referenced so the two cannot drift apart. */
const MEAN_NOTE_WORDS_REF = 70
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

// PLAN-NOTE-DELIVERY-01 (2026-10-07) — 🔴 NOTHING MEASURED WHETHER A STAMPED
// NOTE REACHED THE RUNNER, WHICH IS HOW THIS ROTTED FOR THREE WEEKS.
//
// `PLAN-NOTE-LENGTH-01` below holds each note SHORT. `planRationale.test.ts` and
// the invariants hold each note STAMPED. **Between those two is the question
// nobody asked: of the notes the engine writes, how many does the runner read?**
//
// Measured when the budget was 70 words: **1.01 of 2.27 per plan**, and three
// note types rendered on ZERO plans. The cause was arithmetic, not policy — the
// cumulative budget was set to 70 and `MEAN_WORDS` is also 70, so it admitted
// exactly one note and `PLAN_RATIONALE_MAX_NOTES = 3` was decoration.
//
// ⚠️ A RATCHET ON DELIVERY, the mirror of the length ratchet below. Delivery may
// RISE freely; a fall means copy grew or a cap tightened and notes went quiet
// again. **The failure this guards is silent by construction** — every other
// check in this file stays green while the runner reads nothing.
describe('PLAN-NOTE-DELIVERY-01 — a stamped note reaches the runner', () => {
  const FIELDS = ['volume_constraint_note', 'volume_shortfall_note', 'long_run_shortfall_note',
    'goal_below_easy_ceiling_note', 'short_opening_block_note', 'fitness_signal_note',
    'hard_pref_note', 'terrain_effort_note', 'intensity_reentry_omission_note'] as const
  const DELIVERY_FLOOR = 1.70   // measured 1.88 at a 180-word budget, up from 1.01 at 70
  const STRIDE = 53

  const grid = cohortGrid() as GeneratorInput[]
  const LABEL_OF: Record<string, string> = {
    volume_constraint_note: 'Maintenance', volume_shortfall_note: 'Volume',
    long_run_shortfall_note: 'Long run', goal_below_easy_ceiling_note: 'Your target',
    short_opening_block_note: 'Recovery week', fitness_signal_note: 'Your level',
    hard_pref_note: 'Hard sessions', terrain_effort_note: 'Off-road',
    intensity_reentry_omission_note: 'Coming back',
  }
  const byType: Record<string, { stamped: number; rendered: number }> = {}
  let plans = 0, stamped = 0, rendered = 0
  for (let i = 0; i < grid.length; i += STRIDE) {
    let p: Plan
    try { p = generateRulePlan(grid[i]!, 'paid', COHORT_PLAN_START, undefined, COHORT_PLAN_START) as unknown as Plan } catch { continue }
    const m = p.meta as unknown as Record<string, unknown>
    const present = FIELDS.filter(f => typeof m?.[f] === 'string' && m[f])
    if (!present.length) continue
    const out = planRationaleNotes(p.meta)
    const labels = new Set(out.map(x => x.label))
    for (const f of present) {
      const label = LABEL_OF[f]
      const e = byType[f] ??= { stamped: 0, rendered: 0 }
      e.stamped++
      if (label && labels.has(label)) e.rendered++
    }
    plans++; stamped += present.length; rendered += out.length
  }

  it('the corpus is real', () => {
    expect(plans, 'no plans carry a rationale note — this file is measuring nothing').toBeGreaterThan(300)
  })

  it('delivers at least the measured floor of notes per plan', () => {
    const perPlan = rendered / plans
    expect(perPlan, `${perPlan.toFixed(2)} notes rendered per plan against a floor of ${DELIVERY_FLOOR} ` +
      `(${(stamped / plans).toFixed(2)} stamped). Notes have gone quiet: either copy grew past the budget ` +
      'or a cap tightened. Raise the copy\u2019s efficiency or the budget \u2014 do NOT lower this floor.')
      .toBeGreaterThanOrEqual(DELIVERY_FLOOR)
  })

  // 🔴 THE FLOOR ABOVE IS TOO COARSE TO CATCH THE ACTUAL DEFECT, AND FALSIFICATION
  // SHOWED IT. Un-wiring `short_opening_block_note` — exactly how that note sat
  // stamped and invisible for a day — left delivery at 1.78 against a 1.70 floor
  // and the arm stayed GREEN. An average cannot see one note type going dark.
  //
  // This is the precise guard: a note the engine STAMPS must reach the runner on
  // at least one plan. It would have caught `short_opening_block_note` (rendered
  // on 0 of 116) and `goal_below_easy_ceiling_note` (0 of 10).
  it('every note the engine stamps renders on at least one plan', () => {
    const dark = Object.entries(byType)
      .filter(([, v]) => v.stamped > 0 && v.rendered === 0)
      .map(([k, v]) => `${k}: stamped on ${v.stamped} plans, rendered on 0`)
    expect(dark, 'a note type is stamped and reaches no renderer. Either wire it into ' +
      'planRationaleNotes or stop stamping it \u2014 a note nobody reads is not honesty.').toEqual([])
  })

  it('and the budget can still hold more than one note \u2014 the arithmetic that broke it', () => {
    // 🔴 The defect was that PLAN_RATIONALE_MAX_WORDS equalled MEAN_WORDS, so the
    // tile cap could never be reached. Assert the relationship, not the number.
    expect(PLAN_RATIONALE_MAX_WORDS, 'the total budget is no larger than ONE mean note, so it can only ever ' +
      'show one and PLAN_RATIONALE_MAX_NOTES is decoration').toBeGreaterThan(MEAN_NOTE_WORDS_REF * 1.5)
  })
})

describe('PLAN-NOTE-LENGTH-01 — no single rationale note becomes a wall', () => {
  const WORST_NOTE_WORDS = 117   // measured 2026-09-17, down from 254
  const MEAN_WORDS_PER_NOTE = 62  // measured 60.3 on 2026-10-07 (per NOTE, not per plan — see below)
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

  // 🔴 RE-EXPRESSED PER NOTE, 2026-10-07, AND THE OLD FORM WAS CONFLATING TWO
  // THINGS. It measured total delivered words PER PLAN, which mixes **copy
  // length** (what an author controls, what this ratchet is for) with **delivery
  // volume** (what the board's budget controls). When `PLAN-NOTE-BUDGET-INERT-01`
  // raised the budget 70 → 180 and delivery went 1.01 → 1.88 notes per plan, this
  // went 67 → 113 and failed — **not because any copy got longer, but because the
  // runner is now told more, which was the point of the ruling.**
  //
  // Per NOTE it is invariant to how many render, so it guards the thing it is
  // named for and cannot be tripped by a delivery decision again. Measured at the
  // changeover: **60.3 words per note**, slightly BETTER than the 67 the old
  // per-plan number recorded when ~1 note rendered. Still a downward-only ratchet.
  it('the MEAN NOTE stays short, so the tail cannot hide behind a good worst case', () => {
    let total = 0, n = 0
    for (const notes of sample) {
      for (const x of notes) { total += words(x.text); n++ }
    }
    const mean = total / n
    expect(mean, `mean ${mean.toFixed(1)} words per NOTE (ratchet ${MEAN_WORDS_PER_NOTE}). ` +
      'Shorten the copy: consequence, then cause, then the one lever. Do not raise the ratchet.')
      .toBeLessThanOrEqual(MEAN_WORDS_PER_NOTE)
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
