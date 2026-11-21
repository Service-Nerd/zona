/**
 * Post-race maintenance block predicates (§75; final plan read, base-build/maintenance slice).
 * Ported from `planread/ramps/count_mb.ts`, which drives `generateMaintenanceBlock` with an option
 * grid directly. That is deliberate: the route derives the options from a stored plan in code that
 * is not exported, and copying that derivation here would be a second owner of it.
 */
import { DAYS, runsOf, isWeekend } from '../metrics'
import type { MaintenancePredicate } from '../types'

export const MAINTENANCE: MaintenancePredicate[] = [
  {
    id: 'MB-NO-PACE-NO-HR', section: '§75, §14', cls: 'NEW', source: 'read: maintenance block',
    description: 'A maintenance-block run with neither an HR ceiling nor a pace band',
    test: weeks => {
      for (const w of weeks) for (const r of runsOf(w)) if (!r.s.hr_target && !r.s.pace_target) return `W${w.n} ${r.day} ${r.s.label}`
      return null
    },
  },
  {
    id: 'MB-RUN-UNDER-2KM', section: '§75, §9', cls: 'NEW', source: 'read: marathon (maintenance runs under 2 km)',
    description: 'A maintenance-block easy run shorter than 2 km',
    test: weeks => {
      for (const w of weeks) for (const r of runsOf(w)) if (r.s.type === 'easy' && r.s.distance_km != null && r.s.distance_km < 2) return `W${w.n} ${r.day} ${r.s.distance_km} km`
      return null
    },
  },
  {
    id: 'MB-OFF-CHOSEN-DAYS', section: '§75, §18', cls: 'NEW', source: 'read: marathon (maintenance on blocked days)',
    description: 'A maintenance run on a day outside the training days the block was given',
    test: (weeks, o) => {
      if (!o.trainingDays?.length) return null
      const ok = new Set(o.trainingDays)
      for (const w of weeks) for (const r of runsOf(w)) if (!ok.has(r.day as typeof DAYS[number])) return `W${w.n} ${r.day}`
      return null
    },
  },
  {
    id: 'MB-LONG-ON-WEEKDAY', section: '§75, §18 Am. 2', cls: 'NEW', source: 'read: marathon',
    description: 'The block\'s longest run falls on a weekday while a weekend day is among its training days',
    test: (weeks, o) => {
      if (!(o.trainingDays ?? []).some(d => isWeekend(d))) return null
      for (const w of weeks) {
        const rs = runsOf(w); if (rs.length < 2) continue
        const top = rs.reduce((a, b) => ((b.s.distance_km ?? 0) > (a.s.distance_km ?? 0) ? b : a))
        if (!isWeekend(top.day) && rs.filter(r => (r.s.distance_km ?? 0) === (top.s.distance_km ?? 0)).length === 1) return `W${w.n} ${top.day}`
      }
      return null
    },
  },
]
