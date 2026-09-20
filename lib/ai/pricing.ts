import { ANTHROPIC_MODEL, ANTHROPIC_MODEL_DEEP } from './models'

/**
 * Published list prices, USD per million tokens.
 *
 * ⚠️ THESE ARE A COPY OF AN EXTERNAL PRICE LIST AND THEY WILL GO STALE.
 * Nothing in this repo can verify them against Anthropic's billing, so every
 * figure derived from them is an ESTIMATE and must be labelled as one. They
 * exist so the question "what did the AI layer cost this week" has an answer
 * inside the product instead of only in a browser tab; reconciling that
 * estimate against the real invoice stays a human job.
 *
 * Cache multipliers are Anthropic's published ones: a cache WRITE costs 1.25x
 * the input rate, a cache READ 0.1x. `lib/plan/enrich.ts` and
 * `enrichMaintenance.ts` are the two surfaces that use prompt caching, and
 * they are also the two largest prompts, so ignoring the multipliers would
 * mis-state the biggest line.
 */
export const MODEL_PRICING_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  [ANTHROPIC_MODEL]:      { input: 1,  output: 5 },   // Haiku 4.5
  [ANTHROPIC_MODEL_DEEP]: { input: 3,  output: 15 },  // Sonnet 4.5
}

export const CACHE_WRITE_MULTIPLIER = 1.25
export const CACHE_READ_MULTIPLIER  = 0.1

export interface AiUsage {
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
}

export const ZERO_USAGE: AiUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationTokens: 0,
  cacheReadTokens: 0,
}

/**
 * Cost of one call in USD, or `null` when the model has no price entry.
 *
 * ⚠️ `null`, never 0. A model we have no price for costs SOMETHING, and a
 * silent zero is the `?? 0` failure this repo has recorded four times: the
 * total stays plausible while a whole surface is missing from it. The spend
 * route surfaces unpriced calls as their own line rather than folding them in.
 */
export function usageCostUsd(model: string, usage: AiUsage): number | null {
  const price = MODEL_PRICING_USD_PER_MTOK[model]
  if (!price) return null
  const perToken = (n: number, rate: number) => (n / 1_000_000) * rate
  return (
    perToken(usage.inputTokens, price.input) +
    perToken(usage.outputTokens, price.output) +
    perToken(usage.cacheCreationTokens, price.input * CACHE_WRITE_MULTIPLIER) +
    perToken(usage.cacheReadTokens, price.input * CACHE_READ_MULTIPLIER)
  )
}
