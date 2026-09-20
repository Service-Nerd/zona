import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateFreeIntro } from './freeIntro'
import { generateRulePlan } from './ruleEngine'
import type { GeneratorInput } from '@/types/plan'

// CA-01 had no direct test despite a production caller (`/api/generate-plan`).
//
// ⚠️ THE CONTRACT UNDER TEST IS THE SILENCE, NOT THE SENTENCE. ADR-006: the
// rule-engine plan always stands alone and an AI failure must be invisible. So
// every failure mode has to return null rather than throw — a throw here would
// take down plan generation itself for a free runner, which is the one cohort
// this feature exists to reach. The happy path is the least interesting case.

const INPUT = {
  athlete_name: 'Sam Rivera', age: 34, race_name: 'T', primary_metric: 'distance',
  race_distance_km: 21.1, race_date: '2027-04-18', plan_start: '2026-11-02',
  goal: 'finish', fitness_level: 'intermediate', training_age: '2-5yr',
  resting_hr: 55, max_hr: 186, current_weekly_km: 35, longest_recent_run_km: 16,
  days_available: 4, injury_history: [], hard_session_relationship: 'neutral',
  recent_quality_training: 'occasional',
} as unknown as GeneratorInput

const PLAN = generateRulePlan(INPUT, 'free')
const reply = (text: string) => ({ ok: true, json: async () => ({ content: [{ text }] }) })

describe('generateFreeIntro — failure is silent (ADR-006)', () => {
  const KEY = process.env.ANTHROPIC_API_KEY
  beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}) })
  afterEach(() => { vi.restoreAllMocks(); process.env.ANTHROPIC_API_KEY = KEY })

  it('1. no API key — returns null without calling out', async () => {
    delete process.env.ANTHROPIC_API_KEY
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    expect(await generateFreeIntro(PLAN, INPUT)).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it.each([
    ['a non-ok response', () => Promise.resolve({ ok: false, status: 500, text: async () => 'boom' })],
    ['a thrown transport error', () => Promise.reject(new Error('ECONNRESET'))],
    ['a malformed body', () => Promise.resolve({ ok: true, json: async () => ({}) })],
    ['an empty completion', () => Promise.resolve(reply('   '))],
  ])('2. %s returns null and never throws', async (_label, impl) => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    vi.spyOn(globalThis, 'fetch').mockImplementation(impl as never)
    await expect(generateFreeIntro(PLAN, INPUT)).resolves.toBeNull()
  })

  it('3. strips code fences and wrapping quotes the model adds', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    vi.spyOn(globalThis, 'fetch').mockImplementation((() =>
      Promise.resolve(reply('```\n"Eighteen weeks of holding easy days easy."\n```'))) as never)
    expect(await generateFreeIntro(PLAN, INPUT)).toBe('Eighteen weeks of holding easy days easy.')
  })

  it('4. curly quotes are stripped too — the model prefers them', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    vi.spyOn(globalThis, 'fetch').mockImplementation((() =>
      Promise.resolve(reply('“The work is the long run.”'))) as never)
    expect(await generateFreeIntro(PLAN, INPUT)).toBe('The work is the long run.')
  })

  // ⚠️ AMENDED 2026-09-20 (ENRICH-PII-MINIMISE-01). This used to assert the
  // prompt carried the FIRST name and not the surname — the protection at the
  // time. The protection is now stronger: NO part of the name reaches the model
  // at all. The test asserts the new property, and would fail if the name came
  // back.
  it('5. the prompt carries real plan facts and NO part of the runner\'s name', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    let body: Record<string, unknown> = {}
    vi.spyOn(globalThis, 'fetch').mockImplementation(((_u: string, init: { body: string }) => {
      body = JSON.parse(init.body)
      return Promise.resolve(reply('ok'))
    }) as never)
    await generateFreeIntro(PLAN, INPUT)
    const sent = JSON.stringify(body)
    expect(sent).toContain(`${PLAN.weeks.length} weeks`)
    expect(sent).toContain('half marathon')
    // The model is told to write a token; the name is substituted server-side.
    expect(sent).toContain('{{RUNNER}}')
    expect(sent).not.toContain('Sam')
    expect(sent).not.toContain('Rivera')
  })
})
