// REFUSAL-COPY-02 — the single owner of "what do we CALL this race distance to
// a runner?".
//
// WHY THIS EXISTS. `thresholdsKey()` returns the config key — `'MARATHON'`,
// `'HM'`, `'50K'` — and the §44/§52 refusal messages interpolated it straight
// into runner-facing prose: *"2 days/week is not enough for a MARATHON."* A
// config key is an identifier, not a noun, and shouting it at someone who has
// just been refused a plan is the opposite of the tone that refusal needs.
//
// Kept here rather than in `lib/format.ts` on purpose: `format.ts` owns
// NUMBERS rendered in a runner's chosen units (ADR-015), and a race name is
// neither a number nor unit-dependent. `'HM'` is "a half marathon" whether you
// read km or miles.

import { GENERATION_CONFIG } from './generationConfig'

export type RaceThresholdKey = keyof typeof GENERATION_CONFIG.PREP_TIME_THRESHOLDS

/**
 * Lower case and article-ready: every caller reads "for a {label}", so the
 * label carries no capital and no article of its own.
 */
const RACE_LABELS: Record<RaceThresholdKey, string> = {
  '5K':       '5K',
  '10K':      '10K',
  'HM':       'half marathon',
  'MARATHON': 'marathon',
  '50K':      '50K ultra',
  '100K':     '100K ultra',
}

export function raceLabelFor(key: RaceThresholdKey): string {
  return RACE_LABELS[key]
}
