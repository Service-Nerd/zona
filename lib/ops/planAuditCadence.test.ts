import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cadenceSinceLastRun, PLAN_AUDIT_SCHEDULE_UTC } from './planAuditCadence'

/**
 * OPS-AUDIT-CADENCE-DOC-01 — what violation class can these arms find?
 *
 *  1. ABSENCE WRITTEN AS A VALUE. A `?? 0` on a staleness field asserts "it ran a moment
 *     ago" — the worst available lie for this particular number, and a class this repo has
 *     recorded more than once (`x === true` fabricating a false; `distance_km ?? 0`
 *     asserting a session covered no ground).
 *  2. THE CADENCE KEYED OFF `codes_seen`. The route already reads the previous summary for
 *     its code set, and the obvious refactor is to take the timestamp from the same guarded
 *     branch — which would make a CLEAN previous run (no codes) read as a MISSED one.
 *     Split deliberately; this arm is why it stays split.
 *  3. THE FIELD GOING INERT. A number nothing publishes is decorative config
 *     (`ZONE_DISCIPLINE_BANDS`, 56 days).
 *
 * ⚠️ WHAT THIS DOES NOT PROVE. It cannot prove the digest reads the field — the digest is a
 * cloud routine, outside this repo, and that half of the item is declared as outside rather
 * than claimed as done. It also does not prove the GitHub Actions lag is what the workflow
 * header says: that is a live-platform property, measured once with its method and date.
 */

const ROUTE = join(process.cwd(), 'app/api/ops/plan-audit/route.ts')
const stripComments = (s: string) => s
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length))

const now = new Date('2026-11-08T14:32:00Z')

describe('cadenceSinceLastRun', () => {
  // ⚠️ THE PAIRS ARE THE REAL OBSERVED EXTREMES, QUERIED, not plausible-looking dates.
  // My first cut invented them: it claimed the 26.9 h maximum was 2026-10-31 13:54 ->
  // 2026-11-01 14:31 "plus the DST hour", which is 24.6 h and UTC has no DST. A fixture
  // must use the PRODUCT's values; a fixture that merely looks like production is a guess
  // with an assertion wrapped round it.
  it('reports the interval to one decimal, on the two real extremes', () => {
    // MINIMUM observed, 21.81 h.
    expect(cadenceSinceLastRun({
      now: new Date('2026-10-14T13:06:00Z'), previousRunAt: '2026-10-13T15:17:00Z',
    })).toEqual({ hours_since_previous_run: 21.8 })
    // MAXIMUM observed, 26.92 h — the gap that makes the old "live for 24 hours" claim
    // in `lib/plan.ts` and `recordOpsEvent.ts` false, and false on 25 of 53 intervals.
    expect(cadenceSinceLastRun({
      now: new Date('2026-11-02T17:27:00Z'), previousRunAt: '2026-11-01T14:31:00Z',
    })).toEqual({ hours_since_previous_run: 26.9 })
    // The most recent interval, 24.2 h — i.e. the ordinary case is already over a day.
    expect(cadenceSinceLastRun({
      now: new Date('2026-11-08T14:32:00Z'), previousRunAt: '2026-11-07T14:22:00Z',
    })).toEqual({ hours_since_previous_run: 24.2 })
  })

  it('🔴 ABSENT, never zero, when there is no previous run to measure from', () => {
    for (const prev of [null, undefined, '', 'not-a-date']) {
      const r = cadenceSinceLastRun({ now, previousRunAt: prev })
      expect(r, `previousRunAt=${JSON.stringify(prev)}`).toEqual({})
      expect('hours_since_previous_run' in r).toBe(false)
    }
  })

  it('a negative interval is clock skew, not a cadence, and is reported as unknown', () => {
    expect(cadenceSinceLastRun({ now, previousRunAt: '2026-11-09T00:00:00Z' })).toEqual({})
    // Exactly simultaneous is zero hours and IS a real reading — two runs in one minute.
    expect(cadenceSinceLastRun({ now, previousRunAt: '2026-11-08T14:32:00Z' }))
      .toEqual({ hours_since_previous_run: 0 })
  })

  it('carries no threshold — a "late" line at a day would fire on 25 of 53 normal intervals', () => {
    const src = stripComments(readFileSync(join(process.cwd(), 'lib/ops/planAuditCadence.ts'), 'utf8'))
    for (const word of ['stale', 'late', 'threshold', 'WARN']) {
      expect(src.toLowerCase(), `the module must not encode a verdict ("${word}")`)
        .not.toContain(word.toLowerCase())
    }
    expect(PLAN_AUDIT_SCHEDULE_UTC).toBe('45 7 * * *')
  })
})

describe('the audit route publishes it', () => {
  const src = stripComments(readFileSync(ROUTE, 'utf8'))

  it('the summary spreads the cadence, so the field is not inert', () => {
    expect(src).toMatch(/\.\.\.cadenceSinceLastRun\(\s*\{/)
    expect(src).toMatch(/from '@\/lib\/ops\/planAuditCadence'/)
  })

  it("🔴 the timestamp is captured independently of `codes_seen` — a clean previous run still happened", () => {
    // The assignment must NOT sit inside the `codes_seen` guard. Bounded to the region
    // between the two assignments rather than grepped: `bound the region, never grep the
    // file`, and the whole-file grep is the shape that has misfired three times here.
    const atCodes = src.indexOf('prevCodesSeen = d.codes_seen')
    const atStamp = src.indexOf('prevSummaryAt = row.created_at')
    expect(atCodes, 'the codes_seen assignment must exist').toBeGreaterThan(0)
    expect(atStamp, 'the timestamp assignment must exist').toBeGreaterThan(0)
    const between = src.slice(Math.min(atCodes, atStamp), Math.max(atCodes, atStamp))
    // One statement cannot be nested inside the other's condition if a newline and no
    // open brace separate them at the same level.
    expect(between).toContain('\n')
    expect(/if \(prevCodesSeen == null[^\n]*\{[^}]*prevSummaryAt/.test(src),
      'the timestamp must not be guarded by the code set').toBe(false)
  })
})
