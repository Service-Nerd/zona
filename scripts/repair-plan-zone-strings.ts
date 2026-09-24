// repair-plan-zone-strings.ts — PLAN-LEGACY-ZONE-STRING-01 + PLAN-VO2MAX-BAND-01.
//
// Two repairs on live plans, deliberately in one script because they touch the
// same field and must not be run against each other.
//
// ── PASS 1: RESTORE what I broke (PLAN-VO2MAX-BAND-01) ───────────────────────
//
// `applyHrToPlan` shipped today deciding the HR band from `session.type ===
// 'quality'`. A VO2max session IS typed quality — the type is the slot, the
// CATALOGUE CATEGORY is the stimulus — so running `backfill-plan-hr.ts --apply`
// rewrote plan `8a2858ab` weeks 5 and 9 from
//
//     "Zone 4–5"  157–182 bpm      ->      "Zone 3"  145–156 bpm
//
// a VO2max session downgraded to threshold, header and coach note moved together
// so the card looked consistent and wrong.
//
// Pass 1 re-runs the now-correct owner against that plan's own meta. It does NOT
// copy the archive back: the archived sessions read `157–182 bpm` while the
// plan's meta says max 179, whose intervals band is `156–179 bpm` — the archive
// was itself stale, sitting in the PLAN-ZONE-VS-HRTARGET-01 state this morning
// fixed. **Restoring it would have re-introduced one defect while repairing
// another.** The first cut did try, and its own guard refused; that refusal is
// what found this.
//
// ── PASS 2: the §84 zone strings (PLAN-LEGACY-ZONE-STRING-01) ────────────────
//
// 16 quality sessions across live plans carry `zone: "Zone 3–4"` beside an
// `hr_target` that is the Zone-3-only band. §84 Amendment (Coaching Board
// 2026-09-04) is explicit that the zone STRING must describe the HR string it
// sits beside, and names `"Zone 3–4"` next to `qualityHR` as the defect it was
// written for. These plans predate that fix.
//
// 🔴 THE REPAIR NEVER WRITES `hr_target`. It reads the band the session ALREADY
// HAS and sets `zone` to the string that describes it. So it cannot change what
// any runner is told to do — that is a property of the code, not a promise, and
// it is the direct lesson of pass 1: the previous repair changed a prescription
// because it recomputed a value it did not need to touch.
//
// A session whose `hr_target` matches NEITHER band is left alone and reported.
// Guessing is what this script exists to undo.
//
// Dry run by default. Archives before writing. Refuses on any new violation.
//
//   npx tsx scripts/repair-plan-zone-strings.ts
//   npx tsx scripts/repair-plan-zone-strings.ts --apply

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { computeZones, applyHrToPlan } from '../lib/plan/zones'
import { validatePlan } from '../lib/plan/invariants'

/** The plan damaged by PLAN-VO2MAX-BAND-01, named explicitly rather than matched by shape. */
const DAMAGED = { planPrefix: '8a2858ab' }

function env() {
  return Object.fromEntries(
    readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('='))
      .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
  ) as Record<string, string>
}

interface Row { id: string; user_id: string; plan_json: Record<string, unknown> }
type Sess = { type?: string; zone?: string; hr_target?: string }

