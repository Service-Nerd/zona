import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isFeatureAllowed } from './canUseFeature'
import { buildUserMessage } from './enrich'
import type { Plan, GeneratorInput } from '@/types/plan'

/**
 * TIER-TRIAL-CONFIDENCE-01 — the enricher and the gate must agree.
 *
 * They did not. `featureGates.ts` has always listed `confidence_score` as
 * allowed on trial; `enrich.ts` asked `tier === 'paid'` and the engine won, so
 * a trial runner never received `confidence_score`, `confidence_risks` or
 * `coach_intro` while the homepage said "Two weeks, full access" and
 * `BRAND.signupSub` said "14 days, no limits".
 *
 * Nothing caught it. `pricing.test.ts` proves every PAID gate has a ROW on the
 * pricing page; it cannot prove the gate is honoured. This is the missing half.
 */

const plan = {
  meta: { race_name: 'Test', race_distance_km: 10, race_date: '2027-01-01' },
  weeks: [{ n: 1, phase: 'base', weekly_km: 20, sessions: [] }],
} as unknown as Plan

const input = {
  race_distance_km: 10, days_available: 4, goal: 'finish', athlete_name: 'A',
} as unknown as GeneratorInput

describe('the enricher reads the gate rather than restating it', () => {
  it('asks for the paid fields on exactly the tiers the gate allows', () => {
    for (const tier of ['free', 'trial', 'paid'] as const) {
      const allowed = isFeatureAllowed('confidence_score', tier)
      const msg = buildUserMessage(plan, input, allowed, 'km')
      if (allowed) {
        expect(msg, `${tier}: gate allows confidence_score but the prompt forbids it`)
          .toContain('Include confidence_score')
      } else {
        expect(msg, `${tier}: gate denies confidence_score but the prompt asks for it`)
          .toContain('Do NOT include confidence_score')
      }
    }
  })

  it('grants the trial the paid fields — the live claim is "14 days, no limits"', () => {
    expect(isFeatureAllowed('confidence_score', 'trial')).toBe(true)
  })

  it('still withholds them on free', () => {
    expect(isFeatureAllowed('confidence_score', 'free')).toBe(false)
  })

  // The structural half. A future edit could reintroduce a hand-written tier
  // predicate here and the assertions above would still pass, because they
  // drive `buildUserMessage` directly. This reads the source.
  it('does not hold its own copy of the tier rule', () => {
    const src = readFileSync(join(process.cwd(), 'lib/plan/enrich.ts'), 'utf8')
    const decl = src.split('\n').find(l => l.includes('const wantPaidFields'))
    expect(decl, 'wantPaidFields declaration not found').toBeDefined()
    expect(
      decl,
      'wantPaidFields compares the tier by hand again. Ask isFeatureAllowed — ' +
      'a second copy of the gate is what produced TIER-TRIAL-CONFIDENCE-01.',
    ).toContain('isFeatureAllowed')
  })
})
