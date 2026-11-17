// board-evidence-intensity-ladder.ts — the measurement behind the Coaching Board
// sitting of 2026-11-16, "the four conditions on ADR-026".
//
// READ-ONLY against production (`wkppmpsvqkaxbekdgzdm`). It SELECTs and prints; it
// writes nothing, and it must stay that way — CLAUDE.md: reads from here are fine,
// a production write is refused by the sandbox and correctly so.
//
// Five sections, each answering one of the sitting's questions:
//   (2)  BEGINNER-THRESHOLD-ELIGIBILITY-01 — which beginners reach a threshold row.
//        🔴 READ `fitness_intensity_level ?? fitness_level`, which is what the
//        catalogue gate and `INV-PLAN-CATALOGUE-ELIGIBLE` read. The item that
//        prompted this sitting counted `fitness_level` — the STRUCTURAL axis — and
//        reported 13 of 25 where the answer is 4 of 16. §79 has two axes and only
//        one of them governs what a runner may be prescribed.
//   (2b) GOALPACE-UNBENCHMARKED-MARATHON-01 — §120 Am. 2 bounds goal pace only on a
//        benchmarked plan, so this counts the cohort it leaves unbounded.
//   (3)  BENCHMARK-STALENESS-CEILING-01 — the live benchmark age distribution and
//        the discount each age attracts on the current +1%/4wk ramp.
//   (4)  MAXHR-RECENCY-01 — stored max against the runner's own peak activity HR.
//        ⚠️ The activity log is NOT the provenance of an `observed` max (that comes
//        from HealthKit's own read), so it cannot date one for every runner. It is
//        used here to find a stored max the runner's own log CONTRADICTS.
//   (5)  the pace effect of each candidate staleness ceiling, through the real
//        producer `buildPaceFromVDOT`.
//
// The band ladder itself (T / CV / I per persona) is computed by the sibling block
// at the foot of this file plus `computeZones`; see the ruling register for the table.

// Coaching Board evidence — live read-only measurements for the four open items.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
const env = readFileSync('/Users/russe/rts-training-hub/.env.local', 'utf8')
const g = (k: string) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim() ?? ''
const sb = createClient(g('NEXT_PUBLIC_SUPABASE_URL'), g('SUPABASE_SERVICE_ROLE_KEY'))

