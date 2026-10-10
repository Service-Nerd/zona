import { describe, it, expect } from 'vitest'
import { handoverCopy } from './handoverCopy'

const base = { raceDistanceKm: 42.2, blockWeeks: 15, startKm: 5, deliveredKm: 18.9, units: 'km' as const }

describe('BASEBUILD-HANDOVER-01 copy', () => {
  it('names the race by DISTANCE through the single owner', () => {
    expect(handoverCopy(base).line).toContain('marathon')
    expect(handoverCopy({ ...base, raceDistanceKm: 21.1 }).primary).toBe('Build the half marathon plan')
    expect(handoverCopy({ ...base, raceDistanceKm: 10 }).primary).toBe('Build the 10K plan')
  })

  it('🔴 never promises a plan: the action is an instruction, not a claim', () => {
    // Hard rule 7. Tom's handover REFUSES until he acknowledges a short runway, so
    // "your plan is ready" would be false for him on the day he reads it.
    const c = handoverCopy(base)
    for (const s of [c.title, c.line, c.primary, c.secondary]) {
      expect(s.toLowerCase()).not.toMatch(/ready|waiting for you|all set|your plan is/)
    }
  })

  it('honours the work with a NUMBER, never an adjective', () => {
    expect(handoverCopy(base).metric).toBe('15 weeks · 5km to 19km a week')
    const all = Object.values(handoverCopy(base)).join(' ').toLowerCase()
    expect(all).not.toMatch(/amazing|great work|well done|crushed|smashed|congratulations|proud/)
  })

  it('respects the runner units (ADR-015), never a hand-assembled distance', () => {
    expect(handoverCopy({ ...base, units: 'mi' }).metric).toMatch(/mi to .*mi a week/)
  })

  it('renders NO metric rather than half a sentence when the block recorded nothing', () => {
    expect(handoverCopy({ ...base, startKm: 0, deliveredKm: 0 }).metric).toBeNull()
    expect(handoverCopy({ ...base, blockWeeks: 0 }).metric).toBeNull()
    // And never claims a rise that did not happen.
    expect(handoverCopy({ ...base, startKm: 20, deliveredKm: 18.9 }).metric).toBeNull()
  })

  it('carries no em dash and no emoji', () => {
    const all = Object.values(handoverCopy(base)).filter(Boolean).join(' ')
    expect(all).not.toContain('—')
    // ⚠️ A CODE-POINT SCAN, NOT A REGEX. The obvious `/[\u{1F300}-\u{1FAFF}]/u` needs the
    // `u` flag, which `tsc`'s target rejects (TS1501) even though vitest transpiles it
    // happily — so the typechecker caught a test that ran green. It also reads clearer:
    // `·` (U+00B7) is legitimate punctuation here and must not be swept up.
    const emoji = Array.from(all).filter(ch => {
      const c = ch.codePointAt(0) ?? 0
      return (c >= 0x1F300 && c <= 0x1FAFF) || (c >= 0x2600 && c <= 0x27BF)
    })
    expect(emoji, `emoji in functional copy: ${emoji.join('')}`).toEqual([])
  })

  it('keeps a visible secondary path, because ux-principles bars dead ends', () => {
    expect(handoverCopy(base).secondary.length).toBeGreaterThan(0)
  })
})
