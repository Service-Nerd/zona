import { describe, it, expect } from 'vitest'
import { baseBuildOfferLine, baseBuildOfferTitle, baseBuildOfferWhy } from './baseBuildCopy'
import { BRAND } from '@/lib/brand'

const o = (over = {}) => ({
  weeks: 15, endsAtKm: 11.3, reachesRaceDoor: true, distanceLabel: '11 km', ...over,
})

describe('§118 copy — the two variants', () => {
  // 🔴 THE ONE THAT MATTERS. Hard rule 7: a claim about a future plan is still
  // a claim. The old string promised "we will build the plan then" to a runner
  // who may never qualify. Sutherland: "when it does not happen, the runner
  // concludes you lied, and they will be right."
  it('NEVER mentions a race to a runner who will not reach one', () => {
    const line = baseBuildOfferLine(o({ reachesRaceDoor: false }))
    expect(line).not.toMatch(/marathon|race|start line|come back/i)
  })

  it('names the commitment for the runner who WILL reach one', () => {
    const line = baseBuildOfferLine(o({ reachesRaceDoor: true }))
    expect(line).toMatch(/race plan/i)
    expect(line).toContain('15 weeks')   // Traynor: name the number, we computed it
  })

  it('the two variants are genuinely different, not one softened', () => {
    expect(baseBuildOfferLine(o({ reachesRaceDoor: true })))
      .not.toBe(baseBuildOfferLine(o({ reachesRaceDoor: false })))
  })

  it('leads with the plan, never with the refusal', () => {
    for (const reaches of [true, false]) {
      const line = baseBuildOfferLine(o({ reachesRaceDoor: reaches }))
      expect(line).toMatch(/^\d+ weeks of base building/)
      expect(line).not.toMatch(/^(sorry|unfortunately|too low|not yet)/i)
    }
  })

  // Sutherland's naming decision, pinned because "getting running" is the
  // obvious phrase and will be reached for again.
  it('says base building, never "getting running"', () => {
    expect(baseBuildOfferTitle()).toBe('Base building')
    for (const reaches of [true, false]) {
      expect(baseBuildOfferLine(o({ reachesRaceDoor: reaches }))).not.toMatch(/getting running/i)
    }
  })

  it('interpolates BRAND.name and never hardcodes it', () => {
    expect(baseBuildOfferWhy()).toContain(BRAND.name)
  })

  it('carries no em dash', () => {
    for (const s of [baseBuildOfferTitle(), baseBuildOfferWhy(),
                     baseBuildOfferLine(o({ reachesRaceDoor: true })),
                     baseBuildOfferLine(o({ reachesRaceDoor: false }))]) {
      expect(s).not.toContain('—')
    }
  })

  it('is one sentence where one will do', () => {
    for (const reaches of [true, false]) {
      const sentences = baseBuildOfferLine(o({ reachesRaceDoor: reaches })).split('. ').length
      expect(sentences).toBeLessThanOrEqual(1)
    }
  })
})
