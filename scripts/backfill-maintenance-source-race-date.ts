// One-off backfill (ADR-013): set meta.source_race_date on maintenance plans
// created before the source_race_date carry landed. Without it, post-race
// coaching (sessionFeedback) has no real elapsed-time ground truth and the
// model fabricates one ("two days after your 100km effort" three weeks out).
//
// The date is recovered from plan_archive (the archived race plan carries the
// real race_date). Dry-run by default; pass --apply to write.
//
//   Dry run:  npx tsx scripts/backfill-maintenance-source-race-date.ts
//   Apply:    npx tsx scripts/backfill-maintenance-source-race-date.ts --apply
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const EMAIL = 'russell.j.shear@gmail.com'
const APPLY = process.argv.includes('--apply')

async function main() {
  const { data: users } = await supabase.auth.admin.listUsers()
  const user = users.users.find(u => u.email === EMAIL)
  if (!user) { console.log('NO USER for', EMAIL); return }
  console.log('user_id:', user.id, '| mode:', APPLY ? 'APPLY' : 'DRY-RUN')

  const { data: planRow } = await supabase
    .from('plans').select('plan_json, updated_at').eq('user_id', user.id).maybeSingle()
  const plan: any = planRow?.plan_json
  if (!plan) { console.log('NO PLAN ROW'); return }

  if (plan.meta?.plan_kind !== 'maintenance') {
    console.log('SKIP — plan_kind is not "maintenance" (is:', plan.meta?.plan_kind ?? 'unset', ')')
    return
  }
  if (plan.meta?.source_race_date) {
    console.log('SKIP — source_race_date already set:', plan.meta.source_race_date)
    return
  }

  // Recover the race date from plan_archive. Prefer an archive whose race_name
  // matches the maintenance plan's source_race_name; fall back to any archive
  // whose date all rows agree on.
  const wantName = plan.meta?.source_race_name
    ?? (typeof plan.meta?.race_name === 'string' ? plan.meta.race_name.replace(/^After\s+/i, '') : null)
  const { data: arch } = await supabase
    .from('plan_archive').select('race_name, race_date, archived_at')
    .eq('user_id', user.id).order('archived_at', { ascending: false })

  const candidates = (arch ?? []).filter(a => a.race_date)
  const matched = candidates.filter(a => a.race_name === wantName)
  const pool = matched.length > 0 ? matched : candidates
  const dates = Array.from(new Set(pool.map(a => a.race_date)))

  console.log('source_race_name wanted:', JSON.stringify(wantName))
  console.log('archive candidates:', JSON.stringify(pool.map(a => ({ race_name: a.race_name, race_date: a.race_date }))))

  if (dates.length === 0) { console.log('ABORT — no archived race_date found to backfill from.'); return }
  if (dates.length > 1)   { console.log('ABORT — archives disagree on race_date:', dates, '— resolve manually.'); return }

  const sourceRaceDate = dates[0]
  console.log(`\nWOULD SET meta.source_race_date = ${sourceRaceDate}`)
  console.log('(no other field is touched)')

  if (!APPLY) {
    console.log('\nDRY-RUN — re-run with --apply to write.')
    return
  }

  plan.meta.source_race_date = sourceRaceDate
  const { error } = await supabase
    .from('plans')
    .update({ plan_json: plan, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
  if (error) { console.error('WRITE FAILED:', error.message); process.exit(1) }
  console.log('APPLIED ✓ — meta.source_race_date is now', sourceRaceDate)
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
