// OPS-ENRICH-HEALTH-01 (2026-10-02) — is the AI voice actually reaching runners?
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
// `plan_enrich_failed` had ONE WRITER AND ZERO READERS. No route, no digest, no
// alert — so enrichment could degrade indefinitely and the only way to notice was
// for someone to query by hand, which is exactly how it was noticed on 2026-10-02,
// after the founder said live users had arrived.
//
// ADR-006 makes the fallback silent TO THE RUNNER by design, and that is correct
// and unchanged. It was also silent to US, which never was.
//
// ── 🔴 THE DENOMINATOR IS THE WHOLE DESIGN, AND I GOT IT WRONG FIRST ─────────
// My first measurement computed a failure RATE from ops_events as
// `failed / (failed + plan_enrich_server_saved)` and reported **67%** — to the
// founder, in two commit messages, a registry row and the build log.
//
// It is wrong. `plan_enrich_server_saved` is recorded ONLY when
// `shouldServerPersist()` is true — i.e. when the server's backstop actually had
// to write because the runner closed the app before the enricher finished. It is
// not a success counter; it is a subset of successes. So the denominator was
// "failures plus some successes" and the rate was meaningless.
//
// The sound denominator is the PLANS TABLE: `plan_json.meta.enrichment`
// self-describes, which is precisely why ENRICH-SAVE-01 put it there. Measured
// that way: 18 eligible plans, 16 with voice, **2 with none — 11%, not 67%.**
//
// So this module judges STATE, not a rate. A failure event is a thing that
// happened; `meta.enrichment` is the thing the runner HAS.
import type { Plan } from '@/types/plan'

/** Enrichment states in which the model's copy actually reached the plan. Shared
 *  vocabulary with `notesProvenance.ts` — one definition, not two. */
export const ENRICHED_STATES = ['applied', 'applied_partial'] as const

/** Free plans are never enriched (by design) and legacy plans predate the field.
 *  Neither is a failure, and counting them would deflate the rate. */
// `skipped_plan_kind`: staged and get-running plans are never enriched by design
// (stagedRacePlan.ts, getRunningPlan.ts). It counted as "without voice" until
// REBUILD-VOICE-LOSS-01, and was the single runner the 28 Oct digest reported.
export const NOT_ELIGIBLE = ['skipped', 'skipped_plan_kind'] as const

export interface EnrichStateRow {
  user_id: string
  created_at: string
  enrichment: string | null
}

export interface EnrichHealthVerdict {
  /** Plans that could have been enriched: excludes free-tier and legacy. */
  eligible: number
  withVoice: number
  /** 🔴 The number that matters: runners holding a plan with NO model copy. */
  withoutVoice: number
  /** Percent of eligible plans with no voice. `null` when there is nothing to divide. */
  withoutVoicePct: number | null
  /** One entry per runner with no voice — this is who remediation would target. */
  affected: Array<{ user_id: string; created_at: string; enrichment: string }>
  /**
   * ⚠️ ANY runner with no voice raises this. Not a threshold, deliberately: at
   * this scale a percentage is noise (2 of 18 is 11%; one more plan moves it 5pp),
   * and a paying runner with no AI coaching is a fact, not a rate. If the fleet
   * grows to where that is too loud, change it with a measurement, not a guess.
   */
  alert: boolean
}

export function judgeEnrichHealth(rows: readonly EnrichStateRow[]): EnrichHealthVerdict {
  const eligibleRows = rows.filter(r =>
    r.enrichment != null
    && !(NOT_ELIGIBLE as readonly string[]).includes(r.enrichment))

  const withVoiceRows = eligibleRows.filter(r =>
    (ENRICHED_STATES as readonly string[]).includes(r.enrichment!))

  // Anything eligible that is not enriched is a runner without voice — including
  // `pending`, which ENRICH-SAVE-01 says is expected TRANSIENTLY and is a defect
  // only if it persists. A stuck `pending` runner has no voice either, so it
  // belongs here rather than being quietly excluded.
  const withoutVoiceRows = eligibleRows.filter(r =>
    !(ENRICHED_STATES as readonly string[]).includes(r.enrichment!))

  return {
    eligible: eligibleRows.length,
    withVoice: withVoiceRows.length,
    withoutVoice: withoutVoiceRows.length,
    withoutVoicePct: eligibleRows.length
      ? Math.round((100 * withoutVoiceRows.length) / eligibleRows.length)
      : null,
    affected: withoutVoiceRows
      .map(r => ({ user_id: r.user_id, created_at: r.created_at, enrichment: r.enrichment! }))
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    alert: withoutVoiceRows.length > 0,
  }
}

/** True when the plan carries model-written copy, fully or in part. A rebuild that
 *  regenerates the rule plan deletes that copy, so every rebuild guard asks THIS,
 *  never `=== 'applied'` (REBUILD-VOICE-LOSS-01: three paid plans were rebuilt on
 *  2026-10-28 because the guard named one of the two states). */
export function hasAiCopy(meta: Pick<Plan['meta'], 'enrichment'> | null | undefined): boolean {
  return (ENRICHED_STATES as readonly string[]).includes(meta?.enrichment ?? '')
}

/** The state a plan with NO recorded enrichment is given when it cannot be legacy. */
export const NOT_RECORDED = 'not_recorded'

/**
 * The enrichment state a stored plan self-describes, or `null` for a legacy row.
 *
 * 🔴 REBUILD-VOICE-LOSS-01 (2026-10-28): `null` used to mean "legacy" without
 * condition. But a plan regenerated by a script carries no `enrichment` field at
 * all, so seven paid runners whose rebuilds had deleted their AI copy read as
 * legacy and were skipped by this check, by the digest and by
 * `scripts/reenrich-plans.ts`, which reads this same function. A plan that carries
 * `meta.generator_input` (PV2-A) cannot predate the field, so an absent state there
 * is `not_recorded`: eligible, and without voice. Free plans and maintenance /
 * base-build plans are never enriched and stay `null`.
 */
export function enrichmentStateOf(plan: Pick<Plan, 'meta'> | null | undefined): string | null {
  const meta = plan?.meta
  if (meta?.enrichment != null) return meta.enrichment
  if (!meta?.generator_input) return null
  if (meta.tier === 'free' || (meta.plan_kind && meta.plan_kind !== 'race')) return null
  return NOT_RECORDED
}
