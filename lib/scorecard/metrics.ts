/**
 * ADR027-B0-SCORECARD — the scorecard's derived quantities, read from a plan's OWN fields.
 *
 * ARCH-ENG-004: one metrics owner, tested against hand fixtures (`metrics.test.ts`). Every
 * plan-read predicate computes through these, and these compute through the existing
 * single owners (`sessionKmSelfPaced`, `sessionRole`). Nothing here calls a producer
 * (`ruleEngine`, `foundationCompose`, the note writers): a checker that shares the
 * producer's logic shares its blind spots (final plan read, cause 4).
 *
 * ⚠️ `weekly_km` is the plan's STATED week total, and the predicates that compare weeks use
 * it on purpose: it is what the runner is shown. `placedKm` is the sum of the placed
 * sessions, for the predicates whose objection is the gap between the two.
 */
import type { GeneratorInput, Plan, Session, Week } from '@/types/plan'
import { sessionKmSelfPaced } from '@/lib/plan/sessionDistance'
import { isLongRun, isQualitySession, isTimeTrial } from '@/lib/plan/sessionRole'

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export type Day = typeof DAYS[number]
export interface Placed { day: Day; s: Session }

const NOT_A_RUN = new Set(['rest', 'strength', 'cross-train', 'cross_train', 'cross'])

/** Every running session in a week, in day order. */
export function runsOf(w: Week): Placed[] {
  const out: Placed[] = []
  for (const day of DAYS) {
    const s = w.sessions?.[day]
    if (s && !NOT_A_RUN.has(s.type)) out.push({ day, s })
  }
  return out
}

/** Session distance through the single owner. Null-distance sessions it cannot size read 0. */
export const km = (s: Session | undefined | null): number => (s ? sessionKmSelfPaced(s) ?? 0 : 0)
export const placedKm = (w: Week): number => runsOf(w).reduce((a, r) => a + km(r.s), 0)

export const isDeloadWeek = (w: Week): boolean => w.type === 'deload' || w.badge === 'deload'
export const isRaceWeek = (w: Week): boolean => w.type === 'race'
/** A race-plan training week: numbered, not race week, not a prepended foundation week. */
export const trainingWeeks = (p: Plan): Week[] =>
  p.weeks.filter(w => w.n > 0 && !isRaceWeek(w) && w.phase !== 'foundation')
/** Training weeks that are meant to load: not a deload, not the taper. */
export const loadingWeeks = (p: Plan): Week[] =>
  trainingWeeks(p).filter(w => !isDeloadWeek(w) && w.phase !== 'taper')
export const foundationWeeks = (p: Plan): Week[] =>
  p.weeks.filter(w => w.phase === 'foundation').sort((a, b) => a.n - b.n)
export const baseBuildWeeks = (p: Plan): Week[] => p.weeks.filter(w => w.phase === 'base_build')
export const raceWeek = (p: Plan): Week | undefined => p.weeks.find(isRaceWeek)
export const raceWeekIndex = (p: Plan): number => p.weeks.findIndex(isRaceWeek)

export const peakWeekKm = (p: Plan): number => Math.max(0, ...loadingWeeks(p).map(w => w.weekly_km ?? 0))
export const longRunOf = (w: Week): Session | undefined => runsOf(w).find(r => isLongRun(r.s))?.s
export const longRunKm = (w: Week): number => km(longRunOf(w))
export const peakLongRunKm = (p: Plan): number => Math.max(0, ...loadingWeeks(p).map(longRunKm))

/** Quality sessions, time trials excluded (a TT is `hard`, and `isQualitySession` already excludes it). */
export const qualityCount = (p: Plan): number =>
  trainingWeeks(p).reduce((a, w) => a + runsOf(w).filter(r => isQualitySession(r.s)).length, 0)
export const timeTrials = (p: Plan): { w: Week; r: Placed }[] =>
  p.weeks.filter(w => !isRaceWeek(w)).flatMap(w => runsOf(w).filter(r => isTimeTrial(r.s)).map(r => ({ w, r })))
export const isHardSession = (s: Session): boolean => isQualitySession(s) || isTimeTrial(s)

/** Every runner-facing note on the plan's meta, joined. Keys ending `_note` only: the
 *  generator input and the zones blob are data, not copy. */
export function metaNotes(p: Plan): string {
  const m = p.meta as unknown as Record<string, unknown>
  return Object.entries(m).filter(([k, v]) => /_note$/.test(k) && typeof v === 'string').map(([, v]) => v as string).join(' \n ')
}
export const metaNote = (p: Plan, key: string): string => {
  const v = (p.meta as unknown as Record<string, unknown>)[key]
  return typeof v === 'string' ? v : ''
}
export const metaFlag = (p: Plan, key: string): unknown => (p.meta as unknown as Record<string, unknown>)[key]

/** Every coach note on every session, joined. */
export const sessionNotes = (p: Plan): string =>
  p.weeks.flatMap(w => runsOf(w).flatMap(r => (r.s.coach_notes ?? []).filter(Boolean) as string[])).join(' \n ')

const FULL_DAY: Record<string, Day> = { monday: 'mon', tuesday: 'tue', wednesday: 'wed', thursday: 'thu', friday: 'fri', saturday: 'sat', sunday: 'sun' }
/** The runner's blocked days, normalised to the plan's day keys. */
export function blockedDays(i: GeneratorInput): Set<Day> {
  return new Set((i.days_cannot_train ?? []).map(d => {
    const k = String(d).toLowerCase()
    return FULL_DAY[k] ?? (k.slice(0, 3) as Day)
  }))
}

export const isWeekend = (d: Day): boolean => d === 'sat' || d === 'sun'

/** Longest run of identical consecutive values (by `eq`). */
export function longestRun<T>(xs: T[], eq: (a: T, b: T) => boolean): number {
  let run = xs.length ? 1 : 0, best = run
  for (let k = 1; k < xs.length; k++) { run = eq(xs[k], xs[k - 1]) ? run + 1 : 1; best = Math.max(best, run) }
  return best
}

/** A week's session signature: day, type, label and stated size. */
export const weekSignature = (w: Week): string =>
  runsOf(w).map(r => `${r.day}:${r.s.type}:${r.s.label}:${r.s.distance_km ?? ''}:${r.s.duration_mins ?? ''}`).join('|')
