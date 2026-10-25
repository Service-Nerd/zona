/**
 * NO-RUNNER-TURNED-AWAY-01 — real plans for typical staged runners, week by week, for the Coaching Board to read.
 * Through the engine's own door (runEngine with the flag on, evaluateCheckpoint), never a copy.
 * Usage: ENABLE_BASE_BUILD_ONRAMP=1 npx tsx scripts/staged-plan-walkthrough.ts
 */
import { runEngine, evaluateCheckpoint } from '../lib/plan/engine'
import { stagedRaceOf } from '../lib/plan/stagedRacePlan'
import { generateRulePlan } from '../lib/plan/ruleEngine'
import type { GeneratorInput, Plan, Session } from '../types/plan'

const START = '2026-11-02'
const weeksOut = (n: number) => new Date(Date.parse(`${START}T00:00:00Z`) + n * 7 * 864e5).toISOString().slice(0, 10)
const base = { race_distance_km: 42.2, race_name: 'London Marathon', goal: 'finish', age: 34, injuries: [],
  fitness_level: 'beginner', training_age: '<6mo', user_declared_level: 'beginner', recent_quality_training: 'none' }
const PERSONAS: { name: string; input: Record<string, unknown> }[] = [
  { name: 'A: 10 km/wk, 4 days, 26 weeks out (Tom-like)', input: { current_weekly_km: 10, longest_recent_run_km: 6, days_available: 4, race_date: weeksOut(26) } },
  { name: 'B: 5 km/wk, 3 days, 26 weeks out (Sheena-like)', input: { current_weekly_km: 5, longest_recent_run_km: 3, days_available: 3, race_date: weeksOut(26) } },
  { name: 'C: 0 km/wk charity runner, 3 days, 29 weeks out', input: { current_weekly_km: 0, longest_recent_run_km: 0, days_available: 3, race_date: weeksOut(29), age: 46 } },
  { name: 'D: 8 km/wk, 4 days, 18 weeks out', input: { current_weekly_km: 8, longest_recent_run_km: 5, days_available: 4, race_date: weeksOut(18) } },
]
const sess = (s: Session) => {
  const l = (s as unknown as { walk_run_level?: { run_mins: number; walk_mins: number } }).walk_run_level
  if (l) return `walk-run ${l.run_mins}/${l.walk_mins} ${s.duration_mins}min`
  const km = s.distance_km != null ? `${s.distance_km}km` : `${s.duration_mins}min`
  return `${s.type === 'easy' && /long/i.test(s.label ?? '') ? 'long' : s.type} ${km}${s.run_walk_strategy ? ' (6/1)' : ''}`
}
const weekLine = (w: Plan['weeks'][number]) => {
  const ss = Object.entries(w.sessions ?? {}).filter(([, s]) => s && s.type !== 'rest') as [string, Session][]
  return `  W${String(w.n).padStart(2)} ${String(w.phase).padEnd(15)} ${w.type === 'deload' ? 'deload ' : '       '}${w.weekly_km != null ? String(w.weekly_km).padStart(5) + 'km' : '    —  '}  ${ss.map(([d, s]) => `${d} ${sess(s)}`).join(' · ')}`
}
const raceSummary = (p: Plan) => {
  const lrs = p.weeks.map(w => Math.max(0, ...Object.values(w.sessions ?? {}).filter(s => s && s.type !== 'rest' && s.type !== 'race').map(s => Number((s as Session).distance_km ?? 0))))
  const kms = p.weeks.map(w => w.weekly_km ?? 0)
  const q = p.weeks.reduce((a, w) => a + Object.values(w.sessions ?? {}).filter(s => s && ['quality', 'intervals', 'tempo', 'hard'].includes((s as Session).type)).length, 0)
  return `  ${p.weeks.length} weeks · week 1 ${kms[0]}km → peak ${Math.max(...kms)}km · longest training run ${Math.max(...lrs)}km · ${q} quality sessions · run-walk ${(p.meta as unknown as Record<string, unknown>).run_walk_prescribed ? 'yes' : 'no'}`
}
for (const persona of PERSONAS) {
  const input = { ...base, ...persona.input } as unknown as GeneratorInput
  console.log(`\n━━ ${persona.name}`)
  const out = runEngine({ input, tier: 'paid', displayUnits: 'km', planStart: START, today: '2026-11-01' })
  if (out.kind !== 'base_build' || !stagedRaceOf(out.plan)) { console.log(`  NOT STAGED: ${out.kind} ${out.kind === 'refusal' ? (out.body as { reason?: string }).reason : ''}`); continue }
  const plan = out.plan, s = stagedRaceOf(plan)!
  console.log(`  checkpoint week ${s.checkpoint_week} · target ${s.door_km} km/wk (door ${s.min_base_km}) · target found ${s.target_found} · ${s.race_weeks} weeks left for the race`)
  for (const w of plan.weeks) console.log(weekLine(w))
  const cp = weeksOut(s.checkpoint_week)
  for (const share of [1, 0.9]) {
    const km = Math.round(s.door_km * share * 10) / 10
    const longest = Math.max(0, ...plan.weeks.flatMap(w => Object.values(w.sessions ?? {}).map(x => Number((x as Session)?.distance_km ?? 0)))) * share || km / 3
    const loads = new Map(plan.weeks.map(w => [w.n, { linkedKm: km, offPlanKm: 0, totalKm: km, longestKm: longest }]))
    const r = evaluateCheckpoint(input, plan, loads, 'km', cp)
    if (r.ok && 'input' in r) {
      console.log(`  ▸ ran ${share * 100}% (${km} km/wk): RACE BLOCK`)
      try { console.log(raceSummary(generateRulePlan({ ...r.input, acknowledged_prep_warning: true } as GeneratorInput, 'paid', cp))) } catch (e) { console.log(`  race block refused: ${(e as Error).name}`) }
    } else if (!r.ok) {
      const opts = ((r.body as { options?: { kind: string }[] }).options ?? []).map(o => o.kind)
      console.log(`  ▸ ran ${share * 100}% (${km} km/wk): ${(r.body as { error: string }).error} → ${opts.join(' / ')}`)
      if (opts.includes('half')) {
        const h = evaluateCheckpoint(input, plan, loads, 'km', cp, 'half')
        if (h.ok && 'input' in h) console.log('    half option:' + raceSummary(generateRulePlan({ ...h.input, acknowledged_prep_warning: true } as GeneratorInput, 'paid', cp)).slice(1))
      }
    }
  }
}
