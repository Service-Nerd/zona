/**
 * Limiter hypothesis — picks ONE most-likely physiological cause per session.
 *
 * Doctrine: this is the "what was the limiter?" question that elite coaches
 * ask after every run — and that Kit currently doesn't. We're describing what
 * happened ("HR ran hot"); we're not naming WHY ("aerobic ceiling pushed
 * before muscular endurance gave"). A limiter sentence makes the difference
 * between a dashboard and a coach.
 *
 * Source-tiered like the reframe: degrades from full HR+stream+temp+RPE down
 * to RPE+fatigue-only for manual loggers. Returns null when no signal is
 * strong enough to defend a claim — "no signal" is different from "low signal".
 *
 * The output is consumed by the AI prompts (sessionFeedback, sessionReframe)
 * as an OPTIONAL evidence block; Kit is instructed to cite the named limiter
 * when present and confidence is medium or high, otherwise ignore.
 *
 * All thresholds live in lib/coaching/constants.ts → LIMITER per the
 * Configuration Singularity doctrine (no magic numbers in coaching code).
 */

import { LIMITER, FATIGUE_HIGH_TAGS } from './constants'
import type { HrStreamSummary } from './streamAnalysis'
import type { PaceFadeSummary } from './paceAnalysis'

/**
 * Physiological cause categories. Mutually exclusive — the classifier picks
 * the single most-likely one. Order matters: heat is checked first because
 * it can explain away other signals that would otherwise misfire (a hot HR
 * in 28°C is not the same finding as a hot HR in 14°C).
 */
export type LimiterCategory =
  | 'heat'        // Temperature drove HR above what the runner can hold
  | 'recovery'    // Cumulative fatigue / recent hard days — body wasn't reset
  | 'aerobic'     // Late-run cardiac drift WITH stable pace — engine pushed before legs
  | 'muscular'    // Late-run pace fade WITHOUT proportional HR rise — legs went before lungs
  | 'pacing'      // Started too hot, paid in the second half
  | 'execution'   // On a hard session, didn't commit — drifted below the band
  | 'fueling'     // Long run cut short with high RPE — likely glycogen/intake
  | 'fatigue_tag' // Lowest-tier fallback — only self-reported fatigue available

/** How confident the rule engine is in the hypothesis. Drives prompt emphasis. */
export type LimiterConfidence = 'high' | 'medium' | 'low'

export interface LimiterHypothesis {
  category:   LimiterCategory
  confidence: LimiterConfidence
  /** Human-readable evidence string — surfaced to the prompt as "because…" */
  reasoning:  string
}

export interface LimiterInputs {
  sessionType:            string
  actualAvgHr:            number | null
  prescribedHrCeiling:    number | null
  hrAboveCeilingPct:      number | null
  hrBelowFloorPct:        number | null
  streamSummary:          HrStreamSummary | null
  paceFadeSummary:        PaceFadeSummary | null
  tempC:                  number | null
  rpe:                    number | null
  fatigueTag:             string | null
  /** Count of Heavy/Wrecked/Cooked tags in the last 5 logged sessions. */
  recentHighFatigueCount: number
  actualDistKm:           number | null
  plannedDistKm:          number | null
  /** True when the runner reported an acute injury/incident during the effort
   *  (e.g. `Week.result_embedded.what_broke`). The device signal cannot see an
   *  injury-driven fade; the athlete's account outranks the classifier here, so
   *  the limiter stays silent rather than mis-attributing the fade. Wired from
   *  the race narrative in RACE-DEBRIEF-02; optional until then. §71.3. */
  injuryFlagged?:         boolean
}

const EASY_TYPES = new Set(['easy', 'recovery', 'long', 'run'])
// 'hard' added GEN-FIX-04: the §78 recalibration time trial is a maximal
// effort and must be read as one by the limiter.
const HARD_TYPES = new Set(['quality', 'tempo', 'intervals', 'threshold', 'hard'])

