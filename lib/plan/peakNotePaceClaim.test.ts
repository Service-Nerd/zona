/**
 * PEAK-RACEPACE-NOTE-01 — a coach note may not claim a race-pace target on a session
 * that is not race-pace work.
 *
 * `makeQualitySession` appended "Race-pace work. Target: {goalPace}." to any peak
 * catalogue session whose `coach_voice_notes` did not contain the word "pace". A word in
 * the copy is not the prescription, and the test was wrong in both directions:
 *
 *   · 14 of 14 notes across 1,070 cohort-grid plans landed on a `threshold` row — 100%.
 *     `cv_intervals` prescribes 4:39–4:51 /km and the note said "Target: 5:12 /km".
 *   · All 9 `race_specific` rows name "pace" in their own voice, so the note was
 *     suppressed on every row it was written for. Structurally, always.
 *
 * The note is deleted. §33 is served by the two branches above it, which synthesise a
 * voice matching the prescription (452 of 849 peak race_specific sessions) or carry a
 * catalogue voice that already states the pace in words (the other 397).
 *
 * ⚠️ KEYED ON THE STAMPED `stimulus`, NEVER THE CATALOGUE CATEGORY. §22 legitimately
 * substitutes goal pace onto `threshold` rows (`tempo_cruise` at 4:54–5:06 /km with
 * "Target 5:00 /km" is correct), so a category test false-fires on the real thing —
 * which the first cut of this file did, 1,500 times. The stamp is the same discriminator
 * §33 Am. and INV-PLAN-COACH-NOTES-MATCH-INTENT's step arm already use.
 *
 * Measured after the deletion: of 9,254 catalogue sessions, every one of the 1,500
 * race-pace claims is stamped `race_pace`, and `tempo` (5,881), `vo2max` (1,118) and
 * unstamped (737) carry zero.
 */
import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { V1_SESSION_CATALOGUE } from './sessionCatalogueData'
import { cohortGrid, COHORT_PLAN_START } from './cohortGrid'
import type { GeneratorInput, Session } from '@/types/plan'

/** A note asserting the session is run at race/goal pace. Matches the deleted line and
 *  §22's synthesised voice, which is legitimate ONLY on race-pace work. */
const CLAIMS_RACE_PACE = /race-pace work|-pace work\. Target/i

/** The stamp that means "this session IS run at race/goal pace" (§22, §33 Am.). */
const RACE_PACE_STIMULUS = 'race_pace'

describe('PEAK-RACEPACE-NOTE-01 — the catalogue side', () => {
  it('every race_specific row names its pace in its own voice, so a word test could never reach one', () => {
    // This is WHY the note was deleted rather than re-keyed: the guard it used can only
    // fire on rows that are not race-pace work. Asserted so the reasoning cannot rot.
    const raceRows = V1_SESSION_CATALOGUE.filter(r => r.category === 'race_specific')
    expect(raceRows.length).toBeGreaterThan(0)
    for (const r of raceRows) {
      expect((r.coach_voice_notes ?? '').toLowerCase(), r.id).toContain('pace')
    }
  })
})

describe('PEAK-RACEPACE-NOTE-01 — the generated side', () => {
  it('the traced case: E4 week 8 CV intervals carries no race-pace claim', () => {
    // The session the item was filed on: header 4:39–4:51 /km, note "Target: 4:30 /km".
    const input = {
      race_distance_km: 10, goal: 'time_target', target_time: '0:45:00',
      current_weekly_km: 55, longest_recent_run_km: 22, days_available: 5, age: 35,
      training_age: '5yr+', recent_quality_training: 'regular', race_date: '2026-07-19',
    } as unknown as GeneratorInput
    const plan = generateRulePlan(input, 'paid', COHORT_PLAN_START)
    const offenders = plan.weeks.flatMap(w =>
      (Object.values(w.sessions ?? {}).filter(Boolean) as Session[])
        .filter(s => (s as { stimulus?: string }).stimulus !== RACE_PACE_STIMULUS)
        .filter(s => (s.coach_notes ?? []).some(n => CLAIMS_RACE_PACE.test(String(n))))
        .map(s => `w${w.n} ${s.catalogue_id} header ${s.pace_target} notes ${JSON.stringify(s.coach_notes)}`))
    expect(offenders).toEqual([])
  })

  it('NO session in the corpus claims race pace unless it is stamped race_pace', () => {
    // 🔴 THE POPULATION IS THE CONDITION, NOT A SAMPLE OF THE GRID.
    //
    // The first cut strided the whole 41,472-case grid at 31 (~1,340 plans, 10.6s — over
    // `check:slow`'s line). Widening the stride to 151 brought it to 1.6s and the arm
    // STOPPED CATCHING THE DEFECT: re-falsified, only the traced case went red. A blind
    // sample of a grid where ~1% of plans can carry the defect is a coin toss dressed as
    // coverage, and it is the exact "population excludes the cases at risk" class this
    // repo records four times in one day.
    //
    // The note required a goal pace, so only `time_target` plans could ever carry it.
    // Filtering to that condition makes every plan generated a plan at risk — denser,
    // faster, and falsifiable at this stride. ⚠️ FALSIFIED AT 61 SPECIFICALLY, not at a
    // narrower one and assumed to survive widening: restoring the deleted note turns both
    // arms red here, and the whole reason this comment exists is that it did NOT at 151.
    let checked = 0
    const offenders: string[] = []
    const atRisk = (cohortGrid() as GeneratorInput[]).filter(i => i.goal === 'time_target')
    const STRIDE = 61
    for (let k = 0; k < atRisk.length; k += STRIDE) {
      const input = atRisk[k]
      let plan
      try { plan = generateRulePlan(input as GeneratorInput, 'paid', COHORT_PLAN_START) } catch { continue }
      for (const w of plan.weeks) {
        for (const s of Object.values(w.sessions ?? {}).filter(Boolean) as Session[]) {
          const stimulus = (s as { stimulus?: string }).stimulus
          // Scoped to sessions with a catalogue identity: a race session carries no row,
          // and its pacing advice ("First 2.5 km at 6:20 /km") is strategy, not a claim
          // about the session's own prescription.
          if (!s.catalogue_id) continue
          if (stimulus === RACE_PACE_STIMULUS) continue
          checked++
          const claim = (s.coach_notes ?? []).find(n => CLAIMS_RACE_PACE.test(String(n)))
          if (claim) offenders.push(`w${w.n} ${s.catalogue_id} (stimulus ${stimulus ?? 'none'}) header ${s.pace_target} — "${String(claim).slice(0, 70)}"`)
        }
      }
    }
    expect(checked, 'no catalogue sessions examined — the assertion never ran').toBeGreaterThan(500)
    expect(offenders.slice(0, 5)).toEqual([])
  })
})
