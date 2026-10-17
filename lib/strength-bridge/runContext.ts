// STRENGTH-ENGINE-01 (ADR-024 §1–2) — the ONLY code that knows both engines.
//
// Turns a run Plan into the narrow, versioned `RunContext` the strength engine
// reads: which days are hard, the phase, the race date, injury tags, masters.
// No paces, zones or distances cross this line, so the run engine can change
// shape without the strength engine noticing.
//
// "Is there a run on date D, and what is it?" is answered by the canonical
// resolver `getSessionForDate` (ADR-016), WITH the runner's move/swap overrides,
// so strength is placed around the week the runner will actually run.

import { createHash } from 'node:crypto'
import type { Plan, Session, Week } from '@/types/plan'
import type { SessionOverride } from '@/lib/plan/effectiveSessions'
import { getSessionsForDate, parseLocalDate, dayKeyForDate } from '@/lib/plan/weekResolution'
import { soleSession } from '@/lib/plan/effectiveSessions'
import { isLongRun } from '@/lib/plan/sessionRole'
import { GENERATION_CONFIG } from '@/lib/plan/generationConfig'
import { INJURY_TAGS, type InjuryTag, type RunContext, type RunDay, type RunPhase, type RunRole, type RunWeek } from '@/packages/strength'

const QUALITY_TYPES = new Set(['quality', 'tempo', 'intervals', 'hard'])

export function runRoleOf(s: Session | null | undefined): RunRole {
  if (!s || s.type === 'rest') return 'rest'
  if (s.type === 'race') return 'race'
  if (s.type === 'strength' || s.type === 'cross-train') return 'cross'
  if (isLongRun(s)) return 'long'
  if (QUALITY_TYPES.has(s.type)) return 'quality'
  if (s.type === 'recovery') return 'recovery'
  return 'easy'
}

function iso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function weekPhase(w: Week, raceDate: string | null): RunPhase {
  if (raceDate) {
    const start = parseLocalDate(w.date)
    const end = new Date(start); end.setDate(end.getDate() + 6)
    if (raceDate >= iso(start) && raceDate <= iso(end)) return 'race_week'
  }
  if (w.badge === 'deload') return 'deload'
  switch (w.phase) {
    case 'base': case 'build': case 'peak': case 'taper': return w.phase
    case 'foundation': case 'base_build': return 'base'
    case 'maintenance_restoration': case 'maintenance_base': return 'maintenance'
    default: return 'build'
  }
}

export function planToRunContext(plan: Plan, overrides: ReadonlyArray<SessionOverride> = []): RunContext {
  const weeks = [...plan.weeks].sort((a, b) => a.date.localeCompare(b.date))
  const raceDate = plan.meta.race_date ? plan.meta.race_date.slice(0, 10) : null
  const runWeeks: RunWeek[] = weeks.map(w => ({ n: w.n, phase: weekPhase(w, raceDate) }))
  const days: RunDay[] = []
  if (weeks.length) {
    const first = parseLocalDate(weeks[0].date)
    const last = parseLocalDate(weeks[weeks.length - 1].date); last.setDate(last.getDate() + 6)
    let wi = 0
    for (const d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
      // Each calendar day belongs to the latest week that started on or before it,
      // so a gap between weeks is filled rather than skipped (no index holes).
      while (wi + 1 < weeks.length && parseLocalDate(weeks[wi + 1].date) <= d) wi++
      const resolved = soleSession(getSessionsForDate(plan.weeks, new Date(d), overrides))
      days.push({ date: iso(d), day: dayKeyForDate(d), week_n: weeks[wi].n, role: runRoleOf(resolved?.session) })
    }
  }
  const injury_tags = Array.from(new Set(
    (plan.meta.injury_history ?? []).map(t => t.toLowerCase().trim()).filter((t): t is InjuryTag => (INJURY_TAGS as readonly string[]).includes(t)),
  ))
  const age = plan.meta.age
  return {
    version: 1,
    days,
    weeks: runWeeks,
    race_date: raceDate,
    injury_tags,
    masters: typeof age === 'number' && age >= GENERATION_CONFIG.MASTERS_AGE_THRESHOLD,
  }
}

/** What a stored strength plan was placed around. Differs → the run week moved under it. */
export function runContextSig(ctx: RunContext | null): string | null {
  return ctx ? createHash('sha256').update(JSON.stringify(ctx)).digest('hex') : null
}
