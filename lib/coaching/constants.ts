export const COACHING_RULE_ENGINE_VERSION = '1.0.0'

// Session scoring weights (must sum to 1.0)
export const SCORE_WEIGHTS = {
  hr_discipline: 0.50,
  distance:      0.25,
  pace:          0.15,
  ef:            0.10,
} as const

// Verdict thresholds (total score 0–100)
export const VERDICT_BANDS = {
  nailed:     80,
  close:      60,
  off_target: 40,
  // < 40 = concerning
} as const

// Zone discipline (weekly aggregate)
/**
 * §12 Amendment 1 / R30-DIRECTIONAL-01 — how much of an easy run may sit ABOVE
 * its Z2 ceiling before it counts as drift.
 *
 * R30 previously keyed on `hr_in_zone_pct < 60`, which is a BAND. §12 prescribes
 * a CAP — "Easy runs are capped at the top of Z2" — so running BELOW Z2 breaks no
 * principle and must not be counted. Measured in production 2026-09-13: **6 of 22
 * flagged runs (27%) were predominantly too EASY**, one at 17% in zone with 83%
 * below the floor and 0% above the ceiling.
 *
 * THE THRESHOLD IS RE-DERIVED, NOT CARRIED ACROSS. `< 60% in zone` and
 * `> N% above ceiling` are different scales and the old number means nothing on
 * the new one. The production distribution separates cleanly with no overlap:
 *   too-easy runs   0, 0, 1, 2, 3, 19  % above ceiling
 *   too-hard runs  23, 40, 47 … 94     % above ceiling
 * 20 sits in that gap. It catches zero too-easy runs and flags the same COUNT as
 * the old rule (22), but swaps 6 false positives for 6 genuine drift runs the old
 * rule missed — runs at ≥60% in zone with more than a fifth above the ceiling.
 *
 * ⚠️ n = 42 rows with HR data. Thin. The gap is unambiguous (a run with 0% above
 * the ceiling cannot be drift under any reading) but the exact cut should be
 * re-measured once the cohort grows.
 *
 * Seiler's framing for why a directional metric is required at all: the grey zone
 * HAS a direction — it is what athletes do INSTEAD of easy, not a band they fail
 * to hit. A symmetric metric for an asymmetric phenomenon mislabels about a
 * quarter of cases, which is what was measured.
 */
export const ZONE_DRIFT_ABOVE_CEILING_PCT = 20

/**
 * P-04 — the run count at which the weekly zone-compliance block is allowed to
 * pass a VERDICT rather than only report a count.
 *
 * Coaching Board 2026-09-20, CORRECT WITH AMENDMENT. Hutchinson raised the
 * threshold and then narrowed his own objection: it was never to stating what
 * happened, it was to inferring a PATTERN from three runs with no control for
 * terrain, heat, illness or a badly-seated strap. We hold
 * `hr_above_ceiling_pct` and nothing else, so we cannot tell "ran too hard"
 * from "ran up a hill in August". Those are different claims, and the question
 * as routed down conflated them.
 *
 * ⚠️ IT GATES THE REGISTER, NOT THE VISIBILITY, and the measurement is why.
 * Across 42 runner-weeks from 8 runners, a minimum of three analysed runs
 * would have hidden the block on **57.1% of weeks** (0 analysed 4.8%, one
 * 21.4%, two 31.0%, three-plus 42.9%). That is not a block that appears when
 * there is something to say; it is not a fixture at all. Wood's standing note
 * — "if this block only ever appears when there's something to say, it becomes
 * a thing people dread opening" — decides it at that rate.
 *
 * So: below this count the block states the count and passes no judgement;
 * at or above it, the exception is named.
 *
 * ⚠️ THIN, and declared as such. n = 8 runners. Same caveat, and the same
 * words, as `ZONE_DRIFT_ABOVE_CEILING_PCT` above: re-measure once the cohort
 * grows. The October charity intake is the first chance.
 */
export const ZONE_BLOCK_VERDICT_MIN_RUNS = 3

export const ZONE_DISCIPLINE_BANDS = {
  disciplined: 85,
  decent:      70,
  loose:       50,
  // < 50 = freelancing
} as const

// Acute:chronic load ratio thresholds
export const LOAD_RATIO = {
  watch: 1.3,
  flag:  1.4,  // flag if >1.4 for 2 consecutive weeks
  // A5 (Design Board 2026-09-22) — the LOWER edge of "your recent normal".
  // It already governed what the Coach screen tells the runner ("under your
  // recent normal") and was a bare 0.8 inside a display function, invisible to
  // every config check this repo owns. Naming it is a no-behaviour-delta
  // refactor: the value is unchanged.
  under: 0.8,
} as const

