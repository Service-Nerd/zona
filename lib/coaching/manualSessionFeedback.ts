/**
 * Rule-engine feedback for sessions completed without an activity link.
 *
 * Derives a verdict and one-line coaching note from RPE + fatigue tag only.
 * No AI calls — FREE tier, always available. Consumed by /api/analyse-run/manual.
 *
 * Verdict table:
 *   easy / recovery / run
 *     RPE ≤ 4             → nailed
 *     RPE 5–6             → close
 *     RPE 7+              → off_target
 *   quality / tempo / intervals / hard
 *     RPE ≥ 7             → nailed
 *     RPE 5–6             → close
 *     RPE < 5             → concerning
 *   long
 *     RPE ≤ 4             → nailed
 *     RPE 5–7             → close
 *     RPE 8+              → off_target
 *   race
 *     RPE ≥ 7             → nailed
 *     RPE 5–6             → close
 *     RPE < 5             → concerning
 *   fallback (strength / cross / other)
 *     RPE ≤ 5             → nailed
 *     RPE 6–7             → close
 *     RPE 8+              → off_target
 *   no RPE → 'close' (something was logged; we just don't have effort data)
 */

export type ManualVerdict = 'nailed' | 'close' | 'off_target' | 'concerning'

export function deriveManualVerdict(
  sessionType: string,
  rpe: number | null,
): ManualVerdict {
  if (rpe === null) return 'close'

  const isEasy     = ['easy', 'recovery', 'run'].includes(sessionType)
  const isHard     = ['quality', 'intervals', 'tempo', 'hard'].includes(sessionType)
  const isLong     = sessionType === 'long'
  const isRace     = sessionType === 'race'

  if (isEasy) {
    if (rpe <= 4) return 'nailed'
    if (rpe <= 6) return 'close'
    return 'off_target'
  }
  if (isHard) {
    if (rpe >= 7) return 'nailed'
    if (rpe >= 5) return 'close'
    return 'concerning'
  }
  if (isLong) {
    if (rpe <= 4) return 'nailed'
    if (rpe <= 7) return 'close'
    return 'off_target'
  }
  if (isRace) {
    if (rpe >= 7) return 'nailed'
    if (rpe >= 5) return 'close'
    return 'concerning'
  }
  // strength / cross-train / other
  if (rpe <= 5) return 'nailed'
  if (rpe <= 7) return 'close'
  return 'off_target'
}

/**
 * One-line coaching note derived from session type + RPE + fatigue tag.
 * Mirrors the register of getZonaReflectResponse in DashboardClient —
 * honest, dry, no cringe. Falls back to a fatigue-only note when RPE
 * is null (shouldn't happen in practice, but defensive).
 */
export function manualFeedbackText(
  sessionType: string,
  rpe: number | null,
  fatigueTag: string | null,
): string {
  // Fatigue-only fallback
  if (rpe === null) {
    if (fatigueTag === 'Fresh')   return "Legs felt good. That's what easy days are for."
    if (fatigueTag === 'Fine')    return 'Solid. Nothing to worry about.'
    if (fatigueTag === 'Heavy')   return 'Noted. The load is building.'
    if (fatigueTag === 'Wrecked') return 'Proper recovery tonight. Not optional.'
    return 'No activity data — RPE next time gives a clearer picture.'
  }

  const isEasy = ['easy', 'recovery', 'run'].includes(sessionType)
  const isHard = ['quality', 'intervals', 'tempo', 'hard'].includes(sessionType)
  const isLong = sessionType === 'long'
  const isRace = sessionType === 'race'

  if (isEasy) {
    if (rpe <= 3) return "That's exactly it. Easy should feel easy."
    if (rpe <= 5) return "Comfortable. You're in the right zone."
    if (rpe <= 7) return 'A touch warm for an easy day. Worth noting.'
    return "That ran too hot. Easy days are where most people quietly wreck their week."
  }
  if (isHard) {
    if (rpe <= 4) return 'Left some in the tank. Fine, sometimes.'
    if (rpe <= 7) return 'Solid work. Controlled effort where it matters.'
    if (rpe <= 9) return 'Hard session in the bank. Earn the rest.'
    return 'Maximum. Now actually rest.'
  }
  if (isLong) {
    if (rpe <= 3) return 'Easy long run. That\'s the whole point.'
    if (rpe <= 6) return 'Good distance. Keep the long one honest.'
    if (rpe <= 8) return 'Ran a bit hot. The legs need a proper day now.'
    return 'Too hard for a long one. Sleep properly and back off tomorrow.'
  }
  if (isRace) {
    if (rpe <= 5) return 'Maybe left a bit there.'
    if (rpe <= 7) return 'Solid race effort. Well managed.'
    if (rpe <= 9) return 'Good race. That\'s how you do it.'
    return 'Left nothing behind. That\'s how you race.'
  }
  // strength / cross / other
  if (rpe <= 3) return 'Easy session done. In the bank.'
  if (rpe <= 5) return 'Comfortable effort. Right zone.'
  if (rpe <= 7) return 'Solid work. Let the legs recover.'
  if (rpe <= 9) return 'Hard session logged. Earn that rest.'
  return 'Maximum effort. Now actually rest.'
}
