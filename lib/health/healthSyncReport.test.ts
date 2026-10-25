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

async function sweep(trigger: import('./syncTrigger').SyncTrigger = 'open') {
  const { syncOnAppOpen } = await import('./clientSync')
  await syncOnAppOpen(trigger)
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

// HK-SYNC-TRIGGER-01 (2026-10-25). "Why don't runs link with the app closed?" could not be answered: no sweep said what
// started it, so a background (observer) wake was indistinguishable from opening the app.
describe('HK-SYNC-TRIGGER-01 — every sweep says what started it', () => {
  it('🔴 the trigger reaches the report', async () => {
    health = fakeHealth([{ workouts: [] }])
    await sweep('observer_workout')
    expect(reports()[0].body.trigger).toBe('observer_workout')
  })
  it('🔴 and whether the page was hidden when it started (node has no document → null, never a guess)', async () => {
    health = fakeHealth([{ workouts: [] }])
    ;(globalThis as { document?: unknown }).document = { visibilityState: 'hidden' }
    try { await sweep('observer_hr') } finally { delete (globalThis as { document?: unknown }).document }
    expect(reports()[0].body.appState).toBe('hidden')
    health = fakeHealth([{ workouts: [] }])
    await sweep('open')
    expect(reports()[1].body.appState).toBeNull()
  })
  it('🔴 each observer event names its own trigger, never a shared one', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync('lib/health/observer.ts', 'utf8')
    expect(src).toContain("addListener('workoutDataArrived', onData('observer_workout'))")
    expect(src).toContain("addListener('hrDataArrived', onData('observer_hr'))")
    expect(src).toContain("addListener('recoveryDataArrived', onData('observer_recovery'))")
  })
})

describe('HK-SYNC-TRIGGER-01 — the route stores only known values', () => {
  const R = { events: [] as unknown[][] }
  it('a known trigger and app state are stored; anything else is null', async () => {
    vi.doMock('@/lib/supabase/getUserFromRequest', () => ({ getUserFromRequest: async () => ({ id: 'u1' }) }))
    vi.doMock('@/lib/ops/recordOpsEvent', () => ({ recordOpsEvent: async (...a: unknown[]) => { R.events.push(a) } }))
    const { POST } = await import('@/app/api/ops/health-sync-report/route')
    const send = (b: unknown) => POST(new Request('https://x', { method: 'POST', body: JSON.stringify(b) }) as never)
    await send({ trigger: 'observer_workout', appState: 'hidden', workoutsFound: 1 })
    await send({ trigger: 'nonsense', appState: 'sideways' })
    expect((R.events[0][1] as Record<string, unknown>)).toMatchObject({ trigger: 'observer_workout', app_state: 'hidden' })
    expect((R.events[1][1] as Record<string, unknown>)).toMatchObject({ trigger: null, app_state: null })
  })
})
