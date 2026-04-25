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
    'ai_coach_notes_new',        // new coach notes (e.g. after a reshape)
    'injury_adaptations_new',    // adaptations applied to new plans or after reshape
    'strava_intelligence',       // run analysis, weekly report, plan adjustment triggers
    'confidence_score',          // R18 confidence scoring
    'ultra_plan_generation',     // 50K and 100K plan generation
    'new_plan_generation',       // generating a new plan after the trial-era plan
    'strength_sessions_tailored', // R21 tailored strength (when shipped)
  ],

  FREE_ALWAYS: [
    'generic_plan_templates',    // 5K/10K/HM template plans (no AI)
    'manual_session_completion', // marking a session done without Strava
    'plan_view',                 // reading the existing plan
    'basic_strength_sessions',   // placeholder strength stubs
  ],
} as const

export type GrantedFeature = typeof FEATURE_GATES.GRANTED_AT_TRIAL_RETAINED_IN_FREE[number]
export type PaidOnlyFeature = typeof FEATURE_GATES.PAID_ONLY_ONGOING[number]
export type FreeAlwaysFeature = typeof FEATURE_GATES.FREE_ALWAYS[number]
export type GatedFeature = GrantedFeature | PaidOnlyFeature | FreeAlwaysFeature
