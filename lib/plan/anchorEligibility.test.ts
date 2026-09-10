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
    const input = {
      race_date: add(ps, 16 * 7), race_distance_km: 21.1, goal: 'time_target',
      target_time: '1:35:00', current_weekly_km: 55, longest_recent_run_km: 19,
      days_available: 5, age: 38, fitness_level: fitness, training_age: '5yr+',
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
