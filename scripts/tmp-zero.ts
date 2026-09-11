import { generateRulePlan } from '../lib/plan/ruleEngine'
import { validatePlan } from '../lib/plan/invariants'
// Can the engine actually build a plan for someone who has never run?
const cases = [
  { lbl:'lr=0, cwk=5',  cwk:5, lr:0 },
  { lbl:'lr=0, cwk=0',  cwk:0, lr:0 },
  { lbl:'lr=2, cwk=0',  cwk:0, lr:2 },
]
for (const c of cases) for (const km of [10, 42.2]) {
  const input:any={athlete_name:'A',age:38,race_name:'C',primary_metric:'distance',plan_start:'2026-04-27',
    race_distance_km:km,race_date:'2026-10-05',goal:'finish',
    current_weekly_km:c.cwk,longest_recent_run_km:c.lr,fitness_level:'beginner',
    recent_quality_training:'none',hard_session_relationship:'avoid',injury_history:[],
    days_available:4,days_cannot_train:[]}
  try{
    const p:any=generateRulePlan(input,'paid','2026-04-27',undefined,'2026-04-27')
    const wk1=p.weeks.find((w:any)=>w.n===1)
    const km1=wk1?Object.values(wk1.sessions).reduce((a:number,s:any)=>a+(s?.distance_km??0),0):0
    const peak=Math.max(...p.weeks.filter((w:any)=>w.n>=1).map((w:any)=>Object.values(w.sessions).reduce((a:number,s:any)=>a+(s?.distance_km??0),0)))
    const errs=validatePlan(p,input).filter(v=>v.severity==='error')
    const bad=[km1,peak].some(n=>!Number.isFinite(n)||Number.isNaN(n))
    console.log(`${String(km).padStart(5)}km ${c.lbl.padEnd(12)} wk1=${Math.round(km1)}km peak=${Math.round(peak)}km errors=${errs.length}${bad?'  ⚠️ NaN/Infinity':''}`)
    if(errs.length) console.log(`      first: ${errs[0].code} ${errs[0].message.slice(0,90)}`)
  }catch(e:any){ console.log(`${String(km).padStart(5)}km ${c.lbl.padEnd(12)} THREW: ${e.message.split('\n')[0].slice(0,90)}`) }
}
