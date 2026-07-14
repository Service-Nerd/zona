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
    expect(prompt).toMatch(/the goal race/i)
  })

  // §71.1–71.2 — a finished goal race is debriefed, not scored. The plan-scoring
  // verdict must never leak into the note, and the note leads with the
  // achievement rather than any shortfall.
  it('suppresses the plan-scoring verdict and leads with the achievement', () => {
    const prompt = buildDailyCoachNotePrompt({
      ...base,
      planComplete: true,
      raceAchievement: '100K done. In the book.',
      lastSession: {
        daysAgo: 3, dayName: 'Saturday', type: 'race',
        verdict: 'off_target', hrAboveCeilingPct: 40, rpe: 9, fatigueTag: 'Wrecked',
      },
    })
    // The off_target verdict must never reach the prompt.
    expect(prompt).not.toMatch(/off_target/)
    // Leads with the deterministic achievement acknowledgement.
    expect(prompt).toMatch(/100K done\. In the book\./)
    // Race-debrief framing is present, and it must forbid shortfall language.
    expect(prompt).toMatch(/GOAL RACE/)
    expect(prompt).toMatch(/finishing the distance IS the achievement/i)
    expect(prompt).toMatch(/didn't land/i) // present only inside the "never say" rule
  })

  it('suppresses a race verdict in the normal (plan-running) branch too', () => {
    const prompt = buildDailyCoachNotePrompt({
      ...base,
      planComplete: false,
      todaySessionType: 'easy', todaySessionLabel: 'Easy 8km',
      todayZoneLabel: 'Zone 2', todayDistanceKm: 8,
      lastSession: {
        daysAgo: 2, dayName: 'Sunday', type: 'race',
        verdict: 'off_target', hrAboveCeilingPct: 55, rpe: 8, fatigueTag: null,
      },
    })
    // The verdict fact line (few-shot examples mention off_target; the facts must not).
    expect(prompt).not.toMatch(/verdict: off_target/)
    expect(prompt).not.toMatch(/above zone ceiling/)
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