// Shadow load — actual vs planned
export const SHADOW_LOAD_THRESHOLD_PCT = 15  // >15% over plan triggers reflection

// EF trend — aerobic efficiency decline
export const EF_DECLINE_THRESHOLD_PCT = -8  // >8% drop vs 4-week rolling avg

// Max activities to include in EF baseline
export const EF_BASELINE_WINDOW = 6

// HR stream zone margin (bpm tolerance around zone boundaries).
//
// CONFIG-CONSUMER-01 (2026-09-14): this was declared 3 and read by NOTHING,
// while `zoneRules.hitSessionZone` hardcoded its own `const tolerance = 2` for
// the same job — the Configuration Singularity breached in both directions at
// once, with the named number being the dead one. Two owners, one question,
// differing by a bpm, and the config would have looked authoritative to anyone
// who found it. Corrected to 2 because 2 is what has always shipped: the
// defect is the hardcode plus the orphan, NOT the value, and changing the
// tolerance would move `hr_in_zone_pct` — which feeds session scoring, the
// zone-drift trigger and the post-run card — on boundary HRs. That would be a
// coaching change and would need the board; naming the shipped number does not.
export const HR_ZONE_TOLERANCE_BPM = 2

// Max adjustments per week
export const MAX_ADJUSTMENTS_PER_WEEK = 2

// Fatigue-accumulation trigger — CoachingPrinciples §112.
//
// 🔴 THIS COMMENT USED TO CITE "§R20-T4", WHICH DOES NOT EXIST and never did.
// The constitution's only `R20` reference is FEATURE_GATES.PAID_ONLY_ONGOING, an
// unrelated tier gate — while TWO ratified sections DEPEND on this mechanism
// (§70's reframe risk gate silences on "3 consecutive Heavy/Wrecked"; the
// recalibration trigger requires "no concurrent fatigue accumulation"). The
// constitution leaned on a rule nobody had written. Ratified as §112 on
// 2026-09-18 (Coaching Board, FIRSTRUN-MISSED-01 part 2).
//
// ⚠️ The FILE was never the problem — CLAUDE.md sanctions this module as the
// home for coaching scoring and load thresholds. Unlike §106's peakKmByLevel
// and §111's base-volume gate, these numerics were in the right place; only the
// principle was missing. Different failure, different fix.
export const FATIGUE_HIGH_TAGS = ['Heavy', 'Wrecked', 'Cooked'] as const
export const FATIGUE_ACCUMULATION_THRESHOLD = 3   // consecutive sessions before softening fires
export const FATIGUE_SOFTENING_LONG_RUN_PCT = 0.80 // long run reduced to 80% (20% cut)

// §112 — a session SKIPPED for these reasons is evidence of cost too. A runner
// who logs 'Heavy' COMPLETED the session; one who reports 'Too tired' could not
// begin it, which Willy holds is the stronger signal and Sims reads as a
// low-energy-availability presentation in this demographic. Before this, the
// trigger could never observe them: they did not run, so they logged no tag.
//
// Only 'Too tired'. 'Life got busy' and 'Bad weather' are life, not load, and
// already propose a make-up slot; 'Injury / illness' has §21.
export const FATIGUE_COUNTING_SKIP_REASONS = ['Too tired'] as const

// §112 — McMillan's dissent, taken at its cheapest price. "Too tired" on a
// Tuesday is often a bad night's sleep or a toddler, so a skip may CONTRIBUTE to
// the window but may not fill it alone: at least one session in the window must
// have been run and tagged. A runner who only ever skips is a different problem
// and not this rule's job.
export const FATIGUE_WINDOW_REQUIRES_LOGGED_SESSION = true

// Quality session minimum gap (hours) — re-exported from generationConfig so
// reshape rules and plan generation read the same source (CoachingPrinciples §7,
// ADR-009). Single-line wrapper kept for back-compat with existing consumers.
import { GENERATION_CONFIG } from '@/lib/plan/generationConfig'
export const MIN_QUALITY_GAP_HOURS = GENERATION_CONFIG.MIN_HOURS_BETWEEN_QUALITY

// Taper protection — no adjustments in final N weeks
export const TAPER_PROTECTION_WEEKS = 3

