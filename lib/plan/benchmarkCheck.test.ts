import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  BENCHMARK_VDOT_MAX, BENCHMARK_PROBLEM_COPY, benchmarkProblem, benchmarkVdot, benchmarkFromFields,
  type BenchmarkFieldValues,
} from './benchmarkCheck'
import { assertPlausibleBenchmark, validateInputFields, InputFieldError } from './inputs'
import { calcVDOT, parseBenchmarkTime } from './ruleEngine'
import { calcVDOT as calcVDOTPure } from './vdot'
import { formatBenchmarkReadback } from '@/lib/format'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { PINNED_PLAN_START } from './__fixtures__/pinnedPlanStart'
import type { GeneratorInput, BenchmarkInput } from '@/types/plan'

/**
 * BENCHMARK-IMPOSSIBLE-01 (§55 Amendment 1) + BENCHMARK-INPUT-01 (Design Board), 2026-10-16.
 *
 * 🔴 THE DEFECT. A runner typed "5:04", their PACE, as a 5K finish time. The engine
 * computed VDOT 253.7 and priced every pace in a marathon plan off it. Nothing checked a
 * benchmark was humanly possible, and the field showed nothing that disagreed. Measured
 * that day: 2 of 36 live plans carried an impossible VDOT (253.7, 182.6).
 */

const today = new Date(2026, 9, 16) // 2026-10-16, local

const race = (km: number, time: string, benchmark_date?: string): BenchmarkInput =>
  ({ type: 'race', distance_km: km, time, ...(benchmark_date ? { benchmark_date } : {}) })
const tt = (km: number): BenchmarkInput => ({ type: 'tt_30min', distance_km: km, time: '30:00' })

describe('the ceiling sits just under the world records', () => {
  it('every world record measures above 85, and so is refused', () => {
    // The ruling's evidence, recomputed rather than quoted.
    for (const [km, t] of [[5, '12:35'], [10, '26:11'], [21.0975, '57:30'], [42.195, '2:00:35']] as const) {
      expect(benchmarkVdot(race(km, t))!, `${km} km in ${t}`).toBeGreaterThan(BENCHMARK_VDOT_MAX)
      expect(benchmarkProblem(race(km, t), today)).toBe('too_fast_race')
    }
  })

  it('an elite-but-real amateur time is accepted (sub-15 5K, sub-2:30 marathon)', () => {
    expect(benchmarkProblem(race(5, '14:59'), today)).toBeNull()
    expect(benchmarkProblem(race(42.2, '2:29:00'), today)).toBeNull()
  })
})

describe('🔴 the live values are refused', () => {
  it('a 5K "in 5:04" (a pace typed as a finish time)', () => {
    expect(benchmarkVdot(race(5, '0:05:04'))!).toBeCloseTo(253.7, 1)
    expect(benchmarkProblem(race(5, '0:05:04'), today)).toBe('too_fast_race')
  })
  it('a 10K "in 14:00"', () => {
    expect(benchmarkProblem(race(10, '0:14:00'), today)).toBe('too_fast_race')
  })
  it('an ordinary runner is untouched', () => {
    expect(benchmarkProblem(race(5, '25:20'), today)).toBeNull()
    expect(benchmarkProblem(race(42.2, '4:30:00'), today)).toBeNull()
  })
})

describe('the 30-minute time trial', () => {
  it('a real distance is accepted; an impossible one is refused with the TT sentence', () => {
    expect(benchmarkProblem(tt(5.4), today)).toBeNull()
    expect(benchmarkProblem(tt(9.4), today)).toBeNull()
    expect(benchmarkProblem(tt(15), today)).toBe('too_fast_tt')
  })
})

describe('the run date (Willy: a future date is not a benchmark)', () => {
  it('today and the past are fine; tomorrow is refused', () => {
    expect(benchmarkProblem(race(5, '25:20', '2026-10-16'), today)).toBeNull()
    expect(benchmarkProblem(race(5, '25:20', '2025-04-01'), today)).toBeNull()
    expect(benchmarkProblem(race(5, '25:20', '2026-10-17'), today)).toBe('date_in_future')
  })
  it('blank still means fresh (unchanged behaviour)', () => {
    expect(benchmarkProblem(race(5, '25:20'), today)).toBeNull()
  })
})

