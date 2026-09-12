// PAID — GET /api/race-times
// Returns estimated race times derived from the best available signal:
//   State 1 — benchmark in plan meta (highest quality)
//   State 2 — ≥4 qualifying aerobic Strava runs (moderate confidence)
//   State 3 — 1–3 qualifying aerobic Strava runs (low confidence)
//   State 4 — wizard fitness_level + training_age bracket (low confidence, no Strava)
//   State 5 — no signal (null — prompt to add benchmark)
//
// Distances: 5K, 10K, HM, Marathon
// Auth: Supabase session required. Feature gate: race_time_estimates (PAID_ONLY_ONGOING).

import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { getUserTier } from '@/lib/trial'
import { isFeatureAllowed } from '@/lib/plan/canUseFeature'
import { velocityAtFraction, applyVdotDiscount, parseBenchmarkTime, calcVDOT } from '@/lib/plan/ruleEngine'
import { vdotFromAerobicSpeedMs } from '@/lib/plan/aerobicEstimate'
import type { Plan, BenchmarkInput } from '@/types/plan'
import { createUserScopedClient } from '@/lib/supabase/userScopedClient'
import { RACE_ARC } from '@/lib/coaching/raceProgressArc'
import {
  deriveFitnessBaseline, weightedAerobicSpeed, type AerobicRun,
} from '@/lib/coaching/fitnessBaseline'
import { formatClockTime, formatElapsedDelta } from '@/lib/format'

// Jack Daniels race VDOT utilisation fractions
const RACE_FRACTIONS: { label: string; distanceKm: number; fraction: number }[] = [
  { label: '5K',       distanceKm: 5,       fraction: 0.961 },
  { label: '10K',      distanceKm: 10,      fraction: 0.922 },
  { label: 'HM',       distanceKm: 21.0975, fraction: 0.842 },
  { label: 'Marathon', distanceKm: 42.195,  fraction: 0.792 },
]

// Daniels VDOT is validated only up to marathon distance.
// Beyond this, fatigue, terrain, and pacing strategy dominate — extrapolation is misleading.
const VDOT_MAX_DISTANCE_KM = 42.195

// Strava qualifying aerobic run window (weeks)
const STRAVA_WINDOW_WEEKS = 6
// High-confidence run count threshold
const HIGH_CONFIDENCE_MIN_RUNS = 4

function projectRaceTimes(vdot: number) {
  return RACE_FRACTIONS.map(({ label, distanceKm, fraction }) => {
    const velocityMperMin = velocityAtFraction(vdot, fraction)
    const timeMinutes     = (distanceKm * 1000) / velocityMperMin
    const timeSeconds     = Math.round(timeMinutes * 60)
    return { distanceKm, label, timeSeconds, formattedTime: formatClockTime(timeSeconds) ?? '\u2014' }
  })
}

// Find the RACE_FRACTIONS entry closest to the athlete's actual race distance.
// Used to project a target-race-specific estimate + baseline delta (R31).
function closestStandardRace(distanceKm: number) {
  return RACE_FRACTIONS.reduce((best, r) =>
    Math.abs(r.distanceKm - distanceKm) < Math.abs(best.distanceKm - distanceKm) ? r : best
  )
}

// Returns null for ultra distances — VDOT doesn't extrapolate reliably beyond marathon.
function projectForDistance(vdot: number, distanceKm: number): number | null {
  if (distanceKm > VDOT_MAX_DISTANCE_KM) return null
  const { fraction } = closestStandardRace(distanceKm)
  const velocityMperMin = velocityAtFraction(vdot, fraction)
  const timeSeconds     = Math.round((distanceKm * 1000) / velocityMperMin * 60)
  return timeSeconds
}

// Build the R31 target object: projected time for the athlete's specific race
// distance, compared against the plan-creation VDOT baseline.
// Returns ultraDistance:true for distances beyond marathon — VDOT doesn't apply there.
/** The arc's own distance, label and points — see `buildTarget`. */
interface TargetArc {
  /** Distance the arc is projected at. Differs from the race for an ultra. */
  distanceKm:      number
  /** Set only when the arc is NOT at the race distance, e.g. 'Marathon'. */
  atLabel:         string | null
  baselineSeconds: number | null
  /** What the baseline point is called: 'Plan start', or a month for a
   *  derived one. Never "plan start" for a derived baseline — the earliest
   *  run data can begin long after the plan did. */
  baselineLabel:   string
  currentSeconds:  number
  goalSeconds:     number | null
}

