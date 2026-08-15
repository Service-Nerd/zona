import { describe, it, expect } from 'vitest'
import { formatPace, formatPaceDelta, formatDistanceForPrompt, formatDistance } from '@/lib/format'
import { buildSessionFeedbackPrompt } from '@/lib/coaching/prompts/sessionFeedback'
import type { Plan, Session } from '@/types/plan'

/**
 * FMT-01 — units propagation into AI coaching prose.
 *
 * Two guarantees, in tension, both mechanical:
 *   1. A km reader's prompt is byte-identical to pre-FMT-01. `units` defaults to
 *      'km' at every builder, so no existing behaviour (or reframe golden case)
 *      moves.
 *   2. A mi reader gets converted numbers AND converted unit labels. Before this,
 *      prompts said "10km" and "5:30/km" to everyone.
 */

describe('formatPace — single owner (was 5 copies, all km-only)', () => {
  it('formats km pace', () => {
    expect(formatPace(330, 'km')).toBe('5:30/km')
  })

  it('converts the RATE for miles, not just the label', () => {
    // 5:30/km is ~8:51/mi. The old copies would have printed "5:30/mi".
    expect(formatPace(330, 'mi')).toBe('8:51/mi')
  })

  it('defaults to km when units are not supplied', () => {
    expect(formatPace(330)).toBe(formatPace(330, 'km'))
  })

  it('carries a 60s rounding artefact into the minute', () => {
    // 359.7s/km rounds to 60s — must read 6:00, never 5:60.
    expect(formatPace(359.7, 'km')).toBe('6:00/km')
  })

  it('returns null on missing or nonsense input rather than "NaN:NaN"', () => {
    expect(formatPace(null)).toBeNull()
    expect(formatPace(0)).toBeNull()
    expect(formatPace(Number.NaN)).toBeNull()
  })
})

describe('formatPaceDelta — thresholds restated, not relabelled', () => {
  it('converts a fade threshold', () => {
    expect(formatPaceDelta(15, 'km')).toBe('15s/km')
    expect(formatPaceDelta(15, 'mi')).toBe('24s/mi')
  })

  it('handles a negative delta (negative split)', () => {
    expect(formatPaceDelta(-10, 'km')).toBe('-10s/km')
  })
})

describe('formatDistanceForPrompt — converts units, keeps precision', () => {
  it('does NOT adopt the UI rounding', () => {
    // The whole point: formatDistance rounds for calm UI, prompts must not.
    // A model told "6km" for a 5.7km session narrates a shortfall the engine
    // (planAdjustment.ts, §66) does not recognise.
    expect(formatDistance(5.7, 'km')).toBe('6km')
    expect(formatDistanceForPrompt(5.7, 'km')).toBe('5.7km')
  })

  it('converts for miles', () => {
    expect(formatDistanceForPrompt(10, 'mi')).toBe('6.2mi')
  })

  it('honours the caller precision so km output is unchanged', () => {
    expect(formatDistanceForPrompt(42.195, 'km', 0)).toBe('42km')
    expect(formatDistanceForPrompt(42.195, 'km', 1)).toBe('42.2km')
  })
})

// ── End-to-end through a real builder ────────────────────────────────────────

const session = { type: 'easy', distance_km: 10, duration_mins: 60 } as unknown as Session
const plan = {
  meta: { race_name: 'Test Half', race_distance_km: 21.1, race_date: null },
  weeks: [{ n: 1, sessions: {} }],
} as unknown as Plan

function build(units?: 'km' | 'mi') {
  return buildSessionFeedbackPrompt({
    session, weekN: 1, plan, verdict: 'nailed' as never,
    actualDistKm: 10, actualAvgHr: 145, actualPaceSecPerKm: 330,
    hrInZonePct: 90, hrAboveCeilingPct: 5, efTrendPct: null,
    rpe: 4, fatigueTag: null, ...(units ? { units } : {}),
  })
}

describe('sessionFeedback prompt — units propagation', () => {
  it('km output is byte-identical whether units are omitted or explicit', () => {
    // This is the zero-regression guarantee the rollout depends on.
    expect(build()).toBe(build('km'))
  })

  it('a km prompt states distances in km', () => {
    const p = build('km')
    expect(p).toContain('10.0km')
    expect(p).toContain('5:30/km')
  })

  it('a mi prompt converts distance and pace, and never says km', () => {
    const p = build('mi')
    expect(p).toContain('6.2mi')
    expect(p).toContain('8:51/mi')
    // The data section must not leak km to a miles reader.
    const dataSection = p.slice(p.indexOf('Now write feedback'))
    expect(dataSection).not.toMatch(/\dkm/)
  })

  it('a mi prompt carries the explicit output-unit override', () => {
    // The few-shot examples stay in km (they teach voice, not units) and their
    // outputs quote km — without this instruction the model copies the examples'
    // unit instead of the data's.
    expect(build('mi')).toContain('This athlete reads in MILES')
    expect(build('km')).not.toContain('This athlete reads in MILES')
  })

  it('restates the pace-fade threshold rather than relabelling it', () => {
    // 15s/km is a coaching numeric (LIMITER.PACE_FADE_REFERENCE_SEC). Expressing
    // it per-mile is arithmetic; leaving it as "15s/km" next to /mi data would
    // have the model compare two different rates.
    const mi = build('mi')
    if (mi.includes('Pace-fade rule')) expect(mi).toContain('24s/mi')
  })
})
