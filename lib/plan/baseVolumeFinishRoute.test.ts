// REFUSAL-FINISH-ROUTE-01 — the refusal offers the door §117 can actually open,
// and ONLY when §117 will actually open it.
//
// ⚠️ THE FALSE-OFFER IS THE DEFECT THIS GUARDS, NOT THE MISSING ONE.
// Measured across the full marathon envelope (10,752 inputs): 4.8% of marathon
// runners are refused while asking for a time, and only 0.4pp of them would
// generate as a finisher. An unconditional "switch to finishing" would send
// 92% of takers into a SECOND refusal. So both directions are asserted, and the
// negative direction is the one that matters.

import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { REFUSAL_NAMES_NEXT_STEP } from './envelopeMeasure'
import { isDesignedRefusal } from './designedRefusal'
import type { GeneratorInput } from '@/types/plan'

const PLAN_START = '2026-11-02'

/**
 * ⚠️ TAKEN FROM `distanceEnvelope(42.2)`, NOT INVENTED.
 *
 * Three drafts of this fixture reached the offer ZERO times, and each time the
 * reach assertion — not the offer logic — is what said so:
 *   1. no `age`            → InputFieldError before any refusal
 *   2. race dates before `plan_start` → negative runway, PrepTimeError first
 *   3. no `acknowledged_prep_warning` → §44 refuses before §111 is ever reached
 *
 * The cohort is narrow and every field below is load-bearing. `longest_recent_run_km`
 * especially: at 8 km/week with an 8 km longest run the runner clears §117's door
 * and never needs the offer at all.
 */
const base = (o: Partial<GeneratorInput>): GeneratorInput => ({
  athlete_name: 'Test',
  age: 28,
  race_name: 'Target race',
  primary_metric: 'distance',
  race_distance_km: 42.2,
  race_date: '2027-02-22',
  plan_start: PLAN_START,
  goal: 'time_target',
  fitness_level: 'beginner',
  training_age: '6-18mo',
  resting_hr: 55,
  max_hr: 185,
  current_weekly_km: 8,
  longest_recent_run_km: 4,
  days_available: 3,
  injury_history: [],
  hard_session_relationship: 'neutral',
  recent_quality_training: 'occasional',
  acknowledged_days_warning: true,
  acknowledged_prep_warning: true,
  target_time: '4:15:00',
  ...o,
} as GeneratorInput)

/** Generate, and report whether it was a designed refusal. */
function tryGen(input: GeneratorInput) {
  try { return { ok: true as const, plan: generateRulePlan(input, 'paid', PLAN_START) } }
  catch (e) { return { ok: false as const, designed: isDesignedRefusal(e), err: e as Error } }
}

describe('a time-goal refusal offers the finish route when §117 can grant it', () => {
  it('the offer only appears when switching the goal ACTUALLY generates a plan', () => {
    // The whole guard: for every case where the refusal makes the offer, the
    // offer must be honoured. Walk a spread of volumes and runways rather than
    // asserting one hand-picked case.
    // ⚠️ `longest_recent_run_km` IS PART OF THE COHORT, NOT A DETAIL. The first
    // draft set it to min(cwk, 8) and reached the offer ZERO times: at 8 km/wk
    // with an 8 km longest run the runner clears §117's door and never needs
    // it. The real cohort — measured off the envelope — is cwk 8 with a longest
    // run of 4 and three days a week. A fixture that misses the cohort produces
    // a green test about nobody.
    let offered = 0, honoured = 0
    for (const cwk of [4, 6, 8, 10, 12, 15]) {
      for (const longest of [3, 4, 6]) {
      for (const days of [3, 4, 5]) {
      for (const raceDate of ['2027-01-25', '2027-02-22', '2027-03-22', '2027-05-31']) {
        const input = base({ current_weekly_km: cwk, longest_recent_run_km: longest, days_available: days, race_date: raceDate })
        const r = tryGen(input)
        if (r.ok || !r.designed) continue
        const msg = String(r.err.message)
        if (!/switch your goal to finish/i.test(msg)) continue
        offered++
        // THE OFFER, TAKEN. It must produce a plan.
        const taken = tryGen({ ...input, goal: 'finish' })
        if (taken.ok) honoured++
      }}}
    }
    expect(offered, 'the corpus must actually reach the offer, or this test proves nothing').toBeGreaterThan(0)
    expect(honoured, `every offer must be honoured; ${offered - honoured} of ${offered} led to a second refusal`).toBe(offered)
  })

  it('the offer still satisfies §44 — it names a next step by the measure\'s own regex', () => {
    // ⚠️ THIS IS THE ASSERTION MY CHANGE BROKE AND MY FIRST TEST MISSED.
    // `REFUSAL_NAMES_NEXT_STEP` proves §44's obligation by matching PROSE, so a
    // reworded refusal can be more actionable and score as a dropout. It did:
    // useCaseEnvelope.test.ts went red on 0.1% of marathon runners while the
    // message was literally offering them a plan.
    let checked = 0
    for (const cwk of [4, 6, 8, 10, 12]) {
      for (const longest of [3, 4, 6]) {
        const r = tryGen(base({ current_weekly_km: cwk, longest_recent_run_km: longest }))
        if (r.ok || !r.designed) continue
        checked++
        expect(REFUSAL_NAMES_NEXT_STEP.test(String(r.err.message)),
          `refusal names no next step: "${r.err.message}"`).toBe(true)
      }
    }
    expect(checked, 'no refusal was reached; this proves nothing').toBeGreaterThan(0)
  })

  it('a runner ALREADY asking to finish is never offered a goal switch', () => {
    const input = base({ current_weekly_km: 4, longest_recent_run_km: 3, goal: 'finish' })
    const r = tryGen(input)
    if (r.ok) return // generated; nothing to assert
    expect(String(r.err.message)).not.toMatch(/switch your goal to finish/i)
  })

})

// ── Falsification. A guard that cannot go red is decoration. ────────────────
describe('the guard can fail', () => {
  it('would catch an UNCONDITIONAL offer', () => {
    // Simulate the defect: an offer made to a runner §117 cannot serve. An
    // experienced runner at 4 km/week fails §117's level gate, so a refusal
    // that offered them the finish route would be making a false promise.
    const input = base({ current_weekly_km: 4, longest_recent_run_km: 3, fitness_level: 'experienced' })
    const r = tryGen(input)
    expect(r.ok, 'this input must refuse, or the case proves nothing').toBe(false)
    if (r.ok) return
    // The real refusal must NOT offer the route...
    expect(String(r.err.message)).not.toMatch(/switch your goal to finish/i)
    // ...because taking it would refuse them again. Prove that.
    const taken = tryGen({ ...input, goal: 'finish' })
    expect(taken.ok, 'if this generated, the level gate changed and the offer WOULD be honourable').toBe(false)
  })

  it('the offer text and the honouring path agree on the predicate', () => {
    const input = base({ current_weekly_km: 8, longest_recent_run_km: 5 })
    const r = tryGen(input)
    if (r.ok) return
    const offers = /switch your goal to finish/i.test(String(r.err.message))
    const taken = tryGen({ ...input, goal: 'finish' })
    expect(offers).toBe(taken.ok)
  })
})
