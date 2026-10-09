/* RECAL-LIVE-REPAIR-01 — re-price the live plans whose work steps were left at a
 * fitness their runner no longer has.
 *
 * WHY A SCRIPT. `RECAL-PACE-TWO-WRITER-01` fixed `applyRecalibration`, and the
 * fix reaches NO EXISTING PLAN: the live-plan policy is new-plans-only, and a
 * recalibration only re-prices when a runner logs a new benchmark and confirms.
 * These runners already confirmed theirs — against the broken writer.
 *
 * WHAT IT DOES. Re-runs the CORRECTED `applyRecalibration` with each plan's OWN
 * stored `meta.benchmark`, from the week the route would use. Nothing is
 * regenerated, no variant is re-chosen, no session is substituted, and the
 * work-minute dose is never written (§125, Coaching Board RECAL-SIZING-PROPERTY-01).
 * It is the same code path the runner's own next recalibration would take.
 *
 * ⚠️ THE POPULATION IS MEASURED, NEVER TYPED OUT. Plans are selected by
 * `INV-PLAN-STEP-PACE-FROM-GUIDE` firing on the STORED plan. A hand-written list
 * of three ids would have been a list of the plans I happened to look at, and
 * this repo has shipped four checks whose population could not contain the defect.
 *
 * SAFETY
 *   · DRY-RUN BY DEFAULT. `--apply` writes. Nothing else writes anything.
 *   · Per-plan before/after diff printed in both modes, so the dry run IS the
 *     review.
 *   · REFUSES TO WRITE a plan whose repair does not clear the defect, or which
 *     gains any new error code. Checked per plan, before that plan is touched.
 *   · Archives the prior plan to `plan_archive` first, and skips the write if the
 *     archive fails — `savePlanForUser` only archives on a RACE CHANGE, and the
 *     race is not changing here, so this has to be explicit.
 *   · Writes through `savePlanForUser`, the single owner of a plan write (it
 *     re-validates, throws on a failed upsert, and clears the stale
 *     `plan_weekly_notes` cache).
 *   · `--only <id-prefix>` to do one plan at a time.
 *
 * RUN
 *   npx tsx scripts/recal-live-repair.ts                      # review the diffs
 *   npx tsx scripts/recal-live-repair.ts --only c5d3ae8b      # one plan
 *   npx tsx scripts/recal-live-repair.ts --apply              # write
 *   npx tsx scripts/recal-live-repair.ts --verify             # read back; see § VERIFY
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import {
  repriceWeeksFrom, buildFallbackPace, applyVdotDiscount, calcVDOTFromBenchmark,
} from '../lib/plan/ruleEngine'
import { buildPaceFromVDOT } from '../lib/plan/paceBands'
import { validatePlan } from '../lib/plan/invariants'
import { getCurrentWeek } from '../lib/plan/weekResolution'
import { qualityHeaderPace } from '../lib/plan/qualityHeaderPace'
import { savePlanForUser } from '../lib/plan'
import type { Plan, GeneratorInput, Session, BenchmarkInput } from '../types/plan'
import type { PaceGuide } from '../lib/plan/paceBands'
import type { FitnessLevel } from '../lib/plan/fitnessAssessment'

const APPLY  = process.argv.includes('--apply')
const VERIFY = process.argv.includes('--verify')
const ONLY   = (() => {
  const i = process.argv.indexOf('--only')
  return i >= 0 ? process.argv[i + 1] : null
})()

const CODE = 'INV-PLAN-STEP-PACE-FROM-GUIDE'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter(Boolean).map(l => {
    const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]
  }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const errCodes = (p: Plan, gi: GeneratorInput) =>
  validatePlan(p, gi).filter(v => v.severity === 'error')

const stale = (p: Plan, gi: GeneratorInput) => errCodes(p, gi).filter(v => v.code === CODE)

/** Work-step paces of a session, in order, for the diff. */
const steps = (s: Session): string[] =>
  (s.derived_set?.blocks ?? []).flatMap(b => b.steps)
    .filter(st => st.role === 'work' && st.pace).map(st => st.pace as string)

