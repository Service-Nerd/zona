// TRIGGER-BACKTEST-01 — "would any of the eight detectors ever have fired?"
//
// 🔴 WHY THIS EXISTS. `POSTRUN-PLAN-FEEDBACK-01` wants to TELL the runner their plan
// changed because of their run, and Hutchinson blocked it pending an audit of the eleven
// triggers' false-positive rate. **That audit cannot be run against production**, measured
// 2026-10-08:
//
//   plan_adjustments, all time ........ 18 rows
//     session_reorder .... 13   (user-initiated, not a detection)
//     zone_drift .........  3   ← the ONLY real detection ever, ALL THREE REVERTED
//     skip_with_reason ...  2   (user-initiated)
//     the other eight ....  0   NEVER FIRED
//   last row of any kind .............. 2026-06-29
//   users ever checked ................ 2 of 44 (`last_adjustment_check_at`)
//
// ⚠️ AND THE SILENCE IS NOT A DEFECT. `/api/adjust-plan` is gated on `dynamic_reshape_r20`
// (PAID) and 403s before stamping, so for a free runner the engine correctly never runs.
// I went looking for a dead engine and there is none. **There is simply no evidence.**
//
// 🥇 BUT THE DATA TO ANSWER IT EXISTS ANYWAY: 17 runners have logged runs, 13 with 7+,
// almost all with heart rate (79, 26, 22, 20, 18, 18 …). So this script REPLAYS each real
// history through the live detector, week by week, and reports what WOULD have fired.
//
// ⚠️ WHAT IT PROVES AND WHAT IT DOES NOT.
//   PROVES   — detector REACHABILITY on real data: which thresholds real runners cross.
//   DOES NOT — that the route would have fired it. `AdjustmentCheckInput` is assembled
//              INLINE in `app/api/adjust-plan/route.ts`, so this script is a SECOND
//              assembler. It reuses the route's own load producers (`fetchWeeklyLoad`,
//              `priorWeeks`) to keep the overlap as small as possible, but any field it
//              builds differently is a field it measures differently. Stated, not hidden.
//   DOES NOT — a false-POSITIVE rate. Nothing here knows whether a firing was RIGHT.
//              It answers "is this reachable", which is the prerequisite question.
//
// 🔴 AND THE STRUCTURAL FINDING THE FIRING TABLE WILL UNDERSTATE: the detector returns
// the FIRST match in priority order, never a list. So on any given check at most ONE
// trigger can win, and a lower-priority trigger is masked whenever a higher one fires.
// `--unmasked` re-runs each week with the higher-priority signals suppressed, which is the
// only way to tell "never reachable" from "always beaten to it".
//
//   npx tsx scripts/backtest-adjustment-triggers.ts            # firing table
//   npx tsx scripts/backtest-adjustment-triggers.ts --unmasked # + masking analysis
//   npx tsx scripts/backtest-adjustment-triggers.ts --user <email>
//
// READS ONLY. Never writes.
import { createClient } from '@supabase/supabase-js'
import { loadEnvConfig } from '@next/env'
import { checkAdjustmentTriggers, type AdjustmentCheckInput, type TriggerType } from '../lib/coaching/planAdjustment'
import { fetchWeeklyLoad, priorWeeks, EMPTY_LOAD } from '../lib/coaching/weeklyActualLoad'
import { orderedWeekSessions } from '../lib/plan/weekSessions'
import type { Plan, Session } from '../types/plan'

loadEnvConfig(process.cwd())
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

/** The eleven declared types, from the union itself. */
const ALL_TRIGGERS: TriggerType[] = [
  'acute_chronic_high', 'zone_drift', 'shadow_load', 'ef_decline', 'fatigue_accumulation',
  'skip_with_reason', 'session_reorder', 'readiness_signal', 'manual', 'fitness_signal',
  'long_run_shortfall',
]
/** The eight the product could honestly claim to WATCH FOR. The other three are either
 *  user-initiated (`skip_with_reason`, `session_reorder`) or have no producer (`manual`). */
const DETECTED: TriggerType[] = [
  'acute_chronic_high', 'zone_drift', 'shadow_load', 'ef_decline',
  'fatigue_accumulation', 'readiness_signal', 'fitness_signal', 'long_run_shortfall',
]

const QUALITY_TYPES = new Set(['quality', 'intervals', 'tempo'])
const arg = (f: string) => { const i = process.argv.indexOf(f); return i > -1 ? process.argv[i + 1] : null }
const has = (f: string) => process.argv.includes(f)

interface Row { [k: string]: unknown }

