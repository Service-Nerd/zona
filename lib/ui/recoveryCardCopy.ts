// READINESS-SURFACE-01 item 2 + STRENGTH-RECOVERY-01 — the words on Today's recovery card, one owner.
// Design Board 2026-10-18 (decision note `recovery-card-strength-2026-10-18.md`); copy approved by the
// founder the same day as drafts A–D. Components never compose these.
//
//   A  the reading, against the runner's own normal   ("HRV 38. Your normal is 52.")
//   B  what happens to the run                         ("Today's tempo becomes an easy run.")
//   C  what happens to the lift                        ("Strength drops to upper body and core.")
//   D  the override on a day where the run is not changing ("Lift as planned")
//
// No claim about what an ease prevents, no em dash, one sentence each.

import { formatDistance, formatDuration } from '@/lib/format'
import { easeForRecovery, CATALOGUE_BY_ID, PATTERN_REGION, type StrengthSession } from '@/packages/strength'

export interface ReadingDetail {
  hrvToday?: number; hrvBaseline?: number
  rhrToday?: number; rhrBaseline?: number
  sleepHours?: number; sleepBaseline?: number
}
export interface ReadingFlags { isLowHRV?: boolean; isElevatedRHR?: boolean; isShortSleep?: boolean; isPoorSleepQuality?: boolean }

const hm = (hours: number) => formatDuration(Math.round(hours * 60)) ?? ''

/** A — the one reading that matters most today, against their normal. HRV, then sleep, then resting HR. */
export function readingLine(d: ReadingDetail | null | undefined, f: ReadingFlags): string | null {
  if (!d) return null
  if (f.isLowHRV && d.hrvToday != null && d.hrvBaseline != null) return `HRV ${Math.round(d.hrvToday)}. Your normal is ${Math.round(d.hrvBaseline)}.`
  if (f.isShortSleep && d.sleepHours != null) {
    return d.sleepBaseline != null ? `${hm(d.sleepHours)} sleep. You usually get ${hm(d.sleepBaseline)}.` : `${hm(d.sleepHours)} sleep.`
  }
  if (f.isElevatedRHR && d.rhrToday != null && d.rhrBaseline != null) return `Resting HR ${Math.round(d.rhrToday)}. Your normal is ${Math.round(d.rhrBaseline)}.`
  if (f.isPoorSleepQuality) return 'Deep sleep was short last night.'
  return null
}

type RunSession = { type?: string; distance_km?: number | null; role?: string | null; label?: string }
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

/** B — the eased run, read from the change itself (sessions before / after on the eased day). */
export function runLine(
  adjustment: { sessions_before?: RunSession[]; sessions_after?: RunSession[]; trigger_detail?: { sessionDay?: string }; summary?: string } | null | undefined,
  units: 'km' | 'mi',
): string | null {
  if (!adjustment) return null
  const i = DAYS.indexOf(adjustment.trigger_detail?.sessionDay ?? '')
  const before = i >= 0 ? adjustment.sessions_before?.[i] : undefined
  const after = i >= 0 ? adjustment.sessions_after?.[i] : undefined
  if (before && after) {
    if (before.type !== after.type && after.type === 'easy') {
      const word = before.type === 'tempo' ? 'tempo' : before.type === 'intervals' ? 'interval session' : 'quality session'
      return `Today's ${word} becomes an easy run.`
    }
    if (after.distance_km != null && before.distance_km != null && after.distance_km < before.distance_km) {
      return `Long run trimmed to ${formatDistance(after.distance_km, units)}.`
    }
  }
  return adjustment.summary ?? null
}

/** C — what the lift becomes, read from the eased session itself so it can never describe a change that does not happen. */
export function strengthLine(session: StrengthSession | null | undefined): string | null {
  if (!session) return null
  if (!session.heavy_legs) return 'Strength stays, with fewer sets.'
  const eased = easeForRecovery(session)
  const regions = new Set(eased.blocks.filter(b => b.role !== 'warmup' && b.role !== 'mobility')
    .flatMap(b => b.items.map(it => { const ex = CATALOGUE_BY_ID.get(it.exercise_id); return ex ? (ex.pattern === 'calf' ? 'calf' : PATTERN_REGION[ex.pattern]) : null })))
  if (regions.has('upper')) return 'Strength drops to upper body and core.'
  if (regions.has('calf')) return 'Strength drops to core and calf work.'
  return 'Strength drops to core work.'
}

/** D — the override names what the runner keeps. On a day the run changes, it is the run. */
export function overrideLabel(runChanges: boolean): string {
  return runChanges ? 'Run it anyway →' : 'Lift as planned'
}

export const EASE_LABEL = 'Ease the session'
