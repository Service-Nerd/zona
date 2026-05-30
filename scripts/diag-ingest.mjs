// One-off diagnostic: is Strava/HK ingest actually landing rows for the user's
// recent runs, or is something (e.g. a missing avg_temp_c column) silently
// killing the upsert? Read-only. Run: node scripts/diag-ingest.mjs
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

// Minimal .env.local loader (avoid extra deps).
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  // Take the LAST occurrence — .env.local has a placeholder line before the
  // real SUPABASE_SERVICE_ROLE_KEY, and the real one must win.
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const EMAIL = 'russell.j.shear@gmail.com'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const since = new Date(Date.now() - 14 * 86400000).toISOString()
const log = (...a) => console.log(...a)

// 1. Does avg_temp_c exist on strava_activities? (the prime suspect)
log('\n=== avg_temp_c column check ===')
{
  const { error } = await sb.from('strava_activities').select('avg_temp_c').limit(1)
  if (error) log('❌ avg_temp_c MISSING / unreadable →', error.message, '\n   → every Strava upsert throws; ingest is broken until the column is added.')
  else log('✅ avg_temp_c column exists and is selectable.')
}

// 2. Resolve the user id.
let userId = null
{
  let page = 1
  while (!userId) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 })
    if (error) { log('auth lookup failed:', error.message); break }
    userId = data.users.find(u => u.email?.toLowerCase() === EMAIL)?.id ?? null
    if (data.users.length < 200) break
    page++
  }
}
log('\n=== user ===')
log('user_id:', userId ?? '(not found)')
if (!userId) process.exit(0)

// 3. Recent rows across the three tables (last 14 days).
async function dump(table, dateCol, cols) {
  const { data, error } = await sb.from(table).select(cols).eq('user_id', userId)
    .gte(dateCol, since).order(dateCol, { ascending: false }).limit(20)
  log(`\n=== ${table} (since ${since.slice(0,10)}) ===`)
  if (error) { log('  ❌', error.message); return }
  log(`  ${data.length} row(s)`)
  for (const r of data) log('  -', JSON.stringify(r))
}

await dump('strava_activities', 'start_date',
  'strava_activity_id, source, apple_health_uuid, start_date, name, distance_m, avg_hr, hr_in_zone_pct, processed_at')
await dump('session_completions', 'updated_at',
  'week_n, session_day, status, strava_activity_id, apple_health_uuid, strava_activity_km, avg_hr, updated_at')
await dump('run_analysis', 'created_at',
  'week_n, session_day, source, verdict, hr_in_zone_pct, total_score, created_at')

// 4. Cross-source duplicate analysis (item 1) — all-time. A HealthKit row
//    (source='apple_health', strava_activity_id null) that shares a start time
//    (±5 min) and distance (±5%) with a Strava-sourced row is a duplicate of
//    the same physical run. The Strava row carries the HR stream, so the HK
//    copy is the redundant one.
log('\n=== cross-source duplicates (all-time) ===')
{
  const { data: all, error } = await sb.from('strava_activities')
    .select('id, source, strava_activity_id, apple_health_uuid, start_date, distance_m, name')
    .eq('user_id', userId)
  if (error) { log('  ❌', error.message) }
  else {
    const strava = all.filter(r => r.source === 'strava' && r.strava_activity_id != null)
    const hk     = all.filter(r => r.source === 'apple_health' && r.strava_activity_id == null)
    const FIVE_MIN = 5 * 60 * 1000
    const dupes = []
    for (const h of hk) {
      const ht = new Date(h.start_date).getTime()
      const match = strava.find(s => {
        const dt = Math.abs(new Date(s.start_date).getTime() - ht)
        const dd = s.distance_m ? Math.abs(s.distance_m - h.distance_m) / s.distance_m : 1
        return dt <= FIVE_MIN && dd <= 0.05
      })
      if (match) dupes.push({ hk_uuid: h.apple_health_uuid, name: h.name, start: h.start_date })
    }
    log(`  total rows: ${all.length} | strava: ${strava.length} | healthkit(null-id): ${hk.length}`)
    log(`  HK rows that duplicate a Strava run (±5min/±5%): ${dupes.length}`)
    for (const d of dupes) log('  -', JSON.stringify(d))
    log('  (DRY RUN — nothing deleted.)')
  }
}

log('\n=== done ===')
process.exit(0)
