// One-shot repair + dedup. Dry-run by default; pass --apply to mutate.
//   node scripts/cleanup-dupes.mjs            (dry run — shows what would change)
//   node scripts/cleanup-dupes.mjs --apply    (executes)
//
// (1) REPAIR: re-point the Wk19/Fri completion at the 29 May Strava run whose
//     link a manual "complete" wiped (now prevented by the saveCompletion fix).
// (2) DEDUP:  delete HealthKit rows that duplicate a Strava run (±5min/±5%),
//     keeping the Strava row (it carries the HR stream). Skips any HK row a
//     session_completion still points to, so no completion is orphaned.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const APPLY = process.argv.includes('--apply')
const EMAIL = 'russell.j.shear@gmail.com'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const log = (...a) => console.log(...a)
log(APPLY ? '\n*** APPLY MODE — mutating ***' : '\n--- DRY RUN (pass --apply to execute) ---')

// Resolve user.
let userId = null
for (let page = 1; !userId; page++) {
  const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 })
  if (error) { log('auth lookup failed:', error.message); process.exit(1) }
  userId = data.users.find(u => u.email?.toLowerCase() === EMAIL)?.id ?? null
  if (data.users.length < 200) break
}
if (!userId) { log('user not found'); process.exit(1) }
log('user_id:', userId)

// ─── (1) REPAIR Wk19/Fri ───────────────────────────────────────────────────
log('\n=== (1) repair Wk19/Fri link ===')
{
  const repair = {
    strava_activity_id:   18706532028,
    strava_activity_name: 'Evening Run',
    strava_activity_km:   12.1,
    avg_hr:               141,
    status:               'complete',
    updated_at:           new Date().toISOString(),
  }
  const { data: before } = await sb.from('session_completions')
    .select('week_n, session_day, status, strava_activity_id, avg_hr')
    .eq('user_id', userId).eq('week_n', 19).eq('session_day', 'fri').maybeSingle()
  log('  before:', JSON.stringify(before))
  if (before?.strava_activity_id != null) {
    log('  ⏭  already linked — skipping repair.')
  } else if (APPLY) {
    const { error } = await sb.from('session_completions').update(repair)
      .eq('user_id', userId).eq('week_n', 19).eq('session_day', 'fri')
    log(error ? `  ❌ ${error.message}` : `  ✅ relinked to ${repair.strava_activity_id} (avg_hr ${repair.avg_hr})`)
  } else {
    log('  would set →', JSON.stringify(repair))
  }
}

// ─── (2) DEDUP HealthKit copies of Strava runs ──────────────────────────────
log('\n=== (2) delete cross-source HK duplicates ===')
{
  const { data: all } = await sb.from('strava_activities')
    .select('id, source, strava_activity_id, apple_health_uuid, start_date, distance_m, name')
    .eq('user_id', userId)
  const strava = all.filter(r => r.source === 'strava' && r.strava_activity_id != null)
  const hk     = all.filter(r => r.source === 'apple_health' && r.strava_activity_id == null)
  const FIVE_MIN = 5 * 60 * 1000
  const dupes = hk.filter(h => {
    const ht = new Date(h.start_date).getTime()
    return strava.some(s => {
      const dt = Math.abs(new Date(s.start_date).getTime() - ht)
      const dd = s.distance_m ? Math.abs(s.distance_m - h.distance_m) / s.distance_m : 1
      return dt <= FIVE_MIN && dd <= 0.05
    })
  })

  // Safety: never delete an HK row a completion still points to.
  const { data: comps } = await sb.from('session_completions')
    .select('apple_health_uuid').eq('user_id', userId).not('apple_health_uuid', 'is', null)
  const referenced = new Set((comps ?? []).map(c => c.apple_health_uuid))
  const deletable = dupes.filter(d => !referenced.has(d.apple_health_uuid))
  const protectedRows = dupes.filter(d => referenced.has(d.apple_health_uuid))

  log(`  dupes found: ${dupes.length} | protected (linked to a completion): ${protectedRows.length} | to delete: ${deletable.length}`)
  for (const d of deletable) log('  -', d.name, d.start_date, `${(d.distance_m/1000).toFixed(1)}km`, d.apple_health_uuid)

  if (APPLY && deletable.length) {
    const ids = deletable.map(d => d.id)
    const { error } = await sb.from('strava_activities').delete().in('id', ids)
    log(error ? `  ❌ ${error.message}` : `  ✅ deleted ${ids.length} rows`)
  }
}

log('\n=== done ===')
process.exit(0)
