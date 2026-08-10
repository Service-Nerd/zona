import { describe, it, expect } from 'vitest'
import { buildLinkPushCopy, buildDailyPushTitle } from './voiceLines'

/**
 * POST-RUN-02 link-push copy. The lock-screen line must prove Kit looked
 * (morsel from avg HR vs the planned zone) and keep the "how did it feel?" CTA
 * so the tap-through into the Post-Run screen stays a continuation.
 *
 * Safety contract: the only praise line ("Held the zone") may fire ONLY when
 * average HR sat at/under the planned ceiling — never as a global verdict.
 */
describe('buildLinkPushCopy', () => {
  const easy  = (hr_target: string | null) => ({ type: 'easy'  as const, hr_target: hr_target ?? undefined })
  const tempo = { type: 'tempo' as const, hr_target: '155–168 bpm' }

  it('praises control when avg HR is at/under the ceiling on a controlled-zone day', () => {
    const copy = buildLinkPushCopy(easy('< 145 bpm'), 138)
    expect(copy.title).toBe('Held the zone on that one.')
    expect(copy.body).toContain('how did it feel?')
  })

  it('treats avg HR exactly on the ceiling as held', () => {
    expect(buildLinkPushCopy(easy('< 145 bpm'), 145).title).toBe('Held the zone on that one.')
  })

  it('nudges (never praises) when avg HR runs over the ceiling', () => {
    const copy = buildLinkPushCopy(easy('< 145 bpm'), 158)
    expect(copy.title).toBe('Bit warm, that one.')
    expect(copy.body).toContain('how did it feel?')
  })

  it('uses the range upper bound as the ceiling', () => {
    // 162 is inside 155–168, i.e. at/under the upper bound → held, not warm.
    expect(buildLinkPushCopy({ type: 'long', hr_target: '150–165 bpm' }, 162).title)
      .toBe('Held the zone on that one.')
  })

  it('credits effort on hard days without an HR verdict', () => {
    const copy = buildLinkPushCopy(tempo, 171)
    expect(copy.title).toBe("That's the hard one done.")
    expect(copy.body).toContain('how did it feel?')
  })

  it('falls back to neutral recognition when avg HR is missing', () => {
    expect(buildLinkPushCopy(easy('< 145 bpm'), null).title).toBe("That one's in.")
  })

  it('falls back to neutral when the session has no parseable HR target', () => {
    expect(buildLinkPushCopy(easy(null), 140).title).toBe("That one's in.")
    expect(buildLinkPushCopy({ type: 'strength', hr_target: undefined }, 120).title).toBe("That one's in.")
  })

  it('never praises a controlled-zone day with no HR data (safe-by-construction)', () => {
    // No avg HR → cannot assert control → must not say "Held the zone".
    expect(buildLinkPushCopy(easy('< 150 bpm'), undefined).title).not.toContain('Held the zone')
  })

  it('always keeps the RPE/feel CTA in the body', () => {
    for (const copy of [
      buildLinkPushCopy(easy('< 145 bpm'), 138),
      buildLinkPushCopy(easy('< 145 bpm'), 160),
      buildLinkPushCopy(tempo, 170),
      buildLinkPushCopy(easy(null), 140),
    ]) {
      expect(copy.body).toContain('how did it feel?')
    }
  })
})

/**
 * HOOK-01 daily morning push title. The bureaucratic "Today:" prefix is gone;
 * the temporal anchor lives naturally in the phrasing; the register varies by
 * session type; and easy/recovery days name the key session they protect.
 */
describe('buildDailyPushTitle', () => {
  const s = (type: string, extra: Record<string, unknown> = {}) =>
    ({ type, ...extra } as any)

  it('never uses the old "Today:" prefix', () => {
    for (const type of ['easy', 'long', 'tempo', 'intervals', 'recovery', 'strength', 'rest', 'race']) {
      expect(buildDailyPushTitle(s(type, { duration_mins: 45 }))).not.toMatch(/^Today:/)
    }
  })

  it('frames easy days as easy, keeping the metric and a "today" anchor', () => {
    expect(buildDailyPushTitle(s('easy', { duration_mins: 45 }))).toBe('Easy 45 min today.')
  })

  it('names the upcoming key session on an easy day', () => {
    const title = buildDailyPushTitle(
      s('easy', { duration_mins: 45 }),
      { type: 'intervals', dayName: 'Thursday' },
    )
    expect(title).toBe('Easy 45 min today. Intervals Thursday.')
  })

  it('applies the same purpose hook to recovery days', () => {
    const title = buildDailyPushTitle(
      s('recovery', { duration_mins: 30 }),
      { type: 'tempo', dayName: 'Friday' },
    )
    expect(title).toBe('Recovery 30 min today. Tempo Friday.')
  })

  it('uses the ≥60→hours glyph for durations (the "78m" ambiguity is retired)', () => {
    // The bug that started ADR-015: a 78-min easy run must never read "78m".
    expect(buildDailyPushTitle(
      s('easy', { duration_mins: 78 }),
      null,
      { units: 'km', metric: 'duration' },
    )).toBe('Easy 1h 18 today.')
  })

  it('honours the resolved metric + units passed by the caller', () => {
    const both = s('tempo', { distance_km: 8.04672, duration_mins: 40 })
    expect(buildDailyPushTitle(both, null, { units: 'mi', metric: 'distance' }))
      .toBe("The hard one's today. 5mi.")
    expect(buildDailyPushTitle(both, null, { units: 'km', metric: 'duration' }))
      .toBe("The hard one's today. 40 min.")
  })

  it('gives the long and hard days their own register', () => {
    expect(buildDailyPushTitle(s('long', { duration_mins: 120 }))).toBe('The long one today. 2h.')
    expect(buildDailyPushTitle(s('tempo', { distance_km: 8 }))).toBe("The hard one's today. 8km.")
    expect(buildDailyPushTitle(s('intervals', { distance_km: 8 }))).toBe('Intervals today. 8km.')
  })

  it('turns rest into a permission slip, not a blank', () => {
    expect(buildDailyPushTitle(s('rest'))).toBe('Nothing today. On purpose.')
    expect(buildDailyPushTitle(null)).toBe('Nothing today. On purpose.')
  })

  it('handles strength and race', () => {
    expect(buildDailyPushTitle(s('strength'))).toBe('Strength today.')
    expect(buildDailyPushTitle(s('race', { distance_km: 21.1 }))).toBe('Race day.')
  })

  it('does not append a key-session hook to non-easy/recovery days', () => {
    const title = buildDailyPushTitle(
      s('long', { duration_mins: 120 }),
      { type: 'intervals', dayName: 'Thursday' },
    )
    expect(title).toBe('The long one today. 2h.')
  })
})
