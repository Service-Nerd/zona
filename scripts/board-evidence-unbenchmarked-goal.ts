// board-evidence-unbenchmarked-goal.ts — GOALPACE-UNBENCHMARKED-MARATHON-01.
//
// READ-ONLY. Generates nothing and writes nothing: it asks one question of the
// CORPUS the wizard can actually post — for a time-target runner with NO
// benchmark, how far past their own fitness-level CV pace does the goal sit, and
// at which distances is that currently bounded?
//
// 🔑 The bound ALREADY EXISTS and reaches one distance. `case 'HM'` in
// `ruleEngine.ts` withholds when the goal is faster than the fitness-level CV
// floor (§120 Am. 1). `case 'goal'` — which is what §22's override resolves a
// repriced threshold row to — has no unbenchmarked guard at all, because every
// other gate reads `pace.goalWithheld`, which is set only for a BENCHMARKED
// runner. So the distance a runner typed decides which ruling they get.
import { buildFallbackPace } from '../lib/plan/ruleEngine'
import { GENERATION_CONFIG as G } from '../lib/plan/generationConfig'

// ⚠️ `calcGoalPace` is PRIVATE to `ruleEngine.ts`, so this restates its two lines
// rather than claiming to call it: parse the target, divide by the distance. Its
// own body is `kmPaceString(parseBenchmarkTime(t) / distanceKm)` — no rounding
// rule, no band, so the arithmetic here is the whole of it.
const timeToMins = (t: string) => {
  const p = t.split(':').map(Number)
  return p.length === 3 ? p[0] * 60 + p[1] + p[2] / 60 : p[0] + p[1] / 60
}
const goalMinPerKm = (km: number, t: string) => timeToMins(t) / km
const LEVELS = ['beginner', 'intermediate', 'experienced'] as const
const RACES: [string, number][] = [['5K', 5], ['10K', 10], ['HM', 21.1], ['MARATHON', 42.2]]
// Target times the wizard can produce, spanning plausible to ambitious.
const TARGETS: Record<string, string[]> = {
  '5K':       ['35:00', '30:00', '25:00', '22:00', '20:00'],
  '10K':      ['70:00', '60:00', '50:00', '45:00', '40:00'],
  'HM':       ['2:30:00', '2:15:00', '2:00:00', '1:45:00', '1:35:00'],
  'MARATHON': ['5:30:00', '5:00:00', '4:30:00', '4:00:00', '3:30:00'],
}

let total = 0, pastCv = 0
const byRace: Record<string, { n: number; past: number; bounded: boolean }> = {}
const rows: string[] = []
for (const [key, km] of RACES) {
  byRace[key] = { n: 0, past: 0, bounded: key === 'HM' }
  for (const lvl of LEVELS) {
    const pace = buildFallbackPace(lvl)
    const cvFloor = pace.minPerKmCV * (1 - G.RACE_PACE_ANCHOR_MAX_OVER_CV_PCT / 100)
    for (const t of TARGETS[key]) {
      const mins = goalMinPerKm(km, t)
      const gp = `${Math.floor(mins)}:${String(Math.round((mins % 1) * 60)).padStart(2, '0')} /km`
      total++; byRace[key].n++
      const over = mins < cvFloor
      if (over) { pastCv++; byRace[key].past++ }
      if (over) rows.push(`  ${key.padEnd(8)} ${lvl.padEnd(12)} target ${t.padEnd(8)} goal ${gp} · CV floor ${cvFloor.toFixed(2)} min/km · T ${pace.minPerKmQuality.toFixed(2)} · I ${pace.minPerKmInterval.toFixed(2)}${mins < pace.minPerKmInterval ? '  🔴 FASTER THAN THEIR INTERVAL PACE' : ''}`)
    }
  }
}
console.log(`── unbenchmarked time-target inputs, goal pace vs the runner's own fitness-level CV ──`)
console.log(`total ${total}; past the CV floor ${pastCv} (${(pastCv / total * 100).toFixed(1)}%)\n`)
for (const [k, v] of Object.entries(byRace)) {
  console.log(`  ${k.padEnd(8)} ${String(v.past).padStart(2)} of ${v.n} past CV   ${v.bounded ? '✅ BOUNDED today (§120 Am. 1, inside `case HM`)' : '🔴 UNBOUNDED today'}`)
}
console.log(`\nthe rows past the floor:`)
rows.forEach(r => console.log(r))
