// Distance formatting — single source of truth.
//
// Plan distances are stored in km. This helper converts to the user's preferred
// unit and rounds to a whole number ("6 km", "4 mi"). Race distances pass
// `exact: true` to preserve their iconic decimals (21.1 km, 13.1 mi, etc.).
//
// Rounding the displayed value means "sum of displayed sessions" and
// "displayed week total" must both be computed from rounded values, so they
// agree. See sumRoundedDistance below.

const KM_PER_MI = 1.609344

export type DistanceUnits = 'km' | 'mi'

export interface FormatDistanceOpts {
  /** Race-style: keep 1 dp instead of rounding to whole. */
  exact?: boolean
  /** Omit the unit suffix, return just the number string. */
  noSuffix?: boolean
}

export function formatDistance(
  km: number | null | undefined,
  units: DistanceUnits = 'km',
  opts: FormatDistanceOpts = {},
): string | null {
  if (km == null || !Number.isFinite(km)) return null
  const value = units === 'mi' ? km / KM_PER_MI : km
  const rounded = opts.exact
    ? Math.round(value * 10) / 10
    : Math.round(value)
  if (opts.noSuffix) return String(rounded)
  return `${rounded}${units}`
}

/** Sum a list of session km distances, rounding each one before adding so the
 *  resulting total matches what the user sees in the per-session displays. */
export function sumRoundedDistance(
  distancesKm: Array<number | null | undefined>,
  units: DistanceUnits = 'km',
): number {
  return distancesKm.reduce<number>((sum, km) => {
    if (km == null || !Number.isFinite(km)) return sum
    const value = units === 'mi' ? km / KM_PER_MI : km
    return sum + Math.round(value)
  }, 0)
}
