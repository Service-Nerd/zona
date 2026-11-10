import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { positionOf, positionStoredPlanDebt } from './storedPlanDebt'
import type { Plan } from '@/types/plan'
import type { Violation } from './invariants'

/**
 * STORED-PLAN-DEBT-REPAIR-01 — the positions are taken from real stored plans,
 * 2026-11-03, because the whole point of the axis is that it changed the answer.
 *
 * ⚠️ WHAT THESE ARMS DO NOT PROVE. Nothing about whether a breach deserves repair
 * (`FLEET-TRIGGER-SEVERITY-01`) and nothing about whether a rewrite is permitted
 * (`regenRefusalReason`, which refuses all six actionable plans). Only position.
 */

const TODAY = new Date('2026-11-03T00:00:00')

const v = (over: Partial<Violation>): Violation => ({
  code: 'INV-PLAN-TEST', principle_ref: '§0', severity: 'error',
  week: 1, message: 'a breach', actual: 1, expected: 2, ...over,
})

/** A plan shaped like `d1c7bbca`: 12 weeks from 2026-06-15, so every week is behind us. */
function planFrom(start: string, weeks: number, firstN = 1): Plan {
  const rows = Array.from({ length: weeks }, (_, i) => {
    const d = new Date(`${start}T00:00:00`)
    d.setDate(d.getDate() + i * 7)
    return { n: firstN + i, date: d.toISOString().slice(0, 10), sessions: {} }
  })
  return { meta: {}, weeks: rows } as unknown as Plan
}

