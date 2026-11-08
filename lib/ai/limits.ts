/**
 * AI-route request limits (security audit findings 4 + 5).
 *
 * These are infra/security guardrails, not coaching numerics — they live here
 * rather than in GENERATION_CONFIG (which is exempt from the config-singularity
 * rule only for algorithm constants; these are a separate, security concern).
 *
 * Rate limits are per user, per route, fixed-window. Body caps bound how much
 * user text can become prompt tokens in a single request.
 */

export const AI_LIMITS = {
  /** Default request-body cap (bytes). Generous for structured plan payloads;
   *  the point is to reject megabyte-scale abuse, not trim legitimate input. */
  DEFAULT_MAX_BYTES: 64_000,

  /** Default per-user fixed window. */
  DEFAULT_LIMIT: 30,
  DEFAULT_WINDOW_SECONDS: 3600, // 1 hour

  /** Tighter budget for the expensive generation/reshape routes (Sonnet,
   *  large max_tokens). */
  HEAVY_LIMIT: 10,
  HEAVY_WINDOW_SECONDS: 3600, // 1 hour

  /**
   * 🔴 OPS-FN-DURATION-01 (2026-11-08) — THE CEILING, STATED IN CODE INSTEAD OF INHERITED.
   *
   * No route set `maxDuration`, so every one ran on whatever the platform default happened to
   * be — and that default has changed TWICE: 60 s Hobby / 90 s Pro, then 300 s on all plans,
   * **conditional on Fluid compute being enabled**, which cannot be verified from this machine
   * (observability returns 404; the project API does not expose it). **An invisible default
   * that governs whether a runner's plan finishes generating is exactly the `GTM-SITE-01`
   * shape** — an env var overriding twelve committed defaults, where "the code said one thing,
   * production did another". Keeping the number in git makes it reviewable.
   *
   * 📐 300 s is the MAXIMUM on Hobby and the DEFAULT on Pro, so it is valid on either and
   * the in-code value overrides `vercel.json`, the dashboard and the Fluid defaults.
   *
   * ⚠️ IT IS A CEILING, NOT A RESERVATION. Vercel bills active CPU, so declaring 300 on a
   * route whose p95 is 1.3 s costs nothing; what it buys is that the number is a decision.
   */
  ROUTE_MAX_DURATION_SECONDS: 300,

  /**
   * 🔴 THE CLIENT TIMEOUT, AND IT IS DERIVED FROM THE CEILING ABOVE, NOT FROM THROUGHPUT.
   *
   * `callAnthropic` had **no timeout of any kind** — no `AbortSignal`, no `AbortController` —
   * so a hung connection ran until the platform killed the function. ⚠️ **And a function the
   * platform kills cannot log its own death**: `ai_call_failed` has **0 rows, ever**, which is
   * not evidence of no failures. It is the `TELEMETRY-BLIND-01` shape, on the one failure a
   * duration ceiling exists to govern.
   *
   * 🔑 SO THE JOB OF THIS NUMBER IS NOT TO PREDICT A DURATION — IT IS TO FIRE BEFORE THE
   * PLATFORM DOES, so the failure is attributable. 240 s leaves 60 s for everything else the
   * route does after the model returns (generation, `validatePlan`, the repair ladder, the
   * save). A timeout at or above the ceiling is not a timeout; it is the current situation
   * with a constant next to it.
   *
   * ⚠️ I MODELLED IT FROM THROUGHPUT FIRST AND THE MODEL WAS WRONG. Pooled across 749 real
   * calls the p05 rate is 22.8 output tokens/s, which would size `enrich-plan`'s 14,000-token
   * ceiling at **615 s** — absurd, because the pooled rate is dominated by small calls that are
   * LATENCY-bound (29 tokens in 931 ms) while `enrich-plan` actually streams at **96–113
   * tok/s**. Two different regimes behind one average.
   *
   * 📐 MEASURED, for whoever tunes this next (`ops_events.ai_call`, 749 calls):
   * `enrich-plan` p50 **42.7 s**, p95 **57.0 s**, max **64.4 s** — and RISING: p50 went
   * 38.3 → 45.4 → **59.1 s** across 2026-09/10/11, with 3 of 103 calls already over 60 s.
   * Every other surface maxes at **5.7 s**. ⚠️ The item that filed this said *"plan enrichment
   * measures 28–35 s"*, which was stale by nearly 2× in the direction that matters.
   *
   * 🔻 NOT per-surface, deliberately. A hung `daily-coach-note` (p95 1.3 s) holds a function
   * for four minutes under this value, and tightening it per surface is a real improvement —
   * but four surfaces have n ≤ 5 samples and `enrich-maintenance` has **zero**, so the value
   * would be a guess wearing a measurement. Filed as `AI-TIMEOUT-PER-SURFACE-01`.
   */
  CALL_TIMEOUT_MS: 240_000,
} as const

/** Per-route overrides. Routes not listed use the DEFAULT_* values. */
export const AI_ROUTE_LIMITS: Record<string, { limit: number; windowSeconds: number }> = {
  'generate-plan':     { limit: AI_LIMITS.HEAVY_LIMIT, windowSeconds: AI_LIMITS.HEAVY_WINDOW_SECONDS },
  'maintenance-block': { limit: AI_LIMITS.HEAVY_LIMIT, windowSeconds: AI_LIMITS.HEAVY_WINDOW_SECONDS },
  'post-race-reshape': { limit: AI_LIMITS.HEAVY_LIMIT, windowSeconds: AI_LIMITS.HEAVY_WINDOW_SECONDS },
  'adjust-plan':       { limit: AI_LIMITS.HEAVY_LIMIT, windowSeconds: AI_LIMITS.HEAVY_WINDOW_SECONDS },
  'post-run-reframe':  { limit: AI_LIMITS.HEAVY_LIMIT, windowSeconds: AI_LIMITS.HEAVY_WINDOW_SECONDS },
  // SEC-15 (2026-09-20) — Sonnet, but only 300 max_tokens, so it is "expensive
  // model, cheap call" and does not match HEAVY's stated case exactly.
  // It is listed anyway because the DEFAULT of 30/hour is nonsense for a WEEKLY
  // artefact: the interactive caller can pass `?force=true` to regenerate, which
  // is the actual loop vector, and no runner legitimately regenerates their week
  // ten times in an hour, let alone thirty.
  'weekly-report':     { limit: AI_LIMITS.HEAVY_LIMIT, windowSeconds: AI_LIMITS.HEAVY_WINDOW_SECONDS },
}
