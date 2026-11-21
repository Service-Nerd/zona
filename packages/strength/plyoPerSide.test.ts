// ADR-027 hotfix 3 — S8's contact cap counts TOTAL foot contacts. A per-side plyo set of N lands 2N.
// Before the fix, prescribe() gave single-leg pogo 6 × 10/side at the cap (120 contacts) and S-PLYO-CONTACTS read it
// as 60. Both directions are asserted: the dose stays within S8 for every week, and the check now sees per-side.
import { describe, it, expect } from 'vitest'
import { prescribe, plyoContacts, plyoRestoreMinSets } from './prescription'
import { STRENGTH_CONFIG as C } from './config'
import { CATALOGUE } from './catalogue'
import { validateStrengthPlan } from './validate'

const byId = (id: string) => { const e = CATALOGUE.find(x => x.id === id); if (!e) throw new Error(id); return e }
const profile = { experience: 'regular' } as Parameters<typeof prescribe>[2]['profile']

describe('S8 per-side plyo contacts (ADR-027 hotfix 3)', () => {
  for (const id of ['single_leg_pogo', 'lateral_bound', 'pogo_hops']) {
    it(`${id}: total contacts never exceed S8's cap, at any week`, () => {
      const ex = byId(id)
      for (let wi = 0; wi < 40; wi++) {
        const p = prescribe(ex, 'plyo', { profile, phase: 'build', weekIndex: wi })
        const total = (p.contacts ?? 0) * p.sets * (p.per_side ? 2 : 1)
        expect(total).toBeLessThanOrEqual(C.PLYO_CONTACTS_MAX)
        // STRAVA-SOR-REVIEW-FIX-02: S8's dose EXACTLY, per-side and bilateral alike (it was 20, then 40, at a dose of 30).
        if (wi >= C.PLYO_MIN_WEEKS) expect(total, `${id} week ${wi}`).toBe(plyoContacts(wi, 'regular'))
      }
    })
  }
  it('🔴 STRAVA-SOR-REVIEW-FIX-02: a per-side jump at S8\'s start dose of 30 is 3 x 5/side, not 40', () => {
    const wi = C.PLYO_MIN_WEEKS
    expect(plyoContacts(wi, 'regular')).toBe(30)
    const p = prescribe(byId('single_leg_pogo'), 'plyo', { profile, phase: 'build', weekIndex: wi })
    expect(p.per_side).toBe(true)
    expect([p.sets, p.contacts]).toEqual([3, 5])
    expect(p.sets * (p.contacts ?? 0) * 2).toBe(30)
  })
  it('PLYO_CONTACTS_PER_SET is even, so a per-side set splits it exactly (an odd value needs a ruling, not a rounding)', () => {
    expect(C.PLYO_CONTACTS_PER_SET % 2).toBe(0)
  })
  it('per-side and bilateral take the same sets in every phase, including deload', () => {
    for (const phase of ['build', 'peak', 'deload', 'base'] as const) {
      for (let wi = C.PLYO_MIN_WEEKS; wi < 40; wi++) {
        const uni = prescribe(byId('single_leg_pogo'), 'plyo', { profile, phase, weekIndex: wi })
        const bi = prescribe(byId('pogo_hops'), 'plyo', { profile, phase, weekIndex: wi })
        expect(uni.sets, `${phase} ${wi}`).toBe(bi.sets)
        expect(uni.contacts! * 2).toBe(bi.contacts)
      }
    }
  })
  it('🔴 STRAVA-SOR-REVIEW-FIX-01: a dropped jump can always be restored at its own dose (S10 fill floor <= its sets)', () => {
    for (const id of ['single_leg_pogo', 'lateral_bound', 'pogo_hops']) {
      for (let wi = C.PLYO_MIN_WEEKS; wi < 40; wi++) {
        const p = prescribe(byId(id), 'plyo', { profile, phase: 'build', weekIndex: wi })
        expect(plyoRestoreMinSets(p), `${id} week ${wi}: ${p.sets} sets`).toBeLessThanOrEqual(p.sets)
      }
    }
  })
  it('a bilateral jump is unchanged (sets = contacts / 10)', () => {
    const p = prescribe(byId('pogo_hops'), 'plyo', { profile, phase: 'build', weekIndex: 30 })
    expect(p.sets * (p.contacts ?? 0)).toBe(plyoContacts(30, 'regular'))
  })
})
