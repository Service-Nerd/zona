import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { validateStoredPlan } from './validateStoredPlan'
import { validateReshapedPlan } from './invariants'
import type { Plan } from '@/types/plan'

/**
 * RESHAPE-VALIDATOR-KIND-01 (2026-11-03) — the adjust path must ask which CONSTITUTION
 * applies to this plan's KIND, exactly as the daily audit already does.
 *
 * 🔴 WHY THIS EXISTS AND WHY IT IS A GATE RATHER THAN A FIX. `validateStoredPlan` was
 * written on 2026-10-09 for precisely this defect — the daily audit was running the race
 * validator over every stored plan, producing 101 phantom violations on the 2 base-build
 * plans then in the fleet. **The audit was converted and `/api/adjust-plan` was not**, so
 * for a month the path a runner actually waits on asked a plan with no start line whether
 * it had annotated its prep time.
 *
 * Measured against production, 2026-11-03: 3 stored plans are `plan_kind: 'base_build'`.
 * The adjust path reported 59 / 21 / 41 errors; the dispatching owner reports 0 for all
 * three. Because `/api/adjust-plan` refuses on any error, all 3 runners were refused on
 * every adjustment for 121 violations that were not theirs.
 *
 * ⚠️ THE SOURCE ARMS ARE BOUNDED ON LANDMARKS, NEVER A CHARACTER COUNT. Twice in two days
 * (the delete gate on 11-02, the refusal test on 11-03) a byte window over
 * comment-stripped source was eaten by the very comment explaining the fix, and the
 * symptom both times was a test reporting the thing just fixed as broken — which is
 * indistinguishable from a true positive until somebody reads it.
 */

const SRC = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')

/** Blank comment bodies while PRESERVING offsets, so a prose mention of a function name
 *  cannot satisfy — or trip — a source arm. Same device as the pre-commit hook's
 *  `strip_comments` (HOOK-RGBA-COMMENTS-01). */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, m => m.replace(/[^\n]/g, ' '))
}

/** The lines of a function body, found by its OPENING LANDMARK and closed at the next
 *  top-level `}` — not by counting characters forward. */
function bodyAfter(src: string, landmark: string): string {
  const code = stripComments(src)
  const at = code.indexOf(landmark)
  expect(at, `landmark not found, so this arm proves nothing: ${landmark}`).toBeGreaterThan(-1)
  const lines = code.slice(at).split('\n')
  const out: string[] = []
  for (const line of lines) {
    out.push(line)
    if (out.length > 1 && /^\}/.test(line)) break
  }
  return out.join('\n')
}

/** A base-build plan, as production stores one: every week carries `phase: 'base_build'`,
 *  which `validatePlan` skips per §116 — so the race rules then run against a plan that
 *  has no race week, no taper and no peak.
 *
 *  🔴 THE SESSIONS NOW SUM TO `weekly_km`, AND THEY DID NOT. This fixture declared
 *  `weekly_km: 20 + i * 2` (20 → 30) while its sessions always totalled 5 + 5 + 10 = 20 km,
 *  so from week 2 the stored figure overstated the placed one by 10% rising to 50%. It
 *  passed for as long as nothing compared the two — and `INV-PLAN-ONRAMP-DELIVERED-MATCHES`
 *  (§116 Amendment 12) caught it on its first run, firing on weeks 2–6.
 *
 *  ⚠️ The docstring above said "as production stores one", which was the part that made it
 *  hard to doubt. Production stores the PLACED total; this stored an intention. The
 *  `fixtures-must-use-product-values` class. */
function baseBuildPlan(): Plan {
  const weeks = Array.from({ length: 6 }, (_, i) => {
    const weekly = 20 + i * 2
    // §9's shape: the long run is half the week, the two easy runs a quarter each.
    const easy = Math.round(weekly / 4 * 10) / 10
    const long = Math.round((weekly - easy * 2) * 10) / 10
    return {
      n: i + 1,
      phase: 'base_build',
      weekly_km: weekly,
      sessions: {
        tue: { type: 'easy', label: 'Easy run', distance_km: easy, zone: 'Zone 2', pace_target: '6:30–7:30 /km' },
        thu: { type: 'easy', label: 'Easy run', distance_km: easy, zone: 'Zone 2', pace_target: '6:30–7:30 /km' },
        sat: { type: 'easy', label: 'Long run', distance_km: long, zone: 'Zone 2', pace_target: '6:30–7:30 /km' },
        sun: { type: 'rest', label: 'Rest' },
      },
    }
  }) as unknown as Plan['weeks']
  return {
    meta: {
      plan_kind: 'base_build',
      base_build_start_km: 20,
      race_distance_km: 10,
      race_date: '2027-06-01',
      goal: 'finish',
      days_available: 4,
      age: 40,
      generator_input: {
        race_date: '2027-06-01', race_distance_km: 10, goal: 'finish',
        current_weekly_km: 20, longest_recent_run_km: 10, days_available: 4, age: 40,
        days_cannot_train: [],
      },
    },
    weeks,
  } as unknown as Plan
}

