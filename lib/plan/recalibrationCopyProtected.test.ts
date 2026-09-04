import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { enrich } from './enrich'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import type { Plan, GeneratorInput, Session } from '@/types/plan'

/**
 * §78 — the recalibration time trial's copy is INSTRUCTION, not voice, and the
 * enricher must not replace it.
 *
 * THE DEFECT, as observed. Live plan `bcdec27a` (generated 2026-09-03,
 * `meta.enrichment: "applied"`, `meta.recalibration_weeks: [8]`). The engine
 * wrote:
 *
 *   "Warm up easy for 10 minutes, then 5 km as hard as you can hold. Cool down easy."
 *   "This is a measurement, not a session. Log the result in your profile and
 *    your paces update for the next block."
 *   "A parkrun counts. So does a solo effort — just make it honest."
 *
 * What reached the runner:
 *
 *   "Hard session: {{session_zone}}, {{session_distance}} km. This is pace work,
 *    not endurance."
 *   "Short and fast sharpens you. You've earned this shift."
 *
 * Fluent, on-voice, states the OPPOSITE of §78 ("a measurement, not a session"),
 * and deletes the one instruction the whole recalibration path depends on —
 * nothing recalibrates unless the runner logs a result (ADR-014). Meanwhile
 * `meta.recalibration_weeks` went on claiming the week recalibrated.
 *
 * WHY IT SURVIVED — two compounding causes, and the second is the transferable
 * one:
 *   1. `applyEnrichment` assigned `coach_notes` unconditionally, for every
 *      session, with no protected set.
 *   2. `validatePlan` DOES run post-enrichment (PV2-A), but the only copy
 *      invariant that could catch this opened with `if (session.type !== 'quality')
 *      continue` — and the trial is typed `hard`. **The `hard` typing chosen in
 *      §78 so the trial would not count against QUALITY_SESSIONS_PER_WEEK_MAX
 *      also exempted it from every quality-scoped copy check.** A type chosen to
 *      opt out of one rule opted it out of an unrelated one.
 *
 * Board-exempt: restores documented intent (§78's own authored copy). No
 * prescription changes.
 */

const TENK_WITH_BENCHMARK: GeneratorInput = {
  race_date: '2026-11-30', race_distance_km: 10, goal: 'time_target',
  target_time: '0:44:59', days_available: 4, age: 43,
  current_weekly_km: 40, longest_recent_run_km: 18,
  resting_hr: 48, max_hr: 188, preferred_long_run_day: 'sun',
  benchmark: { type: 'race', distance_km: 10, time: '0:48:30' },
  fitness_level: 'experienced', training_age: '2-5yr',
} as GeneratorInput

const PLAN_START = '2026-09-07'

const timeTrials = (p: Plan): Session[] =>
  p.weeks.flatMap(w => Object.values(w.sessions).filter((s): s is Session => s?.type === 'hard'))

/** The enricher's reply, shaped like the real one, rewriting every session it is
 *  given — which is exactly what the live enricher did. */
function enricherRewritesEverything(plan: Plan) {
  return JSON.stringify({
    meta: { notes: 'Enriched.' },
    weeks: plan.weeks.map(w => ({
      n: w.n,
      label: w.label,
      theme: w.theme,
      sessions: Object.fromEntries(Object.entries(w.sessions).map(([day]) => [day, {
        label: 'Speed intervals',
        coach_notes: [
          'Hard session: {{session_zone}}, {{session_distance}} km. This is pace work, not endurance.',
          "Short and fast sharpens you. You've earned this shift.",
        ],
      }])),
    })),
  })
}

function mockAnthropic(bodyText: string) {
  return vi.fn().mockResolvedValue({
    ok: true, status: 200,
    json: async () => ({ content: [{ type: 'text', text: bodyText }] }),
    text: async () => bodyText,
  } as unknown as Response)
}

beforeEach(() => { process.env.ANTHROPIC_API_KEY = 'test-key' })
afterEach(() => { vi.restoreAllMocks(); delete process.env.ANTHROPIC_API_KEY })

