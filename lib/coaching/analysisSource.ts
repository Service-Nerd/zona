// RUN-ANALYSIS-SOURCE-LABEL-01 — the provenance a `run_analysis` row carries.
//
// The column defaults to 'strava' (migration 20260501) and `/api/analyse-run` never set it, so every analysis of a
// HealthKit run was stored labelled 'strava'. ADR-011: `source` is provenance, so a wrong label is a wrong record, and
// the single engine writer ADR-027 B4b introduces would otherwise inherit it. The CHECK already allows 'apple_health'.
// The manual route writes 'manual' itself and does not come through here.
// Derived from the ACTIVITY row's own `source`, not from which id keys the upsert: a HealthKit row later patched with a
// Strava id is still an Apple Health run (ADR-011), though the upsert keys on the Strava id.
export function analysisSourceFor(activitySource: string | null | undefined): 'strava' | 'apple_health' {
  return activitySource === 'apple_health' ? 'apple_health' : 'strava'
}
