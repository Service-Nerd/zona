// backfill-plan-hr.ts — PLAN-ZONE-VS-HRTARGET-01, 2026-09-24.
//
// Re-derives every session's HR band from the plan's OWN `meta`, for plans whose
// HR was corrected after generation and whose sessions were left behind.
//
// ⚠️ A SECOND DELIBERATE ONE-OFF AGAINST THE LIVE-PLAN POLICY, founder-directed.
// The standing rule (2026-08-20) is that fixes apply to NEW plans only. This is
// not a doctrine change reaching backwards — it is the runner's OWN corrected
// heart rate, which we already accepted into `meta`, finally reaching the
// sessions it was supposed to. **Not a precedent.**
//
// ── WHAT IT FIXES, AS THE RUNNER SEES IT ─────────────────────────────────────
//
// The session-detail HEADER derives its bpm from `session.zone` + `meta`; the
// coach note renders `hr_target`. When HR was corrected, only `meta` moved — so
// one card read "Zone 3 · 161–175 bpm" above "158–171 bpm". Measured at the time
// of writing: 6 of 22 live plans, every quality session of each.
//
// ── WHY IT IS SAFE ───────────────────────────────────────────────────────────
//
// It calls `applyHrToPlan`, the same owner the app now uses, with the plan's own
// `meta.resting_hr` / `meta.max_hr` — the values already accepted as that
// runner's truth. Nothing is invented and no new number enters the system. Only
// `hr_target`, `zone` and `meta.zone2_ceiling` move; distance, duration, day,
// week, label and coach notes are untouched, so `week_n`/`day` keys survive and
// completions, run links and overrides keep pointing at the right sessions.
//
// Dry run by default. Archives the prior plan before writing. Re-validates and
// REFUSES to write if the edit introduces any new violation code.
//
// Run:
//   npx tsx scripts/backfill-plan-hr.ts                 # dry run, all plans
//   npx tsx scripts/backfill-plan-hr.ts --plan e49ea589 # dry run, one plan
//   npx tsx scripts/backfill-plan-hr.ts --apply

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { applyHrToPlan } from '../lib/plan/zones'
import { validatePlan } from '../lib/plan/invariants'
import { PlanSchema } from '../lib/plan/schema'

const CODE = 'INV-PLAN-DISPLAY-ZONE-MATCHES-WORK'

function env() {
  return Object.fromEntries(
    readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('='))
      .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
  ) as Record<string, string>
}
function arg(name: string): string | null {
  const i = process.argv.indexOf(name)
  return i >= 0 ? (process.argv[i + 1] ?? null) : null
}

