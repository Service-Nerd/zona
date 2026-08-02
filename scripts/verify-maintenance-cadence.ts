// DRY-RUN (no DB write): feed the founder's real plan + completions through the
// NEW cadence + generator and print the maintenance days, to confirm the fix
// yields tue/fri/sat/sun before committing. Run: npx tsx scripts/verify-maintenance-cadence.ts
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { inferActualRunCadence, inferRunDaysPerWeek, generateMaintenanceBlock } from '../lib/plan/maintenance'
import { GENERATION_CONFIG } from '../lib/plan/generationConfig'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const EMAIL = 'russell.j.shear@gmail.com'
const mCfg = GENERATION_CONFIG.POST_RACE_MAINTENANCE_BLOCK

async function main() {
  const { data: users } = await supabase.auth.admin.listUsers()
  const user = users.users.find(u => u.email === EMAIL)!
  const { data: planRow } = await supabase.from('plans').select('plan_json').eq('user_id', user.id).maybeSingle()
  const plan: any = planRow!.plan_json
  const { data: completions } = await supabase.from('session_completions')
    .select('rpe, fatigue_tag, week_n, session_day, status').eq('user_id', user.id)

  const nonMaint = plan.weeks.filter((w: any) => w.phase !== 'maintenance_restoration' && w.phase !== 'maintenance_base')
  const actual = inferActualRunCadence(nonMaint, completions ?? [], mCfg.ACTUAL_CADENCE_MIN_COMPLETED_RUNS)
  const runDays = actual?.daysPerWeek ?? inferRunDaysPerWeek(nonMaint) ?? plan.meta.days_available ?? 4
  console.log('inferActualRunCadence:', JSON.stringify(actual))
  console.log('inferRunDaysPerWeek (plan-prescribed fallback):', inferRunDaysPerWeek(nonMaint))
  console.log('resolved daysAvailable:', runDays)

  const lastRaceIdx = nonMaint.reduce((acc: number, w: any, i: number) => (w.type === 'race' || w.badge === 'race') ? i : acc, -1)
  const lastRaceWeek = nonMaint[lastRaceIdx]
  const baseWeeks = nonMaint.filter((w: any) => w.phase === 'base' && w.type !== 'deload' && (w.weekly_km ?? 0) > 0)
  const baseSource = baseWeeks.length ? baseWeeks : nonMaint.filter((w: any) => (w.weekly_km ?? 0) > 0)
  const baseVols = baseSource.map((w: any) => w.weekly_km ?? 0).sort((a: number, b: number) => a - b)
  const baseWeeklyKm = Math.max(baseVols[Math.floor(baseVols.length / 2)] ?? 0, mCfg.MIN_BASE_KM_FLOOR)

  const weeks = generateMaintenanceBlock({
    raceResult: lastRaceWeek.result_embedded,
    lastRaceWeek,
    baseWeeklyKm,
    raceDistanceKm: plan.meta.race_distance_km,
    daysAvailable: runDays,
    trainingDays: actual?.dayKeys,
    intent: lastRaceWeek.result_embedded?.maintenance_intent ?? 'tick_over',
  })
  console.log('\n--- NEW maintenance block (dry-run) ---')
  for (const w of weeks) {
    const runs = Object.entries(w.sessions ?? {}).filter(([, s]: any) => s && s.type !== 'rest').map(([d]) => d)
    console.log(`${w.label} | ${w.phase} | ${w.weekly_km}km | run days: ${runs.join(',')}`)
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
