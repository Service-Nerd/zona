// FREE — infrastructure. ADR-027 v1.2, ARCH-ENG-013: `assembleRunnerFacts`, the ONE owner of reading a
// runner's stored facts for the engine. ADR027-B2-PROFILE.
//
// It lives HERE, at the persistence boundary, and not under `lib/engine`, because it does I/O and
// `lib/engine` is inside ENGINE-PURITY-GATE-01. It reads; it decides nothing. What the rows MEAN
// (windows, dedupe, validity) is L1's pure `aggregateObserved`, so it can be tested without a database.
//
// ⚠️ NOT CALLED BY ANY ROUTE YET. Route adoption is B2b (`ADR027-B2B-PROFILE-ADOPTION`). Until then
// `runEngine` builds facts from the request alone.
//
// ⚠️ A QUERY ERROR IS NOT AN EMPTY HISTORY. Returning empty aggregates on an error would read as
// "this runner has run nothing", the §68 Am.1 failure; it throws, as `fetchWeeklyLoad` does.
//
// Reads only. `strava_activities` writes stay behind the ingestion gateway (INV-DATA-008).

import type { GeneratorInput } from '@/types/plan'
import type { RunnerFacts, SettingsFacts } from '@/lib/engine/contracts/facts'
import { resolveAsOf } from '@/lib/engine/profile/asOf'
import { aggregateObserved, OBSERVED_WINDOW_DAYS, type ObservedRows } from '@/lib/engine/profile/observed'
import { parseDateLocal, formatDate, addDays } from '@/lib/plan/length'

/** The supabase-js query builder, structurally. Same shape `fetchWeeklyLoad` takes. */
type Db = { from: (t: string) => any }

/** One day of slack either side of the window, so a run near midnight in the runner's zone is
 *  fetched and `aggregateObserved` makes the exact cut. */
const FETCH_SLACK_DAYS = 1

function check(label: string, res: { error?: { message?: string } | null } | null | undefined): void {
  if (res?.error) throw new Error(`fetchRunnerFacts(${label}): ${res.error.message ?? String(res.error)}`)
}

export async function fetchRunnerFacts(db: Db, userId: string, input: GeneratorInput, now: Date): Promise<RunnerFacts> {
  const settingsRes = await db.from('user_settings')
    .select('birth_year, date_of_birth, resting_hr, max_hr, max_hr_source, timezone')
    .eq('id', userId).maybeSingle()
  check('user_settings', settingsRes)
  const row = (settingsRes?.data ?? null) as Partial<SettingsFacts> | null
  const settings: SettingsFacts | null = row ? {
    birth_year: row.birth_year ?? null,
    date_of_birth: row.date_of_birth ?? null,
    resting_hr: row.resting_hr ?? null,
    max_hr: row.max_hr ?? null,
    max_hr_source: row.max_hr_source === 'observed' || row.max_hr_source === 'user_confirmed' ? row.max_hr_source : null,
    timezone: row.timezone ?? null,
  } : null

  const frame = resolveAsOf(now, settings?.timezone ?? null)
  const asOfDate = parseDateLocal(frame.as_of)
  const from = addDays(asOfDate, -(OBSERVED_WINDOW_DAYS + FETCH_SLACK_DAYS))
  const to = addDays(asOfDate, 1 + FETCH_SLACK_DAYS)
  const fromIso = from.toISOString(), toIso = to.toISOString()

  const [runsRes, firstRes, healthRes, compRes, anRes] = await Promise.all([
    db.from('strava_activities')
      .select('start_date, distance_m, reported_distance_m, moving_time_s, max_hr, activity_type, sport_type, strava_activity_id, apple_health_uuid, manual_uuid')
      .eq('user_id', userId).gte('start_date', fromIso).lt('start_date', toIso),
    db.from('strava_activities')
      .select('start_date')
      // the first RUN, not the first activity (`isRun`'s own two columns): a walk logged first
      // would date the run log's coverage too early (code review 2026-11-21)
      .eq('user_id', userId).or('activity_type.eq.Run,sport_type.eq.Run')
      .order('start_date', { ascending: true }).limit(1),
    db.from('health_daily_samples')
      .select('sample_date, rhr_bpm')
      .eq('user_id', userId).gte('sample_date', formatDate(from)).lte('sample_date', formatDate(to)),
    db.from('session_completions')
      .select('created_at, rpe, fatigue_tag')
      .eq('user_id', userId).is('superseded_at', null).gte('created_at', fromIso).lt('created_at', toIso),
    db.from('run_analysis')
      .select('created_at, ef_trend_pct')
      .eq('user_id', userId).is('superseded_at', null).gte('created_at', fromIso).lt('created_at', toIso),
  ])
  check('strava_activities', runsRes); check('strava_activities.first', firstRes)
  check('health_daily_samples', healthRes); check('session_completions', compRes); check('run_analysis', anRes)

  const first = Array.isArray(firstRes?.data) ? firstRes.data[0] : firstRes?.data
  const rows: ObservedRows = {
    runs: runsRes?.data ?? [],
    first_run_at: first?.start_date ?? null,
    health: healthRes?.data ?? [],
    completions: compRes?.data ?? [],
    analyses: anRes?.data ?? [],
  }
  return { facts_version: 1, input, settings, observed: aggregateObserved(rows, frame) }
}
