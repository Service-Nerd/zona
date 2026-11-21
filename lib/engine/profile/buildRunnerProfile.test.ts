import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, resolve, dirname, relative } from 'node:path'
import { buildRunnerProfile, factsFromInput } from './buildRunnerProfile'
import { resolveAsOf } from './asOf'
import { derivedLevelsFor, vdotFor } from '@/lib/plan/ruleEngine'
import { effectiveStartKm } from '@/lib/plan/startVolume'
import { weeksBetweenLocal, formatDate, addDays } from '@/lib/plan/length'
import { weeksUntilRaceSigned } from '@/lib/format'
import { runEngine } from '@/lib/plan/engine'
import { goldenCorpus, strideFor } from '@/lib/corpus/goldenCorpus'
import { cohortGrid, COHORT_PLAN_START } from '@/lib/plan/cohortGrid'
import type { GeneratorInput } from '@/types/plan'
import type { RunnerFacts, SettingsFacts } from '@/lib/engine/contracts/facts'

/**
 * ADR027-B2-PROFILE — L1's profile is a re-plumbing, so the gate is EQUIVALENCE: every derived field
 * must equal the answer of the function that owned it before L1. A profile that drifts from the
 * owners is a second derivation, which is the class B2 exists to remove.
 */

const AT = new Date(2026, 10, 16, 12, 0, 0) // a fixed instant; never the wall clock

function strided<T>(xs: T[], n: number): T[] {
  const size = BigInt(xs.length)
  const stride = strideFor(size)
  const out: T[] = []
  for (let k = BigInt(0); k < BigInt(Math.min(n, xs.length)); k++) out.push(xs[Number((k * stride) % size)])
  return out
}

type Row = { id: string; input: GeneratorInput; planStart: string }
const GOLDEN: Row[] = goldenCorpus().map(r => ({ id: r.id, input: r.input, planStart: r.planStart }))
const COHORT_ALL = cohortGrid()
const COHORT: Row[] = strided(COHORT_ALL, 600).map((input, i) => ({ id: `c:${i}`, input, planStart: COHORT_PLAN_START }))

/** What the owners say, computed WITHOUT the profile. */
function ownerAnswers(input: GeneratorInput, planStart: string, at: Date) {
  const l = derivedLevelsFor(input, at)
  const v = vdotFor(input, at)
  const w = weeksBetweenLocal(planStart, input.race_date)
  return {
    declared: l.declared ?? null,
    assessed_structural: l.assessedStructural,
    assessed_intensity: l.assessedIntensity,
    structural: l.structural,
    intensity: l.intensity,
    api_override: input.fitness_level ?? null,
    vdot: v.vdot ?? null, vdot_raw: v.vdotRaw ?? null, discount_pct: v.vdot === undefined ? null : v.discountPct,
    effective_start_km: effectiveStartKm(input),
    weeks_plan: Number.isFinite(w) ? w : null,
    weeks_display: weeksUntilRaceSigned(input.race_date, at),
  }
}

function profileAnswers(input: GeneratorInput, planStart: string, at: Date) {
  const p = buildRunnerProfile(factsFromInput(input), { asOf: at, timezone: null, planStart })
  return {
    declared: p.levels.declared?.value ?? null,
    assessed_structural: p.levels.assessed_structural.value,
    assessed_intensity: p.levels.assessed_intensity.value,
    structural: p.levels.structural.value,
    intensity: p.levels.intensity.value,
    api_override: p.levels.api_override?.value ?? null,
    vdot: p.vdot?.value.value ?? null, vdot_raw: p.vdot?.value.raw ?? null, discount_pct: p.vdot?.value.discount_pct ?? null,
    effective_start_km: p.volume.effective_start_km.value,
    weeks_plan: p.weeks_to_race.plan,
    weeks_display: p.weeks_to_race.display,
  }
}