async function main() {

  const { data: plans } = await sb.from('plans').select('user_id, plan_json')
  console.log(`plans: ${plans?.length}`)
  console.log('META KEYS (first plan):', Object.keys(((plans?.[0] as any)?.plan_json ?? {}).meta ?? {}).join(' '))

  const THRESHOLD_IDS = new Set(['tempo_continuous','progressive_tempo','tempo_cruise','tempo_cruise_short','threshold_ladder','tempo_over_under','threshold_mile_repeats','threshold_pyramid','cv_intervals'])

  // ── (2) BEGINNER-THRESHOLD-ELIGIBILITY-01 ───────────────────────────────────
  let begPlans = 0, begWithThreshold = 0, hasIntensityField = 0
  const begRows: Record<string, number> = {}
  const begDetail: string[] = []
  for (const p of plans ?? []) {
    const m = (p.plan_json as any)?.meta ?? {}
    // 🔴 THE LEVEL THE CATALOGUE GATE READS, not `fitness_level`. §79 has two axes and
    // `INV-PLAN-CATALOGUE-ELIGIBLE` reads `fitness_intensity_level ?? fitness_level`.
    const lvl = m.fitness_intensity_level ?? m.fitness_level
    hasIntensityField += m.fitness_intensity_level ? 1 : 0
    if (lvl !== 'beginner') continue
    begPlans++
    const ids: string[] = []
    for (const w of ((p.plan_json as any).weeks ?? [])) {
      for (const s of Object.values(w.sessions ?? {}) as any[]) {
        if (s?.catalogue_id && THRESHOLD_IDS.has(s.catalogue_id)) ids.push(s.catalogue_id)
      }
    }
    if (ids.length) {
      begWithThreshold++
      for (const i of ids) begRows[i] = (begRows[i] ?? 0) + 1
      begDetail.push(`  ${p.user_id.slice(0,8)} goal=${m.goal ?? '?'} dist=${m.race_distance_km ?? '?'}km struct=${m.fitness_level}/int=${m.fitness_intensity_level ?? '—'} vdot=${(m.vdot ?? 0).toFixed?.(1) ?? m.vdot} rows=${ids.length} [${Array.from(new Set(ids)).join(',')}]`)
    }
  }
  console.log(`\n── (2) BEGINNER threshold eligibility ──`)
  console.log(`plans carrying meta.fitness_intensity_level: ${hasIntensityField} of ${plans?.length}`)
  console.log(`beginner-INTENSITY plans: ${begPlans}; with a threshold-category session: ${begWithThreshold}`)
  console.log(`rows reached:`, begRows)
  begDetail.forEach(d => console.log(d))

  // probe: a rung-4 threshold session on a plan with no VDOT — what pace does it carry?
  console.log(`\n  probe — rung-4 threshold sessions on beginner-intensity plans with no VDOT:`)
  for (const p of plans ?? []) {
    const m = (p.plan_json as any)?.meta ?? {}
    if ((m.fitness_intensity_level ?? m.fitness_level) !== 'beginner') continue
    if (m.vdot) continue
    for (const w of ((p.plan_json as any).weeks ?? [])) {
      for (const sess of Object.values(w.sessions ?? {}) as any[]) {
        if (!sess?.catalogue_id || !THRESHOLD_IDS.has(sess.catalogue_id)) continue
        console.log(`    ${String(p.user_id).slice(0,8)} w${w.n} ${sess.catalogue_id} zone=${sess.zone} hr=${sess.hr_target} pace=${sess.pace_target}`)
        break
      }
    }
  }

  // ── (2b) §120 Am.2's named exclusion: an UNBENCHMARKED time-target runner has no
  //        reachability bound at any distance except HM (Am.1's CV comparison).
  console.log(`\n── (2b) unbenchmarked time-target plans — no §120 reachability bound ──`)
  let unbTT = 0, unbTTz45 = 0
  for (const p of plans ?? []) {
    const m = (p.plan_json as any)?.meta ?? {}
    if (m.goal !== 'time_target' || m.benchmark) continue
    unbTT++
    const hot: string[] = []
    for (const w of ((p.plan_json as any).weeks ?? [])) for (const sess of Object.values(w.sessions ?? {}) as any[]) {
      if (sess?.stimulus === 'race_pace' && /Zone 4|Zone 5/.test(String(sess.zone))) hot.push(`w${w.n} ${sess.catalogue_id ?? sess.label} ${sess.zone} ${sess.hr_target} ${sess.pace_target} ${sess.duration_mins}min`)
    }
    if (hot.length) unbTTz45++
    console.log(`  ${String(p.user_id).slice(0,8)} dist=${m.race_distance_km}km target=${m.generator_input?.target_time ?? '?'} lvl=${m.fitness_level}/${m.fitness_intensity_level ?? '—'} base=${m.generator_input?.current_weekly_km} lr=${m.generator_input?.longest_recent_run_km} → ${hot.length} goal-paced session(s) in Z4/Z5`)
    hot.slice(0,2).forEach(h => console.log(`      ${h}`))
  }
  console.log(`  TOTAL unbenchmarked time-target: ${unbTT}; with goal-paced work in Z4/Z5: ${unbTTz45}`)

  // probe: FULL session + inputs for the beginner marathoner in the interval band
  for (const p of plans ?? []) {
    if (!String(p.user_id).startsWith('c6d7e0ea') && !String(p.user_id).startsWith('b6229904')) continue
    const j = p.plan_json as any; const m = j.meta ?? {}
    console.log(`\n  probe — ${String(p.user_id).slice(0,8)} inputs:`)
    console.log('   ', JSON.stringify({ goal: m.goal, dist: m.race_distance_km, target: m.generator_input?.target_time, base: m.generator_input?.current_weekly_km, lr: m.generator_input?.longest_recent_run_km, days: m.days_available, bench: m.benchmark ?? null, vdot: m.vdot, anchor: m.vdot_training_anchor, peak: m.peak_km_target, maxhr: m.max_hr, rhr: m.resting_hr, declared: m.fitness_level_declared, intensity: m.generator_input?.intensity_experience }))
    for (const w of (j.weeks ?? [])) for (const sess of Object.values(w.sessions ?? {}) as any[]) {
      if (sess?.catalogue_id === 'tempo_continuous' && /Zone 4/.test(String(sess.zone))) {
        console.log(`    w${w.n} FULL:`, JSON.stringify({ label: sess.label, type: sess.type, zone: sess.zone, hr: sess.hr_target, pace: sess.pace_target, stimulus: sess.stimulus, dur: sess.duration_mins, km: sess.distance_km })); break
      }
    }
  }

  // probe: the four plans the structural-level measurement wrongly flagged
  console.log(`\n  probe — plans whose STRUCTURAL level is beginner but whose INTENSITY level is not:`)
  for (const p of plans ?? []) {
    const m = (p.plan_json as any)?.meta ?? {}
    if (m.fitness_level !== 'beginner' || (m.fitness_intensity_level ?? 'beginner') === 'beginner') continue
    console.log(`    ${String(p.user_id).slice(0,8)} goal=${m.goal} struct=${m.fitness_level} int=${m.fitness_intensity_level} declared=${m.fitness_level_declared ?? '—'} vdot=${m.vdot} gen=${m.generator_version} at=${String(m.generated_at).slice(0,10)}`)
  }

  // ── (3) BENCHMARK-STALENESS-CEILING-01 ──────────────────────────────────────
  const today = new Date('2026-11-16')
  const ages: number[] = []; let dateless = 0; let withBench = 0
  for (const p of plans ?? []) {
    const b = (p.plan_json as any)?.meta?.benchmark
    if (!b) continue
    withBench++
    if (!b.benchmark_date) { dateless++; continue }
    ages.push(Math.round((today.getTime() - new Date(b.benchmark_date).getTime()) / 86400000))
  }
  ages.sort((a,b)=>a-b)
  const wk = (d: number) => d/7
  const disc = (d: number) => Math.min(3 + (wk(d) > 4 ? Math.floor((wk(d)-4)/4)+1 : 0), 7)
  console.log(`\n── (3) BENCHMARK staleness ──`)
  console.log(`plans with a benchmark: ${withBench}; DATELESS: ${dateless}; dated: ${ages.length}`)
  console.log(`ages (days): ${ages.join(', ')}`)
  console.log(`at/past saturation (>= 16wk = 112d): ${ages.filter(a=>a>=112).length}; > 6mo: ${ages.filter(a=>a>182).length}; > 24mo: ${ages.filter(a=>a>730).length}`)
  console.log(`mean age ${Math.round(ages.reduce((a,b)=>a+b,0)/ages.length)}d; oldest ${ages.at(-1)}d (${(ages.at(-1)!/365).toFixed(1)} yr)`)
  console.log(`discount today for each: ${ages.map(a=>`${a}d→${disc(a)}%`).join(', ')}`)

  // ── (4) MAXHR-RECENCY-01 ────────────────────────────────────────────────────
  const { data: settings, error: setErr } = await sb.from('user_settings').select('id, max_hr, max_hr_source, resting_hr')
  if (setErr) console.log('  user_settings error:', setErr.message)
  const bySrc: Record<string, number> = {}
  for (const s of settings ?? []) bySrc[String(s.max_hr_source)] = (bySrc[String(s.max_hr_source)] ?? 0) + 1
  console.log(`\n── (4) MAXHR recency ──`)
  console.log(`user_settings rows: ${settings?.length}; max_hr_source:`, bySrc)
  // can an observed max be dated from the activity log?
  const { data: acts } = await sb.from('strava_activities').select('user_id, max_hr, start_date').not('max_hr','is',null).order('max_hr',{ascending:false})
  const peak: Record<string, {hr:number;date:string}> = {}
  for (const a of acts ?? []) { const u = a.user_id as string; if (!peak[u] || (a.max_hr as number) > peak[u].hr) peak[u] = { hr: a.max_hr as number, date: String(a.start_date).slice(0,10) } }
  console.log(`users with any HR-bearing activity: ${Object.keys(peak).length}`)
  for (const s of (settings ?? []).filter(x => x.max_hr != null)) {
    const pk = peak[(s as any).id as string]
    const ageD = pk ? Math.round((today.getTime() - new Date(pk.date).getTime())/86400000) : null
    console.log(`  ${String((s as any).id).slice(0,8)} stored=${s.max_hr} src=${s.max_hr_source} peak_activity=${pk?.hr ?? '—'} on ${pk?.date ?? '—'} (${ageD ?? '—'}d ago)`)
  }

}
main().catch(e => { console.error(e); process.exit(1) })

