import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { generateRulePlan, applyRecalibration } from '../lib/plan/ruleEngine'
import { validatePlan } from '../lib/plan/invariants'
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] ??= m[2].trim()
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const count = (p: any, gi: any, code: string) => validatePlan(p, gi).filter((v: any) => v.code === code).length
async function main() {
  const { data } = await sb.from('plans').select('id, plan_json')
  const SIZE = 'INV-PLAN-STEP-PACE-FROM-GUIDE'
  const HDR  = 'INV-PLAN-HEADER-PACE-MATCHES-WORK'
  console.log('--- all 32 stored plans ---')
  let hits = 0
  for (const r of data ?? []) {
    const p: any = r.plan_json; const gi = p?.meta?.generator_input
    if (!p?.weeks || !gi) continue
    const sz = count(p, gi, SIZE), hd = count(p, gi, HDR)
    if (sz || hd) { console.log(`${String(r.id).slice(0,8)}  SIZE=${sz}  HEADER=${hd}`); hits++ }
  }
  if (!hits) console.log('(none)')

  const gi = (data ?? []).find(x => String(x.id).startsWith('c5d3ae8b'))!.plan_json.meta.generator_input
  const bm: any = { type: 'race', distance_km: 5, time: '0:26:00' }
  const fixed = applyRecalibration(generateRulePlan(gi, 'paid'), bm, 1)
  console.log(`\nafter the FIXED recalibration: SIZE=${count(fixed, gi, SIZE)}  HEADER=${count(fixed, gi, HDR)}`)
  for (const v of validatePlan(fixed, gi).filter((x: any) => x.code === SIZE)) console.log('   ', v.message)
}
main()
