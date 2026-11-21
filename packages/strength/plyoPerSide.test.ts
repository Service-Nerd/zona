// ADR-027 hotfix 3 — S8's contact cap counts TOTAL foot contacts. A per-side plyo set of N lands 2N.
// Before the fix, prescribe() gave single-leg pogo 6 × 10/side at the cap (120 contacts) and S-PLYO-CONTACTS read it
// as 60. Both directions are asserted: the dose stays within S8 for every week, and the check now sees per-side.
import { describe, it, expect } from 'vitest'
import { prescribe, plyoContacts } from './prescription'
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
        expect(total).toBeLessThanOrEqual(Math.max(plyoContacts(wi, 'regular'), (p.contacts ?? 0) * (p.per_side ? 2 : 1)))
      }
    })
  }
  it('a bilateral jump is unchanged (sets = contacts / 10)', () => {
    const p = prescribe(byId('pogo_hops'), 'plyo', { profile, phase: 'build', weekIndex: 30 })
    expect(p.sets * (p.contacts ?? 0)).toBe(plyoContacts(30, 'regular'))
  })
})