interface Row { id: string; user_id: string; plan_json: Plan; updated_at: string }

async function load(): Promise<Row[]> {
  const { data, error } = await sb.from('plans').select('id, user_id, plan_json, updated_at')
  if (error) { console.error(`query failed: ${error.message}`); process.exit(2) }
  return (data ?? []) as Row[]
}

/**
 * § VERIFY — and read this before trusting it.
 *
 * ⚠️ A NON-ZERO READING MEANS "NOT REPAIRED YET", NOT "THE REPAIR FAILED". The
 * two are indistinguishable from the violation count alone, which is why
 * `updated_at` is printed beside it: a write moves it, so an unchanged timestamp
 * with a non-zero count means the script never ran on that plan.
 *
 *   count 0                      → repaired.
 *   count > 0, old updated_at    → not run yet. Run with --apply.
 *   count > 0, fresh updated_at  → it ran and did NOT fix it. Stop and tell me.
 *
 * This is the only honest form for a live-data check: there is no local
 * before/after to prove the predicate against, so it has to say what every
 * outcome means, including the one where nothing happened.
 */
async function verify() {
  console.log(`RECAL-LIVE-REPAIR-01 · VERIFY · ${new Date().toISOString()}\n`)
  let dirty = 0
  for (const r of await load()) {
    const gi = r.plan_json?.meta?.generator_input as GeneratorInput | undefined
    if (!r.plan_json?.weeks?.length || !gi) continue
    const n = stale(r.plan_json, gi).length
    if (n === 0) continue
    dirty++
    console.log(`${r.id.slice(0, 8)}  ${String(n).padStart(2)} stale session(s)  updated_at ${r.updated_at}`)
  }
  console.log(`\n${dirty === 0
    ? 'CLEAN — no stored plan carries a step priced at a fitness its runner no longer has.'
    : `${dirty} plan(s) still carry it. Compare updated_at above against when you ran --apply:`
      + `\n  old timestamp  -> never ran on that plan; run with --apply`
      + `\n  fresh timestamp -> it ran and did not fix it; stop and report this`}`)
}

