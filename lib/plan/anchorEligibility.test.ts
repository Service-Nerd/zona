import { describe, it, expect } from 'vitest'
import { V1_SESSION_CATALOGUE, selectCatalogueSession, requiredPaceAnchors } from './sessionCatalogueData'
import { PACE_ANCHORS } from './sessionStructureV2'
import { generateRulePlan } from './ruleEngine'

/**
 * CAT-ROW-ELIGIBILITY-01 — eligibility can now express "this row needs a pace
 * this runner has".
 */

const hmRow = () => V1_SESSION_CATALOGUE.find(r => r.id === 'hm_pace_intervals')!

const ALL_ANCHORS = new Set<string>(PACE_ANCHORS)
const NO_HM = new Set<string>(PACE_ANCHORS.filter(a => a !== 'HM'))

function pick(resolvable: ReadonlySet<string> | undefined) {
  return selectCatalogueSession({
    catalogue: V1_SESSION_CATALOGUE,
    phase: 'peak', distanceKey: 'HM', fitness: 'experienced', tier: 'paid',
    weekN: 3, preferredCategory: 'race_specific', weeklyKm: 60,
    resolvableAnchors: resolvable,
  })
}

describe('requiredPaceAnchors', () => {
  it('reports the anchors a v2 row\'s WORK steps need', () => {
    expect(requiredPaceAnchors(hmRow())).toEqual(['HM'])
  })

  it('ignores recovery steps — a row is not ineligible because of its jog', () => {
    // The HM row's recovery is anchored 'E'; only 'HM' is reported above.
    expect(requiredPaceAnchors(hmRow())).not.toContain('E')
  })

  it('reports nothing for a v1 row — the gate cannot exclude what it cannot read', () => {
    const v1 = V1_SESSION_CATALOGUE.find(r => (r.main_set_structure as any).version !== 2)!
    expect(requiredPaceAnchors(v1)).toEqual([])
  })
})

describe('the selector anchor gate', () => {
  it('offers an HM-anchored row to a runner who HAS an HM pace', () => {
    expect(pick(ALL_ANCHORS)?.id).toBe('hm_pace_intervals')
  })

  it('WITHHOLDS it from a runner who has no HM pace (§24b beginner)', () => {
    expect(pick(NO_HM)?.id).not.toBe('hm_pace_intervals')
  })

  it('is inert when the caller supplies no set — v1 call sites are unaffected', () => {
    expect(pick(undefined)?.id).toBe('hm_pace_intervals')
  })

  it('never fails open: a supplied set that resolves nothing yields no paced row', () => {
    const row = pick(new Set<string>())
    if (row) expect(requiredPaceAnchors(row)).toEqual([])
  })
})

describe('the migration is prescription-neutral', () => {
  it('still prescribes 4 reps — the v1 hardcoded dose, not a resized one', () => {
    const st = hmRow().main_set_structure as any
    expect(st.version).toBe(2)
    expect(st.blocks[0].repeat).toBe(4)
    // A sized parameter would have re-doped this peak session (measured: 3).
    expect(st.sizing.scaling).toBe('fixed')
  })

  it('is anchored at HM pace, its real prescription', () => {
    const st = hmRow().main_set_structure as any
    const work = st.blocks[0].steps.find((s: any) => s.role === 'work')
    expect(work.target.anchor).toBe('HM')
    expect(work.length).toEqual({ kind: 'distance', m: 2000 })
  })
})

/**
 * §99 (CB-HMPACE-SIZING-01) — a session states the length its own structure needs.
 *
 * Deterministic, not sampled: the defect was a specific row on a specific phase,
 * and the random grid had carried it since R23 without noticing.
 */
describe('§99 — hm_pace_intervals states an honest duration', () => {
  const build = (fitness: 'intermediate' | 'experienced') => {
    const TODAY = '2026-09-10'
    const add = (iso: string, d: number) => {
      const t = new Date(iso + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + d)
      return t.toISOString().slice(0, 10)
    }
    const ps = add(TODAY, 7)
    // ⚠️ A BENCHMARK WAS ADDED 2026-09-22 (§120 Amendment 1), and the reason is
    // the point of the amendment rather than a fixture convenience. Without one
    // this runner falls back to the coarse fitness table — intermediate T pace
    // 5:30-6:00 — while asking for a 1:35 half, which is 4:30/km. §120 anchors
    // the row to GOAL pace, so unbounded it would prescribe 4 x 2 km at 4:30 to
    // a runner whose assumed threshold is 5:45, and Amendment 1 now WITHHOLDS
    // the row instead. §120's own text names the no-benchmark cohort as the
    // worst case, so the row being absent here is the amendment working.
    //
    // The §99 rule this block exists for is about DURATION HONESTY and needs a
    // runner who still draws the row. The companion test below pins the
    // withheld case, so the change is held in both directions rather than the
    // fixture being quietly walked to wherever it goes green.
    const input = {
      race_date: add(ps, 16 * 7), race_distance_km: 21.1, goal: 'time_target',
      target_time: '1:35:00', current_weekly_km: 55, longest_recent_run_km: 19,
      days_available: 5, age: 38, fitness_level: fitness, training_age: '5yr+',
      benchmark: { type: 'race', time: '0:43:00', distance_km: 10 },
      weeks_at_current_volume: 12, acknowledged_prep_warning: true,
    } as any
    const plan: any = generateRulePlan(input, 'paid', ps, undefined, TODAY)
    for (const w of plan.weeks) {
      for (const sn of Object.values(w.sessions) as any[]) {
        if (sn?.catalogue_id === 'hm_pace_intervals') return sn
      }
    }
    return null
  }

  const midPace = (band: string) => {
    const m = band.match(/(\d+):(\d+)/g) ?? []
    const toMin = (x: string) => { const [a, b] = x.split(':').map(Number); return a + b / 60 }
    if (m.length > 1) return (toMin(m[0]!) + toMin(m[1]!)) / 2
    if (m.length === 1) return toMin(m[0]!)
    throw new Error(`unparseable pace band: ${band}`)
  }

  for (const fitness of ['intermediate', 'experienced'] as const) {
    it(`${fitness}: stated duration is at least the main set it prescribes`, () => {
      const sn = build(fitness)
      expect(sn).toBeTruthy()
      const blk = sn.derived_set.blocks[0]
      const work = blk.steps.find((s: any) => s.role === 'work')
      const mainMins = blk.repeat * 2 * midPace(work.pace) + (blk.repeat - 1) * 3
      // The defect: stated 45 for a 57-minute main set. A session may state MORE
      // than its main set (warm-up + cool-down); it may never state less.
      expect(sn.duration_mins).toBeGreaterThanOrEqual(mainMins)
    })
  }

  it('the dose is untouched — 4 reps, the v1 prescription', () => {
    expect(build('intermediate').derived_set.blocks[0].repeat).toBe(4)
    expect(build('experienced').derived_set.blocks[0].repeat).toBe(4)
  })
})

