// noteLeverInjuryCap.test.ts — NOTE-LEVER-INJURY-CAP-01.
//
// 🔴 A LEVER THAT CANNOT MOVE THE THING JUST NAMED IS NOT ADVICE. Found 2026-10-28 on
// graceemilyhill's live plan: the maintenance note said *"Your back injury history keeps the
// long run to 2h, so the plan stops it there"* and then offered *"run 4 days a week instead of
// 3, or give your weekday runs more room"*. **Both levers lift WEEKLY VOLUME. Neither touches
// the long run, which the §9 Am. 3 injury ceiling holds whatever she changes.**
//
// 📐 MEASURED ON A CONSTRUCTED COHORT, BECAUSE NEITHER STANDING GRID REACHES IT.
// `cohortGrid` carries `injury_history: []`; `targetedGrid`'s set is Knee / Shin / Achilles —
// **not back or plantar fasciitis, the two histories that carry the long-run time ceiling.**
// **THE CORPUS THIS FILE RUNS** (stride 23, both injuries, HM and up): **1,804 attempts → 1,378
// notes; 692 name the cap, and on 290 of those every lever offered was inapplicable. After the
// fix: 0**, with 402 correctly keeping theirs because a leverable reason is shown alongside.
// 📐 **And measured once over the FULL HM+ grid, un-strided — 41,472 attempts → 31,656 notes,
// 15,888 naming the cap: still 0.** The stride is a cost decision, not a coverage claim: at
// stride 7 this single arm cost 29.4s, **98.2% of `check:slow`'s budget**, which is a thing to
// fix rather than to baseline.
// ⚠️ I first wrote "5,432 plans" for a corpus that was 5,926 attempts / 4,522 notes — NEITHER
// figure. **A denominator with no corpus named cannot be checked by the next reader**, and this
// one was wrong in a direction nobody could see. Every figure above names its corpus.
//
// 🔴 AND A CLAIM OF MINE WAS WRONG, RECORDED HERE RATHER THAN QUIETLY DROPPED. I said a
// flag-based gate (`heldByInjury && lrFails && !volumeFails && !ratioFails`) left 856 plans
// wrong and that reading `shown` fixed them. **Measured: the two gates are IDENTICAL, both 0.**
// The 856 was my PROBE's regex missing the reason text *"Your biggest week reaches N km"* —
// the probe was wrong, not the flag gate, which is why every arm below names the exact shipped
// reason text instead of a paraphrase.
//
// 🔑 THE TWO ARE EQUIVALENT BY CONSTRUCTION, and code review corrected my proof of THAT too.
// I wrote that "holds steady" requires `!lrFails`. It does not — its guard is `ratioFails &&
// !volumeFails`, and a shipped note in `goldenPlans.test.ts.snap` carries both sentences. The
// real reason is stronger: **"holds steady" and "biggest week" are mutually exclusive**, so
// `reasons.length <= 2` always and `slice(-2)` is an identity. All-unmovable is therefore
// exactly the flag gate's condition, verbatim.
// ⚠️ **SO NO ARM HERE CAN TELL THEM APART, AND THAT IS STATED RATHER THAN DISCOVERED** —
// reverting the engine to the flag gate leaves this file green. The `shown`-based form is kept
// because it reads what the runner reads, so a THIRD reason (§45's week-on-week cap, a taper
// constraint) stays correct here and would silently break a flag gate.

import { describe, it, expect } from 'vitest'
import { cohortGrid, COHORT_PLAN_START } from './cohortGrid'
import { generateRulePlan } from './ruleEngine'
import { isDesignedRefusal } from './designedRefusal'
import { longRunTimeCap } from './longRunTimeCap'
import type { GeneratorInput, Plan } from '@/types/plan'

/** The levers the note can offer. All three lift weekly volume; none lifts the long run. */
const LEVER = /If you want it to build instead:/
/** The reasons a lever CAN move, by their exact shipped text. */
const LEVERABLE = /Your weekly mileage holds steady|Your biggest week reaches|already where this distance wants it|sharpens rather than builds/
/** The long run held by an injury ceiling — nothing the runner changes moves it. */
const CAP_NAMED = /history keeps the long run to/

interface Row { input: GeneratorInput; note: string }

