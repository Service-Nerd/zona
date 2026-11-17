// board-evidence-hr-follower.ts — the measurement behind ADR-026 condition 4
// (Willy's re-opened condition), Coaching Board sitting 2026-11-17.
//
// READ-ONLY against production (`wkppmpsvqkaxbekdgzdm`). SELECT and print only.
//
// 🔴 WILLY'S CONDITION, VERBATIM: "this change makes the session harder only for the
// runners who were obeying the heart rate." The ADR records the denominator as
// "unknown and unknowable until the completion join lands". **That is wrong about the
// instrument, and right about the sample size — and the two are worth separating.**
//
// ⚠️ THE ADR'S OWN 29-RUN SAMPLE CANNOT CONTAIN AN HR-FOLLOWER, BY CONSTRUCTION.
// It is selected as "runs whose average pace falls inside the prescribed threshold
// band". An HR-follower holds the prescribed HR and therefore runs SLOWER than the
// prescribed pace — so selecting on pace excludes exactly the cohort the condition
// asks about. The 13-bpm overshoot is a measurement of pace-followers only.
//
// The signature is a CONFLICT, not a join. Each runner's plan prescribes a threshold
// pace band and a threshold HR band. Where the two cannot both be satisfied, which one
// a run honoured is observable from the run alone:
//
//   PACE-HONOURED  pace at or inside the band, HR above the prescribed ceiling
//   HR-HONOURED    HR inside the prescribed band, pace slower than the band
//   BOTH           inside both — the old band was achievable at the prescribed pace
//   NEITHER        below both (an easy run, or a quality session undershot)
//
// ⚠️ No run is claimed to BE a threshold session: there is no reliable join (ADR-026 §6,
// 10 quality sessions ever completed, 1 device-backed). This asks the weaker and
// answerable question — across every working run, which of the two numbers does this
// population's behaviour track? That is the denominator Willy asked for.
import { createClient } from '@supabase/supabase-js'
import { getSessionsForDate } from '../lib/plan/weekResolution'
import { readFileSync } from 'node:fs'
const env = readFileSync('/Users/russe/rts-training-hub/.env.local', 'utf8')
const g = (k: string) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim() ?? ''
const sb = createClient(g('NEXT_PUBLIC_SUPABASE_URL'), g('SUPABASE_SERVICE_ROLE_KEY'))

const THRESHOLD_IDS = new Set(['tempo_continuous','progressive_tempo','tempo_cruise','tempo_cruise_short','threshold_ladder','tempo_over_under','threshold_mile_repeats','threshold_pyramid'])

// "144–158" / "144-158 bpm" → [144,158]; a single number → null (not a range)
function band(s: unknown): [number, number] | null {
  const m = String(s ?? '').match(/(\d{2,3})\s*[–-]\s*(\d{2,3})/)
  return m ? [Number(m[1]), Number(m[2])] : null
}
// "5:07–5:22 /km" → [307,322] seconds per km
function paceBand(s: unknown): [number, number] | null {
  const m = String(s ?? '').match(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/)
  return m ? [Number(m[1]) * 60 + Number(m[2]), Number(m[3]) * 60 + Number(m[4])] : null
}

