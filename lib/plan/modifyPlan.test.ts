import { describe, it, expect } from 'vitest'
import {
  MODIFIABLE_ROWS, canModifyPlan, applyEdits, pendingKeys, editsResetLoggedWeeks,
  modifiableRowsFor, rebuildsBaseBuild, MODIFIABLE_KEYS_BY_PLAN_KIND,
  type PlanEdits,
} from './modifyPlan'
import type { GeneratorInput, Plan } from '@/types/plan'

/**
 * P-02 — the modify-plan edit set.
 *
 * ⚠️ THE TEST THAT MATTERS IS `editsResetLoggedWeeks`. `PLAN-WEEK-COLLISION-01`
 * put a plan in front of a real runner that was **94% pre-completed**, because
 * `week_n` is a within-plan coordinate that seven tables used as a cross-plan
 * key. Modify-and-regenerate performs exactly that operation for a living, and
 * this item's filing names the collision as its failure mode and says to read
 * that incident before designing this.
 */
const base: GeneratorInput = {
  race_distance_km: 42.2, race_date: '2027-04-25', plan_start: '2026-09-21',
  goal: 'finish', days_available: 4, current_weekly_km: 30, longest_recent_run_km: 12,
  fitness_level: 'intermediate', age: 38, injury_history: [], terrain: 'road',
} as unknown as GeneratorInput

const plan = (input: GeneratorInput | undefined, raceName = 'London'): Plan => ({
  meta: { race_name: raceName, race_date: input?.race_date, generator_input: input },
  weeks: [],
} as unknown as Plan)

describe('P-02 — the collision semantic is inherited, not re-implemented', () => {
  it('editing the WEEK preserves logged weeks', () => {
    // Same race. The runner's history is theirs and must carry.
    for (const edits of [
      { days_available: 5 },
      { preferred_long_run_day: 'sat' },
      { max_weekday_mins: 45 },
      { days_cannot_train: ['mon'] },
    ] as PlanEdits[]) {
      expect(editsResetLoggedWeeks(plan(base), edits), JSON.stringify(edits)).toBe(false)
    }
  })

  it('editing the BODY preserves logged weeks', () => {
    for (const edits of [
      { injury_history: ['knee'] },
      { terrain: 'trail' },
      { hard_session_relationship: 'avoid' },
    ] as PlanEdits[]) {
      expect(editsResetLoggedWeeks(plan(base), edits), JSON.stringify(edits)).toBe(false)
    }
  })

  it('⚠️ editing the RACE DATE resets them, because that is a different block', () => {
    expect(editsResetLoggedWeeks(plan(base), { race_date: '2027-10-03' })).toBe(true)
  })

  it('re-selecting the SAME race date resets nothing', () => {
    // A no-op edit must not destroy history. The runner opening a picker and
    // closing it unchanged is the commonest interaction there is.
    expect(editsResetLoggedWeeks(plan(base), { race_date: base.race_date })).toBe(false)
  })

  it('a plan with no stored input never claims a reset', () => {
    expect(editsResetLoggedWeeks(plan(undefined), { race_date: '2027-10-03' })).toBe(false)
  })
})

describe('P-02 — the sheet is gated on the stored input', () => {
  it('a generated plan can be modified', () => {
    expect(canModifyPlan(plan(base))).toBe(true)
  })

  it('⚠️ a LEGACY plan cannot, and is not guessed at', () => {
    // Measured against production 2026-09-20: 10 of 22 live plans (45%) have
    // no generator_input. Regenerating from invented answers would change
    // things the runner never asked to change, silently.
    expect(canModifyPlan(plan(undefined))).toBe(false)
    expect(canModifyPlan(null)).toBe(false)
  })
})

describe('P-02 — edits are a sparse overlay, never a second copy of the input', () => {
  it('applying edits does not mutate the stored input', () => {
    const before = JSON.stringify(base)
    applyEdits(base, { days_available: 6 })
    expect(JSON.stringify(base)).toBe(before)
  })

  it('an unchanged value is not a pending edit', () => {
    // Otherwise the bottom bar offers "Apply 1 change" for a picker the runner
    // opened and closed.
    expect(pendingKeys(base, { days_available: 4 })).toEqual([])
    expect(pendingKeys(base, { days_available: 5 })).toEqual(['days_available'])
  })

  it('array order does not make a pending edit', () => {
    const b = { ...base, days_cannot_train: ['mon', 'fri'] } as GeneratorInput
    expect(pendingKeys(b, { days_cannot_train: ['fri', 'mon'] })).toEqual([])
    expect(pendingKeys(b, { days_cannot_train: ['fri'] })).toEqual(['days_cannot_train'])
  })
})