// ── (5) BENCHMARK-STALENESS-CEILING-01 — what a ceiling candidate does to a pace ──
// Read-only; calls buildPaceFromVDOT, the real producer.
import { buildPaceFromVDOT } from '../lib/plan/paceBands'
export function staleness() {
  const raw = 41.0
  console.log(`\n── (5) staleness ceiling candidates (raw VDOT ${raw}) ──`)
  for (const d of [3, 5, 7, 9, 10, 12, 15]) {
    const g = buildPaceFromVDOT(raw * (1 - d / 100), raw)
    console.log(`  ${String(d).padStart(2)}%  anchor ${(raw * (1 - d / 100)).toFixed(1)}  easy ${g.easyPaceStr}  T ${g.qualityPaceStr}  MP ${g.marathonPaceStr ?? '—'}`)
  }
  console.log(`  weeks to reach each level on the current +1%/4wk ramp: 3%→0-4 · 4%→5-8 · 5%→9-12 · 6%→13-16 · 7%→16+ (CAP)`)
  console.log(`  extended: 8%→17-20 · 9%→21-24 · 10%→25-28 (6.5mo) · 12%→33-36 (8.3mo) · 15%→45-48 (11mo)`)
  console.log(`  live ages in weeks: ${[7,22,22,37,51,57,64,71,139,175,204,212,218,757,964].map(d=>Math.round(d/7)).join(', ')}`)
}
staleness()

