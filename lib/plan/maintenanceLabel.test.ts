// MAINT-LABEL-01 — what the plan CALLS itself to a beginner.
//
// Measured 2026-09-11: 89% of beginner MARATHON plans carry a
// `volume_constraint_note` (320 of 360; 10K 0%, HM 4%), including a parkrun-er
// with a 24-week runway. Every one of them used to open "Plan generated as
// maintenance" — a word §23 defines as "maintains current fitness rather than
// building it" — to a first-time charity runner going from 5km a week to 26.2
// miles, who will improve more than any other user of this product.
//
// SLT ruling: fix the word, not the engine. `volume_profile` is UNCHANGED
// (it feeds the paid confidence score and §38's remedies; changing the VALUE is
// a Coaching Board question). This pins the prose only.

import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import type { GeneratorInput } from '@/types/plan'

// ⚠️ RE-ANCHORED 2026-09-16 (LR-CAP-BLIND-01), from 4 days to 3, and the reason
// is a RESULT rather than test maintenance.
//
// On 4 days this runner no longer gets a `volume_constraint_note`, because the
// plan is no longer downgraded to maintenance — it now builds 18 -> 43 km.
// The old downgrade was an artefact of the §45 blind spot: a duration-anchored
// long run was jumping uncapped, the week went past §52's 60% share, and the
// lopsided-week trigger pushed the plan to maintenance. Cap the spike and the
// trigger stops firing.
//
// So the plan this file was written about got BETTER, and the honest residuals
// it still owes are still declared (`long_run_shortfall_note`,
// `load_residual_note`). What it no longer does is call itself maintenance,
// which was the whole complaint MAINT-LABEL-01 was raised about.
//
// The file's subject — what a beginner charity marathoner READS when the plan
// genuinely cannot build — still exists at 3 days (§52's low-day rule owns that
// shape and is untouched). Re-anchored there rather than weakened, so the prose
// assertions below still test a real runner.
// ⚠️ RE-ANCHORED 2026-09-18 (§111), current_weekly_km 5 -> 15. A 5km base is now
// REFUSED for a marathon (BaseVolumeError): the week-1 floor of 18km is a 3.6x
// jump off it. 15km is the representative first-time charity marathoner (persona
// M1) — still a beginner, still lands in genuine maintenance at 3 days (§52's
// low-day rule owns the shape), and still reads exactly the honest note this file
// is about. The reckless base was refused, not the note weakened.
const charityBeginner = (over: Record<string, unknown> = {}) => ({
  athlete_name: 'A', age: 38, race_name: 'Charity', primary_metric: 'distance',
  plan_start: '2026-04-27', race_distance_km: 42.2, race_date: '2026-10-05',
  goal: 'finish', current_weekly_km: 15, longest_recent_run_km: 8,
  fitness_level: 'beginner', recent_quality_training: 'none',
  hard_session_relationship: 'avoid', injury_history: [],
  days_available: 3, days_cannot_train: [], ...over,
}) as unknown as GeneratorInput

const noteFor = (over: Record<string, unknown> = {}) => {
  const input = charityBeginner(over)
  const plan = generateRulePlan(input, 'paid', '2026-04-27', undefined, '2026-04-27')
  return { note: plan.meta.volume_constraint_note ?? null, profile: plan.meta.volume_profile }
}

describe('the note a beginner charity marathoner reads', () => {
  it('exists at all (guards the guard)', () => {
    const { note } = noteFor()
    expect(note, 'this runner is the 89% case; if no note fires, this file tests nothing').toBeTruthy()
  })

  it('never OPENS by calling the plan maintenance', () => {
    const { note } = noteFor()
    expect(note!.startsWith('Plan generated as maintenance')).toBe(false)
  })

  it('says what the plan IS, not what classification it got', () => {
    const { note } = noteFor()
    expect(note!.toLowerCase()).toMatch(/this plan is built to/)
  })

  // The honesty obligation is not weakened — §38 requires diagnosis AND the
  // lever. Softening the label must not soften the information.
  it('still names the diagnosis and the lever (§38)', () => {
    const { note } = noteFor()
    expect(note!.toLowerCase(), 'diagnosis missing').toMatch(/long run|volume|days|time/)
    // ⚠️ ASSERTS THE PROPERTY, NOT THE WORD. This used to require the literal
    // token 'lever', which passed only because the 4-day note happened to use
    // it. §38/§40c require the note to name a concrete CHANGE the runner can
    // make; the 3-day note does that perfectly ("run at least 4 days a week")
    // without ever saying "lever". A test that pins vocabulary instead of
    // behaviour fails on correct copy and passes on a disclaimer that happens
    // to contain the right noun.
    expect(note!.toLowerCase(), 'no actionable remedy named').toMatch(
      /if you want it to build instead:|the lever is/,
    )
  })

  // Sutherland's point, and the reason this item existed: they WILL get fitter.
  it('tells a beginner they will improve, because they will', () => {
    const { note } = noteFor()
    expect(note!.toLowerCase()).toContain('fitter')
  })

  // The VALUE is deliberately untouched — it feeds the confidence score and
  // §38's remedy selection. Changing it is the board's half of this item.
  it('leaves volume_profile alone — that half is the Coaching Board’s', () => {
    expect(noteFor().profile).toBe('maintenance')
  })

  // The post-race maintenance BLOCK is a different thing and genuinely is
  // maintenance; this item must not have touched it.
  it('does not describe a plan as maintenance anywhere in the opening clause', () => {
    for (const over of [
      {}, { days_available: 3 }, { current_weekly_km: 12, longest_recent_run_km: 5 },
      { race_distance_km: 21.1, race_date: '2026-08-17' },
    ]) {
      const { note } = noteFor(over)
      if (!note) continue
      expect(note.split('—')[0], `opening clause: "${note.split('—')[0]}"`)
        .not.toMatch(/generated as maintenance/i)
    }
  })
})
