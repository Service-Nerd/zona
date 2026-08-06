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
