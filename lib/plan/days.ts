// Single owner of day-of-week normalisation.
//
// `days_cannot_train` is free-form on the way in: the wizard sends full names
// ('monday'), while the engine and the plan schema key sessions by the short
// form ('mon'). Anything comparing one against the other silently matches
// nothing — and "nothing is blocked" looks exactly like "the runner blocked
// nothing", so it fails silently rather than loudly.
//
// That is precisely what happened: `lib/plan/foundationBlock.ts` built
// `new Set(blockedDays)` straight from the raw input and filtered short-form day
// keys against it, so EVERY foundation week ignored the runner's blocked days.
// A runner who said "not Monday, Wednesday, Thursday" got foundation sessions on
// Monday and Wednesday, while week 1 onward (built by the rule engine, which
// normalises correctly) honoured them. Found on a real plan, 2026-09-03.
//
// The foundation block is generated CLIENT-side and prepended after the plan
// leaves the server, so `validatePlan()` never sees those weeks and no invariant
// caught it. Hence one shared normaliser rather than two correct-looking copies.

import { GENERATION_CONFIG } from './generationConfig'

export type Day = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export const DAY_ORDER: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

/** The day as a runner reads it in a sentence. One owner, so copy cannot spell a day two ways. */
export const DAY_FULL_NAME: Record<Day, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
}

const SHORT_DAY_SET: Set<string> = new Set(DAY_ORDER)

const FULL_TO_SHORT: Record<string, Day> = {
  monday: 'mon', tuesday: 'tue', wednesday: 'wed', thursday: 'thu',
  friday: 'fri', saturday: 'sat', sunday: 'sun',
}

/**
 * Normalise a free-form list of day names to the canonical short form.
 *
 * Accepts both spellings and any casing; ignores anything unrecognised rather
 * than throwing — a typo in one entry must not cost the runner the other days
 * they correctly blocked.
 */
export function normaliseDays(days: readonly string[] | undefined): Set<Day> {
  const out = new Set<Day>()
  for (const d of days ?? []) {
    const lower = String(d).trim().toLowerCase()
    if (SHORT_DAY_SET.has(lower)) { out.add(lower as Day); continue }
    const short = FULL_TO_SHORT[lower]
    if (short) out.add(short)
  }
  return out
}

/**
 * §18 Amendment 2 (LONGRUN-BLOCKED-DAY-01) — the single owner of "which day carries the long run".
 * The preferred weekend day, then the other weekend day, then `LONG_RUN_FALLBACK_DAYS` (Fri back to
 * Mon). Never a blocked day. `null` only when every day is blocked (ALL-DAYS-BLOCKED-01).
 * The engine and the foundation block each had their own copy; the engine's ended in a blocked Sunday.
 */
export function longRunDayFor(preferred: 'sat' | 'sun' | undefined, blocked: ReadonlySet<Day>): Day | null {
  const weekend: Day[] = preferred === 'sat' ? ['sat', 'sun'] : ['sun', 'sat']
  return [...weekend, ...GENERATION_CONFIG.LONG_RUN_FALLBACK_DAYS].find(d => !blocked.has(d)) ?? null
}

/**
 * ONRAMP-SPACING-01 (Coaching Board 2026-10-25, R1) — `count` days from `open`, placed so that no two of them, and none
 * of them and a `fixed` day (the long run), fall on consecutive days where that is possible (the week wraps: Sunday to
 * Monday is consecutive). Ties go to the set nearest `prefer`, then to the earliest days, so a Monday-first schedule stays
 * Monday-first. The one owner of spacing, used by the walk-run start and every base-building ramp.
 */
export function spreadDays(open: readonly Day[], count: number, fixed: readonly Day[] = [], prefer: readonly Day[] = []): Day[] {
  const want = Math.min(count, open.length)
  const idx = (d: Day) => DAY_ORDER.indexOf(d)
  const adjacent = (a: Day, b: Day) => { const g = Math.abs(idx(a) - idx(b)); return g === 1 || g === 6 }
  let best: Day[] = open.slice(0, want)
  let bestScore = Infinity
  const pick = (from: number, chosen: Day[]) => {
    if (chosen.length === want) {
      const all = [...chosen, ...fixed]
      let pairs = 0
      for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) if (adjacent(all[i], all[j])) pairs++
      const miss = prefer.length ? chosen.filter(d => !prefer.includes(d)).length : 0
      const early = chosen.reduce((a, d) => a + idx(d), 0) / 100
      const score = pairs * 10 + miss + early
      if (score < bestScore) { bestScore = score; best = [...chosen] }
      return
    }
    for (let i = from; i < open.length; i++) pick(i + 1, [...chosen, open[i]])
  }
  pick(0, [])
  return best.sort((a, b) => idx(a) - idx(b))
}
