import {
  LOAD_RATIO,
  SHADOW_LOAD_THRESHOLD_PCT,
  ZONE_DISCIPLINE_BANDS,
} from './constants'

export interface WeekLoad {
  weekN:           number
  plannedKm:       number
  actualKm:        number
  sessionScores:   { sessionType: string; hrInZonePct: number | null }[]
}

/** Acute:chronic load ratio — this week vs 4-week rolling average. */
export function acuteChronicRatio(
  thisWeekKm: number,
  priorWeeks: number[],   // up to 4 weeks of actual km, most-recent first
): number {
  const window = priorWeeks.slice(0, 4)
  if (!window.length) return 1
  const avg = window.reduce((s, v) => s + v, 0) / window.length
  if (avg === 0) return 1
  return thisWeekKm / avg
}

export type LoadRatioFlag = 'ok' | 'watch' | 'flag'

export function classifyLoadRatio(ratio: number): LoadRatioFlag {
  if (ratio >= LOAD_RATIO.flag)  return 'flag'
  if (ratio >= LOAD_RATIO.watch) return 'watch'
  return 'ok'
}

/**
 * Shadow load: actual vs planned. Returns % over/under plan.
 * Positive = over plan, negative = under plan.
 */
export function shadowLoadPct(actualKm: number, plannedKm: number): number {
  if (!plannedKm) return 0
  return ((actualKm - plannedKm) / plannedKm) * 100
}

export function isShadowLoadTriggered(
  recentWeeks: { actualKm: number; plannedKm: number }[],
  consecutiveWeeksRequired = 2,
): boolean {
  const overloaded = recentWeeks.filter(
    w => shadowLoadPct(w.actualKm, w.plannedKm) > SHADOW_LOAD_THRESHOLD_PCT
  )
  return overloaded.length >= consecutiveWeeksRequired
}

/**
 * Zone discipline score (0–100), or null when there's no signal.
 * Time-weighted average of HR-in-zone% across all sessions, weighted by
 * actual_load_km (a proxy for time-in-session). Same formula the in-app
 * Today/Coach tiles use — the share card and AI prompts must never disagree
 * with what the user sees on screen.
 *
 * Sessions with missing actualLoadKm fall back to weight 1 so a brand-new
 * Strava match without computed load still contributes.
 *
 * Returns null when no session has hrInZonePct data — "no signal" is
 * different from "score zero", and the caller must treat them differently
 * (a fresh user with no Strava history shouldn't be flagged as freelancing).
 */
export function zoneDisciplineScore(
  sessions: { hrInZonePct: number | null; actualLoadKm: number | null }[]
): number | null {
  const scored = sessions.filter(s => s.hrInZonePct !== null)
  if (!scored.length) return null

  let totalWeight = 0
  let weightedSum = 0

  for (const s of scored) {
    const weight = s.actualLoadKm ?? 1
    weightedSum += s.hrInZonePct! * weight
    totalWeight += weight
  }

  if (totalWeight === 0) return null
  return Math.round(weightedSum / totalWeight)
}

/**
 * §12 Amendment 1 / TRIGGER-AUDIT-01 — how much of the week's easy running sat
 * ABOVE the Z2 cap, km-weighted.
 *
 * Deliberately a SECOND function rather than a change to `zoneDisciplineScore`.
 * They answer different questions and both are legitimate:
 *   · `zoneDisciplineScore` — "how much of your running was in the prescribed
 *     zone?" A descriptive ledger figure. Symmetric, and correctly so.
 *   · `zoneDriftScore`      — "how much of it was ABOVE the cap?" The DRIFT
 *     claim. §12 prescribes a ceiling, so only this direction is a breach.
 *
 * Collapsing them is what produced the defect: the `zone_drift` adjustment
 * trigger keyed on the descriptive figure and therefore fired on runners who
 * were running too EASY — measured 2026-09-13, 3 of 17 runs under its threshold.
 * That trigger silently rewrites every easy/long coach note to "Easy sessions
 * trending hard", so the runner who had finally understood the product was told
 * the opposite of what they did. Same class as R30, but this one changes the
 * plan rather than a card.
 *
 * Returns null when nothing can be measured — never 0, which would read as
 * "no drift" and silence the trigger for a cohort rather than skipping it.
 */
export function zoneDriftScore(
  sessions: { aboveCeilingPct: number | null; actualLoadKm: number | null }[]
): number | null {
  const scored = sessions.filter(s => s.aboveCeilingPct !== null)
  if (!scored.length) return null

  let totalWeight = 0
  let weightedSum = 0
  for (const s of scored) {
    const weight = s.actualLoadKm ?? 1
    weightedSum += s.aboveCeilingPct! * weight
    totalWeight += weight
  }
  if (totalWeight === 0) return null
  return Math.round(weightedSum / totalWeight)
}

export type ZoneDisciplineLabel = 'disciplined' | 'decent' | 'loose' | 'freelancing'

export function classifyZoneDiscipline(score: number): ZoneDisciplineLabel {
  if (score >= ZONE_DISCIPLINE_BANDS.disciplined) return 'disciplined'
  if (score >= ZONE_DISCIPLINE_BANDS.decent)      return 'decent'
  if (score >= ZONE_DISCIPLINE_BANDS.loose)       return 'loose'
  return 'freelancing'
}
