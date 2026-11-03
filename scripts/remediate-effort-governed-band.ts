// remediate-effort-governed-band.ts — §40b Am.4 REMEDIATION, 2026-11-03.
//
// 🔴 WHY THIS EXISTS: I BROKE TWO LIVE PLANS AND DID NOT MEASURE IT.
//
// `INV-PLAN-EFFORT-GOVERNED-NO-INVENTED-BAND` shipped 2026-11-02 (§40b Amendment 4): an
// effort-governed session carries the zone its catalogue row declares and NO `hr_target`.
// The engine fix was verified with `verify:parity`, `measure:fitness` and `review:coaching`
// — all of which generate NEW plans. **Nothing asked what the new invariant does to the 39
// STORED ones.**
//
// Measured 2026-11-03, after the daily digest surfaced it: the invariant fires on 3 stored
// plans and is the ONLY error on 2 of them. Those two had zero errors on 11-01. Because
// `validateReshapedPlan` returns every error in the plan, a single error anywhere makes
// `/api/adjust-plan` refuse — so **adjustable plans went 21 → 19 and two runners silently
// lost the ability to have their plan adjusted.**
//
// The repo already carried this lesson twice ("a fix to the engine reaches no existing plan",
// "an engine change needs regression AND remediation"). The founder asks every time. This is
// the remediation half, which should have shipped with the fix.
//
// ── WHAT IT CHANGES, AS THE RUNNER SEES IT ───────────────────────────────────
//
// An effort-governed session — `hill_reps`, `vert_hike_repeats` — is governed by the terrain
// and its RPE. On these stored plans it carries an interval HR band (`158–184 bpm`) the
// runner cannot hold inside a 45-second rep, and `vert_hike_repeats` additionally shows
// Zone 4–5 on a power-hiking session its own row declares `['Z2']`. §40b's body names that
// exact string as its counter-example.
//
// After: `zone` is read from the row's `intensity_zones` (§107's `zoneStringFromZoneKeys`,
// the same owner generation now uses) and `hr_target` is REMOVED. The RPE is the
// prescription.
//
// ── WHY IT IS SAFE ───────────────────────────────────────────────────────────
//
// It touches two fields on sessions whose catalogue row is effort-governed, and nothing else.
// Distance, duration, day, week, label, coach notes, `derived_set` and `catalogue_id` are
// untouched, so `week_n`/`session_day` keys survive and completions, run links and overrides
// keep pointing at the right sessions.
//
// ⚠️ IT IS NOT A REBUILD, which is why `REBUILD-VOICE-LOSS-01`'s refusal does not apply. The
// five scripts that REGENERATE a plan must refuse plans carrying AI copy, because regeneration
// destroys the voice. This patches two fields in place and cannot touch copy — asserted below
// rather than claimed: the script compares `coach_notes` and `label` before and after and
// refuses if either moved.
//
// ⚠️ `hr_target` is DELETED, not set to ''. `hrBandFor` reads a non-string as "this session
// never had a band and must not acquire one", so an empty string would let `applyHrToPlan`
// put the interval band straight back.
//
// Dry run by default. Archives the prior plan before writing. Re-validates and REFUSES to
// write if the edit introduces any new violation code, or resolves fewer than it should.
//
// Run:
//   npx tsx --env-file=.env.local scripts/remediate-effort-governed-band.ts            # dry run, all
//   npx tsx --env-file=.env.local scripts/remediate-effort-governed-band.ts --apply    # write
import { createClient } from '@supabase/supabase-js'
import { validateReshapedPlan } from '../lib/plan/invariants'
import { isEffortGovernedRow } from '../lib/plan/hrBand'
import { catalogueRowFor } from '../lib/plan/catalogueLink'
import { zoneStringFromZoneKeys } from '../lib/coaching/zoneRules'
import type { Plan, Session } from '../types/plan'

const CODE = 'INV-PLAN-EFFORT-GOVERNED-NO-INVENTED-BAND'
const APPLY = process.argv.includes('--apply')

export interface Touched { week: number; day: string; label: string; from: string; to: string; hadHr: string | null }

/** The patch, as a pure function of the plan. Returns the new plan and what moved.
 *  EXPORTED so `effortGovernedRemediation.test.ts` tests the real thing, not a copy. */
