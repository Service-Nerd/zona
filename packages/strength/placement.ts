// STRENGTH-ENGINE-01 — the split, and where each session lands (S1–S5).
//
// The run engine owns the calendar. This reads the run week and never moves a run.

import { STRENGTH_CONFIG as C } from './config'
import type { Day, RunDay, RunPhase, RunRole, SessionKind, SplitKind, StrengthProfile } from './types'

const HARD: readonly RunRole[] = ['quality', 'long', 'race']

/** S1 — the split table, before the run week has its say. */
export function splitFor(sessions: number): { split: SplitKind; kinds: SessionKind[] } {
  if (sessions <= 1) return { split: 'full_body', kinds: ['full_body'] }
  if (sessions === 2) return { split: 'full_body', kinds: ['full_body', 'full_body'] }
  if (sessions === 3) return { split: 'full_body_plus_upper', kinds: ['full_body', 'full_body', 'upper_core'] }
  return { split: 'upper_lower', kinds: ['lower_core', 'upper_core', 'lower_core', 'upper_core'] }
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86_400_000)
}

export interface Timeline {
  days: RunDay[]
  raceDate: string | null
  unavailable: ReadonlySet<Day>
}

function roleAt(t: Timeline, i: number): RunRole {
  return i >= 0 && i < t.days.length ? t.days[i].role : 'rest'
}

/** S5 — no strength at all on race day or the day before. */
export function strengthAllowed(t: Timeline, i: number): boolean {
  const d = t.days[i]
  if (t.unavailable.has(d.day)) return false
  if (d.role === 'race') return false
  // S3 Am.1 (§126) — a day holding two runs takes no strength: three sessions in a day is not
  // what S4's stacking was written for (Blagrove).
  if ((d.runs ?? 0) >= 2) return false
  if (t.raceDate) {
    const until = daysBetween(d.date, t.raceDate)
    if (until >= 0 && until <= C.NO_STRENGTH_DAYS_BEFORE_RACE) return false
  }
  return true
}

/**
 * S2 — may heavy legs go on day i?
 *   (a) a quality day, stacked after the run: §7 already keeps the next day easy;
 *   (b) an easy/rest day with no hard run the day before, nor in the next
 *       `HEAVY_LEGS_CLEAR_DAYS_AFTER` days;
 *   never a long-run or race day, and never inside the taper cut-off (S5).
 */
export function heavyLegsLegal(t: Timeline, i: number): boolean {
  if (!strengthAllowed(t, i)) return false
  const d = t.days[i]
  if (t.raceDate) {
    const until = daysBetween(d.date, t.raceDate)
    if (until >= 0 && until < C.HEAVY_LEGS_CUTOFF_DAYS_BEFORE_RACE) return false
  }
  if (d.role === 'long' || d.role === 'race') return false
  if (d.role === 'quality') return !HARD.includes(roleAt(t, i + 1))
  if (HARD.includes(roleAt(t, i - 1))) return false
  for (let k = 1; k <= C.HEAVY_LEGS_CLEAR_DAYS_AFTER; k++) if (HARD.includes(roleAt(t, i + k))) return false
  return true
}

export interface Placed {
  index: number; kind: SessionKind; heavy: boolean
  /** S3 Am.2 — an upper session that REPLACES a leg session (no legal heavy-leg day): it keeps light leg work. */
  lightLower?: boolean
}

/**
 * Place one week's sessions. `weekIdx` are the timeline indices of this week's
 * days; `prevHeavy` is the last heavy-leg index from earlier weeks (48 h spacing
 * across the week boundary).
 */
export function placeWeek(
  t: Timeline, weekIdx: number[], phase: RunPhase, profile: StrengthProfile, masters: boolean, prevHeavy: number | null,
): { placed: Placed[]; legsLimited: boolean; fewer: boolean } {
  const allowed = weekIdx.filter(i => strengthAllowed(t, i))

  if (phase === 'race_week') {
    // One short mobility session on a non-hard day, as far from the race as the week allows.
    const pick = allowed.find(i => !HARD.includes(t.days[i].role)) ?? null
    return { placed: pick == null ? [] : [{ index: pick, kind: 'mobility', heavy: false }], legsLimited: false, fewer: false }
  }

  // S5 — the last RACE_WEEK_DAYS before the race take mobility only, whatever the run week calls the week. A taper
  // week that ends inside that window used to be safe only because placement took the earliest days; chosen days
  // (PINNED-DAYS-01) or a long unavailable list reached the window and put strength in it.
  const ordinary = allowed.filter(i => {
    if (!t.raceDate) return true
    const until = daysBetween(t.days[i].date, t.raceDate)
    return !(until >= 0 && until < C.RACE_WEEK_DAYS)
  })

  let wanted = profile.sessions_per_week as number
  if (phase === 'taper') wanted = Math.min(wanted, masters ? C.TAPER_SESSIONS_PER_WEEK_MASTERS : C.TAPER_SESSIONS_PER_WEEK)

  const { kinds } = splitFor(wanted)
  const legKinds = kinds.filter(k => k !== 'upper_core')
  const upperKinds = kinds.filter(k => k === 'upper_core')

  // Heavy-leg days: quality days first (stacking keeps hard days hard), then easy days.
  const legCandidates = ordinary
    .filter(i => heavyLegsLegal(t, i))
    .sort((a, b) => Number(t.days[b].role === 'quality') - Number(t.days[a].role === 'quality') || a - b)
  const legDays: number[] = []
  let last = prevHeavy
  for (const i of legCandidates) {
    if (legDays.length >= Math.min(legKinds.length, C.MAX_HEAVY_LEG_SESSIONS_PER_WEEK)) break
    if (last != null && i - last < C.MIN_DAYS_BETWEEN_HEAVY_LEGS) continue
    if (legDays.some(d => Math.abs(d - i) < C.MIN_DAYS_BETWEEN_HEAVY_LEGS)) continue
    legDays.push(i)
    last = Math.max(last ?? i, i)
  }
  legDays.sort((a, b) => a - b)
  const legsLimited = legDays.length < legKinds.length
  // Overflow leg sessions become upper + core (S3), never skipped.
  const upperNeeded = upperKinds.length + (legKinds.length - legDays.length)

  const taken = new Set(legDays)
  // Upper days: one strength session per day; prefer a non-hard day spaced from
  // the others, then any non-hard day, and only then a hard-run day.
  const free = ordinary.filter(i => !taken.has(i))
  const easy = free.filter(i => !HARD.includes(t.days[i].role))
  const hard = free.filter(i => HARD.includes(t.days[i].role))
  const upperDays: number[] = []
  const spaced = (i: number) => !Array.from(taken).concat(upperDays).some(d => Math.abs(d - i) < 2)
  const take = (pool: number[], needSpacing: boolean) => {
    for (const i of pool) {
      if (upperDays.length >= upperNeeded) return
      if (upperDays.includes(i) || (needSpacing && !spaced(i))) continue
      upperDays.push(i)
    }
  }
  take(easy, true)
  take(easy, false)
  take(hard, true)
  take(hard, false)

  const placed: Placed[] = [
    ...legDays.map((index, k) => ({ index, kind: legKinds[k], heavy: true })),
    // The overflow (leg sessions S2 had no legal day for) is the last of the upper days; those keep light leg work.
    ...upperDays.map((index, k) => ({ index, kind: 'upper_core' as SessionKind, heavy: false, lightLower: k >= upperDays.length - (legKinds.length - legDays.length) })),
  ].sort((a, b) => a.index - b.index)
  return { placed, legsLimited, fewer: placed.length < wanted }
}
