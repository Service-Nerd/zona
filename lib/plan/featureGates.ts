// FREE — infrastructure
// Option A reverse-trial categories. Three categories:
//
//   GRANTED_AT_TRIAL_RETAINED_IN_FREE
//     Earned during the 14-day trial; remain available after downgrade *for the
//     plan that was generated during the trial*. The plan a user builds during
//     the trial is theirs to keep.
//
//   PAID_ONLY_ONGOING
//     Required to use the PAID feature again *after* the trial ends. The
//     ongoing intelligence layer is the subscription value.
//
//   FREE_ALWAYS
//     Available regardless of trial status.
//
// See docs/canonical/monetisation-strategy.md and
// docs/canonical/CoachingPrinciples.md §15 for the rationale.
// Phase 6 wires these into the API route gates and the day-15 transition UI.

export const FEATURE_GATES = {

  GRANTED_AT_TRIAL_RETAINED_IN_FREE: [
    'personalised_plan',         // the plan generated during the trial
    'vdot_pace_zones',           // pace zones derived from benchmark
    'hr_karvonen_zones',         // Karvonen-derived HR zones
    'ai_coach_notes_existing',   // coach notes that already exist on plan sessions
    'session_catalogue_full',    // catalogue-sourced sessions on the existing plan
    'injury_adaptations_initial', // adaptations applied at plan creation
  ],

  PAID_ONLY_ONGOING: [
    'dynamic_reshape_r20',       // R20 auto + user-initiated reshape
    'ai_coach_notes_new',        // new coach notes (e.g. after a reshape) — also gates AI enrichment on regenerated plans
    'injury_adaptations_new',    // adaptations applied to new plans or after reshape
    'activity_intelligence',     // run analysis, weekly report, plan adjustment triggers (HealthKit + Strava)
    'confidence_score',          // R18 confidence scoring
    // DISTANCE PAYWALL — MARATHON, 50K and 100K. Named "ultra_" for historical
    // reasons; it has covered the marathon since R23 and the name is the only
    // thing that says otherwise. Authority: feature-registry "Distance tier
    // gating" (5K/10K/HM = FREE, Marathon/50K/100K = PAID) and CLAUDE.md's FREE
    // row (5K/10K/HM). This entry used to read "50K and 100K plan generation",
    // which contradicted both, and monetisation-strategy.md inherited the same
    // omission.
    //
    // ⚠️ THIS CONSTANT IS NOT THE ENFORCER. Nothing calls
    // isFeatureAllowed('ultra_plan_generation'). The paywall the user actually
    // meets is `PLAN_SIGNATURES[d].free_tier_available` read by
    // GeneratePlanScreen, which renders a PAID lock on the distance tile and
    // routes a tap to Upgrade. /api/generate-plan does NOT check either one, so
    // this commercial boundary lives only in a client component — see
    // TIER-ENFORCE-01 in the backlog. Do not "fix" that by wiring this constant
    // without reading the item first: a server gate would also block a free user
    // regenerating an EXISTING marathon plan, which Option A arguably grants.
    'ultra_plan_generation',
    'strength_sessions_tailored', // R21 tailored strength (when shipped)
    'race_time_estimates',        // estimated race times from VDOT / Strava aerobic pace
    'post_run_reframe',           // POST-RUN-REFRAME-01 — text/voice reflection + AI reframe
    'maintenance_coaching',       // MAINT-02 — AI voice on the post-race maintenance block (per-session notes + weekly debrief)
  ],

  // Note (R23-D6 resolution, 2026-04-25): `new_plan_generation` was previously
  // listed here but removed under the lenient interpretation of Option A. Free
  // users can regenerate rule-engine plans freely; AI enrichment on those new
  // plans is gated via `ai_coach_notes_new`. To revisit during the planned
  // free/paid audit. See docs/releases/backlog.md → R23-D6.

  FREE_ALWAYS: [
    'generic_plan_templates',    // 5K/10K/HM template plans (no AI)
    'rule_engine_regeneration',  // free users may regenerate rule-engine plans (R23-D6 lenient)
    'manual_session_completion', // marking a session done without Strava
    'plan_view',                 // reading the existing plan
    'basic_strength_sessions',   // placeholder strength stubs
    'plan_difficulty_band',      // ordinal demand label (§44/§31) — honesty signal, extends the FREE prep-time gate. SLT-signed FREE 2026-08-18. The numeric confidence score stays PAID.
  ],
} as const

export type GrantedFeature = typeof FEATURE_GATES.GRANTED_AT_TRIAL_RETAINED_IN_FREE[number]
export type PaidOnlyFeature = typeof FEATURE_GATES.PAID_ONLY_ONGOING[number]
export type FreeAlwaysFeature = typeof FEATURE_GATES.FREE_ALWAYS[number]
export type GatedFeature = GrantedFeature | PaidOnlyFeature | FreeAlwaysFeature
