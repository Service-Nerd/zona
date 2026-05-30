/**
 * Prompt builder for the Aerobic Trend gloss sentence (AI-DEPTH-03).
 *
 * Generates a ≤2-sentence Zonna-voice interpretation of the HR-at-same-pace
 * trend. The numbers are displayed in the TrendCard UI separately — the
 * gloss names what they mean, not what they are.
 *
 * Voice spec:
 *   - Honest, dry, specific. Never cheerleader.
 *   - One sentence is better than two.
 *   - The number does the work — the gloss frames the implication only.
 *   - HR ↓ → "easier", not "better", not "progress"
 *   - HR ↑ → honest flag, not alarm
 *   - Never mention % improvements, cohort sizes, or technical thresholds.
 *
 * Model: ANTHROPIC_MODEL (Haiku) — 2-sentence output, no synthesis needed.
 *
 * See: docs/canonical/brand.md § Reframe Voice for tone reference.
 */

export interface AerobicTrendContext {
  /** Short month label for the oldest bucket e.g. 'Feb'. */
  earlierMonth: string
  /** Short month label for the most recent bucket, typically 'now'. */
  nowMonth: string
  /** Avg HR in the earliest bucket (bpm). */
  earlierHr: number
  /** Avg HR in the most recent bucket (bpm). */
  nowHr: number
  /** Signed delta: negative = HR dropped (good). */
  hrDeltaBpm: number
  /** Anchor distance in km, rounded to 1 dp — e.g. '28.0'. */
  anchorDistanceKm: number
  /** Avg pace for the anchor cohort (sec/km) — converted to display string in the builder. */
  avgPaceSecPerKm: number | null
}

function secPerKmToDisplay(sec: number): string {
  const mins = Math.floor(sec / 60)
  const secs = Math.round(sec % 60)
  return `${mins}:${String(secs).padStart(2, '0')}/km`
}

export function buildAerobicTrendPrompt(ctx: AerobicTrendContext): string {
  const pace = ctx.avgPaceSecPerKm ? secPerKmToDisplay(ctx.avgPaceSecPerKm) : null
  const directionLabel = ctx.hrDeltaBpm < 0 ? 'dropped' : 'risen'
  const absDelta = Math.abs(ctx.hrDeltaBpm)
  const paceCtx = pace ? ` at around ${pace} pace` : ''

  return `You are Kit, the Zonna AI running coach. Write one or two short sentences interpreting this aerobic trend for the runner. Be honest, dry, specific. Never cheerleader. No emojis. Never mention percentages, cohort sizes, or thresholds.

Trend data:
- Long runs${paceCtx}: average HR ${directionLabel} ${absDelta} bpm from ${ctx.earlierHr} bpm (${ctx.earlierMonth}) to ${ctx.nowHr} bpm (now)
- Anchor distance: approximately ${ctx.anchorDistanceKm.toFixed(1)} km long runs

Voice examples (match this register):
  HR down → "Long run at 5:40/km. Easy is easier than it was."
  HR flat  → "Long run at 5:40/km. Steady — and that's the point."
  HR up    → "Long run at 5:40/km. HR's drifted up. Worth checking what changed."

Rules:
- If HR dropped: frame it as "easier", not "better" or "faster". The brand is zone discipline, not performance.
- If HR rose: be honest, not alarming. One possible explanation only if obvious (e.g. summer heat, higher mileage).
- Never say "you're improving", "great work", "amazing progress", or anything motivational.
- Max 2 sentences. Preferably 1. Each sentence under 12 words.
- Output only the sentences. No explanation, no preamble.`
}