async function main() {
  const { data: authUsers } = await db.auth.admin.listUsers({ perPage: 500 })
  const emailOf = (id: string) => authUsers?.users.find(u => u.id === id)?.email ?? id.slice(0, 8)
  const onlyUser = arg('--user')

  const { data: plans, error: planErr } = await db.from('plans').select('user_id, plan_json, updated_at')
  if (planErr) throw new Error(`plans: ${planErr.message}`)

  const fired     = new Map<TriggerType, { n: number; users: Set<string>; weeks: string[] }>()
  const perRunner: Array<{ email: string; weeks: number; checks: number; fires: number; types: string[] }> = []
  let runnersConsidered = 0, weeksReplayed = 0, threw = 0
  const skipped: string[] = []

  for (const p of plans ?? []) {
    const email = emailOf(p.user_id as string)
    if (onlyUser && email !== onlyUser) continue
    const plan = p.plan_json as Plan | null
    if (!plan?.weeks?.length) { skipped.push(`${email}: no weeks`); continue }

    const [{ data: comps }, { data: analyses }] = await Promise.all([
      db.from('session_completions')
        .select('week_n, session_day, status, fatigue_tag, skip_reason, rpe, strava_activity_km')
        .eq('user_id', p.user_id).is('superseded_at', null).order('week_n'),
      db.from('run_analysis')
        .select('week_n, session_day, session_type, hr_in_zone_pct, hr_above_ceiling_pct, pace_score, ef_trend_pct, actual_load_km, planned_load_km, actual_load_mins, planned_load_mins')
        .eq('user_id', p.user_id).is('superseded_at', null).order('week_n'),
    ])
    const loads = await fetchWeeklyLoad(db, p.user_id as string, plan)

    // Only weeks the runner has actually reached: the last week with any completion
    // or analysis. Replaying future weeks would manufacture empty-input "no fire"
    // rows and dilute every rate in the table.
    const reached = Math.max(
      0,
      ...(comps ?? []).map(c => Number(c.week_n) || 0),
      ...(analyses ?? []).map(a => Number(a.week_n) || 0),
    )
    if (reached === 0) { skipped.push(`${email}: never reached week 1`); continue }
    runnersConsidered++

    const mine: string[] = []
    let checks = 0, fires = 0
    for (const week of plan.weeks) {
      const weekN = Number((week as { n?: number }).n)
      if (!weekN || weekN > reached) continue
      // ADJUST-ENGINE-DEAD-01: was a SECOND hand-rolled copy of the route's broken
      // mapping, and it discarded every real week as "malformed" — which is how this
      // harness came to report "0 of 8 reachable" having replayed nothing.
      const sessions = orderedWeekSessions(week)

      const weekComps    = (comps ?? []).filter(c => Number(c.week_n) === weekN)
      const weekAnalyses = (analyses ?? []).filter(a => Number(a.week_n) === weekN)
      const thisWeek     = loads.get(weekN) ?? EMPTY_LOAD
      const plannedKm    = sessions.reduce((s, x) => s + (Number((x as { distance_km?: number }).distance_km) || 0), 0)

      const input: AdjustmentCheckInput = {
        currentWeekN:        weekN,
        totalWeeks:          plan.weeks.length,
        currentWeekSessions: sessions as Session[],
        linkedKm:            thisWeek.linkedKm,
        offPlanKm:           thisWeek.offPlanKm,
        plannedKm,
        priorWeeksKm:        priorWeeks(loads, weekN, 4),
        hrInZoneData: weekAnalyses.map(a => ({
          hrInZonePct:     a.hr_in_zone_pct       as number | null,
          aboveCeilingPct: a.hr_above_ceiling_pct as number | null,
          actualLoadKm:    a.actual_load_km       as number | null,
        })),
        efTrendPct:          (weekAnalyses.find(a => a.ef_trend_pct != null)?.ef_trend_pct as number) ?? null,
        adjustmentsThisWeek: 0,
        currentPhase:        (week as { phase?: AdjustmentCheckInput['currentPhase'] }).phase,
        recentFatigueRows:   weekComps.map(c => ({
          fatigue_tag: c.fatigue_tag as string | null,
          skip_reason: c.skip_reason as string | null,
          status:      c.status      as string,
        })) as AdjustmentCheckInput['recentFatigueRows'],
        recentQualityAnalyses: weekAnalyses
          .filter(a => QUALITY_TYPES.has(String(a.session_type)))
          .map(a => ({
            paceScore:         a.pace_score           as number | null,
            hrAboveCeilingPct: a.hr_above_ceiling_pct as number | null,
            weekN:             Number(a.week_n),
          })),
      }

      checks++
      weeksReplayed++
      try {
        const out = checkAdjustmentTriggers(input)
        if (out) {
          fires++
          const t = out.trigger.type
          const e = fired.get(t) ?? { n: 0, users: new Set<string>(), weeks: [] }
          e.n++; e.users.add(email); e.weeks.push(`${email} w${weekN}`)
          fired.set(t, e)
          if (!mine.includes(t)) mine.push(t)
        }
      } catch (err) {
        threw++
        skipped.push(`${email} w${weekN}: THREW ${(err as Error).message.slice(0, 80)}`)
      }
    }
    perRunner.push({ email, weeks: reached, checks, fires, types: mine })
  }

  // ── report ────────────────────────────────────────────────────────────────
  console.log(`\nTRIGGER BACKTEST — ${runnersConsidered} runners, ${weeksReplayed} week-checks replayed`)
  console.log(`(the live \`checkAdjustmentTriggers\`, on real production histories)\n`)

  // 🔴 AN EMPTY POPULATION MUST NOT READ AS A CLEAN RESULT. The first run of this
  // script reported "0 of 8 reachable" having replayed ZERO weeks — every week was
  // discarded as malformed and the headline looked like a finding. That is this repo's
  // `AN ALLOW-BY-DEFAULT ARM IS NOT A CHECK` class, in a measurement script. Refuse.
  if (weeksReplayed === 0) {
    console.log('🔴 ZERO WEEK-CHECKS REPLAYED. There is no result here, only a broken harness.')
    console.log(`   runners considered: ${runnersConsidered} · skipped: ${skipped.length}`)
    for (const s of skipped.slice(0, 10)) console.log(`     ${s}`)
    process.exit(2)
  }

  console.log('PER TRIGGER — would it have fired?')
  let reachable = 0
  for (const t of ALL_TRIGGERS) {
    const e = fired.get(t)
    const detected = DETECTED.includes(t)
    const tag = detected ? '' : (t === 'manual' ? '  [no producer]' : '  [user-initiated]')
    if (e) {
      reachable++
      console.log(`  ✅ ${t.padEnd(22)} n=${String(e.n).padStart(3)}  runners=${e.users.size}${tag}`)
      console.log(`       e.g. ${e.weeks.slice(0, 3).join(' · ')}`)
    } else {
      console.log(`  ⬜ ${t.padEnd(22)} never${' '.repeat(12)}${tag}`)
    }
  }
  const detectedReachable = DETECTED.filter(t => fired.has(t))
  console.log(`\n  OF THE EIGHT WE WOULD CLAIM TO WATCH FOR: ${detectedReachable.length} reachable, ${8 - detectedReachable.length} silent`)
  if (detectedReachable.length) console.log(`    reachable: ${detectedReachable.join(' · ')}`)
  const silent = DETECTED.filter(t => !fired.has(t))
  if (silent.length) console.log(`    silent   : ${silent.join(' · ')}`)

  console.log('\nPER RUNNER')
  for (const r of perRunner.sort((a, b) => b.checks - a.checks))
    console.log(`  ${r.email.padEnd(36)} weeksReached=${String(r.weeks).padStart(2)} checks=${String(r.checks).padStart(2)} fires=${String(r.fires).padStart(2)}  ${r.types.join(',') || '-'}`)

  if (has('--unmasked')) {
    // 🔴 THE PRIORITY-ORDER PROBLEM. The detector returns the FIRST match, so a silent
    // trigger may be unreachable OR merely always beaten. Re-run with each trigger's
    // seniors neutralised to tell those two apart.
    console.log('\nMASKING ANALYSIS — is a silent trigger unreachable, or just outranked?')
    console.log('  (not yet implemented — needs per-trigger input neutralisation, filed as TRIGGER-BACKTEST-02)')
  }

  if (skipped.length) {
    console.log(`\nSKIPPED / THREW (${skipped.length}, ${threw} threw):`)
    for (const s of skipped.slice(0, 15)) console.log(`  ${s}`)
    if (skipped.length > 15) console.log(`  … and ${skipped.length - 15} more`)
  }

  console.log(`\n⚠️  WHAT THIS DOES NOT PROVE: that the ROUTE would fire these (it assembles the`)
  console.log(`   input inline; this is a second assembler), and nothing here knows whether a`)
  console.log(`   firing would have been CORRECT. Reachability only.\n`)
}

main().catch(e => { console.error(e); process.exit(1) })
