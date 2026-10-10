import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { ACK_FIELD, ACK_LABEL, warnKindOf } from './warnAcknowledgement'
import { validatePrepTime, validateDaysAvailable, PrepTimeError, DaysAvailableError } from './inputs'
import { generateRulePlan } from './ruleEngine'
import type { GeneratorInput } from '@/types/plan'

/**
 * `PREP-ACK-NO-WRITER-01` — the gate for step two of a two-step pattern.
 *
 * 🔴 THIS IS A COMPOSITION TEST BY DESIGN, and that is the whole lesson of the
 * defect. Both halves were already correct and individually tested: the engine
 * threw `warn_unacknowledged` correctly, and the route returned
 * `requires_acknowledgment: true` correctly. **Nothing ran the engine's refusal
 * through to a resend**, so the only question that mattered — *what does the
 * system DO after this input?* — was asked nowhere. See
 * [[feedback-test-the-composition-not-the-halves]].
 */

const PS = '2026-10-05'
const raceDate = (w: number) =>
  new Date(Date.parse(PS) + w * 7 * 864e5).toISOString().slice(0, 10)

/** ⚠️ `goal: 'time_target'` IS LOAD-BEARING. §44: *"for `goal: 'finish'`, only
 *  `block` thresholds apply. The `warn` zone is treated as `ok`."* Two of my
 *  measurement grids reported "no defect" because every row was a finish goal and
 *  the warn band is unreachable there. A fixture that drops this tests nothing. */
function timeGoalMarathon(over: Partial<GeneratorInput> = {}): GeneratorInput {
  return {
    athlete_name: 'X', age: 35, race_name: 'R', primary_metric: 'distance',
    plan_start: PS, race_distance_km: 42.2, race_date: raceDate(12),
    goal: 'time_target', target_time: '3:55:00',
    resting_hr: 52, max_hr: 180,
    current_weekly_km: 38, longest_recent_run_km: 12,
    user_declared_level: 'beginner', recent_quality_training: 'occasional',
    hard_session_relationship: 'neutral', training_age: '6-18mo',
    days_available: 4, days_cannot_train: [], injury_history: [],
    max_weekday_mins: 60, terrain: 'mixed',
    ...over,
  } as unknown as GeneratorInput
}

describe('PREP-ACK-NO-WRITER-01 — the fixture reaches the warn band at all', () => {
  it('§44: a TIME goal at 12 weeks warns, and the same input as a FINISH goal does not', () => {
    const warn = validatePrepTime(timeGoalMarathon(), PS)
    expect(warn.status, 'fixture no longer reaches the §44 warn band').toBe('warn')
    // The asymmetry §44 states in as many words, pinned so a future fixture change
    // cannot silently move this test into the branch where nothing happens.
    expect(validatePrepTime(timeGoalMarathon({ goal: 'finish' }), PS).status).toBe('ok')
  })
})

describe('PREP-ACK-NO-WRITER-01 — the COMPOSED path, engine to resend to plan', () => {
  it('§44: refuses unacknowledged, then GENERATES with the flag the owner names', () => {
    const input = timeGoalMarathon()
    // Step one: the engine refuses.
    let thrown: unknown
    try { generateRulePlan(input, 'trial', PS, undefined, PS) } catch (e) { thrown = e }
    expect(thrown).toBeInstanceOf(PrepTimeError)
    expect((thrown as PrepTimeError).reason).toBe('warn_unacknowledged')

    // Step two: the resend the UI could not previously make, built through ACK_FIELD
    // rather than a hardcoded name.
    const acknowledged = { ...input, [ACK_FIELD.prep]: true } as GeneratorInput
    const plan = generateRulePlan(acknowledged, 'trial', PS, undefined, PS)
    expect(plan.weeks.length).toBeGreaterThan(0)
  })

  it('§52: the TWIN composes too — this is the half that is usually left behind', () => {
    // `acknowledged_days_warning` had no UI writer either, and the route's own
    // comment documented the pattern. Fixing one twin is this repo's most-recorded
    // failure class, so the twin gets an arm.
    const input = timeGoalMarathon({ days_available: 3, race_date: raceDate(20) })
    const days = validateDaysAvailable(input, PS)
    expect(days.status, 'fixture no longer reaches the §52 warn band').toBe('warn')
    let thrown: unknown
    try { generateRulePlan(input, 'trial', PS, undefined, PS) } catch (e) { thrown = e }
    expect(thrown).toBeInstanceOf(DaysAvailableError)
    expect((thrown as DaysAvailableError).reason).toBe('warn_unacknowledged')
    const plan = generateRulePlan(
      { ...input, [ACK_FIELD.days]: true } as GeneratorInput, 'trial', PS, undefined, PS)
    expect(plan.weeks.length).toBeGreaterThan(0)
  })
})

describe('PREP-ACK-NO-WRITER-01 — warnKindOf is the shared predicate', () => {
  it('names the kind from a 422 payload, and refuses everything that is not a warning', () => {
    expect(warnKindOf({ reason: 'warn_unacknowledged', prep: { status: 'warn' } })).toBe('prep')
    expect(warnKindOf({ reason: 'warn_unacknowledged', days: { status: 'warn' } })).toBe('days')
    // ⚠️ THE NEGATIVE ARMS ARE THE POINT. §111, §113 and every `block` tier are not
    // negotiable and must NOT grow a consent button.
    expect(warnKindOf({ reason: 'block', prep: { status: 'block' } })).toBeNull()
    expect(warnKindOf({ reason: 'long_run_readiness' })).toBeNull()
    expect(warnKindOf({ reason: 'warn_unacknowledged' })).toBeNull()  // neither payload
    expect(warnKindOf(null)).toBeNull()
    expect(warnKindOf(undefined)).toBeNull()
  })
})

describe('PREP-ACK-NO-WRITER-01 — the UI actually sends it', () => {
  /**
   * ⚠️ A SOURCE ARM, AND ITS LIMIT IS STATED. `vitest.config.ts` is
   * `environment: 'node'` with no jsdom, so the screen cannot be rendered. This
   * asserts the WIRING exists; it cannot assert the button is reachable. The
   * composed arms above carry the behaviour.
   */
  it('GeneratePlanScreen reads requires_acknowledgment via the owner and resends the flag', () => {
    const src = readFileSync('app/dashboard/GeneratePlanScreen.tsx', 'utf8')
    // The defect was that this screen referenced NONE of this. Anchor on the owner,
    // not on a string that could appear in a comment.
    expect(src).toMatch(/warnKindOf\(/)
    expect(src).toMatch(/ACK_FIELD\[opts\.acknowledge\]/)
    expect(src).toMatch(/onAcknowledge=/)
  })

  it('the ack field names are never hardcoded in the UI', () => {
    for (const f of ['app/dashboard/GeneratePlanScreen.tsx', 'components/shared/RefusalView.tsx']) {
      const code = readFileSync(f, 'utf8')
        .split('\n').filter(l => !l.trim().startsWith('*') && !l.trim().startsWith('//'))
        .join('\n')
      expect(code, `${f} hardcodes an ack field name instead of using ACK_FIELD`)
        .not.toMatch(/['"`]acknowledged_(prep|days)_warning['"`]/)
    }
  })

  it('ACK_LABEL is a CONSENT, not a build — Hutchinson, binding', () => {
    // *"A warn-band runner must not reach a plan in one tap."* A label reading
    // "Build my plan" would make step two indistinguishable from step one.
    for (const label of Object.values(ACK_LABEL)) {
      expect(label.toLowerCase()).toMatch(/^i know/)
    }
  })
})
