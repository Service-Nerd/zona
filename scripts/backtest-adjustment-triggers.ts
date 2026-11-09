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
// 🔑 RE-MEASURED AGAINST PRODUCTION 2026-11-09 (`RESHAPE-FIRST-FIRINGS-01`, the wave's item 3:
// *"read the first real adjustments the woken engine produces"*). THE ENGINE HAS FIRED, and the
// premise above is stale in three directions at once:
//
//   plan_adjustments, all time ........ 22 rows  (was 18)
//     session_reorder .... 14   (user-initiated)
//     zone_drift .........  4 rows / 3 FIRINGS  ← see the duplicate finding below
//     skip_with_reason ...  3   (user-initiated)
//     shadow_load ........  1   🔑 A SECOND DETECTION TYPE HAS FIRED, auto_applied
//     the other seven ....  0   still never
//   last row of any kind .............. 2026-11-03  (was 2026-06-29)
//
//   zone_drift  2026-04-27  reverted      zdScore 0  vs threshold 50
//   zone_drift  2026-08-17  reverted      rpe_disconnect, RPE 8   ← written TWICE
//   shadow_load 2026-10-11  auto_applied  shadowPct 18.4 vs 15
//   zone_drift  2026-10-28  auto_applied  driftPct 87   vs 20     ← not even superseded
//
// ✅ THE FIRST FIRING WAS A WRONG DETECTION AND THE DATA SAYS SO. `zdScore: 0` against a
// `threshold: 50` is the pre-§12-Am.1 detector, which gated on the km-weighted MEAN of
// `hr_in_zone_pct` — a BAND, where §12 prescribes a CAP — and `TRIGGER-AUDIT-01` fixed it on
// 2026-09-13. The 2026-10-28 row confirms the fix end to end: `driftPct 87 vs 20`, DIRECTIONAL.
//
// ⚠️ SO THE WAVE'S OWN WORRY IS ANSWERABLE AFTER ALL. It reads: *"a tone rejection and a wrong
// detection look identical in the data."* **They do not — `trigger_detail` distinguishes them.**
// A score of 0 crossing a threshold of 50 is a wrong detection; 87 against 20 is not.
//
// 🔴 AND THE LEDGER IS 36% DUPLICATES: 8 of 22 rows, in 4 pairs, 1–7 SECONDS APART — three
// `session_reorder` and the 2026-08-17 `zone_drift`. **That is what inflates the "three times"
// above: zone_drift has fired THREE times and written FOUR rows.** A pair seconds apart is a
// double-invocation, not a second detection. Filed as `ADJUST-LEDGER-DUPLICATE-01`.
//
// 🔻 AND WHAT STILL BLOCKS ITEM 5 (`POSTRUN-PLAN-FEEDBACK-01`) IS NOT THE REVERT RATE — IT IS
// THAT NOTHING CHANGED. Both standing firings are `adjustment_type: 'flag_for_review'`, and
// `shadow_load`'s `sessions_before` is BYTE-IDENTICAL to its `sessions_after` (2,427 chars
// each). The zone_drift rows do differ, by 126–189 characters of added coach-note text. **So
// "your plan changed because of your run" would be false for the one and an overstatement for
// the others.** That is a sharper block than "wait and see", and it points at a different
// feature: tell the runner the COACHING changed, not the plan.
//
// 📐 ITEM 4's PRECONDITION (`ADJUST-TRIGGER-REACH-02`, *"runners need 4+ weeks of history"*),
// measured the same day from non-superseded `run_analysis`: **ONE runner now qualifies on
// genuinely accumulated history** — 6 distinct weeks, 14 analyses, 2026-10-01 → 2026-11-06.
// The next deepest is 3 weeks. ⚠️ A second runner shows 19 weeks and **every analysis was
// written on one day (2026-06-02)**, so it is a backfill, not history: counting it would make
// the population look twice as deep as it is. **The wait is over for a re-run; it is not over
// for a conclusion from one runner.**
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
//   PROVES   — ...using the ROUTE'S OWN ASSEMBLER since 2026-10-15. `buildAdjustmentSignals`
//              is exported from `lib/coaching/adjustmentEngine.ts`, so this script no longer
//              has an assembler of its own and no field can measure differently.
//
// 🔴 IT DID HAVE ONE, AND IT UNDERSTATED REACHABILITY (`BACKTEST-SECOND-ASSEMBLY-01`).
// Until `ADJUST-ENGINE-ENTRY-01` the route assembled `AdjustmentCheckInput` INLINE inside a
// Next handler, so reuse was impossible and this script built its own. The header said so
// — *"any field it builds differently is a field it measures differently. Stated, not
// hidden"* — which was honest and was not enough. Measured field by field, SEVEN diverged
// and ONE WAS MISSING ALTOGETHER:
//
//   plannedKm ............ summed session distance_km   vs the week's own `weekly_km`
//   hrInZoneData ......... filtered on `week_n`         vs `session_day` prefix
//   efTrendPct ........... FIRST non-null               vs the MEAN of them
//   currentPhase ......... `week.phase`                 vs resolved from `plan.phases`
//   recentFatigueRows .... unsorted, carried `status`   vs chronological, two columns
//   recentQualityAnalyses  keyed `a.session_type`, no   vs plan-join + pace-score filter
//                          pace filter, no window cap      + a 10-row window
//   recentLongRunAnalyses  🔴 NEVER BUILT AT ALL        vs built from both axes (§66 Am.1)
//
// ⚠️ SO `long_run_shortfall` COULD NOT FIRE HERE NO MATTER WHAT THE DATA SAID, and it was
// reported in the silent column beside seven genuine zeroes. The columns it needs
// (`planned_load_km`, `actual_load_mins`, `planned_load_mins`) were already being SELECTED;
// only the field was absent. **A harness that cannot feed a detector reports it as
// unreachable** — the `SWEEP-VACUOUS-01` class, in the one place where that answer was
// about to be handed to a blocked board decision.
//
// ✅ AND "SILENT" IS THREE STATES NOW, NOT ONE. A detector whose inputs were never present
// on any replayed week was never TESTED, and its zero is a fact about our data coverage, not
// about the rule — the `SWEEP-VACUOUS-01` class, which has already cost here once
// (`recentLongRunAnalyses` was never assembled, so `long_run_shortfall` could not fire
// whatever the data said). The table now prints STARVED separately, with the week count AND
// the RUNNER count, because 📐 `hr_above_ceiling_pct` sits on 75 of 97 live `run_analysis`
// rows — **72 of them one single-day backfill**, so the 77.3% aggregate reads healthy and
// describes one account.
//
//   DOES NOT — prove the route would fire it END TO END. The assembly is now shared, but
//              the route's gates (tier, the opt-out, `MAX_ADJUSTMENTS_PER_WEEK`, the pending
//              dedup) are not replayed, and `adjustmentsThisWeek` is deliberately 0 because
//              a replay must not be capped by adjustments that never existed.
//   DOES NOT — a false-POSITIVE rate. Nothing here knows whether a firing was RIGHT.
//              It answers "is this reachable", which is the prerequisite question.
//
// 🔴 AND THE STRUCTURAL FINDING THE FIRING TABLE USED TO UNDERSTATE: the detector returns
// the FIRST match in priority order, never a list. So on any given check at most ONE
// trigger can win, and a lower-priority trigger is masked whenever a higher one fires.
//
// ✅ `--unmasked` IS BUILT NOW (`TRIGGER-BACKTEST-02`, 2026-11-09), and the first run
// overturned this item's own standing number. It had read **"2 of 8 reachable, 6 silent"**
// since 2026-10-16. Measured with the peel:
//
//   reachable unmasked ... 2   acute_chronic_high · shadow_load
//   OUTRANKED ............ 2   zone_drift (beaten by acute_chronic_high on 1 week)
//                              ef_decline (beaten by three seniors on 1 week)
//   genuinely silent ..... 3   fatigue_accumulation · fitness_signal · long_run_shortfall
//   STARVED .............. 1   readiness_signal — `readinessSignal` present on 0 of 43 weeks
//
// **So 4 of 8 are reachable, not 2**, and the number was wrong in the PESSIMISTIC direction
// for a month because the only mechanism that could see it was a stub. ⚠️ `zone_drift` in
// particular read as a regression — it fired on the 10-16 and 10-24 runs and came back
// "never" today — and the truth is that its source runner's analyses were all SUPERSEDED by
// a plan rebuild (Duncan: 8 rows, 0 live, plan_start now 2026-11-30) while a senior trigger
// took the one remaining week. **The population moved and the order masked it; the detector
// did not change.**
//
// 🔴 HOW THE ORDER IS OBTAINED, BECAUSE THE OBVIOUS WAY WOULD HAVE BEEN A SECOND COPY.
// "For each trigger, neutralise its seniors" needs a declared senior list — a second copy of
// the engine's priority order, the most drift-prone thing this file could hold. Instead the
// order is OBSERVED: call the detector, neutralise whatever won, call again. The sequence of
// winners IS the order. A repeat winner is a hard error, so `TRIGGER_INPUTS`'s correctness is
// asserted at runtime as well as by the 92 arms in `lib/coaching/triggerInputs.test.ts`.
//
//   npx tsx scripts/backtest-adjustment-triggers.ts            # firing table
//   npx tsx scripts/backtest-adjustment-triggers.ts --unmasked # + masking analysis
//   npx tsx scripts/backtest-adjustment-triggers.ts --user <email>
//
// READS ONLY. Never writes.
import { createClient } from '@supabase/supabase-js'
import { loadEnvConfig } from '@next/env'
import {
  checkAdjustmentTriggers, TRIGGER_TYPES, DETECTED_TRIGGER_TYPES, guardCheck,
  type AdjustmentCheckInput, type TriggerType,
} from '../lib/coaching/planAdjustment'
import { fetchWeeklyLoad } from '../lib/coaching/weeklyActualLoad'
import {
  buildAdjustmentSignals, type AnalysisRow, type CompletionRow,
} from '../lib/coaching/adjustmentEngine'
import { specFor, unspecified } from '../lib/coaching/triggerInputs'
import type { Plan } from '../types/plan'

