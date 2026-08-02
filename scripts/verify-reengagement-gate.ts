// Read-only verification for MAINT-07: evaluate the §75 Phase 3 window and the
// CA-03 ladder gate against the LIVE plan — which was generated before the
// `reengagement` marker existed, so this exercises the derived fallback path in
// `isReengagementWeek`, i.e. the code that actually runs for existing users.
//
// Run: npx tsx scripts/verify-reengagement-gate.ts
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { isReengagementWeek } from '../lib/plan/maintenance'
import { getCurrentWeekIndex } from '../lib/plan'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const EMAIL = 'russell.j.shear@gmail.com'

async function main() {
  const { data: users } = await supabase.auth.admin.listUsers()
  const user = users.users.find(u => u.email === EMAIL)
  if (!user) { console.log('NO USER for', EMAIL); return }

  const { data: planRow } = await supabase.from('plans').select('plan_json').eq('user_id', user.id).maybeSingle()
  const plan: any = planRow?.plan_json
  if (!plan) { console.log('NO PLAN ROW'); return }

  const isMaintenancePlan = plan.meta?.plan_kind === 'maintenance'
  const transitionSeen    = !!plan.meta?.maintenance_transition_seen
  const curIdx            = getCurrentWeekIndex(plan.weeks)
  const curWeek           = plan.weeks[curIdx]

  console.log('plan_kind:', plan.meta?.plan_kind, '| name:', plan.meta?.race_name ?? plan.meta?.plan_name)
  console.log('transition_seen:', transitionSeen)
  console.log('current week index:', curIdx, '→ W' + curWeek?.n, `(${curWeek?.phase})`)
  console.log('\n--- weeks: marker | derived | theme ---')
  for (const w of plan.weeks) {
    const derived = isReengagementWeek(w, plan.weeks)
    const mark = w.reengagement === true ? 'marked' : '  —   '
    console.log(
      `${w.n === curWeek?.n ? '▶' : ' '} W${String(w.n).padEnd(3)} | ${mark} | ${derived ? 'PHASE 3' : '   ·   '} | ${w.theme}`,
    )
  }

  const inReengagement  = !!(isMaintenancePlan && isReengagementWeek(curWeek, plan.weeks))
  const showTransition  = !!(isMaintenancePlan && !transitionSeen)
  const nextGoalGateOpen = !isMaintenancePlan || (!showTransition && inReengagement)

  console.log('\n--- Today screen right now ---')
  console.log('transition announcement card:', showTransition ? 'SHOWN' : 'hidden')
  console.log('ongoing maintenance card:    ', (isMaintenancePlan && transitionSeen) ? 'SHOWN' : 'hidden',
              inReengagement ? '(Phase 3 register)' : '(quiet register)')
  console.log('CA-03 goal ladder:           ', nextGoalGateOpen ? 'SHOWN' : 'HIDDEN')
  console.log('\nmaintenance card line:', curWeek?.theme || 'Base running.')
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
