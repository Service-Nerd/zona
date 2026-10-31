// COACH-KIT-CAUGHT-01 — THE SINGLE OWNER of "what Kit caught": the few specific things the app already computed about a
// runner's last two weeks, each with its number. Shown on free Coach and on the Upgrade screen (SLT 2026-10-31: the
// reason to pay is the coach the runner already had, not a feature list).
//
// Rule-based, never the model, so no AIMark. Every receipt REUSES the owner that already says the same thing elsewhere,
// so the receipt and the screen it echoes can never disagree:
//   - a run mostly in Zone 3                → `runEffortKind` (§132), the same kind the every-run picture dots
//   - a week off the runner's normal        → `loadRatioContext`, fires exactly when the load card is amber
//   - a run that stayed easy (good news)    → §133, the longest `easy` run with ≥ COACH_RECEIPT_EASY_MIN_PCT in Z1–2
//   - "Your easiest week in N weeks"        → `easiestWeekSpan` (§131)
// Order is fixed (misses, then the week, then good news) and capped at COACH_RECEIPT_MAX. Zero receipts is a real state:
// the list is never padded (SLT: one true sentence beats an empty card; a padded one is worse than none).

import { formatDate, formatDistance, type DistanceUnits } from '@/lib/format'
import { runDistance } from '@/lib/health/runDistance'
import { loadRatioContext } from '@/lib/ui/loadRatioContext'
import { easiestWeekSentence } from './moments'
import { runEffortKind } from './runEffort'
import { dedupeRuns, isRun, type ActivityLogRow } from './weeklyActualLoad'
import { hasZoneSplit, type ZoneActivityRow } from './weeklyZoneAggregate'
import { COACH_RECEIPT_EASY_MIN_PCT, COACH_RECEIPT_MAX, COACH_RECEIPT_WINDOW_DAYS } from './constants'

/** `held` draws moss, `drifted` amber (P-01's pair). */
export interface KitReceipt { tone: 'held' | 'drifted'; lead: string; text: string }

export interface KitReceiptInputs {
  rows: readonly ZoneActivityRow[]
  now: Date
  units: DistanceUnits
  /** Top of the runner's Z2, when known; named in a Zone-3 receipt. */
  ceiling: number | null
  /** `computeLoadPicture(...)`; null while loading or without enough weeks. */
  load: { ratio: number | null; plannedEasy: boolean; lowWeeksRunning: number } | null
  /** `easiestWeekSpan(...)` for this week, or null. */
  easiestSpan: number | null
  /** Linked plan session type per activity (`plannedTypeByActivity`). */
  plannedTypes?: ReadonlyMap<string, string>
}

const pct = (n: number) => `${Math.round(n)}%`

export function kitReceipts(i: KitReceiptInputs): KitReceipt[] {
  const from = i.now.getTime() - COACH_RECEIPT_WINDOW_DAYS * 86_400_000
  const runs = dedupeRuns(i.rows.filter(isRun) as ActivityLogRow[])
    .map(r => r as ZoneActivityRow)
    .filter(hasZoneSplit)
    .filter(r => { const t = new Date(r.start_date).getTime(); return t >= from && t <= i.now.getTime() })
    .sort((a, b) => b.start_date.localeCompare(a.start_date))
  const planned = (r: ZoneActivityRow) =>
    i.plannedTypes?.get(`s:${r.strava_activity_id}`) ?? (r.apple_health_uuid ? i.plannedTypes?.get(`a:${r.apple_health_uuid}`) : undefined) ?? null
  const lead = (r: ZoneActivityRow) => {
    const km = runDistance(r)?.km
    const d = formatDate(r.start_date)
    return km != null ? `${d}, ${formatDistance(km, i.units, { exact: true })}:` : `${d}:`
  }
  const out: KitReceipt[] = []

  const grey = runs.find(r => runEffortKind(r, planned(r)) === 'grey')
  if (grey) {
    const z45 = Number(grey.hr_pct_z4_5 ?? 0)
    out.push({
      tone: 'drifted',
      lead: lead(grey),
      text: `${pct(Number(grey.hr_pct_z3 ?? 0))} of it in Zone 3${z45 >= 10 ? ` and ${pct(z45)} in Zones 4–5` : ''}.`
        + (i.ceiling ? ` Your easy ceiling is ${i.ceiling}.` : ''),
    })
  }

  if (i.load?.ratio != null) {
    const v = loadRatioContext(i.load.ratio, { plannedEasy: i.load.plannedEasy, lowWeeksRunning: i.load.lowWeeksRunning })
    if (v.color === 'var(--warn)') out.push({ tone: 'drifted', lead: 'This week:', text: `${i.load.ratio.toFixed(2)}× your recent normal.` })
  }

  const easy = runs
    .filter(r => runEffortKind(r, planned(r)) === 'easy')
    .sort((a, b) => (runDistance(b)?.km ?? 0) - (runDistance(a)?.km ?? 0))[0]
  const easyPct = easy ? Number(easy.hr_pct_z1 ?? 0) + Number(easy.hr_pct_z2 ?? 0) : 0
  if (easy && easyPct >= COACH_RECEIPT_EASY_MIN_PCT) {
    out.push({ tone: 'held', lead: lead(easy), text: `${pct(Math.min(100, easyPct))} of it in Zones 1–2.` })
  }

  if (i.easiestSpan != null) out.push({ tone: 'held', lead: '', text: easiestWeekSentence(i.easiestSpan) })

  return out.slice(0, COACH_RECEIPT_MAX)
}