describe('§78 — the recalibration time trial survives enrichment', () => {
  it('the engine puts a time trial in the plan at all (guards the premise)', () => {
    // If a future change stops placing one, every assertion below silently tests
    // nothing. Fail here instead — the §79-PEAKKM lesson.
    const plan = generateRulePlan(TENK_WITH_BENCHMARK, 'paid', PLAN_START)
    const tts = timeTrials(plan)
    expect(tts.length, 'no `hard` session — the benchmark path did not place a time trial').toBeGreaterThan(0)
    expect(plan.meta.recalibration_weeks?.length ?? 0).toBeGreaterThan(0)
    expect(tts[0].coach_notes?.join(' ')).toMatch(/measurement/i)
    expect(tts[0].coach_notes?.join(' ')).toMatch(/log the result/i)
  })

  it('enrichment does NOT overwrite its notes or its label', async () => {
    const rulePlan = generateRulePlan(TENK_WITH_BENCHMARK, 'paid', PLAN_START)
    const before = timeTrials(rulePlan)[0]
    const originalNotes = [...(before.coach_notes ?? [])]
    const originalLabel = before.label

    global.fetch = mockAnthropic(enricherRewritesEverything(rulePlan)) as unknown as typeof fetch
    const { plan, outcome } = await enrich(rulePlan, TENK_WITH_BENCHMARK, 'paid')

    // The enricher must have RUN — a test that passes because enrichment failed
    // proves nothing about protection.
    expect(outcome.status, 'enrichment did not apply — this test would pass vacuously').toBe('applied')

    const after = timeTrials(plan)[0]
    expect(after.coach_notes).toEqual(originalNotes)
    expect(after.label).toBe(originalLabel)
    expect(after.coach_notes?.join(' ')).not.toMatch(/pace work, not endurance/i)
  })

  it('every OTHER session is still enriched — the protection is a scalpel, not a block', async () => {
    const rulePlan = generateRulePlan(TENK_WITH_BENCHMARK, 'paid', PLAN_START)
    global.fetch = mockAnthropic(enricherRewritesEverything(rulePlan)) as unknown as typeof fetch
    const { plan, outcome } = await enrich(rulePlan, TENK_WITH_BENCHMARK, 'paid')
    expect(outcome.status).toBe('applied')

    const rewritten = plan.weeks.flatMap(w => Object.values(w.sessions))
      .filter((s): s is Session => !!s && s.type !== 'hard')
      .filter(s => s.label === 'Speed intervals')
    expect(rewritten.length, 'nothing was enriched — the guard is too wide').toBeGreaterThan(0)
  })

  it('INV-PLAN-COACH-NOTES-MATCH-INTENT fires when the instruction copy is lost', () => {
    // FALSIFICATION. Recreate the shipped defect on a real plan and prove the
    // backstop catches it — the guard above is the fix, this is the net under it.
    const plan = generateRulePlan(TENK_WITH_BENCHMARK, 'paid', PLAN_START)
    expect(validatePlan(plan, TENK_WITH_BENCHMARK).map(v => v.code))
      .not.toContain('INV-PLAN-COACH-NOTES-MATCH-INTENT')

    const broken: Plan = JSON.parse(JSON.stringify(plan))
    timeTrials(broken)[0].coach_notes = [
      'Hard session: {{session_zone}}, {{session_distance}} km. This is pace work, not endurance.',
      "Short and fast sharpens you. You've earned this shift.",
    ]
    const v = validatePlan(broken, TENK_WITH_BENCHMARK)
      .filter(x => x.code === 'INV-PLAN-COACH-NOTES-MATCH-INTENT')
    expect(v.length).toBeGreaterThan(0)
    expect(v[0].severity).toBe('error')
    expect(v[0].message).toMatch(/recalibrat/i)
  })

  it('the backstop requires the instruction, not a specific sentence', () => {
    // It must not become a copy-freeze: a legitimate rewording that still SAYS
    // the thing has to pass, or the next author works around the check.
    const plan = generateRulePlan(TENK_WITH_BENCHMARK, 'paid', PLAN_START)
    const reworded: Plan = JSON.parse(JSON.stringify(plan))
    timeTrials(reworded)[0].coach_notes = [
      'Run it hard. This is a measurement, not a training session.',
      'Log the result so next block uses your real paces.',
    ]
    expect(validatePlan(reworded, TENK_WITH_BENCHMARK).map(v => v.code))
      .not.toContain('INV-PLAN-COACH-NOTES-MATCH-INTENT')
  })
})
