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
import { applyRecalibration } from '../lib/plan/ruleEngine'
import { validatePlan } from '../lib/plan/invariants'
import { getCurrentWeek } from '../lib/plan/weekResolution'
import { qualityHeaderPace } from '../lib/plan/qualityHeaderPace'
import { savePlanForUser } from '../lib/plan'
import type { Plan, GeneratorInput, Session, BenchmarkInput } from '../types/plan'

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

    // 🔴 THE DEFECT DESTROYED THE RECORD NEEDED TO REPAIR IT, AND THIS IS THE
    // WORK-AROUND. `applyRecalibration` re-prices a step only when its stored
    // pace is what its anchor meant at the OLD fitness — rebuilt from
    // `meta.vdot`. That rule is correct and it is what stops §22's goal
    // substitution being re-aimed. But the broken writer ALREADY moved
    // `meta.vdot` to the new benchmark and left the steps behind, so on these
    // plans nothing matches its own metadata and a straight re-run is a no-op.
    // Measured: 0 of 3 repaired, 0 sessions changed on two of them.
    //
    // The only surviving record of the fitness those steps were actually priced
    // at is `meta.generator_input.benchmark` — the field the broken writer never
    // updates, which is the same staleness that made my first RCA wrong. So the
    // repair is TWO passes through the same owner, no hand-written metadata:
    //
    //   1. recalibrate to the GENERATOR-INPUT benchmark. The steps already read
    //      that fitness, so they do not move; what moves is `meta`, which now
    //      describes the plan as it actually is. This reconstructs the
    //      self-consistent pre-recalibration state the runner should have had.
    //   2. recalibrate to `meta.benchmark`, the real one. Now every step matches
    //      its own anchor, the accountable rule engages, and the plan is re-priced
    //      exactly as the runner's own confirmed recalibration should have done.
    //
    // ⚠️ A plan with no `generator_input.benchmark` CANNOT be repaired this way,
    // because nothing records what its steps were priced at. It is refused by
    // the gate below rather than guessed at.
    const asPriced = (before.meta.generator_input as GeneratorInput | undefined)?.benchmark as
      BenchmarkInput | undefined
    if (!asPriced?.time || !asPriced?.distance_km) {
      console.log('  SKIP — no meta.generator_input.benchmark, so nothing records the fitness')
      console.log('         these steps were priced at. Not repairable by re-pricing.')
      continue
    }
    console.log(`  as priced   ${asPriced.distance_km}km in ${asPriced.time}`
      + `   (from meta.generator_input — the fitness the STEPS read)`)

    let after: Plan
    try {
      const reconstructed = applyRecalibration(before, asPriced, fromWeekN)
      after = applyRecalibration(reconstructed, bm, fromWeekN)

      // 🔴 PASS 3 — PUT THE HEADERS BACK, BECAUSE THE HEADER IS THE ONE FIELD
      // THE BROKEN WRITER GOT RIGHT.
      //
      // `applyRecalibration` scales the header by the factor its steps moved,
      // which is correct for a real recalibration, where the header and the
      // steps start in sync. Here they do not: the broken writer moved the
      // header to the NEW fitness and left the steps at the old one. So pass 2
      // scales a header that is already at its destination and overshoots —
      // measured 5:36–5:52 -> 6:02–6:19, i.e. a header now SLOWER than its own
      // re-priced steps, which is the original defect inverted and 13 new
      // violations.
      //
      // The correct final header is §120's rule: the band its own work steps
      // run. So it is resolved through `qualityHeaderPace`, the owner of that
      // rule, with the STORED header as the fallback — which is what keeps a
      // §85 mixed-anchor row (whose header is a mean that equals no single step,
      // and which the invariant skips by design) exactly as it was.
      //
      // ⚠️ RESTORING THE STORED HEADER WHOLESALE WAS THE FIRST VERSION AND IT
      // WAS WRONG ON ONE ROW. The broken writer flattened EVERY quality header
      // to the single category band, so for a CV-anchored row the stored value
      // is the THRESHOLD band — restoring it put 5:36–5:52 over re-priced steps
      // at 5:24–5:36 and the gate caught it as a new §120 violation. Right for
      // the threshold rows, wrong for the CV one; the rule is right for both.
      for (const w of after.weeks) {
        const bw = before.weeks.find(x => x.n === w.n)
        if (!bw) continue
        for (const day of Object.keys(w.sessions) as (keyof typeof w.sessions)[]) {
          const a = w.sessions[day], b = bw.sessions[day]
          if (!a || !b || b.pace_target == null) continue
          a.pace_target = qualityHeaderPace({
            derivedSet: a.derived_set ?? null,
            categoryBand: b.pace_target,
          })
        }
      }
    } catch (e) {
      console.log(`  SKIP — applyRecalibration threw: ${(e as Error).message.split('\n')[0]}`)
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
