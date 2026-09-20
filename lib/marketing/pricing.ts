// GTM-SITE-02 — what the /pricing page says you get.
//
// WHY THIS IS A FILE AND NOT JSX. The page describes the same free/paid split
// that `featureGates.ts` enforces, and a second prose copy of a rule always
// drifts from the rule. This site has already shipped that exact defect: the
// homepage claimed "four answers" against a ~15-question wizard and survived
// five wizard changes, because nothing connected the claim to the thing.
//
// So every paid row carries the `gate` it describes, and
// `pricing.test.ts` fails the build if a PAID_ONLY_ONGOING gate has no row
// here. Add a gate, the test tells you the pricing page is now lying.
//
// Prices are NEVER written here. `BRAND.PRICING` is the source of truth.

import type { GatedFeature } from '@/lib/plan/featureGates'

export interface TierFeature {
  /** The gate this row describes, where one exists. Used by the drift test. */
  gate?: GatedFeature
  name: string
  /** One sentence on what it does FOR THE RUNNER. Not a feature name repeated. */
  detail: string
}

/** Free forever, no account age limit. */
export const FREE_FEATURES: TierFeature[] = [
  {
    gate: 'generic_plan_templates',
    name: '5K, 10K and half marathon plans',
    detail: 'Built by the same engine, for your race date and the days you can actually run.',
  },
  {
    gate: 'plan_view',
    name: 'The whole plan, every week',
    detail: 'Nothing is hidden behind a blur or a teaser. You can read the lot.',
  },
  {
    gate: 'rule_engine_regeneration',
    name: 'Rebuild it whenever you like',
    detail: 'Change your race or your week and generate again. No limit.',
  },
  {
    gate: 'manual_session_completion',
    name: 'Log sessions by hand',
    detail: 'No watch and no Strava needed to tick a run off.',
  },
  {
    gate: 'plan_difficulty_band',
    name: 'An honest read on the ask',
    detail: 'How demanding the plan is for you, said plainly before you start it.',
  },
]

/** What a subscription adds. Ordered by how often it actually matters. */
export const PAID_FEATURES: TierFeature[] = [
  {
    gate: 'activity_intelligence',
    name: 'Every run read back to you',
    detail: 'Whether you actually held the zone, what your heart rate did, and the weekly score for how disciplined the week was.',
  },
  {
    gate: 'dynamic_reshape_r20',
    name: 'A plan that moves when life does',
    detail: 'Miss a week and it reshapes around what you did, instead of leaving you to catch up on a week that has gone.',
  },
  {
    gate: 'ai_coach_notes_new',
    name: 'Coaching in your own context',
    detail: 'Notes written for the session in front of you, not a library article about tempo runs.',
  },
  {
    gate: 'ultra_plan_generation',
    name: 'Marathon and ultra plans',
    detail: 'Marathon, 50K and 100K. The distances where getting the build wrong costs you the start line.',
  },
  {
    gate: 'post_run_reframe',
    name: 'A second read on a bad run',
    detail: 'Tell it how the run felt and get an honest reframe, or a warning if the pattern says back off.',
  },
  {
    gate: 'race_time_estimates',
    // TT-PRICING-CLAIM-01 (2026-09-20) — FIXED BY DELETION, NOT BY SOFTENING.
    //
    // Was: "A projected finish from your real running, updated as you train.
    // No vanity numbers." Measured on the live database, 11 of 19 plans (58%)
    // carry no benchmark, so the projection comes from two wizard answers and a
    // derivation. State 4 is static by design (the route says so itself). On
    // the majority path all three clauses failed.
    //
    // Two false clauses removed. Nothing rewritten, nothing added: Traynor
    // blocked the cheap fix of softening the words until the derivation
    // qualifies, and Sutherland's point is that deleting a claim is the
    // opposite of that. What remains is true on every path.
    //
    // ⚠️ The replacement wording is the founder's (§4A) and the deeper fix is
    // NOT here: Hutchinson's ruling is that the pricing page is the symptom and
    // the projection itself should state whether it came from a benchmark or an
    // estimate. Filed separately. Do not pre-announce it in this string.
    name: 'What you are actually on for',
    detail: 'A projected finish time. No vanity numbers.',
  },
  {
    gate: 'confidence_score',
    name: 'How much to trust the plan',
    detail: 'The engine tells you how confident it is, and why, rather than pretending it is certain.',
  },
  {
    gate: 'maintenance_coaching',
    name: 'What to do after the race',
    detail: 'A maintenance block so the fitness you built does not quietly leak away.',
  },
]

/**
 * Gates deliberately NOT on the pricing page, with the reason. The drift test
 * reads this, so an omission has to be an argued decision rather than a
 * forgotten row.
 */
export const OMITTED_FROM_PRICING: { gate: GatedFeature; why: string }[] = [
  {
    gate: 'strength_sessions_tailored',
    why: 'Not built. featureGates marks it "when shipped", and advertising an unbuilt feature on a pricing page is the overclaim this project keeps catching.',
  },
]