describe('ONE gate, at generation and at recalibration', () => {
  const OK: GeneratorInput = {
    race_date: '2027-04-25', race_distance_km: 42.2, goal: 'finish',
    days_available: 4, age: 35, current_weekly_km: 25, longest_recent_run_km: 10,
  } as GeneratorInput

  it('validateInputFields refuses the live benchmark, naming the field and the sentence', () => {
    let caught: unknown
    try { validateInputFields({ ...OK, benchmark: race(5, '0:05:04') }) } catch (e) { caught = e }
    expect(caught).toBeInstanceOf(InputFieldError)
    expect((caught as InputFieldError).field).toBe('benchmark_time')
    expect((caught as InputFieldError).message).toBe(BENCHMARK_PROBLEM_COPY.too_fast_race)
  })

  it('and accepts a real one', () => {
    expect(() => validateInputFields({ ...OK, benchmark: race(5, '25:20') })).not.toThrow()
  })

  it('assertPlausibleBenchmark names the TT and date fields too', () => {
    const field = (b: BenchmarkInput) => {
      try { assertPlausibleBenchmark(b, today); return null } catch (e) { return (e as InputFieldError).field }
    }
    expect(field(tt(15))).toBe('benchmark_tt_distance')
    expect(field(race(5, '25:20', '2027-01-01'))).toBe('benchmark_date')
    expect(field(race(5, '25:20'))).toBeNull()
  })
})

describe('the move kept one formula', () => {
  it('ruleEngine re-exports the pure module, not a copy', () => {
    expect(calcVDOT).toBe(calcVDOTPure)
    expect(parseBenchmarkTime('1:52:10')).toBeCloseTo(112 + 10 / 60, 6)
  })
})

describe('benchmarkFromFields — the one builder both screens use', () => {
  const base: BenchmarkFieldValues = { type: null, distKm: null, hours: 0, mins: 0, secs: 0, ttDistKm: '', date: '' }

  it('nothing chosen, or incomplete, is null', () => {
    expect(benchmarkFromFields(base)).toBeNull()
    expect(benchmarkFromFields({ ...base, type: 'race', distKm: 5 })).toBeNull()
    expect(benchmarkFromFields({ ...base, type: 'tt_30min', ttDistKm: '  ' })).toBeNull()
  })

  it('🔴 keeps the runner\'s seconds, including a seconds-only time the wizard used to drop', () => {
    expect(benchmarkFromFields({ ...base, type: 'race', distKm: 5, mins: 25, secs: 20 })?.time).toBe('0:25:20')
    expect(benchmarkFromFields({ ...base, type: 'race', distKm: 5, secs: 59 })?.time).toBe('0:00:59')
  })

  it('🔴 7.1 is 7.1, not 7', () => {
    expect(benchmarkFromFields({ ...base, type: 'tt_30min', ttDistKm: '7.1' })?.distance_km).toBe(7.1)
  })

  it('carries the run date when given, and only then', () => {
    expect(benchmarkFromFields({ ...base, type: 'tt_30min', ttDistKm: '6', date: '2026-09-01' })?.benchmark_date).toBe('2026-09-01')
    expect(benchmarkFromFields({ ...base, type: 'tt_30min', ttDistKm: '6' })).not.toHaveProperty('benchmark_date')
  })
})

describe('the readback shows the decision, not the keystrokes', () => {
  it('race: time and the pace it implies', () => {
    expect(formatBenchmarkReadback({ kind: 'race', distanceLabel: '5K', distanceKm: 5, totalSeconds: 25 * 60 + 20 })).toBe('5K in 25:20 · 5:04/km')
    expect(formatBenchmarkReadback({ kind: 'race', distanceLabel: 'Half', distanceKm: 21.1, totalSeconds: 7930 })).toBe('Half in 2:12:10 · 6:16/km')
  })
  it('🔴 the live typo reads obviously wrong', () => {
    expect(formatBenchmarkReadback({ kind: 'race', distanceLabel: '5K', distanceKm: 5, totalSeconds: 304 })).toBe('5K in 5:04 · 1:01/km')
  })
  it('TT: the runner\'s own decimals, and the pace', () => {
    expect(formatBenchmarkReadback({ kind: 'tt', distanceKmText: '5.4' })).toBe('5.4 km in 30 min · 5:33/km')
    expect(formatBenchmarkReadback({ kind: 'tt', distanceKmText: '7.1' })).toMatch(/^7\.1 km in 30 min/)
  })
  it('respects the runner\'s units for pace', () => {
    expect(formatBenchmarkReadback({ kind: 'race', distanceLabel: '5K', distanceKm: 5, totalSeconds: 25 * 60 + 20 }, 'mi')).toMatch(/\/mi$/)
  })
  it('empty renders nothing', () => {
    expect(formatBenchmarkReadback({ kind: 'race', distanceLabel: '5K', distanceKm: 5, totalSeconds: 0 })).toBeNull()
    expect(formatBenchmarkReadback({ kind: 'tt', distanceKmText: '' })).toBeNull()
    expect(formatBenchmarkReadback({ kind: 'tt', distanceKmText: 'abc' })).toBeNull()
  })
})

