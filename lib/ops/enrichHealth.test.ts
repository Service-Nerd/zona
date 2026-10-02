// OPS-ENRICH-HEALTH-01 — the judgement, and the denominator that makes it honest.
//
// 🔴 THIS FILE EXISTS BECAUSE I GOT THE DENOMINATOR WRONG AND REPORTED IT. I
// computed a failure rate from ops_events as `failed / (failed + server_saved)`
// and told the founder **67%** — in two commit messages, a registry row and the
// build log. `plan_enrich_server_saved` fires only when the server's backstop had
// to write, so it is a SUBSET of successes, not a success counter. Measured
// against the plans table instead: 18 eligible, 16 with voice, **2 without — 11%.**
import { describe, it, expect } from 'vitest'
import { judgeEnrichHealth, enrichmentStateOf, type EnrichStateRow } from './enrichHealth'

const row = (enrichment: string | null, user = 'u', at = '2026-10-02T10:00:00Z'): EnrichStateRow =>
  ({ user_id: user, created_at: at, enrichment })

describe('OPS-ENRICH-HEALTH-01', () => {
  it('1. free-tier `skipped` is NOT a failure and must not enter the denominator', () => {
    // A free plan is never enriched BY DESIGN. Counting it would deflate the rate
    // and make a real problem look smaller — the direction nobody questions.
    const v = judgeEnrichHealth([row('skipped'), row('skipped'), row('applied')])
    expect(v.eligible).toBe(1)
    expect(v.withoutVoice).toBe(0)
    expect(v.alert).toBe(false)
  })

  it('2. a LEGACY plan with no field is excluded — absent is not failed', () => {
    const v = judgeEnrichHealth([row(null), row(null), row('applied')])
    expect(v.eligible).toBe(1)
    expect(v.withVoice).toBe(1)
  })

  it('3. `applied_partial` HAS voice — it is the containment working, not a failure', () => {
    // 38 of 43 recorded failures were partial reverts. Treating them as failures is
    // how I first reported 43 users harmed when the real number was 2.
    const v = judgeEnrichHealth([row('applied_partial'), row('applied_partial'), row('applied')])
    expect(v.withVoice).toBe(3)
    expect(v.withoutVoice).toBe(0)
    expect(v.alert).toBe(false)
  })

  it('4. 🔴 a failed state is a runner with NO voice, and ANY of them alerts', () => {
    const v = judgeEnrichHealth([
      row('applied'), row('applied_partial'),
      row('failed_invalid_copy', 'a8263c02', '2026-09-26T07:08:00Z'),
      row('failed_unparseable', 'a2bd36da', '2026-10-02T14:46:00Z'),
    ])
    expect(v.eligible).toBe(4)
    expect(v.withoutVoice).toBe(2)
    expect(v.withoutVoicePct).toBe(50)
    expect(v.alert).toBe(true)
    // The affected list IS the remediation target, oldest first.
    expect(v.affected.map(a => a.user_id)).toEqual(['a8263c02', 'a2bd36da'])
  })

  it('5. a stuck `pending` runner has no voice either and is not quietly excluded', () => {
    // ENRICH-SAVE-01: `pending` is expected transiently. A runner still holding it
    // has no model copy, so excluding it would hide exactly the persistent case
    // that doc calls a defect.
    const v = judgeEnrichHealth([row('pending')])
    expect(v.withoutVoice).toBe(1)
    expect(v.alert).toBe(true)
  })

  it('6. an empty fleet is not a clean bill of health, and divides by nothing', () => {
    const v = judgeEnrichHealth([])
    expect(v.eligible).toBe(0)
    expect(v.withoutVoicePct, 'must not be 0% — there is nothing to divide').toBeNull()
    expect(v.alert).toBe(false)
  })

  it('7. enrichmentStateOf reads the self-describing field, null for legacy', () => {
    expect(enrichmentStateOf({ meta: { enrichment: 'applied' } } as never)).toBe('applied')
    expect(enrichmentStateOf({ meta: {} } as never)).toBeNull()
    expect(enrichmentStateOf(null)).toBeNull()
  })
})
