/**
 * The canonical list of AI surfaces.
 *
 * ONE vocabulary. Before this file there were two overlapping ones and neither
 * was authoritative: `AI_ROUTE_LIMITS` keyed rate limits by a free-form string,
 * and each of the fourteen Anthropic call sites named itself only in a
 * `console.error` prefix. Nothing connected them, so a route could be rate
 * limited under one spelling and logged under another.
 *
 * Every call through `callAnthropic` names its surface from this list, and
 * `aiSurfaces.test.ts` fails the build if `AI_ROUTE_LIMITS` grows a key that is
 * not one of these — the producer and the list cannot drift apart silently.
 */
export const AI_SURFACES = [
  'adjust-plan',
  'analyse-run',
  'daily-coach-note',
  'enrich-plan',
  'enrich-maintenance',
  'free-intro',
  'phase-summary',
  'plan-weekly-note',
  'post-race-reshape',
  'post-run-reframe',
  'race-readiness',
  'trend',
  'weekly-free-insight',
  'weekly-report',
] as const

export type AiSurface = (typeof AI_SURFACES)[number]

export function isAiSurface(v: string): v is AiSurface {
  return (AI_SURFACES as readonly string[]).includes(v)
}
