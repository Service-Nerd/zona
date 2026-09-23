// UNITS-PROSE-01 — runner-facing PROSE honours the km/mi preference.
//
// 🔴 The engine welds `km` into sentences at GENERATION time and stores them in
// `plan_json`. Measured 2026-09-23: **100% of 1,167 generated plans** and **19
// of 19 stored plans** carry at least one, including **101 of 888 sessions** in
// `coach_notes` and **16 of 19 plans** in `meta.notes`.
//
// ⚠️ THE FIRST MEASUREMENT OF THIS SAID ZERO, AND IT WAS THE INSTRUMENT. The
// production query used `\d\s*km\b`, and in **Postgres POSIX regex `\b` is a
// BACKSPACE CHARACTER, not a word boundary** (`\y` is). It matched nothing and
// returned a clean zero, which was reported to the founder and written into the
// debt register as "real but unrealised". A clean zero from a broken pattern is
// indistinguishable from a clean zero from clean data.
//
// ⚠️ CONVERTED AT THE READ, NEVER AT THE PRODUCER. Three reasons, any one
// sufficient: every stored plan already carries it; the toggle is MUTABLE after
// generation; and the producer strings stay byte-identical so §44's
// `REFUSAL_NAMES_NEXT_STEP` and every prose matcher keep passing (this repo
// broke 8 prose matchers across 5 files once by editing refusal strings).

import { describe, it, expect } from 'vitest'
import { cohortGrid, COHORT_PLAN_START } from './cohortGrid'
import { generateRulePlan } from './ruleEngine'
import { composePlanWithFoundation } from './foundationCompose'
import { isDesignedRefusal } from './designedRefusal'
import { planRationaleNotes, PLAN_RATIONALE_MAX_WORDS } from './planRationale'
import { convertDistanceString } from '@/lib/format'

const STRIDE = 149 // prime, avoids aligning with any grid axis

/** The meta fields `planRationaleNotes` can surface, plus session coach notes. */
interface Collected { metaNotes: string[]; coachNotes: string[]; refusals: string[] }

function collect(): Collected {
  const grid = cohortGrid()
  const out: Collected = { metaNotes: [], coachNotes: [], refusals: [] }
  for (let i = 0; i < grid.length; i += STRIDE) {
    let plan
    try {
      const raw = generateRulePlan(grid[i], 'paid', COHORT_PLAN_START, undefined, COHORT_PLAN_START)
      plan = composePlanWithFoundation(raw, grid[i], COHORT_PLAN_START, 'add').plan
    } catch (e) {
      if (isDesignedRefusal(e)) out.refusals.push(e instanceof Error ? e.message : String(e))
      continue
    }
    // Read through the SINGLE OWNER the screen calls, not a hand-picked field
    // list — a note added to that owner later is covered by construction.
    for (const n of planRationaleNotes(plan.meta)) out.metaNotes.push(n.text)
    for (const w of plan.weeks) for (const s of Object.values(w.sessions)) {
      for (const n of (s?.coach_notes ?? [])) if (typeof n === 'string') out.coachNotes.push(n)
    }
  }
  return out
}

const c = collect()

describe('UNITS-PROSE-01 — the corpus reaches the case', () => {
  it('produces prose that actually contains kilometres', () => {
    // A guard that never sees its own case is green for the wrong reason.
    const withKm = [...c.metaNotes, ...c.coachNotes].filter(s => /\d\s*km\b/.test(s))
    expect(withKm.length, 'no generated prose contains km — this suite cannot see the defect').toBeGreaterThan(50)
  })
  it('produces refusals at all', () => {
    expect(c.refusals.length).toBeGreaterThan(5)
  })
})

describe('UNITS-PROSE-01 — no kilometre survives conversion to miles', () => {
  for (const [name, list] of [['plan-rationale notes', c.metaNotes], ['coach notes', c.coachNotes], ['refusals', c.refusals]] as const) {
    it(`${name}`, () => {
      const survivors = list
        .map(s => convertDistanceString(s, 'mi') as string)
        // `/km` is PACE and belongs to convertPaceString — excluded by design.
        .filter(s => /\d\s*km\b/.test(s.replace(/\/\s*km\b/g, '')))
      expect(survivors.slice(0, 5), `${survivors.length} strings still name kilometres to a miles reader`).toEqual([])
    })
  }

  // ⚠️ WHAT THIS CANNOT SEE, stated because green here is not "the prose is
  // right". A figure with NO unit attached — "wants nearer 53", implicitly km —
  // is invisible to a regex and survives conversion looking like a plain
  // number. Two such companions existed and were LABELLED at the producer
  // (`ruleEngine.ts`, "nearer N km") so this gate could see them. A third would
  // pass here silently. It is found by reading, not by this test.
  it('the km path is the identity — a km reader sees exactly what was generated', () => {
    for (const s of [...c.metaNotes, ...c.coachNotes, ...c.refusals]) {
      expect(convertDistanceString(s, 'km')).toBe(s)
    }
  })
})

