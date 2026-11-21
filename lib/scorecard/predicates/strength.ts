/**
 * Strength predicates (final plan read, strength slice; StrengthPrinciples.md). Ported from
 * `planread/strength/measure.ts` and `measure2.ts`. Each reads the generated strength plan and the
 * run context it was placed around; none calls the strength producer's own placement or dose code.
 *
 * Not ported: the "experience ladder flat" class, which needs two profiles' plans compared side by
 * side; it is a pair predicate and this registry is per plan (named in the scorecard's negative space).
 */
import { CATALOGUE_BY_ID, PATTERN_REGION, STRENGTH_CONFIG as C, type StrengthSession } from '@/packages/strength'
import { isLoadedLift } from '@/packages/strength'
import { blockedDays } from '../metrics'
import type { StrengthPredicate } from '../types'

const ORDINARY = new Set(['base', 'build', 'peak', 'maintenance'])
const training = (s: StrengthSession) => s.kind !== 'mobility'
const items = (s: StrengthSession) => s.blocks.filter(b => b.role !== 'warmup' && b.role !== 'mobility').flatMap(b => b.items.map(it => ({ it, role: b.role })))
const pattern = (id: string) => CATALOGUE_BY_ID.get(id)?.pattern
const sets = (s: StrengthSession) => items(s).reduce((a, x) => a + x.it.sets, 0)

export const STRENGTH: StrengthPredicate[] = [
  {
    id: 'ST-ON-BLOCKED-RUN-DAY', section: 'S1, §18', cls: 'NEW', source: 'read: strength (100% of plans with blocked days)',
    description: 'A strength session on a day the runner blocked, when the runner did not choose their own lifting days',
    test: (sp, _ctx, profile, i) => {
      if (profile.available_days?.length) return null
      const b = blockedDays(i); if (!b.size) return null
      const s = sp.weeks.flatMap(w => w.sessions).find(x => b.has(x.day))
      return s ? `W${s.week_n} ${s.day}` : null
    },
  },
  {
    id: 'ST-PLYO-PER-SIDE-OVER-CAP', section: 'S8', cls: 'NEW', source: 'read: strength (6,466 sessions); hotfix 3',
    description: 'A per-side plyometric counted on both legs exceeds the session contact cap',
    test: sp => {
      for (const w of sp.weeks) for (const s of w.sessions) for (const { it } of items(s))
        if (pattern(it.exercise_id) === 'plyometric' && it.per_side && (it.contacts ?? 0) * it.sets * 2 > C.PLYO_CONTACTS_MAX)
          return `W${w.n} ${it.exercise_id} ${(it.contacts ?? 0) * it.sets * 2} contacts`
      return null
    },
  },
  {
    id: 'ST-DELOAD-TAPER-BUSIER', section: 'S5, S6', cls: 'NEW', source: 'read: strength',
    description: 'A deload or taper session carries at least the sets of the same kind of session in the last ordinary week',
    test: sp => {
      let prev: Map<string, number> | null = null
      for (const w of sp.weeks) {
        const ts = w.sessions.filter(training)
        if ((w.phase === 'deload' || w.phase === 'taper') && prev) {
          for (const s of ts) { const pv = prev.get(s.kind); if (pv != null && sets(s) >= pv && pv > 0) return `W${w.n} ${w.phase} ${s.kind} ${sets(s)} ≥ ${pv} sets` }
        }
        if (ORDINARY.has(w.phase) && ts.length) prev = new Map(ts.map(s => [s.kind, sets(s)]))
      }
      return null
    },
  },
  {
    id: 'ST-NO-CALF-WEEK', section: 'S6, S9', cls: 'NEW', source: 'read: strength',
    description: 'An ordinary training week with no calf work in any session',
    test: sp => {
      const w = sp.weeks.find(x => ORDINARY.has(x.phase) && x.sessions.some(training)
        && !x.sessions.filter(training).some(s => items(s).some(({ it }) => pattern(it.exercise_id) === 'calf')))
      return w ? `W${w.n}` : null
    },
  },
  {
    id: 'ST-NO-FREE-DAY', section: 'S1, §64', cls: 'NEW', source: 'read: strength (12.1% of weeks)',
    description: 'An ordinary week where every run-rest day carries strength, so the runner has no day off',
    test: (sp, ctx) => {
      for (const w of sp.weeks) {
        if (!ORDINARY.has(w.phase) || !w.sessions.length) continue
        const days = ctx.days.filter(d => d.week_n === w.n)
        const rest = days.filter(d => d.role === 'rest')
        if (!rest.length) continue
        const dates = new Set(w.sessions.map(s => s.date))
        if (rest.every(d => dates.has(d.date))) return `W${w.n}`
      }
      return null
    },
  },
  {
    id: 'ST-BODYWEIGHT-HEAVY-5', section: 'S6, S7', cls: 'NEW', source: 'read: strength',
    description: 'A running-focus lower-body main lift prescribed at heavy reps on an unloaded exercise',
    test: (sp, _ctx, profile) => {
      if (profile.focus !== 'running') return null
      for (const w of sp.weeks) for (const s of w.sessions) for (const { it, role } of items(s)) {
        const ex = CATALOGUE_BY_ID.get(it.exercise_id)
        if (role === 'main' && ex && it.reps === C.HEAVY_REPS_RUNNING_LOWER && !isLoadedLift(ex.id)
          && PATTERN_REGION[ex.pattern] === 'lower') return `W${w.n} ${ex.id}`
      }
      return null
    },
  },
]