/** Back / plantar histories at HM and up — the cell neither standing grid contains. */
function corpus(): Row[] {
  const base = (cohortGrid() as GeneratorInput[]).filter(i => i.race_distance_km >= 21.1)
  const out: Row[] = []
  for (const injury of [['back'], ['Plantar fasciitis']]) {
    // Stride 23, not 7: same verdict (0 either way, and 0 un-strided), 5.8s instead of 29.4s.
    for (let i = 0; i < base.length; i += 23) {
      const input = { ...base[i]!, injury_history: injury } as GeneratorInput
      try {
        const plan = generateRulePlan(input, 'paid', COHORT_PLAN_START) as Plan
        const note = plan.meta.volume_constraint_note
        if (note) out.push({ input, note })
      } catch (e) { if (!isDesignedRefusal(e)) throw e }
    }
  }
  return out
}

// ⚠️ LAZY, NOT MODULE-SCOPE. Generating this corpus costs ~16s, and at module scope that lands
// in IMPORT time, where `check:slow`'s new-slow-test and drift rules cannot see it at all. The
// first arm to run pays it, and the duration gate then governs this file like any other.
let _rows: Row[] | null = null
const rows = (): Row[] => (_rows ??= corpus())
const capRows = (): Row[] => rows().filter(r => CAP_NAMED.test(r.note))

describe('NOTE-LEVER-INJURY-CAP-01 — the note never offers a lever that cannot move what it named', () => {
  it('the CONSTRUCTED cohort is real, and the standing grids do not contain it', () => {
    // An empty population passes every arm below, and this cell is one neither grid builds.
    expect(rows().length, 'no back/plantar maintenance notes generated').toBeGreaterThan(1_000)
    expect(capRows().length, 'no note names the injury ceiling — re-point this corpus')
      .toBeGreaterThan(500)
    // The premise: cohortGrid genuinely carries no injury, so this corpus is not redundant.
    expect((cohortGrid() as GeneratorInput[]).every(i => (i.injury_history ?? []).length === 0),
      'cohortGrid now varies injury — this corpus may be redundant, re-check').toBe(true)
  })

  it('🔴 no note offers a lever when every reason it SHOWS is unmovable', () => {
    const bad = capRows().filter(r => LEVER.test(r.note) && !LEVERABLE.test(r.note))
    expect(bad.map(r => r.note.slice(0, 180)),
      'the runner is told to change something that cannot move what the note just named')
      .toEqual([])
  })

  it('⚠️ and the levers are NOT suppressed when a leverable reason is shown', () => {
    // The other half, or the fix is an off switch. 402 of the 692 keep their levers because
    // the volume or the ratio also failed and the runner CAN move those.
    const kept = capRows().filter(r => LEVERABLE.test(r.note) && LEVER.test(r.note))
    expect(kept.length, 'the fix suppressed advice that was applicable').toBeGreaterThan(250)
  })

  it('a long run short on WEEKS still gets its levers — only the injury ceiling is unmovable', () => {
    // The discriminator. `leverable: !heldByInjury` is the whole fix, so a healthy runner whose
    // long run merely ran out of weeks must be unaffected.
    const healthy = (cohortGrid() as GeneratorInput[])
      .filter(i => i.race_distance_km >= 21.1)
      .slice(0, 150)
      .map(input => {
        try { return (generateRulePlan(input, 'paid', COHORT_PLAN_START) as Plan).meta.volume_constraint_note }
        catch (e) { if (!isDesignedRefusal(e)) throw e; return null }
      })
      .filter((n): n is string => !!n && /Your longest run reaches/.test(n))
    expect(healthy.length, 'no healthy long-run shortfall in the sample').toBeGreaterThan(5)
    expect(healthy.every(n => !CAP_NAMED.test(n)), 'a healthy runner was told about an injury cap').toBe(true)
    expect(healthy.some(n => LEVER.test(n)), 'a healthy shortfall lost its levers too').toBe(true)
  })

  it('the ceiling owner still says these two histories are the injury-capped ones', () => {
    // If §9 Am. 3's set changes, this corpus is measuring the wrong cohort and should fail
    // loudly rather than quietly testing nothing.
    for (const injury of ['back', 'Plantar fasciitis']) {
      expect(longRunTimeCap({ race_distance_km: 42.2, goal: 'finish', injury_history: [injury] }).source,
        `${injury} no longer carries an injury ceiling`).toBe('injury')
    }
    expect(longRunTimeCap({ race_distance_km: 42.2, goal: 'finish', injury_history: ['knee'] }).source)
      .not.toBe('injury')
  })
})
