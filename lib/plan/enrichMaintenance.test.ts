import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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
const CTX = { raceResult: RESULT, raceName: 'Test Marathon', raceDistanceKm: 42.2, units: 'km' as const }

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

/**
 * MAINT-ENRICH-VALIDATE-01 (2026-11-08) — THE ONE PLAN KIND WITH NO PLACEHOLDER CHECK.
 *
 * 🔴 THE ITEM NAMED THE WRONG MECHANISM, and measuring it is what caught that. It was filed
 * as "maintenance enrichment has no copy-repair step, unlike the race-plan path
 * (`repairEnrichedCopy`)". Building that ladder here would have been INERT BY CONSTRUCTION:
 * `validateMaintenanceBlock` reads `s.type`, `s.category`, `s.label`, `w.weekly_km`,
 * `w.phase`, `w.reengagement` and `w.n` — not one copy field — while this enricher writes
 * only `coach_debrief` and `coach_notes`. The sets do not intersect, so the ladder would
 * have returned `clean` for every maintenance plan, forever, and the item would have closed.
 *
 * ⚠️ THREE LAYERS WERE BLIND TO THE SAME FIELD:
 *   · the prompt forbids it ("Use ONLY this exact token, only in coach_notes") and a rule
 *     stated only in a prompt is a request — this repo's third recording of that;
 *   · this merge had no check;
 *   · a maintenance plan NEVER RUNS `validatePlan`, so `INV-PLAN-NO-PLACEHOLDER-COPY` — whose
 *     own `expected` reads "only session.coach_notes may carry a token", a claim about every
 *     user-facing field — could not reach it. Dispatching away from the race constitution
 *     (AUDIT-MAINTENANCE-KIND-01, correctly) dispatched away from its copy check too.
 *
 * `TodayScreen.tsx:1764` renders `{maintDebrief}` RAW, no prose owner, so this is literal
 * braces on a paid post-race runner's Today screen rather than a gap in a sentence.
 *
 * 📐 LATENT: 0 maintenance plans in production, 1 in `plan_archive` (2026-09-17) with 0 of
 * its copy fields carrying a token. Stated, because a fix at the boundary reaches 100% of the
 * future population and strands nobody.
 */
describe('MAINT-ENRICH-VALIDATE-01 — coach_debrief is token-checked at the boundary', () => {
  it('a clean debrief is accepted, so this is a guard and not a wall', async () => {
    // The vacuity arm: without it, "refuse every debrief" passes every arm below.
    const payload = JSON.stringify({ weeks: [{ n: 13, coach_debrief: 'The body is still accounting.' }] })
    global.fetch = mockAnthropic(payload) as unknown as typeof fetch
    const out = await enrichMaintenanceBlock(MAINT_WEEKS, CTX, 'key')
    expect(out[0].coach_debrief).toBe('The body is still accounting.')
  })

  it('🔴 a debrief carrying the token the prompt asks for in coach_notes is REFUSED', async () => {
    // `{{zone2_ceiling}}` is the one token the prompt names, and the one place it is allowed
    // is a session note. In a debrief it renders as braces.
    const payload = JSON.stringify({
      weeks: [{ n: 13, coach_debrief: 'Hold everything under {{zone2_ceiling}} bpm this week.' }],
    })
    global.fetch = mockAnthropic(payload) as unknown as typeof fetch
    const out = await enrichMaintenanceBlock(MAINT_WEEKS, CTX, 'key')
    expect(out[0].coach_debrief, 'the week keeps the debrief it had — none').toBeUndefined()
  })

  it('a refused debrief does not cost the week its session notes', async () => {
    const payload = JSON.stringify({
      weeks: [{
        n: 13,
        coach_debrief: 'Still {{session_zone}} only.',
        sessions: { mon: { coach_notes: ['Keep it under {{zone2_ceiling}} bpm.'] } },
      }],
    })
    global.fetch = mockAnthropic(payload) as unknown as typeof fetch
    const out = await enrichMaintenanceBlock(MAINT_WEEKS, CTX, 'key')
    expect(out[0].coach_debrief).toBeUndefined()
    // THE CARRIER. Exempt by design, exactly as INV-PLAN-NO-PLACEHOLDER-COPY exempts it.
    expect(out[0].sessions.mon?.coach_notes).toEqual(['Keep it under {{zone2_ceiling}} bpm.'])
  })

  it('one bad week does not refuse the other weeks', async () => {
    const payload = JSON.stringify({
      weeks: [
        { n: 13, coach_debrief: 'Under {{zone2_ceiling}}.' },
        { n: 14, coach_debrief: 'Back to base. Nothing to prove.' },
      ],
    })
    global.fetch = mockAnthropic(payload) as unknown as typeof fetch
    const out = await enrichMaintenanceBlock(MAINT_WEEKS, CTX, 'key')
    expect(out[0].coach_debrief).toBeUndefined()
    expect(out[1].coach_debrief).toBe('Back to base. Nothing to prove.')
  })

  it('🔴 the predicate has ONE owner — the merge does not carry its own idea of a token', () => {
    // `firstPlaceholder` also catches an ORPHAN (`{{` or `}}` alone), which a hand-rolled
    // `/\{\{.*\}\}/` would miss. Bounded to the module's CODE, never grepped over comments:
    // a token check mentioned in a comment is not a token check (HOOK-RGBA-COMMENTS-01).
    const src = readFileSync(join(process.cwd(), 'lib/plan/enrichMaintenance.ts'), 'utf8')
      .replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(src).toContain("firstPlaceholder")
    expect(src, 'no second definition of "this copy carries a token"').not.toMatch(/\{\{\[\^}\]\*\}\}/)
  })
})
