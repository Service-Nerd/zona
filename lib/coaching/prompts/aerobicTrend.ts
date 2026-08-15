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

import { formatPace, formatDistanceForPrompt, type DistanceUnits } from '@/lib/format'

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
  /** Reader's preferred units (FMT-01). Defaults to 'km' — km output unchanged. */
  units?: DistanceUnits
}

// secPerKmToDisplay removed (FMT-01) — the fifth copy of the pace rule.
// lib/format.ts -> formatPace is the single owner (INV-FMT-001).

export function buildAerobicTrendPrompt(ctx: AerobicTrendContext): string {
  const units: DistanceUnits = ctx.units ?? 'km'
  const pace = formatPace(ctx.avgPaceSecPerKm, units)
  // Voice examples must quote the reader's unit or the model copies '/km' back.
  const examplePace = formatPace(340, units) ?? '5:40/km'
  const directionLabel = ctx.hrDeltaBpm < 0 ? 'dropped' : 'risen'
  const absDelta = Math.abs(ctx.hrDeltaBpm)
  const paceCtx = pace ? ` at around ${pace} pace` : ''

  return `You are Kit, the Zonna AI running coach. Write one or two short sentences interpreting this aerobic trend for the runner. Be honest, dry, specific. Never cheerleader. No emojis. Never mention percentages, cohort sizes, or thresholds.

Trend data:
- Long runs${paceCtx}: average HR ${directionLabel} ${absDelta} bpm from ${ctx.earlierHr} bpm (${ctx.earlierMonth}) to ${ctx.nowHr} bpm (now)
- Anchor distance: approximately ${formatDistanceForPrompt(ctx.anchorDistanceKm, units, 1) ?? '—'} long runs

Voice examples (match this register):
  HR down → "Long run at ${examplePace}. Easy is easier than it was."
  HR flat  → "Long run at ${examplePace}. Steady — and that's the point."
  HR up    → "Long run at ${examplePace}. HR's drifted up. Worth checking what changed."

Rules:
- If HR dropped: frame it as "easier", not "better" or "faster". The brand is zone discipline, not performance.
- If HR rose: be honest, not alarming. One possible explanation only if obvious (e.g. summer heat, higher mileage).
- Never say "you're improving", "great work", "amazing progress", or anything motivational.
- Max 2 sentences. Preferably 1. Each sentence under 12 words.
- Output only the sentences. No explanation, no preamble.`
}
