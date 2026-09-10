import { describe, it, expect } from 'vitest'
import { V1_SESSION_CATALOGUE, selectCatalogueSession, requiredPaceAnchors } from './sessionCatalogueData'
import { PACE_ANCHORS } from './sessionStructureV2'

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
