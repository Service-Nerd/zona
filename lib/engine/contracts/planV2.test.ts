import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  PlanMetaV2Schema, SessionV2Schema, WeekV2ObjectSchema, RaceResultV2Schema, GeneratorInputV2Schema,
  PlanV2Schema,
} from './planV2'
import { META_NOTE_FIELDS } from '../readModel'

/**
 * ADR027-B1-CONTRACTS — Plan v2 declares every key, and refuses one it does not.
 *
 * The key-set arm reads the field names from `types/plan.ts` (the TS authority) rather
 * than holding a second list, so a field added to `PlanMeta` and not to v2 fails here
 * before a stored plan carrying it fails a strict parse in production.
 */

const TYPES = readFileSync('types/plan.ts', 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/[^\n]*/g, '')

function interfaceKeys(name: string): string[] {
  const m = TYPES.match(new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\n\\}`))
  if (!m) throw new Error(`interface ${name} not found in types/plan.ts`)
  return Array.from(m[1].matchAll(/^ {2}([a-z_0-9]+)\??:/gm)).map(x => x[1])
}

const shapeKeys = (s: { shape: Record<string, unknown> }) => Object.keys(s.shape)

const minimalMeta = {
  athlete: 'A', race_name: 'R', race_date: '2026-12-06', race_distance_km: 10,
  plan_start: '2026-10-05', last_updated: '2026-10-01T00:00:00Z',
}
const minimalWeek = {
  n: 1, date: '2026-10-05', label: 'W1', theme: 't', type: 'normal',
  sessions: { mon: { type: 'easy', label: 'Easy', detail: null, distance_km: 5 } },
  long_run_hrs: null, weekly_km: 5,
}
const minimalPlan = { schema_version: 2, meta: minimalMeta, weeks: [minimalWeek] }

describe('ADR027-B1-CONTRACTS — Plan v2 key sets', () => {
  it('the population is real: the TS interfaces parse to the sizes the inventory counted', () => {
    expect(interfaceKeys('PlanMeta').length).toBeGreaterThanOrEqual(118)
    expect(interfaceKeys('Session').length).toBeGreaterThanOrEqual(28)
    expect(interfaceKeys('Week').length).toBeGreaterThanOrEqual(18)
    expect(interfaceKeys('GeneratorInput')).toHaveLength(33)
  })

  it('every PlanMeta / Session / Week / RaceResult / GeneratorInput field is declared in v2', () => {
    const missing = (iface: string, keys: string[]) =>
      interfaceKeys(iface).filter(k => !keys.includes(k)).map(k => `${iface}.${k}`)
    const gaps = [
      ...missing('PlanMeta', shapeKeys(PlanMetaV2Schema)),
      ...missing('Session', shapeKeys(SessionV2Schema)),
      ...missing('Week', shapeKeys(WeekV2ObjectSchema)),
      ...missing('RaceResult', shapeKeys(RaceResultV2Schema)),
      ...missing('GeneratorInput', shapeKeys(GeneratorInputV2Schema)),
    ]
    expect(gaps, `declare these in lib/engine/contracts/planV2.ts:\n${gaps.join('\n')}`).toEqual([])
  })

  it('the key-set arm can fail: a v2 shape missing a TS field is reported', () => {
    const { stimulus: _s, ...shape } = SessionV2Schema.shape
    expect(interfaceKeys('Session').filter(k => !Object.keys(shape).includes(k))).toEqual(['stimulus'])
  })

  it('META_NOTE_FIELDS is exactly the *_note keys v2 declares', () => {
    const notes = shapeKeys(PlanMetaV2Schema).filter(k => k.endsWith('_note')).sort()
    expect([...META_NOTE_FIELDS].sort()).toEqual(notes)
    expect(notes).toHaveLength(16)
  })
})

describe('ADR027-B1-CONTRACTS — v2 is strict at every level', () => {
  it('accepts the minimal plan', () => {
    expect(PlanV2Schema.safeParse(minimalPlan).success).toBe(true)
  })

  // Falsification: each of these is a key v1's PlanSchema silently accepts.
  const unknownAt: Array<[string, unknown]> = [
    ['top level', { ...minimalPlan, extra: 1 }],
    ['meta', { ...minimalPlan, meta: { ...minimalMeta, made_up_note: 'x' } }],
    ['meta.generator_input', { ...minimalPlan, meta: { ...minimalMeta, generator_input: {
      race_date: '2026-12-06', race_distance_km: 10, goal: 'finish', current_weekly_km: 20,
      longest_recent_run_km: 8, days_available: 4, primary_metric: 'distance' } } }],
    ['week', { ...minimalPlan, weeks: [{ ...minimalWeek, extra: true }] }],
    ['session', { ...minimalPlan, weeks: [{ ...minimalWeek, sessions: { mon: { ...minimalWeek.sessions.mon, extra: 1 } } }] }],
    ['phase', { ...minimalPlan, phases: [{ name: 'base', start_week: 1, end_week: 2, extra: 1 }] }],
  ]
  for (const [where, plan] of unknownAt) {
    it(`refuses an unknown key at ${where}`, () => {
      const r = PlanV2Schema.safeParse(plan)
      expect(r.success).toBe(false)
      expect(r.success ? '' : r.error.issues.map(i => i.code).join()).toContain('unrecognized_keys')
    })
  }

  it('keeps v1\'s per-phase volume rule: a non-walk-run week without weekly_km fails', () => {
    const { weekly_km: _drop, ...noKm } = minimalWeek
    expect(PlanV2Schema.safeParse({ ...minimalPlan, weeks: [noKm] }).success).toBe(false)
    expect(PlanV2Schema.safeParse({ ...minimalPlan, weeks: [{ ...noKm, phase: 'walk_run_start' }] }).success).toBe(true)
  })

  it('accepts the stored legacy values it declares (each measured on production, 2026-11-21)', () => {
    const legacy = {
      ...minimalPlan,
      meta: { ...minimalMeta, athlete: undefined, handle: null, charity: null, resting_hr: 0 },
      weeks: [{ ...minimalWeek, badge: 'key_session' }],
    }
    delete (legacy.meta as Record<string, unknown>).athlete
    expect(PlanV2Schema.safeParse(legacy).success).toBe(true)
  })
})
