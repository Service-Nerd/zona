import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { runAdjustmentEngine, acceptAiSummary } from './adjustmentEngine'
import type { ProposedAdjustment } from './planAdjustment'

/**
 * ADJUST-ENGINE-ENTRY-01 — the ROUTE must handle every outcome the ENGINE can return.
 *
 * 🔴 WHY THIS EXISTS, and it is `/ship`'s pre-ship gate box 3 verbatim: *"two
 * subsystems compose over the same data ... each subsystem being correct in isolation
 * does not make the composition correct."* `runAdjustmentEngine` PRODUCES a
 * discriminated union and `app/api/adjust-plan/route.ts` BRANCHES on it. Both can be
 * individually correct while a new union member reaches a route that has no branch for
 * it — which is `SUBS-CANCELLATION-TIER-01`, where a producer emitted `'cancelled'`
 * and the consumer's accept-list did not contain it.
 *
 * ⚠️ THE POPULATION IS DERIVED FROM THE ENGINE'S OWN TYPE, NEVER LISTED HERE. A
 * hand-written list of kinds is the `sheetClose.test.ts` failure — four typed paths
 * that could not contain the defect. Add a member to `AdjustmentOutcome` and this
 * widens on its own.
 *
 * ⚠️ AND IT IS NOT REDUNDANT WITH THE COMPILER, though the compiler helps. `tsc`
 * catches a new kind only because the route DESTRUCTURES the narrowed remainder, so an
 * unhandled member fails to have `proposed`/`status`/`updatedPlan`. That is a real
 * guard and it is incidental: it stops working the moment someone widens the
 * destructure or types the variable loosely. This asserts the property directly.
 */

const ENGINE = readFileSync('lib/coaching/adjustmentEngine.ts', 'utf8')
const ROUTE = readFileSync('app/api/adjust-plan/route.ts', 'utf8')

/** Comments are prose — both files discuss these kinds by name deliberately. */
const stripComments = (src: string) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n')

/**
 * The kinds declared on `AdjustmentOutcome`, read out of the type itself.
 *
 * Bounded to the union declaration rather than grepped over the file, because every
 * `return { kind: ... }` also contains the literal — and a reader that counted those
 * would report the same answer for the wrong reason.
 */
function declaredKinds(): string[] {
  const src = stripComments(ENGINE)
  const start = src.indexOf('export type AdjustmentOutcome')
  expect(start, 'AdjustmentOutcome moved or was renamed — re-anchor this check')
    .toBeGreaterThan(-1)
  const after = src.slice(start)
  // The union ends at the next top-level `export`, which is the request interface.
  const end = after.indexOf('export interface AdjustmentRequest')
  expect(end, 'AdjustmentRequest no longer follows AdjustmentOutcome — re-anchor the bound')
    .toBeGreaterThan(0)
  const union = after.slice(0, end)
  const kinds = Array.from(new Set(
    Array.from(union.matchAll(/kind:\s*'([a-z_]+)'/g)).map(m => m[1]),
  ))
  expect(kinds.length, 'parsed no kinds from AdjustmentOutcome — the reader is broken, ' +
    'not the type. An empty population passes every other assertion in this file.')
    .toBeGreaterThan(1)
  return kinds
}

/**
 * A twelve-week block. `meta` is REQUIRED: `validateReshapedPlan` reads
 * `meta.generator_input` and every real plan carries one (PV2-A).
 *
 * ⚠️ TWELVE WEEKS, NOT TWO, AND THE LENGTH IS LOAD-BEARING. The first cut used a
 * 2-week fixture and every trigger below returned `none` — `TAPER_PROTECTION_WEEKS`
 * swallows anything within three weeks of the end, so the arms passed while
 * exercising nothing. Found by falsifying, not by reading.
 *
 * ⚠️ IT IS SYNTHETIC AND BREACHES A GREAT MANY PRINCIPLES (a flat volume curve, no
 * deload, quality every week). That is deliberate and harmless here: these arms are
 * about WHERE a violation arrives and WHICH outcome kind is produced, never about
 * how many. A generated plan belongs to `review:coaching`, not to a unit test.
 */
const week = (n: number) => ({
  n,
  date: new Date(Date.UTC(2026, 9, 5) + (n - 1) * 6048e5).toISOString().slice(0, 10),
  weekly_km: 30,
  phase: n > 9 ? 'taper' : 'build',
  sessions: {
    tue: { type: 'easy',    label: 'Easy run', detail: null, distance_km: 6 },
    thu: { type: 'quality', label: 'Tempo',    detail: null, distance_km: 8 },
    sat: { type: 'easy',    label: 'Easy run', detail: null, distance_km: 6 },
    sun: { type: 'long',    label: 'Long run', detail: null, distance_km: 16 },
  },
})

const plan = () => ({
  meta: {
    race_date: '2027-01-24', race_distance_km: 21.1, goal: 'finish',
    days_available: 4, age: 38, fitness_level: 'intermediate',
  },
  weeks: Array.from({ length: 12 }, (_, i) => week(i + 1)),
}) as never

