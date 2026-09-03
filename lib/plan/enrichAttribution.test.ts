import { describe, it, expect } from 'vitest'
import { violationKey, errorBaseline, violationsIntroducedBy, statusForReason } from './enrichAttribution'
import type { Violation } from './invariants'

// ENRICH-ATTRIB-01 — the 2026-09-02 incident in one sentence: the enricher
// succeeded, and the route threw its output away because the RULE plan was
// already invalid. 2/2 trial plans, 100% failure rate, and the only evidence
// was a bare "failed" string in plan_json.
//
// The contract under test is attribution, not enrichment quality: a violation
// the rule engine produced must never be charged to the AI, and a violation the
// AI genuinely produced must still revert it.

function v(code: string, week: number, day?: string, severity: Violation['severity'] = 'error'): Violation {
  return {
    code, week, day, severity,
    principle_ref: 'test', message: 'test', actual: 0, expected: 0,
  } as Violation
}

describe('violationsIntroducedBy', () => {
  it('does not blame the enricher for a violation the rule plan already had', () => {
    // The exact prod shape: week 12 fri, 35 min against a 30 min weekday cap,
    // present before the AI ran. The enricher cannot set duration_mins at all.
    const pre = [v('INV-PLAN-MAX-WEEKDAY-MINS', 12, 'fri')]
    const baseline = errorBaseline(pre)

    const introduced = violationsIntroducedBy(baseline, pre)

    expect(introduced).toEqual([])
  })

  it('still reverts when the enricher introduces a genuinely new violation', () => {
    const baseline = errorBaseline([v('INV-PLAN-MAX-WEEKDAY-MINS', 12, 'fri')])
    const post = [
      v('INV-PLAN-MAX-WEEKDAY-MINS', 12, 'fri'),   // pre-existing — not the AI's
      v('INV-PLAN-COPY-MATCHES-SESSIONS', 3),      // new — the AI's
    ]

    const introduced = violationsIntroducedBy(baseline, post)

    expect(introduced.map(x => x.code)).toEqual(['INV-PLAN-COPY-MATCHES-SESSIONS'])
  })

  it('treats the same code on a different week as new, not as pre-existing', () => {
    // Guards the code-only shortcut: matching on code alone would let the AI
    // break week 3 for free because the engine had already broken week 12.
    const baseline = errorBaseline([v('INV-PLAN-COPY-MATCHES-SESSIONS', 12)])
    const post = [v('INV-PLAN-COPY-MATCHES-SESSIONS', 3)]

    expect(violationsIntroducedBy(baseline, post)).toHaveLength(1)
  })

  it('ignores warning-severity violations on both sides', () => {
    const baseline = errorBaseline([v('SOME-WARN', 1, undefined, 'warn')])
    expect(baseline.size).toBe(0)
    expect(violationsIntroducedBy(baseline, [v('SOME-WARN', 1, undefined, 'warn')])).toEqual([])
  })

  it('keys on code, week and day together', () => {
    expect(violationKey(v('X', 4, 'mon'))).not.toBe(violationKey(v('X', 4, 'tue')))
    expect(violationKey(v('X', 4, 'mon'))).toBe(violationKey(v('X', 4, 'mon')))
  })
})

describe('statusForReason', () => {
  // The ask this closes: "API/proxy errored" and "model returned unparseable
  // output" must be distinguishable from the persisted row alone.
  it('separates transport/API failure from unparseable model output', () => {
    expect(statusForReason('api_error')).toBe('failed_api_error')
    expect(statusForReason('fetch_failed')).toBe('failed_api_error')
    expect(statusForReason('parse_error')).toBe('failed_unparseable')
    expect(statusForReason('schema_invalid')).toBe('failed_unparseable')
  })

  it('flags a missing key as its own deploy-config state', () => {
    expect(statusForReason('no_api_key')).toBe('failed_no_api_key')
  })

  it('never returns the legacy bare "failed"', () => {
    const all = ['no_api_key', 'api_error', 'fetch_failed', 'parse_error', 'schema_invalid'] as const
    for (const r of all) expect(statusForReason(r)).not.toBe('failed')
  })
})
