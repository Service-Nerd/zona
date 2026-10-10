// AUDIT-STEP-UNDECLARED-01 — the audit must declare its own step.
//
// 🔴 THE DEFECT, REPRODUCED FROM THE LIVE SERIES. `ops_events` on 2026-10-10:
//   10-05  checked 30  invalid 15
//   10-06  checked 30  invalid 20   ← five plans, no new plans
//   10-10  checked 34  invalid 22
// `INV-PLAN-PEAK-RACE-SPECIFIC-REACHED` shipped 2026-10-06 13:55 at severity
// `error`; the audit ran 34 minutes later. The digest could not see that and said
// the rise "most likely reflects the audit seeing more plans". `checked` was flat.
import { describe, it, expect } from 'vitest'
import { summariseCodeStep } from './planAuditCodeStep'

/** The codes actually on breaching plans before and after the 10-06 ship. */
const BEFORE = ['INV-PLAN-COPY-MATCHES-SESSIONS', 'INV-PLAN-HEADER-PACE-MATCHES-WORK',
                'INV-PLAN-OVER-UNDER-MEAN-NEAR-THRESHOLD', 'INV-PLAN-RACE-SPECIFIC-EXPOSURE-RATIO',
                'INV-PLAN-STRIDES-PRESENT']
const AFTER = [...BEFORE, 'INV-PLAN-PEAK-RACE-SPECIFIC-REACHED', 'INV-PLAN-RUNWALK-PRESCRIBED-WHEN-UNREADY']

describe('AUDIT-STEP-UNDECLARED-01', () => {
  it('1. 🔴 names the rule that is new — the 2026-10-06 step, reproduced', () => {
    const r = summariseCodeStep({ codesThisRun: AFTER, prevCodesSeen: BEFORE })
    expect(r.codes_new_since_last_run).toEqual([
      'INV-PLAN-PEAK-RACE-SPECIFIC-REACHED', 'INV-PLAN-RUNWALK-PRESCRIBED-WHEN-UNREADY',
    ])
    expect(r.codes_seen).toContain('INV-PLAN-PEAK-RACE-SPECIFIC-REACHED')
  })

  it('2. ABSENT, not present-and-empty, when nothing is new', () => {
    const r = summariseCodeStep({ codesThisRun: BEFORE, prevCodesSeen: BEFORE })
    expect('codes_new_since_last_run' in r,
      'a line reading "new codes: 0" every morning is the noise this field avoids').toBe(false)
    expect(r.codes_seen.length).toBe(BEFORE.length)
  })

  it('3. 🔴 ABSENT when there is NO BASELINE — never "everything is new"', () => {
    const r = summariseCodeStep({ codesThisRun: AFTER, prevCodesSeen: null })
    expect('codes_new_since_last_run' in r,
      'with no prior run every code looks new; a confident wrong answer is worse than silence').toBe(false)
    expect(r.codes_seen.length).toBe(AFTER.length)
  })

  it('4. the per-site suffix is the SAME RULE, not a new one', () => {
    // Live data carries both forms of this code. Comparing them raw would report a
    // rule as new because it fired on a different week.
    const r = summariseCodeStep({
      codesThisRun: ['INV-INPUT-LONGEST-LE-WEEKLY@w0:-'],
      prevCodesSeen: ['INV-INPUT-LONGEST-LE-WEEKLY'],
    })
    expect('codes_new_since_last_run' in r).toBe(false)
    expect(r.codes_seen).toEqual(['INV-INPUT-LONGEST-LE-WEEKLY'])
  })

  it('5. codes_seen is distinct and sorted, so two runs are comparable', () => {
    const r = summariseCodeStep({
      codesThisRun: ['INV-B', 'INV-A', 'INV-B', 'INV-A@w3:tue', ''],
      prevCodesSeen: ['INV-A', 'INV-B'],
    })
    expect(r.codes_seen).toEqual(['INV-A', 'INV-B'])
  })

  it('6. a code that DISAPPEARS is not reported as new (direction matters)', () => {
    const r = summariseCodeStep({ codesThisRun: BEFORE, prevCodesSeen: AFTER })
    expect('codes_new_since_last_run' in r).toBe(false)
  })

  it('7. not vacuous — an empty run still reports an empty seen set', () => {
    const r = summariseCodeStep({ codesThisRun: [], prevCodesSeen: BEFORE })
    expect(r.codes_seen).toEqual([])
    expect('codes_new_since_last_run' in r).toBe(false)
  })
})
