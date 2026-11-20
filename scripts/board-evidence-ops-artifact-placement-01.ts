// OPS-ARTIFACT-PLACEMENT-01 (SLT 2026-11-20) — READ-ONLY: who pressed share and when; when scored reports are generated. Selects only.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
const env = readFileSync('/Users/russe/rts-training-hub/.env.local', 'utf8')
const g = (k: string) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim() ?? ''
const sb = createClient(g('NEXT_PUBLIC_SUPABASE_URL'), g('SUPABASE_SERVICE_ROLE_KEY'))
async function main() {
  const { data: ev } = await sb.from('analytics_events').select('user_id, event, created_at, props').in('event', ['share_week_pressed','share_week_result']).order('created_at')
  const { data: s } = await sb.from('user_settings').select('id, is_admin, is_internal')
  const { data: m } = await sb.from('v_metric_users').select('user_id')
  const ms = new Set((m??[]).map((r:any)=>r.user_id))
  const ids = Array.from(new Set((ev??[]).map((e:any)=>e.user_id)))
  ids.forEach((u,i)=>{ const st:any=(s??[]).find((x:any)=>x.id===u); console.log(`user#${i} admin=${st?.is_admin} internal=${st?.is_internal} metric=${ms.has(u)}`) })
  for (const e of ev??[]) console.log(`user#${ids.indexOf(e.user_id)} ${e.event} ${e.created_at} ${JSON.stringify(e.props)}`)
  const { data: r } = await sb.from('weekly_reports').select('generated_at').is('superseded_at', null).not('zone_discipline_score','is',null)
  console.log('scored generated_at:', (r??[]).map((x:any)=>x.generated_at).sort().join(' '))
  const { data: all } = await sb.from('weekly_reports').select('generated_at').is('superseded_at', null).gte('generated_at','2026-10-20')
  const dow: Record<string,number> = {}; for (const x of all??[]) { const d=new Date((x as any).generated_at); const k=`${d.getUTCDay()}@${d.getUTCHours()}h`; dow[k]=(dow[k]??0)+1 }
  console.log('unsuperseded reports since 10-20 by UTC weekday@hour:', JSON.stringify(dow))
}
main()

// ── Null-score check: does a null-score report's (user, week_n) have analysed HR in run_analysis? ──
async function nullScore() {
  const { data: reps } = await sb.from('weekly_reports').select('user_id, week_n, zone_discipline_score, generated_at').is('superseded_at', null)
  const { data: ra } = await sb.from('run_analysis').select('user_id, week_n, hr_in_zone_pct, created_at').is('superseded_at', null)
  let nul = 0, nulWithHr = 0, nulWithRa = 0, nulHrAfterGen = 0
  for (const r of reps ?? []) {
    if ((r as any).zone_discipline_score != null) continue
    nul++
    const rows = (ra ?? []).filter((a: any) => a.user_id === (r as any).user_id && a.week_n === (r as any).week_n)
    if (rows.length) nulWithRa++
    const hr = rows.filter((a: any) => a.hr_in_zone_pct != null)
    if (hr.length) nulWithHr++
    if (hr.some((a: any) => a.created_at > (r as any).generated_at)) nulHrAfterGen++
  }
  console.log(`null-score reports: ${nul}; with ≥1 run_analysis row same week: ${nulWithRa}; with ≥1 analysed-HR row same week: ${nulWithHr}; of which HR row created AFTER report generated: ${nulHrAfterGen}`)
}
nullScore()
