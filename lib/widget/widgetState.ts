// WIDGET-01 — Pure builder for the JSON payload the JS app writes to
// the App Group container. The Swift widget extension decodes this
// exact shape (see ios/App/ZonnaWidgetExtension/ZonnaWidget.swift →
// struct WidgetState).
//
// Keep this minimal — every field on the wire costs WidgetKit memory
// and adds an opportunity for stale-data drift. Only what the small +
// medium widgets actually render.

import type { Plan } from '@/types/plan'
import { getCurrentWeekIndex, parseLocalDate } from '@/lib/plan'
import { resolveEffectiveSessions, type SessionOverride } from '@/lib/plan/effectiveSessions'

export interface WidgetState {
  raceName:           string | null
  raceDate:           string | null   // ISO yyyy-MM-dd
  daysToRace:         number | null
  todaySessionType:   string | null
  todaySessionLabel:  string | null
  todayDistanceKm:    number | null
  todayDurationMins:  number | null
  updatedAt:          string          // ISO timestamp this payload was built
}

const DOW_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

/**
 * Build the widget payload from the current plan + session overrides.
 * Returns an empty-but-valid state when no plan is loaded so the widget
 * has something deterministic to render ("Open the app to set up your
 * widget" path).
 */
export function buildWidgetState(input: {
  plan: Plan | null
  overrides: SessionOverride[]
  asOfDate?: Date
}): WidgetState {
  const now      = input.asOfDate ?? new Date()
  const updated  = now.toISOString()
  const plan     = input.plan

  if (!plan || !plan.weeks?.length) {
    return {
      raceName: null, raceDate: null, daysToRace: null,
      todaySessionType: null, todaySessionLabel: null,
      todayDistanceKm: null, todayDurationMins: null,
      updatedAt: updated,
    }
  }

  const raceName = (plan.meta as any)?.race_name ?? null
  const raceDate = (plan.meta as any)?.race_date ?? null

  let daysToRace: number | null = null
  if (raceDate) {
    const race = parseLocalDate(raceDate)
    const today = new Date(now); today.setHours(0, 0, 0, 0)
    race.setHours(0, 0, 0, 0)
    daysToRace = Math.max(0, Math.round((race.getTime() - today.getTime()) / 86_400_000))
  }

  // Find today's effective session (overrides applied).
  const weekIdx = getCurrentWeekIndex(plan.weeks)
  const week    = plan.weeks[weekIdx]
  let todaySessionType:   string | null = null
  let todaySessionLabel:  string | null = null
  let todayDistanceKm:    number | null = null
  let todayDurationMins:  number | null = null

  if (week) {
    const weekN = weekIdx + 1
    const weekOverrides = (input.overrides ?? []).filter(o => o.week_n === weekN)
    const effective     = resolveEffectiveSessions(week, weekOverrides)
    const dowKey        = DOW_KEYS[now.getDay()]
    const eff           = effective[dowKey] ?? null
    const session       = eff?.session ?? null

    if (session) {
      todaySessionType   = session.type ?? null
      todaySessionLabel  = session.label ?? null
      todayDistanceKm    = session.distance_km ?? null
      todayDurationMins  = session.duration_mins ?? null
    }
  }

  return {
    raceName, raceDate, daysToRace,
    todaySessionType, todaySessionLabel,
    todayDistanceKm, todayDurationMins,
    updatedAt: updated,
  }
}
