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
import SessionPopupInner from '@/components/dashboard/SessionPopupInner'
import TodayScreen from '@/components/dashboard/TodayScreen'
import ZoneBar from '@/components/shared/ZoneBar'
import type { DerivedSet } from '@/lib/plan/resolveMainSet'
import type { Session } from '@/types/plan'
import type { Zone } from '@/components/shared/ZoneBar'
import { catalogueRowFor } from '@/lib/plan/catalogueLink'
import { isLongRun } from '@/lib/plan/sessionRole'
import { sessionHRBand, zonesFromZoneString } from '@/lib/coaching/zoneRules'
import { zoneNumberForType, zoneShortName } from '@/components/shared/ZoneBar'

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

// DASHBOARD-SCREEN-EXTRACT-03 — read by `PushNotificationsRow` (which left with
// MeScreen) AND by the app-open path that stays in DashboardClient, so it is shared
// by the same rule as the rest of this file.
// LocalStorage flag tracking the user's explicit "off" intent. iOS won't
// let us revoke push permission programmatically, but we control our DB
// subscription row — toggling off deletes the row and stamps this flag
// so the row isn't auto-recreated by the mount-time check.
export const PUSH_OFF_KEY = 'zonna_push_disabled'

// DASHBOARD-SCREEN-EXTRACT-04 — shared by `TodayScreen`, `SessionPopupInner` and code
// that stays. Same cycle rule: imports nothing from `DashboardClient`. Bodies UNCHANGED.

export const DOW_ORDER = ['mon','tue','wed','thu','fri','sat','sun']

export const DOW_LETTER: Record<string, string> = { mon:'M', tue:'T', wed:'W', thu:'T', fri:'F', sat:'S', sun:'S' }

export const DOW_FULL:   Record<string, string> = { mon:'Mon', tue:'Tue', wed:'Wed', thu:'Thu', fri:'Fri', sat:'Sat', sun:'Sun' }

export const DAY_OFFSETS: Record<string, number> = { mon:0, tue:1, wed:2, thu:3, fri:4, sat:5, sun:6 }

/** Single source of truth for "what calendar date does this session fall on?".
 *  Used by TodayScreen.sessions[], PlanScreen, and the missed-session boot scan
 *  so every entry point computes rawDate identically. Picker date-window logic
 *  depends on consistent rawDate construction across paths. */
export function computeSessionDate(weekStartDate: Date, dayKey: string): Date {
  const d = new Date(weekStartDate)
  d.setDate(d.getDate() + (DAY_OFFSETS[dayKey] ?? 0))
  return d
}

/** §84 — the zones to DISPLAY for a session. Reads the prescription
 *  (`session.zone`: "Zone 3", "Zone 3–4", "Zone 4–5") rather than the coarse
 *  `session.type` slot, which collapses every quality session (all typed
 *  `quality`) to a flat Z3. Falls back to the type-derived single zone for
 *  older plans that predate a stored `session.zone` string. Single owner of
 *  the header/eyebrow/ZoneBar zone so those surfaces can never disagree. */
export function displayZonesForSession(
  session: { zone?: string; type?: string },
): { zones: Zone[]; lo: Zone; hi: Zone; rangeLabel: string; peakName: string } | null {
  const prescribed = zonesFromZoneString(session.zone) as Zone[]
  const fallback = zoneNumberForType(session.type)
  const zones = (prescribed.length ? prescribed : (fallback ? [fallback] : [])) as Zone[]
  if (zones.length === 0) return null
  const lo = zones[0], hi = zones[zones.length - 1]
  return {
    zones, lo, hi,
    rangeLabel: lo === hi ? `Zone ${lo}` : `Zone ${lo}–${hi}`,
    peakName: zoneShortName(hi),
  }
}

/** Returns the HR string to display for a session, using zoneRules so every
 *  session type gets the same shape ("Zone X · A–B bpm" or "< X bpm" for Z2).
 *  Live Karvonen takes precedence over baked plan strings — stale hr_target
 *  on a regenerated user is the bug, not a feature. */
export function getSessionHRDisplay(
  sessionType: string,
  hr_target: string | undefined,
  restingHR: number | null,
  maxHR: number | null,
  zone2Ceiling: number | undefined,
): string | null {
  const band = sessionHRBand(sessionType, restingHR, maxHR)
  if (band) {
    return band.zone.zone === 'Z2' ? `< ${band.hi}` : `${band.lo}–${band.hi}`
  }
  // No HR data — fall back to the baked plan string. Strip "bpm" so callers
  // can append it themselves (every render site adds its own bpm suffix).
  if (hr_target) return hr_target.replace(/\s*bpm\s*$/i, '')
  if ((sessionType === 'easy' || sessionType === 'long' || sessionType === 'recovery' || sessionType === 'run') && zone2Ceiling) {
    return `< ${zone2Ceiling}`
  }
  return null
}

/**
 * Data passed to PostRunScreen — the destination screen for a Strava-linked
 * session completion. Replaces the old Reflect sheet for the linked path.
 *
 * `pendingActivityId` is set when the user just selected an activity in the
 * picker and the link hasn't been committed yet (PostRunScreen fires
 * /api/strava/link-activity on mount). On deep-link or retroactive entry,
 * the link already exists so this is null.
 */
export type PostRunData = {
  session: any
  weekN: number
  pendingActivityId: number | null
  /** Set instead of pendingActivityId when the just-linked activity came from
   *  HealthKit (its strava_activities row already exists; link by UUID). */
  pendingAppleHealthUuid?: string | null
  /** Display info for the linked-activity confirmation row */
  linkedActivity: { name: string; km: number | null } | null
}

export interface SessionEntry {
  key: string
  displayKey: string
  day: string
  title: string
  detail: string
  type: string
  date: string
  rawDate: Date
  today: boolean
  distance?: number
  duration?: string
  // Canonical fields preserved so SessionPopupInner / composer can read them
  // when the session is opened from TodayScreen. Without these, the structured
  // session block doesn't render (composer needs distance_km/duration_mins/label).
  // catalogue_id/derived_set are what catalogueRowFor()/mainSetDescription() need to
  // resolve real main-set instructions — without them the fallback is a generic
  // "Quality main set." placeholder (D-08 bug, fixed 2026-09-03).
  label?: string
  /** PLAN-LONGRUN-COLOUR-01 — the long-run signal `isLongRun` reads. Carried so
   *  the accent colour never has to guess from the display label, which the AI
   *  enricher rewrites (D-17). */
  role?: Session['role']
  catalogue_id?: string
  derived_set?: DerivedSet
  distance_km?: number
  duration_mins?: number
  primary_metric?: 'distance' | 'duration'
  zone?: string
  hr_target?: string
  pace_target?: string
  rpe_target?: number
  coach_notes?: [string, string?, string?]
}
