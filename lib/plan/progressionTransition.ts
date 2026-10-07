import { bandCeiling } from './paceBands'

/**
 * The single owner of "a progression's ramp, as a string".
 *
 * §8 Amendment (Coaching Board, 2026-10-07) ruled that a progression's middle
 * third names the ramp it describes rather than resolving to nothing. Two
 * callers need that string and they must not be two writers of it:
 *
 *   1. `resolveMainSet` — at GENERATION, from the runner's E and T anchors.
 *   2. `sessionSteps` — at READ, for a plan generated BEFORE the fix.
 *
 * 🔴 THE SECOND CALLER IS NOT OPTIONAL AND IT IS WHY THIS MODULE EXISTS. The
 * ramp is stamped into `plan_json.weeks[].sessions[].derived_set` at generation,
 * so **every fix to the generator leaves an existing plan exactly as it was.**
 * The founder asked three times why his own Tuesday session still showed
 * `9:20 min`; the answer was in his stored row, not in the engine:
 *
 *     step1  9:20  pace="5:53–7:02 /km"
 *     step2  9:20  pace=null  zone="Z2-Z3"      ← generated 2026-04-21
 *     step3  9:20  pace="5:07–5:22 /km"
 *
 * 📐 Measured across the WHOLE production `plans` table (not a sample): 30 plans,
 * **13 affected, 30 steps, and 30 of 30 are `progressive_tempo`** — every one
 * bracketed by a paced work step on both sides. Only 9 of the 13 carry
 * `meta.vdot`, so rebuilding the pace guide would have fixed two thirds of them;
 * reading the neighbours fixes all 13 and needs no production write.
 */
export function transitionBand(fromBand: string | null | undefined, toBand: string | null | undefined): string | null {
  const start = bandCeiling(fromBand)
  const end = bandCeiling(toBand)
  if (!start || !end) return null
  // ⚠️ A RAMP THAT IS NOT A RISE IS NOT RENDERED. `PROGRESSION-GOAL-INVERTED-01`:
  // a goal-paced marathon progression can have a goal band SLOWER than the
  // runner's own easy ceiling, so the "ramp" would instruct them to slow down
  // through a step whose note says "let it rise". Degrades to the zone band.
  
  if (toSecs(start) <= toSecs(end)) return null
  const unit = /\/mi\b/.test(toBand ?? '') ? '/mi' : '/km'
  return `${start} → ${end} ${unit}`
}

function toSecs(mmss: string): number {
  const [m, s] = mmss.split(':').map(Number)
  return (m ?? 0) * 60 + (s ?? 0)
}
