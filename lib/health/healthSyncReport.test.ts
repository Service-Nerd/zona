import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// HEALTH-SYNC-OBS-01 — the gate for "a sweep that found NOTHING still reports".
//
// ⚠️ THIS IS BEHAVIOURAL, NOT A SOURCE ASSERTION, and the distinction is the
// whole point. A grep for `reportSweep` in `clientSync.ts` passes on a comment,
// and the defect being guarded against is a sweep that returns EARLY — exactly
// what `if (!res.workouts.length) break` did for 17 days. Only running it proves
// the report survives that path.
//
// `vitest.config.ts` is `environment: 'node'`, so there is no `localStorage`:
// `getLastSyncIso`/`setLastSyncIso` both swallow their own throw and the sweep
// behaves as it does on a first-ever sync. That is the cohort under test.

const posts: Array<{ url: string; body: any }> = []

vi.mock('@/lib/supabase/authedFetch', () => ({
  authedFetch: async (url: string, options: RequestInit = {}) => {
    posts.push({ url, body: options.body ? JSON.parse(String(options.body)) : null })
    return { ok: true } as Response
  },
}))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))

/** Builds a fake `@capgo/capacitor-health` returning the given workout pages. */
function fakeHealth(pages: Array<{ workouts: any[]; anchor?: string }>, opts: { throws?: Error } = {}) {
  let call = 0
  return {
    isAvailable: async () => ({ available: true }),
    queryWorkouts: async () => {
      if (opts.throws) throw opts.throws
      return pages[call++] ?? { workouts: [] }
    },
    readSamples: async () => ({ samples: [] }),
  }
}

let health: any
vi.mock('@capgo/capacitor-health', () => ({ get Health() { return health } }))

const REPORT_URL = '/api/ops/health-sync-report'
const reports = () => posts.filter(p => p.url === REPORT_URL)
const ingests = () => posts.filter(p => p.url === '/api/health/ingest')

async function sweep() {
  const { syncOnAppOpen } = await import('./clientSync')
  await syncOnAppOpen()
}

const workout = (id: string) => ({
  platformId: id, startDate: '2026-10-06T08:00:00.000Z', endDate: '2026-10-06T08:40:00.000Z',
  totalDistance: 8000, duration: 2400, totalEnergyBurned: 500, metadata: {}, sourceName: 'Watch',
})

beforeEach(() => { posts.length = 0; vi.resetModules() })
afterEach(() => { health = undefined })

describe('HEALTH-SYNC-OBS-01 — the sweep reports even when it finds nothing', () => {
  it('reports a ZERO-workout sweep — the 17-silent-days case', async () => {
    health = fakeHealth([{ workouts: [] }])
    await sweep()

    // The failure being guarded: `if (!res.workouts.length) break` returned with
    // no ingest POST, so nothing server-side could ever have observed it.
    expect(ingests()).toHaveLength(0)
    expect(reports()).toHaveLength(1)
    expect(reports()[0].body).toMatchObject({ workoutsFound: 0, posted: 0, failed: 0 })
    expect(typeof reports()[0].body.lookbackFrom).toBe('string')
  })

  it('separates "found nothing" from "found runs the server refused"', async () => {
    health = fakeHealth([{ workouts: [workout('a'), workout('b')] }])
    await sweep()
    expect(reports()[0].body).toMatchObject({ workoutsFound: 2, posted: 2, failed: 0 })
  })

  it('reports a sweep whose plugin query THREW, and still rethrows', async () => {
    // `syncOnAppOpen` wraps the sweep in `Promise.allSettled`, so a throw is
    // swallowed there and was previously invisible everywhere.
    health = fakeHealth([], { throws: new Error('authorization denied') })
    await sweep()
    expect(reports()).toHaveLength(1)
    expect(reports()[0].body.workoutsFound).toBe(0)
    expect(reports()[0].body.error).toContain('authorization denied')
  })
})