describe('ADR027-B2-PROFILE (a) — every derived field equals its current owner', () => {
  it('the populations are real', () => {
    expect(GOLDEN.length).toBeGreaterThan(500)
    expect(COHORT.length).toBe(600)
    // The sample must actually reach the branches the owners have: a benchmark (VDOT + §10 ramp), a
    // declaration, an injury, a blocked day.
    const all = [...GOLDEN, ...COHORT].map(r => r.input)
    expect(all.filter(i => i.benchmark?.benchmark_date).length).toBeGreaterThan(50)
    expect(all.filter(i => i.user_declared_level).length).toBeGreaterThan(50)
    expect(all.filter(i => (i.days_cannot_train ?? []).length > 0).length).toBeGreaterThan(50)
    expect(new Set(all.map(i => i.training_age)).size).toBeGreaterThanOrEqual(3)
  })

  it('golden corpus + strided cohortGrid: profile === owners, field by field', () => {
    const bad: string[] = []
    for (const r of [...GOLDEN, ...COHORT]) {
      const want = ownerAnswers(r.input, r.planStart, AT)
      const got = profileAnswers(r.input, r.planStart, AT)
      for (const k of Object.keys(want) as (keyof typeof want)[]) {
        if (!Object.is(want[k], got[k])) bad.push(`${r.id} ${k}: owner=${want[k]} profile=${got[k]}`)
      }
    }
    expect(bad.slice(0, 20)).toEqual([])
  })

  it('stated facts are the request, unchanged and labelled stated', () => {
    for (const r of GOLDEN.slice(0, 200)) {
      const p = buildRunnerProfile(factsFromInput(r.input), { asOf: AT, timezone: null, planStart: r.planStart })
      expect(p.volume.declared_weekly_km).toEqual({ value: r.input.current_weekly_km, source: 'stated' })
      expect(p.volume.longest_recent_run_km).toEqual({ value: r.input.longest_recent_run_km, source: 'stated' })
      expect(p.schedule.days_available).toEqual({ value: r.input.days_available, source: 'stated' })
      expect(p.race.date).toBe(r.input.race_date)
      expect(p.plan_start).toBe(r.planStart)
    }
  })

  it('🔴 runEngine refusal telemetry reads the profile and still equals the owners (parity cannot see telemetry)', () => {
    // `verify:parity` hashes the refusal BODY, not its telemetry, so this is the only check that the
    // telemetry runEngine computes from the profile is what it computed before. Hand-built to refuse
    // early and cheaply: §44 prep time and §52 days, with and without a dated benchmark.
    const base: GeneratorInput = {
      race_date: '2026-05-10', race_distance_km: 42.2, goal: 'finish', current_weekly_km: 40,
      longest_recent_run_km: 16, days_available: 4, age: 41, training_age: '2-5yr',
    }
    const cases: GeneratorInput[] = [
      base,
      { ...base, user_declared_level: 'experienced', benchmark: { type: 'race', distance_km: 10, time: '48:00', benchmark_date: formatDate(addDays(new Date(), -80)) } },
      { ...base, race_distance_km: 21.1, days_available: 1, user_declared_level: 'beginner' },
      { ...base, race_distance_km: 21.1, days_available: 1, fitness_level: 'intermediate', benchmark: { type: 'race', distance_km: 5, time: '24:00' } },
    ]
    let refused = 0
    for (const input of cases) {
      const out = runEngine({ input, tier: 'paid', planStart: COHORT_PLAN_START, today: COHORT_PLAN_START, displayUnits: 'km' })
      expect(out.kind).toBe('refusal')
      if (out.kind !== 'refusal' || !out.telemetry || out.telemetry.event !== 'plan_refused_by_design') continue
      refused++
      const now = new Date()
      const l = derivedLevelsFor(input, now)
      const d = out.telemetry.detail
      expect(d.effective_start_km).toBe(Math.round(effectiveStartKm(input) * 10) / 10)
      expect(d.fitness_level_declared).toBe(l.declared ?? null)
      expect(d.fitness_level_assessed).toBe(l.assessedStructural)
      expect(d.fitness_level_structural).toBe(l.structural)
      expect(d.fitness_level_intensity).toBe(l.intensity)
      expect(d.fitness_level_api_override).toBe(input.fitness_level ?? null)
      expect(d.weeks_to_race).toBe(weeksUntilRaceSigned(input.race_date, now))
    }
    expect(refused).toBe(cases.length)
  })
})

