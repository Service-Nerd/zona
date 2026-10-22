import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { consolidateIncomingHealthKitRow } from './healthkitConsolidate'
import { hrArrivalStamp } from './lateArrivalGate'

/**
 * 🔴 HR-LATE-STAMP-01 — `hr_arrived_late_at` marks EVERY patch that fills HR onto a row ingested without it, as its
 * migration defines. Both paths stamped only past the 24 h fresh window, so 29 of 32 late arrivals carried no stamp.
 */
describe('HR-LATE-STAMP-01: every late HR arrival is stamped', () => {
  const now = new Date('2026-10-22T09:00:00Z')

  it('the stamp is the time it is written', () => {
    expect(hrArrivalStamp(now)).toEqual({ hr_arrived_late_at: '2026-10-22T09:00:00.000Z' })
  })

  // A run that ended ten minutes ago, already stored without HR under another row; the incoming copy carries HR.
  const start = new Date(Date.now() - 40 * 60 * 1000).toISOString()
  const incoming = {
    user_id: 'u1', apple_health_uuid: 'HK2', distance_m: 8000, start_date: start, moving_time_s: 30 * 60,
    avg_hr: 140, max_hr: 160, hr_in_zone_pct: 80, hr_above_ceiling_pct: 5, hr_below_floor_pct: 15,
    hr_pct_z1: 10, hr_pct_z2: 70, hr_pct_z3: 15, hr_pct_z4_5: 5,
  }
  const fake = (captured: { patch?: Record<string, unknown> }) => ({
    from: () => ({
      select: () => ({ eq: () => ({ gte: () => ({ lte: () => Promise.resolve({ data: [
        { id: 'c1', apple_health_uuid: 'HK1', strava_activity_id: null, distance_m: 8000, start_date: start, hr_in_zone_pct: null },
      ], error: null }) }) }) }),
      update: (patch: Record<string, unknown>) => { captured.patch = patch; return { eq: () => Promise.resolve({ error: null }) } },
    }),
  })

  it('🔴 an arrival INSIDE the fresh window is stamped, and still reports fresh', async () => {
    const captured: { patch?: Record<string, unknown> } = {}
    const r = await consolidateIncomingHealthKitRow(fake(captured), 'u1', incoming as never)
    expect(r.hrLifted).toBe(true)
    expect(r.withinFreshWindow).toBe(true)
    expect(captured.patch?.avg_hr).toBe(140)
    expect(typeof captured.patch?.hr_arrived_late_at).toBe('string')
  })

  it('🔴 nothing outside the owner writes the column, and both ingest paths call it outside any window check', () => {
    const files: string[] = []
    const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(f) && !/\.test\./.test(f)) files.push(p) } }
    walk('app'); walk('lib')
    const writers = files.filter(f => /hr_arrived_late_at\s*[:=]/.test(readFileSync(f, 'utf8').replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '')))
    expect(writers).toEqual(['lib/coaching/lateArrivalGate.ts'])
    for (const f of ['lib/coaching/healthkitConsolidate.ts', 'app/api/health/ingest/route.ts']) {
      const src = readFileSync(f, 'utf8')
      const at = src.indexOf('hrArrivalStamp(now)')
      expect(at, f).toBeGreaterThan(0)
      // The 2026-06 shape: the stamp nested under `if (!lateArrival.withinFreshWindow)`.
      expect(src.slice(Math.max(0, at - 200), at), f).not.toMatch(/withinFreshWindow\)\s*\{\s*$/)
    }
  })
})
