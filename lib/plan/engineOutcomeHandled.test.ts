import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { runEngine } from './engine'
import type { GeneratorInput } from '@/types/plan'

/**
 * ENGINE-ENTRY-01 — the ROUTE must handle every outcome the ENGINE can return.
 *
 * 🔴 WHY THIS EXISTS, and it is `/ship`'s pre-ship gate box 3 verbatim: *"two
 * subsystems compose over the same data ... each subsystem being correct in
 * isolation does not make the composition correct."* `runEngine` PRODUCES a
 * discriminated union and `app/api/generate-plan/route.ts` BRANCHES on it. Both can
 * be individually correct while a new union member reaches a route that has no
 * branch for it — which is exactly `SUBS-CANCELLATION-TIER-01`, where a producer
 * emitted `'cancelled'` and the consumer's accept-list did not contain it.
 *
 * ⚠️ THE POPULATION IS DERIVED FROM THE ENGINE'S OWN TYPE, NEVER LISTED HERE. A
 * hand-written list of kinds is the `sheetClose.test.ts` failure — four typed paths
 * that could not contain the defect. Add a member to `EngineOutcome` and this test
 * widens on its own.
 *
 * ⚠️ AND IT IS NOT REDUNDANT WITH THE COMPILER, though the compiler helps. `tsc`
 * catches a new kind only because the route DESTRUCTURES the narrowed remainder, so
 * an unhandled member fails to have `plan`/`rulePlan`/`gapClass`. That is a real
 * guard and it is incidental: it would stop working the moment someone widened the
 * destructure or typed the variable loosely. This asserts the property directly.
 */

const ENGINE = readFileSync('lib/plan/engine.ts', 'utf8')
const ROUTE = readFileSync('app/api/generate-plan/route.ts', 'utf8')

/** Comments are prose — both files discuss these kinds by name deliberately. */
const stripComments = (src: string) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n')

/**
 * The kinds declared on `EngineOutcome`, read out of the type itself.
 *
 * Bounded to the union declaration rather than grepped over the file, because
 * `mapRefusal`'s return type and every `return { kind: ... }` also contain the
 * literal — and a reader that counted those would report the same answer for the
 * wrong reason.
 */
function declaredKinds(): string[] {
  const src = stripComments(ENGINE)
  const start = src.indexOf('export type EngineOutcome')
  expect(start, 'EngineOutcome moved or was renamed — re-anchor this check')
    .toBeGreaterThan(-1)
  // The union ends at the next top-level `export`, which is the request interface.
  const after = src.slice(start)
  const end = after.indexOf('export interface EngineRequest')
  expect(end, 'EngineRequest no longer follows EngineOutcome — re-anchor the bound')
    .toBeGreaterThan(0)
  const union = after.slice(0, end)
  const kinds = Array.from(new Set(
    Array.from(union.matchAll(/kind:\s*'([a-z_]+)'/g)).map(m => m[1]),
  ))
  expect(kinds.length, 'parsed no kinds from EngineOutcome — the reader is broken, ' +
    'not the type. An empty population passes every other assertion in this file.')
    .toBeGreaterThan(1)
  return kinds
}

describe('ENGINE-ENTRY-01 — every engine outcome has a route branch', () => {
  it('parses a real population out of the union, so nothing below passes vacuously', () => {
    const kinds = declaredKinds()
    // Pinned loosely: the exact set may grow, but these three must exist, because
    // each is a distinct HTTP answer (200 stream, 200 plan, 422).
    expect(kinds).toContain('plan')
    expect(kinds).toContain('base_build')
    expect(kinds).toContain('refusal')
  })

  it('🔴 the route branches on every kind except exactly ONE fall-through', () => {
    const route = stripComments(ROUTE)
    const kinds = declaredKinds()
    const unhandled = kinds.filter(k => !route.includes(`outcome.kind === '${k}'`))

    // One kind is deliberately the fall-through — the success path, which continues
    // into enrichment rather than returning. More than one means a member reaches a
    // route with no answer for it.
    expect(
      unhandled.length,
      `the route has no branch for: ${unhandled.join(', ')}. Every EngineOutcome kind ` +
      'needs an answer; exactly one may be the documented fall-through.',
    ).toBe(1)
    expect(
      unhandled[0],
      `'${unhandled[0]}' is the fall-through, but the success path should be — a ` +
      'refusal or a base build must never continue into the enrichment chain.',
    ).toBe('plan')
  })

  it('and each branch answers with the status that kind carries', () => {
    const route = stripComments(ROUTE)
    // A refusal carries its own status; the route must not hardcode one beside it.
    expect(route).toContain('NextResponse.json(outcome.body, { status: outcome.status })')
    expect(route).toContain('NextResponse.json({ plan: outcome.plan })')
  })

  /**
   * The composition walked for real: every kind the engine can actually PRODUCE,
   * reached with an input that produces it. A branch that exists but is unreachable
   * is the `getElementById` → null class — present, and does nothing.
   */
  it('every kind is reachable from a real input, not just declared', () => {
    const mk = (o: Record<string, unknown>) => ({
      race_distance_km: 42.2, race_date: '2027-04-25', goal: 'finish',
      current_weekly_km: 8, longest_recent_run_km: 5, days_available: 3,
      training_age: '<6mo', age: 38, injury_history: [],
      recent_quality_training: 'none', hard_session_relationship: 'neutral', ...o,
    } as unknown as GeneratorInput)
    const call = (input: GeneratorInput, acceptBaseBuild = false) =>
      runEngine({ input, tier: 'paid', displayUnits: 'km', acceptBaseBuild,
                  planStart: '2026-10-05', today: '2026-10-05' }).kind

    const reached = new Set<string>([
      // §111's base-volume refusal is now STAGED (NO-RUNNER-TURNED-AWAY-01, on 2026-10-25): a base build, not a refusal.
      call(mk({})),
      // A refusal staging cannot serve: §44, a marathon six weeks away.
      call(mk({ race_date: '2026-11-16' })),
      // The same runner accepting the §118 offer.
      call(mk({}), true),
      // A runner the engine builds for.
      call(mk({ race_distance_km: 21.1, current_weekly_km: 30, longest_recent_run_km: 14,
                days_available: 4, training_age: '2y+', recent_quality_training: 'regular' })),
    ])
    for (const k of declaredKinds()) {
      expect(reached, `no input in this test reaches '${k}' — it is declared and unproven`)
        .toContain(k)
    }
  })
})
