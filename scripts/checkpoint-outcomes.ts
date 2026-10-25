/**
 * NO-RUNNER-TURNED-AWAY-01 Phase E — WHAT A STAGED RUNNER ACTUALLY GETS AT THE CHECKPOINT.
 *
 * `stagedScore` answers "is the composed plan clean on the pass case" (Q4, the best case). This answers the question
 * after it: across the weighted population the engine stages, if the runner ran a given share of what was prescribed,
 * what does the checkpoint hand them: the race block, more base building, run-walk, or only a later race? Through the
 * engine's own owners (`stagingDoorKm`, `generateStagedRacePlan`, `evaluateCheckpoint`), never a copy.
 *
 * Usage: npx tsx scripts/checkpoint-outcomes.ts [--stride N]
 */
import { distanceEnvelope } from '../lib/plan/useCaseEnvelope'
import { generateRulePlan } from '../lib/plan/ruleEngine'
import { isDesignedRefusal } from '../lib/plan/designedRefusal'
import { stagingDoorKm, generateStagedRacePlan, stagedRaceOf } from '../lib/plan/stagedRacePlan'
import { evaluateCheckpoint } from '../lib/plan/engine'
import type { GeneratorInput } from '../types/plan'

const argv = process.argv.slice(2)
const STRIDE = (() => { const i = argv.indexOf('--stride'); return i >= 0 ? Math.max(1, +argv[i + 1]) : 7 })()
const START = '2026-11-02'
const addWeeks = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 7 * 864e5).toISOString().slice(0, 10)
const SHARES = [1, 0.9, 0.75]

for (const dist of [42.2, 21.1]) {
  const out: Record<string, Record<string, number>> = {}
  let total = 0, walkRun = 0, all = 0
  for (const c of distanceEnvelope(dist).filter((_, i) => i % STRIDE === 0)) {
    all += c.weight
    const ps = (c.input as unknown as { plan_start?: string }).plan_start ?? START
    try { generateRulePlan(c.input, 'paid', ps, undefined, START); continue } catch (e) {
      if (!isDesignedRefusal(e)) continue
      const door = stagingDoorKm(e, c.input, ps)
      if (door === null) continue
      const plan = generateStagedRacePlan(c.input, ps, door)
      if (!plan) continue
      const s = stagedRaceOf(plan)!
      total += c.weight
      if (plan.weeks[0]?.phase === 'walk_run_start') walkRun += c.weight
      const cp = addWeeks(ps, s.checkpoint_week)
      for (const share of SHARES) {
        const km = Math.round(s.door_km * share * 10) / 10
        // The ramp's own longest session, scaled by the same share: a runner who ran 90% ran shorter runs too.
        // A walk-run session is planned by time, so a plan with no ramp has no planned longest run; a real logged one has a
        // distance. Then a third of the week, the ramp's own shape at three sessions.
        const planned = Math.max(0, ...plan.weeks.flatMap(w => Object.values(w.sessions ?? {}).map(x => Number((x as { distance_km?: number })?.distance_km ?? 0))))
        const longest = planned > 0 ? planned * share : km / 3
        const loads = new Map(plan.weeks.map(w => [w.n, { linkedKm: km, offPlanKm: 0, totalKm: km, longestKm: longest }]))
        const r = evaluateCheckpoint(c.input as GeneratorInput, plan, loads, 'km', cp)
        const k = r.ok ? 'race block' : `${(r.body as { reason: string }).reason.replace('checkpoint_', '')}: ${((r.body as { options?: { kind: string }[] }).options ?? []).map(o => o.kind).join('+')}`
        const row = (out[`${share * 100}%`] ??= {})
        row[k] = (row[k] ?? 0) + c.weight
      }
    }
  }
  console.log(`\n${dist === 42.2 ? 'MARATHON' : 'HALF MARATHON'}: staged ${(total / (all || 1) * 100).toFixed(1)}% of the weighted population (walk-run start ${(walkRun / (total || 1) * 100).toFixed(0)}% of staged)`)
  for (const [share, row] of Object.entries(out)) {
    console.log(`  ran ${share.padStart(4)} of the target:`)
    for (const [k, w] of Object.entries(row).sort((a, b) => b[1] - a[1])) console.log(`     ${(w / total * 100).toFixed(1).padStart(5)}%  ${k}`)
  }
}
