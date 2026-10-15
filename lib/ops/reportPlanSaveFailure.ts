import { authedFetch } from '@/lib/supabase/authedFetch'

/**
 * PLAN-SAVE-SILENT-FAIL-01 (2026-10-15) — tell the server a plan save failed in the
 * browser, so a runner who tapped "Use this plan" and got nothing is no longer
 * indistinguishable from one who never tapped it.
 *
 * ⚠️ IT MUST NEVER THROW. It is called from inside a `catch` on the critical save
 * path; a reporter that rejects there would replace the runner's real failure with a
 * telemetry one. Every await is guarded and the function resolves either way.
 *
 * ⚠️ It reports; it does not decide what the runner sees. The on-screen message is
 * `GeneratePlanScreen`'s job, and is set BEFORE this is called so a slow or failing
 * report can never delay it.
 */
export interface PlanSaveFailureContext {
  raceDistanceKm?: number | null
  enrichmentPending?: boolean
  /** 1 for the first failed tap, 2 for the retry, and so on. */
  attempt?: number
}

export async function reportPlanSaveFailure(
  error: unknown,
  context: PlanSaveFailureContext = {},
): Promise<void> {
  try {
    const message = error instanceof Error ? error.message : String(error ?? '')
    const errorName = error instanceof Error ? error.name : typeof error
    await authedFetch('/api/ops/plan-save-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        errorName,
        raceDistanceKm: context.raceDistanceKm ?? undefined,
        enrichmentPending: context.enrichmentPending,
        attempt: context.attempt,
      }),
    })
  } catch {
    // Telemetry is best-effort. The runner has already been told the save failed.
  }
}