export function remediate(plan: Plan): { next: Plan; touched: Touched[] } {
  const touched: Touched[] = []
  const next = JSON.parse(JSON.stringify(plan)) as Plan
  for (const w of next.weeks) {
    for (const [day, sn] of Object.entries(w.sessions ?? {})) {
      const s = sn as Session | undefined
      if (!s) continue
      const row = catalogueRowFor(s)
      if (!row || !isEffortGovernedRow(row)) continue
      const declared = zoneStringFromZoneKeys(row.intensity_zones)
      if (!declared) continue
      const hadHr = typeof s.hr_target === 'string' ? s.hr_target : null
      if (s.zone === declared && hadHr === null) continue   // already correct
      touched.push({ week: w.n, day, label: String(s.label), from: String(s.zone), to: declared, hadHr })
      s.zone = declared
      // Delete, never blank — see the header.
      delete (s as { hr_target?: string }).hr_target
    }
  }
  return { next, touched }
}

/** Copy must not move. Asserted, not assumed (REBUILD-VOICE-LOSS-01's concern, inverted). */
function copyMoved(before: Plan, after: Plan): string | null {
  for (let i = 0; i < before.weeks.length; i++) {
    const bw = before.weeks[i], aw = after.weeks[i]
    for (const day of Object.keys(bw.sessions ?? {})) {
      const b = (bw.sessions as Record<string, Session>)[day]
      const a = (aw.sessions as Record<string, Session>)[day]
      if (!b || !a) continue
      if (String(b.label) !== String(a.label)) return `w${bw.n}/${day} label`
      if (JSON.stringify(b.coach_notes ?? null) !== JSON.stringify(a.coach_notes ?? null)) return `w${bw.n}/${day} coach_notes`
    }
  }
  return null
}

const main = async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) { console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required'); process.exit(2) }
  const sb = createClient(url, key, { auth: { persistSession: false } })

  const { data, error } = await sb.from('plans').select('user_id, plan_json')
  if (error) { console.error('read failed:', error.message); process.exit(1) }

  console.log(`${APPLY ? 'APPLYING' : 'DRY RUN'} — §40b Am.4 remediation\n`)
  let candidates = 0, wouldWrite = 0, refused = 0

  for (const r of ((data ?? []) as { user_id: string; plan_json: Plan }[])) {
    const plan = r.plan_json
    if (!plan?.weeks?.length) continue

    let before
    try { before = validateReshapedPlan(plan).filter(v => v.severity === 'error') } catch { continue }
    if (!before.some(v => v.code === CODE)) continue
    candidates++

    const { next, touched } = remediate(plan)
    const tag = String(r.user_id).slice(0, 8)
    if (!touched.length) { console.log(`· ${tag}: fires but nothing to patch — INVESTIGATE, do not write`); refused++; continue }

    const after = validateReshapedPlan(next).filter(v => v.severity === 'error')
    const newCodes = after.map(v => v.code).filter(c => !before.map(b => b.code).includes(c))
    const moved = copyMoved(plan, next)

    console.log(`· ${tag}: ${before.length} err → ${after.length} err`)
    for (const t of touched) {
      console.log(`    w${t.week}/${t.day} "${t.label}" zone ${t.from} → ${t.to}${t.hadHr ? `, hr_target "${t.hadHr}" removed` : ''}`)
    }
    if (moved)            { console.log(`    ✗ REFUSED: copy moved at ${moved}`); refused++; continue }
    if (newCodes.length)  { console.log(`    ✗ REFUSED: introduces ${Array.from(new Set(newCodes)).join(', ')}`); refused++; continue }
    if (after.some(v => v.code === CODE)) { console.log(`    ✗ REFUSED: ${CODE} still fires`); refused++; continue }

    wouldWrite++
    if (!APPLY) { console.log(`    ✓ would write (dry run)`); continue }

    // Archive before writing — same contract as backfill-plan-hr.ts.
    const arch = await sb.from('plan_archive').insert({ user_id: r.user_id, plan_json: plan })
    if (arch.error) { console.log(`    ✗ archive failed, NOT writing: ${arch.error.message}`); refused++; continue }
    const upd = await sb.from('plans').update({ plan_json: next }).eq('user_id', r.user_id)
    if (upd.error) { console.log(`    ✗ write failed: ${upd.error.message}`); refused++; continue }
    console.log(`    ✓ written (prior plan archived)`)
  }

  console.log(`\ncandidates ${candidates} · ${APPLY ? 'written' : 'would write'} ${wouldWrite} · refused ${refused}`)
  if (!APPLY && wouldWrite) console.log('\nRe-run with --apply to write.')
}
// ⚠️ GUARDED, so importing `remediate` for its test does not RUN the script. Unguarded, the
// test suite imported this file, `main()` executed with no credentials and called
// `process.exit(1)` — vitest reported "process.exit unexpectedly called with 1" beside 8
// passing tests. A script with a top-level side effect cannot be unit-tested.
if (require.main === module) {
  main().catch(e => { console.error(e); process.exit(1) })
}