async function main(): Promise<number> {
  const apply = process.argv.includes('--apply')
  const e = env()
  const sb = createClient(e.NEXT_PUBLIC_SUPABASE_URL!, e.SUPABASE_SERVICE_ROLE_KEY!)

  const { data, error } = await sb.from('plans').select('id, user_id, plan_json')
  if (error) { console.error('read failed:', error.message); return 1 }
  const plans = (data ?? []) as Row[]

  let changedPlans = 0, changedSessions = 0, restored = 0, unresolvable = 0, refused = 0

  for (const row of plans) {
    const prior = row.plan_json
    const meta = (prior?.meta ?? {}) as Record<string, unknown>
    const mhr = meta.max_hr as number | undefined
    if (typeof mhr !== 'number' || mhr <= 0) continue
    const z = computeZones(mhr, meta.resting_hr as number | undefined)
    const input = (meta.generator_input ?? meta) as never
    const before = validatePlan(prior as never, input)

    const next = JSON.parse(JSON.stringify(prior)) as Record<string, unknown>
    const notes: string[] = []

    // ── PASS 1 ── put the damaged sessions back in the INTERVALS band.
    //
    // 🔴 NOT "RESTORE FROM THE ARCHIVE", AND THE FIRST CUT OF THIS SCRIPT TRIED
    // TO. Its guard refused, correctly, and the reason is the finding: the
    // archived sessions read `157–182 bpm` while that plan's own meta says
    // max 179 / resting 64, whose intervals band is `156–179 bpm`. The archive
    // was itself STALE — that plan was sitting in the PLAN-ZONE-VS-HRTARGET-01
    // state, meta corrected and sessions left on an older max. **Copying the
    // archive back would have re-introduced this morning's defect on top of
    // repairing this afternoon's.**
    //
    // So the repair re-runs the now-correct owner against the plan's own meta.
    // `applyHrToPlan` was right to move the band; it was wrong about WHICH band,
    // and `hrBandFor` is the fix. ⚠️ One of the two sessions is `hill_reps` —
    // EFFORT-GOVERNED, not `category: 'vo2max'` — so a fix that had special-cased
    // the vo2max category alone would have left it in the threshold band.
    if (row.id.startsWith(DAMAGED.planPrefix)) {
      const rhr = meta.resting_hr as number | undefined
      const fixed = applyHrToPlan(JSON.parse(JSON.stringify(prior)) as never, rhr as never, mhr) as {
        weeks: { n: number; sessions: Record<string, Sess> }[]
      }
      for (const w of (next.weeks as { n: number; sessions: Record<string, Sess> }[])) {
        const from = fixed.weeks.find(x => x.n === w.n)
        if (!from) continue
        for (const [day, s] of Object.entries(w.sessions ?? {})) {
          const want = from.sessions?.[day]
          if (!s || !want || want.hr_target !== z.intervalsHR || s.hr_target === want.hr_target) continue
          notes.push(`    RESTORE w${w.n} ${day}: "${s.zone}" ${s.hr_target} -> "${want.zone}" ${want.hr_target}`)
          s.zone = want.zone; s.hr_target = want.hr_target
          restored++
        }
      }
    }

    // ── PASS 2 ── the zone string is set from the band the session ALREADY has.
    for (const w of (next.weeks as { n: number; sessions: Record<string, Sess> }[])) {
      for (const [day, s] of Object.entries(w.sessions ?? {})) {
        if (!s || typeof s.hr_target !== 'string' || typeof s.zone !== 'string') continue
        if (s.type !== 'quality' && s.type !== 'hard') continue
        const want = s.hr_target === z.qualityHR ? z.qualityZone
                   : s.hr_target === z.intervalsHR ? z.intervalsZone
                   : null
        if (want === null) {
          unresolvable++
          notes.push(`    SKIP w${w.n} ${day}: hr_target "${s.hr_target}" matches neither band — left alone`)
          continue
        }
        if (s.zone === want) continue
        notes.push(`    ZONE w${w.n} ${day}: "${s.zone}" -> "${want}"   (hr_target "${s.hr_target}" unchanged)`)
        s.zone = want
        changedSessions++
      }
    }

    if (!notes.length) continue
    const after = validatePlan(next as never, input)
    const grew = after.filter(v => !before.some(b => b.code === v.code && b.week === v.week))
    const CODE = 'INV-PLAN-DISPLAY-ZONE-MATCHES-WORK'
    console.log(`\n  ${row.id.slice(0, 8)}  mhr=${mhr} rhr=${meta.resting_hr ?? '(absent)'}`)
    notes.forEach(n => console.log(n))
    console.log(`    ${CODE}: ${before.filter(v => v.code === CODE).length} -> ${after.filter(v => v.code === CODE).length}`
      + `   (all violations ${before.length} -> ${after.length})`)
    if (grew.length) { console.error(`    ✗ REFUSING — introduces ${grew.length} new violation(s): ${grew.map(v => v.code).join(', ')}`); refused++; continue }
    changedPlans++
    if (!apply) continue

    const a = await sb.from('plan_archive').insert({
      user_id: row.user_id, plan_json: prior,
      race_name: (meta.race_name as string) ?? null, race_date: (meta.race_date as string) ?? null,
    })
    if (a.error) { console.error(`    ✗ archive failed, NOT writing: ${a.error.message}`); refused++; continue }
    const u = await sb.from('plans').update({ plan_json: next }).eq('id', row.id)
    if (u.error) { console.error(`    ✗ write failed: ${u.error.message}`); refused++; continue }
    console.log('    ✓ archived and written')
  }

  console.log(`\n${changedPlans} plan(s) · ${changedSessions} zone string(s) · ${restored} session(s) restored`
    + ` · ${unresolvable} left alone · ${refused} refused`)
  if (!apply && changedPlans) console.log('DRY RUN — nothing written. Re-run with --apply to commit.')
  return refused ? 1 : 0
}

main().then(c => process.exit(c)).catch(e => { console.error(e); process.exit(1) })
