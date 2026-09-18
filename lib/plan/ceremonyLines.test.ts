import { describe, it, expect } from 'vitest'
import { ceremonyLinesFor } from './ceremonyLines'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput } from '@/types/plan'

// FIRSTRUN-MOMENTS-01c.
//
// The ceremony's job is to prove the app listened. So the properties under test
// are: does it say something only true of THIS runner, does it stay silent
// rather than hedge when a field is missing, and does it obey the two rules that
// make it safe — ADR-015 for every duration, and the voice table's ban on
// cheerleading.

const input = (o: Partial<GeneratorInput>): Partial<GeneratorInput> => o

describe('ceremonyLinesFor — the app proving it listened', () => {
  it('says nothing at all without inputs, rather than hedging', () => {
    expect(ceremonyLinesFor(null)).toEqual([])
    expect(ceremonyLinesFor(undefined)).toEqual([])
    expect(ceremonyLinesFor({})).toEqual([])
  })

  it('names the days the runner asked for, and promises no more', () => {
    const [line] = ceremonyLinesFor(input({ days_available: 3 }))
    expect(line).toBe('You said 3 days a week. We are not going to ask for more.')
  })

  it('singularises one day', () => {
    expect(ceremonyLinesFor(input({ days_available: 1 }))[0]).toContain('1 day a week')
  })

  it('🔴 the weekday cap reads in HOURS past the hour (ADR-015)', () => {
    // "90 minutes" is the defect NOTE-DURATION-FMT-01 fixed across the engine
    // hours before this shipped. It must not reappear on a new surface.
    const lines = ceremonyLinesFor(input({ max_weekday_mins: 90 }))
    expect(lines.some(l => l.includes('1h 30'))).toBe(true)
    expect(lines.join(' ')).not.toMatch(/\d+\s*minutes/)
  })

  it('reads the cap in minutes when it is under an hour', () => {
    expect(ceremonyLinesFor(input({ max_weekday_mins: 45 })).some(l => l.includes('45 min'))).toBe(true)
  })

  it('🔴 names a MULTI-WORD injury exactly as the wizard sends it', () => {
    // The wizard's INJURIES chips are `['Achilles','Knee','Back','Hip',
    // 'Shin splints','Plantar fasciitis']`, lowercased at
    // GeneratePlanScreen.tsx:975 — so the value is 'shin splints' WITH A SPACE,
    // not 'shin_splints'. A lookup table keyed on the underscore form silently
    // dropped exactly these two, which is the defect class that already killed
    // three injury types in production.
    const lines = ceremonyLinesFor(input({ injury_history: ['shin splints'] } as Partial<GeneratorInput>))
    expect(lines.some(l => l.includes('your shin splints'))).toBe(true)
  })

  it('works for an injury value nobody has added yet', () => {
    // No table means no maintenance burden and no silent drop.
    const lines = ceremonyLinesFor(input({ injury_history: ['Peroneal tendon'] } as Partial<GeneratorInput>))
    expect(lines.some(l => l.includes('your peroneal tendon'))).toBe(true)
  })

  it('quotes §1 from CONFIG, never a typed-in percentage', () => {
    const lines = ceremonyLinesFor(input({ race_distance_km: 42.2 }))
    const expected = 100 - GENERATION_CONFIG.INTENSITY_DISTRIBUTION.MARATHON.max_quality_session_pct
    expect(lines.some(l => l.includes(`${expected}% of your sessions`))).toBe(true)
  })

  it('never cheerleads — the voice table bans it', () => {
    const lines = ceremonyLinesFor(input({
      days_available: 3, longest_recent_run_km: 8, max_weekday_mins: 45,
      race_distance_km: 42.2, injury_history: ['knee'],
    } as Partial<GeneratorInput>)).join(' ').toLowerCase()
    for (const banned of ['you\'ve got this', 'crushing', 'amazing', 'beast', 'conquer', 'you can do']) {
      expect(lines, `cheerleading: "${banned}"`).not.toContain(banned)
    }
  })

  it('a full profile produces several distinct lines, in input order', () => {
    const lines = ceremonyLinesFor(input({
      days_available: 4, longest_recent_run_km: 12, max_weekday_mins: 60,
      race_distance_km: 42.2, injury_history: ['knee'],
    } as Partial<GeneratorInput>))
    expect(lines.length).toBeGreaterThanOrEqual(4)
    expect(new Set(lines).size).toBe(lines.length)
    expect(lines[0]).toContain('4 days')
  })
})