async function main(): Promise<number> {
  const only = arg('--plan')
  const apply = process.argv.includes('--apply')
  const e = env()
  const sb = createClient(e.NEXT_PUBLIC_SUPABASE_URL!, e.SUPABASE_SERVICE_ROLE_KEY!)

  const { data, error } = await sb.from('plans').select('id, user_id, plan_json')
  if (error) { console.error('read failed:', error.message); return 1 }

  let changed = 0, skipped = 0, refused = 0
  for (const row of (data ?? []) as { id: string; user_id: string; plan_json: Record<string, unknown> }[]) {
    if (only && !row.id.startsWith(only)) continue
    const prior = row.plan_json
    const meta = (prior?.meta ?? {}) as Record<string, unknown>
    const rhr = meta.resting_hr as number | undefined
    const mhr = meta.max_hr as number | undefined

    // The validating input: `generator_input` when the plan carries it (12 of 22
    // do), else meta. The ABSOLUTE set may be imperfect on the fallback — what is
    // trustworthy is the DELTA, because the same input is used on both sides.
    const input = (meta.generator_input ?? meta) as never

    const before = validatePlan(prior as never, input)
    const hasZeroRhr = typeof rhr === 'number' && rhr <= 0
    // The zero-resting repair is independent of DISPLAY-ZONE: those plans are
    // schema-INVALID whether or not the zone check fires.
    if (!before.some(v => v.code === CODE) && !hasZeroRhr) { skipped++; continue }
    // ⚠️ `resting_hr: 0` IS NOT A RESTING HEART RATE — AND THE SESSIONS ARE FINE.
    //
    // The first cut of this script tried to re-derive those plans and the refusal
    // guard stopped it: two came back unchanged (7 -> 7) and one got WORSE
    // (2 -> 6). Investigating why produced the real answer: at GENERATION the
    // engine already called `computeZones(mhr)` with no resting HR, so those
    // plans' sessions are CORRECT — they match the %MaxHR branch exactly, and so
    // does `meta.zone2_ceiling`. The ONLY wrong thing is `meta.resting_hr = 0`,
    // written by `rhr ?? 0`, which made the INVARIANT derive its expected band
    // from a zero baseline. **The checker was wrong, not the plan.**
    //
    // So these are repaired by DELETING the lie, never by recomputing. Doing it
    // here rather than in a second script because this is the same machinery:
    // archive, validate, refuse on any new code.
    //
    // ⚠️ It does NOT clear their DISPLAY-ZONE violations, and it is not meant to.
    // Those are `zone: "Zone 3–4"` against a Zone-3-only target — the ORIGINAL
    // §84 defect, on plans predating the 2026-09-04 fix. Filed separately as
    // PLAN-LEGACY-ZONE-STRING-01. What this does fix is that all three FAIL
    // `PlanSchema` on exactly this field, and stop failing it.
    if (typeof rhr !== 'number' || rhr <= 0) {
      // No key at all is the CORRECT post-fix shape — nothing to strip, and a
      // plan with no resting HR is not re-derivable anyway (it was already
      // generated on §14's %MaxHR branch, which is what it should be on).
      if (!('resting_hr' in meta)) { skipped++; continue }
      const stripped = JSON.parse(JSON.stringify(prior)) as Record<string, unknown>
      delete (stripped.meta as Record<string, unknown>).resting_hr
      const afterStrip = validatePlan(stripped as never, input)
      const grew = afterStrip.filter(v => !before.some(b => b.code === v.code && b.week === v.week))
      const schemaWas = PlanSchema.safeParse(prior).success
      const schemaNow = PlanSchema.safeParse(stripped).success
      console.log(`  ${row.id.slice(0, 8)}  resting_hr=${rhr} -> REMOVED   schema ${schemaWas ? 'OK' : 'FAILS'} -> ${schemaNow ? 'OK' : 'FAILS'}   all violations ${before.length} -> ${afterStrip.length}`)
      if (grew.length) { console.error(`      ✗ REFUSING — introduces ${grew.length} new violation(s)`); refused++; continue }
      changed++
      if (!apply) continue
      const a = await sb.from('plan_archive').insert({
        user_id: row.user_id, plan_json: prior,
        race_name: (meta.race_name as string) ?? null, race_date: (meta.race_date as string) ?? null,
      })
      if (a.error) { console.error(`      ✗ archive failed, NOT writing: ${a.error.message}`); refused++; continue }
      const u = await sb.from('plans').update({ plan_json: stripped }).eq('id', row.id)
      if (u.error) { console.error(`      ✗ write failed: ${u.error.message}`); refused++; continue }
      console.log('      ✓ archived and written')
      continue
    }
    if (typeof mhr !== 'number' || mhr <= 0) {
      console.log(`  ${row.id.slice(0, 8)}  SKIPPED — meta has no usable max HR (${mhr})`)
      skipped++; continue
    }

    const next = applyHrToPlan(JSON.parse(JSON.stringify(prior)) as never, rhr, mhr)
    const after = validatePlan(next as never, input)
    const newCodes = after.filter(v => !before.some(b => b.code === v.code && b.week === v.week))

    const was = before.filter(v => v.code === CODE).length
    const now = after.filter(v => v.code === CODE).length
    console.log(`  ${row.id.slice(0, 8)}  HR ${mhr}/${rhr}   ${CODE}: ${was} -> ${now}   (all violations ${before.length} -> ${after.length})`)

    if (newCodes.length) {
      console.error(`      ✗ REFUSING — introduces ${newCodes.length} new violation(s): ${newCodes.map(v => v.code).join(', ')}`)
      refused++; continue
    }
    changed++
    if (!apply) continue

    const arch = await sb.from('plan_archive').insert({
      user_id: row.user_id, plan_json: prior,
      race_name: (meta.race_name as string) ?? null,
      race_date: (meta.race_date as string) ?? null,
    })
    if (arch.error) { console.error(`      ✗ archive failed, NOT writing: ${arch.error.message}`); refused++; continue }
    const upd = await sb.from('plans').update({ plan_json: next }).eq('id', row.id)
    if (upd.error) { console.error(`      ✗ write failed: ${upd.error.message}`); refused++; continue }
    console.log('      ✓ archived and written')
  }

  console.log(`\n${changed} plan(s) to change · ${skipped} already clean or unusable · ${refused} refused`)
  if (!apply && changed) console.log('DRY RUN — nothing written. Re-run with --apply to commit.')
  return refused ? 1 : 0
}

main().then(c => process.exit(c)).catch(e => { console.error(e); process.exit(1) })