async function main() {
  const { data: plans } = await sb.from('plans').select('user_id, plan_json')
  const { data: acts } = await sb.from('strava_activities')
    .select('user_id, start_date, activity_type, sport_type, distance_m, moving_time_s, avg_hr, max_hr, hr_pct_z3, hr_pct_z4_5, source')
  const { data: settings } = await sb.from('user_settings').select('id, max_hr, resting_hr, max_hr_source')

  console.log(`plans: ${plans?.length}  activities: ${acts?.length}  settings: ${settings?.length}`)

  // ── each runner's PRESCRIBED threshold bands, read off their own live plan ──
  const presc = new Map<string, { hr: [number,number]; pace: [number,number]; n: number; ids: Set<string>; easyPace?: number; easyHrTop?: number }>()
  for (const p of plans ?? []) {
    for (const w of ((p.plan_json as any)?.weeks ?? [])) {
      for (const s of Object.values(w.sessions ?? {}) as any[]) {
        if (!s?.catalogue_id || !THRESHOLD_IDS.has(s.catalogue_id)) continue
        const h = band(s.hr_target), pc = paceBand(s.pace_target)
        if (!h || !pc) continue
        const cur = presc.get(p.user_id)
        if (!cur) presc.set(p.user_id, { hr: h, pace: pc, n: 1, ids: new Set([s.catalogue_id]) })
        else { cur.n++; cur.ids.add(s.catalogue_id) }
      }
    }
  }
  // the SAME runner's prescribed EASY ceiling, from their own plan's easy sessions.
  // 🔴 This is what tells cell B apart. `z2Top` IS `z3Low` (ADR-026 §7), so an easy run
  // held correctly at the top of Z2 lands INSIDE the prescribed threshold band — and
  // without the easy numbers cell B reads as "HR-follower attempting threshold" when
  // most of it is "ordinary easy running that satisfies the threshold prescription".
  for (const p of plans ?? []) {
    const v = presc.get(p.user_id as string); if (!v) continue
    for (const w of ((p.plan_json as any)?.weeks ?? [])) {
      for (const s of Object.values(w.sessions ?? {}) as any[]) {
        if (s?.type !== 'easy' && s?.type !== 'recovery') continue
        const h = band(s.hr_target), pc = paceBand(s.pace_target)
        if (h && v.easyHrTop == null) v.easyHrTop = h[1]
        if (pc && v.easyPace == null) v.easyPace = pc[1]   // slow end of the easy band
      }
    }
  }

  console.log(`\nrunners whose live plan prescribes a threshold session with BOTH a range HR target and a pace band: ${presc.size}`)
  for (const [u, v] of Array.from(presc)) console.log(`  ${u.slice(0,8)}  HR ${v.hr[0]}–${v.hr[1]}  pace ${Math.floor(v.pace[0]/60)}:${String(v.pace[0]%60).padStart(2,'0')}–${Math.floor(v.pace[1]/60)}:${String(v.pace[1]%60).padStart(2,'0')}/km  (${v.n} sessions, ${Array.from(v.ids).join(',')})  easy ceiling hr=${v.easyHrTop ?? '—'} pace=${v.easyPace ? Math.floor(v.easyPace/60)+':'+String(v.easyPace%60).padStart(2,'0') : '—'}`)

  // ── classify every working run of those runners ──
  let A = 0, B = 0, C = 0, D = 0, skipped = 0, Beasy = 0, Bmid = 0
  const bRows: string[] = [], aRows: string[] = []
  const perUser = new Map<string, {a:number;b:number;c:number;d:number}>()
  for (const a of acts ?? []) {
    const v = presc.get(a.user_id as string)
    if (!v) { skipped++; continue }
    const type = String(a.activity_type ?? a.sport_type ?? '').toLowerCase()
    if (type && !/run/.test(type)) { skipped++; continue }
    const d = Number(a.distance_m ?? 0), t = Number(a.moving_time_s ?? 0), hr = Number(a.avg_hr ?? 0)
    if (!(d >= 3000) || !(t > 0) || !(hr > 0)) { skipped++; continue }
    const pace = t / (d / 1000)
    const paceIn  = pace <= v.pace[1]          // at or faster than the SLOW end of the band
    const hrIn    = hr >= v.hr[0] && hr <= v.hr[1]
    const hrAbove = hr > v.hr[1]
    const pu = perUser.get(a.user_id as string) ?? {a:0,b:0,c:0,d:0}
    const fmt = `${String(a.user_id).slice(0,8)} ${String(a.start_date).slice(0,10)} ${(d/1000).toFixed(1)}km ${Math.floor(pace/60)}:${String(Math.round(pace%60)).padStart(2,'0')}/km hr=${hr} band=${v.hr[0]}-${v.hr[1]} src=${a.source}`
    if (paceIn && hrAbove)        { A++; pu.a++; if (aRows.length < 8) aRows.push(fmt) }
    else if (hrIn && !paceIn)     { B++; pu.b++
      if (v.easyPace != null && pace >= v.easyPace) Beasy++
      else Bmid++
      if (bRows.length < 12) bRows.push(`${fmt} easyPaceSlowEnd=${v.easyPace ?? '—'} thisPace=${Math.round(pace)}`) }
    else if (paceIn && hrIn)      { C++; pu.c++ }
    else                          { D++; pu.d++ }
    perUser.set(a.user_id as string, pu)
  }

  console.log(`\n── WILLY'S DENOMINATOR — every working run (≥3 km, HR present) of those runners ──`)
  const tot = A + B + C + D
  const pc = (n: number) => tot ? `${(100*n/tot).toFixed(1)}%` : '—'
  console.log(`  PACE-HONOURED (pace in band, HR over the ceiling) : ${A}  ${pc(A)}   ← the ADR's cohort`)
  console.log(`  HR-HONOURED   (HR in band, pace slower than band) : ${B}  ${pc(B)}   ← WILLY'S COHORT, and it SPLITS`)
  console.log(`      of which at or slower than their own EASY pace  : ${Beasy}  (${B?(100*Beasy/B).toFixed(1):'—'}% of B) ← an EASY run that satisfies the THRESHOLD prescription`)
  console.log(`      of which between easy and threshold pace        : ${Bmid}  (${B?(100*Bmid/B).toFixed(1):'—'}% of B) ← genuinely working, holding the HR number`)
  console.log(`  BOTH          (inside both)                       : ${C}  ${pc(C)}`)
  console.log(`  NEITHER       (under both)                        : ${D}  ${pc(D)}`)
  console.log(`  total classified ${tot}; skipped ${skipped} (no prescription, not a run, <3 km, or no HR)`)
  console.log(`\n  per runner (a=pace b=HR c=both d=neither):`)
  for (const [u, p] of Array.from(perUser)) console.log(`    ${u.slice(0,8)}  a=${p.a} b=${p.b} c=${p.c} d=${p.d}`)
  console.log(`\n  sample PACE-HONOURED runs:`); aRows.forEach(r => console.log(`    ${r}`))
  console.log(`\n  sample HR-HONOURED runs:`);   bRows.forEach(r => console.log(`    ${r}`))

  // ── the harm question: for an HR-honouring run, how much more is being asked? ──
  // The new floor is the OLD CEILING + the measured gap. Report the delta each
  // HR-honoured run would face, from its own observed HR to the new floor.
  console.log(`\n── if the band moves, what is asked of an HR-honouring run ──`)
  console.log(`  (new floor is reported per runner from ADR-026's table; here: the observed HR of each`)
  console.log(`   HR-honoured run against its own prescribed ceiling, which the new FLOOR sits above)`)
  let deltaSum = 0, deltaN = 0
  for (const a of acts ?? []) {
    const v = presc.get(a.user_id as string); if (!v) continue
    const d = Number(a.distance_m ?? 0), t = Number(a.moving_time_s ?? 0), hr = Number(a.avg_hr ?? 0)
    if (!(d >= 3000) || !(t > 0) || !(hr > 0)) continue
    const pace = t / (d / 1000)
    if (!(hr >= v.hr[0] && hr <= v.hr[1] && pace > v.pace[1])) continue
    deltaSum += v.hr[1] - hr; deltaN++
  }
  console.log(`  HR-honoured runs: ${deltaN}; mean distance below their own prescribed ceiling: ${deltaN ? (deltaSum/deltaN).toFixed(1) : '—'} bpm`)

  // ── (3) THE DISCRIMINATOR — was a threshold session actually PRESCRIBED that day? ──
  // 🔴 Cell B cannot, on its own, tell "threshold session, HR obeyed, pace missed" from
  // "easy run drifted into the grey zone". Both are runs whose HR satisfies the
  // prescribed threshold band while the pace does not, and for the BAND question that
  // is the same fact. For WILLY'S HARM question it is the whole question.
  //
  // 🔑 There IS a join, and it is not the one ADR-026 §6 looked for. Not an activity id
  // — a CALENDAR DATE. `meta.plan_start` and `week.date` are both stored, and
  // `getSessionsForDate` (ADR-016's canonical resolver, overrides applied) is the single
  // owner of "what did this plan prescribe on day D". A run on a day the plan prescribed
  // threshold work is an attempt at that session; a run on an easy day is not.
  const { data: ovr } = await sb.from('session_overrides').select('user_id, week_n, from_day, to_day, kind, superseded_at')
  const planByUser = new Map<string, any>()
  for (const p of plans ?? []) planByUser.set(p.user_id as string, (p.plan_json as any))
  let onThresholdDay = 0, onOtherDay = 0, offPlan = 0
  const onRows: string[] = []
  for (const a of acts ?? []) {
    const v = presc.get(a.user_id as string); if (!v) continue
    const d = Number(a.distance_m ?? 0), t = Number(a.moving_time_s ?? 0), hr = Number(a.avg_hr ?? 0)
    if (!(d >= 3000) || !(t > 0) || !(hr > 0)) continue
    const pace = t / (d / 1000)
    if (!(hr >= v.hr[0] && hr <= v.hr[1] && pace > v.pace[1])) continue   // cell B only
    const plan = planByUser.get(a.user_id as string); if (!plan) { offPlan++; continue }
    const ymd = String(a.start_date).slice(0, 10).split('-').map(Number)
    const local = new Date(ymd[0], ymd[1] - 1, ymd[2])
    const os = (ovr ?? []).filter(o => o.user_id === a.user_id && !o.superseded_at) as any[]
    const resolved = getSessionsForDate(plan.weeks ?? [], local, os)
    if (!resolved.length) { offPlan++; continue }
    const isThresh = resolved.some(r => r.session?.catalogue_id && THRESHOLD_IDS.has(r.session.catalogue_id))
    if (isThresh) { onThresholdDay++
      if (onRows.length < 10) onRows.push(`${String(a.user_id).slice(0,8)} ${String(a.start_date).slice(0,10)} ${(d/1000).toFixed(1)}km ${Math.floor(pace/60)}:${String(Math.round(pace%60)).padStart(2,'0')}/km hr=${hr} band=${v.hr[0]}-${v.hr[1]} prescribed=${resolved.map(r=>r.session?.catalogue_id ?? r.session?.type).join(',')}`) }
    else onOtherDay++
  }
  console.log(`\n── (3) of the ${B} HR-HONOURED runs, what did the plan prescribe that day? ──`)
  console.log(`  on a day the plan prescribed THRESHOLD work : ${onThresholdDay}  ← an obeyed threshold session: WILLY'S REAL COHORT`)
  console.log(`  on a day it prescribed something else       : ${onOtherDay}  ← a run drifted into the grey zone, which the band CERTIFIES`)
  console.log(`  outside every plan week / no session        : ${offPlan}`)
  console.log(`\n  the obeyed-threshold runs:`); onRows.forEach(r => console.log(`    ${r}`))

  // ⚠️ THE DISCRIMINATOR'S OWN POPULATION, because "2 runs" without this is a number
  // with no denominator. The activity log spans 2026-04 → 2026-11; a live plan covers a
  // window inside that, and a regenerated plan abandons the weeks before it. So a date
  // join can only speak about runs that fall inside the CURRENT plan's window.
  let inWindow = 0, outWindow = 0
  for (const a of acts ?? []) {
    const v = presc.get(a.user_id as string); if (!v) continue
    const d = Number(a.distance_m ?? 0), t = Number(a.moving_time_s ?? 0), hr = Number(a.avg_hr ?? 0)
    if (!(d >= 3000) || !(t > 0) || !(hr > 0)) continue
    const plan = planByUser.get(a.user_id as string)
    const ymd = String(a.start_date).slice(0, 10).split('-').map(Number)
    const os = (ovr ?? []).filter(o => o.user_id === a.user_id && !o.superseded_at) as any[]
    if (plan && getSessionsForDate(plan.weeks ?? [], new Date(ymd[0], ymd[1]-1, ymd[2]), os).length) inWindow++
    else outWindow++
  }
  console.log(`\n  ⚠️ the date join's reach: of ${A+B+C+D} classified runs, ${inWindow} fall on a day the current plan`)
  console.log(`     prescribes a session and ${outWindow} do not (before the plan, after it, or a rest day).`)
  console.log(`     ⚠️ So the ${onThresholdDay} figure is bounded by ${inWindow}, not by ${A+B+C+D}.`)

  // how many threshold DAYS has any runner ever had a run on, obeyed or not?
  let threshDayRuns = 0
  for (const a of acts ?? []) {
    const v = presc.get(a.user_id as string); if (!v) continue
    const d = Number(a.distance_m ?? 0), t = Number(a.moving_time_s ?? 0)
    if (!(d >= 3000) || !(t > 0)) continue
    const plan = planByUser.get(a.user_id as string); if (!plan) continue
    const ymd = String(a.start_date).slice(0, 10).split('-').map(Number)
    const os = (ovr ?? []).filter(o => o.user_id === a.user_id && !o.superseded_at) as any[]
    const r = getSessionsForDate(plan.weeks ?? [], new Date(ymd[0], ymd[1]-1, ymd[2]), os)
    if (r.some(x => x.session?.catalogue_id && THRESHOLD_IDS.has(x.session.catalogue_id))) threshDayRuns++
  }
  console.log(`     🔑 runs of ANY kind landing on a prescribed-threshold day, HR or not: ${threshDayRuns}.`)
  console.log(`        That is the true ceiling on this question, and it is why no code change raises it.`)

  // ── (4) 🔴 CAN THE NEW BAND EVEN BE DERIVED? The precondition ADR-026 never states.
  // The band comes from the anchor through %HRR ≈ %VO2R. %HRR needs an HR RESERVE,
  // so a runner with no resting HR has no reserve and no conversion; and the anchor
  // itself is a fraction of VO2max, so it needs a VDOT. ADR-026 §4's three worked
  // personas all carry BOTH. This counts the live plans that do.
  let karv = 0, pctMax = 0, noMax = 0, both = 0, threshSessAll = 0, threshSessDerivable = 0
  const blocked: string[] = []
  for (const p of plans ?? []) {
    const m = (p.plan_json as any)?.meta ?? {}
    const rhrOk = typeof m.resting_hr === 'number' && Number.isFinite(m.resting_hr) && m.resting_hr > 0
    const mhrOk = typeof m.max_hr === 'number' && m.max_hr > 0
    const vdotOk = typeof m.vdot === 'number' && m.vdot > 0
    if (!mhrOk) noMax++; else if (rhrOk) karv++; else pctMax++
    const derivable = mhrOk && rhrOk && vdotOk
    if (derivable) both++
    let n = 0
    for (const w of ((p.plan_json as any)?.weeks ?? [])) for (const sess of Object.values(w.sessions ?? {}) as any[]) {
      if (sess?.catalogue_id && THRESHOLD_IDS.has(sess.catalogue_id) && typeof sess.hr_target === 'string') n++
    }
    threshSessAll += n
    if (derivable) threshSessDerivable += n
    else if (n) blocked.push(`    ${String(p.user_id).slice(0,8)} ${n} threshold sessions — max=${m.max_hr ?? '—'} rest=${m.resting_hr ?? '—'} vdot=${m.vdot ?? '—'} (${!mhrOk ? 'NO MAX' : !rhrOk ? 'no resting HR → no HR reserve → no %HRR conversion' : 'no VDOT → no T anchor'})`)
  }
  console.log(`\n── (4) CAN THE ANCHOR-DERIVED BAND BE COMPUTED? live plans ──`)
  console.log(`  Karvonen (resting HR > 0): ${karv}   %MaxHR (no resting HR): ${pctMax}   no max HR at all: ${noMax}   of ${plans?.length}`)
  console.log(`  plans with max + resting + VDOT — the ONLY ones a T-anchored band can be derived for: ${both}`)
  console.log(`  threshold sessions carrying an hr_target, live: ${threshSessAll}`)
  console.log(`  ...of which the new band is DERIVABLE for: ${threshSessDerivable}  (${threshSessAll?(100*threshSessDerivable/threshSessAll).toFixed(1):'—'}%)`)
  console.log(`  ...and NOT derivable for: ${threshSessAll - threshSessDerivable}  ← these keep today's band, so the`)
  console.log(`     floor-equals-the-easy-ceiling incoherence SURVIVES for them`)
  console.log(`\n  plans with threshold work that CANNOT take the new band:`)
  blocked.forEach(b => console.log(b))

  // ── provenance: can these runners' HR be trusted at all? ──
  const srcs: Record<string, number> = {}
  for (const s of settings ?? []) if (presc.has(s.id as string)) srcs[String(s.max_hr_source ?? 'null')] = (srcs[String(s.max_hr_source ?? 'null')] ?? 0) + 1
  console.log(`\n  max_hr_source among those runners:`, srcs)
}
main()
