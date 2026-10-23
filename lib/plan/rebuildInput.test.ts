// REBUILD-HR-FROM-PROFILE-01 — a rebuild from the stored answers takes heart rate from the profile. Measured before:
// a confirmed 143 bpm rebuilt to 178 (FLEET-INVALID-DEBT-01's 2026-09-17 run) and 185 to 188; two more plans were one
// Modify-plan edit from 203 -> 198 and 179 -> 182. vitest runs in `node`, so the client wiring is checked on the bounded
// region of `runModifyPreview`, and the scripts by a population derived from the repo, never a list of names.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { withProfileHr } from './rebuildInput'
import { generateRulePlan } from './ruleEngine'
import type { GeneratorInput } from '@/types/plan'

const ROOT = path.resolve(__dirname, '../..')

// Shaped like e49ea589's stored answers (5K, time target), with no personal data: the stored snapshot says 198 observed,
// the runner then confirmed 203 in Profile.
const STORED = {
  age: 26, goal: 'time_target', race_distance_km: 5, race_date: '2026-11-28', race_name: 'Parkrun',
  target_time: '0:22:00', benchmark: { time: '0:24:00', type: 'race', distance_km: 5 },
  resting_hr: 63, max_hr: 198, max_hr_source: 'observed',
  days_available: 3, current_weekly_km: 15, longest_recent_run_km: 6, training_age: '6-18mo',
  recent_quality_training: 'occasional', plan_start: '2026-09-28',
} as unknown as GeneratorInput
const CONFIRMED = { resting_hr: 63, max_hr: 203, max_hr_source: 'user_confirmed' as const }

describe('withProfileHr — the overlay rules', () => {
  it('the profile wins for all three heart-rate fields', () => {
    const out = withProfileHr(STORED, CONFIRMED)
    expect([out.max_hr, out.resting_hr, out.max_hr_source]).toEqual([203, 63, 'user_confirmed'])
  })
  it('a missing or zero profile value keeps the stored one (a 0 resting HR exists in production)', () => {
    expect(withProfileHr(STORED, { resting_hr: 0, max_hr: null }).resting_hr).toBe(63)
    expect(withProfileHr(STORED, { max_hr: undefined }).max_hr).toBe(198)
    expect(withProfileHr(STORED, null)).toBe(STORED)
  })
  it('a profile max never inherits the stored source', () => {
    const storedConfirmed = { ...STORED, max_hr: 188, max_hr_source: 'user_confirmed' } as GeneratorInput
    const out = withProfileHr(storedConfirmed, { max_hr: 191, max_hr_source: null })
    expect(out.max_hr).toBe(191)
    expect(out.max_hr_source).toBeUndefined()
  })
  it('touches nothing else', () => {
    const out = withProfileHr(STORED, CONFIRMED) as unknown as Record<string, unknown>
    for (const k of Object.keys(STORED)) if (!['max_hr', 'max_hr_source'].includes(k)) expect(out[k]).toEqual((STORED as any)[k])
  })
})

describe('the journey — confirm in Profile, then rebuild', () => {
  const build = (input: GeneratorInput) => generateRulePlan(input, 'trial', '2026-09-28', undefined, '2026-09-28') as any
  it('rebuilding from the stored answers alone loses the confirmation (the defect, reproduced)', () => {
    expect(build(STORED).meta.max_hr).toBe(198)
  })
  it('rebuilding through withProfileHr keeps it, and the zones follow', () => {
    const plan = build(withProfileHr(STORED, CONFIRMED))
    expect(plan.meta.max_hr).toBe(203)
    expect(plan.meta.hr_max_source).toBe('user_confirmed')
    expect(plan.meta.zone2_ceiling).toBe(161)
    expect(build(STORED).meta.zone2_ceiling).not.toBe(161)
  })
})

describe('the app — every in-app rebuild passes through runModifyPreview, which overlays first', () => {
  const src = fs.readFileSync(path.join(ROOT, 'app/dashboard/DashboardClient.tsx'), 'utf8')
  const start = src.indexOf('async function runModifyPreview(')
  const region = start >= 0 ? src.slice(start, src.indexOf("authedFetch('/api/generate-plan'", start)) : ''
  it('found the region (an empty one passes everything below)', () => expect(region.length).toBeGreaterThan(100))
  it('overlays the profile state before the input is held for a re-send or sent', () => {
    const overlay = region.indexOf('withProfileHr(storedInput, { resting_hr: restingHR, max_hr: maxHR, max_hr_source: maxHRSource })')
    expect(overlay).toBeGreaterThan(0)
    expect(overlay).toBeLessThan(region.indexOf('lastModifyReqRef.current ='))
  })
  it('no other client path posts a stored input to /api/generate-plan', () => {
    const callers = src.split("authedFetch('/api/generate-plan'").length - 1
    const files = ['components', 'app'].flatMap(d => walk(path.join(ROOT, d)))
      .filter(f => /\.tsx?$/.test(f) && !/\.test\./.test(f) && f !== path.join(ROOT, 'app/dashboard/DashboardClient.tsx'))
      .filter(f => { const s = fs.readFileSync(f, 'utf8'); return s.includes('generator_input') && /fetch\(\s*['"`]\/api\/generate-plan/.test(s) })
    expect(files.map(f => path.relative(ROOT, f))).toEqual([])
    expect(callers).toBeGreaterThan(0)
  })
})

// A script that rebuilds a plan from `generator_input` AND writes production must overlay. Read-only scripts are exempt
// by name with a reason; the population is every script that does both, so a new one fails here until it overlays.
const READ_ONLY: Record<string, string> = {
  'scripts/board-evidence-basebuild-handover.ts': 'board evidence: prints, writes nothing',
  'scripts/board-evidence-basebuild-rebuild.ts': 'board evidence: prints, writes nothing',
  'scripts/_tmp-catch.ts': 'scratch read',
  'scripts/sync-plan-corpus.ts': 'writes the local fixture corpus, never a stored plan',
}
function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    if (e.name === 'node_modules' || e.name.startsWith('.')) return []
    const p = path.join(dir, e.name)
    return e.isDirectory() ? walk(p) : [p]
  })
}
describe('scripts — every plan-writing rebuild overlays the profile heart rate', () => {
  const scripts = walk(path.join(ROOT, 'scripts')).filter(f => f.endsWith('.ts'))
    .map(f => ({ rel: path.relative(ROOT, f), src: fs.readFileSync(f, 'utf8') }))
    .filter(({ src }) => src.includes('generator_input') && /generateRulePlan\(|composePlanWithFoundation\(/.test(src))
  it('the population is not empty', () => expect(scripts.length).toBeGreaterThanOrEqual(4))
  it('each one overlays, or is declared read-only with a reason', () => {
    const missing = scripts.filter(s => !READ_ONLY[s.rel] && !s.src.includes('withProfileHr(')).map(s => s.rel)
    expect(missing).toEqual([])
  })
  it('no read-only exemption is stale (names a script that does not exist or now writes plans)', () => {
    for (const rel of Object.keys(READ_ONLY)) {
      const f = path.join(ROOT, rel)
      if (!fs.existsSync(f)) continue
      expect(/from\('plans'\)\s*\.(update|upsert|insert)/.test(fs.readFileSync(f, 'utf8')), rel).toBe(false)
    }
  })
})
