// STRAVA-WEBHOOK-SOR-01 — Apple Health is the system of record for run data (founder 2026-11-21; ADR-011 §3,
// INV-DATA-008). Two halves: a Strava delete never removes an Apple Health row, and NO file outside the ingest
// gateway can write a strava_activities row (the tree half the staged-file commit hook cannot see).
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'
import { deleteStravaActivity } from './stravaSor'

describe('deleteStravaActivity', () => {
  it('🔴 deletes only Strava-source rows and clears the Strava patch on an Apple Health row', async () => {
    const calls: { op: string; filter: Record<string, unknown>; patch?: unknown }[] = []
    const supabase = {
      from: () => ({
        delete: () => ({ match: async (f: Record<string, unknown>) => { calls.push({ op: 'delete', filter: f }); return {} } }),
        update: (patch: unknown) => ({ match: async (f: Record<string, unknown>) => { calls.push({ op: 'update', filter: f, patch }); return {} } }),
      }),
    }
    await deleteStravaActivity(supabase as never, 'u1', 42)
    const del = calls.filter(c => c.op === 'delete')
    expect(del).toHaveLength(1)
    expect(del[0].filter).toEqual({ user_id: 'u1', strava_activity_id: 42, source: 'strava' })
    const upd = calls.find(c => c.op === 'update')!
    expect(upd.filter.source).toBe('apple_health')
    expect(upd.patch).toMatchObject({ strava_activity_id: null })
  })
})

describe('INV-DATA-008 tree sweep: only the ingest gateway writes strava_activities', () => {
  const ROOT = join(__dirname, '../..')
  const ALLOWED = new Set(['app/api/health/ingest/route.ts', 'lib/coaching/healthkitConsolidate.ts'])
  const files: string[] = []
  const walk = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) { if (!['node_modules', '.next', '__fixtures__'].includes(n)) walk(p) } else if (/\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n)) files.push(p) } }
  walk(join(ROOT, 'app')); walk(join(ROOT, 'lib'))
  it('🔴 no insert/upsert into strava_activities outside the gateway', () => {
    const offenders = files.map(f => relative(ROOT, f)).filter(rel => {
      if (Array.from(ALLOWED).some(a => rel.startsWith(a.replace(/route\.ts$/, '')))) return false
      return /\.from\(['"]strava_activities['"]\)[\s\S]{0,400}?\.(insert|upsert)\(/.test(readFileSync(join(ROOT, rel), 'utf8'))
    })
    expect(offenders).toEqual([])
  })
})
