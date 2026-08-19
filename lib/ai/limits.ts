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
} as const

/** Per-route overrides. Routes not listed use the DEFAULT_* values. */
export const AI_ROUTE_LIMITS: Record<string, { limit: number; windowSeconds: number }> = {
  'generate-plan':     { limit: AI_LIMITS.HEAVY_LIMIT, windowSeconds: AI_LIMITS.HEAVY_WINDOW_SECONDS },
  'maintenance-block': { limit: AI_LIMITS.HEAVY_LIMIT, windowSeconds: AI_LIMITS.HEAVY_WINDOW_SECONDS },
  'post-race-reshape': { limit: AI_LIMITS.HEAVY_LIMIT, windowSeconds: AI_LIMITS.HEAVY_WINDOW_SECONDS },
  'adjust-plan':       { limit: AI_LIMITS.HEAVY_LIMIT, windowSeconds: AI_LIMITS.HEAVY_WINDOW_SECONDS },
  'post-run-reframe':  { limit: AI_LIMITS.HEAVY_LIMIT, windowSeconds: AI_LIMITS.HEAVY_WINDOW_SECONDS },
}
