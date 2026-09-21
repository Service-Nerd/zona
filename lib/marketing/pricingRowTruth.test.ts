import { describe, it, expect } from 'vitest'
import { FREE_FEATURES, PAID_FEATURES, type TierFeature } from './pricing'
import { PLAN_SIGNATURES } from '@/lib/plan/planSignatures'
import { AI_ROUTE_LIMITS } from '@/lib/ai/limits'
import { FEATURE_GATES } from '@/lib/plan/featureGates'

/**
 * PRICING-ROW-TRUTH-01 (Traynor, SLT 2026-09-20).
 *
 * `pricing.test.ts` proves every paid gate has a ROW. It cannot prove the row
 * DESCRIBES WHAT THE PRODUCT DOES, and it passed throughout the period
 * `TT-PRICING-CLAIM-01`'s claim was false on 58% of plans. **The guard held
 * while the claim rotted.**
 *
 * ⚠️ WHAT THIS FILE DOES NOT DO, stated first because the filing warned about
 * exactly this: it does NOT evaluate whether a sentence is true. That is not a
 * property a test can decide in general, and shipping something that merely
 * LOOKED like it could would be worse than nothing — a green tick with nothing
 * behind it is this repo's most repeated failure, and here a green tick is
 * precisely what allowed the rot.
 *
 * What it does instead, all three of which are real:
 *   1. every row must DECLARE its evidence kind — a new row cannot be added
 *      without someone deciding which it is;
 *   2. `mechanical` rows are EXECUTED against the product below;
 *   3. `reviewed` rows are PINNED TO THEIR TEXT — editing the sentence without
 *      moving the review date fails the build.
 *
 * ⚠️ IT ALREADY EARNED ITS PLACE. Writing the first predicate found
 * `rule_engine_regeneration` claiming *"No limit."* while
 * `app/api/generate-plan/route.ts` calls `guardAiRequest` before the tier
 * branch at ten per hour, on every tier including free. Harmless in practice,
 * absolute in words, and false — the same shape as the claim this item was
 * generalised from. First row checked.
 */
const ROWS: TierFeature[] = [...FREE_FEATURES, ...PAID_FEATURES]

/**
 * The executable half. Keyed by gate; each returns a failure string or null.
 * A row marked `mechanical` with no predicate here fails — the declaration and
 * the check cannot drift apart silently.
 */
const PREDICATES: Record<string, (row: TierFeature) => string | null> = {
  // "5K, 10K and half marathon plans" — free.
  generic_plan_templates: () => {
    const shouldBeFree = ['5K', '10K', 'HM'] as const
    const bad = shouldBeFree.filter(k => !PLAN_SIGNATURES[k]?.free_tier_available)
    return bad.length ? `claims ${bad.join(', ')} are free, but free_tier_available is false` : null
  },

  // "as often as you need" — must NOT make an absolute claim while a cap exists.
  rule_engine_regeneration: (row) => {
    const capped = !!AI_ROUTE_LIMITS['generate-plan']
    const absolute = /\bno limit\b|\bunlimited\b|\bas many times as you like\b/i.test(row.detail)
    return capped && absolute
      ? `claims "${row.detail}" while AI_ROUTE_LIMITS['generate-plan'] caps it at `
        + `${AI_ROUTE_LIMITS['generate-plan'].limit} per `
        + `${AI_ROUTE_LIMITS['generate-plan'].windowSeconds}s on every tier, free included`
      : null
  },

  // "Marathon, 50K and 100K" — named distances must exist AND be paid.
  ultra_plan_generation: (row) => {
    const named = (['MARATHON', '50K', '100K'] as const).filter(k =>
      new RegExp(k === 'MARATHON' ? 'marathon' : k, 'i').test(row.detail))
    const missing = named.filter(k => !PLAN_SIGNATURES[k])
    if (missing.length) return `names ${missing.join(', ')}, which PLAN_SIGNATURES does not have`
    const actuallyFree = named.filter(k => PLAN_SIGNATURES[k]?.free_tier_available)
    return actuallyFree.length
      ? `sells ${actuallyFree.join(', ')} as paid, but free_tier_available is true`
      : null
  },

  // "A maintenance block" — the gate must really be paid-only-ongoing.
  maintenance_coaching: () =>
    (FEATURE_GATES.PAID_ONLY_ONGOING as readonly string[]).includes('maintenance_coaching')
      ? null
      : 'sits in the PAID column but is not in PAID_ONLY_ONGOING',
}

