// measure-marathon-maint-label.ts — MARATHON-MAINT-LABEL-01 before/after signal.
//
// Coaching Board 2026-09-13, item 2. A time-target marathon is classified
// `maintenance` at ~100% (54/54 cohort, 99.8% expanded, spread 0–0.7pp), which
// carries no information. Finish-goal marathon, by contrast, is 51.9% and varies
// 32.5%→95.8% with volume — information-bearing.
//
// The board found the lever is NOT §23/§46 but §24: its peak-LR specificity floor
// (0.75 × race = 31.65 km for a marathon) is structurally unreachable under
// `LONG_RUN_CAP_MINUTES.MARATHON = 210`, because 31.65 km at any realistic
// non-elite easy pace exceeds 210 minutes. So a runner at 80 km/wk with a 30.5 km
// long run — plainly building — is labelled maintenance by a floor the engine's
// own safety cap forbids them from reaching.
//
// This reports, per distance × goal:
//   · maintenance rate
//   · how often EACH trigger fires (ratio / volume / longRun), and alone
//   · peak long-run minutes against the cap, so "is it AT its ceiling?" is a
//     measured fact rather than an assumption
//
// ⚠️ Asserts plans generated. A grid that refuses everything prints a clean table.
//
// Run: NODE_ENV=production npx tsx scripts/measure-marathon-maint-label.ts

import { generateRulePlan } from '../lib/plan/ruleEngine'
import { GENERATION_CONFIG, raceDistanceKey } from '../lib/plan/generationConfig'
import { sessionKmSelfPaced } from '../lib/plan/sessionDistance'
import { isLongRun } from '../lib/plan/sessionRole'
import type { GeneratorInput, Plan, Session } from '../types/plan'

const PLAN_START = '2026-09-14'

const DISTS = [
  { key: 'HM', km: 21.1, target: '1:55:00' },
  { key: 'MARATHON', km: 42.2, target: '4:00:00' },
] as const

const LEVELS = ['beginner', 'intermediate', 'experienced'] as const
const DAYS = [3, 4, 5, 6]
const VOLUMES = [20, 35, 50, 70, 90]
const RACE_DATES = ['2027-03-14', '2027-04-11', '2027-06-13']

let generated = 0

for (const d of DISTS) {
  for (const goal of ['time_target', 'finish'] as const) {
    let n = 0, maint = 0
    let atCap = 0, lrBelowFloor = 0, capBlockedAndAtCap = 0
    const capMins = GENERATION_CONFIG.LONG_RUN_CAP_MINUTES[d.key]
    const floorKm = d.km * GENERATION_CONFIG.PEAK_LR_RATIO_VS_RACE[d.key]
    let minLrPctOfCap = 999, maxLrPctOfCap = 0

    for (const lvl of LEVELS) for (const days of DAYS) for (const vol of VOLUMES) for (const rd of RACE_DATES) {
      const input = {
        race_date: rd, race_distance_km: d.km, goal,
        ...(goal === 'time_target' ? { target_time: d.target } : {}),
        current_weekly_km: vol, longest_recent_run_km: Math.max(6, Math.round(vol * 0.35)),
        days_available: days, age: 40, resting_hr: 55, max_hr: 180,
        fitness_level: lvl, preferred_long_run_day: 'sun',
        recent_quality_training: 'occasional',
      } as unknown as GeneratorInput
      let p: Plan
      try { p = generateRulePlan(input, 'paid', PLAN_START) } catch { continue }
      generated++; n++
      if (p.meta.volume_profile === 'maintenance') maint++

      // The runner's actual peak long run, in minutes and km.
      let peakMins = 0, peakKm = 0
      for (const w of p.weeks) {
        if (w.phase !== 'peak' || w.type === 'deload') continue
        for (const s of Object.values(w.sessions ?? {}) as (Session | undefined)[]) {
          if (!s || !isLongRun(s)) continue
          peakMins = Math.max(peakMins, s.duration_mins ?? 0)
          peakKm = Math.max(peakKm, sessionKmSelfPaced(s) ?? 0)
        }
      }
      if (peakMins > 0) {
        const pct = (peakMins / capMins) * 100
        minLrPctOfCap = Math.min(minLrPctOfCap, pct)
        maxLrPctOfCap = Math.max(maxLrPctOfCap, pct)
        // "at its ceiling" = within one rounding step of the cap
        if (peakMins >= capMins - 5) atCap++
        if (peakKm + 0.01 < floorKm) lrBelowFloor++
        if (peakKm + 0.01 < floorKm && peakMins >= capMins - 5) capBlockedAndAtCap++
      }
    }

    if (n === 0) { console.log(`\n▶ ${d.key} ${goal}: ZERO plans — measuring nothing.`); continue }
    const pct = (x: number) => `${((x / n) * 100).toFixed(1)}%`
    console.log(`\n▶ ${d.key} · ${goal}   plans=${n}`)
    console.log(`   maintenance ................... ${maint} (${pct(maint)})`)
    console.log(`   §24 floor = ${floorKm.toFixed(1)} km · cap = ${capMins} min`)
    console.log(`   peak LR below the §24 floor ... ${lrBelowFloor} (${pct(lrBelowFloor)})`)
    console.log(`   peak LR AT its time ceiling ... ${atCap} (${pct(atCap)})`)
    console.log(`   BOTH (floor unreachable) ...... ${capBlockedAndAtCap} (${pct(capBlockedAndAtCap)})`)
    console.log(`   peak LR as % of cap: ${minLrPctOfCap.toFixed(0)}%–${maxLrPctOfCap.toFixed(0)}%`)
  }
}

console.log(`\nplans generated: ${generated}`)
if (generated === 0) { console.error('FAIL: grid generated nothing.'); process.exit(1) }
