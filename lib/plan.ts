import type { Plan } from '@/types/plan'

export const DEFAULT_GIST_URL = process.env.NEXT_PUBLIC_GIST_URL ||
  'https://gist.githubusercontent.com/Service-Nerd/efec07a87f65494f0e078a1ccb136100/raw/rts_plan.json'

export const EMPTY_PLAN: Plan = {
  meta: {
    athlete: '', handle: '',
    race_name: '', race_date: '', race_distance_km: 0,
    charity: '', plan_start: '', quit_date: '',
    resting_hr: 0, max_hr: 0, zone2_ceiling: 145,
    version: '', last_updated: '', notes: '',
  },
  weeks: [],
}

const PLAN_FALLBACK: Plan = {
  meta: {
    athlete: '', handle: '',
    race_name: '', race_date: '', race_distance_km: 0,
    charity: '', plan_start: '', quit_date: '',
    resting_hr: 0, max_hr: 0, zone2_ceiling: 145,
    version: '', last_updated: '', notes: ''
  },
  weeks: []
}

export async function fetchPlanFromUrl(url: string): Promise<Plan> {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) throw new Error('Plan fetch failed')
    return await res.json() as Plan
  } catch {
    return PLAN_FALLBACK
  }
}

// Legacy export — used as fallback
export async function fetchPlan(): Promise<Plan> {
  return fetchPlanFromUrl(DEFAULT_GIST_URL)
}

// Parse a YYYY-MM-DD string as local midnight — avoids UTC-offset week mismatches
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function getCurrentWeek(weeks: Plan['weeks']) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  // Find the week where today falls within its 7-day window
  const current = weeks.find(w => {
    const weekStart = parseLocalDate((w as any).date)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)
    return now >= weekStart && now < weekEnd
  })
  // Fallback: last week before today (if between weeks), or first future week
  if (!current) {
    const past = [...weeks].reverse().find(w => parseLocalDate((w as any).date) <= now)
    return past ?? weeks[0]
  }
  return current
}

export function getCurrentWeekIndex(weeks: Plan['weeks']): number {
  const current = getCurrentWeek(weeks)
  const idx = weeks.indexOf(current)
  return idx >= 0 ? idx : 0
}

export function getWeeksToRace(raceDate: string) {
  const ms = new Date(raceDate).getTime() - Date.now()
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24 * 7)))
}
