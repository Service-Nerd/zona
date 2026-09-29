// DASHBOARD-SCREEN-EXTRACT-02 — the helpers that more than one extracted screen needs.
//
// 🔴 THIS MODULE EXISTS TO AVOID A CYCLE, and that is the whole design constraint.
// `calculateZones` is used by BOTH `OrientationScreen` and `HRZonesSection`; `rpeColour`,
// `fmtDurationMins` and `getReflectResponse` by `ManualRunModal` AND by code that stays in
// `DashboardClient`. Leaving them behind and importing them back would make every extracted
// screen depend on the 14k-line file it just left.
//
// ⚠️ So this file imports NOTHING from `DashboardClient`, and must not start. It is pure:
// no JSX, no hooks, no component state.
//
// Bodies are UNCHANGED from the originals.

import { formatDuration } from '@/lib/format'

export const ZONE_DEFS = [
  { zone: 1, name: 'Recovery',  pctMin: 50, pctMax: 60, colour: 'var(--session-recovery)', desc: 'Active recovery · warm-up · cool-down' },
  { zone: 2, name: 'Aerobic',   pctMin: 60, pctMax: 70, colour: 'var(--session-easy)',     desc: 'Aerobic base · conversational · fat burning' },
  // 🔴 WAS 'Tempo · Comfortably hard' UNTIL 2026-09-28 (ZONES-SURFACE-01, Design
  // Board). `CoachingPrinciples §1` is titled "Polarised training — PROTECTION FROM
  // GREY ZONE", and this row was labelling that exact band with the competitor's
  // word and describing it neutrally. A zone the constitution exists to keep runners
  // OUT of cannot be presented as one they are working towards.
  //
  // ⚠️ 'Tempo' was also doubly wrong here: tempo SESSIONS are prescribed at Z4
  // threshold, so the app had a zone named after a session type that does not run in
  // it. Renaming the ZONE does not touch session names — design owns the encoding,
  // coaching owns the meaning, and the meaning (70–80% HRR) is unchanged.
  { zone: 3, name: 'Grey zone', pctMin: 70, pctMax: 80, colour: 'var(--session-quality)',  desc: 'Neither easy nor hard · the one that costs you' },
  { zone: 4, name: 'Threshold', pctMin: 80, pctMax: 90, colour: 'var(--session-race)',     desc: 'Hard · sustained race effort' },
  { zone: 5, name: 'VO₂ Max',  pctMin: 90, pctMax: 100, colour: 'var(--coral)',            desc: 'Maximum effort · short intervals only' },
]

export function calculateZones(restingHR: number, maxHR: number) {
  const hrr = maxHR - restingHR
  return ZONE_DEFS.map(d => ({
    ...d,
    minHR: Math.round(restingHR + (d.pctMin / 100) * hrr),
    maxHR: Math.round(restingHR + (d.pctMax / 100) * hrr),
  }))
}

/** Canonical duration display (45 → "45 min", 90 → "1h 30", 120 → "2h").
 *  Delegates to lib/format so the ≥60→hours rule lives in exactly one place
 *  (ADR-015 / INV-FMT-001). Kept as a named local so existing call sites are
 *  unchanged. */
export function fmtDurationMins(mins: number): string {
  return formatDuration(mins) ?? ''
}

export function getReflectResponse(sessionType: string, rpe: number | null, fatigueTag: string | null): string {
  if (rpe === null && fatigueTag) {
    if (fatigueTag === 'Fresh') return "Legs felt good. That's what easy days are for."
    if (fatigueTag === 'Fine') return "Solid. Nothing to worry about."
    if (fatigueTag === 'Heavy') return "Noted. The load is building."
    if (fatigueTag === 'Wrecked') return "Proper recovery tonight. Not optional."
    return ''
  }
  if (rpe === null) return ''
  const isEasy = ['easy', 'recovery', 'run'].includes(sessionType)
  const isHard = ['quality', 'intervals', 'tempo', 'hard'].includes(sessionType)
  const isLong = sessionType === 'long'
  const isRace = sessionType === 'race'
  if (isEasy) {
    if (rpe <= 3) return "That's exactly it. Easy should feel easy."
    if (rpe <= 5) return "Comfortable. You're in the right zone."
    if (rpe <= 7) return "A touch warm for an easy day. Worth noting."
    return "That ran too hot. Easy days are where most people quietly wreck their week."
  }
  if (isHard) {
    if (rpe <= 4) return "Left some in the tank. Fine, sometimes."
    if (rpe <= 7) return "Solid work. Controlled effort where it matters."
    if (rpe <= 9) return "Hard session in the bank. Earn the rest."
    return "Maximum. Now actually rest."
  }
  if (isLong) {
    if (rpe <= 3) return "Easy long run. That's the whole point."
    if (rpe <= 6) return "Good distance. Keep the long one honest."
    if (rpe <= 8) return "Ran a bit hot. The legs need a proper day now."
    return "Too hard for a long one. Sleep properly and back off tomorrow."
  }
  if (isRace) {
    if (rpe <= 5) return "Maybe left a bit there."
    if (rpe <= 7) return "Solid race effort. Well managed."
    if (rpe <= 9) return "Good race. That's how you do it."
    return "Left nothing behind. That's how you race."
  }
  if (rpe <= 3) return "Easy session done. That's in the bank."
  if (rpe <= 5) return "Comfortable effort. Right zone."
  if (rpe <= 7) return "Solid work. Let the legs recover."
  if (rpe <= 9) return "Hard session logged. Earn that rest."
  return "Maximum effort. Now actually rest."
}

export function rpeColour(n: number): string {
  if (n <= 3) return 'var(--session-recovery)'
  if (n <= 6) return 'var(--accent)'
  if (n <= 8) return 'var(--amber)'
  return 'var(--coral)'
}
