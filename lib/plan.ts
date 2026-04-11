import type { Plan } from '@/types/plan'

export const DEFAULT_GIST_URL = process.env.NEXT_PUBLIC_GIST_URL ||
  'https://gist.githubusercontent.com/Service-Nerd/efec07a87f65494f0e078a1ccb136100/raw/rts_plan.json'

const PLAN_FALLBACK: Plan = {
  meta: {
    athlete: 'Russ Shear', handle: '@doinghardthingsbadly',
    race_name: 'Race to the Stones', race_date: '2026-07-11', race_distance_km: 100,
    charity: 'Make-A-Wish UK', plan_start: '2026-01-19', quit_date: '2026-04-03',
    resting_hr: 48, max_hr: 188, zone2_ceiling: 145,
    version: '2.1', last_updated: '2026-04-06',
    notes: 'v2.1: W14 Saturday B2B added. Thu renamed to Fri throughout.'
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

export function getCurrentWeek(weeks: Plan['weeks']) {
  return weeks.find(w => w.type === 'current') ?? weeks[weeks.length - 1]
}

export function getWeeksToRace(raceDate: string) {
  const ms = new Date(raceDate).getTime() - Date.now()
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24 * 7)))
}
