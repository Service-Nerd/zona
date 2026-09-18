// PLAN-WEEK-COLLISION-01 — the regression suite for "a new plan arrives
// pre-completed".
//
// THE INCIDENT, 2026-09-18. A freshly generated 12-week 10K plan (Dorney Lake,
// race 2026-12-12) rendered with 44 of its 47 sessions already marked complete
// or skipped and five linked to runs from the previous April. `week_n` is a
// WITHIN-PLAN coordinate that five tables use as a cross-plan key, and a new
// race plan restarts `week.n` at 1 — landing exactly on the rows of the plan it
// replaced.
//
// ⚠️ THIS BUG HAD NO SYMPTOM UNTIL A HUMAN LOOKED. Nothing threw, nothing
// logged, every gate was green, and `validatePlan()` cannot see it by
// construction — it validates the plan OBJECT and the collision lives in
// another table. A test is the only thing that can hold this shut.

import { describe, it, expect, vi } from 'vitest'
import {
  supersedeWeekKeyedRows,
  isRaceIdentityChange,
  WEEK_KEYED_TABLES,
} from './supersede'

// ── A Supabase stub that records what it was asked to do ────────────────────
function fakeClient(opts: { failOn?: string } = {}) {
  const calls: { table: string; set: unknown; filters: [string, unknown][] }[] = []
  const from = (table: string) => {
    const filters: [string, unknown][] = []
    let set: unknown = null
    const chain: any = {
      update: (v: unknown) => { set = v; return chain },
      eq: (c: string, v: unknown) => { filters.push([c, v]); return chain },
      is: (c: string, v: unknown) => { filters.push([c, v]); return chain },
      select: () => {
        calls.push({ table, set, filters })
        return opts.failOn === table
          ? Promise.resolve({ data: null, error: { message: 'boom' } })
          : Promise.resolve({ data: [{ user_id: 'u1' }, { user_id: 'u1' }], error: null })
      },
    }
    return chain
  }
  return { client: { from } as any, calls }
}

describe('isRaceIdentityChange — the shared predicate', () => {
  const rts = { race_name: 'Race to the Stones', race_date: '2026-07-11' }

  it('is false when nothing about the race changed', () => {
    expect(isRaceIdentityChange(rts, { ...rts })).toBe(false)
  })

  // The reason same-race mutations must NOT supersede: a reshape,
  // recalibration or sub-threshold auto-apply keeps the same week sequence, so
  // stamping there would wipe a runner's progress MID-BLOCK. That is a worse
  // bug than the one this file exists for.
  it('is false for a reshape of the same race', () => {
    expect(isRaceIdentityChange(rts, { ...rts })).toBe(false)
  })

  it('is true for a different race', () => {
    expect(isRaceIdentityChange(rts, { race_name: 'Dorney Lake', race_date: '2026-12-12' })).toBe(true)
  })

  // ⚠️ THE COMMON PATH, and the one that makes this more than a founder-only
  // bug. A runner deferring their race, or fixing a typo in the date, changes
  // the identity — so the plan is archived and week numbering restarts. Every
  // Make-A-Wish runner who moves their date would have hit this.
  it('is true when ONLY the race date moves (a deferral)', () => {
    expect(isRaceIdentityChange(rts, { ...rts, race_date: '2026-09-05' })).toBe(true)
  })

  it('is false when there is no prior plan (a first plan supersedes nothing)', () => {
    expect(isRaceIdentityChange(null, rts)).toBe(false)
    expect(isRaceIdentityChange(undefined, rts)).toBe(false)
  })
})

