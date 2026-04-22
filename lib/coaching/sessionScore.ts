import { SCORE_WEIGHTS, VERDICT_BANDS } from './constants'
import type { Session } from '@/types/plan'

export type Verdict = 'nailed' | 'close' | 'off_target' | 'concerning'

export interface SessionScoreInput {
  session: Session
  actualDistKm: number
  actualAvgHr: number | null
  actualAvgSpeedMs: number         // m/s from Strava average_speed
  hrInZonePct: number | null       // from HR stream
  efValue: number | null
  efBaseline: number | null
}

export interface SessionScoreResult {
  hrDisciplineScore: number
  distanceScore:     number
  paceScore:         number
  efScore:           number
  totalScore:        number
  verdict:           Verdict
}

/** All inputs are pre-validated. Returns deterministic 0–100 scores. */
export function scoreSession(input: SessionScoreInput): SessionScoreResult {
  const hrDisciplineScore = computeHRScore(input)
  const distanceScore     = computeDistanceScore(input)
  const paceScore         = computePaceScore(input)
  const efScore           = computeEFScore(input)

  const totalScore = Math.round(
    hrDisciplineScore * SCORE_WEIGHTS.hr_discipline +
    distanceScore     * SCORE_WEIGHTS.distance +
    paceScore         * SCORE_WEIGHTS.pace +
    efScore           * SCORE_WEIGHTS.ef
  )

  return {
    hrDisciplineScore,
    distanceScore,
    paceScore,
    efScore,
    totalScore,
    verdict: deriveVerdict(totalScore),
  }
}

function computeHRScore({ session, actualAvgHr, hrInZonePct }: SessionScoreInput): number {
  // Prefer stream-based zone % if available
  if (hrInZonePct !== null) {
    return Math.round(Math.min(100, hrInZonePct))
  }
  // Fallback: single avg HR point vs ceiling parsed from hr_target string e.g. "< 145 bpm"
  if (actualAvgHr !== null && session.hr_target) {
    const ceiling = parseHRCeiling(session.hr_target)
    if (ceiling !== null) {
      const breach = actualAvgHr - ceiling
      if (breach <= 0)  return 100
      if (breach <= 5)  return 80
      if (breach <= 10) return 60
      if (breach <= 15) return 40
      return 20
    }
  }
  return 75 // neutral if no HR data
}

/** Parses ceiling from strings like "< 145 bpm", "135–145 bpm", "155–165 bpm" */
function parseHRCeiling(hrTarget: string): number | null {
  // Range: "155–165 bpm" → upper bound 165
  const rangeMatch = hrTarget.match(/(\d+)[–\-](\d+)/)
  if (rangeMatch) return parseInt(rangeMatch[2])
  // Ceiling: "< 145 bpm"
  const ceilMatch = hrTarget.match(/<\s*(\d+)/)
  if (ceilMatch) return parseInt(ceilMatch[1])
  return null
}

function computeDistanceScore({ session, actualDistKm }: SessionScoreInput): number {
  const planned = session.distance_km
  if (!planned || planned === 0) return 75 // duration-primary session — neutral
  const ratio = actualDistKm / planned
  if (ratio >= 0.95 && ratio <= 1.10) return 100
  if (ratio >= 0.85 && ratio <  0.95) return 80
  if (ratio >  1.10 && ratio <= 1.20) return 80
  if (ratio >= 0.70 && ratio <  0.85) return 50
  if (ratio >  1.20)                  return 50
  return 20
}

function computePaceScore({ session, actualAvgSpeedMs }: SessionScoreInput): number {
  if (!session.pace_target) return 75
  const target = parsePaceTarget(session.pace_target)
  if (!target) return 75
  const actualSecPerKm = 1000 / actualAvgSpeedMs
  const { loSec, hiSec } = target

  if (actualSecPerKm >= loSec && actualSecPerKm <= hiSec) return 100
  // Too fast (lower sec/km = faster)
  if (actualSecPerKm < loSec) {
    const over = (loSec - actualSecPerKm) / loSec
    if (over <= 0.05) return 80
    if (over <= 0.10) return 60
    return 30
  }
  // Too slow
  const under = (actualSecPerKm - hiSec) / hiSec
  if (under <= 0.05) return 80
  if (under <= 0.15) return 60
  return 40
}

function computeEFScore({ efValue, efBaseline }: SessionScoreInput): number {
  if (efValue === null || efBaseline === null || efBaseline === 0) return 75
  const changePct = ((efValue - efBaseline) / efBaseline) * 100
  if (changePct >= 3)   return 100
  if (changePct >= 0)   return 90
  if (changePct >= -3)  return 80
  if (changePct >= -8)  return 60
  if (changePct >= -15) return 40
  return 20
}

function deriveVerdict(score: number): Verdict {
  if (score >= VERDICT_BANDS.nailed)     return 'nailed'
  if (score >= VERDICT_BANDS.close)      return 'close'
  if (score >= VERDICT_BANDS.off_target) return 'off_target'
  return 'concerning'
}

/** Parses "5:30–6:00/km" or "5:30/km" into seconds/km bounds */
function parsePaceTarget(pace: string): { loSec: number; hiSec: number } | null {
  const rangeMatch = pace.match(/(\d+):(\d+)[–\-](\d+):(\d+)/)
  if (rangeMatch) {
    const lo = parseInt(rangeMatch[1]) * 60 + parseInt(rangeMatch[2])
    const hi = parseInt(rangeMatch[3]) * 60 + parseInt(rangeMatch[4])
    return { loSec: lo, hiSec: hi }
  }
  const singleMatch = pace.match(/(\d+):(\d+)/)
  if (singleMatch) {
    const sec = parseInt(singleMatch[1]) * 60 + parseInt(singleMatch[2])
    return { loSec: sec * 0.95, hiSec: sec * 1.05 }
  }
  return null
}