/**
 * §120 Amendment 1 — the race-pace anchor is BOUNDED.
 *
 * §120 anchors `hm_pace_intervals` to GOAL pace on a time-target half, which is
 * right in both directions and, unbounded, prescribes the impossible: measured
 * on 12,960 sessions, a 52:00 10K runner targeting 1:25 was handed 4 x 2 km at
 * 4:02/km, 50 s/km faster than their own VO2max interval pace, three times in
 * PEAK.
 *
 * The bound is against CV rather than a percentage of current HM pace, because
 * `INTENSITY_ORDERING_TOLERANCE_PCT` already asks "how far past a derived band
 * may a goal pace sit" and a second constant asking it in a second unit is the
 * duplicate-semantics failure §120's own text cites. Measured decomposition:
 * 60% of goal paces are SLOWER than threshold (§120 makes those easier), 10%
 * land T-to-CV, 15% CV-to-interval, 15% at or past interval.
 *
 * Enforcement needs no new gate. `resolveAnchorPace` is the single owner of
 * anchor pricing and `resolvableAnchors` is built from it, so returning null
 * withholds the row through the eligibility path that already exists.
 */
describe('§120 Amendment 1 — the bound withholds the row', () => {
  const TODAY = '2026-09-10'
  const add = (iso: string, d: number) => {
    const t = new Date(iso + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + d)
    return t.toISOString().slice(0, 10)
  }
  const ps = add(TODAY, 7)
  const hmSessions = (targetTime: string, benchmark?: { time: string; distance_km: number }) => {
    const input = {
      race_date: add(ps, 16 * 7), race_distance_km: 21.1, goal: 'time_target',
      target_time: targetTime, current_weekly_km: 55, longest_recent_run_km: 19,
      days_available: 5, age: 38, fitness_level: 'intermediate', training_age: '5yr+',
      ...(benchmark ? { benchmark: { type: 'race', ...benchmark } } : {}),
      weeks_at_current_volume: 12, acknowledged_prep_warning: true,
    } as any
    const plan: any = generateRulePlan(input, 'paid', ps, undefined, TODAY)
    return plan.weeks.flatMap((w: any) =>
      (Object.values(w.sessions) as any[]).filter(sn => sn?.catalogue_id === 'hm_pace_intervals'))
  }

  it('WITHHOLDS the row when goal pace is faster than CV', () => {
    // 1:35 on the coarse no-benchmark fallback: goal 4:30/km against an assumed
    // threshold of 5:45. This is the case §120 calls "not defensible at all".
    expect(hmSessions('1:35:00')).toHaveLength(0)
  })

  it('KEEPS the row for a goal that stays inside CV — the amendment is not a ban', () => {
    // Same runner, same everything, a target their benchmark supports. If this
    // ever returns zero the bound has swallowed the case it was written to
    // protect, and §22 loses its race-specific exposure with it.
    const kept = hmSessions('1:35:00', { time: '0:43:00', distance_km: 10 })
    expect(kept.length).toBeGreaterThan(0)
  })

  it('the header now states the pace the reps actually run', () => {
    // INV-PLAN-HEADER-PACE-MATCHES-WORK, at the session that motivated it.
    // 2,811 sweep sessions displayed a pace their own reps contradicted.
    const mid = (band: string) => {
      const m = band.match(/(\d+):(\d+)/g) ?? []
      const toMin = (x: string) => { const [a, b] = x.split(':').map(Number); return a + b / 60 }
      return m.reduce((s2, x) => s2 + toMin(x), 0) / m.length
    }
    for (const sn of hmSessions('1:35:00', { time: '0:43:00', distance_km: 10 })) {
      const work = sn.derived_set.blocks[0].steps.find((s2: any) => s2.role === 'work')
      expect(Math.abs(mid(sn.pace_target) - mid(work.pace))).toBeLessThan(0.05)
    }
  })
})