// ENGINE-01 — Fitness signal: consistently fast quality sessions with controlled HR.
// Fires a flag_for_review (no session changes) + benchmark recalibration prompt.
// paceScore ≤ this on a quality session = ran faster than the upper edge of the band.
export const FITNESS_SIGNAL_PACE_SCORE_MAX    = 60
// hr_above_ceiling_pct ≤ this = HR stayed controlled even at high pace (genuine fitness signal).
export const FITNESS_SIGNAL_HR_CEILING_MAX    = 15
// How many qualifying quality sessions in recent window before the signal fires.
export const FITNESS_SIGNAL_SESSION_THRESHOLD = 3
// Minimum weeks into plan before fitness signal can fire (early-plan variance is noise).
export const FITNESS_SIGNAL_MIN_PLAN_WEEKS    = 4

// ENGINE-02 — Long run distance shortfall: consecutive long runs significantly under plan.
// actual_load_km < planned * this threshold = significant shortfall.
export const LONG_RUN_SHORTFALL_COMPLETION_PCT  = 0.82
// How many consecutive qualifying long runs before the trigger fires.
export const LONG_RUN_SHORTFALL_CONSECUTIVE     = 2
// Reduce the upcoming long run prescription by this fraction (15% trim).
export const LONG_RUN_SHORTFALL_REDUCE_PCT      = 0.85

// Max volume increase per adjustment — re-exported from generationConfig (§2).
export const MAX_VOLUME_INCREASE_PCT = GENERATION_CONFIG.MAX_WEEKLY_VOLUME_INCREASE_PCT

// Pre-session readiness signal — re-export from generationConfig (CoachingPrinciples §59).
// Single source of truth: the trigger thresholds live in GENERATION_CONFIG.READINESS.
export const READINESS = GENERATION_CONFIG.READINESS

// Multi-month trend (AI-DEPTH-03) — same-effort runs over time
// Powers Tier A reframe specificity: "Z2 HR has dropped 12 bpm since Feb."
// Buckets are monthly; thresholds gate noise.
export const TREND_SERIES = {
  /** Default lookback window in months. */
  DEFAULT_WINDOW_MONTHS: 6,
  /** Minimum buckets (months) before a trend is reported. */
  MIN_BUCKETS: 2,
  /** Minimum runs per bucket before the bucket counts. */
  MIN_RUNS_PER_BUCKET: 2,
  /** Minimum total matching runs across the window. */
  MIN_TOTAL_RUNS: 6,
  /** Minimum HR delta in bpm between first/last bucket to call it a trend. */
  MIN_HR_DELTA_BPM: 4,
  /** Minimum pace delta in seconds/km between first/last bucket. */
  MIN_PACE_DELTA_SEC: 5,
} as const

// Reframe risk-gate thresholds (POST-RUN-REFRAME-01 / Step 4)
// When these fire, the reframe is silenced — the coaching warning surfaces instead.
// Doctrine: reframe-positive against a risk signal is harm.
// brand.md § Reframe Voice → "Risk flags trump reframe."
export const REFRAME_RISK = {
  /** HR drift bpm threshold for "severe" — silences the reframe. Above the
   *  "mention in reframe" threshold (10 bpm) used in normal feedback. */
  SEVERE_HR_DRIFT_BPM: 15,
  /** HR drift % threshold for "severe" (0–1 scale, not percent). */
  SEVERE_HR_DRIFT_PCT: 0.10,
  /** Consecutive Heavy/Wrecked sessions before fatigue silences the reframe.
   *  Matches FATIGUE_ACCUMULATION_THRESHOLD intentionally — same rule. */
  FATIGUE_ACCUMULATION_SESSIONS: 3,
  /** Recent 'flag' coaching_flag count (window: last 5 completions) before
   *  repeated-overload silences the reframe. Two flags in 5 is the bar. */
  REPEATED_OVERLOAD_FLAG_COUNT: 2,
  REPEATED_OVERLOAD_WINDOW: 5,
} as const

