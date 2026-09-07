import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { mainSetMinutes } from './sessionFormat'
import { GENERATION_CONFIG } from './generationConfig'
import { V1_SESSION_CATALOGUE } from './sessionCatalogueData'
import type { GeneratorInput, Session } from '@/types/plan'

// WORK minutes (Z4-5 time) of a v2 VO2max session: resolved reps × the work
// step's length, distance reps via the session's I-pace band. Mirrors the
// invariant helper so the test asserts the real quantity, not a proxy.
function workMinutes(s: Session): number {
  const reps = (s.derived_set as { blocks?: { repeat?: number }[] } | undefined)?.blocks?.[0]?.repeat ?? 0
  const row = V1_SESSION_CATALOGUE.find(r => r.id === s.catalogue_id)
  const len = (row?.main_set_structure as { blocks?: { steps?: { role?: string; length?: { kind?: string; secs?: number; m?: number } }[] }[] } | undefined)
    ?.blocks?.[0]?.steps?.find(st => st.role === 'work')?.length
  if (!len) return 0
  if (len.kind === 'duration' && len.secs) return reps * (len.secs / 60)
  if (len.kind === 'distance' && len.m) {
    const m = (s.pace_target ?? '').match(/(\d+):(\d+)\D+(\d+):(\d+)/)
    if (!m) return 0
    const mid = ((+m[1] + +m[2] / 60) + (+m[3] + +m[4] / 60)) / 2
    return reps * (len.m / 1000) * mid
  }
  return 0
}

/**
 * SC-10 / CD-14 — VO2max main-set absolute ceiling (Coaching Board 2026-08-21).
 * The flat 18% share sized VO2max at a share of weekly volume, so the hardest
 * session GREW into peak (measured p50 25 min). VO2max is the least sustainable
 * work per minute, so its main set is now capped in absolute minutes
 * (VO2MAX_MAIN_SET_MAX_MINS), decoupled from weekly volume; freed distance
 * redistributes to easy running (volume preserved). Applies to paced flat
 * intervals only — effort-governed hills/hikes are lower impact (SC-09).
 */

const FROZEN_NOW = new Date('2026-08-20T09:00:00Z')
const PLAN_START = '2026-09-07'

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FROZEN_NOW) })
afterAll(() => { vi.useRealTimers() })

function quality(plan: ReturnType<typeof generateRulePlan>): { week: number; phase: string; s: Session }[] {
  return plan.weeks.flatMap(w =>
    Object.values(w.sessions)
      .filter((s): s is Session => !!s && s.type === 'quality')
      .map(s => ({ week: w.n, phase: String(w.phase ?? ''), s })))
}

// 10K time-target on high volume → real flat VO2max in peak, previously oversized.
const TENK_HIGH: GeneratorInput = {
  race_date: '2026-11-29', race_distance_km: 10, goal: 'time_target', target_time: '0:40:00',
  days_available: 5, age: 35, current_weekly_km: 70, longest_recent_run_km: 24,
  resting_hr: 45, max_hr: 190, preferred_long_run_day: 'sun',
}

