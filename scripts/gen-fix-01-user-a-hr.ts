/**
 * GEN-FIX-01 Stage 1 — correct one user's max HR (2026-08-06 plan-defect incident).
 *
 * WHY THIS EXISTS
 * The wizard passed HealthKit's highest-ever recorded heart-rate sample as
 * physiological max HR. For a runner who has never worn a sensor during a hard
 * effort that value is far too low, which drags every HR target in the plan
 * down with it. See docs/incidents/2026-08-06-plan-defects/analysis.md §6.
 *
 * WHAT IT DOES
 * Exactly what the in-app Profile HR editor does (DashboardClient `onHRChange`),
 * run server-side for one user:
 *   1. user_settings.max_hr / resting_hr      — the live source of truth
 *   2. plans.plan_json.meta.{max_hr, resting_hr, zone2_ceiling} — kept in sync so
 *      the server-side fallback paths (lib/strava.ts, /api/race-times) don't
 *      diverge from user_settings
 * It does NOT regenerate the plan. Session IDs, completion state and the trial
 * clock are untouched; `getSessionHRDisplay` recomputes every displayed HR
 * target live from user_settings, so the correction is visible immediately.
 *
 * WHAT IT DOES NOT FIX
 * HealthKit-sourced runs keep their stale hr_pct_z* buckets — raw samples aren't
 * stored server-side so they can't be re-bucketed (analysis N7). This user has
 * no run_analysis rows, so nothing user-visible depends on them today.
 *
 * IDENTIFICATION
 * The user is located by matching the incident plan's meta signature, not by a
 * hardcoded id — no identifier is committed to the repo, and the match itself is
 * the confirmation. Aborts unless exactly one row matches.
 *
 * USAGE
 *   npx tsx scripts/gen-fix-01-user-a-hr.ts            # dry run — prints the diff, writes nothing
 *   npx tsx scripts/gen-fix-01-user-a-hr.ts --apply    # performs the two writes
 *   npx tsx scripts/gen-fix-01-user-a-hr.ts --survey   # read-only: who else looks like this?
 *
 * Requires .env.local (SUPABASE_SERVICE_ROLE_KEY). Safe to re-run: idempotent.
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

// Plan signature of the affected plan. Distinctive enough to identify exactly
// one row without embedding a user id.
const SIGNATURE = { plan_start: '2026-08-03', race_date: '2026-11-18', max_hr: 138 } as const

// Tanaka (208 − 0.7 × age) — the documented default this plan should have used.
// An estimate with a ~10 bpm population SD, NOT a measurement. It is replaced the
// moment GEN-FIX-04's time trial produces a real maximal-effort reading.
const tanaka = (age: number) => Math.round(208 - 0.7 * age)

// Karvonen Z2 ceiling — mirrors GENERATION_CONFIG.ZONES.Z2.karvonen_pct[1] (70)
// and the inline formula the Profile editor uses.
const z2Ceiling = (restingHr: number, maxHr: number) => Math.round(restingHr + 0.70 * (maxHr - restingHr))

function env(): Record<string, string> {
  return Object.fromEntries(
    fs.readFileSync('.env.local', 'utf8').split('\n').filter(Boolean).map(l => {
      const i = l.indexOf('=')
      return [l.slice(0, i), l.slice(i + 1)]
    }),
  )
}

async function main() {
  const apply  = process.argv.includes('--apply')
  const survey = process.argv.includes('--survey')
  const e = env()
  const db = createClient(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY)

  const { data: plans, error } = await db.from('plans').select('user_id, plan_json')
  if (error) throw new Error(`plans read failed: ${error.message}`)

  // ── --survey: read-only blast-radius check (analysis open question 3) ──────
  if (survey) {
    console.log('Plans whose max_hr deviates >15% from Tanaka (read-only survey):\n')
    let flagged = 0
    for (const p of plans ?? []) {
      const m = (p.plan_json as any)?.meta
      if (!m?.age || !m?.max_hr) continue
      const expected = tanaka(m.age)
      const deviation = (m.max_hr - expected) / expected
      if (Math.abs(deviation) > 0.15) {
        flagged++
        console.log(
          `  age ${m.age}  max_hr ${m.max_hr}  (Tanaka ${expected}, ${(deviation * 100).toFixed(0)}%)` +
          `  z2 ${m.zone2_ceiling} → would be ${z2Ceiling(m.resting_hr, expected)}` +
          `  method=${m.hr_zone_method ?? '?'}  note=${m.hr_assumption_note ? 'present' : 'ABSENT'}`,
        )
      }
    }
    console.log(`\n${flagged} of ${plans?.length ?? 0} plans flagged.`)
    console.log('No identifiers printed. Rows are aggregate-only by design.')
    return
  }

  // ── Identify ──────────────────────────────────────────────────────────────
  const matches = (plans ?? []).filter(p => {
    const m = (p.plan_json as any)?.meta
    return m?.plan_start === SIGNATURE.plan_start
        && m?.race_date  === SIGNATURE.race_date
        && m?.max_hr     === SIGNATURE.max_hr
  })

  if (matches.length !== 1) {
    console.error(`ABORT — expected exactly 1 matching plan, found ${matches.length}.`)
    console.error('Either the plan was already corrected, or the signature no longer identifies one row.')
    process.exit(1)
  }

  const row  = matches[0]
  const meta = (row.plan_json as any).meta
  const age  = meta.age as number
  const rhr  = meta.resting_hr as number

  const newMax = tanaka(age)
  const newZ2  = z2Ceiling(rhr, newMax)

  console.log('GEN-FIX-01 Stage 1 — HR correction\n')
  console.log(`  age                 ${age}`)
  console.log(`  resting_hr          ${rhr}          (unchanged)`)
  console.log(`  max_hr              ${meta.max_hr}  →  ${newMax}   (Tanaka 208 − 0.7 × ${age})`)
  console.log(`  zone2_ceiling       ${meta.zone2_ceiling}  →  ${newZ2}   (Karvonen 70% of reserve)`)
  console.log(`  hr_zone_method      ${meta.hr_zone_method}`)
  console.log(`  hr_assumption_note  ${meta.hr_assumption_note ? 'present' : 'ABSENT — user was never told 138 was an inference'}`)
  console.log(`\n  writes: user_settings (1 row) + plans.plan_json.meta (1 row). No regeneration.`)

  if (!apply) {
    console.log('\nDRY RUN — nothing written. Re-run with --apply to perform the two writes.')
    return
  }

  // ── Write 1: user_settings — the live source of truth for all HR display ──
  const { error: sErr } = await db.from('user_settings')
    .update({ max_hr: newMax, resting_hr: rhr, updated_at: new Date().toISOString() })
    .eq('id', row.user_id)
  if (sErr) throw new Error(`user_settings update failed: ${sErr.message}`)
  console.log('\n  ✓ user_settings updated')

  // ── Write 2: plan meta — keeps server-side fallback paths consistent ───────
  const updatedPlan = {
    ...(row.plan_json as any),
    meta: { ...meta, max_hr: newMax, resting_hr: rhr, zone2_ceiling: newZ2 },
  }
  const { error: pErr } = await db.from('plans')
    .update({ plan_json: updatedPlan, updated_at: new Date().toISOString() })
    .eq('user_id', row.user_id)
  if (pErr) throw new Error(`plans update failed: ${pErr.message}`)
  console.log('  ✓ plans.plan_json.meta updated')

  console.log('\nDone. Verify in-app: every session HR target should now read "< 146 bpm".')
  console.log('Reversible: re-run with SIGNATURE.max_hr = 178 and tanaka() replaced by () => 138.')
}

main().catch(err => { console.error(err); process.exit(1) })