function buildTarget(
  currentVdot:    number,
  planRaceDistKm: number,
  planRaceName:   string,
  baselineVdot:   number | null,
  goalSeconds:    number | null,
  baselineLabel:  string = 'Plan start',
): {
  distanceKm:      number
  raceName:        string
  ultraDistance:   boolean
  currentSeconds:  number | null
  baselineSeconds: number | null
  goalSeconds:     number | null
  deltaSeconds:    number | null
  deltaFormatted:  string | null
  improved:        boolean | null
  arc:             TargetArc | null
} {
  const currentSeconds = projectForDistance(currentVdot, planRaceDistKm)

  // Ultra distance — VDOT extrapolation breaks down beyond marathon.
  // Return a marker so the UI can show an honest note instead of a misleading time.
  if (currentSeconds === null) {
    return {
      distanceKm:      planRaceDistKm,
      raceName:        planRaceName,
      ultraDistance:   true,
      currentSeconds:  null,
      baselineSeconds: null,
      goalSeconds:     null,
      deltaSeconds:    null,
      deltaFormatted:  null,
      improved:        null,
      // ⚠️ NOT null. VDOT cannot project 100 km and must not pretend to, but
      // the runner's aerobic fitness is perfectly measurable and the card
      // ALREADY prints their marathon row. Refusing the race-distance time and
      // refusing the trajectory are two different refusals, and only the first
      // is honest. The arc falls back to the nearest projectable standard
      // distance and says so.
      arc: buildArc(currentVdot, planRaceDistKm, baselineVdot, null, baselineLabel),
    }
  }

  const baselineSeconds = baselineVdot ? projectForDistance(baselineVdot, planRaceDistKm) : null
  const deltaSeconds    = baselineSeconds !== null ? baselineSeconds - currentSeconds : null
  const significant     = deltaSeconds !== null && Math.abs(deltaSeconds) >= RACE_ARC.SIGNIFICANT_DELTA_SEC

  return {
    distanceKm:      planRaceDistKm,
    raceName:        planRaceName,
    ultraDistance:   false,
    currentSeconds,
    baselineSeconds,
    goalSeconds,
    deltaSeconds:    significant ? deltaSeconds : null,
    deltaFormatted:  significant ? formatElapsedDelta(deltaSeconds!) : null,
    improved:        significant ? deltaSeconds! > 0 : null,
    arc:             buildArc(currentVdot, planRaceDistKm, baselineVdot, goalSeconds, baselineLabel),
  }
}

/**
 * The arc's three points, at a distance VDOT can actually project.
 *
 * For a marathon or shorter that is the race distance itself. Beyond it, VDOT
 * extrapolation breaks down (§44.1 — the engine cannot defend the number), so
 * the arc drops to the nearest standard distance and LABELS it. A 100 km runner
 * still gets to see that their aerobic fitness moved; they just do not get a
 * fabricated 100 km finish time.
 *
 * `goalSeconds` is passed through only when the arc is at the race distance —
 * a runner's marathon goal is not their target for a 100 km race, and showing
 * it against a different distance would compare two unrelated numbers.
 */
function buildArc(
  currentVdot:   number,
  raceDistKm:    number,
  baselineVdot:  number | null,
  goalSeconds:   number | null,
  baselineLabel: string,
): TargetArc | null {
  const isUltra = raceDistKm > VDOT_MAX_DISTANCE_KM
  const standard = closestStandardRace(raceDistKm)
  const distanceKm = isUltra ? standard.distanceKm : raceDistKm

  const currentSeconds = projectForDistance(currentVdot, distanceKm)
  if (currentSeconds === null) return null   // no present, no arc

  return {
    distanceKm,
    atLabel:         isUltra ? standard.label : null,
    baselineSeconds: baselineVdot ? projectForDistance(baselineVdot, distanceKm) : null,
    baselineLabel,
    currentSeconds,
    goalSeconds:     isUltra ? null : goalSeconds,
  }
}

// State 4 bracket: fitness_level × training_age → estimated VDOT midpoint, then −5% conservative discount
function bracketVdot(fitnessLevel: string | undefined, trainingAge: string | undefined): number | null {
  const table: Record<string, Record<string, number>> = {
    beginner:     { '<6mo': 32, '6-18mo': 35, '2-5yr': 37, '5yr+': 37 },
    intermediate: { '<6mo': 38, '6-18mo': 42, '2-5yr': 45, '5yr+': 48 },
    experienced:  { '<6mo': 45, '6-18mo': 48, '2-5yr': 52, '5yr+': 56 },
  }
  const fl  = fitnessLevel ?? 'intermediate'
  const ta  = trainingAge  ?? '6-18mo'
  const row = table[fl]
  if (!row) return null
  const midpoint = row[ta] ?? row['6-18mo']
  return midpoint * 0.95
}

