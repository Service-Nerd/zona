// One-off read-only diagnostic: inspect the founder's live plan_json + plan_archive
// to root-cause the maintenance surfacing issues. Run: npx tsx scripts/inspect-maintenance.ts
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

// Load .env.local minimally
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const EMAIL = 'russell.j.shear@gmail.com'

async function main() {
  // Resolve user id
  const { data: users } = await supabase.auth.admin.listUsers()
  const user = users.users.find(u => u.email === EMAIL)
  if (!user) { console.log('NO USER for', EMAIL); return }
  console.log('user_id:', user.id)

  // Plan
  const { data: planRow } = await supabase.from('plans').select('plan_json, updated_at').eq('user_id', user.id).maybeSingle()
  const plan: any = planRow?.plan_json
  if (!plan) { console.log('NO PLAN ROW'); return }
  console.log('plan updated_at:', planRow?.updated_at)
  console.log('race_name:', plan.meta?.race_name, '| race_date:', plan.meta?.race_date, '| days_available:', plan.meta?.days_available)
  console.log('total weeks:', plan.weeks?.length)

  // Per-week phase + run-day count
  console.log('\n--- weeks (n | phase | label | type | run-days | session types) ---')
  const RUN = new Set(['easy', 'long', 'quality', 'tempo', 'intervals', 'hard', 'recovery', 'run'])
  for (const w of plan.weeks ?? []) {
    const sess = Object.entries(w.sessions ?? {}) as [string, any][]
    const types = sess.filter(([, s]) => s).map(([d, s]) => `${d}:${s.type}`).join(',')
    const runDays = sess.filter(([, s]) => s && RUN.has(s.type)).length
    const committed = sess.filter(([, s]) => s && RUN.has(s.type) && s.type !== 'recovery').length
    console.log(`W${w.n} | ${w.phase ?? '—'} | ${w.label ?? '—'} | ${w.type ?? '—'} | run=${runDays} committed=${committed} | ${types}`)
  }

  // Race week result_embedded
  const raceIdx = plan.weeks.map((w: any) => w).reduce((acc: number, w: any, i: number) => (w.type === 'race' || w.badge === 'race') ? i : acc, -1)
  console.log('\nrace week idx:', raceIdx, '| result_embedded:', JSON.stringify((plan.weeks[raceIdx] as any)?.result_embedded ?? null))

  // Archive
  const { data: arch } = await supabase.from('plan_archive').select('id, race_name, race_date, archived_at').eq('user_id', user.id)
  console.log('\nplan_archive rows:', arch?.length ?? 0, JSON.stringify(arch ?? []))
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