describe('ADR027-B2-PROFILE (b) — as_of determinism (ARCH-ENG-005)', () => {
  afterEach(() => { vi.useRealTimers() })
  const dated: GeneratorInput = {
    race_date: '2027-04-18', race_distance_km: 21.1, goal: 'time_target', target_time: '1:55:00',
    current_weekly_km: 30, longest_recent_run_km: 14, days_available: 4, age: 38, training_age: '2-5yr',
    benchmark: { type: 'race', distance_km: 10, time: '52:00', benchmark_date: formatDate(addDays(AT, -14)) },
    max_weekday_mins: 50, days_cannot_train: ['tuesday'],
  }

  it('reads no wall clock: the same as_of under two different system times is deep-equal', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2020, 0, 1))
    const a = buildRunnerProfile(factsFromInput(dated), { asOf: AT, timezone: null, planStart: '2026-11-23' })
    vi.setSystemTime(new Date(2031, 6, 9))
    const b = buildRunnerProfile(factsFromInput(dated), { asOf: AT, timezone: null, planStart: '2026-11-23' })
    expect(b).toEqual(a)
  })

  it('a different as_of moves only the date-dependent fields', () => {
    const a = buildRunnerProfile(factsFromInput(dated), { asOf: AT, timezone: null, planStart: '2026-11-23' })
    const later = new Date(2027, 1, 20, 12)
    const b = buildRunnerProfile(factsFromInput(dated), { asOf: later, timezone: null, planStart: '2026-11-23' })
    const diffs: string[] = []
    const walk = (x: unknown, y: unknown, path: string) => {
      if (x && y && typeof x === 'object' && typeof y === 'object') {
        for (const k of Array.from(new Set(Object.keys(x).concat(Object.keys(y))))) walk((x as any)[k], (y as any)[k], path ? `${path}.${k}` : k)
      } else if (!Object.is(x, y)) diffs.push(path)
    }
    walk(a, b, '')
    // Non-vacuous: the ramp really moved between the two dates.
    expect(diffs).toContain('vdot.value.discount_pct')
    const ALLOWED = /^(as_of|weeks_to_race\.display|vdot\.value\.(value|discount_pct)|levels\.(assessed_structural|assessed_intensity|structural|intensity)\.value|schedule\.capacity\.value\.(easy_min_per_km|days\.\w+\.max_km))$/
    expect(diffs.filter(p => !ALLOWED.test(p))).toEqual([])
  })

  it('an ISO as_of is that date, and the default plan start is the Monday after it', () => {
    const p = buildRunnerProfile(factsFromInput(dated), { asOf: '2026-11-18', timezone: null })
    expect(p.as_of).toBe('2026-11-18')
    expect(p.plan_start).toBe('2026-11-23')
  })
})

