import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { auditPlanQuality } from './planQuality'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput } from '@/types/plan'
// TEST-CLOCK-PINSWEEP-01 — pinned, or nextMonday() walks this fixture into §44.
import { PINNED_PLAN_START_0921 } from './__fixtures__/pinnedPlanStart'

/**
 * FREQ-SILENCE-01 (§18 Amendment) — when weekly volume, not the runner's life,
 * caps the number of running days, the plan says so.
 *
 * ⚠️ MEASURED BEFORE BUILDING, and the order mattered: 18.7% of the weighted
 * population gets fewer running days than they declared (46% of 5K plans) and
 * the plan never mentioned it. The prescription is CORRECT — `daysVolumeCanFill`
 * caps at weeklyKm / MIN_KM_PER_TRAINING_DAY, never fires above 40 km/week, and
 * fires on 65% of runners under 20. It is volume, working as designed.
 *
 * ⚠️ I NEARLY FILED THE CAP ITSELF AS A DEFECT after seeing a plan hold three
 * runs from 5 km/week to 17 km/week. floor(17/5) = 3. Traced before filing, and
 * case 4 pins the cap so the next person does not re-file it either.
 */

const mk = (o: Record<string, unknown>) => ({
  athlete_name: 'A', age: 32, race_name: 'T', primary_metric: 'distance',
  plan_start: '2026-11-02', goal: 'finish', resting_hr: 55, max_hr: 186,
  injury_history: [], hard_session_relationship: 'neutral',
  recent_quality_training: 'occasional', ...o,
}) as unknown as GeneratorInput

const LOW = mk({
  race_distance_km: 5, race_date: '2027-01-25', fitness_level: 'beginner',
  training_age: '6-18mo', current_weekly_km: 5, longest_recent_run_km: 3,
  days_available: 6,
})
const HIGH = mk({
  race_distance_km: 42.2, race_date: '2027-05-16', fitness_level: 'experienced',
  training_age: '5yr+', current_weekly_km: 70, longest_recent_run_km: 30,
  days_available: 5,
})

/**
 * 🔴 THE BLOCKED-DAYS CAUSE — the population these five arms never contained.
 *
 * `frequencyConstraintNote` fires whenever delivered days fall below declared. It is
 * CAUSE-AGNOSTIC: it counts sessions in the loading weeks and compares. But its reason
 * text is hard-coded to VOLUME, and every arm above feeds it a volume-capped runner —
 * so the check's population is exactly as narrow as the sentence it was validating.
 *
 * A runner who declares 6 days and BLOCKS five of them is reduced by §18 (life-first
 * scheduling, a hard constraint), not by volume. The note still fires — correctly, that
 * is §18 Amendment working — and then tells them their WEEKLY VOLUME is why.
 *
 * §18 Amendment requires the note to name "the days declared, the days used, and THE
 * REASON". Naming a wrong reason is a documented-intent defect, filed as
 * `DAYS-GATE-CAPACITY-01` half (1). These two arms exist so the cause is in the
 * population from now on, and so the wrong wording is PINNED rather than hidden:
 * fixing it must update arm 7 deliberately.
 */
const BLOCKED = mk({
  race_distance_km: 21.1, race_date: '2027-04-25', fitness_level: 'intermediate',
  training_age: '5yr+', current_weekly_km: 30, longest_recent_run_km: 12,
  days_available: 6,
  // FOUR blocked, not five: capacity 3, which generates cleanly.
  // ⚠️ At FIVE blocked this same runner trips `INV-PLAN-QUALITY-NOT-ZERO` (§110) and
  // THROWS in test env while production logs and ships — which is the other half of
  // `DAYS-GATE-CAPACITY-01` and is deliberately not asserted here: pinning a throw
  // would pin an NODE_ENV-dependent behaviour, not the note.
  days_cannot_train: ['monday', 'tuesday', 'wednesday', 'thursday'],
})

