// Read-only: what did the athlete ACTUALLY run? Derive cadence from completions.
// Run: npx tsx scripts/inspect-completions.ts
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const EMAIL = 'russell.j.shear@gmail.com'
const RUN = new Set(['easy', 'long', 'quality', 'tempo', 'intervals', 'hard', 'recovery', 'run'])

async function main() {
  const { data: users } = await supabase.auth.admin.listUsers()
  const user = users.users.find(u => u.email === EMAIL)!
  const { data: planRow } = await supabase.from('plans').select('plan_json').eq('user_id', user.id).maybeSingle()
  const plan: any = planRow!.plan_json
  const { data: comps } = await supabase.from('session_completions')
    .select('week_n, session_day, status').eq('user_id', user.id)
  console.log('total completion rows:', comps?.length ?? 0)

  // Map week_n → sessions (n is 1-based in plan.weeks order)
  const weekByN: Record<number, any> = {}
  plan.weeks.forEach((w: any, i: number) => { weekByN[i + 1] = w })

  // For each COMPLETED run session, tally by day-of-week and by week.
  const dayTally: Record<string, number> = {}
  const perWeekRuns: Record<number, number> = {}
  let completedRuns = 0
  for (const c of comps ?? []) {
    if (c.status !== 'complete') continue
    const wk = weekByN[c.week_n]
    if (!wk) continue
    const sess = (wk.sessions ?? {})[c.session_day]
    if (sess && RUN.has(sess.type)) {
      completedRuns++
      dayTally[c.session_day] = (dayTally[c.session_day] ?? 0) + 1
      perWeekRuns[c.week_n] = (perWeekRuns[c.week_n] ?? 0) + 1
    }
  }
  console.log('completed RUN sessions:', completedRuns)
  console.log('by day-of-week:', JSON.stringify(dayTally))
  const counts = Object.values(perWeekRuns).sort((a, b) => a - b)
  console.log('runs/week (completed) across', counts.length, 'weeks:', JSON.stringify(counts))
  if (counts.length) {
    const lowerMed = counts[Math.floor((counts.length - 1) / 2)]
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length
    console.log('lower-median runs/week:', lowerMed, '| mean:', mean.toFixed(2))
  }
  // Recent window: last 8 trained weeks before the race (W25)
  const recent = Object.entries(perWeekRuns).map(([n, c]) => [Number(n), c] as [number, number])
    .filter(([n]) => n <= 25).sort((a, b) => a[0] - b[0]).slice(-8)
  console.log('recent 8 trained weeks (n:runs):', JSON.stringify(recent))
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