describe('STORED-PLAN-DEBT-REPAIR-01 — where the debt sits in the runner\'s life', () => {
  it('a breach in a week whose window has closed is ELAPSED', () => {
    // d1c7bbca: 12 weeks from 2026-06-15, INV-PLAN-WEEK-1-2-LONG-CAP on weeks 1 and 2.
    // Willy's "breaches in plans people are running" — they ran them, in June.
    const plan = planFrom('2026-06-15', 12)
    expect(positionOf(plan, v({ week: 1 }), TODAY)).toBe('elapsed')
    expect(positionOf(plan, v({ week: 2 }), TODAY)).toBe('elapsed')
  })

  it('a breach in a week still open is AHEAD', () => {
    // 02ed8b4b: INV-PLAN-LONG-CAP-MINS on weeks 14 and 17 of a plan starting 2026-12-07.
    const plan = planFrom('2026-12-07', 23)
    expect(positionOf(plan, v({ week: 14 }), TODAY)).toBe('ahead')
  })

  it('the week containing today is AHEAD, not elapsed — it has not finished', () => {
    // The boundary that decides a repair. `isDatePastWeek` is true only from the
    // END of the window, so the current week is still reachable.
    const plan = planFrom('2026-11-02', 4)   // week 1 = Mon 2 Nov -> Sun 8 Nov
    expect(positionOf(plan, v({ week: 1 }), TODAY)).toBe('ahead')
    // ...and the week that ended yesterday is not.
    const prior = planFrom('2026-10-26', 4)  // week 1 = Mon 26 Oct -> Sun 1 Nov
    expect(positionOf(prior, v({ week: 1 }), TODAY)).toBe('elapsed')
  })

  it('A FOUNDATION WEEK IS A WEEK, and this is the position that changed the item', () => {
    // adcf4e28 / a2bd36da / 02ed8b4b carry §12 easy-pace breaches on weeks -3, -2, -1,
    // which start 2026-11-16. ADR-020's runway weeks hold real dates; reading `n <= 0`
    // as "plan level" would have called three live breaches cosmetic.
    const plan = planFrom('2026-11-16', 3, -3)
    expect(positionOf(plan, v({ week: -3 }), TODAY)).toBe('ahead')
    expect(positionOf(plan, v({ week: -1 }), TODAY)).toBe('ahead')
  })

  it('week 0 is PLAN-LEVEL — the invariant layer means "plan-wide" by it', () => {
    // INV-PLAN-DIFFICULTY-ANNOTATED, INV-PLAN-COMPRESSION-SPLIT, INV-INPUT-LONGEST-LE-WEEKLY.
    // 24 of the fleet's violations sit here; counting them as `ahead` overstates
    // what a repair can reach.
    const plan = planFrom('2026-12-07', 23)
    expect(positionOf(plan, v({ week: 0 }), TODAY)).toBe('plan-level')
  })

  it('a week row whose date is not a string is PLAN-LEVEL, not positioned off a NaN', () => {
    // ⚠️ THE MUTATION HARNESS FOUND THIS GAP, NOT A READ-THROUGH. Flipping the first
    // `||` in the guard to `&&` left every arm green, because the only input that
    // separates the two is a week whose `date` is present but not a string — a shape
    // the fleet does not contain and a malformed stored plan would. Without the guard
    // `parseLocalDate` yields an Invalid Date, every comparison against it is false,
    // and the breach silently reads AHEAD: a repair target invented out of a bad row.
    const plan = { meta: {}, weeks: [{ n: 1, date: 20261116, sessions: {} }] } as unknown as Plan
    expect(positionOf(plan, v({ week: 1 }), TODAY)).toBe('plan-level')
  })

  it('a week number no week carries is PLAN-LEVEL, never guessed at by position', () => {
    const plan = planFrom('2026-12-07', 6)   // weeks 1..6
    expect(positionOf(plan, v({ week: 99 }), TODAY)).toBe('plan-level')
    expect(positionOf(plan, v({ week: undefined }), TODAY)).toBe('plan-level')
  })

  it('splits a whole plan the way the fleet measurement did', () => {
    // 60d4bdd5, the one real paid runner in the set: 12 weeks from 2026-09-21,
    // breaches on weeks 5 and 6 (elapsed) and 10 and 11 (ahead).
    const plan = planFrom('2026-09-21', 12)
    const { ahead, elapsed, planLevel } = positionStoredPlanDebt(plan, [
      v({ week: 5, code: 'INV-PLAN-LR-PROGRESSION-CAP' }),
      v({ week: 6, code: 'INV-PLAN-COACH-NOTES-MATCH-INTENT' }),
      v({ week: 10, code: 'INV-PLAN-PACE-ZONE-COHERENT' }),
      v({ week: 11, code: 'INV-PLAN-PACE-ZONE-COHERENT' }),
      v({ week: 0, code: 'INV-PLAN-DIFFICULTY-ANNOTATED' }),
    ], TODAY)
    expect(elapsed.map(x => x.week)).toEqual([5, 6])
    expect(ahead.map(x => x.week)).toEqual([10, 11])
    expect(planLevel.map(x => x.code)).toEqual(['INV-PLAN-DIFFICULTY-ANNOTATED'])
  })

  it('every violation lands in exactly one bucket', () => {
    const plan = planFrom('2026-09-21', 12)
    const all = [0, -1, 1, 5, 11, 99].map(week => v({ week }))
    const { ahead, elapsed, planLevel } = positionStoredPlanDebt(plan, all, TODAY)
    expect(ahead.length + elapsed.length + planLevel.length).toBe(all.length)
  })
})

/**
 * THE TWIN GATE. A script that validates a plan it read out of `plans` must ask the
 * kind-dispatching owner.
 *
 * 🔴 WHY: `RESHAPE-VALIDATOR-KIND-01` moved `/api/adjust-plan` and `audit:stored`
 * onto `validateStoredPlan` on 2026-11-03 and **left five committed repair scripts
 * on `validateReshapedPlan`** — the same "remedy applied to one twin" the item
 * itself was about, in the same commit that fixed it. A base-build plan handed to
 * the race constitution reports ~50 phantom errors, and these scripts refuse to
 * repair a plan that looks broken.
 *
 * ⚠️ THE POPULATION IS DERIVED, NEVER LISTED. A hand-typed list of scripts is this
 * repo's most-recorded gate failure (`const HOME`, `CONSUMERS`, the six-file
 * `appScreenTitle` list). The arm globs `scripts/`, keeps the files that read the
 * `plans` table, and asserts on those.
 */