describe('ADR027-B2-PROFILE (c) — absence is null, never a default', () => {
  const bare: GeneratorInput = {
    race_date: '2027-04-18', race_distance_km: 10, goal: 'finish',
    current_weekly_km: 20, longest_recent_run_km: 8, days_available: 3,
  }
  const SETTINGS: SettingsFacts = { birth_year: null, date_of_birth: null, resting_hr: null, max_hr: null, max_hr_source: null, timezone: null }
  const withSettings = (s: Partial<SettingsFacts>, input: GeneratorInput = bare): RunnerFacts =>
    ({ facts_version: 1, input, settings: { ...SETTINGS, ...s }, observed: null })

  it('no age, no max HR, no resting HR, no benchmark → null; the observed block is unavailable and empty', () => {
    const p = buildRunnerProfile(factsFromInput(bare), { asOf: AT, timezone: null, planStart: '2026-11-23' })
    expect(p.physiology.age).toBeNull()
    expect(p.physiology.max_hr).toBeNull()
    expect(p.physiology.resting_hr).toBeNull()
    expect(p.vdot).toBeNull()
    expect(p.levels.declared).toBeNull()
    expect(p.observed.available).toBe(false)
    const { available: _a, ...rest } = p.observed
    expect(Object.values(rest).every(v => v === null)).toBe(true)
    expect(p.data_quality).toEqual({ nulled: [], excluded_log_rows: 0 })
  })

  it('one age owner: birth_year beats date_of_birth beats the posted age', () => {
    const at = { asOf: '2026-11-16', timezone: null, planStart: '2026-11-23' } as const
    expect(buildRunnerProfile(withSettings({ birth_year: 1980, date_of_birth: '1970-01-01' }, { ...bare, age: 30 }), at).physiology.age)
      .toEqual({ value: 46, source: 'confirmed' })
    expect(buildRunnerProfile(withSettings({ date_of_birth: '1980-12-01' }, { ...bare, age: 30 }), at).physiology.age)
      .toEqual({ value: 45, source: 'confirmed' }) // birthday not yet reached on 2026-11-16
    expect(buildRunnerProfile(withSettings({}, { ...bare, age: 30 }), at).physiology.age)
      .toEqual({ value: 30, source: 'stated' })
  })

  it('an out-of-range stored value is nulled, named, and the next source is used', () => {
    const p = buildRunnerProfile(withSettings({ resting_hr: 0, max_hr: 400, max_hr_source: 'observed' }, { ...bare, resting_hr: 52, max_hr: 188 }),
      { asOf: AT, timezone: null, planStart: '2026-11-23' })
    expect(p.physiology.resting_hr).toEqual({ value: 52, source: 'stated' })
    expect(p.physiology.max_hr).toEqual({ value: 188, source: 'stated' })
    expect(p.data_quality.nulled).toEqual(['settings.resting_hr', 'settings.max_hr'])
  })

  it('settings max HR carries its own source; a stored value outranks the posted one', () => {
    const p = buildRunnerProfile(withSettings({ max_hr: 191, max_hr_source: 'user_confirmed' }, { ...bare, max_hr: 180 }),
      { asOf: AT, timezone: null, planStart: '2026-11-23' })
    expect(p.physiology.max_hr).toEqual({ value: 191, source: 'confirmed' })
  })

  it('a benchmark vdotFor would crash on is treated as absent and named, not thrown', () => {
    const broken = { ...bare, benchmark: { type: 'race', distance_km: 5 } as unknown as GeneratorInput['benchmark'] }
    expect(() => vdotFor(broken)).toThrow()
    const p = buildRunnerProfile(factsFromInput(broken), { asOf: AT, timezone: null, planStart: '2026-11-23' })
    expect(p.vdot).toBeNull()
    expect(p.data_quality.nulled).toContain('input.benchmark')
  })

  it('weekly capacity: minutes from the caps, km at the easy pace, weekends uncapped', () => {
    const p = buildRunnerProfile(factsFromInput({ ...bare, max_weekday_mins: 40, day_budgets: { wed: 60 }, days_cannot_train: ['monday', 'sat'] }),
      { asOf: AT, timezone: null, planStart: '2026-11-23' })
    const c = p.schedule.capacity.value
    expect(c.days.mon).toMatchObject({ available: false, max_minutes: 40 })
    expect(c.days.wed.max_minutes).toBe(60)
    expect(c.days.wed.max_km).toBe(Math.round((60 / c.easy_min_per_km) * 10) / 10)
    expect(c.days.sun).toMatchObject({ available: true, max_minutes: null, max_km: null })
    expect(c.available_days).toBe(5)
    expect(c.total_minutes).toBeNull() // Sunday is available and uncapped
  })
})

