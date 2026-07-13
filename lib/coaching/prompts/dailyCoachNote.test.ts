import { describe, it, expect } from 'vitest'
import { buildDailyCoachNotePrompt, type DailyCoachNoteInput } from './dailyCoachNote'

const base: DailyCoachNoteInput = {
  todayDayName:      'Monday',
  todaySessionType:  null,
  todaySessionLabel: null,
  todayZoneLabel:    null,
  todayDistanceKm:   null,
  lastSession:       null,
  weekPhase:         null,
  weekN:             25,
  totalWeeks:        25,
  weeksToRace:       0,
  raceName:          'Ultra 100',
  raceDistanceKm:    100,
  heavyFatigueTrend: false,
  consecutiveNailed: 0,
  firstName:         'Russ',
}

// ─── Plan-complete branch ──────────────────────────────────────────────────
// Locks the post-race bug where the daily note prescribed the final week's
// stale Monday shakeout days after the plan (and race) had finished.
describe('buildDailyCoachNotePrompt — plan complete', () => {
  it('never prescribes a session once the plan is over', () => {
    const prompt = buildDailyCoachNotePrompt({
      ...base,
      planComplete: true,
      lastSession: {
        daysAgo: 2, dayName: 'Saturday', type: 'race',
        verdict: 'nailed', hrAboveCeilingPct: null, rpe: 7, fatigueTag: null,
      },
    })
    expect(prompt).toMatch(/plan has finished/i)
    expect(prompt).toMatch(/NO session/i)
    expect(prompt).toMatch(/Never prescribe/i)
    // The old phantom-session few-shots must not appear in this branch.
    expect(prompt).not.toMatch(/First quality of the build/)
    // Last race is available for the model to acknowledge.
    expect(prompt).toMatch(/race on Saturday|race on/i)
  })

  it('falls through to the normal note when the plan is still running', () => {
    const prompt = buildDailyCoachNotePrompt({
      ...base,
      planComplete: false,
      todaySessionType: 'easy',
      todaySessionLabel: 'Easy 10km',
      todayZoneLabel: 'Zone 2',
      todayDistanceKm: 10,
    })
    expect(prompt).not.toMatch(/plan has finished/i)
    expect(prompt).toMatch(/Today \(Monday\): 10km easy/)
  })
})
