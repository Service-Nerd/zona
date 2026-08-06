import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { enrich } from './enrich'
import type { Plan, GeneratorInput } from '@/types/plan'

// GEN-FIX-02 — these tests exist because enrichment silently not running was
// invisible for five days (analysis.md N1). The contract under test is not
// "does the voice look good" — it is "does every failure path report itself".
// ADR-006's silent fallback to the USER is preserved and asserted: on every
// failure the returned plan must be the untouched rule plan.

const RULE_PLAN: Plan = {
  meta: {
    athlete: 'Athlete', handle: '', race_name: 'Target Race', race_date: '2026-11-18',
    race_distance_km: 21.1, charity: '', plan_start: '2026-08-03', quit_date: '',
    resting_hr: 60, max_hr: 180, zone2_ceiling: 144,
    version: '2.0', last_updated: '2026-08-06', notes: 'Standard plan — 21.1km, 2 weeks',
  },
  weeks: [
    {
      n: 1, date: '2026-08-03', label: 'Base — easy start', theme: 'HR discipline.',
      type: 'normal', phase: 'base', weekly_km: 30, long_run_hrs: 1.5,
      sessions: { mon: { type: 'easy', label: 'Easy run', detail: null, distance_km: 8, zone: 'Zone 2' } },
    },
  ],
} as unknown as Plan

const INPUT = {
  race_date: '2026-11-18', race_distance_km: 21.1, goal: 'finish',
  current_weekly_km: 30, longest_recent_run_km: 12, days_available: 3, age: 43,
} as GeneratorInput

function mockAnthropic(bodyText: string, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => ({ content: [{ type: 'text', text: bodyText }] }),
    text: async () => bodyText,
  } as unknown as Response)
}

beforeEach(() => { process.env.ANTHROPIC_API_KEY = 'test-key' })
afterEach(() => { vi.restoreAllMocks(); delete process.env.ANTHROPIC_API_KEY })

describe('enrich — outcome reporting (GEN-FIX-02)', () => {
  it('reports no_api_key without calling the API', async () => {
    delete process.env.ANTHROPIC_API_KEY
    const spy = vi.fn()
    global.fetch = spy as unknown as typeof fetch

    const { plan, outcome } = await enrich(RULE_PLAN, INPUT, 'trial')

    expect(outcome).toEqual({ status: 'failed', reason: 'no_api_key' })
    expect(plan).toBe(RULE_PLAN)
    expect(spy).not.toHaveBeenCalled()
  })

  it('reports api_error on a non-2xx and returns the plan untouched', async () => {
    global.fetch = mockAnthropic('rate limited', false, 429) as unknown as typeof fetch

    const { plan, outcome } = await enrich(RULE_PLAN, INPUT, 'trial')

    expect(outcome.status).toBe('failed')
    if (outcome.status === 'failed') {
      expect(outcome.reason).toBe('api_error')
      expect(outcome.detail).toContain('429')
    }
    expect(plan).toBe(RULE_PLAN)
  })

  it('reports fetch_failed when the transport throws', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNRESET')) as unknown as typeof fetch

    const { plan, outcome } = await enrich(RULE_PLAN, INPUT, 'trial')

    expect(outcome.status).toBe('failed')
    if (outcome.status === 'failed') {
      expect(outcome.reason).toBe('fetch_failed')
      expect(outcome.detail).toContain('ECONNRESET')
    }
    expect(plan).toBe(RULE_PLAN)
  })

  it('reports parse_error when the response is not JSON', async () => {
    global.fetch = mockAnthropic('Sure! Here is your plan:') as unknown as typeof fetch

    const { plan, outcome } = await enrich(RULE_PLAN, INPUT, 'trial')

    expect(outcome.status).toBe('failed')
    if (outcome.status === 'failed') expect(outcome.reason).toBe('parse_error')
    expect(plan).toBe(RULE_PLAN)
  })

  it('reports schema_invalid when JSON parses but fails the schema', async () => {
    global.fetch = mockAnthropic(JSON.stringify({ meta: {}, weeks: 'not-an-array' })) as unknown as typeof fetch

    const { plan, outcome } = await enrich(RULE_PLAN, INPUT, 'trial')

    expect(outcome.status).toBe('failed')
    if (outcome.status === 'failed') expect(outcome.reason).toBe('schema_invalid')
    expect(plan).toBe(RULE_PLAN)
  })

  it('reports applied and merges the enriched copy on success', async () => {
    const payload = JSON.stringify({
      meta: { notes: 'Fourteen weeks. Mostly easy.' },
      weeks: [{ n: 1, label: 'Base — hold the zone', theme: 'Slower than feels right.' }],
    })
    global.fetch = mockAnthropic(payload) as unknown as typeof fetch

    const { plan, outcome } = await enrich(RULE_PLAN, INPUT, 'trial')

    expect(outcome).toEqual({ status: 'applied' })
    expect(plan.weeks[0].label).toBe('Base — hold the zone')
    expect(plan.meta.notes).toBe('Fourteen weeks. Mostly easy.')
    // Original must not be mutated — mergePlan deep-clones.
    expect(RULE_PLAN.weeks[0].label).toBe('Base — easy start')
  })

  it('a successfully enriched plan no longer carries rule-engine labels', async () => {
    // This is the assertion that would have caught N1: User A's saved plan had
    // labels byte-identical to weekLabel() output, which is how we knew the
    // enricher never landed.
    const payload = JSON.stringify({
      meta: { notes: 'n' },
      weeks: [{ n: 1, label: 'Base — hold the zone', theme: 'Different theme.' }],
    })
    global.fetch = mockAnthropic(payload) as unknown as typeof fetch

    const { plan } = await enrich(RULE_PLAN, INPUT, 'trial')

    expect(plan.weeks[0].label).not.toBe(RULE_PLAN.weeks[0].label)
    expect(plan.weeks[0].theme).not.toBe(RULE_PLAN.weeks[0].theme)
  })
})
