// PINNED-DAYS-01 — which days the setup screen shows as chosen when it opens.
//
// A runner who picked days sees their picks. A runner who set strength up before the question existed answered
// "how many" and "which days you can't", and the engine chose the rest; for them the screen starts on the days their
// plan actually used most, so the first save keeps what they already had instead of starting from nothing.
// A runner with no profile starts empty and picks.

import { STRENGTH_CONFIG as C, type Day, type StrengthPlan, type StrengthProfile } from '@/packages/strength'

const DAYS: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const ORDINARY = new Set(['base', 'build', 'peak', 'deload'])

export function prefillChosenDays(profile: StrengthProfile | null, plan: StrengthPlan | null): Day[] {
  if (!profile) return []
  if (profile.available_days?.length) return DAYS.filter(d => profile.available_days!.includes(d))
  const used = new Map<Day, number>()
  for (const w of plan?.weeks ?? []) if (ORDINARY.has(w.phase)) for (const s of w.sessions) used.set(s.day, (used.get(s.day) ?? 0) + 1)
  const n = Math.min(profile.sessions_per_week, C.MAX_CHOSEN_DAYS)
  const top = Array.from(used.entries()).sort((a, b) => b[1] - a[1] || DAYS.indexOf(a[0]) - DAYS.indexOf(b[0])).slice(0, n).map(([d]) => d)
  return DAYS.filter(d => top.includes(d))
}
