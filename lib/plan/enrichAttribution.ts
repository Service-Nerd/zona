// ENRICH-ATTRIB-01 (2026-09-03) — who is to blame for a violation on an
// enriched plan, and what the resulting status should say.
//
// Extracted from app/api/generate-plan/route.ts so the attribution rule is unit
// testable without standing up a stream handler, an auth boundary, and a live
// Anthropic call. The route owns the orchestration; this module owns the logic.
//
// ── Why this exists ──────────────────────────────────────────────────────────
//
// `generateRulePlan` validates its own output, but in production it only
// console.errors and returns the plan (ruleEngine.ts — never break the user;
// it throws in dev/test). So a rule plan reaching the enricher may ALREADY
// carry error-severity violations.
//
// PV2-A re-validated the enriched plan against zero errors and treated any
// violation as one the AI had introduced. The result, in prod, 2026-09-02:
// every trial plan whose runner had set `max_weekday_mins` was enriched
// successfully, then discarded and stamped 'failed', because the engine's
// race-week branch had skipped the life-first cap. Two plans, 2/2, and the
// only signal was a bare string in plan_json.
//
// The asymmetry that makes this a bug rather than a judgement call: the
// enricher physically cannot cause most violation classes. EnrichedWeekSchema
// exposes `label`, `theme` and `coach_notes` and nothing else — no numeric on
// any session is reachable from AI output. A duration violation on an enriched
// plan is therefore never the enricher's doing, by construction.

import type { Violation } from './invariants'
import type { EnrichFailureReason } from './enrich'
import type { EnrichmentStatus } from '@/types/plan'

/**
 * Identity of a violation for attribution purposes: code + week + day.
 *
 * Deliberately NOT code alone. The same invariant firing on a different week is
 * a genuinely new violation and must still revert the enrichment — code-only
 * matching would let the AI break week 3 for free whenever the engine had
 * already broken week 12.
 */
export function violationKey(v: Violation): string {
  return `${v.code}@w${v.week ?? '-'}:${v.day ?? '-'}`
}

/** Error-severity violations of `plan`, keyed for set membership. */
export function errorBaseline(violations: Violation[]): Set<string> {
  return new Set(
    violations.filter(v => v.severity === 'error').map(violationKey),
  )
}

/**
 * The error-severity violations present AFTER enrichment that were not present
 * before it. Only these are attributable to the enricher, and only these may
 * cause its output to be reverted.
 */
export function violationsIntroducedBy(
  baseline: Set<string>,
  postEnrich: Violation[],
): Violation[] {
  return postEnrich
    .filter(v => v.severity === 'error')
    .filter(v => !baseline.has(violationKey(v)))
}

/**
 * Map the enricher's failure reason onto the status persisted in
 * `plan_json.meta.enrichment`.
 *
 * The split exists so a failure can be triaged from the plan row alone rather
 * than by correlating against logs that have since rolled off:
 *   - failed_no_api_key  → deploy config (the env var is missing)
 *   - failed_api_error   → upstream: non-2xx from Anthropic, or transport threw
 *   - failed_unparseable → the model: not JSON, or JSON that failed the schema
 * `failed_invalid_copy` is set by the route, not here — it is our own revert
 * decision rather than one of the enricher's outcomes.
 */
export function statusForReason(reason: EnrichFailureReason): EnrichmentStatus {
  switch (reason) {
    case 'no_api_key':     return 'failed_no_api_key'
    case 'api_error':
    case 'fetch_failed':   return 'failed_api_error'
    case 'parse_error':
    case 'schema_invalid': return 'failed_unparseable'
  }
}
