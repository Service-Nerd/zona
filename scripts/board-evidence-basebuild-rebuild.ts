/**
 * Design Board evidence for `BASEBUILD-ADJUST-REBUILD-01`.
 *
 * QUESTION: if the Adjust sheet rebuilt the BASE BUILD instead of a race plan, which of
 * the eight editable keys would actually do anything? A control that cannot change the
 * output is the same defect one layer along, and the board should be shown the number
 * before it rules on the sheet's shape.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, '')
}
import { generateBaseBuildPlan } from '@/lib/plan/baseBuildOnRamp'
import type { OnRampAssessment } from '@/lib/plan/baseBuildOnRamp'
import { MODIFIABLE_ROWS, applyEdits, type PlanEdits } from '@/lib/plan/modifyPlan'
import { weeksBetweenLocal } from '@/lib/plan/length'
import type { GeneratorInput, Plan } from '@/types/plan'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

/** A stable fingerprint of what the RUNNER sees: days, session kinds, distances, durations. */
function fingerprint(p: Plan): string {
  return JSON.stringify(p.weeks.map(w => ({
    n: w.n, km: w.weekly_km,
    s: Object.entries(w.sessions ?? {}).filter(([, v]) => v)
      .map(([d, v]) => {
        const s = v as { type?: string; distance_km?: number | null; duration_mins?: number | null; label?: string }
        return `${d}:${s.type}:${s.distance_km ?? '-'}:${s.duration_mins ?? '-'}`
      }).sort(),
  })))
}

const CANDIDATE: Record<string, unknown[]> = {
  days_available:            [3, 5],
  days_cannot_train:         [[], ['friday']],
  preferred_long_run_day:    ['sat', 'sun'],
  max_weekday_mins:          [30, 90],
  injury_history:            [[], ['knee']],
  hard_session_relationship: ['avoid', 'enjoy'],
  terrain:                   ['road', 'trail'],
  race_date:                 ['2027-04-24', '2027-09-12'],
}

async function main() {
  const { data: rows } = await db.from('plans').select('id, plan_json')
  const targets = (rows ?? []).filter((r: { plan_json: Plan }) =>
    (r.plan_json?.meta as unknown as Record<string, unknown>)?.plan_kind === 'base_build')
  console.log(`${targets.length} live base-build plan(s)\n`)

  for (const r of targets as Array<{ id: string; plan_json: Plan }>) {
    const meta = r.plan_json.meta as unknown as Record<string, unknown>
    const gi = meta.generator_input as GeneratorInput
    if (!gi) { console.log(`${r.id.slice(0,8)} unstamped — skip`); continue }
    const planStart = String(meta.plan_start)

    // 🔴 THE ASSESSMENT IS READ BACK FROM THE PLAN, NOT RE-DERIVED.
    // My first cut called `assessOnRamp(i, base_build_target_km, …)` — passing the
    // TARGET where `min_base_km` goes — and one of the two plans rebuilt to **0 weeks**.
    // I nearly reported that as "0 of 8 controls do anything", which would have been my
    // harness, not the engine. The plan records the assessment it was built from
    // (`base_build_target_km`, `base_build_start_km`, and its own week count IS
    // `rampWeeks`), so reconstruct it instead of guessing.
    const stored: OnRampAssessment = {
      outcome: 'offered',
      rampWeeks: r.plan_json.weeks.length,
      remainingWeeks: Math.max(0, weeksBetweenLocal(planStart, gi.race_date || '2027-04-24') - r.plan_json.weeks.length),
      targetKm: Number(meta.base_build_target_km ?? 0),
      startKm: Number(meta.base_build_start_km ?? 0),
    }
    const rebuild = (i: GeneratorInput): Plan | null => {
      try { return generateBaseBuildPlan(i, planStart, stored) as unknown as Plan }
      catch { return null }
    }

    const basePlan = rebuild(gi)
    if (!basePlan) { console.log(`${r.id.slice(0,8)} baseline rebuild FAILED — cannot measure`); continue }
    // ⚠️ GATE THE BASELINE BEFORE MEASURING ANY DELTA AGAINST IT. An unvalidated
    // baseline makes every "no effect" below unfalsifiable.
    if (basePlan.weeks.length !== r.plan_json.weeks.length) {
      console.log(`${r.id.slice(0,8)} ⛔ BASELINE DOES NOT REPRODUCE THE STORED PLAN `
        + `(${basePlan.weeks.length}w vs stored ${r.plan_json.weeks.length}w) — refusing to measure`)
      continue
    }
    const sameAsStored = fingerprint(basePlan) === fingerprint(r.plan_json)
    console.log(`── ${r.id.slice(0,8)}  baseline reproduces the stored plan: `
      + `${basePlan.weeks.length}w ${sameAsStored ? '✅ byte-identical' : '⚠️ same length, different sessions'}`)
    const baseFp = fingerprint(basePlan)

    let effective = 0
    for (const row of MODIFIABLE_ROWS) {
      const vals = CANDIDATE[row.key] ?? []
      const moved = vals.filter(v => {
        const p = rebuild(applyEdits(gi, { [row.key]: v } as PlanEdits))
        return p ? fingerprint(p) !== baseFp : false
      })
      const broke = vals.filter(v => rebuild(applyEdits(gi, { [row.key]: v } as PlanEdits)) === null)
      if (moved.length) effective++
      console.log(`   ${row.key.padEnd(26)} changes the plan: ${moved.length}/${vals.length}`
        + `${broke.length ? `   ⛔ ${broke.length} refused` : ''}`
        + `${moved.length === 0 && broke.length === 0 ? '   ⚠️ NO EFFECT' : ''}`)
    }
    console.log(`   ──── ${effective} of ${MODIFIABLE_ROWS.length} offered controls would do something\n`)
  }
}
main()
