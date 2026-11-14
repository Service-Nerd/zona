import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput } from '@/types/plan'

// §40c Amendment 1 (Coaching Board 2026-11-14, `SHORTFALL-PINNED-DAY-BUDGET-01`).
//
// `volumeShortfallPct`'s materiality test counted a weekday easy run as pinned against
// `max_weekday_mins` — the MINIMUM across running weekdays — so a Tuesday run of 85 minutes
// against a 90-minute Tuesday budget the runner gave us counted as pinned at 35.
//
// 📐 MEASURED ON THE ENGINE, before and after the producer change: **765 plans, 336 -> 333 notes.
// Three plans, all marathon / 20 km a week / 3 days / finish-goal / roomy-majority budgets.**
//
// 🔴 TWO EARLIER FIGURES FOR THIS WERE MINE AND BOTH WERE WRONG, in the same way twice:
//   · the filing item said 39 of 2,055 plans flip and 34 notes go silent;
//   · I then measured 1,536 flips and 456 silences on a grid — **by recomputing the pinned share
//     in my own probe**, which is a different quantity. `day_budgets` also changes the plan the
//     engine BUILDS, so most of those plans no longer had a shortfall to declare at all.
// Only a before/after run of the real producer answers it, and the answer is 3.
//
// 🔴 AND THE FIRST VERSION OF THIS FILE WAS HOLLOW: it recomputed the share and asserted on its
// own arithmetic, so reverting the producer — and even making it return null for everybody — left
// every arm green. A test that asserts its own copy of the producer cannot catch the producer
// (`DELOAD-OWNER-01`). Every arm below reads `plan.meta`, on the inputs the diff actually named.
const BASE = {
  age: 34, terrain: 'road' as const, benchmark: { time: '2:20:00', type: 'race' as const, distance_km: 21.1 },
  race_date: '2027-04-25', race_name: 'R', training_age: '1-2yr' as const, injury_history: [],
  user_declared_level: 'intermediate' as const, preferred_long_run_day: 'sun' as const,
  recent_quality_training: 'occasional' as const, hard_session_relationship: 'neutral' as const,
  days_cannot_train: [], goal: 'finish' as const,
  race_distance_km: 42.2, current_weekly_km: 20, longest_recent_run_km: 20, days_available: 3,
}
const PS = '2026-12-07'
/** One tight day the runner must keep, four they told us are roomy. */
const roomyAround = (tight: number) => ({ mon: 95, tue: 95, wed: 95, thu: tight, fri: 95 })
const gen = (extra: Record<string, unknown>) =>
  generateRulePlan({ ...BASE, ...extra } as unknown as GeneratorInput, 'paid', PS)

describe('§40c Am. 1 — pinned is measured against that day\u2019s budget', () => {
  it('the share is a named constant, not a literal', () => {
    // 🔴 It was a bare 0.25 in ruleEngine.ts AND again in invariants.ts: §40c's own materiality
    // test, a literal in the engine it governs.
    expect(GENERATION_CONFIG.VOLUME_SHORTFALL_PINNED_SHARE).toBe(0.25)
  })

  it('the THREE plans the before/after diff named go silent', () => {
    // These are the whole measured population, so they are the whole claim. Under the old
    // reading each carried a `volume_shortfall_note`; the cap it named was a ceiling four of
    // their five weekdays do not have.
    for (const mwm of [30, 35, 45]) {
      const plan = gen({ max_weekday_mins: mwm, day_budgets: roomyAround(mwm) })
      expect(plan.meta?.volume_shortfall_note ?? null, `mwm=${mwm} roomy-majority`).toBeNull()
    }
  })

  it('and the same runner WITHOUT those budgets is still told — the gate did not just go quiet', () => {
    // ⚠️ The arm above alone passes on a change that silences the note for everybody, which is
    // mutation 2 and it went red here. Same input, no `day_budgets`: one real cap, one real note.
    for (const mwm of [30, 35, 45]) {
      const plan = gen({ max_weekday_mins: mwm })
      expect(plan.meta?.volume_shortfall_note, `mwm=${mwm} single cap`).toBeTruthy()
    }
  })

  it('a one-roomy-day runner is unaffected, which bounds the change', () => {
    // Bounding arm: the ruling is not a licence to silence any plan carrying `day_budgets`.
    // ⚠️ THE INPUT IS TAKEN FROM THE MEASURED KEY LIST, not from my idea of a plausible one. My
    // first two attempts asserted a note on inputs that carry none in EITHER reading — absent
    // before, absent after, nothing to bound. `10K / 20 km / 3 days / 30 min / finish / oneRoomy`
    // is in the after-state key list, so a note there is a fact rather than an expectation.
    const plan = gen({ race_distance_km: 10, max_weekday_mins: 30,
      day_budgets: { mon: 30, tue: 95, wed: 30, thu: 30, fri: 30 } })
    expect(plan.meta?.volume_shortfall_note, 'one roomy day still declares').toBeTruthy()
  })
})
