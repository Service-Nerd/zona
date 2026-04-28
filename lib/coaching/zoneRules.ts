// Zone rules — single source of truth for "what zone is this session?" and
// "did the user hit it?". Used by the symmetric session card label, the
// zone-discipline metric, the post-run feedback prompt, and the zone
// education sheet.
//
// Doctrine: Zona's coaching is polarised (CoachingPrinciples §1). Most
// running is easy (Z2). The hard stuff is genuinely hard (Z3 / Z4-5). The
// "right zone for the session" frames the app, not "always Z2".

import { GENERATION_CONFIG } from '@/lib/plan/generationConfig'

export type ZoneKey = 'Z1' | 'Z2' | 'Z3' | 'Z4-5'

export interface ZoneBand {
  /** The zone the session prescribes. */
  zone: ZoneKey
  /** Display label — e.g. "Zone 2", "Zone 4–5". */
  label: string
  /** Karvonen percentage band. */
  pct: [number, number]
}

/** Map a session.type to its prescribed zone. Falls back to Z2 — Zona is a
 *  polarised app, easy is the default for any unknown session type. */
export function zoneForSessionType(sessionType: string | undefined): ZoneBand | null {
  switch (sessionType) {
    case 'easy':
    case 'long':
    case 'recovery':
    case 'run':
      return { zone: 'Z2', label: 'Zone 2', pct: [60, 70] }
    case 'tempo':
    case 'quality':
      return { zone: 'Z3', label: 'Zone 3', pct: [70, 80] }
    case 'intervals':
    case 'hard':
      return { zone: 'Z4-5', label: 'Zone 4–5', pct: [80, 100] }
    case 'race':
      // Races vary; coaching is "execute your plan", so band is broad.
      return { zone: 'Z3', label: 'Race effort', pct: [70, 90] }
    case 'rest':
    case 'strength':
    case 'cross':
      return null
    default:
      return null
  }
}

/** Compute Karvonen HR band for a percentage range. */
export function karvonenBand(
  restingHR: number | null | undefined,
  maxHR: number | null | undefined,
  loPct: number,
  hiPct: number,
): { lo: number; hi: number } | null {
  if (!restingHR || !maxHR) return null
  const hrr = maxHR - restingHR
  return {
    lo: Math.round(restingHR + (loPct / 100) * hrr),
    hi: Math.round(restingHR + (hiPct / 100) * hrr),
  }
}

/** HR band for a session given the user's resting/max HR. Null if HR data
 *  is missing or the session has no HR target (rest, strength). */
export function sessionHRBand(
  sessionType: string | undefined,
  restingHR: number | null | undefined,
  maxHR: number | null | undefined,
): { lo: number; hi: number; zone: ZoneBand } | null {
  const zone = zoneForSessionType(sessionType)
  if (!zone) return null
  const band = karvonenBand(restingHR, maxHR, zone.pct[0], zone.pct[1])
  if (!band) return null
  return { ...band, zone }
}

/** Did the completed session land in its prescribed zone?
 *
 *  For easy/long/recovery (Z2): avg_hr must be ≤ Z2 ceiling. Drift above
 *  ceiling is the classic non-elite failure mode.
 *
 *  For quality/intervals (Z3+): avg_hr must be within the band. Going too
 *  easy on a quality session is also a miss — that's "moderate run wearing
 *  easy-run clothes" territory.
 *
 *  Returns null when we can't judge (no HR data, no zone for type). */
export function didSessionHitZone(
  sessionType: string | undefined,
  avgHr: number | null | undefined,
  restingHR: number | null | undefined,
  maxHR: number | null | undefined,
): boolean | null {
  if (avgHr == null) return null
  const band = sessionHRBand(sessionType, restingHR, maxHR)
  if (!band) return null
  if (band.zone.zone === 'Z2') {
    // Z2 is a ceiling, not a band — being below the band is fine.
    return avgHr <= band.hi
  }
  // Quality / intervals / race — must be inside the band (with a small
  // tolerance to avoid penalising rounding on the edges).
  const tolerance = 2
  return avgHr >= band.lo - tolerance && avgHr <= band.hi + tolerance
}

// Re-export the canonical zone table so other modules don't reach into
// generationConfig for it.
export const ZONE_TABLE = GENERATION_CONFIG.ZONES