/**
 * Picks the single most-defensible limiter hypothesis, or null.
 *
 * Evaluation order:
 *  1. Heat — checked first because it explains away pacing/aerobic findings
 *  2. Recovery — high-fatigue accumulation + high RPE on an easy day
 *  3. Aerobic — late-run HR drift on any session type
 *  4. Pacing — sustained HR above ceiling on easy/long/recovery
 *  5. Execution — sustained HR below floor on a hard session
 *  6. Fueling — long run cut short with high RPE
 *  7. Fatigue tag — lowest-confidence fallback for manual-only loggers
 *
 * Returns null when nothing crosses a defensible threshold.
 */
export function inferLimiter(inputs: LimiterInputs): LimiterHypothesis | null {
  // ── 0. SILENCE GUARDS (§71.3) ──────────────────────────────────────────
  // A confident wrong diagnosis is worse than no diagnosis. The limiter stays
  // silent — returns null, no hypothesis surfaced — when it cannot defensibly
  // read the cause:
  //  • a race is run at race effort, not held in a zone — the classifier's
  //    zone/pace/HR heuristics don't apply (§70.2, §71.1);
  //  • ultra-distance fade is expected physiology, not a limiter;
  //  • an athlete-reported injury outranks any device signal — attributing an
  //    injury-driven fade to "running out of gas" destroys credibility.
  if (
    inputs.sessionType === 'race'
    || inputs.injuryFlagged === true
    || (inputs.actualDistKm != null && inputs.actualDistKm >= LIMITER.SUPPRESS_ULTRA_DISTANCE_KM)
  ) {
    return null
  }

  // ── 1. HEAT ────────────────────────────────────────────────────────────
  if (
    inputs.tempC != null
    && inputs.tempC >= LIMITER.HEAT_C_THRESHOLD
    && inputs.actualAvgHr != null
    && inputs.prescribedHrCeiling != null
    && inputs.actualAvgHr > inputs.prescribedHrCeiling + LIMITER.HEAT_BPM_OVER_CEILING
  ) {
    const bpmOver = inputs.actualAvgHr - inputs.prescribedHrCeiling
    return {
      category:   'heat',
      confidence: 'high',
      reasoning:  `${inputs.tempC.toFixed(0)}°C with avg HR ${bpmOver}bpm above the ceiling`,
    }
  }

  // ── 2. RECOVERY (high confidence — accumulation pattern) ───────────────
  if (
    inputs.recentHighFatigueCount >= LIMITER.RECOVERY_HIGH_FATIGUE_COUNT
    && inputs.rpe != null
    && inputs.rpe >= LIMITER.RECOVERY_EASY_RPE_FLOOR
    && EASY_TYPES.has(inputs.sessionType)
  ) {
    return {
      category:   'recovery',
      confidence: 'high',
      reasoning:  `${inputs.recentHighFatigueCount} heavy/wrecked days in last 5, RPE ${inputs.rpe} on a ${inputs.sessionType} run`,
    }
  }

  // ── 3. AEROBIC vs MUSCULAR ─────────────────────────────────────────────
  // Distinguish "engine pushed first" (HR climbed, pace held) from
  // "legs went first" (pace faded, HR stayed flat). Both fading together
  // points at aerobic — the engine is leading the breakdown. Pace fade
  // without HR rise is the muscular signature.
  const hrDrift = inputs.streamSummary?.hrDriftBpm ?? null
  const paceFade = inputs.paceFadeSummary?.paceFadeSecPerKm ?? null

  if (
    hrDrift != null
    && hrDrift >= LIMITER.AEROBIC_DRIFT_BPM
    && (paceFade == null || paceFade < LIMITER.MUSCULAR_PACE_FADE_SEC)
  ) {
    return {
      category:   'aerobic',
      confidence: inputs.streamSummary!.sparse ? 'medium' : 'high',
      reasoning:  `HR drifted +${hrDrift}bpm in the back third (first third ${inputs.streamSummary!.firstThirdAvgHr} → last third ${inputs.streamSummary!.lastThirdAvgHr})`,
    }
  }

  if (
    paceFade != null
    && paceFade >= LIMITER.MUSCULAR_PACE_FADE_SEC
    && (hrDrift == null || hrDrift < LIMITER.MUSCULAR_HR_DRIFT_BELOW_BPM)
  ) {
    const first = inputs.paceFadeSummary!.firstHalfAvgPaceSecPerKm
    const back  = inputs.paceFadeSummary!.backHalfAvgPaceSecPerKm
    const m1 = Math.floor(first / 60), s1 = Math.round(first % 60)
    const m2 = Math.floor(back / 60),  s2 = Math.round(back % 60)
    return {
      category:   'muscular',
      confidence: inputs.paceFadeSummary!.sparse ? 'medium' : 'high',
      reasoning:  `pace faded ${paceFade}s/km in the back half (${m1}:${String(s1).padStart(2,'0')}/km → ${m2}:${String(s2).padStart(2,'0')}/km) with HR holding`,
    }
  }

  // Both signals fire significantly — fall back to aerobic with the joint
  // observation in the reasoning (the engine still led the breakdown when
  // HR climbed at all alongside the pace fade).
  if (hrDrift != null && hrDrift >= LIMITER.AEROBIC_DRIFT_BPM && paceFade != null && paceFade >= LIMITER.MUSCULAR_PACE_FADE_SEC) {
    return {
      category:   'aerobic',
      confidence: 'medium',
      reasoning:  `HR drifted +${hrDrift}bpm and pace faded ${paceFade}s/km — both signals together (engine and legs failing in step)`,
    }
  }

  // ── 4. PACING (started too hot on a controlled-effort day) ─────────────
  if (
    inputs.hrAboveCeilingPct != null
    && inputs.hrAboveCeilingPct >= LIMITER.PACING_HOT_PCT_THRESHOLD
    && EASY_TYPES.has(inputs.sessionType)
  ) {
    return {
      category:   'pacing',
      confidence: 'medium',
      reasoning:  `HR above ceiling for ${inputs.hrAboveCeilingPct.toFixed(0)}% of the run on a ${inputs.sessionType} day`,
    }
  }

  // ── 5. EXECUTION (didn't commit on a hard day) ─────────────────────────
  if (
    inputs.hrBelowFloorPct != null
    && inputs.hrBelowFloorPct >= LIMITER.EXECUTION_COLD_PCT_THRESHOLD
    && HARD_TYPES.has(inputs.sessionType)
  ) {
    return {
      category:   'execution',
      confidence: 'medium',
      reasoning:  `HR below the band ${inputs.hrBelowFloorPct.toFixed(0)}% of the time on a ${inputs.sessionType} session`,
    }
  }

  // ── 6. FUELING (long run cut short with high RPE) ──────────────────────
  if (
    inputs.sessionType === 'long'
    && inputs.rpe != null
    && inputs.rpe >= 7
    && inputs.plannedDistKm != null
    && inputs.actualDistKm != null
    && inputs.plannedDistKm > 0
    && inputs.actualDistKm / inputs.plannedDistKm < LIMITER.FUELING_LONG_RUN_SHORTFALL
  ) {
    const shortfall = inputs.plannedDistKm - inputs.actualDistKm
    return {
      category:   'fueling',
      confidence: 'low',
      reasoning:  `long run cut ${shortfall.toFixed(1)}km short with RPE ${inputs.rpe} — fueling or pacing in the back half`,
    }
  }

  // ── 7. FATIGUE TAG (lowest-confidence fallback for manual loggers) ─────
  if (
    inputs.fatigueTag != null
    && (FATIGUE_HIGH_TAGS as readonly string[]).includes(inputs.fatigueTag)
  ) {
    return {
      category:   'fatigue_tag',
      confidence: 'low',
      reasoning:  `runner logged "${inputs.fatigueTag}" afterwards — body is signalling cost`,
    }
  }

  return null
}

/**
 * Human-readable label for the limiter category. Used by prompts to bias Kit
 * toward the right interpretive register without dictating the exact wording.
 */
export function limiterLabel(category: LimiterCategory): string {
  switch (category) {
    case 'heat':        return 'heat'
    case 'recovery':    return 'recovery state'
    case 'aerobic':     return 'aerobic capacity (engine before legs)'
    case 'muscular':    return 'muscular endurance (legs before engine)'
    case 'pacing':      return 'pacing (started too hot)'
    case 'execution':   return 'execution (did not commit to the zone)'
    case 'fueling':     return 'fueling / late-run depletion'
    case 'fatigue_tag': return 'self-reported fatigue'
  }
}
