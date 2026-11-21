// FREE — infrastructure. ADR027-B2-PROFILE, ARCH-ENG-019: "today" for a runner is resolved in the
// runner's timezone, from an instant the CALLER supplies. Nothing here reads a clock.
//
// An unset, invalid or `UTC` timezone is UNKNOWN (22 of 56 runners store `UTC`, almost certainly a
// default; data dictionary § 2.6). Then the date falls back to the server's local date, which is
// exactly what the engine used before L1 (`formatDate(new Date())`), and the profile says so.

import { formatDate } from '@/lib/plan/length'
import type { ResolvedAsOf } from '@/lib/engine/contracts/facts'
import type { IsoDate } from '@/lib/engine/contracts/profile'

/** Zones that are a default rather than a choice. Etc/UTC and GMT are the same default spelled
 *  differently; a runner in London is `Europe/London`. */
const DEFAULT_ZONES = new Set(['utc', 'etc/utc', 'gmt', 'etc/gmt', 'z', 'zulu', 'universal', 'etc/universal'])

function isoInZone(instant: Date, timeZone: string): IsoDate {
  // en-CA formats as YYYY-MM-DD. Throws RangeError on an unknown zone, which the caller catches.
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(instant)
}

export function resolveAsOf(instant: Date, timezone: string | null | undefined): ResolvedAsOf {
  const tz = typeof timezone === 'string' ? timezone.trim() : ''
  if (tz && !DEFAULT_ZONES.has(tz.toLowerCase())) {
    try {
      return { as_of: isoInZone(instant, tz), timezone: tz, timezone_known: true }
    } catch {
      // invalid IANA name: unknown, not trusted
    }
  }
  return { as_of: formatDate(instant), timezone: null, timezone_known: false }
}

/** The local date of a stored timestamp, in the same frame `resolveAsOf` chose. */
export function localDateOf(timestamp: string, frame: Pick<ResolvedAsOf, 'timezone' | 'timezone_known'>): IsoDate | null {
  const d = new Date(timestamp)
  if (!Number.isFinite(d.getTime())) return null
  if (frame.timezone_known && frame.timezone) {
    try { return isoInZone(d, frame.timezone) } catch { /* fall through */ }
  }
  return formatDate(d)
}