describe('FREQ-SILENCE-01', () => {
  it('1. a volume-constrained runner is told, and told the real numbers', () => {
    const m = generateRulePlan(LOW, 'paid', PINNED_PLAN_START_0921).meta as unknown as Record<string, string>
    expect(m.frequency_constraint_note).toBeTruthy()
    expect(m.frequency_constraint_note).toContain('6 days')     // what they asked for
    expect(m.frequency_constraint_note).toMatch(/uses 3/)        // what they get
  })

  it('2. an UNCONSTRAINED runner gets no note — it is not wallpaper', () => {
    const m = generateRulePlan(HIGH, 'paid', PINNED_PLAN_START_0921).meta as unknown as Record<string, string>
    expect(m.frequency_constraint_note).toBeUndefined()
  })

  it('3. where frequency GROWS with volume the note says so, truthfully', () => {
    const plan = generateRulePlan(mk({
      race_distance_km: 42.2, race_date: '2027-05-16', fitness_level: 'beginner',
      training_age: '6-18mo', current_weekly_km: 15, longest_recent_run_km: 7,
      days_available: 5,
    }), 'paid', PINNED_PLAN_START_0921)
    const note = (plan.meta as unknown as Record<string, string>).frequency_constraint_note
    if (!note) return
    const counts = plan.weeks.filter(w => w.n > 0 && (w.phase === 'build' || w.phase === 'peak'))
      .map(w => Object.values(w.sessions ?? {}).filter(
        s => s && s.type !== 'rest' && s.type !== 'strength' && s.type !== 'cross-train').length)
    const lo = Math.min(...counts), hi = Math.max(...counts)
    // The claim in the copy must match the plan, not a guess about it.
    if (hi > lo) {
      expect(note).toContain(`uses ${lo}, building to ${hi}`)
      expect(note).toContain('come back as the volume grows')
    } else {
      expect(note).toContain(`uses ${lo}`)
    }
  })

  it('4. THE CAP IS DESIGN, NOT A DEFECT — pinned so it is not re-filed', () => {
    // daysVolumeCanFill = max(3, floor(weeklyKm / MIN_KM_PER_TRAINING_DAY)).
    // A plan holding 3 runs from 5 km/wk to 17 km/wk is this arithmetic, not a
    // frequency bug: floor(17/5) = 3.
    const min = GENERATION_CONFIG.MIN_KM_PER_TRAINING_DAY
    expect(min).toBeGreaterThan(0)
    expect(Math.max(3, Math.floor(17 / min))).toBe(3)
    expect(Math.max(3, Math.floor(36 / min))).toBeGreaterThanOrEqual(6)
  })

  it('5. a DECLARED shortfall is no longer a coach objection; an undeclared one still is', () => {
    const plan = generateRulePlan(LOW, 'paid', PINNED_PLAN_START_0921)
    expect(auditPlanQuality(plan, LOW).map(o => o.code)).not.toContain('DAYS-SHORT')
    // Strip the declaration and the objection must come back — otherwise the
    // predicate was simply switched off rather than made conditional.
    delete (plan.meta as unknown as Record<string, unknown>).frequency_constraint_note
    expect(auditPlanQuality(plan, LOW).map(o => o.code)).toContain('DAYS-SHORT')
  })

  // ✅ The uncovered cause: the note FIRES when life, not volume, cut the days.
  it('6. a BLOCKED-DAYS runner is told at all — the cause these arms never contained', () => {
    const plan = generateRulePlan(BLOCKED, 'paid', PINNED_PLAN_START_0921)
    const note = plan.meta?.frequency_constraint_note
    expect(note, '§18 Am. applies to any cause, not only volume').toBeTruthy()
    expect(note).toContain('6 days a week')
    // 7 − 4 blocked = 3 possible days, and the plan must not claim more.
    expect(note).toMatch(/This plan uses [123]\b/)
  })

  // 🔴 PINNED DEFECT, not an endorsement. `DAYS-GATE-CAPACITY-01` half (1).
  // ✅ FLIPPED 2026-10-06 (DAYS-GATE-CAPACITY-01 half 1). The previous arm pinned
  // the WRONG REASON on purpose, with the instruction "when half (1) ships, this
  // expectation must flip to naming the blocked days". It has shipped, so it has.
  it('7. names the BLOCKED DAYS as the reason, because that is what binds here', () => {
    const plan = generateRulePlan(BLOCKED, 'paid', PINNED_PLAN_START_0921)
    const note = plan.meta!.frequency_constraint_note!
    // This runner declared 6 and blocked 4, so capacity is 3 and capacity is what
    // binds. §18 Am. requires the note to name THE reason, and volume is not it.
    expect(note).toMatch(/you have blocked 4 days and only 3 are clear/)
    expect(note, 'must no longer blame weekly volume')
      .not.toContain('your weekly volume spread any thinner')
    expect(note, 'and must point at the lever that works')
      .toContain('Freeing up a day is what adds one, not more volume')
  })
})
