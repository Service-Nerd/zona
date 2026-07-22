import type { SupabaseClient } from '@supabase/supabase-js'
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

// Fetch plan for a user: plans table → gist_url auto-migrate → plan_json auto-migrate → EMPTY_PLAN.
// Auto-migration is fire-and-forget: existing users' plans move to Supabase on first load.
export async function fetchPlanForUser(
  userId: string,
  supabase: SupabaseClient,
  opts: { gistUrl?: string | null; legacyPlanJson?: Plan | null } = {}
): Promise<Plan> {
  const { data: planRow } = await supabase
    .from('plans')
    .select('plan_json')
    .eq('user_id', userId)
    .single()

  if (planRow?.plan_json) return planRow.plan_json as Plan

  // OPS-01: these migrate-on-read saves are fire-and-forget, but a throw must
  // not become an unhandled rejection (this module is isomorphic — imported by
  // client components — so it can't use the service-role recordOpsEvent; the
  // daily integrity probe backstops the resulting stale state). Surface it.
  if (opts.gistUrl) {
    const plan = await fetchPlanFromUrl(opts.gistUrl)
    if (plan.weeks.length > 0) {
      void savePlanForUser(userId, plan, supabase).catch((err) =>
        console.error('[fetchPlanForUser] gist auto-save failed', err))
      return plan
    }
  }

  if (opts.legacyPlanJson && (opts.legacyPlanJson as Plan).weeks?.length > 0) {
    void savePlanForUser(userId, opts.legacyPlanJson, supabase).catch((err) =>
      console.error('[fetchPlanForUser] legacy auto-save failed', err))
    return opts.legacyPlanJson
  }

  return EMPTY_PLAN
}

export async function savePlanForUser(
  userId: string,
  plan: Plan,
  supabase: SupabaseClient
): Promise<void> {
  // RESHAPE-FIX-WAVE1 (Defect 9): surface upsert errors. Prior code awaited
  // the upsert without checking `.error`, so RLS rejections, schema issues,
  // and constraint failures landed silently. The reshape engine then
  // believed it had persisted state that the DB never accepted. Throw so the
  // caller route surfaces a 500; better a visible failure than a phantom
  // success that corrupts downstream coaching reads.
  const upsertRes = await supabase
    .from('plans')
    .upsert(
      { user_id: userId, plan_json: plan, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
  if (upsertRes.error) {
    throw new Error(`savePlanForUser: plan upsert failed — ${upsertRes.error.message}`)
  }

  // PLAN-VOICE-AI: invalidate cached weekly notes whenever the plan changes.
  // Reshapes, confirmed adjustments, reverts, recalibrations, and full
  // regenerations all flow through here — a cached note narrating sessions
  // that no longer exist is brand-destroying, so invalidation is en bloc and
  // the route regenerates lazily on next Plan-screen view.
  const deleteRes = await supabase.from('plan_weekly_notes').delete().eq('user_id', userId)
  if (deleteRes.error) {
    throw new Error(`savePlanForUser: weekly-notes invalidation failed — ${deleteRes.error.message}`)
  }
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

/**
 * Find the plan-week index whose 7-day window contains the given calendar
 * date. Used by activity-matching paths so a Sunday-night run ingested on
 * Monday morning is matched against last week's plan (where it belongs),
 * not today's. Same fallback semantics as getCurrentWeek: nearest past
 * week if the date sits in a gap, or weeks[0] if it's before the plan.
 *
 * Why this exists separately from getCurrentWeekIndex: that one is
 * (correctly) anchored to "now" for UI surfaces — TodayScreen, Coach
 * report, etc. Activity-matching is anchored to the activity, not the
 * clock — those are different semantics.
 */
export function getWeekIndexForDate(weeks: Plan['weeks'], date: Date): number {
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  const idx = weeks.findIndex(w => {
    const weekStart = parseLocalDate((w as any).date)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)
    return target >= weekStart && target < weekEnd
  })
  if (idx >= 0) return idx
  // Fallback: nearest past week, else first week.
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (parseLocalDate((weeks[i] as any).date) <= target) return i
  }
  return 0
}

export function getWeeksToRace(raceDate: string) {
  const ms = new Date(raceDate).getTime() - Date.now()
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24 * 7)))
}

/**
 * Whether `date` falls inside a plan week's 7-day window [weekStart, weekStart+7).
 *
 * getCurrentWeek() falls back to the last week when today is past the plan, so
 * callers can't otherwise tell "genuinely inside this week" from "pinned to the
 * final week because the plan is over". Coaching surfaces need that distinction:
 * without it they read a stale slot (e.g. today's weekday) out of a week that
 * has already ended and prescribe a session that no longer exists.
 */
export function isDateWithinWeek(week: Plan['weeks'][number], date: Date): boolean {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const weekStart = parseLocalDate((week as any).date)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)
  return d >= weekStart && d < weekEnd
}

/**
 * True when `date` is on or after the END of `week`'s 7-day window — i.e. today
 * is past that week. The canonical "are we past plan-week N?" predicate.
 *
 * Doctrine (§73): temporal position must be reasoned about with a date-window
 * predicate, NEVER with an index comparison against `getCurrentWeekIndex()`.
 * That pointer SATURATES at the final week once today is past the plan
 * (`getCurrentWeek` falls back to the last week), so `currentWeekIndex > N` is
 * unreachable when N is the last week — the "in-flight vs done" bug class that
 * bit the day boundary (§65), the plan-complete surfaces (§70), and the
 * post-race prompt. Use this predicate instead.
 */
export function isDatePastWeek(week: Plan['weeks'][number], date: Date): boolean {
  const weekStart = parseLocalDate((week as any).date)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d >= weekEnd
}

/**
 * True when `date` is on or after the end of the plan's final week — i.e. the
 * plan is over. Special case of {@link isDatePastWeek} on the last week: the
 * race commonly lives in the last week, so post-race is frequently also
 * plan-complete; there is no "week after" for the current-week pointer to
 * advance into.
 */
export function isPlanComplete(weeks: Plan['weeks'], date: Date): boolean {
  const last = weeks[weeks.length - 1]
  if (!last) return false
  return isDatePastWeek(last, date)
}
