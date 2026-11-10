import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { duplicateOf, countsTowardCap, CAPPED_STATUSES, type LedgerRowLike } from './adjustmentLedger'

/**
 * ADJUST-LEDGER-DUPLICATE-01 — the five pairs are the fixtures, taken from production.
 *
 * 🔴 THE ITEM'S PREMISE WAS WRONG BY 4× AND SO WAS MY FIRST RE-MEASUREMENT. The item read
 * "8 of 22 rows are duplicates — 4 pairs, 1–7 seconds apart". My first query grouped on
 * `(user, week_n, trigger_type, status)` and reported 12 rows in 6 groups — **including a pair
 * 4.5 DAYS apart**, which is obviously not a double-invocation. Comparing `trigger_detail`
 * settles it: **four of the five sub-ten-second pairs are distinct moves, and exactly one is a
 * duplicate.** 2 of 22 rows, not 8.
 *
 * ⚠️ EVERY ROW BELOW IS A REAL PRODUCTION PAYLOAD, not a plausible one — the recurring trap
 * here is a fixture the product never emits. A reorder's detail is
 * `{toDay, fromDay, hardAdjacentViolation}` and a drift's is `{rpe, source, sessionType}`; a
 * hand-invented shape would make every arm below vacuous.
 */
const row = (id: string, trigger_type: string, trigger_detail: unknown, status = 'auto_applied'): LedgerRowLike =>
  ({ id, status, trigger_type, trigger_detail })

const reorder = (fromDay: string, toDay: string) => ({ toDay, fromDay, hardAdjacentViolation: false })
const DRIFT_DETAIL = { rpe: 8, source: 'rpe_disconnect', sessionType: 'easy' }

describe('ADJUST-LEDGER-DUPLICATE-01 — a re-write, not a second thing the runner did', () => {
  it('🔴 THE ONE TRUE DUPLICATE: week 6 zone_drift, identical payload 4.1s apart', () => {
    const open = [row('a', 'zone_drift', DRIFT_DETAIL, 'reverted')]
    const hit = duplicateOf(open, { trigger_type: 'zone_drift', trigger_detail: { ...DRIFT_DETAIL } })
    expect(hit?.id, 'the duplicate the whole item is about was not caught').toBe('a')
  })

  it('🔴 AND ALL FOUR LEGITIMATE CHAINS STILL WRITE — the index would have forbidden every one', () => {
    // These are the pairs the item counted as duplicates. Each second row must NOT match.
    const cases: Array<[string, LedgerRowLike[], ReturnType<typeof reorder>]> = [
      ['week 21: wed→thu then tue→wed, 2.3s', [row('w21', 'session_reorder', reorder('wed', 'thu'))], reorder('tue', 'wed')],
      ['week 22: wed→thu then tue→wed, 1.6s', [row('w22', 'session_reorder', reorder('wed', 'thu'))], reorder('tue', 'wed')],
      ['week 17: wed→tue then wed→thu, 7.4s', [row('w17', 'session_reorder', reorder('wed', 'tue'))], reorder('wed', 'thu')],
      ['week 15: sat→sun then sat→mon, 9.3s', [row('w15', 'session_reorder', reorder('sat', 'sun'))], reorder('sat', 'mon')],
    ]
    for (const [name, open, second] of cases) {
      expect(duplicateOf(open, { trigger_type: 'session_reorder', trigger_detail: second }),
        `${name} is a real move and was suppressed as a duplicate`).toBeNull()
    }
  })

  it('a different TRIGGER with the same payload is not a duplicate', () => {
    const open = [row('a', 'zone_drift', DRIFT_DETAIL)]
    expect(duplicateOf(open, { trigger_type: 'readiness_signal', trigger_detail: { ...DRIFT_DETAIL } })).toBeNull()
  })

  it('an absent payload matches an absent payload, and not an empty object', () => {
    // `null` and `{}` serialise differently and mean different things: "this trigger carries no
    // detail" versus "it carries one and it is empty".
    expect(duplicateOf([row('a', 't', null)], { trigger_type: 't', trigger_detail: undefined })?.id).toBe('a')
    expect(duplicateOf([row('a', 't', null)], { trigger_type: 't', trigger_detail: {} })).toBeNull()
  })

  it('an empty ledger never reports a duplicate', () => {
    expect(duplicateOf([], { trigger_type: 'zone_drift', trigger_detail: DRIFT_DETAIL })).toBeNull()
  })

  it('🔴 `reverted` is checked for duplicates and does NOT count toward the cap', () => {
    // The two lists were one list before this item. Widening the query to see reverted rows for
    // the duplicate check would otherwise have quietly tightened MAX_ADJUSTMENTS_PER_WEEK, which
    // punishes a runner for rejecting an adjustment.
    expect(duplicateOf([row('a', 'zone_drift', DRIFT_DETAIL, 'reverted')],
      { trigger_type: 'zone_drift', trigger_detail: DRIFT_DETAIL })?.id).toBe('a')
    expect(countsTowardCap({ status: 'reverted' }), 'a rejected adjustment counts against the runner').toBe(false)
    for (const s of ['pending', 'confirmed', 'auto_applied']) {
      expect(countsTowardCap({ status: s }), `${s} must count toward the cap`).toBe(true)
    }
    expect(CAPPED_STATUSES).not.toContain('reverted')
  })

  it('⚠️ the ROUTE uses both owners, and its cap no longer restates the status list', () => {
    // The seam this file cannot otherwise reach: the predicate can be perfect and the route can
    // still hand it the wrong rows, or re-derive the cap inline and drift from CAPPED_STATUSES.
    const src = readFileSync('app/api/adjust-plan/route.ts', 'utf8')
    expect(src).toMatch(/duplicateOf\(weekRows, adjustmentRow\)/)
    expect(src).toMatch(/weekRows\.filter\(countsTowardCap\)/)
    // The query must fetch the payload, or `duplicateOf` compares undefined to undefined and
    // suppresses every adjustment in the week.
    expect(src).toMatch(/\.select\('id, status, trigger_type, trigger_detail'\)/)
    expect(src, 'the week query no longer reads reverted rows, so the duplicate check is blind again')
      .toMatch(/'pending', 'confirmed', 'auto_applied', 'reverted'/)
    // And it must stay scoped to the live plan.
    expect(src).toMatch(/\.is\('superseded_at', null\)/)
  })
})