/**
 * Reviewed claims, pinned to the exact sentence reviewed on that date. Editing
 * a `detail` string without updating this map fails — which is the only
 * mechanical thing that can honestly be said about a claim a human judged.
 */
const REVIEWED_TEXT: Record<string, string> = {
  plan_view: 'Nothing is hidden behind a blur or a teaser. You can read the lot.',
  manual_session_completion: 'No watch and no Strava needed to tick a run off.',
  plan_difficulty_band: 'How demanding the plan is for you, said plainly before you start it.',
  activity_intelligence: 'Whether you actually held the zone, what your heart rate did, and how disciplined the week was.',
  dynamic_reshape_r20: 'Miss a week and it reshapes around what you did, instead of leaving you to catch up on a week that has gone.',
  ai_coach_notes_new: 'Notes written for the session in front of you, not a library article about tempo runs.',
  post_run_reframe: 'Tell it how the run felt and get an honest reframe, or a warning if the pattern says back off.',
  race_time_estimates: 'A projected finish time. No vanity numbers.',
  confidence_score: 'The engine tells you how confident it is, and why, rather than pretending it is certain.',
}

describe('PRICING-ROW-TRUTH-01 — every row declares how its claim is backed', () => {
  it('reads a real set of rows, so the sweep cannot pass by checking nothing', () => {
    expect(ROWS.length).toBeGreaterThan(8)
  })

  it('every row declares an evidence kind', () => {
    const undeclared = ROWS.filter(r => !r.evidence).map(r => r.name)
    expect(
      undeclared,
      'A pricing row with no evidence. Mark it `mechanical` and add a predicate, or `reviewed` '
      + 'with the date and who checked it. A row nobody decided about is how the last false '
      + 'claim survived a passing test suite.',
    ).toEqual([])
  })

  it('every MECHANICAL row has a predicate, and it passes against the product', () => {
    const failures: string[] = []
    for (const row of ROWS) {
      if (row.evidence?.kind !== 'mechanical') continue
      const key = row.gate
      if (!key || !PREDICATES[key]) {
        failures.push(`${row.name}: marked mechanical but no predicate exists`)
        continue
      }
      const why = PREDICATES[key](row)
      if (why) failures.push(`${row.name}: ${why}`)
    }
    expect(failures, 'A pricing row makes a claim the product contradicts.').toEqual([])
  })

  it('every REVIEWED row still says what was reviewed', () => {
    const drifted: string[] = []
    for (const row of ROWS) {
      if (row.evidence?.kind !== 'reviewed') continue
      const key = row.gate
      if (!key) continue
      const pinned = REVIEWED_TEXT[key]
      if (pinned === undefined) { drifted.push(`${row.name}: reviewed but not pinned`); continue }
      if (pinned !== row.detail) {
        drifted.push(`${row.name}: the sentence changed since it was reviewed on ${row.evidence.on}`)
      }
    }
    expect(
      drifted,
      'A reviewed pricing claim was edited without being re-reviewed. Update REVIEWED_TEXT and the '
      + '`on` date together, having actually checked the new sentence against the product.',
    ).toEqual([])
  })

  it('no row claims something is unlimited while a rate limit exists', () => {
    // Cross-cutting, because the defect that prompted this file was an absolute
    // word rather than a wrong feature. Absolutes are the class most likely to
    // be false and least likely to be noticed, since they read as confidence.
    const absolute = ROWS.filter(r => /\bno limit\b|\bunlimited\b/i.test(r.detail)).map(r => r.name)
    expect(absolute, 'An absolute claim on the pricing page. Every AI route is rate limited '
      + '(SEC-15), so "no limit" is false wherever generation is involved.').toEqual([])
  })
})