// Reframe data-source ladder (POST-RUN-REFRAME-01)
// The reframe must work for any user — Tier A is rich-data, Tier C is minimum-data.
// Thresholds calibrate what counts as "enough evidence" for each tier.
// See docs/canonical/brand.md § Reframe Voice for the architectural rationale.
export const REFRAME_TIER = {
  /** Minimum analysed runs in last 12 weeks to qualify for Tier A (cohort + trend evidence). */
  TIER_A_MIN_ACTIVITIES: 12,
  /** Lookback window for the Tier A activity count. */
  TIER_A_WINDOW_DAYS: 84,
  /** Minimum session_completions in last 4 weeks to qualify for Tier B (RPE pattern evidence). */
  TIER_B_MIN_COMPLETIONS: 6,
  /** Lookback window for the Tier B completion count. */
  TIER_B_WINDOW_DAYS: 28,
  /** Max characters accepted for a user reflection note before trimming.  */
  USER_NOTE_MAX_CHARS: 2000,

  // ── RPE-pattern cohort (REFRAME-COHORT-01, Coaching Board 2026-08-15) ──
  // The cohort filters by coaching ROLE (§58 third axis), so a long run compares
  // against long runs. That narrowing needs a wider window: a runner gets ~1 long
  // run per week, so the 28-day Tier-B window would yield ~4 — no tolerance for a
  // missed session or an unlogged RPE, and the trend silently disappears at the
  // moment it matters. 8 weeks yields ~8 long runs.
  /** Lookback window for the RPE-pattern cohort. Wider than TIER_B_WINDOW_DAYS
   *  because the cohort is role-filtered. Tier *qualification* still uses
   *  TIER_B_WINDOW_DAYS — do not conflate the two. */
  RPE_PATTERN_WINDOW_DAYS: 56,
  /** Minimum same-role RPE samples before a pattern is reported. */
  RPE_PATTERN_MIN_SAMPLES: 4,
  /** Rows of run_analysis scanned for the previous-similar-session comparison. */
  PREVIOUS_SIMILAR_SCAN_ROWS: 20,
} as const

// Limiter hypothesis classifier — picks ONE most-likely physiological cause
// per session, when the signal is strong enough to defend. Inspired by the
// "what was the limiter?" framing common in elite coaching analysis.
// Source-tiered: degrades from full HR+stream+temp+RPE down to RPE+fatigue only.
// Doctrine: no signal → no claim. Returning null is correct when the data
// doesn't support a defensible hypothesis. See lib/coaching/limiter.ts.
export const LIMITER = {
  /** Temp ≥ this counts as warm enough to explain a hot HR (°C). */
  HEAT_C_THRESHOLD: 22,
  /** Temp + HR-above-ceiling delta that triggers a high-confidence "heat" call. */
  HEAT_BPM_OVER_CEILING: 5,
  /** Recent Heavy/Wrecked tags in last 5 sessions that trigger "recovery" limiter. */
  RECOVERY_HIGH_FATIGUE_COUNT: 2,
  /** HR drift bpm (back third vs first third) that points at aerobic limiter. */
  AEROBIC_DRIFT_BPM: 12,
  /** Pace fade seconds/km (back half vs first half) that points at muscular limiter. */
  MUSCULAR_PACE_FADE_SEC: 20,
  /** Pace fade seconds/km at which feedback should REFERENCE the fade directly.
   *  Below this, ignore it unless it's the dominant story. Lower than
   *  MUSCULAR_PACE_FADE_SEC — worth mentioning before it's worth diagnosing.
   *  Promoted from a prose literal in sessionFeedback.ts (FMT-01, INV-CFG-003);
   *  value unchanged, so no coaching behaviour changed. Stored per-km like all
   *  pace data; render via formatPaceDelta for the reader's unit. */
  PACE_FADE_REFERENCE_SEC: 15,
  /** HR drift below this threshold means the legs faded WITHOUT the engine
   *  ramping — classic muscular-endurance signature rather than aerobic. */
  MUSCULAR_HR_DRIFT_BELOW_BPM: 8,
  /** % HR above ceiling that signals "started too hot" — pacing limiter. */
  PACING_HOT_PCT_THRESHOLD: 50,
  /** % HR below floor on a hard session — execution limiter (didn't commit). */
  EXECUTION_COLD_PCT_THRESHOLD: 50,
  /** Long-run shortfall fraction (actual / planned) that signals fueling. */
  FUELING_LONG_RUN_SHORTFALL: 0.90,
  /** Minimum RPE on an easy/recovery run to trigger recovery limiter alongside fatigue. */
  RECOVERY_EASY_RPE_FLOOR: 7,
  /** Distance (km) at/above which the limiter stays silent and the debrief
   *  surfaces drop fade-as-fault citations. Back-third fade over ultra distance
   *  is expected physiology (glycogen depletion), not a defensible limiter
   *  hypothesis — a confident "muscular" or "aerobic" call here mis-reads the
   *  distance itself. Standard ultra floor (beyond the marathon). Single source,
   *  read by the limiter and both prompt builders. CoachingPrinciples §72.
   *  Race sessions are also suppressed by type (§71); this catches ultra-distance
   *  efforts not tagged as a race. */
  SUPPRESS_ULTRA_DISTANCE_KM: 50,
} as const

