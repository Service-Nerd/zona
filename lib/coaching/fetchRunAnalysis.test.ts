import { describe, it, expect } from 'vitest'
import { fetchRunAnalysis, RUN_ANALYSIS_COLUMNS } from './fetchRunAnalysis'

// POSTRUN-POLL-WEEK-BLIND-01 — the gate for "the poll names the week".
//
// ⚠️ THE ARM THAT MATTERS ASSERTS CARDINALITY, NOT PRESENCE. A fixture with one
// row passes whether or not `week_n` is in the query, so a naive "does it return
// the row?" test is green against the defect. The fake client below reproduces
// PostgREST's real `maybeSingle()` behaviour — **more than one match is an ERROR
// with `data: null`** — and the fixture holds the founder's actual two rows.

/** Minimal PostgREST double: records filters, applies them, honours maybeSingle. */
function fakeSupabase(rows: Record<string, unknown>[], seen: { filters: Record<string, unknown> } = { filters: {} }) {
  let working = [...rows]
  const builder: any = {
    select: (_cols: string) => { seen.filters.__select = _cols; return builder },
    eq: (col: string, val: unknown) => {
      seen.filters[col] = val
      working = working.filter(r => r[col] === val)
      return builder
    },
    is: (col: string, val: unknown) => {
      seen.filters[col] = val
      working = working.filter(r => (r[col] ?? null) === val)
      return builder
    },
    maybeSingle: async () => {
      if (working.length > 1) {
        // PostgREST 406 — this is the exact failure the defect walked into.
        return { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned' } }
      }
      return { data: working[0] ?? null, error: null }
    },
  }
  return { from: (_t: string) => builder, _seen: seen }
}

const UID = 'u1'
/** The founder's real shape: two live analyses, both on a Wednesday. */
const TWO_WEDNESDAYS = [
  { user_id: UID, week_n: 3, session_day: 'wed', superseded_at: null, total_score: 50 },
  { user_id: UID, week_n: 1, session_day: 'wed', superseded_at: null, total_score: null },
]

describe('POSTRUN-POLL-WEEK-BLIND-01 — session_day alone is not a key', () => {
  it('THE DEFECT: two live Wednesdays make maybeSingle error with a null row', async () => {
    // Proof the double reproduces the real failure, so the arm below means something.
    const sb = fakeSupabase(TWO_WEDNESDAYS)
    const res = await sb.from('run_analysis').select('*')
      .eq('user_id', UID).is('superseded_at', null).eq('session_day', 'wed').maybeSingle()
    expect(res.data).toBeNull()
    expect(res.error).not.toBeNull()
  })

  it('THE FIX: naming the week resolves to exactly the session asked for', async () => {
    const sb = fakeSupabase(TWO_WEDNESDAYS)
    const { row, error } = await fetchRunAnalysis(sb, UID, 3, 'wed')
    expect(error).toBeNull()
    expect(row).not.toBeNull()
    expect(row!.week_n).toBe(3)
    expect(row!.total_score).toBe(50)   // week 3's, not week 1's
  })

  it('it actually filters on week_n — not merely accepts the argument', async () => {
    const seen = { filters: {} as Record<string, unknown> }
    const sb = fakeSupabase(TWO_WEDNESDAYS, seen)
    await fetchRunAnalysis(sb, UID, 3, 'wed')
    expect(seen.filters.week_n).toBe(3)
    expect(seen.filters.session_day).toBe('wed')
    expect(seen.filters.superseded_at).toBeNull()
  })

  it('an older week still resolves, so the key works in both directions', async () => {
    const sb = fakeSupabase(TWO_WEDNESDAYS)
    const { row } = await fetchRunAnalysis(sb, UID, 1, 'wed')
    expect(row!.week_n).toBe(1)
  })

  it('RETURNS the error instead of swallowing it', async () => {
    // A swallowed error is why 17 minutes of fake loading went unnoticed.
    const broken = { from: () => ({ select: () => ({ eq: () => ({ is: () => ({ eq: () => ({ eq: () => ({
      maybeSingle: async () => ({ data: null, error: { message: 'boom' } }),
    }) }) }) }) }) }) }
    const { row, error } = await fetchRunAnalysis(broken as any, UID, 3, 'wed')
    expect(row).toBeNull()
    expect(error?.message).toBe('boom')
  })

  it('no analysis yet is a null row with NO error — pending must stay distinguishable from broken', async () => {
    const sb = fakeSupabase([])
    const { row, error } = await fetchRunAnalysis(sb, UID, 3, 'wed')
    expect(row).toBeNull()
    expect(error).toBeNull()
  })

  it('selects the load columns the Distance row needs', async () => {
    // POSTRUN-METRIC-PREF-01 depends on these reaching the card at all.
    for (const col of ['planned_load_km', 'actual_load_km', 'planned_load_mins', 'actual_load_mins', 'week_n']) {
      expect(RUN_ANALYSIS_COLUMNS).toContain(col)
    }
  })
})