describe('INV-PLAN-VDOT-PLAUSIBLE — the backstop for any path that skips the gate', () => {
  const input: GeneratorInput = {
    race_date: '2027-03-21', race_distance_km: 21.1, goal: 'finish',
    days_available: 4, age: 35, current_weekly_km: 30, longest_recent_run_km: 12,
    benchmark: race(10, '55:00'),
  } as GeneratorInput

  it('a real plan is clean; the same plan with the live VDOT is an error', () => {
    const plan = generateRulePlan(input, 'paid', PINNED_PLAN_START)
    expect(validatePlan(plan, input).map(v => v.code)).not.toContain('INV-PLAN-VDOT-PLAUSIBLE')
    const broken = JSON.parse(JSON.stringify(plan))
    broken.meta.vdot = 253.7
    const v = validatePlan(broken, input).find(x => x.code === 'INV-PLAN-VDOT-PLAUSIBLE')
    expect(v?.severity).toBe('error')
  })
})

// ── The recalibration route, run for real with its I/O mocked ─────────────────

const { fetchPlanForUser } = vi.hoisted(() => ({ fetchPlanForUser: vi.fn() }))
vi.mock('@/lib/supabase/getUserFromRequest', () => ({ getUserFromRequest: vi.fn(async () => ({ id: 'u1' })) }))
vi.mock('@/lib/trial', () => ({ getUserTier: vi.fn(async () => 'paid') }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: null }) }) }) }) }),
}))
vi.mock('@/lib/plan', () => ({
  fetchPlanForUser: (...a: unknown[]) => fetchPlanForUser(...a),
  savePlanForUser: vi.fn(), getCurrentWeek: vi.fn(),
}))
beforeEach(() => { fetchPlanForUser.mockReset(); fetchPlanForUser.mockResolvedValue({ weeks: [] }) })

describe('/api/recalibrate-zones refuses an impossible benchmark before touching the plan', () => {
  const call = async (benchmark: unknown) => {
    const { POST } = await import('@/app/api/recalibrate-zones/route')
    return POST(new Request('http://x/api/recalibrate-zones', { method: 'POST', body: JSON.stringify({ benchmark }) }) as never)
  }

  it('🔴 422 with the runner-facing sentence, and the plan is never read', async () => {
    const res = await call(race(5, '0:05:04'))
    expect(res.status).toBe(422)
    expect((await res.json()).error).toBe(BENCHMARK_PROBLEM_COPY.too_fast_race)
    expect(fetchPlanForUser).not.toHaveBeenCalled()
  })

  it('a real benchmark passes the gate (and reaches the plan read)', async () => {
    const res = await call(race(5, '25:20'))
    expect(fetchPlanForUser).toHaveBeenCalled()
    expect(res.status).toBe(404) // the mock has no plan — past the gate is all this proves
  })
})

// ── Both screens use the ONE component (bounded, comment-stripped source) ────

const strip = (f: string) => readFileSync(f, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n')

describe('BENCHMARK-INPUT-01 — one benchmark entry, two screens', () => {
  for (const f of ['app/dashboard/GeneratePlanScreen.tsx', 'app/dashboard/BenchmarkUpdateScreen.tsx']) {
    it(`${f} renders <BenchmarkFields> and keeps no copy of its parts`, () => {
      const src = strip(f)
      expect(src).toMatch(/<BenchmarkFields\b/)
      expect(src, 'a local distance list is how the two drifted').not.toMatch(/const\s+BENCHMARK_DISTANCES\s*=/)
      expect(src).not.toMatch(/function\s+FieldLabel\s*\(/)
      expect(src, 'the screen builds its benchmark by hand again').not.toMatch(/type:\s*'tt_30min'\s*(as const)?\s*,\s*distance_km/)
      expect(src, 'submit must refuse what the server refuses').toMatch(/benchmarkProblem\(/)
    })
  }

  it('🔴 the TT distance opens the DECIMAL keyboard (iOS numeric has no point, so 7.1 was untypeable)', () => {
    const src = strip('components/shared/BenchmarkFields.tsx')
    const tt = src.slice(src.indexOf("values.type === 'tt_30min' && ("))
    const field = tt.slice(tt.indexOf('<TextField'), tt.indexOf('/>', tt.indexOf('<TextField')))
    expect(field).toMatch(/inputMode="decimal"/)
    expect(field).toMatch(/unit="km"/)
  })
})
