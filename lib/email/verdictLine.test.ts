/**
 * §12 Amendment 2 — praise needs the band AND the ceiling.
 *
 * 🔴 THE RULING, AND THE RULING IT VACATED, BOTH IN ONE DAY. The board first ruled
 * `verdictLine`'s `hr_in_zone_pct >= 70` INCORRECT: §12 is a ceiling, and Am.1
 * made the drift DETECTOR directional. Then the measurement vacated it. Across 73
 * analysed runs:
 *
 *   - under 70% in zone with ZERO above the ceiling — the runner the ruling was
 *     written to protect: **0 of 73. The harm did not exist.**
 *   - `hr_above_ceiling_pct = 0` — held the cap perfectly: **0 of 73**, so the
 *     literal fix would have taken the line from **71 of 73 to none**.
 *
 * The correction: **a one-sided rule does not invert into one-sided praise.** An
 * accusation needs only the ceiling. A compliment needs both.
 */
import { describe, it, expect } from 'vitest'
import { heldTheZone, buildFirstReadEmail, buildDay11Email, buildDay14Email, type RunSummary } from './trialEmailTemplates'
import { ZONE_HELD_MAX_ABOVE_CEILING_PCT, ZONE_DRIFT_ABOVE_CEILING_PCT, TRIAL_SUMMARY_MIN_RUNS } from '@/lib/coaching/constants'

const TOK = '00000000-0000-4000-8000-000000000000'
const run = (o: Partial<RunSummary> = {}): RunSummary => ({
  actualLoadKm: 8.2, hrInZonePct: 84, hrAboveCeilingPct: 6,
  verdict: 'nailed', analysedRunCount: 9, dayName: 'Tuesday', ...o,
})

describe('heldTheZone — both sides, or nothing', () => {
  it('holds when in the band AND under the ceiling', () => {
    expect(heldTheZone({ hrInZonePct: 84, hrAboveCeilingPct: 6 })).toBe(true)
  })

  it('REFUSES the run that is in the band but HOT above the cap', () => {
    // The case §12 actually cares about, and the one the band alone let through.
    expect(heldTheZone({ hrInZonePct: 84, hrAboveCeilingPct: 22 })).toBe(false)
  })

  it('refuses a run below the band even with a clean ceiling', () => {
    expect(heldTheZone({ hrInZonePct: 40, hrAboveCeilingPct: 0 })).toBe(false)
  })

  it('MISSING HR IS SILENCE, NEVER A ZERO (Sims, ADR-011 §5)', () => {
    // An iPhone-only runner has no heart rate. They must not read a sentence
    // implying they failed a test they were never given.
    expect(heldTheZone({ hrInZonePct: null, hrAboveCeilingPct: null })).toBe(false)
    expect(heldTheZone({ hrInZonePct: 84, hrAboveCeilingPct: null })).toBe(false)
  })

  it('praise is STRICTER than accusation, and that asymmetry is the principle', () => {
    expect(ZONE_HELD_MAX_ABOVE_CEILING_PCT).toBeLessThan(ZONE_DRIFT_ABOVE_CEILING_PCT)
  })
})

describe('the subject and the body agree about the same run', () => {
  it('REPRODUCES THE BUG: a hot run must not be subjected "you held the zone"', () => {
    // The day-11 subject was keyed on verdictLine() being non-empty, which is
    // true for "Close. Plan's doing its job." — so a runner 22% above the ceiling
    // was told in the subject that they held it.
    const hot = buildDay11Email('Russ', run({ hrAboveCeilingPct: 22, verdict: 'close' }), TOK)
    expect(hot.subject).not.toContain('held the zone')
    expect(hot.subject).toBe('3 days left.')
  })

  it('and a clean run IS subjected with it', () => {
    expect(buildDay11Email('Russ', run(), TOK).subject).toBe('You held the zone on Tuesday.')
  })
})

describe('the trial summary needs enough runs to be a comparison', () => {
  it('states the evidence at or above the floor', () => {
    const at = buildDay14Email('Russ', run({ analysedRunCount: TRIAL_SUMMARY_MIN_RUNS }), TOK)
    expect(at.html).toContain('sessions of evidence')
  })

  it('SAYS NOTHING below it — three runs is not two halves of anything', () => {
    const below = buildDay14Email('Russ', run({ analysedRunCount: TRIAL_SUMMARY_MIN_RUNS - 1 }), TOK)
    expect(below.html).not.toContain('sessions of evidence')
    // …and still leads on the count, which is true at any number.
    expect(below.subject).toContain(`${TRIAL_SUMMARY_MIN_RUNS - 1} runs read`)
  })

  it('degrades honestly at zero rather than padding', () => {
    const none = buildDay14Email('Russ', run({ analysedRunCount: 0, actualLoadKm: null, hrInZonePct: null, hrAboveCeilingPct: null, verdict: null, dayName: null }), TOK)
    expect(none.subject).toBe('Fourteen days, no runs read.')
    expect(none.html).not.toContain('sessions of evidence')
  })
})

describe('EMAIL-WAVE-3 — the First read email', () => {
  const SESSION = { weekN: 2, sessionDay: 'tue' }

  it('the numbers ARE the headline — larger than any other email H1', () => {
    // Silvanto ruled the wow moment out of email 1 so it could land here. The
    // distance is 40px; every other email's H1 is 22px. If that inverts, the
    // ruling has been undone by a tidy-up.
    const { html } = buildFirstReadEmail('Russ', run({ analysedRunCount: 1 }), TOK, SESSION)
    expect(html).toContain('font-size:40px')
    expect(html).toContain('8.2km')
  })

  it('the subject is the runner, never the trial', () => {
    expect(buildFirstReadEmail('Russ', run({ analysedRunCount: 1 }), TOK, SESSION).subject)
      .toBe('You held the zone on Tuesday.')
    // Not "welcome", not "your trial", not us.
    const s = buildFirstReadEmail('Russ', run({ analysedRunCount: 1 }), TOK, SESSION).subject
    expect(s.toLowerCase()).not.toContain('trial')
    expect(s.toLowerCase()).not.toContain('welcome')
  })

  it('NO HR degrades to the distance, never to a verdict it cannot support', () => {
    const noHr = buildFirstReadEmail('Russ',
      run({ analysedRunCount: 1, hrInZonePct: null, hrAboveCeilingPct: null, verdict: null }), TOK, SESSION)
    expect(noHr.subject).toBe('8.2km on Tuesday. Read.')
    expect(noHr.html).not.toContain('held in zone')
  })

  it('the CTA opens THAT session, not a hub', () => {
    const { html } = buildFirstReadEmail('Russ', run({ analysedRunCount: 1 }), TOK, SESSION)
    expect(html).toContain('screen=post-run&weekN=2&sessionDay=tue')
  })

  it('survives a run with no distance at all', () => {
    const bare = buildFirstReadEmail(null,
      run({ analysedRunCount: 1, actualLoadKm: null, dayName: null, hrInZonePct: null, hrAboveCeilingPct: null, verdict: null }),
      TOK, SESSION)
    expect(bare.subject).toBe('Your first run, read.')
    expect(bare.html).toContain('Your first run')
  })
})