describe('SC-10 — VO2max main-set ceiling', () => {
  // SC-08 reworked the SC-10 ceiling from main-set minutes to WORK minutes (time
  // at Z4-5), because full recovery lives inside the v2 main set. These two tests
  // now assert the work-minute band.
  it('every paced VO2max session sits inside the WORK dose band, even on high volume', () => {
    const plan = generateRulePlan(TENK_HIGH, 'paid', PLAN_START)
    const paced = quality(plan).filter(q => q.s.stimulus === 'vo2max' && q.s.pace_target)
    expect(paced.length).toBeGreaterThan(0)
    const tol = GENERATION_CONFIG.MAIN_SET_ORDERING_TOLERANCE_MINS
    for (const q of paced) {
      const work = workMinutes(q.s)
      expect(work, `W${q.week} "${q.s.label}"`).toBeGreaterThanOrEqual(GENERATION_CONFIG.VO2MAX_WORK_MIN_MINS - tol)
      expect(work, `W${q.week} "${q.s.label}"`).toBeLessThanOrEqual(GENERATION_CONFIG.VO2MAX_WORK_MAX_MINS + tol)
    }
  })

  it('the dose does not exceed the WORK ceiling in the LOADING phases — the biggest weeks (Willy)', () => {
    // Scope widened from `phase === 'peak'` to build+peak on 2026-09-07 (§93),
    // and the reason matters more than the change.
    //
    // Willy's condition is about the ceiling holding where sessions grow
    // biggest, which is the loading phases. It was expressed as "peak" because,
    // before §93, 10K peak was VO2max in EVERY week by construction. §93 makes
    // peak's VO2max count proportional to the phase length, so a two-week peak
    // now carries a single exposure — and that exposure can legitimately be
    // `hill_reps`, which is effort-governed and which SC-09 exempts from this
    // ceiling BY DESIGN ("effort-governed hills are priced at easy pace, so this
    // leaves them longer — deliberately").
    //
    // Left as `phase === 'peak'`, the filter returned zero rows and the
    // assertion below would have guarded nothing while still reading green.
    // A test that stops reaching its subject is worse than a deleted one.
    const plan = generateRulePlan(TENK_HIGH, 'paid', PLAN_START)
    const loadingVo2 = quality(plan).filter(q =>
      (q.phase === 'build' || q.phase === 'peak') && q.s.stimulus === 'vo2max' && q.s.pace_target)
    expect(loadingVo2.length, 'the ceiling must have something to bind on').toBeGreaterThan(0)
    for (const q of loadingVo2) {
      expect(workMinutes(q.s), `W${q.week} "${q.s.label}"`)
        .toBeLessThanOrEqual(GENERATION_CONFIG.VO2MAX_WORK_MAX_MINS + 1)
    }
  })

  it('§93 — peak never fills every week with VO2max, and never leaves a time goal unrehearsed', () => {
    // The defect §93 closed: `preferredQualityCategory` returned 'vo2max' for
    // EVERY 10K peak week. Measured on the founder's live input once §91 grew
    // peak to five weeks — five consecutive VO2max sessions for a 44-year-old,
    // and zero race-pace work before the taper on a plan whose whole job was
    // closing a 4:54 -> 4:30 /km gap.
    const plan = generateRulePlan(TENK_HIGH, 'paid', PLAN_START)
    const peak = quality(plan).filter(q => q.phase === 'peak')
    const vo2 = peak.filter(q => q.s.stimulus === 'vo2max')
    const specific = peak.filter(q => q.s.stimulus === 'race_pace')

    expect(vo2.length, 'peak VO2max is capped')
      .toBeLessThanOrEqual(GENERATION_CONFIG.PEAK_MAX_VO2MAX_SESSIONS)
    expect(specific.length, 'a time-targeted peak rehearses goal pace').toBeGreaterThan(0)

    // §93's other arm: no week may fill both quality slots from one category —
    // 10K owns a single `race_specific` row, so that shipped the SAME session
    // twice in one week.
    for (const w of plan.weeks) {
      const ids = Object.values(w.sessions)
        .filter(s => s?.type === 'quality')
        .map(s => s!.catalogue_id)
        .filter(Boolean)
      expect(new Set(ids).size, `W${w.n} repeats a catalogue row within the week`).toBe(ids.length)
    }
  })

  it('the plan validates — the cap invariant is clean', () => {
    const plan = generateRulePlan(TENK_HIGH, 'paid', PLAN_START)
    const v = validatePlan(plan, TENK_HIGH).filter(x => x.code === 'INV-PLAN-VO2MAX-MAIN-SET-CAP')
    expect(v).toEqual([])
  })

  it('INV-PLAN-VO2MAX-MAIN-SET-CAP fires on a hand-built over-ceiling VO2max session', () => {
    // A 60-minute Classic VO2max = ~40-min main set, over the 20-min ceiling.
    const plan = generateRulePlan(TENK_HIGH, 'paid', PLAN_START)
    const wk = plan.weeks.find(w => w.phase === 'peak')!
    const day = Object.keys(wk.sessions)[0] as keyof typeof wk.sessions
    ;(wk.sessions as Record<string, Session>)[day] = {
      type: 'quality', label: 'Classic VO2max', detail: null, stimulus: 'vo2max',
      duration_mins: 60, zone: 'Zone 4–5', pace_target: '3:40–3:50 /km',
    } as Session
    const v = validatePlan(plan, TENK_HIGH).filter(x => x.code === 'INV-PLAN-VO2MAX-MAIN-SET-CAP')
    expect(v.length).toBeGreaterThan(0)
  })

  it('effort-governed hills/hikes are NOT capped (lower impact, SC-09)', () => {
    // A 50k finish plan carries effort-governed vert_hike_repeats; those can be
    // long (time on feet) and must not be flagged by the ceiling or its invariant.
    const ultra: GeneratorInput = {
      race_date: '2027-01-25', race_distance_km: 50, goal: 'finish', days_available: 5,
      age: 42, current_weekly_km: 60, longest_recent_run_km: 28, resting_hr: 48, max_hr: 184,
      preferred_long_run_day: 'sun', fitness_level: 'experienced',
    }
    const plan = generateRulePlan(ultra, 'paid', PLAN_START)
    // no cap violation despite long effort-governed sessions
    const v = validatePlan(plan, ultra).filter(x => x.code === 'INV-PLAN-VO2MAX-MAIN-SET-CAP')
    expect(v).toEqual([])
    // and the effort-governed session (no pace_target) is allowed to be long
    const hike = quality(plan).find(q => !q.s.pace_target && (q.s.catalogue_id === 'vert_hike_repeats'))
    if (hike) expect(mainSetMinutes(hike.s.duration_mins ?? 0)).toBeGreaterThan(GENERATION_CONFIG.VO2MAX_MAIN_SET_MAX_MINS)
  })
})