// Cohort similarity matching — past-self comparison (R25 cut #1)
// CoachingPrinciples §58. Two-axis match for cut #1: distance band + HR band.
// Three-axis (adding session.type) deferred to cuts #2/#3 which need richer cohort filtering.
export const COHORT_SIMILARITY = {
  /** Distance match window — runs within ±N% of target distance count as similar. */
  DISTANCE_TOLERANCE_PCT: 15,
  /** Minimum past similar runs before comparison fires. Below this, sample is noise. */
  MIN_COHORT_SIZE: 3,
  /** Default lookback window. Captures seasonal patterns. */
  WINDOW_DAYS_DEFAULT: 365,
  /** Shrunk window for dense users — recent history is more representative. */
  WINDOW_DAYS_DENSE: 180,
  /** Cohort size in last 6 months that triggers dense-window switch. */
  DENSE_THRESHOLD: 30,
  /** HR band breakpoints — three-bucket effort classification (low / mid / high). */
  HR_BAND_BREAKPOINTS: { low: 145, mid: 165 },
} as const

/**
 * Physiological bounds on a RUN's average heart rate.
 *
 * Not a coaching choice and not a tuning knob: outside this range the value is
 * a sensor artefact, a mis-ingested row, or a workout that was not a run. It
 * exists because the Coach screen shipped "77 (Apr avg) → 146 (now)" to the
 * founder, and Kit then repeated it as established fact: "Easy is costing you
 * more than it did." Nothing in the chain objected. The trend maths was
 * correct the whole way; it was faithfully averaging a corrupt row.
 *
 * FLOOR 90 — an adult's resting HR tops out around 100 and a walk sits near
 * there, so a *running* average below 90 is not a training heart rate at any
 * fitness level. Deliberately well under the ~110 an easy run actually reaches,
 * so this only ever removes rows that are wrong, never rows that are merely
 * low. CEILING 220 — above the theoretical maximum for any human.
 *
 * Applied by `isPlausibleRunHr` in runHistory.ts, which is the single gate for
 * every HR average this app computes.
 */
export const RUN_HR_PLAUSIBLE = { MIN_BPM: 90, MAX_BPM: 220 } as const

/**
 * How much slower (or faster) easy pace must move before it UNDERMINES the
 * aerobic-trend claim, in seconds per km.
 *
 * WHY THIS EXISTS. `buildHrTrendSeries` matches its cohort on DISTANCE only
 * (±`DISTANCE_TOLERANCE_PCT`), so pace is free to move inside it, while the
 * card's copy claimed the comparison was "at the same pace" and concluded
 * "your aerobic base is growing". A runner who simply eased off was told they
 * were fitter. Worse, the failure is not random: a runner complying with Zonna
 * IS slowing down, so the people most likely to be told something false are the
 * ones the product is working for (TREND-PACE-CLAIM-01).
 *
 * ⚠️ WHY NOT `TREND_SERIES.MIN_PACE_DELTA_SEC` (5). That constant answers a
 * different question — "is there a pace trend worth narrating?" for the
 * per-run reframe prompt — and it sits far BELOW the noise floor for this one.
 * Measured against production on 2026-09-12, aerobic runs inside a ±15%
 * distance band: **within-month SD of easy pace 40.2 s/km**, mean
 * month-to-month shift of the bucket mean **21.9 s/km**. A 5 s/km gate is an
 * eighth of the within-month standard deviation: it would fire on ordinary
 * variation and silence the card more or less permanently. 20 s/km sits at the
 * edge of ordinary month-to-month movement rather than inside it.
 *
 * 🔴 THE EVIDENCE IS THIN AND THE NUMBER IS PROVISIONAL. That measurement had
 * 3 users, 19 runs in band and 4 comparable month pairs. The SCALE argument is
 * robust (a threshold below the within-month SD cannot separate signal from
 * noise, at any sample size); the specific value of 20 is not. Re-measure once
 * there is a real cohort, and move it with a number in the commit message.
 *
 * Direction matters as much as magnitude, and the consumer
 * (`trendSentence.ts`) reads it signed — never through `Math.abs`.
 */
export const TREND_PACE_CONFOUND_SEC_PER_KM = 20
