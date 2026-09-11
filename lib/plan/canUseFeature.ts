// FREE — infrastructure
// Option A reverse-trial gate helper. Server-side only — call from API routes,
// not from client components. UI gates should mirror this logic but never
// substitute for it (per ADR-003).
//
// See `lib/plan/featureGates.ts` for category definitions and
// `docs/canonical/monetisation-strategy.md` for Option A semantics.

import { FEATURE_GATES, type GatedFeature } from './featureGates'
import type { UserTier } from '@/lib/trial'

export interface CanUseResult {
  allowed: boolean
  reason:  'free_always' | 'granted_at_trial_retained' | 'trial_active' | 'paid_active' | 'paid_required'
}

/**
 * Resolve whether a user with a given tier can use a feature *right now*.
 *
 * Three buckets:
 * - FREE_ALWAYS:                          allowed for everyone
 * - GRANTED_AT_TRIAL_RETAINED_IN_FREE:    allowed if user EVER had trial/paid access
 *                                          (Option A: retained-in-free for the trial-era artefact)
 * - PAID_ONLY_ONGOING:                    allowed only for trial/paid right now
 *
 * **Note on Option A semantics**: "GRANTED_AT_TRIAL_RETAINED" is about whether the
 * USER may continue interacting with an EXISTING artefact (e.g. their trial-era
 * plan). It does NOT permit creating a *new* such artefact. "Generate a new
 * personalised plan" maps to `new_plan_generation` in PAID_ONLY_ONGOING.
 *
 * Callers must pass the actual feature being requested and not the *kind* of
 * artefact. E.g. when the user opens their existing plan, the gate is
 * `personalised_plan` (granted-retained); when they tap "regenerate", the gate
 * is `new_plan_generation` (paid-required).
 */
export function canUseFeature(feature: GatedFeature, tier: UserTier): CanUseResult {
  if ((FEATURE_GATES.FREE_ALWAYS as readonly string[]).includes(feature)) {
    return { allowed: true, reason: 'free_always' }
  }

  if ((FEATURE_GATES.GRANTED_AT_TRIAL_RETAINED_IN_FREE as readonly string[]).includes(feature)) {
    // Option A: retained-in-free. We treat this as allowed for everyone,
    // because the gate at the *creation* of the artefact (e.g. plan generation)
    // already enforced paid-or-trial. Once the artefact exists, viewing or
    // interacting with it is unconditionally allowed.
    return { allowed: true, reason: 'granted_at_trial_retained' }
  }

  if ((FEATURE_GATES.PAID_ONLY_ONGOING as readonly string[]).includes(feature)) {
    if (tier === 'paid')   return { allowed: true,  reason: 'paid_active' }
    if (tier === 'trial')  return { allowed: true,  reason: 'trial_active' }
    return { allowed: false, reason: 'paid_required' }
  }

  // Unknown feature — fail closed.
  return { allowed: false, reason: 'paid_required' }
}

/**
 * Convenience: returns true/false directly. Use canUseFeature() when you need
 * the reason for telemetry or copy selection.
 */
export function isFeatureAllowed(feature: GatedFeature, tier: UserTier): boolean {
  return canUseFeature(feature, tier).allowed
}

// ── The distance paywall (TIER-ENFORCE-01) ──────────────────────────────────
//
// THE SINGLE OWNER of "may this tier build a plan for this distance?".
//
// It lived in exactly one place before: a private `isPaidDistance` inside
// `GeneratePlanScreen.tsx`, a CLIENT component. So the commercial boundary was
// enforced only in the browser, while ADR-003 names the API route as the auth
// boundary and ten other routes honour that. `/api/generate-plan` read neither
// this nor `free_tier_available`.
//
// Putting it here rather than duplicating the check server-side is the point:
// the wizard's locked tile and the route's 403 must agree by construction, or a
// runner meets a lock the server would have allowed (or worse, the reverse).
// Same lesson as the tier resolution earlier today — a rule written twice is a
// rule that drifts.
//
// `PLAN_SIGNATURES[d].free_tier_available` stays the DATA. This is the
// predicate over it, so the per-distance answer still has exactly one source.

import { PLAN_SIGNATURES } from './planSignatures'
import { raceDistanceKey } from './generationConfig'

/** Does this distance require a paid or trial tier? Data: PLAN_SIGNATURES. */
export function isPaidDistance(raceDistanceKm: number): boolean {
  return !PLAN_SIGNATURES[raceDistanceKey(raceDistanceKm)].free_tier_available
}

/**
 * May a runner on `tier` GENERATE a plan for this distance?
 *
 * Trial counts as allowed — the reverse trial grants full access for 14 days,
 * and a charity grant resolves to `paid` via `resolveTier`, so a comped runner
 * never meets this gate.
 *
 * NOTE what this does NOT govern: reading a plan you already built. Option A
 * retains the artefact (`plan_view`, `personalised_plan`), and nothing here is
 * consulted on that path. A runner who built a marathon plan on trial keeps it
 * after downgrading; they simply cannot build a NEW one. That is the intended
 * conversion moment, per feature-registry "Distance tier gating".
 */
export function canGenerateDistance(raceDistanceKm: number, tier: UserTier): boolean {
  if (!isPaidDistance(raceDistanceKm)) return true
  // ALLOWLIST, not `tier !== 'free'`. The negative form fails OPEN: any value
  // outside the union — a future tier, a typo, an empty string off a bad read —
  // would have been granted a paid distance. `canUseFeature` above already ends
  // "Unknown feature — fail closed" for the same reason. Caught by
  // distancePaywall.test.ts before this shipped, which is why that test asserts
  // on junk tiers rather than only on the three real ones.
  return tier === 'paid' || tier === 'trial'
}
