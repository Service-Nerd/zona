import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { enrich, buildUserMessage } from './enrich'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { GENERATION_CONFIG } from './generationConfig'
import type { Plan, GeneratorInput, Session } from '@/types/plan'

/**
 * §28 — the stride note is engine-authored PRESCRIPTION, and the enricher must
 * not delete it. Same class of defect as §78 (recalibrationCopyProtected.test.ts),
 * one field over.
 *
 * THE DEFECT, as observed. Live plan `a34d4892` (17-week marathon, generated
 * 2026-09-16, `meta.enrichment: "applied_partial"`). The enrichment layer reverted
 * 12 of 17 weeks to plain rule copy — weeks [3,5,6,7,9,10,11,12,13,14,15,16], every
 * one an `INV-PLAN-STRIDES-PRESENT` error — because the enricher rewrote each easy
 * run's coach_notes and dropped the "4×20s strides at 5K effort, full recovery
 * between." line the engine had placed there.
 *
 * WHY IT HAPPENED:
 *   1. buildUserMessage strips coach_notes before sending the plan to the model,
 *      so the enricher never SAW the stride note it was expected to preserve.
 *   2. mergePlan assigned `session.coach_notes = es.coach_notes` unconditionally —
 *      the enricher's voice-only rewrite replaced prescription wholesale.
 *
 * THE FIX (both layers, because a prompt cannot guarantee "every week"):
 *   - buildUserMessage now surfaces a `strides` field on each carrying session, and
 *     the system prompt instructs the model to keep that exact line.
 *   - preserveStrideNote() in mergePlan re-attaches the engine's stride line if the
 *     rewrite dropped it — the deterministic guarantee, mirroring §78's guard.
 *
 * Board-exempt: restores documented intent (§28's own placed note). No prescription
 * changes — the engine still chooses the day and the text.
 */

// 4 days, marathon, no blocked midweek days → plenty of eligible stride weeks.
const MARATHON_4D: GeneratorInput = {
  race_date: '2027-01-17', race_distance_km: 42.2, goal: 'time_target',
  target_time: '4:00:00', days_available: 4, age: 40,
  current_weekly_km: 40, longest_recent_run_km: 20,
  resting_hr: 50, max_hr: 186, preferred_long_run_day: 'sun',
  fitness_level: 'intermediate', training_age: '2-5yr',
} as GeneratorInput

const PLAN_START = '2026-09-21'

const STRIDE_RE = /strides/i

/** Weeks §28 requires a stride note on: from STRIDES_FIRST_WEEK, non-deload,
 *  non-race, excluding foundation (n <= 0). Mirrors the invariant's own gate. */
function eligibleStrideWeeks(p: Plan): number[] {
  const raceWeekN = Math.max(0, ...p.weeks.map(w => w.n))
  return p.weeks
    .filter(w => w.n >= GENERATION_CONFIG.STRIDES_FIRST_WEEK && w.type !== 'deload' && w.n !== raceWeekN)
    .map(w => w.n)
}

function weekHasStride(p: Plan, n: number): boolean {
  const w = p.weeks.find(x => x.n === n)
  if (!w) return false
  return Object.values(w.sessions).some(
    (s): s is Session => !!s && (s.coach_notes ?? []).some(note => !!note && STRIDE_RE.test(note)),
  )
}

/** The enricher's reply, shaped like the real one: it rewrites every session's
 *  coach_notes with pure voice and NO stride line — exactly what dropped the note
 *  on the live plan. Time trials (type 'hard') are left for §78's guard. */
