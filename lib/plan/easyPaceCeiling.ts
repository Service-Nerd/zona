// CD-11 / CoachingPrinciples §12 — for an EASY or RECOVERY run the only number
// that matters is the Zone 2 ceiling: the FAST end of the band. An 81-second
// window ("7:11–8:32 /km") reads as a target a runner can fill the whole of;
// the point is the cap. Present it as "7:11 /km or slower" — going slower is
// fine (§12 is a ceiling, no floor), going faster is the overcooking the whole
// product exists to prevent ("Slow down. You've got a day job.").
//
// DISPLAY ONLY — session.pace_target keeps the full range in the data. Quality,
// long and race sessions keep their band, because there the range IS the target.
//
// Note on pace inversion: a smaller min/km is FASTER, so the fast end is the
// first (smaller) number in the band, and the constraint is "that pace or
// slower" — never a "≤" symbol, which reads backwards for pace.
export function easyPaceAsCeiling(
  paceTarget: string | null | undefined,
  sessionType: string,
): string | null | undefined {
  if (!paceTarget) return paceTarget
  if (sessionType !== 'easy' && sessionType !== 'recovery' && sessionType !== 'run') {
    return paceTarget
  }
  const m = paceTarget.match(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/)
  if (!m) return paceTarget // already a single value or a placeholder — leave it
  const fast = m[1]
  const unit = paceTarget.includes('/km') ? ' /km' : paceTarget.includes('/mi') ? ' /mi' : ''
  return `${fast}${unit} or slower`
}

/**
 * Split a pace string into the METRIC and its QUALIFIER.
 *
 * 🔴 WHY THIS LIVES BESIDE THE PRODUCER. `easyPaceAsCeiling` above is what
 * appends " or slower", so it is the only thing that knows the shape. The
 * session card needs the two parts separately and parsing them at the call site
 * would be a second reader of a format this module owns — the duplication class
 * this repo keeps paying for.
 *
 * ⚠️ THE WORDS ARE COACHING DOCTRINE, NOT DECORATION (CD-11 / §12, and the
 * comment at the top of this file). This splits them for TYPOGRAPHY; it must
 * never be used to drop them. Design owns the encoding, coaching owns the
 * meaning.
 *
 * 📐 The defect it exists for: `"5:53 /km or slower"` is **19 characters
 * rendered at 22px** in a half-width grid column with ~129px of content width —
 * roughly 1.8x what it has, so it wrapped to two lines and made the tile taller
 * than its neighbour. Founder: *"one side is bigger than the other."* The
 * distance tile already solves this, rendering `10` at 22px and ` km` at 11px.
 *
 * A range ("5:30–5:50 /km") has no qualifier and comes back whole — there the
 * range IS the target, so nothing may be demoted.
 */
export function splitPaceQualifier(
  pace: string | null | undefined,
): { value: string; qualifier: string | null } | null {
  if (!pace) return null
  const m = pace.match(/^(.*?)\s+(or slower)$/i)
  if (!m) return { value: pace, qualifier: null }
  return { value: m[1]!.trim(), qualifier: m[2]! }
}
