// Canonical Anthropic model IDs.
// Every AI call site imports from here — never hardcode model strings elsewhere.
// To bump the model, change it in exactly one place.

export const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001' as const
export type AnthropicModel = typeof ANTHROPIC_MODEL