describe('RESHAPE-VALIDATOR-KIND-01 — the adjust path dispatches by plan kind', () => {
  // ── BEHAVIOURAL: the two validators genuinely disagree on a base-build plan ──
  //
  // This is the arm that matters. If these two ever returned the same thing, the whole
  // item would be cosmetic and the source arms below would be guarding nothing.
  it('the race validator reports errors on a base-build plan and the dispatching owner does not', () => {
    const plan = baseBuildPlan()
    const byRace = validateReshapedPlan(plan).filter(v => v.severity === 'error')
    const byKind = validateStoredPlan(plan).filter(v => v.severity === 'error')

    expect(byRace.length,
      'the race validator no longer fires on a base-build plan, so this item has been fixed elsewhere ' +
      'and these arms need re-deriving rather than keeping',
    ).toBeGreaterThan(0)
    expect(byKind.length,
      'the dispatching owner now reports errors on a clean base-build plan — §116 has changed, ' +
      'or this fixture no longer satisfies it',
    ).toBe(0)
  })

  it('a race plan is judged identically by both, so strictness did not move', () => {
    // §116 dispatch must change the question asked of a NON-race plan and nothing else.
    const plan = baseBuildPlan()
    const asRace = JSON.parse(JSON.stringify(plan)) as Plan
    ;(asRace.meta as unknown as Record<string, unknown>).plan_kind = 'race'
    for (const w of asRace.weeks) (w as unknown as Record<string, unknown>).phase = 'base'

    expect(validateStoredPlan(asRace, 3)).toEqual(validateReshapedPlan(asRace, 3))
  })

  // ── SOURCE: the producer actually calls the owner ──
  //
  // 🔴 THIS ARM PINNED A SPELLING AND BROKE ON A CORRECT CHANGE, WITHIN THE HOUR. It
  // required the literal `validateStoredPlan(updatedPlan, weekN)`. §134 then introduced a
  // local `errs` helper so BOTH plans go through the same validator at the same week scope
  // — strictly better, and the arm went red on it. **Assert the EFFECT: the dispatching
  // owner is what this function validates through, and the race validator is not called
  // here at all.** A check keyed on a spelling guards the spellings it knows.
  it('runAdjustmentEngine validates through validateStoredPlan, not validateReshapedPlan', () => {
    const body = bodyAfter(SRC('lib/coaching/adjustmentEngine.ts'),
      'export function runAdjustmentEngine(')

    expect(body, 'the adjust path no longer validates through the kind-dispatching owner — RESHAPE-VALIDATOR-KIND-01')
      .toMatch(/validateStoredPlan\(/)
    expect(body, 'the adjust path is back on validateReshapedPlan, which cannot see a plan kind')
      .not.toMatch(/validateReshapedPlan\(/)
    // And the call is SCOPED, which is what makes the §134 diff comparable.
    //
    // ⚠️ THE FIRST VERSION OF THIS LINE WAS HOLLOW AND FALSIFYING IT SAID SO. It asserted
    // `/weekN/` against the whole body — and `weekN` appears in `applyAdjustmentToPlan`
    // too, so dropping the scope from the VALIDATOR call left it green. It asserted that
    // the identifier exists somewhere, which was never in doubt. Match the call's second
    // argument instead.
    expect(body, 'the validator is called unscoped, so the two sides of the §134 diff ask different questions')
      .toMatch(/validateStoredPlan\([^)]*,[^)]*\)/)
  })

  // ── THE TWIN. A check that mirrors a caller must move WITH that caller ──
  //
  // `audit-stored-plans.ts` exists to answer "what does my working tree do to the plans
  // runners already have?", and it is only an answer while it asks the question the route
  // asks. Left on `validateReshapedPlan` it would have reported the 3 base-build plans as
  // refused on 121 errors after the route had stopped refusing them.
  it('audit:stored asks the same question the route asks', () => {
    const src = stripComments(SRC('scripts/audit-stored-plans.ts'))
    expect(src, 'audit:stored no longer mirrors /api/adjust-plan, so its numbers are not production')
      .toMatch(/validateStoredPlan\(plan\)/)
    expect(src, 'audit:stored drifted back to the race validator while the route dispatches')
      .not.toMatch(/validateReshapedPlan\(/)
  })

  // ── The owner documents both consumers, because narrow naming is why one was missed ──
  it('validateStoredPlan names the adjust path as a consumer, not only the daily audit', () => {
    const doc = SRC('lib/plan/validateStoredPlan.ts')
    const header = doc.slice(0, doc.indexOf('export function validateStoredPlan'))
    expect(header.match(/ADJUST PATH/i),
      'the owner documents only the daily audit again — the exact framing that made the second ' +
      'consumer look like someone else\'s problem',
    ).toBeTruthy()
  })
})