// vdotFromAerobicSpeedMs now lives in lib/plan/aerobicEstimate (single owner,
// shared with the FREE wizard benchmark estimate) — imported above.

const VO2_DIVERGENCE_FLAG_PCT = 10

interface VO2CrossCheck {
  healthKitVO2Max:    number
  vdotDerivedVO2Max:  number
  divergencePct:      number
  flagged:            boolean
}

async function computeVO2CrossCheck(
  supabase: any,
  userId: string,
  vdot: number,
): Promise<VO2CrossCheck | null> {
  try {
    const { data } = await supabase
      .from('health_daily_samples')
      .select('vo2_max, sample_date')
      .eq('user_id', userId)
      .not('vo2_max', 'is', null)
      .order('sample_date', { ascending: false })
      .limit(1)
      .maybeSingle()
    const hkVO2: number | null = (data as any)?.vo2_max ?? null
    if (!hkVO2 || hkVO2 <= 0) return null
    const vdotVO2     = vdot * 0.65
    const divergence  = Math.abs(hkVO2 - vdotVO2) / vdotVO2 * 100
    return {
      healthKitVO2Max:   parseFloat(hkVO2.toFixed(1)),
      vdotDerivedVO2Max: parseFloat(vdotVO2.toFixed(1)),
      divergencePct:     parseFloat(divergence.toFixed(1)),
      flagged:           divergence > VO2_DIVERGENCE_FLAG_PCT,
    }
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tier = await getUserTier(user.id)
  if (!isFeatureAllowed('race_time_estimates', tier)) {
    return NextResponse.json({ error: 'Subscription required' }, { status: 403 })
  }

  // SEC-08 — user-scoped (JWT) client, not the service role. Queries run as the
  // user, so RLS backstops the .eq(user_id) filters below instead of the filter
  // being the only thing between one runner's data and another's. Every table
  // touched here is covered by a policy: verified against production and
  // enforced on every build by `lib/supabase/rlsCoverage.test.ts`.
  const serviceSupabase = createUserScopedClient(req)
  if (!serviceSupabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Load plan
  const { data: planRow } = await serviceSupabase
    .from('plans')
    .select('plan_json')
    .eq('user_id', user.id)
    .single()

  const plan = planRow?.plan_json as Plan | null
  if (!plan) return NextResponse.json({ error: 'No plan found' }, { status: 404 })

  const meta = plan.meta
  const today = new Date()

  // Plan age in weeks — needed for R32 recalibration trigger (minimum 4 weeks)
  const planAgeWeeks = meta.plan_start
    ? Math.floor((today.getTime() - new Date(meta.plan_start).getTime()) / (7 * 24 * 60 * 60 * 1000))
    : 0

  // Baseline VDOT — the raw VDOT stored at plan generation time.
  // Used to compute the R31 improvement delta. May be absent on legacy plans
  // generated before R23 added meta.vdot.
  const baselineVdot: number | null = meta.vdot ?? null
  const raceDistKm  = meta.race_distance_km ?? 0
  const raceName    = meta.race_name ?? 'Your race'

  // UX-COACH-01 — the third point of the arc. The runner's OWN chosen time,
  // which they typed into the wizard: §109 lets this surface remember and
  // compare, never predict. A goal is a decision, not a prediction.
  // Only a `time_target` plan has one; a finish-goal plan legitimately has no
  // third point and the arc renders two. `parseBenchmarkTime` is the existing
  // owner of "plan time string -> minutes" (it already parses `target_time` for
  // `calcGoalPace`), so this is not a second parser.
  const goalMins = meta.goal === 'time_target' && meta.target_time
    ? parseBenchmarkTime(meta.target_time)
    : NaN
  const goalSeconds: number | null =
    Number.isFinite(goalMins) && goalMins > 0 ? Math.round(goalMins * 60) : null

  // ── State 1: benchmark in plan meta ─────────────────────────────────────
  if (meta.vdot && meta.benchmark) {
    const { vdot: discountedVdot, discountPct } = applyVdotDiscount(meta.vdot, meta.benchmark as BenchmarkInput, today)
    // Cross-check: recalculate raw VDOT from benchmark for freshness calculation
    const benchmarkMins = parseBenchmarkTime((meta.benchmark as BenchmarkInput).time)
    const rawVdot       = calcVDOT((meta.benchmark as BenchmarkInput).distance_km, benchmarkMins)

    // HealthKit VO2-max sanity check. Compare the latest Watch-derived VO2 max
    // against the VDOT-derived estimate (VO2max ≈ VDOT × 0.65). >10% divergence
    // is a flag for review — same person, two methods, two answers means one
    // of them is stale (benchmark old, or Watch estimate noisy). Field exposed
    // on the response; UI surface lands when R18 confidence score ships.
    const vo2MaxCrossCheck = await computeVO2CrossCheck(serviceSupabase, user.id, discountedVdot)

    // 🔴 NO BASELINE POINT HERE, AND THAT IS THE FIX (2026-09-12).
    //
    // This used to pass `baselineVdot` (= raw `meta.vdot`) against
    // `discountedVdot` as the present, described in the old comment as
    // "pre-discount for fair comparison". It is the opposite of fair:
    // `applyVdotDiscount` ALWAYS discounts — 5% minimum, growing every 4 weeks
    // the benchmark ages — so the present was arithmetically guaranteed to be
    // slower than the past. State 1 is "the benchmark stored in plan meta", so
    // both ends are the SAME MEASUREMENT, one of them aged. Every benchmark
    // runner who had not re-tested was being told they had got slower, by a
    // margin that grew the longer they left it.
    //
    // Survivable as a small delta chip; not survivable as the hero arc. One
    // measurement is one point. A second point needs a second measurement —
    // which is exactly what the runs-derived baseline below provides in states
    // 2/3, and what re-benchmarking provides here.
    const target = raceDistKm > 0
      ? buildTarget(discountedVdot, raceDistKm, raceName, null, goalSeconds)
      : null

    // R32: recalibration signal — benchmark is already high-quality, suggest recal if
    // the current (discounted) VDOT meaningfully exceeds the plan-creation baseline
    const recalibrationSuggested = !!(
      baselineVdot &&
      discountedVdot > baselineVdot + 3 &&
      planAgeWeeks >= 4
    )

    return NextResponse.json({
      state:      1,
      confidence: 'high' as const,
      label:      'From your benchmark',
      source:     'benchmark',
      vdot:       parseFloat(discountedVdot.toFixed(1)),
      discountPct,
      distances:  projectRaceTimes(discountedVdot),
      target,
      recalibrationSuggested,
      vo2MaxCrossCheck,
      upgradeCtaType: null,
    })
  }

  // ── States 2/3: qualifying aerobic runs ──────────────────────────────────
  //
  // ⚠️ The window is now a YEAR, not six weeks, and the six-week cut happens in
  // memory below. The route needs BOTH ends of the arc: the current estimate
  // (last six weeks) and, when the plan carries no benchmark, a derived
  // baseline from the runner's earliest runs. Measured 2026-09-12: 10 of 17
  // live plans have no `meta.vdot`, so "where I was" could never render for
  // them — the arc shipped able to fully draw on 2 of 17.
  //
  // Source-agnostic by column, per ADR-011: `strava_activities` is the run log
  // and `activity_type` is 'Run' for both HealthKit and Strava rows (verified
  // in production). No `source` filter here, deliberately.
  const windowStart = new Date(today)
  windowStart.setDate(windowStart.getDate() - STRAVA_WINDOW_WEEKS * 7)
  const historyStart = new Date(today)
  historyStart.setFullYear(historyStart.getFullYear() - 1)

  const { data: stravaRuns } = await serviceSupabase
    .from('strava_activities')
    .select('avg_speed, avg_hr, distance_m, start_date, hr_above_ceiling_pct')
    .eq('user_id', user.id)
    .eq('activity_type', 'Run')
    .gte('start_date', historyStart.toISOString())
    .not('avg_speed', 'is', null)
    .not('avg_hr',    'is', null)
    .or('hr_above_ceiling_pct.is.null,hr_above_ceiling_pct.lt.25')  // Z2-ish: ceiling exceeded <25% of time
    .order('start_date', { ascending: false })

  const z2Ceiling = meta.zone2_ceiling ?? (meta.resting_hr + 0.70 * (meta.max_hr - meta.resting_hr))
  const z2Floor   = meta.resting_hr + 0.60 * (meta.max_hr - meta.resting_hr)

  const aerobicRuns = (stravaRuns ?? []).filter(
    (r) =>
      r.avg_hr >= z2Floor &&
      r.avg_hr <= z2Ceiling &&
      r.distance_m >= 3000  // at least 3km for a meaningful aerobic sample
  )

  // The current estimate keeps its original six-week window byte for byte —
  // this change must not move anyone's projected times, only add a past point.
  const qualifyingRuns = aerobicRuns.filter(r => new Date(r.start_date) >= windowStart)

  // "Where I was", when no benchmark was ever taken. §109 permits it: working
  // out what fitness WAS, from runs actually done then, is remembering.
  const historyForBaseline: AerobicRun[] = aerobicRuns.map(r => ({
    startDate:  new Date(r.start_date),
    avgSpeedMs: r.avg_speed,
    distanceM:  r.distance_m,
  }))
  const derived = baselineVdot === null
    ? deriveFitnessBaseline(historyForBaseline, windowStart)
    : null
  const derivedVdotBaseline = derived
    ? vdotFromAerobicSpeedMs(derived.weightedSpeedMs)
    : null
  const usableDerivedBaseline =
    derivedVdotBaseline !== null && Number.isFinite(derivedVdotBaseline)
    && derivedVdotBaseline >= 20 && derivedVdotBaseline <= 85
      ? derivedVdotBaseline
      : null

  if (qualifyingRuns.length >= 1) {
    // `weightedAerobicSpeed` is the single owner of this formula — the baseline
    // derivation needs the identical arithmetic, and two copies of a weighting
    // formula agree only until one of them is edited.
    const weightedSpeed = weightedAerobicSpeed(qualifyingRuns.map(r => ({
      startDate:  new Date(r.start_date),
      avgSpeedMs: r.avg_speed,
      distanceM:  r.distance_m,
    })))
    const derivedVdot   = weightedSpeed === null ? NaN : vdotFromAerobicSpeedMs(weightedSpeed)

    if (!Number.isFinite(derivedVdot) || derivedVdot < 20 || derivedVdot > 85) {
      // VDOT out of plausible range — fall through to State 4
    } else {
      const runCount  = qualifyingRuns.length
      const state     = runCount >= HIGH_CONFIDENCE_MIN_RUNS ? 2 : 3
      const confidence = runCount >= HIGH_CONFIDENCE_MIN_RUNS ? 'moderate' : 'low'
      const label = runCount >= HIGH_CONFIDENCE_MIN_RUNS
        ? 'From your aerobic runs'
        : `From ${runCount} aerobic run${runCount > 1 ? 's' : ''} — add more to improve accuracy`

      // R31: target race delta
      const target = raceDistKm > 0
        ? buildTarget(
            derivedVdot, raceDistKm, raceName,
            baselineVdot ?? usableDerivedBaseline,
            goalSeconds,
            baselineVdot !== null ? 'Plan start' : (derived?.label ?? 'Plan start'),
          )
        : null

      // R32: suggest recalibration if Strava-derived VDOT beats plan baseline by ≥3 points
      const recalibrationSuggested = !!(
        baselineVdot &&
        derivedVdot > baselineVdot + 3 &&
        planAgeWeeks >= 4 &&
        runCount >= 3  // need at least 3 runs for a reliable signal
      )

      return NextResponse.json({
        state,
        confidence,
        label,
        source:     'strava',
        vdot:       parseFloat(derivedVdot.toFixed(1)),
        discountPct: 0,
        distances:  projectRaceTimes(derivedVdot),
        target,
        recalibrationSuggested,
        stravaQualifyingRunCount: runCount,
        upgradeCtaType: 'benchmark',  // prompt to add a benchmark for higher confidence
      })
    }
  }

  // ── State 4: wizard bracket — no R31/R32 (static estimate, can't show improvement)
  const bracketV = bracketVdot(meta.fitness_level, meta.training_age)
  if (bracketV !== null) {
    return NextResponse.json({
      state:       4,
      confidence:  'low' as const,
      label:       'Rough estimate — add a benchmark or connect Strava for accuracy',
      source:      'wizard',
      vdot:        parseFloat(bracketV.toFixed(1)),
      discountPct:  5,
      distances:   projectRaceTimes(bracketV),
      target:      null,   // no baseline comparison on bracket estimate
      recalibrationSuggested: false,
      upgradeCtaType: 'both',  // both benchmark and Strava improve this
    })
  }

  // ── State 5: no signal ───────────────────────────────────────────────────
  return NextResponse.json({
    state:                 5,
    confidence:            null,
    label:                 null,
    source:                'none',
    distances:             null,
    target:                null,
    recalibrationSuggested: false,
    upgradeCtaType:        'both',
  })
}