const base = () => ({
  plan: plan(), weekN: 4, isManual: false, adjustmentsThisWeek: 0,
  analyses: [], completions: [], weeklyLoad: new Map(),
  now: '2026-10-26T00:00:00.000Z',
})

describe('ADJUST-ENGINE-ENTRY-01 — every engine outcome has a route branch', () => {
  it('parses a real population out of the union, so nothing below passes vacuously', () => {
    const kinds = declaredKinds()
    expect(kinds).toContain('none')
    expect(kinds).toContain('adjustment')
  })

  it('🔴 the route branches on every kind except exactly ONE fall-through', () => {
    const route = stripComments(ROUTE)
    const kinds = declaredKinds()
    const unhandled = kinds.filter(k => !route.includes(`outcome.kind === '${k}'`))

    // One kind is deliberately the fall-through — the success path, which continues
    // into the AI pass and persistence rather than returning. More than one means a
    // member reaches a route with no answer for it.
    expect(
      unhandled.length,
      `the route has no branch for: ${unhandled.join(', ')}. Every AdjustmentOutcome ` +
      'kind needs an answer; exactly one may be the documented fall-through.',
    ).toBe(1)
    expect(
      unhandled[0],
      `'${unhandled[0]}' is the fall-through, but the success path should be — a ` +
      '"nothing to do" outcome must never continue into the AI pass and an insert.',
    ).toBe('adjustment')
  })

  it('every kind is reachable from a real input, not just declared', () => {
    // A branch that exists but is unreachable is the `getElementById` → null class:
    // present, and does nothing.
    const reached = new Set<string>([
      // No signal and no data — nothing fires.
      runAdjustmentEngine(base()).kind,
      // T1 reorder: user-initiated, bypasses taper protection, always structural.
      runAdjustmentEngine({ ...base(), reorderSignal: { fromDay: 'thu', toDay: 'fri' } }).kind,
    ])
    for (const k of declaredKinds()) {
      expect(reached, `no input in this test reaches '${k}' — it is declared and unproven`)
        .toContain(k)
    }
  })

  it('🔴 the engine RETURNS the constitutional violations; it does not throw them', () => {
    // THE SPLIT THIS ITEM HAD TO PRESERVE. `validateReshapedPlan` runs inside the
    // engine, but the REACTION is the caller's: a dev/test `throw` whose message the
    // Me screen's "Last checked" line depends on never advancing, and a production
    // `reshape_invalid` ops event. If the engine ever threw instead, the route's own
    // error text would vanish and this runs under NODE_ENV=test, where the route
    // throws — so the two behaviours are genuinely distinguishable here.
    const out = runAdjustmentEngine({
      ...base(), reorderSignal: { fromDay: 'thu', toDay: 'fri' },
    })
    expect(out.kind).toBe('adjustment')
    if (out.kind !== 'adjustment') return
    expect(Array.isArray(out.reshapeErrors)).toBe(true)
    // This toy fixture is a 2-week block, so it legitimately breaches several
    // principles. The arm is about WHERE the violations arrive, not how many.
    expect(out.reshapeErrors.length, 'a 2-week fixture should breach something').toBeGreaterThan(0)
    expect(out.reshapeErrors.every(v => v.severity === 'error'),
      'only error-severity violations belong on the outcome; warns are the board\'s').toBe(true)
    // And the route still owns the throw.
    expect(stripComments(ROUTE)).toContain('reshape produced invalid plan:')
  })

  it('§69 / ADR-012 — `isManual` forces confirmation on a LOW-magnitude change', () => {
    // 🔴 THE FIRST VERSION OF THIS ARM WAS HOLLOW AND FALSIFYING IT SAID SO.
    // Deleting the `isManual ||` term left it green, because it used a reorder —
    // which `computeReshapeMagnitude` rates `high` unconditionally, so
    // `magnitude === 'high'` already answered true. The arm asserted a conjunction
    // by exercising only the other half of it.
    //
    // An RPE disconnect on an easy run is `flag_for_review`: coach-note only, rated
    // LOW, auto-applied silently. It is the one place the two terms disagree, so it
    // is the only input that can prove the manual force exists.
    const signal = { rpe: 9, sessionType: 'easy' }

    const auto = runAdjustmentEngine({ ...base(), rpeSignal: signal })
    if (auto.kind !== 'adjustment') throw new Error('expected an adjustment')
    expect(auto.magnitude).toBe('low')
    expect(auto.requiresConfirmation, 'a sub-threshold change must stay silent (§69)').toBe(false)
    expect(auto.status).toBe('auto_applied')

    const manual = runAdjustmentEngine({ ...base(), isManual: true, rpeSignal: signal })
    if (manual.kind !== 'adjustment') throw new Error('expected an adjustment')
    // Same magnitude, opposite answer — which is what makes the pair a proof.
    expect(manual.magnitude).toBe('low')
    expect(manual.requiresConfirmation,
      'the runner is polling a review surface; §69 forces pending').toBe(true)
    expect(manual.status).toBe('pending')

    // `status` and `requires_confirmation` are ONE value now, so the row the route
    // writes and the response it returns cannot drift apart.
    expect(manual.ruleEngineVersion, 'the row stamps this; it must not be empty').toBeTruthy()
  })

})

