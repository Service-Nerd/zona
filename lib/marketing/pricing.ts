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

/**
 * PRICING-ROW-TRUTH-01 (Traynor, SLT 2026-09-20) — HOW A ROW'S CLAIM IS BACKED.
 *
 * `pricing.test.ts` proves every paid gate has a ROW. It cannot prove the row
 * DESCRIBES WHAT THE PRODUCT DOES, and it passed throughout the period
 * `TT-PRICING-CLAIM-01`'s claim was false on 58% of plans. **The guard held
 * while the claim rotted.** Traynor: *"We found this one by accident. There
 * are others."* There were: building this turned up `rule_engine_regeneration`
 * claiming *"No limit."* against a live ten-per-hour cap on every tier.
 *
 * ⚠️ "IS THIS SENTENCE TRUE OF THE PRODUCT" IS NOT DECIDABLE BY A TEST, and
 * pretending otherwise would be worse than nothing here — a green tick with
 * nothing behind it is this repo's most repeated failure, and in this exact
 * place a green tick is what allowed the rot. So this does not claim to
 * evaluate truth. It does three smaller things that are real:
 *
 *   1. every row must DECLARE which kind of claim it is, so a new row cannot
 *      be added without someone deciding;
 *   2. `mechanical` rows are actually EXECUTED against the product in
 *      `pricingRowTruth.test.ts`;
 *   3. `reviewed` rows are PINNED TO THEIR TEXT — change the sentence without
 *      changing the review date and the build fails.
 *
 * ⚠️ Deliberately NOT an expiry date on reviews. A check that fires on correct
 * work every ninety days gets switched off, which this repo has recorded as
 * equivalent to having no check. It fires on an EDIT, which is the moment a
 * claim actually changes.
 */
export type RowEvidence =
  /** A claim the product can be asked about directly. Predicate lives in the test. */
  | { kind: 'mechanical' }
  /** A claim only a human can judge. Pinned to `detail` as written on `on`. */
  | { kind: 'reviewed'; on: string; by: string }

export interface TierFeature {
  /** The gate this row describes, where one exists. Used by the drift test. */
  gate?: GatedFeature
  name: string
  /** One sentence on what it does FOR THE RUNNER. Not a feature name repeated. */
  detail: string
  /** How this row's claim is backed. Required — see RowEvidence. */
  evidence: RowEvidence
}

/** Free forever, no account age limit. */
export const FREE_FEATURES: TierFeature[] = [
  {
    gate: 'generic_plan_templates',
    name: '5K, 10K and half marathon plans',
    detail: 'Built by the same engine, for your race date and the days you can actually run.',
    evidence: { kind: 'mechanical' },
  },
  {
    gate: 'plan_view',
    name: 'The whole plan, every week',
    detail: 'Nothing is hidden behind a blur or a teaser. You can read the lot.',
    evidence: { kind: 'reviewed', on: '2026-09-20', by: 'architect' },
  },
  {
    gate: 'rule_engine_regeneration',
    name: 'Rebuild it whenever you like',
    // PRICING-ROW-TRUTH-01 (2026-09-20) — this read "No limit." and that was
    // FALSE on every tier. `app/api/generate-plan/route.ts` calls
    // `guardAiRequest(req, user.id, 'generate-plan')` before the tier branch,
    // and `AI_ROUTE_LIMITS['generate-plan']` is `HEAVY_LIMIT` — ten per hour.
    // No real runner regenerates eleven plans in an hour, which is exactly why
    // nobody noticed: the claim is harmless in practice and absolute in words,
    // and an absolute claim that is false is the same defect as
    // TT-PRICING-CLAIM-01. Found on the FIRST row checked when building the
    // row-truth guard. The limiter is a security control and stays; the
    // sentence changes.
    detail: 'Change your race or your week and generate again, as often as you need.',
    evidence: { kind: 'mechanical' },
  },
  {
    gate: 'manual_session_completion',
    name: 'Log sessions by hand',
    detail: 'No watch and no Strava needed to tick a run off.',
    evidence: { kind: 'reviewed', on: '2026-09-20', by: 'architect' },
  },
  {
    gate: 'plan_difficulty_band',
    name: 'An honest read on the ask',
    detail: 'How demanding the plan is for you, said plainly before you start it.',
    evidence: { kind: 'reviewed', on: '2026-09-20', by: 'architect' },
  },
]

/** What a subscription adds. Ordered by how often it actually matters. */
export const PAID_FEATURES: TierFeature[] = [
  {
    gate: 'activity_intelligence',
    name: 'Every run read back to you',
    // COPY-SCORE-01 — "the weekly SCORE" is gone, and the word is the point.
    // The homepage sells this product as "no dashboard to read, no score to
    // chase" and the pricing page was selling a score to chase, three clicks
    // apart. Zonna does not do gamification (brand.md, and the SLT has killed
    // streak mechanics twice), so the one surface where someone is deciding to
    // pay must not describe the flagship paid feature as a number to beat.
    // The feature is unchanged; what it is CALLED is not.
    detail: 'Whether you actually held the zone, what your heart rate did, and how disciplined the week was.',
    evidence: { kind: 'reviewed', on: '2026-09-20', by: 'architect' },
  },
  {
    gate: 'dynamic_reshape_r20',
    name: 'A plan that moves when life does',
    detail: 'Miss a week and it reshapes around what you did, instead of leaving you to catch up on a week that has gone.',
    evidence: { kind: 'reviewed', on: '2026-09-20', by: 'architect' },
  },
  {
    gate: 'ai_coach_notes_new',
    name: 'Coaching in your own context',
    detail: 'Notes written for the session in front of you, not a library article about tempo runs.',
    evidence: { kind: 'reviewed', on: '2026-09-20', by: 'architect' },
  },
  {
    gate: 'ultra_plan_generation',
    name: 'Marathon and ultra plans',
    detail: 'Marathon, 50K and 100K. The distances where getting the build wrong costs you the start line.',
    evidence: { kind: 'mechanical' },
  },
  {
    gate: 'post_run_reframe',
    name: 'A second read on a bad run',
    detail: 'Tell it how the run felt and get an honest reframe, or a warning if the pattern says back off.',
    evidence: { kind: 'reviewed', on: '2026-09-20', by: 'architect' },
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
    evidence: { kind: 'reviewed', on: '2026-09-20', by: 'SLT' },
  },
  {
    gate: 'confidence_score',
    name: 'How much to trust the plan',
    detail: 'The engine tells you how confident it is, and why, rather than pretending it is certain.',
    evidence: { kind: 'reviewed', on: '2026-09-20', by: 'SLT' },
  },
  {
    gate: 'maintenance_coaching',
    name: 'What to do after the race',
    detail: 'A maintenance block so the fitness you built does not quietly leak away.',
    evidence: { kind: 'mechanical' },
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
