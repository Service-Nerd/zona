import type { BenchmarkInput } from '@/types/plan'
import { calcVDOT, parseBenchmarkTime } from './vdot'

// BENCHMARK-IMPOSSIBLE-01 (Coaching Board, 2026-10-16) — §55 extended to the benchmark.
//
// 🔴 WHY. Nothing checked that a benchmark was humanly possible. A runner entered
// "5:04" as a 5K finish time (it was their PACE), the engine computed VDOT 253.7, and
// every pace in their marathon plan was priced off it. Measured on 2026-10-16: 2 of 36
// live plans carried a VDOT above any human's (253.7 and 182.6); the next highest was
// 48.4. The gap is that wide, which is why one ceiling serves every distance.
//
// ⚖️ ONE VDOT CEILING, NOT PER-DISTANCE TIMES (Hutchinson). VDOT already normalises
// across distances, which is its whole purpose. The men's world records measure
// 85.3 (5K 12:35), 85.5 (10K 26:11), 85.6 (half 57:30), 85.5 (marathon 2:00:35), so 85
// refuses nothing a real runner has run. Sex-neutral by construction (Sims): it sits far
// above every women's record.
//
// ⚠️ A PHYSIOLOGICAL BOUNDARY, NOT A COACHING KNOB, so it lives beside §55's other
// bounds rather than in `GENERATION_CONFIG` — §55's own text places them there. It is
// in this module rather than `inputs.ts` only because the CLIENT runs the same check
// (the wizard and Update Paces disable submit on it), and `inputs.ts` is not a client
// module. `validateInputFields` and `/api/recalibrate-zones` both call it: ONE owner.

/** Above any VDOT a human has run. World records measure 85.3–85.6. */
export const BENCHMARK_VDOT_MAX = 85

export type BenchmarkProblem = 'too_fast_race' | 'too_fast_tt' | 'date_in_future'

/**
 * What the runner is told. Founder-approved for the race case (2026-10-16). No em
 * dashes: runner-facing sentences (`noEmDashApp.test.ts`).
 */
export const BENCHMARK_PROBLEM_COPY: Record<BenchmarkProblem, string> = {
  too_fast_race:  'Bit quick for a human. Enter your finish time.',
  too_fast_tt:    'Bit quick for a human. Check the distance you covered.',
  date_in_future: "That date hasn't happened yet.",
}

/** Today as a local `YYYY-MM-DD`, so an ISO date string compares lexically. */
function localIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** The raw (undiscounted) VDOT a benchmark implies, or null when it cannot be read. */
export function benchmarkVdot(b: Pick<BenchmarkInput, 'distance_km' | 'time'>): number | null {
  const v = calcVDOT(b.distance_km, parseBenchmarkTime(b.time))
  return Number.isFinite(v) && v > 0 ? v : null
}

/**
 * Null when the benchmark is plausible. An unreadable benchmark is NOT a problem here:
 * the shape checks that already exist own that, and the engine already ignores a
 * non-finite VDOT (`vdotFor`).
 */
export function benchmarkProblem(
  b: Pick<BenchmarkInput, 'type' | 'distance_km' | 'time' | 'benchmark_date'>,
  today: Date = new Date(),
): BenchmarkProblem | null {
  const vdot = benchmarkVdot(b)
  if (vdot !== null && vdot > BENCHMARK_VDOT_MAX) {
    return b.type === 'tt_30min' ? 'too_fast_tt' : 'too_fast_race'
  }
  // Willy: a future date is not a benchmark. Lexical compare is safe on YYYY-MM-DD.
  if (b.benchmark_date && b.benchmark_date.slice(0, 10) > localIsoDate(today)) {
    return 'date_in_future'
  }
  return null
}

/** The benchmark distances a runner can pick. One list, for every screen that asks. */
export const BENCHMARK_DISTANCES = [
  { label: '5K',   value: 5    },
  { label: '10K',  value: 10   },
  { label: 'Half', value: 21.1 },
  { label: 'Full', value: 42.2 },
] as const

/** What a benchmark form holds, before it is a benchmark. */
export interface BenchmarkFieldValues {
  type: 'race' | 'tt_30min' | null
  distKm: number | null
  hours: number
  mins: number
  secs: number
  /** The runner's own string, so `7.1` is never rounded to `7`. */
  ttDistKm: string
  /** ISO `YYYY-MM-DD`, or '' when not given. */
  date: string
}

/**
 * BENCHMARK-INPUT-01 — THE ONE builder of a `BenchmarkInput` from form values. Both
 * the wizard and Update Paces wrote this out by hand, and they had drifted: the
 * wizard dropped a seconds-only time (`hours > 0 || mins > 0`) that its own submit
 * gate accepted. Null means "not a complete benchmark yet".
 */
export function benchmarkFromFields(v: BenchmarkFieldValues): BenchmarkInput | null {
  const date = v.date ? { benchmark_date: v.date } : {}
  if (v.type === 'race') {
    if (!v.distKm || (v.hours <= 0 && v.mins <= 0 && v.secs <= 0)) return null
    const time = `${v.hours}:${String(v.mins).padStart(2, '0')}:${String(v.secs).padStart(2, '0')}`
    return { type: 'race', distance_km: v.distKm, time, ...date }
  }
  if (v.type === 'tt_30min') {
    const km = Number(v.ttDistKm)
    if (v.ttDistKm.trim() === '' || !Number.isFinite(km) || km <= 0) return null
    return { type: 'tt_30min', distance_km: km, time: '30:00', ...date }
  }
  return null
}