/**
 * `acceptAiSummary` — the engine's answer to *"does the model's prose contradict
 * what I changed?"*, and the only engine function in this item whose assignment was
 * argued rather than inherited from `ENGINE-ENTRY-01`.
 *
 * 🔴 TESTED AS A COMPOSITION, NOT AS TWO HALVES. The route used to call
 * `computeSessionDiff` then `validateSummaryAgainstDiff` by hand, and both halves
 * already had their own green suites — `validateAiSummary.test.ts` carries the
 * 2026-06-26 incident summary itself. What nothing asserted was that they were
 * WIRED TOGETHER OVER THE RIGHT TWO ARRAYS. Feeding `sessionsAfter` where
 * `sessionsBefore` belongs produces an empty diff, the validator finds nothing to
 * contradict, and every confabulation is accepted — with both suites green.
 */
describe('ADJUST-ENGINE-ENTRY-01 — the AI summary check is composed, not assembled by the caller', () => {
  const rest = () => ({ type: 'rest', label: 'Rest', detail: null })
  const easy = (km: number) => ({ type: 'easy', label: 'Easy', detail: null, distance_km: km })
  const long = (km: number) => ({ type: 'long', label: 'Long run', detail: null, distance_km: km, duration_mins: 180 })

  /** The 2026-06-26 incident, as a proposal: the long run moved sun → tue. */
  const incident = {
    weekN: 1,
    trigger: { type: 'session_reorder', detail: {} },
    adjustmentType: 'reorder_sessions',
    summary: 'Moved your rest day.',
    sessionsBefore: [easy(10), rest(),   easy(5), long(24), rest(), easy(8), rest()],
    sessionsAfter:  [easy(10), long(24), easy(5), rest(),   rest(), easy(8), rest()],
    requiresConfirmation: false,
  } as unknown as ProposedAdjustment

  it('🔴 REJECTS the incident summary, through the engine\'s own door', () => {
    const v = acceptAiSummary(
      incident,
      'Moved your rest day from Tuesday to Thursday. The 24km run and hard-easy rhythm '
      + 'stay intact — this is just about sequence, not load.',
    )
    expect(v.ok).toBe(false)
    if (v.ok) return
    expect(v.reason).toMatch(/long|24km/i)
    expect(v.reason, 'the reason is logged for prompt-drift telemetry; it cannot be empty')
      .not.toBe('')
  })

  it('ACCEPTS prose that matches the diff — otherwise it rejects everything', () => {
    // An arm proving only rejection cannot tell a working validator from a
    // constant `false`, which would silently pin every runner to rule-engine copy.
    const v = acceptAiSummary(incident, 'Your long run has moved to Tuesday this week.')
    expect(v.ok, 'honest prose was rejected — the AI pass is now dead for everyone').toBe(true)
  })

  it('⚠️ ORDER IS *NOT* DETECTABLE HERE, AND THAT IS MEASURED RATHER THAN ASSUMED', () => {
    // 🔴 THE ARM THAT USED TO SIT HERE CLAIMED "the argument order is load-bearing"
    // AND WAS HOLLOW. Swapping `sessionsBefore`/`sessionsAfter` inside
    // `acceptAiSummary` left all eight arms in this file GREEN — caught by running
    // the falsification instead of reading the claim.
    //
    // 📐 THE REASON IS IN THE VALIDATOR AND IT IS STRUCTURAL, not a coverage gap:
    // all three of its patterns UNION both sides (`e.before?.type` *and*
    // `e.after?.type`; the same for `distance_km`), and the changed-DAY set is
    // identical under a swap. So `validateSummaryAgainstDiff` is symmetric in
    // before/after **by construction** and no input can distinguish the two.
    //
    // ⚠️ SO WHAT ACTUALLY REMOVED THE RISK IS A TYPE, NOT A TEST. The route used to
    // hand the validator two arrays by name, where a MISMATCHED pair — one
    // proposal's before with another's after — was expressible and silent.
    // `acceptAiSummary` takes the PROPOSAL, so the pair cannot be mismatched: there
    // is nothing to pass wrongly. This arm exists to stop the next reader adding a
    // check for a property that cannot be checked.
    const asymmetric = acceptAiSummary(
      { ...incident, sessionsBefore: incident.sessionsAfter,
        sessionsAfter: incident.sessionsBefore } as ProposedAdjustment,
      'Moved your rest day. The 24km run stays intact.',
    )
    expect(asymmetric.ok, 'if a swap IS now detectable the validator has changed and '
      + 'this arm should become a real guard').toBe(false)

    // And the composition is on the engine's side of the seam, where it can be
    // called at all — the route holds no diff and no validator any more.
    expect(stripComments(ROUTE)).not.toContain('computeSessionDiff')
    expect(stripComments(ROUTE)).not.toContain('validateSummaryAgainstDiff')
    expect(stripComments(ROUTE)).toContain('acceptAiSummary(proposed, text)')
  })
})