async function main() {
  if (VERIFY) return verify()

  console.log(`RECAL-LIVE-REPAIR-01 · ${APPLY ? 'APPLY (WRITING)' : 'DRY-RUN (nothing is written)'}`
    + `${ONLY ? ` · only ${ONLY}` : ''}\n`)

  const rows = await load()
  const targets = rows.filter(r => {
    const gi = r.plan_json?.meta?.generator_input as GeneratorInput | undefined
    if (!r.plan_json?.weeks?.length || !gi) return false
    if (ONLY && !r.id.startsWith(ONLY)) return false
    return stale(r.plan_json, gi).length > 0
  })

  console.log(`${rows.length} stored plans · ${targets.length} carry the defect`
    + `${ONLY ? ' (filtered)' : ''}\n`)
  if (targets.length === 0) {
    console.log('Nothing to repair.')
    return
  }

  let repairable = 0
  const applied: string[] = []

  for (const r of targets) {
    const before = r.plan_json
    const gi = before.meta.generator_input as GeneratorInput
    const bm = before.meta.benchmark as BenchmarkInput | undefined
    const short = r.id.slice(0, 8)
    const email = await sb.from('user_settings').select('email').eq('id', r.user_id).single()
      .then(x => (x.data?.email as string) ?? '')

    console.log('─'.repeat(78))
    console.log(`PLAN ${short}  ${email}`)
    console.log(`  race        ${before.meta.race_name ?? '—'}  ${before.meta.race_date ?? '—'}`
      + `   starts ${before.meta.plan_start ?? '—'}`)

    if (!bm?.time || !bm?.distance_km) {
      console.log('  SKIP — no stored meta.benchmark, so there is nothing to re-price FROM.')
      continue
    }

    // Exactly what `/api/recalibrate-zones` does, so the repair is the path the
    // runner's own next recalibration would take — not a second one.
    const fromWeekN = getCurrentWeek(before.weeks)?.n ?? 1
    console.log(`  benchmark   ${bm.distance_km}km in ${bm.time}   re-pricing from week ${fromWeekN}`)

    const completions = await sb.from('session_completions')
      .select('week_n', { count: 'exact', head: true }).eq('user_id', r.user_id)
    console.log(`  completions ${completions.count ?? 0} logged`
      + `   (weeks before ${fromWeekN} are not touched)`)

    // 🔴 THE DEFECT DESTROYED THE RECORD OF WHAT THE STEPS READ, SO THE CALLER
    // HAS TO SUPPLY IT. `applyRecalibration` derives the OLD pace guide from
    // `meta.vdot`, which is right for a live recalibration and useless here: the
    // broken writer moved `meta.vdot` forward and left the steps behind, so on a
    // damaged plan the metadata describes a fitness the steps never had. The
    // first version of this script ran `applyRecalibration` straight and was a
    // NO-OP on all three plans for exactly that reason.
    //
    // `repriceWeeksFrom` takes the as-priced guide as a PARAMETER, so this says
    // explicitly what the steps read. There are two ways a plan can have been
    // priced, and BOTH are in the live data:
    //
    //   (a) FROM A BENCHMARK — `meta.generator_input.benchmark` survives, because
    //       it is the field the broken writer never updates. Same VDOT path
    //       generation used, discount included.
    //
    //   (b) FROM THE LEVEL TABLE — a runner who generated a plan with NO
    //       benchmark gets `buildFallbackPace(level)`, a hardcoded table, not a
    //       VDOT. ⚠️ I first called this plan unrepairable because the script
    //       only knew (a). It is not: its stale steps are the `intermediate`
    //       row verbatim — easy `6:30–7:30`, and CV `5:21–5:34` from quality
    //       5:45 × 0.95 — and **no VDOT between 25 and 55 produces either band**,
    //       which is how the table was identified rather than guessed.
    const giBm = (before.meta.generator_input as GeneratorInput | undefined)?.benchmark as
      BenchmarkInput | undefined
    const level = (before.meta.fitness_level_declared ?? before.meta.fitness_level
      ?? (before.meta.generator_input as GeneratorInput | undefined)?.user_declared_level) as
      FitnessLevel | undefined

    let asPriced: PaceGuide | null = null
    if (giBm?.time && giBm?.distance_km) {
      const raw = calcVDOTFromBenchmark(giBm)
      const { vdot } = applyVdotDiscount(raw, giBm, new Date())
      asPriced = buildPaceFromVDOT(Math.round(vdot * 10) / 10, Math.round(raw * 10) / 10)
      console.log(`  as priced   BENCHMARK ${giBm.distance_km}km in ${giBm.time}`
        + `  ->  easy ${asPriced.easyPaceStr}  T ${asPriced.qualityPaceStr}`)
    } else if (level && ['beginner', 'intermediate', 'experienced'].includes(level)) {
      asPriced = buildFallbackPace(level)
      console.log(`  as priced   LEVEL TABLE "${level}" (no benchmark at generation)`
        + `  ->  easy ${asPriced.easyPaceStr}  T ${asPriced.qualityPaceStr}`)
    }
    if (!asPriced) {
      console.log('  SKIP — neither a stored benchmark nor a declared level, so nothing')
      console.log('         records what these steps were priced at. Not repairable.')
      continue
    }

    const nowPace = before.meta.vdot != null && before.meta.vdot_training_anchor != null
      ? buildPaceFromVDOT(before.meta.vdot_training_anchor, before.meta.vdot)
      : null
    if (!nowPace) {
      console.log('  SKIP — the plan stamps no VDOT, so there is no current guide to re-price TO.')
      continue
    }
    console.log(`  re-price to easy ${nowPace.easyPaceStr}  T ${nowPace.qualityPaceStr}`
      + `  (from meta.vdot ${before.meta.vdot})`)

    let after: Plan
    try {
      after = JSON.parse(JSON.stringify(before)) as Plan
      repriceWeeksFrom(after, asPriced, nowPace, fromWeekN)

      // 🔴 THE HEADER IS RESOLVED, NOT SCALED, AND IT WAS WRONG TWICE BEFORE THIS.
      // `repriceWeeksFrom` scales the header by the factor its steps moved, which
      // is correct for a live recalibration where the two start in sync. Here they
      // do not: the broken writer moved the header to the NEW fitness and left the
      // steps at the old one, so scaling overshoots — measured 5:36–5:52 ->
      // 6:02–6:19, a header SLOWER than its own re-priced steps, 13 new violations.
      // Restoring the stored value wholesale was then wrong on ONE row, because the
      // writer flattened EVERY quality header to the category band and a
      // CV-anchored row's stored header is therefore the THRESHOLD band.
      //
      // §120's rule is right for both: the header is the band its own work steps
      // run. Resolved through `qualityHeaderPace`, its owner, with the stored value
      // as the fallback — which leaves a §85 mixed-anchor row (a mean that equals
      // no single step, skipped by the invariant by design) exactly as it was.
      // ⚠️ ONLY WHERE THE STEPS ACTUALLY MOVED, AND THE FIRST VERSION MISSED
      // THIS. Resolving the header from a session whose steps were NOT re-priced
      // makes the header match a STALE step — which is this defect inverted, and
      // strictly worse than leaving it alone. Measured on `8a2858ab`: it would
      // have pulled four correct headers from 5:24–5:39 to 4:48–5:00 and
      // 4:15–4:25, i.e. FASTER, on a runner whose fitness had gone the other
      // way. The gate refused that plan for an unrelated reason, which is luck,
      // not design.
      for (const w of after.weeks) {
        const bw = before.weeks.find(x => x.n === w.n)
        if (!bw) continue
        for (const day of Object.keys(w.sessions) as (keyof typeof w.sessions)[]) {
          const a = w.sessions[day], b = bw.sessions[day]
          if (!a || !b || b.pace_target == null) continue
          if (steps(a).join(',') === steps(b).join(',')) continue   // steps held — leave the header
          a.pace_target = qualityHeaderPace({
            derivedSet: a.derived_set ?? null,
            categoryBand: b.pace_target,
          })
        }
      }
    } catch (e) {
      console.log(`  SKIP — re-pricing threw: ${(e as Error).message.split('\n')[0]}`)
      continue
    }

    // ── the per-plan diff ────────────────────────────────────────────────────
    const staleBefore = stale(before, gi)
    const wk = new Map(after.weeks.map(w => [w.n, w]))
    let changed = 0
    for (const w of before.weeks) {
      const aw = wk.get(w.n)
      if (!aw) continue
      for (const [day, b] of Object.entries(w.sessions) as [string, Session | undefined][]) {
        const a = aw.sessions[day as keyof typeof aw.sessions]
        if (!b || !a) continue
        const bs = steps(b).join(', '), as_ = steps(a).join(', ')
        if (b.pace_target === a.pace_target && bs === as_) continue
        changed++
        console.log(`    w${String(w.n).padStart(2)} ${day}  ${b.label}`)
        if (b.pace_target !== a.pace_target) {
          console.log(`         header  ${b.pace_target}  ->  ${a.pace_target}`)
        }
        if (bs !== as_) console.log(`         steps   ${bs}  ->  ${as_}`)
        // Named explicitly, because these are the two §125 promises a reviewer
        // most needs to see held rather than asserted.
        if (b.duration_mins !== a.duration_mins) {
          console.log(`         🔴 DOSE MOVED ${b.duration_mins} -> ${a.duration_mins} — §125 clause 1 breach, REPORT THIS`)
        }
        if (b.catalogue_id !== a.catalogue_id) {
          console.log(`         🔴 SESSION SUBSTITUTED ${b.catalogue_id} -> ${a.catalogue_id} — §125 clause 2 breach, REPORT THIS`)
        }
      }
    }

    const errsBefore = errCodes(before, gi)
    const errsAfter = errCodes(after, gi)
    const wasKeys = new Set(errsBefore.map(v => `${v.code}|${v.week}|${v.message}`))
    const introduced = errsAfter.filter(v => !wasKeys.has(`${v.code}|${v.week}|${v.message}`))
    const staleAfter = stale(after, gi)

    console.log(`  sessions changed ${changed}`)
    console.log(`  ${CODE}: ${staleBefore.length} -> ${staleAfter.length}`)
    console.log(`  total error violations: ${errsBefore.length} -> ${errsAfter.length}`
      + `   introduced: ${introduced.length}`)
    for (const v of introduced.slice(0, 5)) console.log(`    NEW ${v.code} w${v.week}: ${v.message}`)

    // ── the gate ─────────────────────────────────────────────────────────────
    if (staleAfter.length > 0) {
      for (const v of staleAfter) console.log(`    STILL STALE w${v.week}: ${v.message}`)
      console.log(`  REFUSED — the repair does not clear the defect (${staleAfter.length} left).`)
      continue
    }
    if (introduced.length > 0) {
      console.log(`  REFUSED — the repair introduces ${introduced.length} new violation(s).`)
      continue
    }
    // Pass 3 restores the headers; this is what proves it was the right call
    // rather than a convenient one. §120: the header IS the work pace, ±3%.
    const hdrAfter = errsAfter.filter(v => v.code === 'INV-PLAN-HEADER-PACE-MATCHES-WORK')
    const hdrBefore = errsBefore.filter(v => v.code === 'INV-PLAN-HEADER-PACE-MATCHES-WORK')
    console.log(`  INV-PLAN-HEADER-PACE-MATCHES-WORK: ${hdrBefore.length} -> ${hdrAfter.length}`)
    if (hdrAfter.length > 0) {
      console.log(`  REFUSED — ${hdrAfter.length} session(s) still show a header their own steps contradict.`)
      continue
    }
    if (changed === 0) {
      console.log('  REFUSED — nothing changed, so this plan is not repairable by re-pricing.')
      continue
    }
    repairable++
    for (const v of errsAfter) console.log(`    residual (pre-existing, not a pricing fault) ${v.code} w${v.week}`)
    console.log('  ✅ REPAIRABLE — defect cleared, nothing introduced, dose and variants untouched.')

    if (!APPLY) continue

    const arch = await sb.from('plan_archive').insert({
      user_id: r.user_id, plan_json: before,
      race_name: before.meta.race_name ?? null, race_date: before.meta.race_date ?? null,
    })
    if (arch.error) {
      console.log(`  ! ARCHIVE FAILED (${arch.error.message}) — NOT writing this plan.`)
      continue
    }
    try {
      await savePlanForUser(r.user_id, after, sb as never)
      applied.push(short)
      console.log('  WRITTEN (prior plan archived first).')
    } catch (e) {
      console.log(`  ! WRITE FAILED: ${(e as Error).message}`)
    }
  }

  console.log('─'.repeat(78))
  console.log(`Repairable: ${repairable} of ${targets.length}`)
  if (APPLY) {
    console.log(`WRITTEN: ${applied.length}${applied.length ? ` — ${applied.join(', ')}` : ''}`)
    console.log('Now run with --verify. A non-zero count there means NOT REPAIRED YET,')
    console.log('not "repair failed" — read updated_at beside it (see § VERIFY in this file).')
  } else {
    console.log('DRY-RUN — nothing written. Review the diffs above, then re-run with --apply.')
  }
}
main()
