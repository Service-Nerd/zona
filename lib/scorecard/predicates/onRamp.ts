/**
 * On-ramp predicates — base build, walk-run start, foundation block (final plan read, slice
 * "base-build / foundation / walk-run / maintenance block"; cause 1: many producers, each applying
 * the rules itself). Ported from `planread/ramps/count_ramps.ts` and `count_found.ts`.
 */
import { hasInjuryKeyword } from '@/lib/plan/injuryScope'
import { mastersCadenceApplies } from '@/lib/plan/mastersCadence'
import { baseBuildWeeks, foundationWeeks, isDeloadWeek, isWeekend, runsOf } from '../metrics'
import type { PlanPredicate } from '../types'

const kneeShin = (h: readonly string[] | undefined) => hasInjuryKeyword(h, 'knee') || hasInjuryKeyword(h, 'shin')
const paceFastMinPerKm = (pace: string | undefined): number | null => {
  const m = /(\d+):(\d\d)/.exec(pace ?? '')
  return m ? Number(m[1]) + Number(m[2]) / 60 : null
}

export const ON_RAMP: PlanPredicate[] = [
  {
    id: 'RAMP-INJURY-OVER-CAP', section: '§2, §12 (INJURY_WEEKLY_INCREASE_CAP_PCT)', cls: 'NEW', source: 'read: base-build (425 of 541); hotfix 2 at the Board',
    description: 'A knee/shin runner\'s base-build ramp rises more than 5.5% between two non-deload weeks',
    kinds: ['base_build'],
    test: (p, i) => {
      if (!kneeShin(i.injury_history)) return null
      const r = baseBuildWeeks(p)
      const k = r.findIndex((w, j) => j > 0 && !isDeloadWeek(w) && !isDeloadWeek(r[j - 1]) && w.weekly_km > r[j - 1].weekly_km * 1.055)
      return k > 0 ? `W${r[k - 1].n} ${r[k - 1].weekly_km} → W${r[k].n} ${r[k].weekly_km}` : null
    },
  },
  {
    id: 'RAMP-POST-DELOAD-JUMP', section: '§90, ADR-022', cls: 'NEW', source: 'read: base-build (968 of 1,579, ~1.21×)',
    description: 'The week after a base-build deload is more than 10% above the week before the deload',
    kinds: ['base_build'],
    test: p => {
      const r = baseBuildWeeks(p)
      for (let j = 1; j < r.length - 1; j++)
        if (isDeloadWeek(r[j]) && !isDeloadWeek(r[j - 1]) && !isDeloadWeek(r[j + 1]) && r[j - 1].weekly_km > 0 && r[j + 1].weekly_km / r[j - 1].weekly_km > 1.105)
          return `×${(r[j + 1].weekly_km / r[j - 1].weekly_km).toFixed(2)} at W${r[j + 1].n}`
      return null
    },
  },
  {
    id: 'RAMP-MASTERS-CADENCE', section: '§3 (masters cadence)', cls: 'NEW', source: 'read: base-build',
    description: 'A masters runner\'s base-build ramp runs 3+ loading weeks between deloads',
    kinds: ['base_build'],
    test: (p, i) => {
      if (!mastersCadenceApplies(i.age)) return null
      let run = 0, best = 0
      for (const w of baseBuildWeeks(p)) { run = isDeloadWeek(w) ? 0 : run + 1; best = Math.max(best, run) }
      return best >= 3 ? `${best} loading weeks in a row` : null
    },
  },
  {
    id: 'RAMP-SESSION-OVER-2X-LONGEST', section: '§113, §2 Am. 2', cls: 'NEW', source: 'read: base-build',
    description: 'A base-build run more than twice the longest run the runner declared',
    kinds: ['base_build'],
    test: (p, i) => {
      const lr = Number(i.longest_recent_run_km ?? 0); if (lr <= 0) return null
      const mx = Math.max(0, ...baseBuildWeeks(p).flatMap(w => runsOf(w).map(r => Number(r.s.distance_km ?? 0))))
      return mx > 2 * lr ? `${mx} km vs declared ${lr}` : null
    },
  },
  {
    id: 'FOUNDATION-CLIFF', section: '§57, §122', cls: 'NEW', source: 'read: foundation (1,219 of 1,828)',
    description: 'Plan week 1 is more than 20% below the last foundation week: two owners of starting volume',
    test: p => {
      const fw = foundationWeeks(p); const w1 = p.weeks.find(w => w.n === 1)
      if (!fw.length || !w1) return null
      const last = fw[fw.length - 1].weekly_km
      return last > 0 && w1.weekly_km < 0.8 * last ? `foundation ${last} → week 1 ${w1.weekly_km}` : null
    },
  },
  {
    id: 'FOUNDATION-MORE-RUNS-THAN-W1', section: '§57', cls: 'NEW', source: 'read: foundation',
    description: 'The foundation block places more runs a week than plan week 1',
    test: p => {
      const fw = foundationWeeks(p); const w1 = p.weeks.find(w => w.n === 1)
      if (!fw.length || !w1) return null
      const f = Math.max(...fw.map(w => runsOf(w).length))
      return f > runsOf(w1).length ? `foundation ${f}, week 1 ${runsOf(w1).length}` : null
    },
  },
  {
    id: 'FOUNDATION-WEEKDAY-CAP-UNSEEN', section: '§122, §82', cls: 'NEW', source: 'read: foundation (cap skipped when duration-anchored)',
    description: 'A foundation weekday run with no stated duration whose distance at its own fast pace exceeds the weekday cap',
    test: (p, i) => {
      const cap = i.max_weekday_mins; if (!cap) return null
      for (const w of foundationWeeks(p)) for (const r of runsOf(w)) {
        if (isWeekend(r.day) || r.s.duration_mins != null || r.s.role === 'long_run') continue
        const pf = paceFastMinPerKm(r.s.pace_target)
        if (r.s.distance_km != null && pf && r.s.distance_km * pf > cap * 1.05) return `W${w.n} ${r.day} ${r.s.distance_km} km ≈ ${Math.round(r.s.distance_km * pf)} min > ${cap}`
      }
      return null
    },
  },
]
