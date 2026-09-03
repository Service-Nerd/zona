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

export type Day = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export const DAY_ORDER: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

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