describe('STORED-PLAN-DEBT-REPAIR-01 — stored-plan scripts validate by plan KIND', () => {
  const DIR = join(process.cwd(), 'scripts')
  const readsStoredPlans = readdirSync(DIR)
    .filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map(f => ({ f, src: readFileSync(join(DIR, f), 'utf8') }))
    // Comment text cannot make a file a consumer, so strip it first.
    .map(({ f, src }) => ({ f, code: src
      .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
      .replace(/\/\/[^\n]*/g, m => m.replace(/[^\n]/g, ' ')) }))
    .filter(({ code }) => /from\(['"]plans['"]\)/.test(code))

  it('the population is non-empty, or this whole block proves nothing', () => {
    expect(readsStoredPlans.length).toBeGreaterThan(5)
  })

  it.each(readsStoredPlans.map(({ f }) => f))(
    '%s does not validate a stored plan with the race-only validator', name => {
      const { code } = readsStoredPlans.find(x => x.f === name)!
      expect(code,
        `${name} reads the plans table and calls validateReshapedPlan, which cannot see ` +
        'a plan kind — RESHAPE-VALIDATOR-KIND-01. Use validateStoredPlan.',
      ).not.toMatch(/validateReshapedPlan\(/)
    })
})

/**
 * STORED-PLAN-VALIDATOR-INPUT-01 (2026-11-08) — THE OTHER HALF OF THE SAME TWIN.
 *
 * 🔴 The gate above closed `validateReshapedPlan`. It could not see the EIGHT scripts
 * that read `plans` and called `validatePlan(plan, input)` with an input they assembled by
 * hand — so they skipped BOTH things the owner owns: §116's kind dispatch, and the
 * meta-first level merge whose absence is `RUNWALK-ASSESSED-LEVEL-01`.
 *
 * 🔴 AND FOUR OF THE EIGHT PASSED THE PLAN'S `meta` AS THE INPUT, cast through
 * `as never`. `(meta.generator_input ?? meta)` and `{ ...meta }` leave
 * `current_weekly_km`, `longest_recent_run_km`, `days_available` and `days_cannot_train`
 * ABSENT where the reconstruction sets 0/7/[]; an invariant doing arithmetic on `undefined`
 * gets NaN and PASSES. Three of them carried an honest caveat saying only the DELTA was
 * trustworthy, which is exactly why it survived a year: **a declared limit is not a fixed
 * problem.**
 *
 * 🔑 WHAT VIOLATION CLASS THIS FINDS: the ninth such script. Population derived, never
 * listed, by the same glob as the block above.
 *
 * ⚠️ WHAT IT DOES NOT PROVE: that any caller passes the right `profile` or `overlay`, and
 * nothing about scripts that validate FRESHLY GENERATED plans with the input they generated
 * from — that is the save path, and `validateSavedPlan` is correct there.
 */
describe('STORED-PLAN-VALIDATOR-INPUT-01 — stored-plan scripts do not hand-build the input', () => {
  const DIR = join(process.cwd(), 'scripts')
  const stripped = (src: string) => src
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, m => m.replace(/[^\n]/g, ' '))

  /**
   * ⚠️ ONE DECLARED EXEMPTION, BY NAME AND WITH ITS REASON. `recal-live-repair.ts` keeps a
   * single `validatePlan(before, gi)` as the driver of `repairPlan`, which READS those
   * verdicts and acts on them. The owner's verdict set is MORE correct, which means the
   * remedies would do something different on a script that writes to production; they were
   * calibrated against this exact set (9 error-severity violations → 1) on live plans, and
   * that cannot be re-measured from a dev machine. Moving it is its own item.
   */
  /**
   * ✅ THE SECOND EXEMPTION IS GONE — `REENRICH-REPAIR-VALIDATOR-KIND-01`, SHIPPED 2026-11-10.
   *
   * `reenrich-plans.ts` built the baseline `repairEnrichedCopy` compares against while
   * `enrichRepair.ts` called `validatePlan` three times internally, and **both sides of a
   * comparison must use the same function** — so it was recorded rather than half-fixed. Both
   * moved to `validateSavedPlan` in one commit.
   *
   * 📐 Safe because it was measured first: of 41 stored plans with a usable input, **37 get an
   * IDENTICAL verdict**, since for a RACE plan `validateSavedPlan` **is** `validatePlan`. The 4
   * that differ are all `base_build` (59/42/22/13 phantom errors against **0**) and all four
   * carry no AI copy, so `hasAiCopy` refuses them before the ladder today.
   *
   * ⚠️ IT WAS THIS ARM THAT NOTICED. The stale-exemption check below fired the moment the
   * script stopped calling `validatePlan`, which is what it is for.
   */
  const EXEMPT = new Map([
    ['recal-live-repair.ts', 'the repairPlan DRIVER reads these verdicts; see the call site'],
  ])

  const readsStoredPlans = readdirSync(DIR)
    .filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map(f => ({ f, code: stripped(readFileSync(join(DIR, f), 'utf8')) }))
    .filter(({ code }) => /from\(['"]plans['"]\)/.test(code))

  it('the population is non-empty and reaches the scripts that were moved', () => {
    expect(readsStoredPlans.length).toBeGreaterThan(5)
    for (const name of ['backfill-plan-hr.ts', 'repair-plan-zone-strings.ts', 'recompose-foundation.ts']) {
      expect(readsStoredPlans.some(x => x.f === name), `the glob must reach ${name}`).toBe(true)
    }
  })

  it('\u{1F534} no script reads the plans table and calls validatePlan directly', () => {
    const strays = readsStoredPlans
      .filter(({ f, code }) => !EXEMPT.has(f) && /\bvalidatePlan\(/.test(code))
      .map(({ f }) => f)
    expect(
      strays,
      'Use `validateRepairedPlan(plan, { profile })` from lib/plan/validateStoredPlan.ts. It '
      + 'applies §116\'s kind dispatch AND the meta-first level merge, neither of which a '
      + 'hand-built input gets. An exemption goes in EXEMPT with its reason:\n' + strays.join('\n'),
    ).toEqual([])
  })

  it('the exemption is REAL — an exempt name that no longer needs it is a stale exemption', () => {
    // `verify the exemption's justification, not the stamp`: an entry whose file has stopped
    // calling `validatePlan` is dead weight that hides the next genuine offender.
    // `[...someMap]` / `for (const x of someMap)` fail tsc at this target (CLAUDE.md § TypeScript).
    for (const name of Array.from(EXEMPT.keys())) {
      const hit = readsStoredPlans.find(x => x.f === name)
      expect(hit, `${name} is exempted but is not in the population`).toBeTruthy()
      expect(/\bvalidatePlan\(/.test(hit!.code),
        `${name} no longer calls validatePlan — remove it from EXEMPT`).toBe(true)
    }
  })

  it('the derivation owner holds the merge, and the invariant layer does not keep a copy', () => {
    const inv = stripped(readFileSync(join(process.cwd(), 'lib/plan/invariants.ts'), 'utf8'))
    expect(inv).toMatch(/storedPlanInput\(plan\)/)
    // The legacy reconstruction must live in ONE place. Its most distinctive line is the
    // blocked-days default; two copies of it means the extraction was undone.
    const copies = (inv.match(/days_cannot_train:\s*\[\]/g) ?? []).length
    expect(copies, 'the legacy input reconstruction belongs to lib/plan/storedPlanInput.ts only').toBe(0)
  })
})