describe('UNITS-PROSE-01 — the preference may not change WHAT the runner is told', () => {
  it('planRationaleNotes returns the same notes, in the same order, in both units', () => {
    // 🔴 THE WORD BUDGET IS WHY THIS EXISTS. `planRationaleNotes` caps by word
    // count, and conversion changes word counts ("38km" is one word, "23.6 mi"
    // is two). Converting BEFORE the cap would silently give a miles reader
    // FEWER notes than a km reader for the same plan — a units-dependent
    // difference in what the runner is told, which is worse than the defect.
    const grid = cohortGrid()
    let compared = 0
    for (let i = 0; i < grid.length; i += STRIDE) {
      let plan
      try { plan = generateRulePlan(grid[i], 'paid', COHORT_PLAN_START, undefined, COHORT_PLAN_START) } catch { continue }
      const km = planRationaleNotes(plan.meta, 'km')
      const mi = planRationaleNotes(plan.meta, 'mi')
      expect(mi.map(n => n.label)).toEqual(km.map(n => n.label))
      compared++
    }
    expect(compared, 'nothing compared').toBeGreaterThan(50)
  })
})

// ── Properties the CORPUS CANNOT REACH, asserted directly ────────────────────
//
// 🔴 BOTH OF THESE WERE HOLLOW WHEN FIRST WRITTEN, AND ONLY FALSIFYING FOUND IT.
// Two deliberate breakages — making the converter eat `/km`, and moving the
// conversion above the word cap — left the corpus suite **fully green**, because
// the generated prose fields contain no pace strings and the word budget never
// binds in this sample. A property that the corpus happens not to exercise is
// not tested by a corpus. It is asserted here, on constructed input.
describe('UNITS-PROSE-01 — properties the corpus does not reach', () => {
  it('🔴 leaves PACE alone — `/km` belongs to convertPaceString', () => {
    // If this ever goes green while the exclusion is removed, a miles runner is
    // shown a pace divided by 1.609 — a number that is not any pace at all.
    expect(convertDistanceString('easy at 6:30–7:30 /km', 'mi')).toBe('easy at 6:30–7:30 /km')
    expect(convertDistanceString('5:53 /km or slower', 'mi')).toBe('5:53 /km or slower')
    // …while a DISTANCE in the same sentence still converts.
    expect(convertDistanceString('run 10 km at 6:30 /km', 'mi')).toBe('run 6.2 mi at 6:30 /km')
  })

  it('🔴 never asserts zero — a sub-unit figure keeps its kilometres', () => {
    // UNITS-SUBUNIT-01's rule, applied to prose: "0.05 km" must not become
    // "0 mi", which would tell the runner the stride covers nothing.
    expect(convertDistanceString('0.05 km stride', 'mi')).toBe('0.05 km stride')
    expect(convertDistanceString('First 0.6 km at Zone 2.', 'mi')).toBe('First 0.4 mi at Zone 2.')
  })

  it('🔴 the word budget cannot drop a note for a MILES reader only', () => {
    // ⚠️ SIZED SO THE KM SIDE KEEPS **TWO** NOTES. The first version of this
    // test put the km side over budget too, so both sides returned ONE note and
    // it passed no matter what the code did. Asserted explicitly below, because
    // a comparison between two identical wrong answers is not a test.
    //
    // Each "38km" is ONE word and converts to "23.6 mi", TWO. Three figures per
    // note, so the converted pair gains six words: 65 words in km, 71 in miles,
    // against a 70-word budget. If conversion ran before the cap, the miles
    // reader would silently lose the second note.
    const filler = (n: number) => Array.from({ length: n }, () => 'word').join(' ')
    const meta = {
      volume_constraint_note: `Your biggest week reaches 38km and 41km and 44km. ${filler(47)}`,
      long_run_shortfall_note: 'Your longest run reaches 29km against 31km and 33km.',
    } as unknown as Parameters<typeof planRationaleNotes>[0]

    const km = planRationaleNotes(meta, 'km')
    const mi = planRationaleNotes(meta, 'mi')
    // The guard against a trivial pass: the km side must be exercising the
    // budget with room for exactly two notes.
    expect(km.length, 'fixture mis-sized — the km side must keep two notes').toBe(2)
    expect(mi.length, 'a miles reader was shown fewer notes than a km reader').toBe(2)
    expect(mi.map(n => n.label)).toEqual(km.map(n => n.label))
    // And the conversion really happened — otherwise this passes trivially.
    expect(mi.some(n => /\d+(\.\d+)? mi\b/.test(n.text)), 'nothing converted').toBe(true)
    expect(mi.every(n => !/\d\s*km\b/.test(n.text)), 'a kilometre survived').toBe(true)
  })
})