// ── (1) THRESHOLD-INTERVAL-OVERLAP-01 — the band ladder, per persona ─────────
// %HRR ≈ %VO2R (ACSM / Swain & Leutholtz) is the only way to compare Daniels'
// %VO2max pace fractions with Karvonen's %HRR bands. VDOT is used directly as the
// ml/kg/min figure, as ADR-026 did.
import { computeZones } from '../lib/plan/zones'
const vo2r = (frac: number, vdot: number) => (frac * vdot - 3.5) / (vdot - 3.5)
const hrAt = (frac: number, vdot: number, max: number, rest: number) =>
  Math.round(rest + vo2r(frac, vdot) * (max - rest))
const FRACTIONS = { E: [0.59, 0.74], T: [0.83, 0.88], CV: [0.88, 0.92], I: [0.95, 1.00] } as const

export function ladder() {
  console.log(`\n── (1) the band ladder — anchored vs today ──`)
  for (const p of [
    { name: 'trained    VDOT 41.0', max: 185, rest: 48, vdot: 41.0 },
    { name: 'trained+   VDOT 44.6', max: 190, rest: 50, vdot: 44.6 },
    { name: 'beginner   VDOT 20.2', max: 191, rest: 60, vdot: 20.2 },
    { name: 'beginner-- VDOT 16.2', max: 190, rest: 65, vdot: 16.2 },
  ]) {
    const z = computeZones(p.max, p.rest)
    const band = (k: keyof typeof FRACTIONS) => FRACTIONS[k].map(f => hrAt(f, p.vdot, p.max, p.rest)) as [number, number]
    const [tLo, tHi] = band('T'); const [cvLo, cvHi] = band('CV'); const [iLo, iHi] = band('I')
    const [eLo, eHi] = band('E')
    // MAXHR-AGE-ABSENT-01 — `ZoneTargets`'s fields are optional now (a runner with no age and
    // no max has no zones). These personas all carry a max, so the non-null assertions are
    // facts about the fixture rather than hope; the probe would throw loudly if that changed.
    const z3Top = Number(z.qualityHR!.match(/–(\d+)/)![1])
    console.log(`  ${p.name}`)
    console.log(`    TODAY   easy ${z.easyHR}  threshold ${z.qualityHR} (${z.qualityZone})  intervals ${z.intervalsHR} (${z.intervalsZone})`)
    console.log(`    ANCHOR  E ${eLo}–${eHi} (${(vo2r(0.59,p.vdot)*100).toFixed(1)}–${(vo2r(0.74,p.vdot)*100).toFixed(1)}% HRR — 🔴 BREACHES §12's 70% Z2 ceiling, so easy is NOT anchored)`)
    console.log(`    ANCHOR  T ${tLo}–${tHi} (w ${tHi-tLo})   CV ${cvLo}–${cvHi} (w ${cvHi-cvLo})   I ${iLo}–${iHi} (w ${iHi-iLo})`)
    console.log(`    LADDER  interval floor TODAY ${z3Top} → RULED ${cvHi} (the CV ceiling); overlap with T today ${tHi - z3Top} bpm (the WHOLE threshold band)`)
    console.log(`    GREY    ${Number(z.easyHR!.match(/(\d+)/)![1])}–${tLo} bpm is prescribed by nothing after the change`)
  }
}
ladder()
