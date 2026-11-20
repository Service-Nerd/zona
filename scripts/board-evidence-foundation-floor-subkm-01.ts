/**
 * READ-ONLY board evidence, FOUNDATION-FLOOR-SUBKM-01, 2026-11-20.
 * (1) Where do §57's ceiling (cw × 1.10) and the foundation block's minimum session cross?
 * (2) Can any producer SEND a sub-crossing volume? Wizard ruler; the checkpoint's OBSERVED volume.
 * (3) Does any stored live plan carry a foundation week over its ceiling?
 * Generates plans in memory; writes nothing. Run with NODE_ENV=production so the engine logs rather than throws.
 */
import { runEngine } from '../lib/plan/engine'
import { validatePlan } from '../lib/plan/invariants'
import { runWalkFinishInput, checkpointRaceInput, halfSameDayInput } from '../lib/plan/stagedRacePlan'
import { GENERATION_CONFIG as G } from '../lib/plan/generationConfig'
import type { GeneratorInput, Plan } from '../types/plan'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const START = '2026-11-23'
const dateAt = (w: number) => new Date(Date.parse(`${START}T00:00:00Z`) + w * 7 * 864e5).toISOString().slice(0, 10)
const base = (cw: number, lr: number, km: number, w: number, d: number): GeneratorInput => ({
  athlete_name: 'A', age: 38, race_name: 'T', primary_metric: 'distance', plan_start: START,
  race_distance_km: km, race_date: dateAt(w), goal: 'finish', days_available: d, days_cannot_train: [],
  current_weekly_km: cw, longest_recent_run_km: lr, training_age: '<6mo', recent_quality_training: 'none',
  hard_session_relationship: 'neutral', injury_history: [], max_weekday_mins: 60,
  acknowledged_days_warning: true, acknowledged_prep_warning: true,
} as unknown as GeneratorInput)

const fbVolume = (plan: Plan, input: GeneratorInput) => validatePlan(plan, input)
  .filter(v => v.code === 'INV-PLAN-FOUNDATION-BLOCK' && /exceeds effective-baseline ceiling/.test(v.message))

console.log(`ruler: min ${G.WIZARD_VOLUME_RULER.WEEKLY_KM_MIN}, step ${G.WIZARD_VOLUME_RULER.WEEKLY_KM_STEP}; §57 +${G.FOUNDATION_WEEKLY_INCREASE_PCT}%`)
const CWS = [0, 0.5, 1, 1.2, 1.3, 1.4, 1.5, 2, 3, 5]
for (const cw of CWS) {
  let gen = 0, withFoundation = 0, fires = 0, plansFiring = 0, minFw = Infinity
  for (const km of [5, 10, 21.1, 42.2]) for (const lr of [0, 1, 2]) for (const w of [16, 20, 24, 30, 40]) for (const d of [3, 4, 5]) {
    if (lr > Math.max(cw, 0) + 2) continue
    const input = base(cw, lr, km, w, d)
    let out
    try { out = runEngine({ input, tier: 'trial', displayUnits: 'km', planStart: START, today: START }) } catch { continue }
    if (out.kind !== 'plan') continue
    gen++
    const fw = out.plan.weeks.filter(x => x.phase === 'foundation')
    if (!fw.length) continue
    withFoundation++
    for (const x of fw) minFw = Math.min(minFw, x.weekly_km ?? Infinity)
    const v = fbVolume(out.plan, input)
    fires += v.length; if (v.length) plansFiring++
  }
  console.log(`cw ${String(cw).padEnd(4)} race plans ${String(gen).padStart(4)} · with foundation ${String(withFoundation).padStart(4)} · min foundation week ${minFw === Infinity ? '-' : minFw} · ceiling ${(cw * 1.1).toFixed(2)} · volume-arm fires ${fires} on ${plansFiring} plans`)
}

// (2b) the checkpoint: OBSERVED volume is a mean floored to 1 dp, so any value is possible.
// Does the run-walk finish choice build a race plan from a sub-crossing observed volume?
let rwBuilt = 0, rwProbes = 0, rwFires = 0
for (const obs of [0.3, 0.5, 0.8, 1.0, 1.2, 1.3]) for (const km of [5, 10, 21.1, 42.2]) for (const lr of [0, 1, 2]) for (const w of [16, 20, 24, 30, 40]) {
  rwProbes++
  const orig = base(5, 2, km, w, 3)
  let rw: GeneratorInput | null = null
  try { rw = runWalkFinishInput(orig, obs, lr, START) } catch { continue }
  if (!rw) continue
  rwBuilt++
  try {
    const out = runEngine({ input: rw, tier: 'trial', displayUnits: 'km', planStart: START, today: START })
    if (out.kind === 'plan') rwFires += fbVolume(out.plan, rw).length
  } catch { /* refused */ }
}
console.log(`checkpoint run-walk choice from observed 0.3–1.3 km/wk: ${rwBuilt} of ${rwProbes} probes yield a race input; volume-arm fires ${rwFires}`)
let halfBuilt = 0, halfProbes = 0
for (const obs of [0.3, 0.5, 0.8, 1.0, 1.2, 1.3]) for (const lr of [0, 1, 2]) for (const w of [16, 20, 24, 30, 40]) {
  halfProbes++
  try { if (halfSameDayInput(base(5, 2, 42.2, w, 3), obs, lr, START)) halfBuilt++ } catch { /* refused */ }
}
console.log(`checkpoint half choice from observed 0.3–1.3 km/wk: ${halfBuilt} of ${halfProbes} probes yield a race input`)
void checkpointRaceInput

async function prod() {
  for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, '')
  }
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data, error } = await db.from('plans').select('id, plan_json'); if (error) throw error
  let n = 0, stamped = 0, offRuler = 0, subCross = 0, withFw = 0, fires = 0
  const cws: string[] = []
  for (const r of data as any[]) {
    n++
    const gi = r.plan_json?.meta?.generator_input as GeneratorInput | undefined
    if (!gi) continue
    stamped++
    const cw = Number(gi.current_weekly_km ?? NaN)
    cws.push(String(cw) + ((gi as any).volume_observed ? 'obs' : ''))
    if (cw % 5 !== 0) offRuler++
    if (cw > 0 && cw < 1.4) subCross++
    const fw = (r.plan_json.weeks ?? []).filter((x: any) => x.phase === 'foundation')
    if (fw.length) withFw++
    if (fw.length) fires += fbVolume(r.plan_json as Plan, gi).length
  }
  console.log(`PROD plans ${n} · stamped ${stamped} · off-ruler cw ${offRuler} · 0<cw<1.4 ${subCross} · with foundation weeks ${withFw} · volume-arm fires ${fires}`)
  console.log(`PROD declared cw values: ${cws.sort().join(' ')}`)
}
prod()
