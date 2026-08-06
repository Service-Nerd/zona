// Primes maintenance regeneration: strips the current (stale-cadence) maintenance
// weeks from the founder's plan so the DEPLOYED route regenerates a fresh block
// (correct days + AI voice) on next app load. Run: npx tsx scripts/reset-maintenance.ts
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const EMAIL = 'russell.j.shear@gmail.com'

async function main() {
  const { data: users } = await supabase.auth.admin.listUsers()
  const user = users.users.find(u => u.email === EMAIL)!
  const { data: planRow } = await supabase.from('plans').select('plan_json').eq('user_id', user.id).maybeSingle()
  const plan: any = planRow!.plan_json
  const before = plan.weeks.length
  const trimmed = plan.weeks.filter((w: any) => w.phase !== 'maintenance_restoration' && w.phase !== 'maintenance_base')
  const removed = before - trimmed.length
  if (removed === 0) { console.log('No maintenance weeks to remove — already clean.'); return }
  // Reset the transition-seen flag so the (now-correct) announcement can re-show.
  const raceIdx = trimmed.reduce((acc: number, w: any, i: number) => (w.type === 'race' || w.badge === 'race') ? i : acc, -1)
  if (raceIdx >= 0 && trimmed[raceIdx].result_embedded) {
    delete trimmed[raceIdx].result_embedded.maintenance_transition_seen
  }
  const updated = { ...plan, weeks: trimmed }
  const { error } = await supabase.from('plans')
    .update({ plan_json: updated, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
  if (error) { console.error('update failed:', error.message); process.exit(1) }
  console.log(`Removed ${removed} maintenance weeks (${before} -> ${trimmed.length}). Reset transition-seen. Reload the app to regenerate.`)
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
