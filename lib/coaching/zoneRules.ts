// Zone rules — single source of truth for "what zone is this session?" and
// "did the user hit it?". Used by the symmetric session card label, the
// zone-discipline metric, the post-run feedback prompt, and the zone
// education sheet.
//
// Doctrine: Zonna's coaching is polarised (CoachingPrinciples §1). Most
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

/** Map a session.type to its prescribed zone. Falls back to Z2 — this is a
 *  polarised training app, so easy is the default for any unknown session type. */
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

/**
 * Parse a `session.zone` display string into its zone numbers.
 *
 * "Zone 3" → [3]; "Zone 3–4" → [3,4]; "Zone 4–5" → [4,5]; "Zone 2–3" → [2,3].
 * Handles both the en-dash (–) the engine writes and a plain hyphen. Returns
 * [] when unparseable, so callers can fall back to the type-derived zone.
 *
 * §84 — `session.zone` is the authoritative, prescription-derived zone (single
 * or range). The session-detail header reads THIS, not `zoneNumberForType`,
 * which collapses every quality session (all typed `quality`) to a flat Z3.
 */
export function zonesFromZoneString(zoneStr: string | undefined | null): number[] {
  if (!zoneStr) return []
  const nums = (zoneStr.match(/[1-5]/g) ?? []).map(Number)
  if (nums.length === 0) return []
  const lo = Math.min(...nums), hi = Math.max(...nums)
  const out: number[] = []
  for (let z = lo; z <= hi; z++) out.push(z)
  return out
}

/**
 * HR band spanning a `session.zone` string, from the canonical ZONE_TABLE and
 * the user's resting/max HR. "Zone 4–5" → Z4 low bound → Z5 high bound.
 * Karvonen when RHR is known, %MaxHR otherwise. Null when HR data or the zone
 * string is missing — callers then fall back to the baked `hr_target`.
 *
 * This is what lets the header's live-recomputed bpm honour the *prescribed*
 * zone rather than the coarse session type (§84).
 */
/**
 * The ZoneKey to EXPLAIN for a session, derived from its prescribed
 * `session.zone` string — never from the coarse `session.type` slot.
 *
 * §84 settled that every zone surface reads `session.zone`, because the type
 * slot collapses every quality session to a flat Z3. The header and ZoneBar were
 * moved onto it; the zone EDUCATION SHEET was not, and kept calling
 * `zoneForSessionType`. Measured 2026-09-12 across the 621-plan cohort: the two
 * disagreed on **837 sessions (2.3%)** — 549 where the header read "Zone 4–5"
 * and the sheet taught Zone 3 (and showed the LOWER Zone 3 HR band, on VO2max
 * work), plus 288 segmented long runs reading Zone 2–3 against a Zone 2 sheet.
 * That is §84's own named failure: disguising genuinely hard work as moderate.
 *
 * Where a session spans zones, the sheet explains the PEAK — the hardest part is
 * the part that needs explaining, and it matches the `peakName` the header
 * already shows. Returns null when the string names no zone, so the caller can
 * fall back rather than assert something.
 */
export function zoneKeyForZoneString(zoneStr: string | undefined | null): ZoneKey | null {
  const zones = zonesFromZoneString(zoneStr)
  if (zones.length === 0) return null
  const hi = Math.max(...zones)
  if (hi >= 4) return 'Z4-5'
  if (hi === 3) return 'Z3'
  if (hi === 2) return 'Z2'
  return 'Z1'
}

export function hrBandForZoneString(
  zoneStr: string | undefined | null,
  restingHR: number | null | undefined,
  maxHR: number | null | undefined,
): { lo: number; hi: number } | null {
  const zones = zonesFromZoneString(zoneStr)
  if (zones.length === 0 || !maxHR) return null
  const loKey = `Z${Math.min(...zones)}` as keyof typeof ZONE_TABLE
  const hiKey = `Z${Math.max(...zones)}` as keyof typeof ZONE_TABLE
  if (restingHR) {
    const hrr = maxHR - restingHR
    return {
      lo: Math.round(restingHR + (ZONE_TABLE[loKey].karvonen_pct[0] / 100) * hrr),
      hi: Math.round(restingHR + (ZONE_TABLE[hiKey].karvonen_pct[1] / 100) * hrr),
    }
  }
  return {
    lo: Math.round((ZONE_TABLE[loKey].maxhr_pct[0] / 100) * maxHR),
    hi: Math.round((ZONE_TABLE[hiKey].maxhr_pct[1] / 100) * maxHR),
  }
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