loadEnvConfig(process.cwd())
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// 🔴 WAS TWO HAND-WRITTEN COPIES OF THE ENGINE'S OWN VOCABULARY, and the compiler proved it
// the moment `'manual'` was deleted from the union (`ADJUST-TRIGGER-MANUAL-DEAD-01`): both
// lists still named it. Imported from the owner now.
const ALL_TRIGGERS: readonly TriggerType[] = TRIGGER_TYPES
const DETECTED:     readonly TriggerType[] = DETECTED_TRIGGER_TYPES

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
  // TRIGGER-BACKTEST-02 — per trigger, on how many replayed weeks were its inputs PRESENT at
  // all. This is what separates "silent" (a threshold was tested and not crossed) from
  // STARVED (nothing was tested). Counted on every run, never behind a flag: the headline
  // table is actively misleading without it.
  const inputSeen = new Map<TriggerType, number>()
  // 🔴 AND THE WEEK COUNT ALONE HAS THE TRAP THIS WHOLE ITEM IS ABOUT. Measured 2026-11-09:
  // `hr_above_ceiling_pct` sits on 75 of 97 live `run_analysis` rows (77.3%) and **72 of
  // those 75 belong to ONE single-day backfill**. A coverage line reading "present in 22 of
  // 43 weeks" would look healthy while describing one account. So RUNNERS are counted beside
  // weeks — `AN AGGREGATE CANNOT SEE A RUNNER FLIP`, in the harness built to stop exactly
  // that reading.
  const inputRunners = new Map<TriggerType, Set<string>>()
  let guardedIn = 0   // week-checks that got past `guardCheck` — the real denominator for coverage
  // The assembled inputs, kept so `--unmasked` can replay each week without a second fetch.
  const weekInputs: { email: string; weekN: number; input: AdjustmentCheckInput }[] = []

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
      // ADJUST-ENGINE-ENTRY-01 — the ROUTE'S OWN assembler, so every field is the
      // field the route would read. Was a second inline copy; see the header for the
      // seven divergences that cost `long_run_shortfall` its reachability.
      //
      // ⚠️ `adjustmentsThisWeek: 0` IS THE ONE DELIBERATE DIFFERENCE and it is not a
      // divergence in assembly: a replay must not be capped by adjustments that never
      // existed, or every week after the second in any history would be refused by
      // `MAX_ADJUSTMENTS_PER_WEEK` and report as unreachable.
      const input: AdjustmentCheckInput = buildAdjustmentSignals({
        plan,
        weekN,
        isManual: false,
        adjustmentsThisWeek: 0,
        analyses:    (analyses ?? []) as unknown as AnalysisRow[],
        completions: (comps ?? []) as unknown as CompletionRow[],
        weeklyLoad:  loads,
      })

      checks++
      weeksReplayed++
      weekInputs.push({ email, weekN, input })
      // 🔴 A WEEK THE GUARD REFUSES TESTED NO THRESHOLD, so counting its inputs as "present"
      // manufactures the exact false "silent" this report exists to remove. Code review
      // 2026-11-09: the last `TAPER_PROTECTION_WEEKS + 1` weeks of EVERY plan and every taper
      // week were being tallied — and late weeks are precisely where `fatigue_accumulation`
      // becomes present. `guardCheck` is the detector's own gate, imported, not restated.
      if (guardCheck(input)) {
        guardedIn++
        for (const t of DETECTED) {
          if (!specFor(t)?.present(input)) continue
          inputSeen.set(t, (inputSeen.get(t) ?? 0) + 1)
          ;(inputRunners.get(t) ?? inputRunners.set(t, new Set()).get(t)!).add(email)
        }
      }
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

  // 🔴 A DETECTED TRIGGER WITH NO `TRIGGER_INPUTS` SPEC WOULD SILENTLY REVERT TO THE OLD
  // TWO-STATE REPORT for that one trigger: `inputSeen` would read 0 and it would print
  // STARVED, which is a claim about the DATA made from a gap in the HARNESS. Refuse instead.
  // `triggerInputs.test.ts` also fails the build on this, but a measurement script that
  // trusts a test it does not run is the `A PLAUSIBLE NAME IS NOT A RUNNING CHECK` class.
  const noSpec = unspecified()
  if (noSpec.length) {
    console.log(`🔴 NO TRIGGER_INPUTS SPEC FOR: ${noSpec.join(', ')}`)
    console.log('   Add one in lib/coaching/triggerInputs.ts. Until then this report cannot')
    console.log('   tell STARVED from silent for those triggers, so it will not print one.')
    process.exit(2)
  }

  console.log('PER TRIGGER — would it have fired?')
  let reachable = 0
  for (const t of ALL_TRIGGERS) {
    const e = fired.get(t)
    const detected = DETECTED.includes(t)
    // `'manual'` used to need a third tag here; it was deleted for having no producer.
    const tag = detected ? '' : '  [user-initiated]'
    if (e) {
      reachable++
      console.log(`  ✅ ${t.padEnd(22)} n=${String(e.n).padStart(3)}  runners=${e.users.size}${tag}`)
      console.log(`       e.g. ${e.weeks.slice(0, 3).join(' · ')}`)
    } else if (detected) {
      // 🔴 TRIGGER-BACKTEST-02 — "never" USED TO BE ONE WORD FOR TWO FINDINGS, and only one
      // of them is a finding. A detector whose inputs were never present on any replayed
      // week was not tested: no threshold was reached for it, so its zero says nothing about
      // the rule. That is this repo's `SWEEP-VACUOUS-01` class, and it had already cost once
      // here — `recentLongRunAnalyses` was never assembled, so `long_run_shortfall` could not
      // fire whatever the data said, and its zero sat beside seven genuine ones.
      const seen = inputSeen.get(t) ?? 0
      const spec = specFor(t)
      if (spec?.fedBy === 'other-route') {
        // 🔴 NOT STARVED — UNFED. `buildAdjustmentSignals` does not emit this field at all, so
        // the zero describes THIS HARNESS. Reported as STARVED in the first cut of this table,
        // and I wrote that into the backlog and the roadmap as a fact about runners.
        console.log(`  🚫 ${t.padEnd(22)} UNFED — \`buildAdjustmentSignals\` never emits ${spec.reads.join(', ')}`)
        console.log(`       built by ${spec.producer ?? '(unnamed)'} — this harness CANNOT speak about this detector`)
      } else if (seen === 0) {
        console.log(`  ⚠️ ${t.padEnd(22)} STARVED — inputs present in 0 of ${guardedIn} guarded weeks`)
        console.log(`       reads ${(specFor(t)?.reads ?? []).join(', ')} — nothing to judge, so this is NOT evidence about the rule`)
      } else {
        const rn = inputRunners.get(t)?.size ?? 0
        console.log(`  ⬜ ${t.padEnd(22)} silent — inputs present in ${seen} of ${guardedIn} guarded weeks`
          + ` across ${rn} of ${runnersConsidered} runners, threshold never crossed`)
        if (rn <= 1) console.log(`       ⚠️  ONE runner's data. A threshold not crossed by one person is not a measurement.`)
      }
    } else {
      console.log(`  ⬜ ${t.padEnd(22)} never${' '.repeat(12)}${tag}`)
    }
  }
  const detectedReachable = DETECTED.filter(t => fired.has(t))
  const unfed   = DETECTED.filter(t => !fired.has(t) && specFor(t)?.fedBy === 'other-route')
  const starved = DETECTED.filter(t => !fired.has(t) && specFor(t)?.fedBy !== 'other-route' && (inputSeen.get(t) ?? 0) === 0)
  const silent  = DETECTED.filter(t => !fired.has(t) && specFor(t)?.fedBy !== 'other-route' && (inputSeen.get(t) ?? 0) > 0)
  console.log(`\n  OF THE ${DETECTED.length} WE WOULD CLAIM TO WATCH FOR: ${detectedReachable.length} reachable,`
    + ` ${silent.length} silent, ${starved.length} STARVED, ${unfed.length} UNFED`)
  console.log(`  (${guardedIn} of ${weeksReplayed} week-checks got past \`guardCheck\` — coverage is counted on those)`)
  if (detectedReachable.length) console.log(`    reachable: ${detectedReachable.join(' · ')}`)
  if (silent.length)   console.log(`    silent   : ${silent.join(' · ')}`)
  if (unfed.length) {
    console.log(`    UNFED    : ${unfed.join(' · ')}`)
    console.log(`    🚫 A HARNESS GAP, NOT A DATA GAP. The assembler does not build these fields, so`)
    console.log(`       their zero is about this script. Reporting it as STARVED — which the first`)
    console.log(`       cut did — states a fact about runners that was never measured.`)
  }
  if (starved.length) {
    console.log(`    STARVED  : ${starved.join(' · ')}`)
    console.log(`    ⚠️  A STARVED detector is UNMEASURED, not silent. Quoting it in the silent`)
    console.log(`       column is how a data-coverage gap gets read as a working rule.`)
  }

  console.log('\nPER RUNNER')
  for (const r of perRunner.sort((a, b) => b.checks - a.checks))
    console.log(`  ${r.email.padEnd(36)} weeksReached=${String(r.weeks).padStart(2)} checks=${String(r.checks).padStart(2)} fires=${String(r.fires).padStart(2)}  ${r.types.join(',') || '-'}`)

  if (has('--unmasked')) {
    // 🔴 THE PRIORITY-ORDER PROBLEM, AND HOW IT IS ANSWERED WITHOUT RE-TYPING THE ORDER.
    //
    // `checkAdjustmentTriggers` returns the FIRST match, so a silent trigger may be
    // unreachable OR merely always beaten. The obvious implementation — "for each trigger,
    // neutralise its seniors" — needs a declared senior list, which is a SECOND COPY of the
    // engine's priority order and the single most drift-prone thing in this file.
    //
    // ✅ So the order is OBSERVED, never declared: call the detector, neutralise whatever
    // won, call again. The sequence of winners IS the priority order on that week's data,
    // measured. Anything that appears at peel depth ≥ 1 was reachable and OUTRANKED.
    //
    // ⚠️ AND THE LOOP CHECKS ITS OWN PREMISE. If a neutralisation does not neutralise, the
    // same trigger wins forever; so a repeat winner is a hard error, not a loop. That turns
    // `TRIGGER_INPUTS`'s correctness into a runtime assertion rather than a hope — on top of
    // the 92 arms in `triggerInputs.test.ts` that falsify every entry.
    console.log('\nMASKING ANALYSIS — is a silent trigger unreachable, or just outranked?')
    const outranked = new Map<TriggerType, { n: number; behind: Set<string> }>()
    let peeled = 0, broke = 0
    for (const w of weekInputs) {
      let input = w.input
      const seenHere: TriggerType[] = []
      for (let depth = 0; depth < DETECTED.length + 2; depth++) {
        // 🔴 THE MAIN LOOP CATCHES AND THIS ONE DID NOT (code review 2026-11-09). A week that
        // throws is pushed to `weekInputs` BEFORE the main loop's try, so one malformed week
        // would take down the whole `--unmasked` run through `main().catch` — exit 1, after the
        // main table had already printed, discarding the masking analysis with no explanation.
        // A measurement script must degrade to a named partial, never to a stack trace.
        let out: ReturnType<typeof checkAdjustmentTriggers>
        try {
          out = checkAdjustmentTriggers(input)
        } catch (err) {
          console.log(`  🔴 ${w.email} w${w.weekN} THREW while peeling at depth ${depth}: ${(err as Error).message.slice(0, 80)}`)
          broke++
          break
        }
        if (!out) break
        const t = out.trigger.type
        if (seenHere.includes(t)) {
          console.log(`  🔴 ${t} won twice on ${w.email} w${w.weekN} — its \`neutralise\` does not neutralise.`)
          console.log(`     This is a defect in lib/coaching/triggerInputs.ts, not a finding about the runner.`)
          broke++
          break
        }
        seenHere.push(t)
        if (depth > 0) {
          const e = outranked.get(t) ?? { n: 0, behind: new Set<string>() }
          e.n++; seenHere.slice(0, depth).forEach(s => e.behind.add(s))
          outranked.set(t, e)
        }
        const spec = specFor(t)
        if (!spec) {
          console.log(`  🔴 ${t} has no TRIGGER_INPUTS spec — cannot peel past it.`)
          broke++
          break
        }
        input = spec.neutralise(input)
        peeled++
      }
    }
    if (broke) { console.log(`\n  🔴 ${broke} week(s) could not be peeled. The masking result below is INCOMPLETE.`) }
    console.log(`  peeled ${peeled} trigger(s) across ${weekInputs.length} week-checks\n`)
    for (const t of DETECTED) {
      if (fired.has(t)) { console.log(`  ✅ ${t.padEnd(22)} fires unmasked — nothing to separate`); continue }
      const e = outranked.get(t)
      if (e) {
        console.log(`  🔁 ${t.padEnd(22)} OUTRANKED — would fire on ${e.n} week(s), beaten by ${Array.from(e.behind).join(', ')}`)
      } else if (specFor(t)?.fedBy === 'other-route') {
        console.log(`  🚫 ${t.padEnd(22)} UNFED — peeling cannot help: the assembler never builds its input`)
      } else if ((inputSeen.get(t) ?? 0) === 0) {
        console.log(`  ⚠️ ${t.padEnd(22)} STARVED — still nothing to judge even with seniors peeled`)
      } else {
        console.log(`  ⬜ ${t.padEnd(22)} genuinely silent — inputs present, no threshold crossed at any depth`)
      }
    }
    console.log(`\n  ⚠️  OUTRANKED IS NOT A DEFECT. The route is meant to propose ONE change, and a`)
    console.log(`     senior trigger winning is the design. What this separates is "the rule cannot`)
    console.log(`     fire on real data" from "the rule never gets to speak", which are different`)
    console.log(`     answers to the chair's question and used to share a column.`)
  }

  if (skipped.length) {
    console.log(`\nSKIPPED / THREW (${skipped.length}, ${threw} threw):`)
    for (const s of skipped.slice(0, 15)) console.log(`  ${s}`)
    if (skipped.length > 15) console.log(`  … and ${skipped.length - 15} more`)
  }

  // ADJUST-TRIGGER-REACH-02 (2026-10-16) — this disclaimer still said "a second assembler"
  // a day after BACKTEST-SECOND-ASSEMBLY-01 removed it (the header above was updated, the
  // printed line was not). It now says what is actually still unproven.
  console.log(`\n⚠️  WHAT THIS DOES NOT PROVE: the input is built by the route's own`)
  console.log(`   \`buildAdjustmentSignals\`, but the ROUTE itself (auth, the PAID gate, the writes)`)
  console.log(`   is not run, and nothing here knows whether a firing would have been CORRECT.`)
  console.log(`   Reachability only. A detector needing a 4-week window cannot fire on a`)
  console.log(`   history shorter than that, so "silent" on young plans is not "dead".\n`)
}

main().catch(e => { console.error(e); process.exit(1) })
