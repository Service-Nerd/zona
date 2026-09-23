// UNITS-PROSE-01 phase 2 — the AI layer is a DISPLAY SURFACE (ADR-015 amendment).
//
// A number handed to the model becomes user-facing the moment the model repeats
// it. `promptDistanceFormatters` is the single owner that keeps a prompt figure
// matching the card; **ten prompt builders already called it and these three
// never did**, handing the model a raw km value with the unit hardcoded.
//
// 🔴 THE WIRING WAS INERT UNTIL THE COMPILER WAS MADE TO ASK. `enrich()` took a
// `units` argument and then called `buildUserMessage(plan, input, wantPaidFields)`
// **without it** — a parameter accepted, threaded through a route, and read by
// nothing. It only surfaced because `units` was made REQUIRED rather than
// defaulted to `'km'`. Same class as `LoadShape`'s `ariaLabel`: declared,
// destructured by nobody, passed by nobody.
//
// ⚠️ WHY REQUIRED AND NOT DEFAULTED: the dangerous default is `km`. A miles
// runner silently prompted in kilometres is the exact defect, and it leaves no
// trace. `decideTrialEmails` takes its access argument for the same reason.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildUserMessage, enrich } from './enrich'
import type { Plan, GeneratorInput } from '@/types/plan'

const input = {
  race_distance_km: 42.195,
  current_weekly_km: 50,
  days_available: 4,
  fitness_level: 'intermediate',
  goal: 'time',
} as unknown as GeneratorInput

const plan = {
  meta: { race_name: 'Autumn Marathon', race_date: '2026-11-01', race_distance_km: 42.195 },
  weeks: [{ n: 1, phase: 'base', weekly_km: 50, sessions: {} }],
} as unknown as Plan

describe('UNITS-PROSE-01 — the enrichment prompt speaks the reader’s units', () => {
  it('quotes the race distance in MILES for a miles reader', () => {
    const mi = buildUserMessage(plan, input, true, 'mi')
    expect(mi).toContain('26.2mi')
    // …and does not also hand the model the kilometre figure to echo.
    expect(mi).not.toContain('42.195 km')
  })

  it('quotes weekly volume in MILES for a miles reader', () => {
    expect(buildUserMessage(plan, input, true, 'mi')).toContain('31mi/week')
  })

  it('a km reader now matches the CARD, where before it got raw precision', () => {
    // ⚠️ THE KM PATH CHANGED TOO, AND THAT IS THE POINT. It used to hand the
    // model `42.195 km` while the wizard card renders
    // `formatDistance(race_distance_km, units, { exact: true })` = `42.2km`.
    // Prompt and card disagreeing on a prescribed distance is precisely
    // BUG-KIT-DECIMALS-01, which measured the disagreement at 50.4%.
    const km = buildUserMessage(plan, input, true, 'km')
    expect(km).toContain('42.2km')
    expect(km).toContain('50km/week')
    expect(km, 'raw precision leaked to the model').not.toContain('42.195')
  })

  it('🔴 the two units genuinely differ — the argument is not inert', () => {
    // The assertion that would have caught the dead `buildUserMessage` call.
    // Identical output for both units means `units` is being accepted and
    // ignored, which is exactly the state this shipped in until the compiler
    // was made to ask every call site.
    expect(buildUserMessage(plan, input, true, 'mi'))
      .not.toBe(buildUserMessage(plan, input, true, 'km'))
  })

  it('matches the CARD, not a second rounding rule', () => {
    // ADR-015's amendment (BUG-KIT-DECIMALS-01): prompt and card disagreed on
    // 50.4% of prescribed distances. `fmtRace` and `fmtPlanned` delegate to
    // `formatDistance`, so this asserts against the producer, never a copy.
    const mi = buildUserMessage(plan, input, true, 'mi')
    expect(mi).not.toMatch(/26\.21|26\.219/)   // no raw-precision leak
    expect(mi).not.toMatch(/31\.0687|31\.07/)
  })
})

// ── THE WIRING, NOT JUST THE FUNCTION ────────────────────────────────────────
//
// 🔴 THE BLOCK ABOVE CANNOT SEE THE BUG THIS SHIPPED WITH, AND FALSIFYING PROVED
// IT. Re-creating the original defect — `enrich()` accepting `units` and calling
// `buildUserMessage(plan, input, wantPaidFields, 'km')` — left every assertion
// above GREEN, because they all call `buildUserMessage` directly and never go
// through `enrich`. A gate on a function is not a gate on its caller.
//
// This reads the body actually POSTed to the model.
describe('UNITS-PROSE-01 — enrich() passes the units it was given', () => {
  beforeEach(() => { process.env.ANTHROPIC_API_KEY = 'test-key' })
  afterEach(() => { vi.restoreAllMocks(); delete process.env.ANTHROPIC_API_KEY })

  async function promptSentBy(units: 'km' | 'mi'): Promise<string> {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ content: [{ type: 'text', text: '{"meta":{},"weeks":[]}' }] }),
      text: async () => '{"meta":{},"weeks":[]}',
    } as unknown as Response)
    global.fetch = fetchMock as unknown as typeof fetch
    await enrich(plan, input, 'paid', null, units)
    expect(fetchMock, 'enrich() never called the model — the assertion below would be vacuous').toHaveBeenCalled()
    return JSON.stringify(fetchMock.mock.calls[0]?.[1] ?? {})
  }

  it('🔴 a miles reader’s prompt reaches the model in MILES', async () => {
    const body = await promptSentBy('mi')
    expect(body, 'the prompt POSTed to the model still names kilometres').toContain('26.2mi')
    expect(body).not.toContain('42.195')
  })

  it('a km reader’s prompt reaches the model in kilometres', async () => {
    expect(await promptSentBy('km')).toContain('42.2km')
  })
})