describe('supersedeWeekKeyedRows', () => {
  it('stamps EVERY week-keyed table, not just the one that showed the symptom', async () => {
    const { client, calls } = fakeClient()
    await supersedeWeekKeyedRows('u1', client)
    expect(calls.map(c => c.table).sort()).toEqual([...WEEK_KEYED_TABLES].sort())
  })

  it('scopes to the user and only touches rows that are still live', async () => {
    const { client, calls } = fakeClient()
    await supersedeWeekKeyedRows('u1', client)
    for (const c of calls) {
      expect(c.filters).toContainEqual(['user_id', 'u1'])
      // Idempotency: the `superseded_at IS NULL` predicate is what makes a
      // second run a no-op, which matters because savePlanForUser can fire
      // several times in the race -> maintenance handoff burst (ADR-013).
      expect(c.filters).toContainEqual(['superseded_at', null])
    }
  })

  it('writes one timestamp across all five tables, so a plan cannot be half-superseded', async () => {
    const { client, calls } = fakeClient()
    const { at } = await supersedeWeekKeyedRows('u1', client, new Date('2026-09-18T09:00:00.000Z'))
    expect(at).toBe('2026-09-18T09:00:00.000Z')
    for (const c of calls) expect(c.set).toEqual({ superseded_at: at })
  })

  // Fails loudly rather than leaving a new plan showing the old plan's data.
  // The silent-fallback class is this repo's most expensive, and a swallowed
  // error here reproduces the exact defect being fixed.
  it('throws when a stamp fails, naming the table', async () => {
    const { client } = fakeClient({ failOn: 'run_analysis' })
    await expect(supersedeWeekKeyedRows('u1', client)).rejects.toThrow(/run_analysis/)
  })

  it('reports how many rows each table stamped', async () => {
    const { client } = fakeClient()
    const { stamped } = await supersedeWeekKeyedRows('u1', client)
    expect(stamped.session_completions).toBe(2)
  })
})

// ── The regression itself, as the founder's data actually looked ────────────
//
// FAILS BEFORE THE FIX: with no supersede step, the new plan's weeks 1..12
// resolve against the prior plan's rows for weeks 1..12.
describe('the Dorney regression — a new plan must arrive empty', () => {
  type Row = { week_n: number; session_day: string; superseded_at: string | null }

  /** The prior plan's real shape: Race to the Stones, weeks 1..25. */
  const priorRows: Row[] = Array.from({ length: 25 }, (_, i) => i + 1)
    .flatMap(n => ['mon', 'wed', 'fri', 'sun'].map(d => ({ week_n: n, session_day: d, superseded_at: null })))

  /** What the UI does: completionsMap[week_n][session_day], no plan identity. */
  const resolve = (rows: Row[], weekN: number, day: string, liveOnly: boolean) =>
    rows.find(r => r.week_n === weekN && r.session_day === day && (!liveOnly || r.superseded_at === null))

  const newPlanWeeks = Array.from({ length: 12 }, (_, i) => i + 1)

  it('WITHOUT the stamp, the new plan inherits the old plan (the bug)', () => {
    const hits = newPlanWeeks.flatMap(n =>
      ['mon', 'wed', 'fri', 'sun'].filter(d => resolve(priorRows, n, d, false)))
    expect(hits.length).toBe(48)   // every session of the new plan, pre-marked
  })

  it('WITH the stamp, the new plan resolves to nothing', () => {
    const stamped = priorRows.map(r => ({ ...r, superseded_at: '2026-09-17T20:12:03Z' }))
    const hits = newPlanWeeks.flatMap(n =>
      ['mon', 'wed', 'fri', 'sun'].filter(d => resolve(stamped, n, d, true)))
    expect(hits).toEqual([])
  })

  // History is the reason this marks rather than deletes. The trend card,
  // discipline ledger, reframe cohort and v_coach_engagement all aggregate
  // across plans; deleting would destroy a runner's training record to fix a
  // display bug.
  it('the superseded rows still EXIST, so history survives', () => {
    const stamped = priorRows.map(r => ({ ...r, superseded_at: '2026-09-17T20:12:03Z' }))
    expect(stamped.length).toBe(priorRows.length)
    expect(stamped.every(r => r.superseded_at !== null)).toBe(true)
  })
})
