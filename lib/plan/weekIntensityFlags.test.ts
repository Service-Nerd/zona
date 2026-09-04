import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { weekIntensityFlags, isOverloadWeek } from './weekIntensityFlags'
import type { Week } from '@/types/plan'

/**
 * The enrich prompt and `INV-PLAN-COPY-MATCHES-SESSIONS` (§27/§41) must agree
 * about what kind of hard work a week contains.
 *
 * They did not. The prompt was told a single conflated `has_intensity` that
 * counted the §78 time trial (typed `hard`) as intensity. §27's claim table asks
 * two different questions — "sharpen" requires a QUALITY session specifically,
 * because a measurement is not something you sharpen on — so on 2026-09-04 the
 * model was told a deload week "had intensity", wrote "Build — recovery and
 * sharpening", and the invariant correctly rejected it. That week lost its voice.
 *
 * The failure class was added to the zona-debug catalogue the same afternoon —
 * `checker reads a different source from the producer` — and then committed in
 * the very fix meant to prevent it. Hence one owner, and this test.
 */

const week = (...types: string[]): Pick<Week, 'sessions' | 'weekly_km'> => ({
  sessions: Object.fromEntries(types.map((t, i) => [`d${i}`, { type: t }])),
  weekly_km: 30,
} as unknown as Pick<Week, 'sessions' | 'weekly_km'>)

describe('weekIntensityFlags', () => {
  it('a quality session is quality, and is NOT a benchmark', () => {
    expect(weekIntensityFlags(week('easy', 'quality'))).toMatchObject({ hasQuality: true, hasBenchmark: false })
  })

  it('the §78 time trial is a BENCHMARK, not quality — the distinction that broke', () => {
    // The whole point. A deload week carrying only the time trial is recovering
    // and measuring; it is not a week you may call "sharpening".
    expect(weekIntensityFlags(week('easy', 'hard'))).toMatchObject({ hasQuality: false, hasBenchmark: true })
  })

  it('an all-easy week has neither', () => {
    expect(weekIntensityFlags(week('easy', 'easy', 'rest'))).toMatchObject({ hasQuality: false, hasBenchmark: false })
  })

  it('race week has neither — the race is the goal, not training', () => {
    expect(weekIntensityFlags(week('easy', 'race'))).toMatchObject({ hasQuality: false, hasBenchmark: false })
  })

  it('intervals and tempo count as quality (legacy plan types)', () => {
    expect(weekIntensityFlags(week('intervals')).hasQuality).toBe(true)
    expect(weekIntensityFlags(week('tempo')).hasQuality).toBe(true)
  })
})

describe('isOverloadWeek — §27\'s overload arm', () => {
  const w = (type: string, km: number) => ({ type, weekly_km: km }) as unknown as Pick<Week, 'type' | 'weekly_km'>

  it('a rising week overloads; a falling one does not', () => {
    const weeks = [w('normal', 30), w('normal', 40)]
    expect(isOverloadWeek(weeks[1], weeks)).toBe(true)
    const down = [w('normal', 40), w('normal', 30)]
    expect(isOverloadWeek(down[1], down)).toBe(false)
  })

  it('TAPER and RACE weeks never overload — the case that shipped', () => {
    // The model claimed overload on a 30 km taper after a 43 km build and on a
    // 15 km race week after 30. It had been given the RULE and asked to compare
    // weekly_km across weeks it was not tracking.
    const weeks = [w('normal', 43), w('normal', 30), w('race', 15)]
    expect(isOverloadWeek(weeks[1], weeks)).toBe(false)
    expect(isOverloadWeek(weeks[2], weeks)).toBe(false)
  })

  it('compares against the previous NON-DELOAD week, skipping deloads', () => {
    const weeks = [w('normal', 40), w('deload', 25), w('normal', 35)]
    // 35 < 40 — a deload in between does not make 35 an overload.
    expect(isOverloadWeek(weeks[2], weeks)).toBe(false)
    const rising = [w('normal', 30), w('deload', 20), w('normal', 35)]
    expect(isOverloadWeek(rising[2], rising)).toBe(true)
  })

  it('permits the claim when there is no prior non-deload week — §27 does too', () => {
    const weeks = [w('normal', 30)]
    expect(isOverloadWeek(weeks[0], weeks)).toBe(true)
  })

  it('returns false when the week list is absent — never guesses', () => {
    expect(isOverloadWeek({ weekly_km: 50 } as Pick<Week, 'weekly_km'>)).toBe(false)
  })
})

describe('the prompt and the invariant describe the SAME predicates', () => {
  const enrichSrc = readFileSync(join(process.cwd(), 'lib/plan/enrich.ts'), 'utf8')
  const invSrc = readFileSync(join(process.cwd(), 'lib/plan/invariants.ts'), 'utf8')

  it('both derive the flags through the shared owner, not their own copy', () => {
    expect(enrichSrc, 'enrich.ts computes its own flags').toMatch(/\.\.\.weekIntensityFlags\(/)
    expect(invSrc, 'invariants.ts computes its own flags').toContain('weekIntensityFlags(')
    // The conflated single flag must not come back.
    expect(enrichSrc).not.toMatch(/has_intensity:/)
  })

  it('the prompt names both flags and separates the "sharpen" group', () => {
    // A prompt that mentions only one flag cannot express §27's claim table,
    // which asks quality-OR-benchmark for some words and quality-ONLY for others.
    expect(enrichSrc).toContain('has_quality')
    expect(enrichSrc).toContain('has_benchmark')
    // The overload flag replaced a RULE the model had to evaluate; the prompt
    // must state the flag and must tell it not to do the arithmetic itself.
    expect(enrichSrc).toContain('is_overload_week')
    expect(enrichSrc).toMatch(/Do NOT compare weekly_km/)
    expect(enrichSrc, 'the sharpen group is not separated from the quality-or-benchmark group')
      .toMatch(/sharpen[\s\S]{0,400}has_quality is true/)
  })

  it('every word §27 polices appears in the prompt', () => {
    // Extracted from the CLAIMS table. If a claim gains a word and the prompt is
    // not updated, the model is being judged on a rule it was never told.
    for (const w of ['quality', 'threshold', 'tempo', 'interval', 'VO2',
                     'sharpen', 'raising the ceiling', 'intensity stays',
                     'feels hard', 'benchmark', 'time trial',
                     'highest volume', 'fitness is built']) {
      expect(enrichSrc.toLowerCase(), `prompt never mentions "${w}"`).toContain(w.toLowerCase())
    }
  })
})