function enricherDropsStrides(plan: Plan) {
  return JSON.stringify({
    meta: { notes: 'Enriched.' },
    weeks: plan.weeks.map(w => ({
      n: w.n,
      label: `Week ${w.n} — holding the zone`,
      theme: 'Easy stays easy this week.',
      sessions: Object.fromEntries(Object.entries(w.sessions).map(([day]) => [day, {
        coach_notes: [
          'Keep it in {{session_zone}} — comfortable and controlled.',
          'Nothing to prove today.',
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

describe('§28 — stride notes survive enrichment', () => {
  it('the engine places stride notes at all (guards the premise)', () => {
    // If a future change stops placing them, every assertion below silently tests
    // nothing. Fail here instead — the §79-PEAKKM lesson.
    const plan = generateRulePlan(MARATHON_4D, 'paid', PLAN_START)
    const eligible = eligibleStrideWeeks(plan)
    expect(eligible.length, 'no eligible stride weeks — premise broken').toBeGreaterThan(3)
    expect(eligible.every(n => weekHasStride(plan, n)), 'engine left an eligible week without strides').toBe(true)
    expect(validatePlan(plan, MARATHON_4D).map(v => v.code)).not.toContain('INV-PLAN-STRIDES-PRESENT')
  })

  it('buildUserMessage surfaces the stride line to the model (the prompt half of the fix)', () => {
    const plan = generateRulePlan(MARATHON_4D, 'paid', PLAN_START)
    const msg = buildUserMessage(plan, MARATHON_4D, true)
    expect(msg).toMatch(/"strides":/)
    expect(msg).toMatch(/4×20s strides at 5K effort/)
  })

  it('an enricher that drops every stride line does NOT cost any week its strides', async () => {
    const rulePlan = generateRulePlan(MARATHON_4D, 'paid', PLAN_START)
    const eligible = eligibleStrideWeeks(rulePlan)

    global.fetch = mockAnthropic(enricherDropsStrides(rulePlan)) as unknown as typeof fetch
    const { plan, outcome } = await enrich(rulePlan, MARATHON_4D, 'paid')

    // The enricher must have RUN — a test that passes because enrichment failed
    // proves nothing about protection.
    expect(outcome.status, 'enrichment did not apply — this test would pass vacuously').toBe('applied')

    for (const n of eligible) {
      expect(weekHasStride(plan, n), `week ${n} lost its strides to enrichment`).toBe(true)
    }
    expect(validatePlan(plan, MARATHON_4D).map(v => v.code)).not.toContain('INV-PLAN-STRIDES-PRESENT')
  })

  it('the voice is still applied — the protection is a scalpel, not a block', async () => {
    const rulePlan = generateRulePlan(MARATHON_4D, 'paid', PLAN_START)
    global.fetch = mockAnthropic(enricherDropsStrides(rulePlan)) as unknown as typeof fetch
    const { plan, outcome } = await enrich(rulePlan, MARATHON_4D, 'paid')
    expect(outcome.status).toBe('applied')

    // Labels were rewritten, and the stride-carrying easy runs kept their new
    // voice note ALONGSIDE the restored stride line (not just the stride).
    expect(plan.weeks.some(w => /holding the zone/i.test(w.label ?? ''))).toBe(true)
    const strideSessions = plan.weeks.flatMap(w => Object.values(w.sessions))
      .filter((s): s is Session => !!s && (s.coach_notes ?? []).some(n => !!n && STRIDE_RE.test(n)))
    expect(strideSessions.length).toBeGreaterThan(0)
    expect(
      strideSessions.some(s => (s.coach_notes ?? []).some(n => !!n && /comfortable and controlled/i.test(n))),
      'stride sessions lost all their enriched voice — the guard is too wide',
    ).toBe(true)
    // Cap respected — never more than 3 notes.
    expect(strideSessions.every(s => (s.coach_notes ?? []).length <= 3)).toBe(true)
  })

  it('INV-PLAN-STRIDES-PRESENT fires when a stride line is stripped (the net under the fix)', () => {
    // FALSIFICATION. Prove the backstop invariant still catches a missing stride,
    // so a future regression cannot pass silently.
    const plan = generateRulePlan(MARATHON_4D, 'paid', PLAN_START)
    const n = eligibleStrideWeeks(plan)[0]
    const broken: Plan = JSON.parse(JSON.stringify(plan))
    const w = broken.weeks.find(x => x.n === n)!
    for (const s of Object.values(w.sessions)) {
      if (s?.coach_notes) {
        s.coach_notes = s.coach_notes.filter((note): note is string => !!note && !STRIDE_RE.test(note)) as Session['coach_notes']
      }
    }
    const codes = validatePlan(broken, MARATHON_4D).filter(v => v.code === 'INV-PLAN-STRIDES-PRESENT')
    expect(codes.length).toBeGreaterThan(0)
    expect(codes[0].severity).toBe('error')
  })
})
