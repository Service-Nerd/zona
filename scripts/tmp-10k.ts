import { generateRulePlan } from '../lib/plan/ruleEngine'
const TANAKA = Math.round(208 - 0.7 * 35)
let plans=0, threw=0, withRepeat=0, maxRepeat=0
const counts: Record<string, number> = {}
const firstErr: string[] = []
for (const cwk of [25,35,45,55]) for (const lvl of ['intermediate','advanced'])
for (const days of [{days_available:4,days_cannot_train:[]},{days_available:5,days_cannot_train:['tue']},{days_available:6,days_cannot_train:[]}])
for (const weeks of [10,12,14,16]) {
  try {
    const p:any = generateRulePlan({
      athlete_name:'A',age:35,race_name:'T',primary_metric:'distance',plan_start:'2026-04-27',
      race_distance_km:10,
      race_date:new Date(new Date('2026-04-27T00:00:00Z').getTime()+weeks*7*86400000).toISOString().slice(0,10),
      goal:'time_target', target_time:'0:45:00',
      resting_hr:55, max_hr:TANAKA,
      current_weekly_km:cwk,longest_recent_run_km:Math.round(cwk*0.4),
      fitness_level:lvl,recent_quality_training:'regular',
      hard_session_relationship:'regularly',injury_history:[],max_weekday_mins:90,...days,
    } as any,'trial','2026-04-27',undefined,'2026-04-27')
    plans++
    const seen: Record<string, number> = {}
    for (const w of p.weeks) for (const s of Object.values(w.sessions) as any[]) {
      if (!s?.catalogue_id) continue
      seen[s.catalogue_id] = (seen[s.catalogue_id] ?? 0) + 1
      counts[s.catalogue_id] = (counts[s.catalogue_id] ?? 0) + 1
    }
    const t = seen['tenk_pace_intervals'] ?? 0
    if (t > 1) withRepeat++
    if (t > maxRepeat) maxRepeat = t
  } catch (e:any) { threw++; if (firstErr.length<2) firstErr.push(e.message.split('\n')[0]) }
}
console.log(`generated ${plans}, threw ${threw}`)
firstErr.forEach(e=>console.log('  err:', e))
if (!plans) { console.log('NOTHING GENERATED — do not read any percentage below.'); process.exit(1) }
console.log(`plans reusing tenk_pace_intervals more than once: ${withRepeat} (${(withRepeat/plans*100).toFixed(0)}%)`)
console.log(`most times one plan used it: ${maxRepeat}`)
console.log(`race-specific usage:`)
for (const id of ['tenk_pace_intervals','goal_pace_sharpener'])
  console.log(`  ${id.padEnd(22)} ${counts[id] ?? 0} placements across ${plans} plans`)
const top = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8)
console.log(`top catalogue rows overall:`); top.forEach(([k,v])=>console.log(`  ${k.padEnd(26)} ${v}`))
