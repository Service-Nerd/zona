import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  classifyReshapeViolations,
  violationFingerprint,
  RESHAPE_BLOCKING_FINGERPRINT_FIELDS,
} from './reshapeIntroduced'
import type { Violation } from '@/lib/plan/invariants'

/**
 * RESHAPE-SCOPE-TO-CHANGE-01 / §134 — a reshape answers for what it CHANGED.
 *
 * 🔴 EVERY CASE BELOW IS A REAL PAIR FROM PRODUCTION, not a hypothetical. They are the
 * three disagreements that settled the identity question on 2026-11-03: the first cut of
 * the fingerprint included `day` and reported 3 of 18 plans still refused; two were
 * artefacts of its own key and one was genuine. Reasoning would not have separated them.
 *
 * ⚠️ WHAT THESE ARMS DO NOT PROVE. They prove the CLASSIFIER. They say nothing about
 * whether a tolerated breach is acceptable — it is debt, tracked as
 * `STORED-PLAN-DEBT-REPAIR-01` — and nothing about plans that do not exist yet, which is
 * `verify:parity` and `measure:fitness`.
 */

const v = (over: Partial<Violation>): Violation => ({
  code: 'INV-PLAN-TEST',
  principle_ref: 'CoachingPrinciples §0',
  severity: 'error',
  week: 7,
  message: 'a breach',
  actual: 1,
  expected: 2,
  ...over,
})

describe('§134 — the blocking set is what the reshape introduced', () => {
  // ── CASE 1: the real pair, df2cc6e6 week 7, "Cruise intervals" wed -> sat ──
  it('a breach that TRAVELS with its session is pre-existing, not introduced', () => {
    // A reorder moves sessions. `INV-PLAN-CATALOGUE-LINK` rides along: byte-identical
    // message, byte-identical actual/expected, new day. Keying on `day` called this an
    // introduction and would have gone on refusing this runner forever.
    const msg = 'Session "Cruise intervals" matches catalogue row "tempo_cruise" by name ' +
      'but carries no catalogue_id.'
    const before = [v({ code: 'INV-PLAN-CATALOGUE-LINK', week: 7, day: 'wed', message: msg,
      actual: 'no catalogue_id', expected: 'catalogue_id: "tempo_cruise"' })]
    const after = [v({ code: 'INV-PLAN-CATALOGUE-LINK', week: 7, day: 'sat', message: msg,
      actual: 'no catalogue_id', expected: 'catalogue_id: "tempo_cruise"' })]

    const { blocking, preexisting } = classifyReshapeViolations(before, after)
    expect(blocking).toEqual([])
    expect(preexisting).toHaveLength(1)
  })

  // ── CASE 2: the real pair, 60d4bdd5 week 7 — the one that MUST keep refusing ──
  it('a breach at a coordinate that was CLEAN is introduced', () => {
    // The swap put a quality session one day from the long run. §134 exists to let
    // adjustments through; it does not exist to let THIS through.
    const before: Violation[] = [v({ code: 'INV-PLAN-EASY-PACE-PRESENT', week: 7 })]
    const after = [
      ...before,
      v({ code: 'INV-PLAN-QUALITY-LONG-SPACING', week: 7, day: 'wed',
        message: 'Quality session too close to long run', actual: 1, expected: '≥ 2 day(s)' }),
    ]

    const { blocking, preexisting } = classifyReshapeViolations(before, after)
    expect(blocking.map(b => b.code)).toEqual(['INV-PLAN-QUALITY-LONG-SPACING'])
    expect(preexisting.map(b => b.code)).toEqual(['INV-PLAN-EASY-PACE-PRESENT'])
  })

  // ── CASE 3: 🩹 WILLY'S FIRST BINDING CONDITION ──
  it('a pre-existing breach whose NUMBER moves is introduced', () => {
    // "If a pre-existing long-run breach goes from 55% of the week to 80%, that must
    // refuse." It does, because `actual` is in the fingerprint — no numeric reasoning and
    // no judgement about direction required.
    const base = { code: 'INV-PLAN-LR-MAX-WEEKLY-PCT', week: 7, expected: '≤ 50%' }
    const before = [v({ ...base, actual: '55%', message: 'Long run is 55% of the week' })]
    const after = [v({ ...base, actual: '80%', message: 'Long run is 80% of the week' })]

    const { blocking, preexisting } = classifyReshapeViolations(before, after)
    expect(blocking, 'a worsened breach was blessed as pre-existing').toHaveLength(1)
    expect(blocking[0].actual).toBe('80%')
    expect(preexisting).toEqual([])
  })

  // ── MULTISET, not a set ──
  it('one MORE of a code the plan already breached is introduced', () => {
    const one = v({ code: 'INV-PLAN-EASY-PACE-PRESENT', week: 3, message: 'no pace' })
    const { blocking, preexisting } = classifyReshapeViolations([one], [one, one, one])
    expect(blocking, 'a set instead of a multiset lets a reshape pile onto a broken rule')
      .toHaveLength(2)
    expect(preexisting).toHaveLength(1)
  })

  it('FEWER of a code is not an introduction, and is not reported as one', () => {
    const one = v({ code: 'INV-PLAN-EASY-PACE-PRESENT', week: 3, message: 'no pace' })
    const { blocking, preexisting } = classifyReshapeViolations([one, one], [one])
    expect(blocking).toEqual([])
    expect(preexisting).toHaveLength(1)
  })

  it('an unchanged plan introduces nothing — the identity case', () => {
    const errs = [v({ code: 'A', week: 1 }), v({ code: 'B', week: 9, day: 'sun' })]
    expect(classifyReshapeViolations(errs, errs).blocking).toEqual([])
  })

  // ── §18, THE LIVE HAZARD. Dropping `day` must not weaken it ──
  it('§18 — a session moved onto a BLOCKED DAY is still introduced', () => {
    // Measured across every stored plan declaring blocked days: still refused in 29 of 29
    // where this invariant fires. It survives the dropped `day` because the violation
    // carries the day in `actual`, which IS in the fingerprint. This is the case a new
    // subscriber hit on his first action on 2026-11-02.
    const blockedDay = v({
      code: 'INV-PLAN-NO-SESSIONS-ON-BLOCKED-DAYS', week: 7, day: 'mon',
      message: 'Session placed on a day listed in days_cannot_train',
      actual: 'mon', expected: 'unblocked day',
    })
    const { blocking } = classifyReshapeViolations([], [blockedDay])
    expect(blocking).toHaveLength(1)
  })

  it('§18 — the same breach on a DIFFERENT blocked day is also introduced', () => {
    // The adjacent trap: if `day` is gone, could two blocked-day breaches be confused?
    // No — `actual` differs, so moving a session from one blocked day to another is still
    // an introduction at the new one.
    const on = (d: string) => v({
      code: 'INV-PLAN-NO-SESSIONS-ON-BLOCKED-DAYS', week: 7, day: d,
      message: 'Session placed on a day listed in days_cannot_train',
      actual: d, expected: 'unblocked day',
    })
    expect(classifyReshapeViolations([on('mon')], [on('thu')]).blocking).toHaveLength(1)
  })

  // ── The constant is the policy, not decoration ──
  it('the fingerprint is built from the declared constant, and day is NOT in it', () => {
    expect(RESHAPE_BLOCKING_FINGERPRINT_FIELDS).toContain('actual')
    expect(RESHAPE_BLOCKING_FINGERPRINT_FIELDS).toContain('expected')
    expect(RESHAPE_BLOCKING_FINGERPRINT_FIELDS).toContain('message')
    expect(RESHAPE_BLOCKING_FINGERPRINT_FIELDS,
      'day is back in the fingerprint — every reorder will now look like it introduces ' +
      'every breach it moves (measured: 2 of 3 false positives)',
    ).not.toContain('day')

    // And it is actually READ: a field added to the constant must change the fingerprint.
    const a = v({ day: 'mon' }), b = v({ day: 'sun' })
    expect(violationFingerprint(a)).toBe(violationFingerprint(b))
  })
})

