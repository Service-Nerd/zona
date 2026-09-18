// FIRSTRUN-MOMENTS-01c — the generating ceremony says what the runner just told us.
//
// Before this, the ceremony showed five FIXED lines to everybody:
//   "Calculating your Zone 2 ceiling. Lower than you'd expect."
// We hold a nervous first-timer's whole attention for 28-35 seconds, having just
// asked them fifteen questions about their life and their injuries, and said
// nothing that could only be about them.
//
// This is NOT motivation and must never become it (voice table: no cheerleading,
// never "you've got this"). It is the app demonstrating it listened — Wood's
// framing: context, not encouragement. Every line states a fact the runner
// supplied and what the engine does with it.
//
// ⚠️ NO LINE MAY CLAIM ANYTHING THE PLAN DOES NOT DO. These render while the plan
// is still being built, so they describe the runner's INPUTS and the engine's
// documented rules, never a property of the specific plan. A line that promised
// an outcome would be a claim/computation mismatch by construction.

import type { GeneratorInput } from '@/types/plan'
import { formatDuration } from '@/lib/format'
import { GENERATION_CONFIG, raceDistanceKey } from './generationConfig'

/** Weekday names, so a runner reads "Thursday", not "thu". */
const DAY_LABEL: Record<string, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
  fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
}

// ⚠️ NO INJURY LOOKUP TABLE, ON PURPOSE. The first cut had one keyed on
// `shin_splints`, and the wizard actually sends `'shin splints'` WITH A SPACE —
// `INJURIES` chips (`'Shin splints'`, `'Plantar fasciitis'`) run through
// `.toLowerCase()` at GeneratePlanScreen.tsx:975 and nothing else. A table would
// have silently dropped exactly the two multi-word injuries, which is the
// `'Shin splints'` vs `'shin_splints'` defect that already killed three injury
// types in production. `hasInjury()` in the engine survives both spellings only
// because it normalises; rather than write a SECOND normaliser (D-16), this says
// "your <raw value>", which needs no table, no article logic, and keeps working
// for any injury value added later.

/**
 * Lines built from this runner's own answers, in the order they should appear.
 *
 * Returns only the lines that are TRUE for this runner — a missing field
 * produces no line rather than a hedge. The caller tops the list up from its own
 * generic copy, so the ceremony is never short.
 */
export function ceremonyLinesFor(input: Partial<GeneratorInput> | null | undefined): string[] {
  if (!input) return []
  const lines: string[] = []

  // Days — the single most common first-timer fear is that training will eat
  // their life. §52's minimum is real, so this is a promise the engine keeps.
  const days = input.days_available
  if (typeof days === 'number' && days > 0) {
    lines.push(`You said ${days} ${days === 1 ? 'day' : 'days'} a week. We are not going to ask for more.`)
  }

  // Longest run — the gap between what they have done and what week one asks is
  // the reassurance. Stated as a fact about their input, not a prediction.
  const longest = input.longest_recent_run_km
  if (typeof longest === 'number' && longest > 0) {
    lines.push(`Your longest run so far is ${Math.round(longest)} km. Week one starts below it.`)
  }

  // Injury — naming it back is the whole point: they told us, and it changed
  // something. §3's recovery cadence is the documented rule this refers to.
  const injuries = Array.isArray(input.injury_history) ? input.injury_history : []
  const firstInjury = injuries.map(i => String(i).trim().toLowerCase()).find(Boolean)
  if (firstInjury) {
    lines.push(`You told us about your ${firstInjury}. Every build block is followed by an easier week.`)
  }

  // Weekday time budget — echo their own ceiling back, through the ADR-015 owner
  // so it reads "1h 30", never "90 minutes".
  const cap = input.max_weekday_mins
  if (typeof cap === 'number' && cap > 0) {
    const capText = formatDuration(cap)
    if (capText) lines.push(`Weekdays capped at ${capText}. The long run is the one that moves.`)
  }

  // Long-run day — a runner who picked their day should see it named.
  const longDay = (input as { long_run_day?: string }).long_run_day
  if (longDay && DAY_LABEL[longDay]) {
    lines.push(`Long runs on ${DAY_LABEL[longDay]}, as you asked.`)
  }

  // §1's intensity distribution — the product's core idea, read from config
  // rather than typed as a number. ⚠️ `INTENSITY_DISTRIBUTION` is keyed PER
  // DISTANCE and holds `max_quality_session_pct`, not an `easy` share (tsc
  // caught the invented key). §1 counts SESSIONS, not minutes (CD-19), so the
  // sentence says sessions.
  const km = input.race_distance_km
  if (typeof km === 'number' && km > 0) {
    const band = GENERATION_CONFIG.INTENSITY_DISTRIBUTION[raceDistanceKey(km)]
    const easyPct = band ? 100 - band.max_quality_session_pct : 0
    if (easyPct > 0) {
      lines.push(`Most of this will feel too easy. That is ${easyPct}% of your sessions, by design.`)
    }
  }

  return lines
}
