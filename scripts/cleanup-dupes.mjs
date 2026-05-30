// Cross-source duplicate sweep — ALL users. Dry-run by default; --apply to mutate.
//   node scripts/cleanup-dupes.mjs            (dry run — shows what would change)
//   node scripts/cleanup-dupes.mjs --apply    (executes)
//
// Deletes HealthKit rows (source='apple_health', strava_activity_id null) that
// duplicate a Strava-sourced run for the SAME user (start ±5 min, distance ±5%),
// keeping the Strava row (it carries the HR stream). Skips any HK row a
// session_completion still points to, so no completion is orphaned.
//
// One-off backstop until ingest-time dedup ships (backlog "Strava as secondary
// source"). Idempotent — safe to re-run. History: a founder-account run on
// 2026-05-30 also repaired the Wk19/Fri link (one-off, removed from this sweep).
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const APPLY = process.argv.includes('--apply')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const FIVE_MIN = 5 * 60 * 1000
const log = (...a) => console.log(...a)
log(APPLY ? '\n*** APPLY MODE — mutating ***' : '\n--- DRY RUN (pass --apply to execute) ---')

// Candidate users: anyone with ≥1 unlinked HealthKit activity row. Paginate so
// a large table doesn't silently truncate at the 1000-row default.
const userIds = new Set()
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb.from('strava_activities')
    .select('user_id').eq('source', 'apple_health').is('strava_activity_id', null)
    .range(from, from + 999)
  if (error) { log('candidate query failed:', error.message); process.exit(1) }
  for (const r of data) userIds.add(r.user_id)
  if (data.length < 1000) break
}
log(`candidate users (≥1 unlinked HK row): ${userIds.size}`)

let totalDel = 0, totalProtected = 0, usersAffected = 0
for (const userId of userIds) {
  const { data: all, error } = await sb.from('strava_activities')
    .select('id, source, strava_activity_id, apple_health_uuid, start_date, distance_m')
    .eq('user_id', userId)
  if (error) { log(`  ❌ ${userId}: ${error.message}`); continue }
  const strava = all.filter(r => r.source === 'strava' && r.strava_activity_id != null)
  const hk     = all.filter(r => r.source === 'apple_health' && r.strava_activity_id == null)
  if (!strava.length || !hk.length) continue

  const dupes = hk.filter(h => {
    const ht = new Date(h.start_date).getTime()
    return strava.some(s => {
      const dt = Math.abs(new Date(s.start_date).getTime() - ht)
      const dd = s.distance_m ? Math.abs(s.distance_m - h.distance_m) / s.distance_m : 1
      return dt <= FIVE_MIN && dd <= 0.05
    })
  })
  if (!dupes.length) continue

  // Safety: never delete an HK row a completion still points to.
  const { data: comps } = await sb.from('session_completions')
    .select('apple_health_uuid').eq('user_id', userId).not('apple_health_uuid', 'is', null)
  const referenced = new Set((comps ?? []).map(c => c.apple_health_uuid))
  const deletable = dupes.filter(d => !referenced.has(d.apple_health_uuid))
  const protectedN = dupes.length - deletable.length

  usersAffected++
  totalDel += deletable.length
  totalProtected += protectedN
  log(`  user ${userId}: dupes ${dupes.length} | protected ${protectedN} | delete ${deletable.length}`)

  if (APPLY && deletable.length) {
    const { error: delErr } = await sb.from('strava_activities').delete().in('id', deletable.map(d => d.id))
    if (delErr) log(`    ❌ delete failed: ${delErr.message}`)
  }
}

log(`\n=== ${APPLY ? 'DELETED' : 'WOULD DELETE'} ${totalDel} row(s) across ${usersAffected} user(s) | protected ${totalProtected} ===`)
process.exit(0)
