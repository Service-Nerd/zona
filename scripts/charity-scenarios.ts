// charity-scenarios.ts — generate + validate the charity-runner cohort.
//
// WHY THIS EXISTS (2026-09-13, ahead of the first charity referral): the
// property sweep and cohort grid prove plans are VALID across a combinatorial
// grid, but they are not human-readable and marathon is thin on NAMED, asserted
// cases (3 archetypes, 2 golden personas, 0 in the real-input corpus). A charity
// partner refers first-timers running 10K / HM / MARATHON for a cause — low base,
// injuries common, finish goals, sometimes a compressed timeline. This script
// generates a real plan for each such persona, runs validatePlan(), and prints a
// coaching-legible summary so a human (or the Coaching Board) can judge whether
// the output is FIT FOR PURPOSE, not merely violation-free.
//
// Run:  NODE_ENV=production npx tsx scripts/charity-scenarios.ts
// (production so generateRulePlan COLLECTS violations rather than throwing.)

import { generateRulePlan } from '../lib/plan/ruleEngine'
import { validatePlan } from '../lib/plan/invariants'
import { sessionKmSelfPaced } from '../lib/plan/sessionDistance'
import { isLongRun } from '../lib/plan/sessionRole'
import { CHARITY_PERSONAS, charityRaceDate, CHARITY_PLAN_START, type CharityPersona } from '../lib/plan/charityCohort'
import type { GeneratorInput, Plan } from '../types/plan'

const PLAN_START = CHARITY_PLAN_START
const raceDate = (weeks: number) => charityRaceDate(weeks)
const PERSONAS = CHARITY_PERSONAS

// ── Plan summary helpers ─────────────────────────────────────────────────────
function weekKm(week: any): number {
  const s = week.sessions ?? {}
  return Object.values(s).reduce((sum: number, sess: any) => sum + (sessionKmSelfPaced(sess) ?? 0), 0)
}
function longRunKm(week: any): number {
  const s = week.sessions ?? {}
  let max = 0
  for (const sess of Object.values(s) as any[]) {
    if (sess && isLongRun(sess)) max = Math.max(max, sessionKmSelfPaced(sess) ?? 0)
  }
  return max
}
function summarise(persona: CharityPersona, plan: Plan) {
  const m: any = plan.meta ?? {}
  const peakWeek = plan.weeks.reduce((best, w) => weekKm(w) > weekKm(best) ? w : best, plan.weeks[0])
  const peakKm = Math.round(weekKm(peakWeek))
  const lrPeak = Math.max(...plan.weeks.map(longRunKm))
  const lrPeakPctOfWeek = peakKm > 0 ? Math.round((lrPeak / weekKm(peakWeek)) * 100) : 0
  const errs = validatePlan(plan, { ...persona.input, race_date: raceDate(persona.weeks) } as GeneratorInput)
  const errors = errs.filter(v => v.severity === 'error')
  const warns = errs.filter(v => v.severity === 'warn')
  return { m, peakKm, lrPeak: Math.round(lrPeak), lrPeakPctOfWeek, errors, warns }
}

// ── Run ──────────────────────────────────────────────────────────────────────
let anyError = false
const rows: string[] = []
for (const p of PERSONAS) {
  const input = { ...p.input, race_date: raceDate(p.weeks) } as GeneratorInput
  console.log('\n' + '─'.repeat(78))
  console.log(`▶ ${p.id}`)
  console.log(`  risk: ${p.note}`)
  console.log(`  in:   ${input.race_distance_km}km ${input.goal}${input.target_time ? ' ' + input.target_time : ''} · ` +
    `${p.weeks}wk · ${input.days_available}d · vol ${input.current_weekly_km} (long ${input.longest_recent_run_km}) · age ${input.age}` +
    `${input.injury_history ? ' · injury ' + input.injury_history.join('+') : ''}` +
    `${input.max_weekday_mins ? ' · cap ' + input.max_weekday_mins + 'm' : ''}`)
  try {
    const plan = generateRulePlan(input, 'paid', PLAN_START)
    const { m, peakKm, lrPeak, lrPeakPctOfWeek, errors, warns } = summarise(p, plan)
    console.log(`  out:  level=${m.fitness_level} · profile=${m.volume_profile} · weeks=${plan.weeks.length} · ` +
      `peak=${peakKm}km · longrun peak=${lrPeak}km (${lrPeakPctOfWeek}% of peak wk) · peakTarget=${m.peak_km_target ?? '—'}`)
    console.log(`        difficulty=${m.difficulty_band ?? '—'} · prep=${m.prep_time_status ?? '—'} · ` +
      `foundation=${m.foundation_weeks_planned ?? 0}w · recal=${(m.recalibration_weeks ?? []).length}`)
    const notes = [m.long_run_shortfall_note, m.volume_shortfall_note, m.volume_constraint_note, m.difficulty_note, m.fitness_signal_note]
      .filter(Boolean)
    for (const n of notes) console.log(`        note: ${n}`)
    if (errors.length) {
      anyError = true
      console.log(`  ❌ ${errors.length} ERROR violation(s):`)
      for (const v of errors.slice(0, 8)) console.log(`     [${v.code}] wk${v.week ?? '—'} ${v.message}`)
    } else {
      console.log(`  ✅ 0 error violations` + (warns.length ? ` (${warns.length} warn)` : ''))
    }
    if (warns.length) {
      for (const v of warns.slice(0, 6)) console.log(`     ⚠ [${v.code}] wk${v.week ?? '—'} ${v.message}`)
    }
    rows.push(`${errors.length ? '❌' : '✅'} ${p.id.padEnd(46)} lvl=${(m.fitness_level ?? '?').padEnd(12)} ${(m.volume_profile ?? '?').padEnd(12)} peak=${String(peakKm).padStart(3)}km LR=${String(lrPeak).padStart(3)}km(${lrPeakPctOfWeek}%) err=${errors.length} warn=${warns.length}`)
  } catch (e: any) {
    const msg = String(e?.message ?? e)
    const refusal = /is not enough preparation|days\/week is (not enough|below)|below the recommended \d+-week minimum|prep/i.test(msg)
    console.log(`  ${refusal ? '⛔ BY-DESIGN REFUSAL' : '💥 THREW'}: ${msg.split('\n')[0]}`)
    rows.push(`${refusal ? '⛔' : '💥'} ${p.id.padEnd(46)} ${refusal ? 'refused (prep/days)' : 'THREW: ' + msg.split('\n')[0]}`)
    if (!refusal) anyError = true
  }
}

console.log('\n' + '═'.repeat(78))
console.log('CHARITY COHORT SUMMARY')
console.log('═'.repeat(78))
for (const r of rows) console.log(r)
console.log('═'.repeat(78))
console.log(anyError ? '\n❌ At least one plan errored or threw unexpectedly — investigate above.'
                     : '\n✅ Every charity plan generated and passed validatePlan (errors=0).')
process.exit(anyError ? 1 : 0)
