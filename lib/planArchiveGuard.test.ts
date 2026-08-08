import { describe, it, expect } from 'vitest'
import { savePlanForUser } from './plan'
import type { Plan } from '@/types/plan'

// ADR-013 follow-on: the race→maintenance handoff fired savePlanForUser 3×
// near-simultaneously and archived the completed race plan 3× (every concurrent
// read saw the pre-handoff plan). The guard now skips an archive when an
// identical prior snapshot was archived within the recency window. These tests
// exercise that guard with a minimal in-memory Supabase fake.

type ArchiveRow = { race_name: string | null; race_date: string | null; archived_at: string; plan_json?: unknown }

function makeClient(state: { plans: Plan | null; archive: ArchiveRow[] }) {
  return {
    from(table: string) {
      const ctx: { table: string; op: 'select' | 'delete'; gte?: { col: string; val: string } } = { table, op: 'select' }
      const builder: any = {
        select() { ctx.op = 'select'; return builder },
        eq() { return builder },
        gte(col: string, val: string) { ctx.gte = { col, val }; return builder },
        maybeSingle() {
          if (ctx.table === 'plans') return Promise.resolve({ data: state.plans ? { plan_json: state.plans } : null })
          return Promise.resolve({ data: null })
        },
        insert(row: ArchiveRow) {
          if (ctx.table === 'plan_archive') state.archive.push({ ...row, archived_at: new Date().toISOString() })
          return Promise.resolve({ error: null })
        },
        upsert(row: { plan_json: Plan }) {
          if (ctx.table === 'plans') state.plans = row.plan_json
          return Promise.resolve({ error: null })
        },
        delete() { ctx.op = 'delete'; return builder },
        // Terminal for the awaited recent-archive read + the notes delete.
        then(resolve: (v: unknown) => unknown) {
          if (ctx.table === 'plan_archive' && ctx.op === 'select') {
            let rows = state.archive
            if (ctx.gte) rows = rows.filter(r => (r as any)[ctx.gte!.col] >= ctx.gte!.val)
            return resolve({ data: rows.map(r => ({ race_name: r.race_name, race_date: r.race_date })) })
          }
          return resolve({ error: null })
        },
      }
      return builder
    },
  } as any
}

const racePlan = {
  meta: { race_name: 'Race to the Stones', race_date: '2026-07-11' },
  weeks: [{ n: 1, date: '2026-01-05' }],
} as unknown as Plan

const maintenancePlan = {
  meta: { race_name: 'After Race to the Stones', race_date: '' },
  weeks: [{ n: 26, date: '2026-07-13' }],
} as unknown as Plan

describe('savePlanForUser archive guard', () => {
  it('archives the prior race plan on a race-identity change', async () => {
    const state = { plans: racePlan, archive: [] as ArchiveRow[] }
    await savePlanForUser('u', maintenancePlan, makeClient(state))
    expect(state.archive).toHaveLength(1)
    expect(state.archive[0].race_name).toBe('Race to the Stones')
  })

  it('does NOT re-archive when the same prior was archived seconds ago (the 3× handoff bug)', async () => {
    const state = {
      plans: racePlan,
      archive: [{ race_name: 'Race to the Stones', race_date: '2026-07-11', archived_at: new Date().toISOString() }],
    }
    await savePlanForUser('u', maintenancePlan, makeClient(state))
    expect(state.archive).toHaveLength(1) // skipped — no duplicate
  })

  it('still archives when the only matching row is older than the recency window', async () => {
    const state = {
      plans: racePlan,
      archive: [{
        race_name: 'Race to the Stones', race_date: '2026-07-11',
        archived_at: new Date(Date.now() - 20 * 60_000).toISOString(), // 20 min ago
      }],
    }
    await savePlanForUser('u', maintenancePlan, makeClient(state))
    expect(state.archive).toHaveLength(2) // old row is outside the window → genuine re-archive
  })

  it('does not archive when the race identity is unchanged (reshape/recalibrate)', async () => {
    const state = { plans: racePlan, archive: [] as ArchiveRow[] }
    const sameRaceReshape = { ...racePlan, weeks: [{ n: 1, date: '2026-01-05' }, { n: 2, date: '2026-01-12' }] } as unknown as Plan
    await savePlanForUser('u', sameRaceReshape, makeClient(state))
    expect(state.archive).toHaveLength(0)
  })
})