describe('P-02 — the rows and their consequence subtitles', () => {
  it('every row is a real GeneratorInput key', () => {
    for (const r of MODIFIABLE_ROWS) expect(r.key in base || r.key === 'preferred_long_run_day'
      || r.key === 'max_weekday_mins' || r.key === 'hard_session_relationship'
      || r.key === 'days_cannot_train').toBe(true)
  })

  it('⚠️ NO INTENSITY RATIO — the board vetoed it', () => {
    // 80/20 is a session-count observation (CD-19); at four running days
    // 80/20 vs 90/10 is 0.8 vs 0.4 quality sessions and does not quantise.
    const keys = MODIFIABLE_ROWS.map(r => String(r.key))
    expect(keys).not.toContain('intensity')
    expect(keys).not.toContain('intensity_distribution')
    // The governed expression of the same preference IS offered.
    expect(keys).toContain('hard_session_relationship')
  })

  it('every row states a consequence, in the approved pattern', () => {
    for (const r of MODIFIABLE_ROWS) {
      expect(r.consequence.length, r.key).toBeGreaterThan(20)
      // Present tense, blast radius, NO benefit claim.
      expect(r.consequence, r.key).not.toMatch(/better|improve|optimis|boost|smarter|perfect/i)
      // No em dash (BRAND-EMDASH-01).
      expect(r.consequence, r.key).not.toContain('—')
      expect(r.consequence.endsWith('.'), r.key).toBe(true)
    }
  })

  it('the race-date row warns that logged weeks reset', () => {
    // It is the one edit that does, so it is the one subtitle that must say so.
    const row = MODIFIABLE_ROWS.find(r => r.key === 'race_date')!
    expect(row.consequence).toMatch(/logged weeks/i)
  })

  it('no two rows share a key, and every group is used', () => {
    const keys = MODIFIABLE_ROWS.map(r => r.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(new Set(MODIFIABLE_ROWS.map(r => r.group))).toEqual(new Set(['week', 'body', 'race']))
  })
})

/**
 * `BASEBUILD-ADJUST-DOOR-01` — the door stays shut on a base-build plan.
 *
 * 🔴 WHY THIS IS A BEHAVIOURAL ARM AND NOT A SOURCE ASSERTION. A source grep for
 * `'base_build'` in `modifyPlan.ts` passes against this file's own comments, and
 * it passed against the hand-written predicate I wrote first and then replaced
 * with the owner. **The question is what `canModifyPlan` RETURNS**, so that is
 * what is asserted.
 *
 * ⚠️ AND THE STAMP IS PRESENT IN EVERY ARM, deliberately. The old predicate was
 * `!!plan?.meta?.generator_input`, so an UNSTAMPED base-build plan returns false
 * for the old reason and would keep this green with the new line deleted. The
 * fixtures are stamped, which is the state `BASEBUILD-GENINPUT-01` put every
 * future base-build runner in and the state the remediation backfill creates.
 */
describe('BASEBUILD-ADJUST-DOOR-01 — the INTERIM, now superseded and kept for its reason', () => {
  const kinded = (kind: string | undefined): Plan => ({
    meta: { race_name: 'Base building', race_date: '', plan_kind: kind, generator_input: base },
    weeks: [],
  } as unknown as Plan)

  /**
   * 🔴 THREE ARMS HERE ASSERTED THE OPPOSITE THIS MORNING AND ARE REVERSED, NOT DELETED.
   *
   * `BASEBUILD-ADJUST-DOOR-01` withheld the Adjust row from a base-build plan, because
   * the sheet POSTed to the RACE generator and **0 of 27 / 2 of 27 offered edits produced
   * a plan**. That was ruled an **INTERIM** and bound to a destination.
   * `BASEBUILD-ADJUST-REBUILD-01` built the destination: the sheet now rebuilds the BASE
   * BUILD, so the door opens and the ROWS are scoped instead.
   *
   * ⚠️ The reversal is recorded here rather than in the commit, because **a reversed
   * assertion with no reason is one somebody reinstates** — the same discipline applied
   * to `generatorInputStamp.test.ts` when the door ruling reversed IT.
   */
  it('the door is OPEN again, because the sheet no longer regenerates a race plan', () => {
    expect(canModifyPlan(kinded('base_build'))).toBe(true)
  })

  it('a stamped RACE plan was never affected either way', () => {
    expect(canModifyPlan(kinded('race'))).toBe(true)
    expect(canModifyPlan(kinded(undefined))).toBe(true)   // legacy rows carry no plan_kind
  })

  it('🔴 the STAMP alone still does not decide what the sheet SHOWS', () => {
    // The door item's real lesson survives its own reversal: holding the input was never
    // the same question as "can this plan be modified". The answer moved from "no" to
    // "yes, these two rows" — it never became "yes, all eight".
    const bb = kinded('base_build')
    expect(!!bb.meta?.generator_input).toBe(true)
    expect(modifiableRowsFor(bb).length).toBeLessThan(MODIFIABLE_ROWS.length)
  })

  it('names every plan_kind the schema allows, so a new kind is a decision', () => {
    const kinds = ['race', 'maintenance', 'base_build'] as const
    // All modifiable now; what DIFFERS per kind is the row set, asserted below.
    expect(kinds.map(k => canModifyPlan(kinded(k)))).toEqual([true, true, true])
    expect(kinds.map(k => modifiableRowsFor(kinded(k)).length))
      .toEqual([MODIFIABLE_ROWS.length, MODIFIABLE_ROWS.length, 2])
  })
})

describe('BASEBUILD-ADJUST-REBUILD-01 — the sheet offers only what moves the plan', () => {
  const bb = (): Plan => ({
    meta: { plan_kind: 'base_build', race_name: 'Base building', race_date: '',
            generator_input: base },
    weeks: [],
  } as unknown as Plan)

  it('a base-build plan IS modifiable now — the door interim is superseded', () => {
    expect(canModifyPlan(bb())).toBe(true)
  })

  it('offers exactly the two rows measured to change a base-build plan', () => {
    const keys = modifiableRowsFor(bb()).map(r => r.key)
    expect(keys).toEqual(['days_available', 'days_cannot_train'])
  })

  it('🔴 withholds the six that do NOT change the output, including race_date', () => {
    const keys = modifiableRowsFor(bb()).map(r => r.key)
    for (const k of ['preferred_long_run_day', 'max_weekday_mins', 'injury_history',
                     'hard_session_relationship', 'terrain', 'race_date'] as const) {
      expect(keys, `${k} is offered but cannot change a base-build plan`).not.toContain(k)
    }
    // ✋ Silvanto: the "The race" group must not render on a plan whose race_date is
    // deliberately empty. With `race_date` withheld, the group has no rows at all.
    expect(modifiableRowsFor(bb()).some(r => r.group === 'race')).toBe(false)
  })

  it('a RACE plan still gets the full set — the scoping is per kind, not a global cut', () => {
    const race = { meta: { plan_kind: 'race', generator_input: base }, weeks: [] } as unknown as Plan
    expect(modifiableRowsFor(race)).toHaveLength(MODIFIABLE_ROWS.length)
    expect(modifiableRowsFor(null)).toHaveLength(MODIFIABLE_ROWS.length)
  })

  it('every key in the per-kind set is a REAL row, so a typo cannot silently drop one', () => {
    // A key that matches no row would reduce the sheet to nothing with no error.
    const real = new Set(MODIFIABLE_ROWS.map(r => r.key))
    for (const k of MODIFIABLE_KEYS_BY_PLAN_KIND.base_build) {
      expect(real.has(k), `${k} is not a MODIFIABLE_ROWS key`).toBe(true)
    }
    expect(modifiableRowsFor(bb()).length).toBe(MODIFIABLE_KEYS_BY_PLAN_KIND.base_build.length)
  })

  it('rebuildsBaseBuild is the one predicate the request body reads', () => {
    expect(rebuildsBaseBuild(bb())).toBe(true)
    expect(rebuildsBaseBuild({ meta: { plan_kind: 'race' }, weeks: [] } as unknown as Plan)).toBe(false)
    expect(rebuildsBaseBuild(null)).toBe(false)
  })
})
