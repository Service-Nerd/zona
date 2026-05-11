// Canonical Anthropic model IDs.
// Every AI call site imports from here — never hardcode model strings elsewhere.
//
// Two-tier split (2026-05-11):
//   ANTHROPIC_MODEL       — fast, low-cost. Use for short single-shot surfaces
//                            where voice scaffolding does most of the lifting
//                            and reasoning depth is modest.
//                            Surfaces: daily-coach-note, analyse-run (session feedback).
//
//   ANTHROPIC_MODEL_DEEP  — synthesis tier. Use for surfaces that reason across
//                            multiple data points, multi-week context, or
//                            phase-level patterns. The cost delta is small at
//                            our call volume (these fire <1/day per active user).
//                            Surfaces: weekly-report, phase-summary,
//                            race-readiness, adjust-plan explanation.
//
// To bump either model, change it here in exactly one place.

export const ANTHROPIC_MODEL      = 'claude-haiku-4-5-20251001'  as const
export const ANTHROPIC_MODEL_DEEP = 'claude-sonnet-4-5-20250929' as const

export type AnthropicModel     = typeof ANTHROPIC_MODEL
export type AnthropicModelDeep = typeof ANTHROPIC_MODEL_DEEP
