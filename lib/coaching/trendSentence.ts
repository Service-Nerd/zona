// Kit's one-line read on the aerobic trend — the interpretation that sits in the
// CO-ONE body while `TrendCard` shows the numbers.
//
// 🔴 WHY THIS IS A FUNCTION AND NOT A TEMPLATE LITERAL.
// It used to be one inline string, hardcoded to improvement:
//
//     `Easy is easier than it was — ${earlierHr} down to ${nowHr} since ${month}.`
//
// Its only guard was the presence of a model-written `gloss`, and the gloss is
// produced whenever `hrIsTrending` — which is
// `Math.abs(hrDeltaBpm) >= MIN_HR_DELTA_BPM`. **Absolute value: it fires in both
// directions.** So a runner whose easy heart rate had RISEN by 4+ bpm was told
// "Easy is easier than it was — 147 down to 152": a claim contradicted by the
// two numbers inside it. Same family as the "stepped volume up from 32 to 32 km"
// defect — the engine did the right thing and then described it wrongly.
//
// The Coaching Board made the regression case binding for the Coach redesign
// (McMillan: "a surface that can only speak when the arrow is up is marketing").
// This was worse than silent — it was confidently wrong.
//
// VOICE. The regression line states the fact, then gives the benign reading
// first. A rising easy HR mid-build is usually load, not decline, and §1's
// framing is that it is worth noticing rather than panicking about. No alarm
// register: `--danger` is for errors, never training UI.

export interface TrendReadInput {
  /** avgHr of the earliest bucket in the window. */
  earlierHr: number
  /** avgHr of the most recent bucket. */
  nowHr: number
  /** Short month label for the earlier bucket, e.g. "Jun". */
  earlierMonth: string
}

/**
 * One sentence, direction-aware.
 *
 * Equal heart rates read as the improvement branch deliberately: "held steady"
 * is the honest description and it is the better news of the two, so a flat
 * trend should not be framed as a cost.
 */
export function trendSentence({ earlierHr, nowHr, earlierMonth }: TrendReadInput): string {
  if (nowHr <= earlierHr) {
    return `Easy is easier than it was — ${earlierHr} down to ${nowHr} since ${earlierMonth}.`
  }
  return `Easy is costing you more than it was — ${earlierHr} up to ${nowHr} since ${earlierMonth}. `
       + `That is common mid-build, and worth watching if it holds.`
}