describe('ADR027-B2-PROFILE — as_of resolves in the runner’s timezone (ARCH-ENG-019)', () => {
  const nearMidnightUtc = new Date(Date.UTC(2026, 10, 16, 23, 30))
  it('a real zone is trusted and moves the date', () => {
    expect(resolveAsOf(nearMidnightUtc, 'Pacific/Auckland')).toEqual({ as_of: '2026-11-17', timezone: 'Pacific/Auckland', timezone_known: true })
    expect(resolveAsOf(nearMidnightUtc, 'America/Los_Angeles').as_of).toBe('2026-11-16')
  })
  it('unset, UTC-default and invalid zones are unknown, never trusted', () => {
    for (const tz of [null, '', 'UTC', 'Etc/UTC', 'GMT', 'Not/AZone']) {
      expect(resolveAsOf(nearMidnightUtc, tz).timezone_known).toBe(false)
      expect(resolveAsOf(nearMidnightUtc, tz).timezone).toBeNull()
    }
  })
})

// ─── (d) purity ────────────────────────────────────────────────────────────────────────────────
const ROOT = process.cwd()
const FORBIDDEN = [/from\s+['"]next\//, /from\s+['"]react['"]/, /from\s+['"]@\/app\//, /from\s+['"]@\/components\//, /from\s+['"]@supabase\//]
const stripComments = (src: string) => src
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length))

function resolveLocal(fromFile: string, spec: string): string | null {
  const base = spec.startsWith('@/') ? join(ROOT, spec.slice(2)) : spec.startsWith('.') ? resolve(dirname(fromFile), spec) : null
  if (!base) return null
  for (const c of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) if (existsSync(c)) return relative(ROOT, c)
  return null
}
function importClosure(entry: string): string[] {
  const seen = new Set<string>(); const q = [entry]
  while (q.length) {
    const f = q.pop()!
    if (seen.has(f)) continue
    seen.add(f)
    const src = stripComments(readFileSync(join(ROOT, f), 'utf8'))
    for (const m of Array.from(src.matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g))) {
      const r = resolveLocal(join(ROOT, f), m[1]); if (r && !seen.has(r)) q.push(r)
    }
  }
  return Array.from(seen).sort()
}
const forbiddenIn = (src: string) => FORBIDDEN.filter(p => p.test(stripComments(src))).map(String)
/** A clock read: `new Date()` with no argument, or `Date.now()`. */
const clockReadsIn = (src: string) => (stripComments(src).match(/new Date\(\s*\)|Date\.now\(/g) ?? []).length

describe('ADR027-B2-PROFILE (d) — L1 is pure', () => {
  const closure = importClosure('lib/engine/profile/buildRunnerProfile.ts')

  it('the closure is real (it reaches the owners it delegates to)', () => {
    expect(closure).toEqual(expect.arrayContaining([
      'lib/plan/ruleEngine.ts', 'lib/plan/startVolume.ts', 'lib/plan/fitnessAssessment.ts', 'lib/format.ts', 'lib/engine/profile/validity.ts',
    ]))
    expect(closure.length).toBeGreaterThan(30)
  })

  it('the matcher fires on a real import and ignores prose', () => {
    expect(forbiddenIn("import { createClient } from '@supabase/supabase-js'").length).toBe(1)
    expect(forbiddenIn("// not from '@supabase/supabase-js'").length).toBe(0)
    expect(clockReadsIn('const t = new Date()')).toBe(1)
    expect(clockReadsIn('const t = new Date(x)')).toBe(0)
  })

  it('🔴 nothing L1 reaches imports next, react, the app, components or supabase', () => {
    const hits = closure.filter(f => forbiddenIn(readFileSync(join(ROOT, f), 'utf8')).length)
    expect(hits).toEqual([])
  })

  it('🔴 no L1 file reads the clock (the owners it calls keep their wall-clock DEFAULTS, which L1 always overrides)', () => {
    const dir = 'lib/engine/profile'
    const files = readdirSync(join(ROOT, dir)).filter(f => f.endsWith('.ts') && !f.includes('.test.')).map(f => `${dir}/${f}`)
    expect(files.length).toBeGreaterThanOrEqual(4)
    expect(files.filter(f => clockReadsIn(readFileSync(join(ROOT, f), 'utf8')) > 0)).toEqual([])
  })
})
