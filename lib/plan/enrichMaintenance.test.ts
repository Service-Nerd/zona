import { describe, it, expect, vi, afterEach } from 'vitest'
import { enrichMaintenanceBlock } from './enrichMaintenance'
import type { Week, RaceResult } from '@/types/plan'

// ── Fixtures ────────────────────────────────────────────────────────────────
const MAINT_WEEKS: Week[] = [
  {
    n: 13,
    date: '2026-07-19',
    label: 'Maintenance 1',
    theme: 'Restore. Nothing more.',
    type: 'normal',
    phase: 'maintenance_restoration',
    weekly_km: 18,
    long_run_hrs: null,
    sessions: {
      mon: { type: 'easy', label: 'Easy run', detail: null, distance_km: 6, zone: 'Zone 2', coach_notes: ['Zone 2 only.'] },
      wed: { type: 'easy', label: 'Easy run', detail: null, distance_km: 6, zone: 'Zone 2', coach_notes: ['Zone 2 only.'] },
      tue: { type: 'rest', label: 'Rest', detail: 'Rest day.' },
    },
  },
  {
    n: 14,
    date: '2026-07-26',
    label: 'Maintenance 2',
    theme: 'Back to base.',
    type: 'normal',
    phase: 'maintenance_base',
    weekly_km: 24,
    long_run_hrs: null,
    sessions: {
      sat: { type: 'easy', label: 'Long easy', detail: null, distance_km: 10, zone: 'Zone 2', coach_notes: ['Zone 2 only.'] },
    },
  },
]

const RESULT: RaceResult = { finish_time: '3:45:00', distance_km: 42.2, rpe: 7, outcome: 'on_target' }
const CTX = { raceResult: RESULT, raceName: 'Test Marathon', raceDistanceKm: 42.2 }

function mockAnthropic(bodyText: string, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json:  async () => ({ content: [{ type: 'text', text: bodyText }] }),
    text:  async () => bodyText,
  } as unknown as Response)
}

afterEach(() => { vi.restoreAllMocks() })

describe('enrichMaintenanceBlock', () => {
  it('no-ops (returns input) when no API key is provided', async () => {
    const spy = vi.fn()
    global.fetch = spy as unknown as typeof fetch
    const out = await enrichMaintenanceBlock(MAINT_WEEKS, CTX, undefined)
    expect(out).toBe(MAINT_WEEKS)
    expect(spy).not.toHaveBeenCalled()
  })

  it('no-ops on empty weeks without calling the API', async () => {
    const spy = vi.fn()
    global.fetch = spy as unknown as typeof fetch
    const out = await enrichMaintenanceBlock([], CTX, 'key')
    expect(out).toEqual([])
    expect(spy).not.toHaveBeenCalled()
  })

  it('merges coach_debrief and session coach_notes on a valid response', async () => {
    const payload = JSON.stringify({
      weeks: [
        { n: 13, coach_debrief: 'The body is still accounting.', sessions: { mon: { coach_notes: ['Keep it under {{zone2_ceiling}} bpm.'] } } },
        { n: 14, coach_debrief: 'Back to base. Nothing to prove.' },
      ],
    })
    global.fetch = mockAnthropic(payload) as unknown as typeof fetch

    const out = await enrichMaintenanceBlock(MAINT_WEEKS, CTX, 'key')
    expect(out[0].coach_debrief).toBe('The body is still accounting.')
    expect(out[0].sessions.mon?.coach_notes).toEqual(['Keep it under {{zone2_ceiling}} bpm.'])
    expect(out[1].coach_debrief).toBe('Back to base. Nothing to prove.')
    // untouched session keeps its rule-engine note
    expect(out[0].sessions.wed?.coach_notes).toEqual(['Zone 2 only.'])
  })

  it('never mutates the input weeks', async () => {
    const payload = JSON.stringify({ weeks: [{ n: 13, coach_debrief: 'x' }] })
    global.fetch = mockAnthropic(payload) as unknown as typeof fetch
    await enrichMaintenanceBlock(MAINT_WEEKS, CTX, 'key')
    expect(MAINT_WEEKS[0].coach_debrief).toBeUndefined()
  })

  it('ignores enrichment for an unknown week n', async () => {
    const payload = JSON.stringify({ weeks: [{ n: 999, coach_debrief: 'ghost' }] })
    global.fetch = mockAnthropic(payload) as unknown as typeof fetch
    const out = await enrichMaintenanceBlock(MAINT_WEEKS, CTX, 'key')
    expect(out[0].coach_debrief).toBeUndefined()
    expect(out[1].coach_debrief).toBeUndefined()
  })

  it('returns weeks unchanged on a non-ok API response', async () => {
    global.fetch = mockAnthropic('error', false, 500) as unknown as typeof fetch
    const out = await enrichMaintenanceBlock(MAINT_WEEKS, CTX, 'key')
    expect(out[0].coach_debrief).toBeUndefined()
  })

  it('returns weeks unchanged on unparseable JSON', async () => {
    global.fetch = mockAnthropic('not json at all') as unknown as typeof fetch
    const out = await enrichMaintenanceBlock(MAINT_WEEKS, CTX, 'key')
    expect(out[0].coach_debrief).toBeUndefined()
  })

  it('returns weeks unchanged on a schema mismatch', async () => {
    const payload = JSON.stringify({ weeks: 'wrong-shape' })
    global.fetch = mockAnthropic(payload) as unknown as typeof fetch
    const out = await enrichMaintenanceBlock(MAINT_WEEKS, CTX, 'key')
    expect(out[0].coach_debrief).toBeUndefined()
  })

  it('strips accidental markdown fences before parsing', async () => {
    const payload = '```json\n' + JSON.stringify({ weeks: [{ n: 13, coach_debrief: 'fenced' }] }) + '\n```'
    global.fetch = mockAnthropic(payload) as unknown as typeof fetch
    const out = await enrichMaintenanceBlock(MAINT_WEEKS, CTX, 'key')
    expect(out[0].coach_debrief).toBe('fenced')
  })
})