describe('§134 — the route reacts to the split, and records what it tolerates', () => {
  const ROUTE = readFileSync(join(process.cwd(), 'app/api/adjust-plan/route.ts'), 'utf8')
  const code = ROUTE
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, m => m.replace(/[^\n]/g, ' '))

  it('refuses on the BLOCKING set only', () => {
    expect(code, 'the route refuses on every error again — RESHAPE-SCOPE-TO-CHANGE-01')
      .toMatch(/if \(blockingErrors\.length > 0\)/)
    expect(code, 'the pre-rename field is back, which means the whole-plan refusal is back')
      .not.toMatch(/reshapeErrors/)
  })

  it('🩹 records the tolerated set, because debt nobody can list is an exemption', () => {
    // The board's second binding condition. Bounded on the landmarks that open and close
    // the block, never a character count: a byte window over comment-stripped source has
    // been eaten by the comment explaining the fix twice in two days.
    const open = code.indexOf('if (toleratedErrors.length > 0)')
    expect(open, 'the tolerated set is no longer recorded at all').toBeGreaterThan(-1)
    const block = code.slice(open, code.indexOf('if (blockingErrors.length > 0)'))
    expect(block).toMatch(/recordOpsEvent\(/)
    expect(block).toMatch(/'reshape_preexisting_tolerated'/)
    expect(block, 'a counter is not a list — Willy asked for the codes and the weeks')
      .toMatch(/violations:\s*toleratedErrors\.map/)
  })

  it('records the tolerated set BEFORE the refusal, which returns early', () => {
    // A reshape can both introduce a breach and sit on pre-existing ones. Recording second
    // would make the tolerated set invisible on exactly the plans carrying most of it.
    expect(code.indexOf('if (toleratedErrors.length > 0)'))
      .toBeLessThan(code.indexOf('if (blockingErrors.length > 0)'))
  })
})
