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
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getUserTier } from '@/lib/trial'
import { isFeatureAllowed } from '@/lib/plan/canUseFeature'
import { velocityAtFraction, applyVdotDiscount, parseBenchmarkTime, calcVDOT } from '@/lib/plan/ruleEngine'
import type { Plan, BenchmarkInput } from '@/types/plan'

// Jack Daniels race VDOT utilisation fractions
const RACE_FRACTIONS: { label: string; distanceKm: number; fraction: number }[] = [
  { label: '5K',       distanceKm: 5,       fraction: 0.961 },
  { label: '10K',      distanceKm: 10,      fraction: 0.922 },
  { label: 'HM',       distanceKm: 21.0975, fraction: 0.842 },
  { label: 'Marathon', distanceKm: 42.195,  fraction: 0.792 },
]

// Strava qualifying aerobic run window (weeks)
const STRAVA_WINDOW_WEEKS = 6
// High-confidence run count threshold
const HIGH_CONFIDENCE_MIN_RUNS = 4

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = Math.round(totalSeconds % 60)
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

function projectRaceTimes(vdot: number) {
  return RACE_FRACTIONS.map(({ label, distanceKm, fraction }) => {
    const velocityMperMin = velocityAtFraction(vdot, fraction)
    const timeMinutes     = (distanceKm * 1000) / velocityMperMin
    const timeSeconds     = Math.round(timeMinutes * 60)
    return { distanceKm, label, timeSeconds, formattedTime: formatTime(timeSeconds) }
  })
}

// Find the RACE_FRACTIONS entry closest to the athlete's actual race distance.
// Used to project a target-race-specific estimate + baseline delta (R31).
function closestStandardRace(distanceKm: number) {
  return RACE_FRACTIONS.reduce((best, r) =>
    Math.abs(r.distanceKm - distanceKm) < Math.abs(best.distanceKm - distanceKm) ? r : best
  )
}

function projectForDistance(vdot: number, distanceKm: number): number {
  const { fraction } = closestStandardRace(distanceKm)
  const velocityMperMin = velocityAtFraction(vdot, fraction)
  const timeSeconds     = Math.round((distanceKm * 1000) / velocityMperMin * 60)
  return timeSeconds
}

function formatDelta(deltaSeconds: number): string {
  const abs = Math.abs(deltaSeconds)
  const m   = Math.floor(abs / 60)
  const s   = Math.round(abs % 60)
  if (m > 0 && s > 0) return `${m}m ${s}s`
  if (m > 0)          return `${m}m`
  return `${s}s`
}

// Build the R31 target object: projected time for the athlete's specific race
// distance, compared against the plan-creation VDOT baseline.
// Returns null when baseline is unavailable (plan generated before R23 added meta.vdot).
function buildTarget(
  currentVdot:   number,
  planRaceDistKm: number,
  planRaceName:   string,
  baselineVdot:   number | null,
): {
  distanceKm:     number
  raceName:       string
  currentSeconds: number
  baselineSeconds: number | null
  deltaSeconds:   number | null
  deltaFormatted: string | null
  improved:       boolean | null
} {
  const currentSeconds  = projectForDistance(currentVdot, planRaceDistKm)
  const baselineSeconds = baselineVdot ? projectForDistance(baselineVdot, planRaceDistKm) : null
  const deltaSeconds    = baselineSeconds !== null ? baselineSeconds - currentSeconds : null
  const significant     = deltaSeconds !== null && Math.abs(deltaSeconds) >= 30

  return {
    distanceKm:     planRaceDistKm,
    raceName:       planRaceName,
    currentSeconds,
    baselineSeconds,
    deltaSeconds:   significant ? deltaSeconds : null,
    deltaFormatted: significant ? formatDelta(deltaSeconds!) : null,
    improved:       significant ? deltaSeconds! > 0 : null,
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

// Derive VDOT from an average aerobic (Z2) speed in m/s
// Z2 ≈ 65% VO2max (Karvonen Z2 band): vo2 = -4.60 + 0.182258*v + 0.000104*v²; VDOT = vo2 / 0.65
function vdotFromAerobicSpeedMs(avgSpeedMs: number): number {
  const v   = avgSpeedMs * 60  // m/s → m/min
  const vo2 = -4.60 + 0.182258 * v + 0.000104 * v * v
  return vo2 / 0.65
}

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

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

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

    // R31: target race delta (baseline VDOT = plan.meta.vdot pre-discount for fair comparison)
    const target = raceDistKm > 0
      ? buildTarget(discountedVdot, raceDistKm, raceName, baselineVdot)
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

  // ── States 2/3: qualifying aerobic Strava runs ───────────────────────────
  const windowStart = new Date(today)
  windowStart.setDate(windowStart.getDate() - STRAVA_WINDOW_WEEKS * 7)

  const { data: stravaRuns } = await serviceSupabase
    .from('strava_activities')
    .select('avg_speed, avg_hr, distance_m, start_date, hr_above_ceiling_pct')
    .eq('user_id', user.id)
    .eq('activity_type', 'Run')
    .gte('start_date', windowStart.toISOString())
    .not('avg_speed', 'is', null)
    .not('avg_hr',    'is', null)
    .or('hr_above_ceiling_pct.is.null,hr_above_ceiling_pct.lt.25')  // Z2-ish: ceiling exceeded <25% of time
    .order('start_date', { ascending: false })

  const z2Ceiling = meta.zone2_ceiling ?? (meta.resting_hr + 0.70 * (meta.max_hr - meta.resting_hr))
  const z2Floor   = meta.resting_hr + 0.60 * (meta.max_hr - meta.resting_hr)

  const qualifyingRuns = (stravaRuns ?? []).filter(
    (r) =>
      r.avg_hr >= z2Floor &&
      r.avg_hr <= z2Ceiling &&
      r.distance_m >= 3000  // at least 3km for a meaningful aerobic sample
  )

  if (qualifyingRuns.length >= 1) {
    // Average aerobic speed across qualifying runs (weighted by distance for robustness)
    const totalDistM  = qualifyingRuns.reduce((s, r) => s + r.distance_m, 0)
    // Weighted mean speed: Σ(speed_i * distance_i) / Σ(distance_i)
    const weightedSpeed = qualifyingRuns.reduce((s, r) => s + r.avg_speed * r.distance_m, 0) / totalDistM
    const derivedVdot   = vdotFromAerobicSpeedMs(weightedSpeed)

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
        ? buildTarget(derivedVdot, raceDistKm, raceName, baselineVdot)
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
