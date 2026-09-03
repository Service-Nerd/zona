// Constitutional layer: mechanically verifies that a generated plan honours
// CoachingPrinciples. Each check is keyed to a principle section so violations
// trace back to authority. See docs/canonical/plan-invariants.md.
//
// Usage:
//   const violations = validatePlan(plan, input)
//   if (violations.length > 0) console.error(violations)
//
// Wired into generateRulePlan: throws on `error` severity in development;
// logs in production (does not break the user).

import type { Plan, GeneratorInput, Session } from '@/types/plan'
import { GENERATION_CONFIG } from './generationConfig'
import { PLAN_SIGNATURES } from './planSignatures'
import { V1_SESSION_CATALOGUE } from './sessionCatalogueData'
import { isLongRun, isShakeout, classifyStimulus, isVo2maxSession, isStructuredSession } from './sessionRole'
import { mainSetMinutes } from './sessionFormat'
import { isV2Structure } from './sessionStructureV2'
// Date helpers live in length.ts — the single owner of plan date arithmetic (D-08).
import { parseDateLocal, formatDate, getDistanceConfig } from './length'
import { FITNESS_RANK } from './fitnessAssessment'

export type Severity = 'error' | 'warn'

// Registry of every invariant code defined in this file. Used by the meta-check
// in scripts/r2-coverage-check.ts to assert that each code is mechanically
// enforced — adding a code here without enforcement (or vice versa) is a defect.
// (CoachingPrinciples §34, R2/H-04)
export const INVARIANT_CODES = [
  'INV-PLAN-DELOAD-IS-A-REDUCTION',
  'INV-PLAN-VOLUME-SHORTFALL-DECLARED',
  'INV-PLAN-EASY-FLOOR-PROTECTION-DECLARED',
  'INV-PLAN-EFFORT-OR-PACE',
  'INV-PLAN-DERIVED-SET',
  'INV-PLAN-CATALOGUE-LINK',
  'INV-PLAN-MAIN-SET-ORDERING',
  'INV-PLAN-VO2MAX-MAIN-SET-CAP',
  'INV-PLAN-VO2MAX-ONSET',
  'INV-PLAN-NO-SESSIONS-ON-BLOCKED-DAYS',
  'INV-PLAN-COACH-NOTES-MATCH-INTENT',
  'INV-PLAN-LABEL-MATCHES-PACE',
  'INV-PLAN-INJURY-NO-HILLS',
  'INV-PLAN-RETURNING-INTENSITY-REENTRY',
  'INV-PLAN-DURATION-ANCHORED-KEEPS-MINUTES',
  'INV-PLAN-RACE-WEEK-SHARPENING',
  'INV-PLAN-RACE-SPECIFIC-EXPOSURE',
  'INV-PLAN-RACE-SPECIFIC-EXPOSURE-RATIO',
  // INV-PLAN-THEME-MATCHES-PRESCRIPTION retired by GEN-FIX-06 (incident N4, P0,
  // 2026-08-06) — its four-literal denylist was replaced by the semantic
  // INV-PLAN-COPY-MATCHES-SESSIONS below, which checks the label as well as the
  // theme. The old code emitted nowhere; removed from the registry here.
  'INV-PLAN-COPY-MATCHES-SESSIONS',
  'INV-PLAN-MIN-SESSION-SIZE',
  'INV-PLAN-EMPTY-SESSION',
  'INV-PLAN-LONG-IS-LONGEST',
  'INV-PLAN-LONG-CAP-MINS',
  'INV-PLAN-WEEK-1-2-LONG-CAP',
  'INV-INPUT-LONGEST-LE-WEEKLY',
  'INV-PLAN-QUALITY-PER-WEEK',
  'INV-PLAN-QUALITY-LONG-SPACING',
  'INV-PLAN-QUALITY-EXPECTED',
  'INV-PLAN-MAX-WEEKDAY-MINS',
  'INV-PLAN-PEAK-LR-RACE-RATIO',
  'INV-PLAN-RACE-SPECIFIC-LONG-RUN',
  'INV-PLAN-PEAK-OVER-BASE',
  'INV-PLAN-VDOT-RAW-EXCEEDS-ANCHOR',
  'INV-PLAN-TAPER-VARIETY',
  'INV-PLAN-PREP-TIME-STATUS-ANNOTATED',
  'INV-PLAN-DIFFICULTY-ANNOTATED',
  'INV-PLAN-DIFFICULTY-NEVER-FRONTS-UNSAFE',
  'INV-PLAN-INTENSITY-ORDERING',
  'INV-PLAN-PHASE-FOCUS-REACHABLE',
  'INV-PLAN-SECOND-QUALITY-MIN-DAYS',
  'INV-PLAN-INTENSITY-DISTRIBUTION',
  'INV-PLAN-LR-PROGRESSION-CAP',
  'INV-PLAN-PEAK-VOLUME-FLOOR-LONG-RACES',
  'INV-PLAN-PEAK-LR-ALTERNATION',
  'INV-PLAN-TAPER-DURATION-CAP',
  'INV-PLAN-RETURNING-RUNNER-NOTE-PRESENT',
  'INV-PLAN-QUALITY-VARIETY-FULL-PLAN',
  'INV-PLAN-LR-MAX-WEEKLY-PCT',
  'INV-PLAN-HR-ASSUMPTIONS-SURFACED',
  'INV-PLAN-MAX-HR-NOT-BELOW-ESTIMATE-FLOOR',
  'INV-PLAN-USER-LEVEL-NO-UPWARD-TONNAGE',
  'INV-PLAN-FOUNDATION-BLOCK',
  'INV-PLAN-5K10K-LR-PACE-CAP',
  'INV-PLAN-BUILD-LR-SEGMENT-CAP',
  'INV-PLAN-FINISH-GOAL-LR-CAP',
  'INV-PLAN-ULTRA-NO-PACE-SEGMENTS',
  'INV-PLAN-WEEK-HAS-REST-DAY',
  'INV-PLAN-COVERS-RACE-DATE',
  'INV-PLAN-RACE-ON-RACE-DAY',
  'INV-PLAN-RECALIBRATION-HAS-SESSION',
  'INV-PLAN-PEAK-IN-PEAK-PHASE',
  'INV-PLAN-NO-PLACEHOLDER-COPY',
  'INV-PLAN-TAPER-COPY-MATCHES-DURATION',
  'INV-PLAN-LARGEST-SESSIONS-SPACED',
  // MAINT-01 — maintenance block invariants (validated by validateMaintenanceBlock,
  // not by validatePlan — maintenance weeks are not produced by generateRulePlan)
  'INV-MAINT-PHASE1-SESSION-TYPES',
  'INV-MAINT-QUALITY-CAP',
  'INV-MAINT-VOLUME-CEILING',
  'INV-MAINT-REST-DAY',
  'INV-MAINT-NO-RACE-SPECIFIC',
  'INV-MAINT-CADENCE',
  'INV-MAINT-INJURY-EASY-ONLY',
  'INV-MAINT-REENGAGEMENT-WINDOW',
] as const

/**
 * Single source of truth for "does this week have at least one rest day?".
 * Called by `validatePlan` (constitutional layer, plan generation) AND by
 * `buildReorderAdjustment` (move-time trigger). CoachingPrinciples §64 +
 * Decision #4 (PL-MOVE): rules live in the canon; both triggers call the
 * same implementation. D-08 (no duplicate ownership).
 *
 * Accepts either the flat session array `buildReorderAdjustment` uses or
 * the entry tuples `validatePlan` produces.
 *
 * GEN-FIX-09 (2026-08-06) — §64 amended: **a rest day is the absence of a
 * session, not a session.** Two ways to satisfy it:
 *
 *   1. An explicit `type: 'rest'` entry. The post-race maintenance block emits
 *      these deliberately — there the rest day is a prescription, not a gap.
 *   2. Fewer than 7 training days in the week. This is how `generateRulePlan`
 *      has always worked: a 3-day plan leaves four days empty.
 *
 * Previously only (1) counted, so every generated plan failed this invariant
 * once per non-race week — invisible because validatePlan throws in dev/test
 * but logs in production. The engine was right; the rule was wrong.
 *
 * The move-time caller keeps its meaning: a reorder cannot change how many
 * sessions a week has, so it can only lose a rest day by landing on an
 * explicit one — which is exactly the maintenance-block case it protects.
 */
const DAYS_IN_WEEK = 7  // structural constant, not a coaching numeric (INV-CFG-003)

export function weekHasRestDay(
  sessions: ReadonlyArray<{ type?: string } | null | undefined>,
): boolean {
  if (sessions.some(s => s?.type === 'rest')) return true
  const trainingDays = sessions.filter(s => s && s.type !== 'rest').length
  return trainingDays < DAYS_IN_WEEK
}

const DAYS_MON_SUN = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
type DayKey = typeof DAYS_MON_SUN[number]

/**
 * Quality-vs-long spacing check (CoachingPrinciples §7). Used by validatePlan
 * (constitutional, plan generation) AND by buildReorderAdjustment (move-time).
 * Returns every violation — calendar-day gap between any quality session
 * and the week's long run that's below `minDays`. Empty array when spacing
 * is correct, the week has no long run, or there are no quality sessions.
 *
 * Input shape: sessions indexed by DAYS_MON_SUN order. validatePlan emits
 * `DAYS.map(d => w.sessions[d])`; buildReorderAdjustment already has the
 * post-move array in this order.
 *
 * Decision #4 (PL-MOVE): one constitution, two triggers. The check lives
 * here; both triggers import and call it. D-08.
 */
export function findQualityLongSpacingViolations(
  weekSessions: ReadonlyArray<{ type?: string; role?: 'long_run' | 'shakeout'; label?: string | null } | null | undefined>,
  minDays: number,
): Array<{ qualityDay: string; longDay: string; gap: number }> {
  // The long run is `type: 'easy'` (+ role/label) in generated plans — never
  // `type: 'long'`. Classify structurally via the canonical owner, or this §7
  // spacing check silently finds no long run and never fires (INV was dead).
  const longIdx = weekSessions.findIndex(s => !!s && isLongRun(s))
  if (longIdx < 0) return []
  const out: Array<{ qualityDay: string; longDay: string; gap: number }> = []
  for (let qi = 0; qi < weekSessions.length; qi++) {
    if (weekSessions[qi]?.type !== 'quality') continue
    const gap = Math.min(Math.abs(qi - longIdx), 7 - Math.abs(qi - longIdx))
    if (gap < minDays) {
      out.push({
        qualityDay: DAYS_MON_SUN[qi] ?? String(qi),
        longDay:    DAYS_MON_SUN[longIdx] ?? String(longIdx),
        gap,
      })
    }
  }
  return out
}

export interface Violation {
  code: string
  principle_ref: string
  severity: Severity
  week: number
  day?: string
  message: string
  actual: number | string
  expected: number | string
}

const DAYS = ['mon','tue','wed','thu','fri','sat','sun'] as const
type Day = typeof DAYS[number]

const DAY_SET: Set<Day> = new Set(DAYS)
const FULL_TO_SHORT_DAY: Record<string, Day> = {
  monday: 'mon', tuesday: 'tue', wednesday: 'wed', thursday: 'thu',
  friday: 'fri', saturday: 'sat', sunday: 'sun',
}

function dayGap(a: Day, b: Day): number {
  const ai = DAYS.indexOf(a), bi = DAYS.indexOf(b)
  return Math.min(Math.abs(ai - bi), 7 - Math.abs(ai - bi))
}

// Parse "M:SS–M:SS /km" pace string → midpoint in min/km. Used by
// INV-PLAN-LABEL-MATCHES-PACE pace-band check. Returns null when the string
// doesn't match (defensive — engine emits ranges, but legacy plans may not).
function parsePaceMidpoint(s: string): number | null {
  const m = s.match(/^(\d+):(\d+)\s*[–-]\s*(\d+):(\d+)/)
  if (!m) {
    const single = s.match(/^(\d+):(\d+)/)
    if (!single) return null
    return parseInt(single[1], 10) + parseInt(single[2], 10) / 60
  }
  const fast = parseInt(m[1], 10) + parseInt(m[2], 10) / 60
  const slow = parseInt(m[3], 10) + parseInt(m[4], 10) / 60
  return (fast + slow) / 2
}

// SC-08 vo2max — the WORK minutes (time at Z4-5) of a v2 VO2max session: the
// resolved rep count × the work step's own length. Distance reps convert via the
// session's own I-pace band. Returns null for a v1 row, a missing derived set, or
// a distance rep with no pace — the caller falls back to the main-set ceiling.
function vo2maxWorkMinutes(session: Session): number | null {
  const ds = session.derived_set as { blocks?: { repeat?: number; steps?: { role?: string }[] }[] } | undefined
  const reps = ds?.blocks?.[0]?.repeat
  if (typeof reps !== 'number') return null
  const row = session.catalogue_id ? V1_SESSION_CATALOGUE.find(r => r.id === session.catalogue_id) : undefined
  if (!row) return null
  const ms = row.main_set_structure as {
    blocks?: { steps?: { role?: string; length?: { kind?: string; secs?: number; m?: number } }[] }[]
  }
  const len = ms.blocks?.[0]?.steps?.find(s => s.role === 'work')?.length
  if (!len) return null
  if (len.kind === 'duration' && typeof len.secs === 'number') return reps * (len.secs / 60)
  if (len.kind === 'distance' && typeof len.m === 'number') {
    const mid = parsePaceMidpoint(session.pace_target ?? '')
    return mid == null ? null : reps * (len.m / 1000) * mid
  }
  return null
}

// Pace at a given VDOT fraction. Mirror of paceAtFraction in ruleEngine.ts —
// kept local to avoid an import cycle.
function paceFromVdot(vdot: number, fraction: number): number {
  const a = 0.000104, b = 0.182258
  const c = -4.60 - fraction * vdot
  const disc = b * b - 4 * a * c
  if (disc < 0) return 100
  const v = (-b + Math.sqrt(disc)) / (2 * a)
  return 1000 / v
}

// CoachingPrinciples §18 — accept short and full forms. Mirror of the engine
// parser; kept local so the invariant catches any future drift.
function parseBlockedDays(input: GeneratorInput): Set<Day> {
  const s = new Set<Day>()
  for (const d of input.days_cannot_train ?? []) {
    const lower = String(d).toLowerCase()
    if (DAY_SET.has(lower as Day)) { s.add(lower as Day); continue }
    const short = FULL_TO_SHORT_DAY[lower]
    if (short) s.add(short)
  }
  return s
}

// isLongRun / isShakeout now live in ./sessionRole (single owner). They read the
// generator-stamped structural `role`, falling back to the label heuristic only
// for legacy plans — so a plan whose labels the enricher rewrote still classifies
// correctly (D-17). Imported above.

function raceDistanceKey(km: number): keyof typeof GENERATION_CONFIG.LONG_RUN_CAP_MINUTES {
  if (km <= 5)  return '5K'
  if (km <= 10) return '10K'
  if (km <= 21.2) return 'HM'
  if (km <= 42.5) return 'MARATHON'
  if (km <= 50.5) return '50K'
  return '100K'
}

export function validatePlan(plan: Plan, input: GeneratorInput): Violation[] {
  const violations: Violation[] = []
  const minDist = GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM
  const minRatio = GENERATION_CONFIG.LONG_RUN_MIN_RATIO_VS_EASY
  const distKey = raceDistanceKey(input.race_distance_km)
  const longCapMins = GENERATION_CONFIG.LONG_RUN_CAP_MINUTES[distKey]
  // §79 (2026-09-02) — the quality-per-week ceiling is an INTENSITY rule, so it
  // must key off the intensity level. Two reasons this is not the structural one:
  //
  //  1. A user declaration (or the returning-runner lift) raises intensity above
  //     structure. Validating an elevated-intensity plan against the structural
  //     ceiling fails a legitimately-built plan — the failure mode that bites on
  //     the reshape path, where `validateReshapedPlan` reconstructs this input
  //     from plan meta.
  //  2. `input.fitness_level` is undefined for every runner who accepted the
  //     wizard's recommendation, so this check previously self-skipped on the
  //     entire accept path — i.e. the ceiling was unenforced for most real users.
  //     `fitness_intensity_level` is stamped whenever it differs, so preferring
  //     it closes that hole too.
  // Read the PLAN's own stamped intensity level first. `plan.meta` is
  // authoritative and present on both paths; `input` is not — at generation time
  // `generateRulePlan` passes the raw caller input, which carries no
  // `fitness_intensity_level`, so an input-only lookup silently falls back to the
  // structural level and validates an elevated-intensity plan against the
  // beginner ceiling. That is exactly what the extended property sweep caught
  // (1,664 hard failures on `fitness_level: 'beginner'` + an upward
  // `user_declared_level`). Meta first, input second, structural last.
  const fitness = plan.meta.fitness_intensity_level ?? input.fitness_intensity_level ?? input.fitness_level
  const qualityMaxPerWeek = fitness ? GENERATION_CONFIG.QUALITY_SESSIONS_PER_WEEK_MAX[fitness] : undefined
  const minHoursQualLong = GENERATION_CONFIG.MIN_HOURS_BETWEEN_QUALITY_AND_LONG
  const minDaysQualLong = Math.ceil(minHoursQualLong / 24)
  const blocked = parseBlockedDays(input)
  // ADR-020 (2026-09-03) — count the MAIN plan only. Foundation weeks carry
  // n <= 0 and, per §57, "are never part of the main plan's periodisation arc".
  // Including them inflated `totalWeeks`, which shifted `halfWeek`, which moved
  // the boundary of every "second-half build/peak" check — so simply PREPENDING
  // a foundation block could flip a clean plan into a violating one without any
  // main week changing. Measured on a real swept case: identical engine output,
  // clean alone, INV-PLAN-RACE-SPECIFIC-EXPOSURE-RATIO once a single foundation
  // week was attached.
  //
  // Third time the client-side foundation block has broken a server-side
  // assumption (see ADR-020). Defect fix restoring documented intent — §57
  // already said these weeks sit outside the arc.
  const mainWeeks = plan.weeks.filter(w => w.n > 0)
  const totalWeeks = mainWeeks.length || plan.weeks.length
  const halfWeek = Math.ceil(totalWeeks / 2)
  const isTimeTarget = input.goal === 'time_target'

  // INV-INPUT-LONGEST-LE-WEEKLY — a self-reported longest run cannot exceed the
  // whole week's volume (one run can't be more than everything you ran that
  // week). The Ruler's continuous input made this nonsense combination easy to
  // enter; unguarded it feeds a garbage Week-1–2 long-run cap
  // (longest_recent_run_km × WEEK_1_2_LONG_RUN_CAP_MULTIPLIER). Guarded on
  // weekly > 0 so the meta-empty validation path (both fields 0) self-skips,
  // matching the other input-dependent invariants. (CoachingPrinciples §18,
  // Coaching Board 2026-08-30.)
  {
    const statedWeekly  = input.current_weekly_km ?? 0
    const statedLongest = input.longest_recent_run_km ?? 0
    if (statedWeekly > 0 && statedLongest > statedWeekly) {
      violations.push({
        code: 'INV-INPUT-LONGEST-LE-WEEKLY',
        principle_ref: 'CoachingPrinciples §18',
        severity: 'error',
        week: 0,  // input-level, plan-wide — no specific week (convention)
        message: `Self-reported longest run ${statedLongest}km exceeds stated weekly volume ${statedWeekly}km — a single run cannot exceed the week's total`,
        actual: `longest ${statedLongest}km > weekly ${statedWeekly}km`,
        expected: 'longest_recent_run_km ≤ current_weekly_km',
      })
    }
  }

  for (const w of plan.weeks) {
    // Maintenance weeks are produced by generateMaintenanceBlock (not generateRulePlan)
    // and validated separately by validateMaintenanceBlock. Skip them here.
    if (w.phase === 'maintenance_restoration' || w.phase === 'maintenance_base') continue
    const isRaceWeek = w.type === 'race'
    const sessions = Object.entries(w.sessions) as [Day, Session | undefined][]
    const placedRunning = sessions
      .filter(([, s]) => !!s && s.type !== 'strength' && s.type !== 'rest')
      .map(([d, s]) => ({ day: d, session: s! }))

    // INV-PLAN-WEEK-HAS-REST-DAY — every non-race week has at least one
    // rest day. Seven-on is overreaching dressed as commitment.
    // (CoachingPrinciples §64 — day-level rest sits beneath the §3 weekly
    //  recovery cadence. Without it, easy days absorb someone else's
    //  recovery duty and creep hot.)
    if (!isRaceWeek && !weekHasRestDay(sessions.map(([, s]) => s))) {
      violations.push({
        code: 'INV-PLAN-WEEK-HAS-REST-DAY',
        principle_ref: 'CoachingPrinciples §64',
        severity: 'error',
        week: w.n,
        message: 'Week has no rest day',
        actual: 0,
        expected: '>= 1 rest day per week',
      })
    }

    // INV-PLAN-NO-SESSIONS-ON-BLOCKED-DAYS — every placed session lands on an
    // unblocked day, including in race week.
    // (CoachingPrinciples §18 — life-first scheduling. Hardcoded race-week
    //  shakeout patterns broke this in 2026-04-27 review for all three cases.)
    //
    // THE RACE IS EXCLUDED (fixed 2026-08-20) — restoring §77's documented
    // intent, which this check contradicted. §77: the race sits on the ACTUAL
    // weekday of race_date and "deliberately ignores `days_cannot_train`: the
    // race is an external fixed event, not a training session, and a runner who
    // cannot train on Wednesdays can still race on one" (ruleEngine.ts:1230).
    // The engine was right; this invariant was wrong, and flagged the runner's
    // own race as a scheduling defect whenever race day fell on a blocked day.
    //
    // Invisible until 2026-08-20 because the property sweep passed the day
    // constraint as `blocked_days` — a field GeneratorInput does not have, so
    // the engine read `days_cannot_train` as undefined and every blocked-day row
    // in the grid was inert. Renaming it surfaced 2,954 violations, all of them
    // the race. Same class as SWEEP-VACUOUS-01, in the file just repaired for it:
    // AN INPUT THE ENGINE NEVER READS TESTS NOTHING. The sweep is typed `any`,
    // which is why tsc never caught it.
    //
    // The same carve-out §1's numerator makes for the same reason — the race is
    // the goal, not training.
    for (const [day, session] of sessions) {
      if (!session || session.type === 'rest' || session.type === 'race') continue
      if (blocked.has(day)) {
        violations.push({
          code: 'INV-PLAN-NO-SESSIONS-ON-BLOCKED-DAYS',
          principle_ref: 'CoachingPrinciples §18',
          severity: 'error',
          week: w.n, day,
          message: 'Session placed on a day listed in days_cannot_train',
          actual: day,
          expected: 'unblocked day',
        })
      }
    }

    // INV-PLAN-RACE-WEEK-SHARPENING — race week (final 7 days) bans tempo,
    // threshold, progression, hill, and long-run sessions. Permits short
    // sharpening reps at race pace and shakeouts only.
    // (CoachingPrinciples §26)
    if (isRaceWeek) {
      const RACE_WEEK_BANNED = ['tempo', 'threshold', 'cruise', 'progression', 'hill', 'vo2max', 'vo2 max']
      for (const { day, session } of placedRunning) {
        if (session.type !== 'quality') continue
        const label = (session.label ?? '').toLowerCase()
        const banned = RACE_WEEK_BANNED.find(b => label.includes(b))
        if (banned) {
          violations.push({
            code: 'INV-PLAN-RACE-WEEK-SHARPENING',
            principle_ref: 'CoachingPrinciples §26',
            severity: 'error',
            week: w.n, day,
            message: `Race week prescribes prohibited "${banned}" session ("${session.label}") — only sharpening reps allowed`,
            actual: session.label ?? 'unknown',
            expected: 'sharpening reps at race pace',
          })
        }
      }
    }

    // INV-PLAN-RACE-SPECIFIC-EXPOSURE — time-targeted plans get race-specific
    // quality in second-half build/peak weeks. VO2max sessions exempt — their
    // physiology is too valuable to lose.
    // Per-week catch: any non-VO2max quality without "pace" in the label
    // (CoachingPrinciples §22). The plan-level ratio check below catches the
    // looseness this guard misses (R2/H-02).
    if (isTimeTarget && w.n >= halfWeek && (w.phase === 'build' || w.phase === 'peak') && w.type !== 'deload') {
      for (const { day, session } of placedRunning) {
        if (session.type !== 'quality') continue
        // SC-09 — STRUCTURAL, not by name. The label test held while every
        // VO2max session was called "… VO2max"; `hill_reps` is vo2max work
        // labelled "Hill reps — 45s", and the exemption silently stopped
        // applying to it (D-17).
        if (isVo2maxSession(session, V1_SESSION_CATALOGUE)) continue
        // A1 / D-17 — detect goal-pace work STRUCTURALLY via the stamped
        // `stimulus` (classifyStimulus reads session.stimulus first), NOT the
        // label substring. The generator stamps `stimulus: 'race_pace'` at
        // construction (ruleEngine §CLASSIFY-STIMULUS-01); the enricher may
        // rewrite the label ("10K-pace intervals" → "Speed intervals") but can
        // NEVER set stimulus (EnrichedWeekSchema picks only label + coach_notes).
        // The old `label.includes('pace')` test tripped on those rewrites and
        // silently discarded the whole enriched plan (post_enrich_invalid),
        // costing trial/paid users their AI voice. Legacy pre-stamp plans fall
        // back to the same label heuristic inside classifyStimulus — no regression.
        if (classifyStimulus(session) !== 'race_pace') {
          violations.push({
            code: 'INV-PLAN-RACE-SPECIFIC-EXPOSURE',
            principle_ref: 'CoachingPrinciples §22',
            severity: 'error',
            week: w.n, day,
            message: `Time-targeted plan: second-half ${w.phase} quality "${session.label}" is not goal-pace work`,
            actual: session.label ?? 'unknown',
            expected: 'race-distance-named (e.g. "10K-pace intervals")',
          })
        }
      }
    }

    // INV-PLAN-COPY-MATCHES-SESSIONS — weekly copy (label AND theme) must not
    // contradict the prescription. "highest volume" / "fitness is built" requires
    // overload vs prior non-deload week; "intensity stays" requires ≥1
    // quality session. (CoachingPrinciples §27, §41. Supersedes the retired
    // INV-PLAN-THEME-MATCHES-PRESCRIPTION denylist — GEN-FIX-06 / N4.)
    // Foundation weeks are exempt: their themes describe preparation, not
    // periodisation progress — overload and quality rules don't apply.
    if (w.phase !== 'foundation') {
      const themeText = (w.theme ?? '').toLowerCase()
      const qualityCount = Object.values(w.sessions).filter(s => s?.type === 'quality').length
      const prevNonDeload = plan.weeks.slice(0, plan.weeks.indexOf(w)).reverse().find(p => p.type !== 'deload')

      // INV-PLAN-COPY-MATCHES-SESSIONS (CoachingPrinciples §27) — replaces the
      // former four-literal denylist ("highest volume", "fitness is built",
      // "intensity stays", "feel hard"). That version checked specific known-bad
      // strings rather than the rule, so "One quality session. Everything else
      // stays easy." and "Build — first quality session" walked straight past it
      // over three easy runs, for fourteen weeks (analysis F4 / N4).
      //
      // The rule: copy that names a session type, or claims an overload, must be
      // true of THIS week. Applies to the theme AND the label — the label was
      // never checked at all before.
      const labelText = (w.label ?? '').toLowerCase()
      const copy = `${labelText} | ${themeText}`
      const hasIntensity = placedRunning.some(({ session }) =>
        session.type === 'quality' || session.type === 'intervals' || session.type === 'tempo')
      const hasBenchmark = placedRunning.some(({ session }) => session.type === 'hard')

      // Each claim names what must be present for it to be honest.
      const CLAIMS: Array<{ test: RegExp; ok: boolean; needs: string }> = [
        { test: /quality|threshold|tempo|interval|vo2/,      ok: hasIntensity || hasBenchmark, needs: 'an intensity session' },
        { test: /sharpen|raising the ceiling|intensity stays/, ok: hasIntensity,                 needs: 'an intensity session' },
        { test: /feels? hard/,                                ok: hasIntensity || hasBenchmark, needs: 'a hard session' },
        { test: /benchmark|time trial/,                       ok: hasBenchmark,                 needs: 'a benchmark session' },
      ]
      for (const { test, ok, needs } of CLAIMS) {
        if (test.test(copy) && !ok) {
          violations.push({
            code: 'INV-PLAN-COPY-MATCHES-SESSIONS',
            principle_ref: 'CoachingPrinciples §27',
            severity: 'error',
            week: w.n,
            message: `Week copy promises what the week does not contain — "${w.label}" / "${w.theme}" requires ${needs}`,
            actual: 'no matching session',
            expected: needs,
          })
          break
        }
      }

      // Overload claims are about the plan, not just the week.
      if (/highest volume|fitness is built/.test(copy)
          && prevNonDeload
          && w.weekly_km <= prevNonDeload.weekly_km) {
        violations.push({
          code: 'INV-PLAN-COPY-MATCHES-SESSIONS',
          principle_ref: 'CoachingPrinciples §27',
          severity: 'error',
          week: w.n,
          message: `Copy implies overload but weekly_km ${w.weekly_km}km <= prior non-deload ${prevNonDeload.weekly_km}km`,
          actual: `${w.weekly_km}km vs ${prevNonDeload.weekly_km}km`,
          expected: `> ${prevNonDeload.weekly_km}km`,
        })
      }
    }

    // INV-PLAN-COACH-NOTES-MATCH-INTENT — coach notes must match session
    // label/intent, not leak from the underlying catalogue row.
    // (CoachingPrinciples §33)
    for (const { day, session } of placedRunning) {
      if (session.type !== 'quality') continue
      const label = (session.label ?? '').toLowerCase()
      const notes = (session.coach_notes ?? []).join(' ').toLowerCase()
      const isVo2 = label.includes('vo2max') || label.includes('vo2 max')
      // LABEL-VARIETY-01 — the goal-pace override now carries the row's shape as
      // its trailing word ("10K-pace ladder", "…-pace tempo"), not a fixed
      // "intervals", so key on the stable "-pace " fragment rather than one form.
      const isGoalPace = label.includes('-pace ') || label.includes('mp ') || label.includes('mp.')

      const banned: { label: string; phrase: string }[] = []
      if (isVo2 || isGoalPace) {
        banned.push({ label, phrase: 'boring is the point' })
        banned.push({ label, phrase: 'if it feels productive' })
      }
      for (const b of banned) {
        if (notes.includes(b.phrase)) {
          violations.push({
            code: 'INV-PLAN-COACH-NOTES-MATCH-INTENT',
            principle_ref: 'CoachingPrinciples §33',
            severity: 'error',
            week: w.n, day,
            message: `"${session.label}" carries note containing "${b.phrase}" — aerobic cue on a quality session`,
            actual: b.phrase,
            expected: 'voice matching session intent',
          })
        }
      }
    }

    // INV-PLAN-INJURY-NO-HILLS — runners with hill-restricting injury history
    // (knee, ITB, Achilles, shin, calf, plantar) get no hill sessions in ANY
    // phase. §21's peak reintroduction is gated on a symptom-free build that is
    // not yet wired, so peak is NOT exempt until it is. (CoachingPrinciples §21)
    {
      const hasRestricting = (input.injury_history ?? []).some(i => {
        const lower = i.toLowerCase()
        return GENERATION_CONFIG.HILL_RESTRICTING_INJURIES.some(k => lower.includes(k))
      })
      if (hasRestricting) {
        for (const { day, session } of placedRunning) {
          // SC-09 — structural first, label second. The label check alone is
          // D-17: the enricher rewrites labels, and a renamed hill session
          // would have slipped past silently. `catalogue_id` (ADR-018) makes
          // the real test available, and the v2 row states `terrain: 'uphill'`
          // on the step itself.
          const row = session.catalogue_id
            ? V1_SESSION_CATALOGUE.find(r => r.id === session.catalogue_id)
            : undefined
          const structuralHill = !!row && (() => {
            const m = row.main_set_structure as {
              terrain?: string
              blocks?: Array<{ steps?: Array<{ terrain?: string }> }>
            }
            if (m.terrain === 'hills') return true
            for (const b of m.blocks ?? []) {
              for (const st of b.steps ?? []) {
                if (st.terrain === 'uphill' || st.terrain === 'downhill') return true
              }
            }
            return false
          })()
          const label = (session.label ?? '').toLowerCase()
          if (structuralHill || label.includes('hill')) {
            violations.push({
              code: 'INV-PLAN-INJURY-NO-HILLS',
              principle_ref: 'CoachingPrinciples §21',
              severity: 'error',
              week: w.n, day,
              message: `Hill session "${session.label}" prescribed in ${w.phase} phase despite injury_history`,
              actual: session.label ?? 'unknown',
              expected: 'no hill session',
            })
          }
        }
      }
    }

    // INV-PLAN-RETURNING-INTENSITY-REENTRY — a returning runner's aerobic engine
    // returns ahead of their tissue tolerance, so when the engine lifts (or the
    // user raises) their intensity, the highest tissue-stress quality (VO2max
    // intervals + hill reps, both catalogue category 'vo2max') is withheld for the
    // opening `intensity_reentry_weeks`. Detected structurally via catalogue_id →
    // category (ADR-018), not the label (which the enricher rewrites).
    // (CoachingPrinciples §79)
    if (plan.meta.intensity_reentry_active && w.n <= (plan.meta.intensity_reentry_weeks ?? 0)) {
      for (const { day, session } of placedRunning) {
        const row = session.catalogue_id
          ? V1_SESSION_CATALOGUE.find(r => r.id === session.catalogue_id)
          : undefined
        if (row?.category === 'vo2max') {
          violations.push({
            code: 'INV-PLAN-RETURNING-INTENSITY-REENTRY',
            principle_ref: 'CoachingPrinciples §79',
            severity: 'error',
            week: w.n, day,
            message: `VO2max/hill session "${session.label}" prescribed in week ${w.n}, inside the ${plan.meta.intensity_reentry_weeks}-week returning-runner intensity re-entry — tempo/threshold only until tissue rebuilds`,
            actual: `${row.id} (vo2max) in re-entry week ${w.n}`,
            expected: `no vo2max/hill sessions in weeks 1–${plan.meta.intensity_reentry_weeks}`,
          })
        }
      }
    }

    // INV-PLAN-DURATION-ANCHORED-KEEPS-MINUTES — a session whose prescription is
    // time on feet (§80 finish-goal peak long run, duration_anchored) must carry a
    // real duration_mins and stay duration-primary; a distance number must never
    // become its headline. "Two and a half hours of moving" is a different object
    // from "18 kilometres" and only one survives a walk break. (CoachingPrinciples §80)
    for (const { day, session } of placedRunning) {
      if (!session.duration_anchored) continue
      if (!(typeof session.duration_mins === 'number' && session.duration_mins > 0) || session.primary_metric !== 'duration') {
        violations.push({
          code: 'INV-PLAN-DURATION-ANCHORED-KEEPS-MINUTES',
          principle_ref: 'CoachingPrinciples §80',
          severity: 'error',
          week: w.n, day,
          message: `Duration-anchored session "${session.label}" must keep duration_mins and stay duration-primary (time on feet), got primary_metric="${session.primary_metric}", duration_mins=${session.duration_mins}`,
          actual: `primary_metric=${session.primary_metric}, duration_mins=${session.duration_mins}`,
          expected: 'primary_metric=duration with duration_mins > 0',
        })
      }
    }

    // INV-PLAN-LABEL-MATCHES-PACE — session name carries physiological meaning.
    // Two layers: zone tag must match label, AND prescribed pace must land in
    // the right physiological band when VDOT is available.
    // (CoachingPrinciples §19, §10 — VO2max uses raw VDOT; threshold uses
    // discounted training anchor.)
    for (const { day, session } of placedRunning) {
      if (session.type !== 'quality') continue
      const label = (session.label ?? '').toLowerCase()
      const zone = (session.zone ?? '').toLowerCase()
      const labelImpliesVo2 = label.includes('vo2max') || label.includes('vo2 max')
      const labelImpliesThreshold = label.includes('threshold') || label.includes('tempo') || label.includes('cruise')
      const zoneIsVo2 = zone.includes('zone 4') || zone.includes('zone 5')
      const zoneIsThreshold = zone.includes('zone 3') && !zone.includes('zone 4')

      if (labelImpliesVo2 && !zoneIsVo2) {
        violations.push({
          code: 'INV-PLAN-LABEL-MATCHES-PACE',
          principle_ref: 'CoachingPrinciples §19',
          severity: 'error',
          week: w.n, day,
          message: `Session labelled "${session.label}" implies VO2max but zone is "${session.zone}" — rename or re-target pace`,
          actual: session.zone ?? 'unknown',
          expected: 'Zone 4 or 5',
        })
      }
      if (labelImpliesThreshold && !labelImpliesVo2 && !zoneIsThreshold && !zoneIsVo2) {
        violations.push({
          code: 'INV-PLAN-LABEL-MATCHES-PACE',
          principle_ref: 'CoachingPrinciples §19',
          severity: 'error',
          week: w.n, day,
          message: `Session labelled "${session.label}" implies threshold but zone is "${session.zone}"`,
          actual: session.zone ?? 'unknown',
          expected: 'Zone 3 (or higher)',
        })
      }

      // SC-02 / CD-15 — the INVERSE direction, which was missing.
      //
      // Every check above asks "the label claims hard work, is the pace hard?"
      // None asked "the label claims EASY work, is the pace easy?" So a quality
      // session named "Steady aerobic" and prescribed at T-pace in Zone 3–4
      // raised nothing — it contains none of the words vo2max/tempo/cruise/
      // threshold. That shipped to every 5K and 10K runner in build phase.
      // This is the CD-1 pathology inverted: not five names on one pace, but
      // one honest name on the wrong pace.
      //
      // Label-based by necessity, not by choice: the plan session carries no
      // catalogue category to key off (the seventh gap — SC-08). When SC-08
      // lands, re-key this on the structural category per INV-CLASS.
      const labelImpliesEasy = label.includes('easy') || label.includes('steady')
        || label.includes('aerobic') || label.includes('recovery')
      const zoneIsEasy = zone.includes('zone 1') || zone.includes('zone 2')
      if (labelImpliesEasy && !zoneIsEasy) {
        violations.push({
          code: 'INV-PLAN-LABEL-MATCHES-PACE',
          principle_ref: 'CoachingPrinciples §19',
          severity: 'error',
          week: w.n, day,
          message: `Quality session labelled "${session.label}" implies easy/aerobic work but zone is "${session.zone}" — rename it or prescribe it easy (§19; §12 easy-run ceiling)`,
          actual: session.zone ?? 'unknown',
          expected: 'a label that does not imply easy work',
        })
      }

      // Numeric pace check — only when VDOT is on the plan and a pace target
      // is actually prescribed. Tolerance ±5% (VO2max) / ±3% (threshold) is
      // looser than the prescription's own ±2%, leaving headroom for display
      // rounding while still catching whole-band mislabels.
      if (plan.meta.vdot && session.pace_target) {
        const mid = parsePaceMidpoint(session.pace_target)
        if (mid != null) {
          if (labelImpliesVo2) {
            const expected = paceFromVdot(plan.meta.vdot, 0.975)
            if (Math.abs(mid - expected) / expected > 0.05) {
              violations.push({
                code: 'INV-PLAN-LABEL-MATCHES-PACE',
                principle_ref: 'CoachingPrinciples §19',
                severity: 'error',
                week: w.n, day,
                message: `"${session.label}" pace midpoint ${mid.toFixed(2)}/km is not within ±5% of vVO2max ${expected.toFixed(2)}/km (raw VDOT ${plan.meta.vdot})`,
                actual: mid.toFixed(2),
                expected: expected.toFixed(2),
              })
            }
          } else if (labelImpliesThreshold && !labelImpliesVo2) {
            const anchorVdot = plan.meta.vdot_training_anchor ?? plan.meta.vdot
            const expected = paceFromVdot(anchorVdot, 0.855)
            if (Math.abs(mid - expected) / expected > 0.03) {
              violations.push({
                code: 'INV-PLAN-LABEL-MATCHES-PACE',
                principle_ref: 'CoachingPrinciples §19',
                severity: 'error',
                week: w.n, day,
                message: `"${session.label}" pace midpoint ${mid.toFixed(2)}/km is not within ±3% of T-pace ${expected.toFixed(2)}/km (training anchor ${anchorVdot})`,
                actual: mid.toFixed(2),
                expected: expected.toFixed(2),
              })
            }
          }
        }
      }
    }

    // INV-PLAN-MIN-SESSION-SIZE — every placed session ≥ MIN_SESSION_DISTANCE_KM
    // (CoachingPrinciples §9 — "Below these, the session is too short to be coaching-meaningful.")
    for (const { day, session } of placedRunning) {
      // Exempt the race and the §30 race-week shakeouts (intentionally below the
      // floor). Classify shakeouts STRUCTURALLY — a race-week easy session — not
      // by label. The AI enricher rewrites labels, so a label-only exemption
      // (isShakeout) was silently lost on enrichment: the renamed 3 km shakeout
      // tripped this floor, and route.ts reverted the whole enriched plan to rule
      // copy (D-17 — never couple logic to a display string). isShakeout kept as a
      // legacy fallback for any pre-race-week-typed plans.
      if (session.type === 'race') continue
      if (isRaceWeek && session.type === 'easy') continue
      if (isShakeout(session)) continue
      const isLong = isLongRun(session)
      // SECONDARY QUALITY HAS ITS OWN FLOOR (fixed 2026-08-20). The config
      // declares `secondary_quality: 4` alongside `quality: 5`, and the engine
      // honours it — `Math.max(roundDist(qualKm * secondaryFraction),
      // minDist.secondary_quality)`. This check ignored it and measured every
      // quality session against the primary floor, so a correctly-sized 4.5km
      // second session was reported as a defect.
      //
      // Identified STRUCTURALLY: in a week carrying more than one quality
      // session, the largest is the primary and the rest are secondary. That is
      // the same relationship the engine creates by construction
      // (SECONDARY_QUALITY_PCT_OF_PRIMARY = 80), so the two cannot disagree.
      const qualityKmsThisWeek = sessions
        .map(([, sn]) => sn)
        .filter((sn): sn is NonNullable<typeof sn> => !!sn && sn.type === 'quality')
        .map(sn => sn.distance_km ?? 0)
      const isSecondaryQuality = session.type === 'quality'
        && qualityKmsThisWeek.length > 1
        && (session.distance_km ?? 0) < Math.max(...qualityKmsThisWeek)

      const expected = isLong ? minDist.long
        : isSecondaryQuality ? minDist.secondary_quality
        : session.type === 'quality' ? minDist.quality
        : minDist.easy
      const dist = session.distance_km ?? 0
      if (session.distance_km != null && dist < expected) {
        violations.push({
          code: 'INV-PLAN-MIN-SESSION-SIZE',
          principle_ref: 'CoachingPrinciples §9',
          severity: 'error',
          week: w.n, day,
          message: `Session ${session.type} below configured floor`,
          actual: dist,
          expected,
        })
      }
      if ((session.duration_mins ?? 0) === 0 && (session.distance_km ?? 0) === 0) {
        violations.push({
          code: 'INV-PLAN-EMPTY-SESSION',
          principle_ref: 'CoachingPrinciples §9',
          severity: 'error',
          week: w.n, day,
          message: 'Placed session has zero distance AND zero duration',
          actual: 0,
          expected: '> 0',
        })
      }
    }

    // INV-PLAN-LONG-IS-LONGEST — long ≥ minRatio × any easy run in the same week
    // (CoachingPrinciples §9 — long run is always the longest run of the week)
    if (!isRaceWeek) {
      const long = placedRunning.find(({ session }) => isLongRun(session))
      const easies = placedRunning.filter(({ session }) =>
        session.type === 'easy' && !isLongRun(session) && !isShakeout(session))
      if (long?.session.distance_km != null) {
        for (const { day, session } of easies) {
          if (session.distance_km == null) continue
          if (session.distance_km * minRatio > long.session.distance_km + 0.01) {
            violations.push({
              code: 'INV-PLAN-LONG-IS-LONGEST',
              principle_ref: 'CoachingPrinciples §9',
              severity: 'error',
              week: w.n, day,
              message: `Easy run inverts long-vs-easy ratio (long ${long.session.distance_km} km vs easy ${session.distance_km} km, min ratio ${minRatio})`,
              actual: long.session.distance_km / session.distance_km,
              expected: `≥ ${minRatio}`,
            })
          }
        }
      }
    }

    // INV-PLAN-LONG-CAP-MINS — long run duration ≤ LONG_RUN_CAP_MINUTES[distance]
    // (CoachingPrinciples §9 — absolute time ceiling per race distance)
    const long = placedRunning.find(({ session }) => isLongRun(session))
    if (long?.session.duration_mins != null && long.session.duration_mins > longCapMins) {
      violations.push({
        code: 'INV-PLAN-LONG-CAP-MINS',
        principle_ref: 'CoachingPrinciples §9',
        severity: 'error',
        week: w.n, day: long.day,
        message: 'Long run duration exceeds absolute cap for race distance',
        actual: long.session.duration_mins,
        expected: `≤ ${longCapMins}`,
      })
    }

    // INV-PLAN-WEEK-1-2-LONG-CAP — first two weeks: long ≤ longest_recent_run × 1.10
    // (CoachingPrinciples §9 / spec 3.6). Floor takes precedence when the cap
    // falls below MIN_SESSION_DISTANCE_KM.long — a session below floor is
    // not coaching-meaningful, so the engine clamps to floor and accepts the
    // higher early-week long.
    if (w.n <= 2 && input.longest_recent_run_km > 0 && long?.session.distance_km != null) {
      const rawCap = input.longest_recent_run_km * GENERATION_CONFIG.WEEK_1_2_LONG_RUN_CAP_MULTIPLIER
      const effectiveCap = Math.max(rawCap, minDist.long)
      if (long.session.distance_km > effectiveCap + 0.01) {
        violations.push({
          code: 'INV-PLAN-WEEK-1-2-LONG-CAP',
          principle_ref: 'CoachingPrinciples §9',
          severity: 'error',
          week: w.n, day: long.day,
          message: `Week ${w.n} long run exceeds longest_recent_run × ${GENERATION_CONFIG.WEEK_1_2_LONG_RUN_CAP_MULTIPLIER}`,
          actual: long.session.distance_km,
          expected: `≤ ${effectiveCap.toFixed(1)}`,
        })
      }
    }

    // INV-PLAN-QUALITY-PER-WEEK — quality count ≤ QUALITY_SESSIONS_PER_WEEK_MAX[fitness]
    // (CoachingPrinciples §8)
    if (qualityMaxPerWeek !== undefined) {
      const qualityCount = placedRunning.filter(({ session }) => session.type === 'quality').length
      if (qualityCount > qualityMaxPerWeek) {
        violations.push({
          code: 'INV-PLAN-QUALITY-PER-WEEK',
          principle_ref: 'CoachingPrinciples §8',
          severity: 'error',
          week: w.n,
          message: `Quality session count exceeds fitness ceiling (${fitness})`,
          actual: qualityCount,
          expected: `≤ ${qualityMaxPerWeek}`,
        })
      }
    }

    // INV-PLAN-QUALITY-LONG-SPACING — ≥ MIN_HOURS_BETWEEN_QUALITY_AND_LONG between quality and long
    // (CoachingPrinciples §7 — heavy legs from quality the day before is the most reliable injury vector)
    // Single-source-of-truth helper (D-08): findQualityLongSpacingViolations()
    // is also called by buildReorderAdjustment at move time. Decision #4.
    const spacingViolations = findQualityLongSpacingViolations(
      DAYS.map(d => w.sessions[d]),
      minDaysQualLong,
    )
    for (const v of spacingViolations) {
      violations.push({
        code: 'INV-PLAN-QUALITY-LONG-SPACING',
        principle_ref: 'CoachingPrinciples §7',
        severity: 'error',
        week: w.n, day: v.qualityDay,
        message: 'Quality session too close to long run',
        actual: v.gap,
        expected: `≥ ${minDaysQualLong} day(s)`,
      })
    }

    // INV-PLAN-QUALITY-EXPECTED — build/peak/taper non-deload weeks with
    // intermediate/experienced fitness and no quality suppression must place
    // at least one quality session, unless every eligible day is blocked.
    // (CoachingPrinciples §1, §6, §8 — quality work drives fitness adaptation
    // beyond base aerobic capacity. Skipping it across an entire build/peak
    // phase is a coaching defect, not a tuning choice.)
    if (!isRaceWeek && w.phase && w.phase !== 'base' && w.phase !== 'foundation' && w.type !== 'deload') {
      // §79 (2026-09-02) — "should this week have quality?" is an intensity
      // question, so read the intensity level where one is stamped. A returning
      // runner is structurally `beginner` but is deliberately given real quality;
      // reading the structural level would stop expecting it and silently retire
      // this check for exactly the cohort Phase 1 was built for.
      const planFitness = plan.meta.fitness_intensity_level ?? plan.meta.fitness_level
      const hsr = input.hard_session_relationship
      const hasAchilles = (input.injury_history ?? []).some(i => i.toLowerCase().includes('achilles'))
      const expectQuality = (planFitness === 'intermediate' || planFitness === 'experienced')
        && hsr !== 'avoid' && !hasAchilles
      // GEN-FIX-10 (§8, 2026-08-06) — a reshape may deliberately remove this
      // week's quality session when aerobic efficiency is falling or fatigue has
      // accumulated. That is the intervention working, and it is the product's
      // core thesis: back off when the body says so. This invariant asks "did
      // the GENERATOR build this correctly?", which is the wrong question of a
      // week the generator no longer owns — so it exempts an intentional,
      // recorded downgrade. It still fires when quality is simply absent.
      const intentionallyDowngraded = !!w.quality_downgraded
      if (expectQuality && !intentionallyDowngraded) {
        const eligibleDays: Day[] = ['wed','thu','tue','mon','fri']
        const blockedSet = new Set((input.days_cannot_train ?? []) as Day[])
        const anyEligibleUnblocked = eligibleDays.some(d => !blockedSet.has(d))
        const qualityCount = placedRunning.filter(({ session }) => session.type === 'quality').length
        if (anyEligibleUnblocked && qualityCount === 0) {
          violations.push({
            code: 'INV-PLAN-QUALITY-EXPECTED',
            principle_ref: 'CoachingPrinciples §1, §6, §8',
            severity: 'error',
            week: w.n,
            message: `${w.phase} week with ${planFitness} fitness expected ≥ 1 quality session; engine placed 0 with eligible day(s) available`,
            actual: 0,
            expected: '≥ 1',
          })
        }
      }
    }

    // INV-PLAN-MAX-WEEKDAY-MINS — weekday session duration ≤ user's stated cap
    // (CoachingPrinciples — life-first, plan-second)
    if (input.max_weekday_mins) {
      const weekdays: Day[] = ['mon','tue','wed','thu','fri']
      for (const d of weekdays) {
        const s = w.sessions[d]
        if (!s?.duration_mins) continue
        // §81 (Coaching Board, MWM-02, 2026-09-03) — the long run is EXEMPT from
        // the weekday cap. Capping it produces a "long run" that is not the
        // longest run of the week, trading §18 breaches for §9 breaches
        // (measured: 1,615 -> 979). Where the long run cannot fit the runner's
        // stated availability the engine states it and classifies maintenance,
        // rather than deforming the week — enforced by
        // INV-PLAN-LONG-RUN-FIT-STATED (below), not by this cap.
        // §81 — exempt the long run AND structured sessions. The engine
        // exemption in applyWeekdayMinsCap and this check MUST agree; an
        // engine exemption the validator does not share is a plan that fails
        // its own constitution.
        if (isLongRun(s) || isStructuredSession(s)) continue
        if (s.duration_mins > input.max_weekday_mins) {
          violations.push({
            code: 'INV-PLAN-MAX-WEEKDAY-MINS',
            principle_ref: 'CoachingPrinciples — life-first',
            severity: 'error',
            week: w.n, day: d,
            message: 'Weekday session duration exceeds user-specified cap',
            actual: s.duration_mins,
            expected: `≤ ${input.max_weekday_mins}`,
          })
        }
      }
    }
  }

  // Note: week-on-week volume cap (MAX_WEEKLY_VOLUME_INCREASE_PCT) is enforced
  // by the engine's buildVolumeSequence pass on the planning array. Output sums
  // can deviate due to session-level floors (e.g. week 1-2 with longest-recent
  // cap collides with MIN_SESSION_DISTANCE) — those are legitimate. This
  // invariant lives one layer up; it isn't checkable from the plan output alone.

  // INV-PLAN-RACE-SPECIFIC-LONG-RUN — time-targeted HM/marathon plans need
  // at least one peak-phase long run with race-pace finish.
  // (CoachingPrinciples §25)
  if (isTimeTarget && (distKey === 'HM' || distKey === 'MARATHON')) {
    const peakLongRuns = plan.weeks
      .filter(w => w.phase === 'peak' && w.type !== 'deload')
      .flatMap(w => Object.values(w.sessions).filter((s): s is Session =>
        !!s && isLongRun(s)
      ))
    const hasRaceSpecific = peakLongRuns.some(s => {
      const l = (s.label ?? '').toLowerCase()
      return l.includes('pace') || l.includes(' mp') || l.startsWith('mp')
    })
    if (peakLongRuns.length > 0 && !hasRaceSpecific) {
      violations.push({
        code: 'INV-PLAN-RACE-SPECIFIC-LONG-RUN',
        principle_ref: 'CoachingPrinciples §25',
        severity: 'error',
        week: 0,
        message: `Time-targeted ${distKey} plan: no peak long run with race-pace finish (all peak long runs are flat aerobic)`,
        actual: 0,
        expected: '≥ 1 race-specific long run',
      })
    }
  }

  // INV-PLAN-PEAK-LR-RACE-RATIO — time-targeted HM/marathon plans must reach
  // PEAK_LR_RATIO_VS_RACE × race distance in at least one peak-phase long run.
  // Subject to LONG_RUN_CAP_MINUTES — if the absolute time cap is below the
  // ratio floor, the cap wins and the invariant accepts the capped value.
  // Subject to §45 (long-run progression cap) — when the cap prevents reaching
  // the floor, the plan downgrades to maintenance and this invariant relaxes.
  // (CoachingPrinciples §24, §45)
  if (isTimeTarget && (distKey === 'HM' || distKey === 'MARATHON') && plan.meta.volume_profile !== 'maintenance') {
    const ratio = GENERATION_CONFIG.PEAK_LR_RATIO_VS_RACE[distKey]
    const requiredKm = input.race_distance_km * ratio
    const peakWeeks = plan.weeks.filter(w => w.phase === 'peak' && w.type !== 'deload')
    if (peakWeeks.length > 0) {
      const peakLrKm = Math.max(...peakWeeks.flatMap(w => {
        const long = Object.values(w.sessions).find(s =>
          s && isLongRun(s)
        )
        return long?.distance_km != null ? [long.distance_km] : [0]
      }))
      // Time-cap check — if even an unrounded long run at the time cap is below
      // requiredKm, the cap is binding and the invariant relaxes.
      const peakLongRunHrs = peakWeeks[0].long_run_hrs ?? 0
      const easyMinPerKm = peakLrKm > 0 && peakLongRunHrs > 0
        ? (peakLongRunHrs * 60) / peakLrKm
        : 7
      const capKm = longCapMins / Math.max(easyMinPerKm, 1)
      const effectiveRequired = Math.min(requiredKm, capKm)
      if (peakLrKm + 0.01 < effectiveRequired) {
        violations.push({
          code: 'INV-PLAN-PEAK-LR-RACE-RATIO',
          principle_ref: 'CoachingPrinciples §24',
          severity: 'error',
          week: 0,
          message: `Peak long run ${peakLrKm}km is below ${effectiveRequired.toFixed(1)}km (${Math.round(ratio * 100)}% of ${input.race_distance_km}km race)`,
          actual: peakLrKm,
          expected: `≥ ${effectiveRequired.toFixed(1)}`,
        })
      }
    }
  }

  // INV-PLAN-RACE-SPECIFIC-EXPOSURE-RATIO — plan-level numeric check. For
  // time-targeted plans, ≥50% of non-VO2max quality in second-half build/peak
  // weeks must prescribe pace within ±5% of goal pace.
  // (CoachingPrinciples §22, R2/H-02 — round-1 invariant only checked label
  // substring; this catches the looseness.)
  //
  // NO 5K CARVE-OUT HERE — and the reasoning is worth keeping, because one was
  // nearly added on bad evidence (2026-09-03).
  //
  // 155 sweep violations all read "0% (0/1)" at 5K, which looked like proof the
  // ratio was unsatisfiable there: goal pace ~ I-pace, so the goal-pace work
  // should be the VO2max work this check filters out. The board ruled to
  // exclude 5K on that basis.
  //
  // MEASURED AFTERWARDS, and it is false. Across 108 5K time-target plans, 168
  // of 168 non-VO2max quality sessions in build/peak sit within +/-5% of goal
  // pace — at 0% delta, because the engine prescribes "5K-pace progression",
  // "5K-pace sustained" and "5K-pace intervals", none of which are labelled
  // VO2max. The ratio is not merely satisfiable at 5K, it is satisfied
  // perfectly.
  //
  // The real cause was `halfWeek` (above): foundation weeks inflated
  // `totalWeeks`, moving the second-half boundary so the wrong weeks were
  // counted. Fixing that cleared all 155 on its own — an A/B with and without a
  // 5K skip returned identical sweep totals.
  //
  // Lesson: "0/N" in a violation message says the numerator was zero, NOT that
  // it could never be non-zero. Confirm unsatisfiability by measuring the
  // satisfying case, not by reading the failure.
  if (isTimeTarget && plan.meta.goal_pace_per_km) {
    const goalMid = parsePaceMidpoint(plan.meta.goal_pace_per_km)
    if (goalMid != null) {
      let nonVo2Quality = 0
      let goalPaceQuality = 0
      for (const w of plan.weeks) {
        if (w.n < halfWeek) continue
        if (w.phase !== 'build' && w.phase !== 'peak') continue
        if (w.type === 'deload') continue
        for (const session of Object.values(w.sessions)) {
          if (!session || session.type !== 'quality') continue
          const label = (session.label ?? '').toLowerCase()
          const isVo2 = label.includes('vo2max') || label.includes('vo2 max')
          if (isVo2) continue
          nonVo2Quality++
          if (!session.pace_target) continue
          const mid = parsePaceMidpoint(session.pace_target)
          if (mid == null) continue
          if (Math.abs(mid - goalMid) / goalMid <= 0.05) goalPaceQuality++
        }
      }
      if (nonVo2Quality > 0) {
        const ratio = goalPaceQuality / nonVo2Quality
        if (ratio < 0.5) {
          violations.push({
            code: 'INV-PLAN-RACE-SPECIFIC-EXPOSURE-RATIO',
            principle_ref: 'CoachingPrinciples §22',
            severity: 'error',
            week: 0,
            message: `Goal-pace ratio in second-half build/peak is ${Math.round(ratio*100)}% (${goalPaceQuality}/${nonVo2Quality}); spec ≥50%`,
            actual: `${Math.round(ratio*100)}%`,
            expected: '≥ 50%',
          })
        }
      }
    }
  }

  // INV-PLAN-TAPER-VARIETY — no two consecutive taper-phase quality sessions
  // share the same label + pace target. (CoachingPrinciples §36, R2/M-02)
  {
    const taperWeeks = plan.weeks.filter(w => w.phase === 'taper' && w.type !== 'race')
    let prev: { label: string; pace: string; weekN: number } | null = null
    for (const tw of taperWeeks) {
      const quality = Object.values(tw.sessions).find(s => s?.type === 'quality')
      if (!quality) { prev = null; continue }
      // Identify the session by its ROW, not its name (2026-08-20) — same
      // correction as INV-PLAN-QUALITY-VARIETY-FULL-PLAN. §22's goal-pace rename
      // collapses distinct rows into one string, so two genuinely different
      // taper sessions could read as a repeat. The row check is also strictly
      // STRONGER in the other direction: the same row appearing twice under two
      // different labels is a real repeat that the label check missed.
      const label = quality.catalogue_id ?? quality.label ?? ''
      const pace = quality.pace_target ?? ''
      if (prev && prev.label === label && prev.pace === pace) {
        violations.push({
          code: 'INV-PLAN-TAPER-VARIETY',
          principle_ref: 'CoachingPrinciples §36',
          severity: 'error',
          week: tw.n,
          message: `W${tw.n} repeats W${prev.weekN}'s taper quality ("${quality.label}" @ ${pace}). Vary the stimulus.`,
          actual: label,
          expected: 'distinct from prior taper week',
        })
      }
      prev = { label, pace, weekN: tw.n }
    }
  }

  // INV-PLAN-PEAK-OVER-BASE — plans of PEAK_OVERLOAD_MIN_PLAN_WEEKS weeks or
  // longer must either have peak ≥ PEAK_OVER_BASE_RATIO × W1, or be classified
  // as 'maintenance'. (CoachingPrinciples §23)
  if (totalWeeks >= GENERATION_CONFIG.PEAK_OVERLOAD_MIN_PLAN_WEEKS) {
    // W1 = first non-foundation week (foundation weeks are pre-plan; they must
    // not be used as the base volume reference for peak overload calculation).
    const w1 = (plan.weeks.find(w => w.phase !== 'foundation') ?? plan.weeks[0])?.weekly_km ?? 0
    const peakWeeks = plan.weeks.filter(w => w.phase === 'peak')
    if (w1 > 0 && peakWeeks.length > 0) {
      const peakKm = Math.max(...peakWeeks.map(w => w.weekly_km))
      const ratio = peakKm / w1
      if (ratio < GENERATION_CONFIG.PEAK_OVER_BASE_RATIO && plan.meta.volume_profile !== 'maintenance') {
        violations.push({
          code: 'INV-PLAN-PEAK-OVER-BASE',
          principle_ref: 'CoachingPrinciples §23',
          severity: 'error',
          week: 0,
          message: `Peak volume ${peakKm}km is ${Math.round(ratio * 100)}% of W1 ${w1}km — below ${Math.round(GENERATION_CONFIG.PEAK_OVER_BASE_RATIO * 100)}% threshold and not flagged as maintenance`,
          actual: `${Math.round(ratio * 100)}%`,
          expected: `≥ ${Math.round(GENERATION_CONFIG.PEAK_OVER_BASE_RATIO * 100)}% or volume_profile=maintenance`,
        })
      }
    }
  }

  // INV-PLAN-VDOT-RAW-EXCEEDS-ANCHOR — when a benchmark is present, surfaced
  // VDOT is the raw value (matches Daniels' tables) and is ≥ the training
  // anchor (which has the conservatism discount applied).
  // (CoachingPrinciples §20 — auditable VDOT surface.)
  if (input.benchmark && plan.meta.vdot !== undefined && plan.meta.vdot_training_anchor !== undefined) {
    if (plan.meta.vdot < plan.meta.vdot_training_anchor - 0.05) {
      violations.push({
        code: 'INV-PLAN-VDOT-RAW-EXCEEDS-ANCHOR',
        principle_ref: 'CoachingPrinciples §20',
        severity: 'error',
        week: 0,
        message: `Surfaced raw VDOT (${plan.meta.vdot}) is below training anchor (${plan.meta.vdot_training_anchor}) — discount logic inverted`,
        actual: plan.meta.vdot,
        expected: `≥ ${plan.meta.vdot_training_anchor}`,
      })
    }
  }

  // INV-PLAN-PREP-TIME-STATUS-ANNOTATED — every plan output carries
  // prep_time_status. (CoachingPrinciples §44 — block-status inputs throw
  // before reaching this code, so any plan that exists must annotate either
  // 'ok' or 'warned'.)
  if (!plan.meta.prep_time_status) {
    violations.push({
      code: 'INV-PLAN-PREP-TIME-STATUS-ANNOTATED',
      principle_ref: 'CoachingPrinciples §44',
      severity: 'error',
      week: 0,
      message: 'Plan meta missing prep_time_status — every plan must surface its prep-time status',
      actual: 'undefined',
      expected: "'ok' | 'warned'",
    })
  }
  if (plan.meta.prep_time_status === 'warned'
      && (!plan.meta.prep_time_warning || !plan.meta.prep_time_alternatives)) {
    violations.push({
      code: 'INV-PLAN-PREP-TIME-STATUS-ANNOTATED',
      principle_ref: 'CoachingPrinciples §44',
      severity: 'error',
      week: 0,
      message: 'Plans generated under warn must surface prep_time_warning and prep_time_alternatives',
      actual: `warning=${!!plan.meta.prep_time_warning} alternatives=${!!plan.meta.prep_time_alternatives}`,
      expected: 'both present',
    })
  }

  // INV-PLAN-DIFFICULTY-ANNOTATED — every generated plan carries a difficulty
  // band. (CoachingPrinciples §44 amendment — block-status inputs throw before
  // reaching here, so any plan that exists must surface a demand label.)
  if (!plan.meta.difficulty_band) {
    violations.push({
      code: 'INV-PLAN-DIFFICULTY-ANNOTATED',
      principle_ref: 'CoachingPrinciples §44',
      severity: 'error',
      week: 0,
      message: 'Plan meta missing difficulty_band — every plan must surface its demand label',
      actual: 'undefined',
      expected: "'comfortable' | 'demanding' | 'very_demanding'",
    })
  }

  // INV-PLAN-DIFFICULTY-NEVER-FRONTS-UNSAFE — the demand label may never be more
  // reassuring than the plan's own honesty signals. (CoachingPrinciples §44
  // amendment / Coaching Board 2026-08-18: a friendly band must not front a
  // warned timeline or an input-constrained plan.)
  //   (1) prep_time_status 'warned'                 → band MUST be 'very_demanding'
  //   (2) compression_classification constrained    → band MUST NOT be 'comfortable'
  if (plan.meta.difficulty_band) {
    if (plan.meta.prep_time_status === 'warned' && plan.meta.difficulty_band !== 'very_demanding') {
      violations.push({
        code: 'INV-PLAN-DIFFICULTY-NEVER-FRONTS-UNSAFE',
        principle_ref: 'CoachingPrinciples §44',
        severity: 'error',
        week: 0,
        message: `Plan generated under a prep-time warning must read 'very_demanding', not '${plan.meta.difficulty_band}'`,
        actual: plan.meta.difficulty_band,
        expected: "'very_demanding'",
      })
    }
    if (plan.meta.compression_classification === 'constrained_by_inputs'
        && plan.meta.difficulty_band === 'comfortable') {
      violations.push({
        code: 'INV-PLAN-DIFFICULTY-NEVER-FRONTS-UNSAFE',
        principle_ref: 'CoachingPrinciples §44',
        severity: 'error',
        week: 0,
        message: "Input-constrained plan (constrained_by_inputs) must not read 'comfortable'",
        actual: 'comfortable',
        expected: "'demanding' | 'very_demanding'",
      })
    }
  }

  // INV-PLAN-RACE-SPECIFIC-EXPOSURE, extended (§22, §5 — CD-18 / SC-05):
  // "specific" must resolve to a REAL catalogue entry, not a rename.
  //
  // 10K had no race-specific session while HM had two. The gap was invisible
  // because the engine papered over it — §33 sanctions renaming a borrowed row
  // to "10K-pace progression" and correctly replaces the voice, so the plan
  // LOOKED like it contained 10K-pace work. The board's finding was sharper
  // than the audit's: §33 closed the review by fixing the symptom and left the
  // cause in place. A principle can close a review without closing a gap.
  //
  // This checks AVAILABILITY rather than presence: a distance whose race pace
  // is physiologically distinct must own a race-pace entry, so the all-distance
  // `goal_pace_sharpener` can never again be the only thing standing in for it.
  // Deliberately not plan-shape-dependent — it holds for every plan at these
  // distances regardless of phase layout.
  //
  // 5K is EXCLUDED, and that is an engineering judgement flagged for the board
  // (SC-05): at 5K, race pace and I-pace largely coincide, so the VO2max rows
  // already deliver race-specific physiology. The board's CD-18 aside said 5K
  // has "the identical gap"; the audit's own analysis says the mismatch is that
  // for a 10K "race pace sits between threshold and VO2max" — which does not
  // transfer to 5K. If the board disagrees, add a 5K row and this list.
  {
    const distinct: readonly string[] = GENERATION_CONFIG.RACE_PACE_DISTINCT_FROM_INTERVAL_PACE
    if (isTimeTarget && distinct.includes(distKey)) {
      // "Its own entry" = a row that does NOT cover every distance the config
      // knows about. Derived from the config's own distance list rather than a
      // literal 6, so adding a race distance can never silently invalidate this.
      const allDistances = Object.keys(GENERATION_CONFIG.INTENSITY_DISTRIBUTION).length
      const hasOwnRaceRow = V1_SESSION_CATALOGUE.some(r =>
        r.category === 'race_specific'
        && (r.distance_eligibility as readonly string[]).includes(distKey)
        && r.distance_eligibility.length < allDistances)
      if (!hasOwnRaceRow) {
        violations.push({
          code: 'INV-PLAN-RACE-SPECIFIC-EXPOSURE',
          principle_ref: 'CoachingPrinciples §22, §5',
          severity: 'error',
          week: 0,
          message: `Time-targeted ${distKey} plan: no race-specific catalogue session exists for ${distKey} — race-pace work would resolve to a renamed borrowed row, which looks like race-pace work in the plan without being a catalogue entry`,
          actual: `0 ${distKey}-specific race_specific sessions`,
          expected: `≥1 ${distKey}-specific race_specific session`,
        })
      }
    }
  }

  // INV-PLAN-PHASE-FOCUS-REACHABLE — a signature may not declare a focus the
  // catalogue cannot supply (§17, CD-15 / SC-04).
  //
  // `PLAN_SIGNATURES['10K'].quality_categories_focus` said ['vo2max',
  // 'threshold'] while NO threshold row was eligible for 10K. Half the declared
  // shape of the plan was unreachable, and the engine papered over it by
  // silently falling back to an aerobic row for the entire build phase. Nothing
  // compared the declaration against the catalogue, so the signature read as a
  // statement of intent that no code was obliged to honour.
  //
  // This is a catalogue-level property checked per plan, which is the point:
  // it fires on the FIRST plan generated for a distance whose focus has gone
  // unreachable, rather than waiting for someone to audit the catalogue.
  {
    const sig: { quality_categories_focus?: readonly string[] } | undefined =
      PLAN_SIGNATURES[distKey as keyof typeof PLAN_SIGNATURES]
    for (const focus of sig?.quality_categories_focus ?? []) {
      const reachable = V1_SESSION_CATALOGUE.some(r =>
        r.category === focus
        && (r.distance_eligibility as readonly string[]).includes(distKey)
        && r.phase_eligibility.some(p => p !== 'base'))
      if (!reachable) {
        violations.push({
          code: 'INV-PLAN-PHASE-FOCUS-REACHABLE',
          principle_ref: 'CoachingPrinciples §17',
          severity: 'error',
          week: 0,
          message: `${distKey} signature declares quality focus '${focus}' but no catalogue session of that category is eligible for ${distKey} outside base phase — the declared plan shape is unreachable`,
          actual: `0 eligible '${focus}' sessions for ${distKey}`,
          expected: `≥1 eligible '${focus}' session`,
        })
      }
    }
  }

  // INV-PLAN-INTENSITY-DISTRIBUTION — the declared distribution is now checked
  // (§1, §34 — CD-19 / SC-03).
  //
  // This table sat in config for four months, read by an offline script and by
  // NO engine code, with no invariant referencing it. That is exactly what §34
  // exists to prevent — and it is why the basis error (sessions vs minutes)
  // survived: nothing computed the number, so nobody could see which quantity
  // it was. The value being wrong was downstream of it being unexercised.
  //
  // INV-PLAN-DELOAD-IS-A-REDUCTION (CoachingPrinciples §3 — SWEEP-BASELINE-01)
  //
  // A week badged `deload` must carry LESS volume than the week before it.
  //
  // Found during the 2026-08-20 baseline triage: 7% of swept plans contain a
  // deload week that is BIGGER than the week preceding it — worst observed a
  // W8 "deload" at 22km against W7's 17km, with a 17km long run against 9.5km.
  // A runner is told this is a recovery week and handed more running than they
  // did the week before.
  //
  // The cause is arithmetic rather than intent: RECOVERY_WEEK_VOLUME_PCT (70)
  // is applied to the volume CURVE, and where the curve ramps steeply enough,
  // 70% of the curve at week N still exceeds the delivered volume at week N-1.
  // The deload is correctly computed and wrong in effect — which is exactly the
  // gap between a rule being honoured and a rule being right (D-21).
  //
  // `warn`, not `error`: it is a known-open defect at a measured 7%, declared
  // AND exercised per §34, on the same footing CD-21 gave §1's ceiling and
  // SC-10 gave the main-set ordering. It becomes `error` when the curve fix
  // lands (DELOAD-INVERSION-01). Enforcing documented intent, not changing it —
  // §3 already says a recovery week reduces volume.
  for (let i = 1; i < plan.weeks.length; i++) {
    const w = plan.weeks[i]
    const prev = plan.weeks[i - 1]
    const isDeload = w.type === 'deload' || w.badge === 'deload'
    const prevIsDeload = prev.type === 'deload' || prev.badge === 'deload'
    // Back-to-back deloads are a different shape and not what this catches.
    if (!isDeload || prevIsDeload) continue
    if (w.weekly_km > prev.weekly_km) {
      violations.push({
        code: 'INV-PLAN-DELOAD-IS-A-REDUCTION',
        principle_ref: 'CoachingPrinciples §3',
        severity: 'warn',
        week: w.n,
        message: `Week ${w.n} is badged deload but carries ${w.weekly_km}km against week ${prev.n}'s ${prev.weekly_km}km. A recovery week that adds volume is not a recovery week.`,
        actual: `${w.weekly_km}km`,
        expected: `<= ${prev.weekly_km}km (the preceding week)`,
      })
    }
  }

  // INV-PLAN-VOLUME-SHORTFALL-DECLARED (CoachingPrinciples §40c — VOL-SHORTFALL-01)
  //
  // When a life-first constraint suppresses the peak week by
  // VOLUME_SHORTFALL_NOTE_THRESHOLD_PCT or more, the plan must SAY SO.
  //
  // The constraint itself is correct and stays — `max_weekday_mins` is the
  // runner's own statement about their life. The defect this catches is
  // SILENCE: measured by counterfactual, a 4-day HM runner with a 45-minute
  // weekday cap peaks at 49km where the curve wanted 66km, and nothing in the
  // plan indicates the two asks are in tension. They conclude that is simply
  // what training for that time looks like.
  //
  // Same family as §44 (prep time) and §80 (long-run shortfall): the cap wins,
  // and the runner is told what the plan cannot give them.
  //
  // Checks only that the declaration EXISTS when the shortfall is large. It
  // cannot recompute the counterfactual — that needs the volume curve, which is
  // generation-time state — so it verifies the honesty obligation, not the
  // arithmetic behind it.
  if (input.max_weekday_mins) {
    const nonDeload = plan.weeks.filter(w => w.type !== 'deload' && w.type !== 'race' && w.badge !== 'deload')
    let weekdayEasy = 0
    let pinned = 0
    for (const w of nonDeload) {
      for (const [d, sn] of Object.entries(w.sessions)) {
        if (!sn || sn.type !== 'easy' || d === 'sat' || d === 'sun') continue
        weekdayEasy++
        if ((sn.duration_mins ?? 0) >= input.max_weekday_mins - 1) pinned++
      }
    }
    // TWO conditions, matching the engine exactly. Checking pinned-ness alone
    // was wrong and the HM archetype proved it: 10 of 15 weekday runs pinned,
    // but the week's volume still landed, so no note was due and the invariant
    // fired anyway. Pinned-ness says the cap is ACTIVE; the stamped percentage
    // says whether it COST anything.
    const materiallyBinding = weekdayEasy > 0 && pinned / weekdayEasy >= 0.25
    const costEnough = (plan.meta.volume_shortfall_pct ?? 0)
      >= GENERATION_CONFIG.VOLUME_SHORTFALL_NOTE_THRESHOLD_PCT
    if (materiallyBinding && costEnough && !plan.meta.volume_shortfall_note) {
      violations.push({
        code: 'INV-PLAN-VOLUME-SHORTFALL-DECLARED',
        principle_ref: 'CoachingPrinciples §40c',
        severity: 'error',
        week: 0,
        message: `${pinned} of ${weekdayEasy} weekday easy runs are pinned at the ${input.max_weekday_mins}-minute limit, so the cap is materially shaping this plan — but no volume_shortfall_note was set. A suppressed target is stated, never absorbed silently.`,
        actual: 'no volume_shortfall_note',
        expected: 'a note stating the cost and naming the lever',
      })
    }
  }

  // INV-PLAN-EASY-FLOOR-PROTECTION-DECLARED (CoachingPrinciples §82)
  //
  // applyWeekdayMinsCap holds an easy run at MIN_SESSION_DISTANCE_KM.easy
  // rather than scaling it below that floor, stamping `floor_protected` on the
  // session. Recomputed directly from the finished plan (unlike the
  // volume-shortfall check, this needs no counterfactual): count the weeks
  // carrying at least one floor-protected session, and if that meets
  // EASY_RUN_FLOOR_PROTECTION_MAINTENANCE_WEEKS, the plan must classify
  // maintenance and carry the note — never absorb the overrun silently.
  {
    const floorProtectedWeeks = plan.weeks.filter(w =>
      Object.values(w.sessions ?? {}).some(sn => sn?.floor_protected),
    ).length
    if (floorProtectedWeeks >= GENERATION_CONFIG.EASY_RUN_FLOOR_PROTECTION_MAINTENANCE_WEEKS) {
      if (plan.meta.volume_profile !== 'maintenance' || !plan.meta.volume_constraint_note) {
        violations.push({
          code: 'INV-PLAN-EASY-FLOOR-PROTECTION-DECLARED',
          principle_ref: 'CoachingPrinciples §82',
          severity: 'error',
          week: 0,
          message: `Easy-run floor protection fired in ${floorProtectedWeeks} weeks, but the plan does not declare it. A suppressed target is stated, never absorbed silently.`,
          actual: `volume_profile=${plan.meta.volume_profile ?? 'undefined'}, volume_constraint_note=${plan.meta.volume_constraint_note ? 'present' : 'absent'}`,
          expected: 'volume_profile=maintenance and a volume_constraint_note naming the day-count lever',
        })
      }
    }
  }

  // INV-PLAN-EFFORT-OR-PACE (CoachingPrinciples §19/§41 — SC-09 / CD-17a)
  //
  // Every quality session must tell the runner HOW HARD, by one route or the
  // other: a pace target, or an effort target. Never neither.
  //
  // §19 checks that a session's LABEL matches its PACE. Hill reps are the first
  // session with no pace to check — the gradient sets it, and prescribing a
  // number would give the runner something they cannot act on. That is a
  // legitimate absence, but it opens a hole: a session that has simply LOST its
  // pace target now looks identical to one deliberately governed by effort.
  //
  // This is the effort-governed counterpart the board required alongside the
  // first such session (§41 — these are the first sessions where effort is the
  // primary prescription rather than a supporting note).
  //
  // Zone alone does not satisfy it. "Zone 4-5" describes a physiological band,
  // not an instruction a runner can execute on a hill.
  for (const w of plan.weeks) {
    for (const [day, sn] of Object.entries(w.sessions)) {
      if (!sn) continue
      if (!(sn.type === 'quality' || sn.type === 'intervals' || sn.type === 'tempo')) continue
      const hasPace = typeof sn.pace_target === 'string' && sn.pace_target.trim().length > 0
      const hasEffort = typeof sn.rpe_target === 'number' && sn.rpe_target > 0
      if (!hasPace && !hasEffort) {
        violations.push({
          code: 'INV-PLAN-EFFORT-OR-PACE',
          principle_ref: 'CoachingPrinciples §19, §41',
          severity: 'error',
          week: w.n, day,
          message: `Quality session "${sn.label}" prescribes neither a pace target nor an effort target. A session with no pace is legitimate (hill reps are governed by gradient), but it must then say how hard by RPE — otherwise a LOST pace is indistinguishable from a deliberate absence.`,
          actual: 'neither pace_target nor rpe_target',
          expected: 'a pace target, or an effort (RPE) target',
        })
      }
    }
  }

  // INV-PLAN-DERIVED-SET (SC-08b) — a session from a v2 row carries its
  // resolved set.
  //
  // A catalogue row is shared across runners, so it holds the SHAPE
  // ("reps of this length at this anchor") and never the numbers. The session
  // holds what THIS runner does. If the row is v2 and the session carries no
  // derived set, the structure never reached the plan — which is the seventh
  // gap the 2026-08-19 audit called blocking, and the precise failure ADR-018
  // and ADR-019 exist to close.
  //
  // Inert until a v2 row exists: v1 rows keep v1 semantics forever (D-03).
  for (const w of plan.weeks) {
    for (const [day, sn] of Object.entries(w.sessions)) {
      if (!sn?.catalogue_id) continue
      const row = V1_SESSION_CATALOGUE.find(r => r.id === sn.catalogue_id)
      if (!row || !isV2Structure(row.main_set_structure)) continue
      const derived = sn.derived_set as { blocks?: unknown[] } | undefined
      if (!derived || !Array.isArray(derived.blocks) || derived.blocks.length === 0) {
        violations.push({
          code: 'INV-PLAN-DERIVED-SET',
          principle_ref: 'ADR-019',
          severity: 'error',
          week: w.n, day,
          message: `Session "${sn.label}" comes from v2 row "${row.id}" but carries no derived_set. The row holds the shape; the session must hold this runner's resolved numbers, or the structure never reaches the runner.`,
          actual: 'no derived_set',
          expected: 'resolved DerivedSet with >= 1 block',
        })
      }
    }
  }

  // INV-PLAN-CATALOGUE-LINK (SC-08a) — a session produced from a catalogue row
  // must CARRY that row's identity, not be re-joined to it by name later.
  //
  // The rep structure the runner sees lives on the row. Before the stamp, the
  // app re-joined at display time by matching `label` against `name`, and that
  // failed on 31% of quality sessions — systematically the ones §22 renames for
  // a time goal. A marathon time-goal plan lost 5 of its 9: distance, duration
  // and a pace band, with no indication of what to actually DO.
  //
  // WHAT THIS CATCHES is the stamp being dropped for a session that clearly had
  // a row — detected by the session still matching a row BY NAME while carrying
  // no `catalogue_id`. That is precisely the state the legacy fallback exists to
  // rescue, so without this check a regression would be invisible: the fallback
  // would quietly cover it until someone renamed the session.
  //
  // Sessions generated inline with no row behind them carry neither id nor a
  // matching name, and are correctly ignored.
  for (const w of plan.weeks) {
    for (const [day, sn] of Object.entries(w.sessions)) {
      if (!sn) continue
      if (!(sn.type === 'quality' || sn.type === 'intervals' || sn.type === 'tempo')) continue
      if (sn.catalogue_id) continue
      const nameMatch = V1_SESSION_CATALOGUE.find(r => r.name === sn.label)
      if (nameMatch) {
        violations.push({
          code: 'INV-PLAN-CATALOGUE-LINK',
          principle_ref: 'ADR-018',
          severity: 'error',
          week: w.n, day,
          message: `Session "${sn.label}" matches catalogue row "${nameMatch.id}" by name but carries no catalogue_id. The name join is a LEGACY fallback — a freshly generated session must stamp its row, or its rep structure is lost the moment the label changes.`,
          actual: 'no catalogue_id',
          expected: `catalogue_id: "${nameMatch.id}"`,
        })
      }
    }
  }

  // INV-PLAN-MAIN-SET-ORDERING (CoachingPrinciples §8 — SC-10 / CD-14)
  //
  // The three kinds of hard running have different sustainable volumes:
  // twenty-five minutes of threshold work is a normal session, twenty-five
  // minutes of VO2max work is a race. A plan's largest VO2max main set must
  // therefore not exceed its largest threshold or race-pace main set.
  //
  // THE FLAT 18% SHARE INVERTED THIS, and nothing noticed for the same reason
  // §34 exists: the ordering was never computed. On the traced 12-week 10K the
  // VO2max sessions delivered 30 and 32-minute main sets against 22 and 26 for
  // race pace — the hardest sessions were also the longest, and they grew with
  // weekly volume, i.e. anti-correlated with the capacity to absorb them.
  //
  // Compares MAIN SET, not session length: warm-up carries a floor, so session
  // length is a poor proxy. Derived via sessionFormat.mainSetMinutes (single
  // owner) rather than re-deriving the split here.
  //
  // Categories absent from a plan are simply skipped — this asserts an ordering
  // among what is present, never that a plan must contain all three.
  {
    const maxMain: Record<string, { mins: number, week: number, label: string }> = {}
    for (const w of plan.weeks) {
      for (const sn of Object.values(w.sessions)) {
        if (!sn || !(sn.type === 'quality' || sn.type === 'intervals' || sn.type === 'tempo')) continue
        const stim = classifyStimulus(sn)
        if (!stim) continue
        // SC-10 — EFFORT-GOVERNED work (hill reps, ultra hikes: no pace_target) is
        // stamped vo2max by zone but is NOT the flat I-pace work this ordering
        // bounds. It is lower impact (SC-09) and, for ultras, deliberately long
        // (time on feet). Exclude it from the vo2max comparison; the ceiling and
        // this ordering both target PACED VO2max only.
        if (stim === 'vo2max' && !sn.pace_target) continue
        // SC-08 vo2max — compare VO2max on its WORK minutes (Z4-5 time), not the
        // main set: v2 VO2max carries full recovery jogs inside the main set, so a
        // main-set comparison would penalise it for resting. Tempo/race are
        // continuous, so their main set already ≈ their work. Like-for-like.
        const mins = stim === 'vo2max'
          ? (vo2maxWorkMinutes(sn) ?? mainSetMinutes(sn.duration_mins ?? 0))
          : mainSetMinutes(sn.duration_mins ?? 0)
        if (!maxMain[stim] || mins > maxMain[stim].mins) {
          maxMain[stim] = { mins, week: w.n, label: sn.label ?? '' }
        }
      }
    }

    const vo2 = maxMain['vo2max']
    // `tempo` covers threshold rows; `race_pace` covers race-specific work.
    for (const softer of ['tempo', 'race_pace'] as const) {
      const other = maxMain[softer]
      if (!vo2 || !other) continue
      if (vo2.mins > other.mins + GENERATION_CONFIG.MAIN_SET_ORDERING_TOLERANCE_MINS) {
        violations.push({
          code: 'INV-PLAN-MAIN-SET-ORDERING',
          principle_ref: 'CoachingPrinciples §8',
          // STAYS `warn` after SC-10 (2026-08-21), deliberately. The board's
          // flip to error was CONTINGENT on the absolute ceiling driving this to
          // zero; it did not, and the reason is a finding: the ceiling
          // (VO2MAX_MAIN_SET_MAX_MINS, enforced hard by INV-PLAN-VO2MAX-MAIN-SET-CAP)
          // carries the coaching concern — "VO2max is a race" is about the ABSOLUTE
          // duration of the hardest work, now capped. The residual relative
          // inversions are all LOW-VOLUME plans where a modest ≤20-min VO2max
          // exceeds a smaller race_pace session that simply sits in a lighter week;
          // a 17-min VO2max is not a race. Enforcing the relative ordering there
          // would demand shrinking a fine session, so it stays a signal, not a gate.
          severity: 'warn',
          week: vo2.week,
          message: `Largest VO2max main set is ${vo2.mins.toFixed(0)} min ("${vo2.label}", week ${vo2.week}), exceeding the largest ${softer} main set of ${other.mins.toFixed(0)} min ("${other.label}", week ${other.week}). VO2max work is the least sustainable per minute and must not be the plan's longest quality session.`,
          actual: `${vo2.mins.toFixed(0)} min`,
          expected: `<= ${(other.mins + GENERATION_CONFIG.MAIN_SET_ORDERING_TOLERANCE_MINS).toFixed(0)} min (${softer} + ${GENERATION_CONFIG.MAIN_SET_ORDERING_TOLERANCE_MINS} min rounding tolerance)`,
        })
      }
    }
  }

  // INV-PLAN-VO2MAX-MAIN-SET-CAP (CoachingPrinciples §8 — SC-08 vo2max) — the
  // mechanical check for the VO2max WORK-minute band. Since the flat vo2max rows
  // are v2, the dose is time AT Z4-5 (work), bounded [VO2MAX_WORK_MIN_MINS,
  // VO2MAX_WORK_MAX_MINS]: below the floor it is not a VO2max stimulus, above the
  // ceiling it steals from tomorrow's easy volume. Effort-governed hills/hikes
  // (no pace_target) are excluded — a long ultra hike is time on feet, not this
  // work. A session with no resolvable work minutes (legacy v1, no derived set)
  // falls back to the pre-SC-08 main-set ceiling. Tolerance = the rounding width.
  {
    const tol = GENERATION_CONFIG.MAIN_SET_ORDERING_TOLERANCE_MINS
    const floor = GENERATION_CONFIG.VO2MAX_WORK_MIN_MINS
    const ceil = GENERATION_CONFIG.VO2MAX_WORK_MAX_MINS
    for (const w of plan.weeks) {
      for (const [day, sn] of Object.entries(w.sessions) as [Day, Session | undefined][]) {
        if (!sn || !(sn.type === 'quality' || sn.type === 'intervals' || sn.type === 'tempo')) continue
        if (classifyStimulus(sn) !== 'vo2max' || !sn.pace_target) continue
        const work = vo2maxWorkMinutes(sn)
        if (work == null) {
          const mins = mainSetMinutes(sn.duration_mins ?? 0)
          if (mins > GENERATION_CONFIG.VO2MAX_MAIN_SET_MAX_MINS + tol) {
            violations.push({
              code: 'INV-PLAN-VO2MAX-MAIN-SET-CAP',
              principle_ref: 'CoachingPrinciples §8',
              severity: 'error', week: w.n, day,
              message: `VO2max main set "${sn.label}" is ${mins.toFixed(0)} min, over the ${GENERATION_CONFIG.VO2MAX_MAIN_SET_MAX_MINS}-min legacy ceiling.`,
              actual: `${mins.toFixed(0)} min`,
              expected: `<= ${GENERATION_CONFIG.VO2MAX_MAIN_SET_MAX_MINS} min`,
            })
          }
          continue
        }
        if (work < floor - tol || work > ceil + tol) {
          violations.push({
            code: 'INV-PLAN-VO2MAX-MAIN-SET-CAP',
            principle_ref: 'CoachingPrinciples §8',
            severity: 'error', week: w.n, day,
            message: `VO2max work "${sn.label}" is ${work.toFixed(0)} min at Z4–5, outside the ${floor}–${ceil} min dose band (least sustainable work per minute; bounded at both ends).`,
            actual: `${work.toFixed(0)} min work`,
            expected: `${floor}–${ceil} min (± ${tol} rounding)`,
          })
        }
      }
    }
  }

  // INV-PLAN-VO2MAX-ONSET (CoachingPrinciples §5/§17 — SC-07 / CD-16 + CD-22)
  //
  // The first VO2max session must leave at least
  // VO2MAX_ONSET_MIN_ADAPTATION_WEEKS of build/peak before the taper. Two
  // isolated exposures in the last weeks before a taper carry the full injury
  // and fatigue cost of the hardest work in the plan and collect none of the
  // adaptation — "the middle position is the only indefensible one" (Seiler).
  //
  // WHY THIS IS AN INVARIANT AND NOT A LOGGED ADJUSTMENT. It used to be the
  // latter: the engine recorded `V2-vo2max-onset-timing` against its own
  // principle and generated the plan anyway. A principle the engine logs a
  // violation against and then proceeds past is not a principle (Hutchinson,
  // CD-16 amendment 3). §34 again.
  //
  // BINDING WHERE REACHABLE, RECORDED WHERE NOT (CD-22). Below ~12 weeks the
  // deadline falls inside base phase, where no quality session exists, so the
  // window is arithmetically unsatisfiable — and 5K.min_weeks is 8, so those
  // plans are supported, not hypothetical. The number is NOT lowered to 4 to
  // make them pass (Seiler: the adaptation window does not shrink because the
  // runner chose a shorter plan), and generation does NOT throw (Hutchinson:
  // refusing a plan over a window its own geometry cannot contain is a crash,
  // not enforcement). The engine records `V2-vo2max-onset-unreachable` instead
  // — the same treatment CD-20 gave the withheld second quality and CD-21 gave
  // maintenance plans.
  {
    const firstBuildWeek = plan.weeks.find(w => w.phase === 'build')?.n
    const taperStartWeek = plan.weeks.find(w => w.phase === 'taper')?.n
    if (firstBuildWeek != null && taperStartWeek != null && input.race_distance_km <= 21) {
      const vo2Weeks = plan.weeks
        .filter(w => Object.values(w.sessions).some(sn =>
          sn && sn.type === 'quality' && classifyStimulus(sn) === 'vo2max'))
        .map(w => w.n)

      if (vo2Weeks.length > 0) {
        const minWeeks = GENERATION_CONFIG.VO2MAX_ONSET_MIN_ADAPTATION_WEEKS
        const taperWeeks = (plan.weeks.length - taperStartWeek) + 1
        const deadlineWeekN = plan.weeks.length - taperWeeks - minWeeks
        const reachable = deadlineWeekN >= firstBuildWeek
        const gap = taperStartWeek - vo2Weeks[0]

        if (reachable && gap < minWeeks) {
          violations.push({
            code: 'INV-PLAN-VO2MAX-ONSET',
            principle_ref: 'CoachingPrinciples §5',
            severity: 'error',
            week: vo2Weeks[0],
            message: `First VO2max session is in week ${vo2Weeks[0]}, leaving ${gap} week(s) before the taper (week ${taperStartWeek}); the adaptation window needs ${minWeeks}. This plan is long enough to satisfy it (deadline week ${deadlineWeekN}).`,
            actual: gap,
            expected: `>= ${minWeeks} weeks before taper`,
          })
        }
      }
    }
  }

  // SESSIONS, PLAN-WIDE, CEILING. See the config comment for why each of those
  // three words is load-bearing.
  {
    const dist = GENERATION_CONFIG.INTENSITY_DISTRIBUTION[
      distKey as keyof typeof GENERATION_CONFIG.INTENSITY_DISTRIBUTION]
    if (dist) {
      // Denominator is RUNNING sessions — strength, cross-train and rest are not
      // part of an intensity distribution.
      //
      // Numerator is QUALITY sessions, matching what §8 counts. Two exclusions,
      // both taken from existing doctrine rather than chosen to make the numbers
      // work:
      //   • `hard` — the §78 recalibration time trial is typed `hard` PRECISELY
      //     so that it does not count against QUALITY_SESSIONS_PER_WEEK_MAX, and
      //     beginners get it too. Counting it here would contradict the rule that
      //     gave it that type. (Found by the CD-19 verification pass: including
      //     it put a 3-day HM plan at 24.4% against a 20% ceiling.)
      //   • `race` — the goal, not training. One session, at the end, by
      //     definition not part of the prescribed distribution.
      // `intervals` / `tempo` are retained for legacy and gist-authored plans;
      // the R23+ engine emits `quality`.
      const HARD_TYPES = new Set(['quality', 'intervals', 'tempo'])
      let running = 0
      let hard = 0
      for (const w of plan.weeks) {
        for (const sn of Object.values(w.sessions)) {
          if (!sn || sn.type === 'rest' || sn.type === 'strength' || sn.type === 'cross-train') continue
          running++
          if (HARD_TYPES.has(sn.type)) hard++
        }
      }
      // MAINTENANCE-PROFILE PLANS ARE EXEMPT — Coaching Board CD-21 (2026-08-20).
      //
      // Not a day-count exemption. A PROFILE exemption, keyed to the state §52
      // already assigns, and the distinction matters: the first draft of this
      // finding called the breach "day-count sensitive", which is wrong and
      // would have produced an exemption that left the real defect standing.
      // Per-cell breakdown (6 distances x 6 day-counts x volume x fitness):
      //
      //   Bucket A — 5K/10K/HM @ 2d, 50K @ 3d, 100K @ 3d. Worst 28.6%.
      //              `volume_profile: 'maintenance'` in EVERY case.
      //   Bucket B — 100K @ 4d (14.0%), 5d (14.7%), 6d (12.2%), 7d (12.2%).
      //              `volume_profile: 'build'` — nothing to do with day count.
      //
      // Bucket A correlates perfectly with `maintenance`; day count is merely
      // what triggers §52. Bucket B is the ultra value being wrong and is fixed
      // in GENERATION_CONFIG (100K 12 -> 15), not here.
      //
      // Why maintenance plans are exempt rather than tolerated: A DISTRIBUTION
      // RATIO PRESUPPOSES ENOUGH SESSIONS TO DISTRIBUTE. At two runs a week the
      // ratio is not violated — it is undefined (Seiler). §9 forces the long run
      // to ~56% of a 2-day week's volume, so "long run + one quality" is the
      // shape, and it is also what a coach would actually write for a
      // time-crunched runner chasing a 5K (McMillan). Forcing compliance means
      // two easy runs and no quality — which for the peri/post-menopausal
      // runners in this cohort removes the single highest-value stimulus in the
      // plan, and there are only two sessions to take it from (Sims).
      //
      // SCOPED STRICTLY TO THIS CEILING (Willy's condition of approval). §7's
      // 48-hour spacing, §2's 10% rule, §9's ratio and §45's progression cap all
      // remain fully binding on maintenance plans. This is not exempt-from-load.
      //
      // NOT SILENTLY SKIPPED: §52 already emits `volume_constraint_note` telling
      // the runner why their plan is shaped this way, which is the runner-facing
      // record. The skip itself is asserted in intensityDistributionCd21.test.ts
      // so that widening the maintenance trigger cannot quietly drop plans out
      // of this check. Precedent: INV-PLAN-PEAK-LR-RACE-RATIO above relaxes on
      // the same flag for the same reason.
      const isMaintenance = plan.meta.volume_profile === 'maintenance'

      if (running > 0 && !isMaintenance) {
        const pct = (hard / running) * 100
        if (pct > dist.max_quality_session_pct) {
          // Severity restored to `error` by CD-21. It was `warn` for exactly one
          // day while the values were unratified. Willy, decisive: an `error`
          // that fires on 71% of a distance's plans is not a safety mechanism,
          // it is noise, and noise gets suppressed — which is how a real
          // violation gets missed later.
          violations.push({
            code: 'INV-PLAN-INTENSITY-DISTRIBUTION',
            principle_ref: 'CoachingPrinciples §1',
            severity: 'error',
            week: 0,
            message: `Plan-wide quality share is ${pct.toFixed(1)}% of running sessions (${hard}/${running}), above the ${distKey} ceiling of ${dist.max_quality_session_pct}%`,
            actual: `${pct.toFixed(1)}%`,
            expected: `<= ${dist.max_quality_session_pct}%`,
          })
        }
      }
    }
  }

  // INV-PLAN-SECOND-QUALITY-MIN-DAYS — a week too short to carry two quality
  // sessions must not be given two (§8, CD-20 / SC-01).
  //
  // At fewer than MIN_TRAINING_DAYS_FOR_SECOND_QUALITY days, quality consumes
  // 32.4% of weekly volume and the single remaining easy slot is capped at
  // 0.8 x the long run (§9), so the week structurally under-delivers ~8% of its
  // own volume — taken entirely out of the easy running that makes the hard
  // work survivable. It is also 3 of 4 sessions hard, against §1's ceiling.
  //
  // The old hardcoded candidate-day list blocked this by accident. This is the
  // rule that was missing underneath it, so the placement defect could be fixed
  // without converting a hidden bug into an explicit overload.
  {
    const minDays = GENERATION_CONFIG.MIN_TRAINING_DAYS_FOR_SECOND_QUALITY
    const trainingDays = Math.min(
      input.days_available ?? 7,
      GENERATION_CONFIG.MAX_TRAINING_DAYS_PER_WEEK,
    )
    if (trainingDays < minDays) {
      for (const w of plan.weeks) {
        const qualityCount = Object.values(w.sessions)
          .filter(sn => sn?.type === 'quality').length
        if (qualityCount > 1) {
          violations.push({
            code: 'INV-PLAN-SECOND-QUALITY-MIN-DAYS',
            principle_ref: 'CoachingPrinciples §8, §9',
            severity: 'error',
            week: w.n,
            message: `Week ${w.n} places ${qualityCount} quality sessions on a ${trainingDays}-day week; a second quality session needs at least ${minDays} training days`,
            actual: `${qualityCount} quality sessions, ${trainingDays} training days`,
            expected: `1 quality session below ${minDays} training days`,
          })
        }
      }
    }
  }

  // INV-PLAN-INTENSITY-ORDERING — a NEW CLASS OF CHECK (§83, SC-06 / CD-16).
  //
  // Every other invariant in this file validates one session against its own
  // prescription. That is exactly why nothing caught the pace inversion: each
  // session was individually defensible, and the plan was only incoherent when
  // you put two of them side by side.
  //
  // The rule: within a plan, a session prescribed in the THRESHOLD/race band
  // (Zone 3) may not be prescribed FASTER than a session in the VO2max band
  // (Zone 4–5). Zone ordering is an intensity ordering; if the paces disagree
  // with it, a runner following pace and a runner following heart rate are
  // running two different plans.
  //
  // The board's ruling is "reconcile it, or surface the honesty signal" — so
  // this does not forbid the inversion outright. It forbids an inversion the
  // plan is SILENT about: `meta.goal_beyond_measured_fitness` must be set and
  // the difficulty band must not read 'comfortable'. A plan may be a stretch;
  // it may not pretend not to be.
  {
    const tol = GENERATION_CONFIG.INTENSITY_ORDERING_TOLERANCE_PCT / 100
    let fastestVo2: { mid: number, label: string, week: number } | null = null
    let fastestThreshold: { mid: number, label: string, week: number } | null = null

    for (const w of plan.weeks) {
      for (const session of Object.values(w.sessions)) {
        if (!session || session.type !== 'quality' || !session.pace_target) continue
        const mid = parsePaceMidpoint(session.pace_target)
        if (mid == null) continue
        const zone = (session.zone ?? '').toLowerCase()
        const isVo2Band = zone.includes('zone 4') || zone.includes('zone 5')
        const isThresholdBand = zone.includes('zone 3') && !isVo2Band
        const entry = { mid, label: session.label ?? '(unlabelled)', week: w.n }

        // "Fastest" is the SMALLEST minutes-per-km.
        if (isVo2Band && (fastestVo2 == null || mid < fastestVo2.mid)) fastestVo2 = entry
        if (isThresholdBand && (fastestThreshold == null || mid < fastestThreshold.mid)) fastestThreshold = entry
      }
    }

    if (fastestVo2 && fastestThreshold
        && fastestThreshold.mid < fastestVo2.mid * (1 - tol)) {
      const surfaced = plan.meta.goal_beyond_measured_fitness === true
        && plan.meta.difficulty_band !== undefined
        && plan.meta.difficulty_band !== 'comfortable'
      if (!surfaced) {
        violations.push({
          code: 'INV-PLAN-INTENSITY-ORDERING',
          principle_ref: 'CoachingPrinciples §83, §44',
          severity: 'error',
          week: fastestThreshold.week,
          message: `"${fastestThreshold.label}" (week ${fastestThreshold.week}, ${fastestThreshold.mid.toFixed(2)}/km, Zone 3) is prescribed faster than "${fastestVo2.label}" (week ${fastestVo2.week}, ${fastestVo2.mid.toFixed(2)}/km, Zone 4–5). The plan must either reconcile the two or declare the target beyond measured fitness (meta.goal_beyond_measured_fitness + a non-comfortable difficulty band).`,
          actual: `Zone 3 ${fastestThreshold.mid.toFixed(2)}/km vs Zone 4–5 ${fastestVo2.mid.toFixed(2)}/km, band '${plan.meta.difficulty_band ?? 'unset'}'`,
          expected: 'Zone 3 no faster than Zone 4–5, or the inversion surfaced',
        })
      }
    }
  }

  // INV-PLAN-LR-PROGRESSION-CAP — long-run distance increase week-on-week
  // capped at the GREATER of LONG_RUN_PROGRESSION_CAP_PCT or
  // LONG_RUN_PROGRESSION_CAP_ABS_KM. Universal — all phases. Step-back to the
  // pre-deload distance is permitted within DELOAD_STEP_BACK_TOLERANCE_PCT.
  // (CoachingPrinciples §45)
  {
    const capPct = GENERATION_CONFIG.LONG_RUN_PROGRESSION_CAP_PCT / 100
    const capAbs = GENERATION_CONFIG.LONG_RUN_PROGRESSION_CAP_ABS_KM
    const stepBackTol = 1 + GENERATION_CONFIG.LONG_RUN_DELOAD_STEP_BACK_TOLERANCE_PCT / 100
    const longRunForWeek = (week: typeof plan.weeks[number]): number | null => {
      const long = Object.values(week.sessions).find(s =>
        !!s && isLongRun(s)
      )
      return long?.distance_km ?? null
    }
    for (let i = 1; i < plan.weeks.length; i++) {
      const prev = plan.weeks[i - 1]
      const curr = plan.weeks[i]
      if (curr.type === 'race') continue
      // Foundation → W1 boundary: the transition from the pre-plan block to
      // the main plan is exempt from progression cap. Foundation volume is
      // deliberately low; W1 will always appear as a large jump.
      if (prev.phase === 'foundation' && curr.phase !== 'foundation') continue
      const prevLR = longRunForWeek(prev)
      const currLR = longRunForWeek(curr)
      if (prevLR == null || currLR == null) continue
      // BOUNCEBACK EXEMPTION — from a deload OR from a long-run step-back.
      //
      // Mirrors the engine's applyLongRunProgressionCap exactly. This used to
      // check `prev.type === 'deload'` only, and knew nothing about
      // applyLongRunStepBacks, which deliberately cuts every Nth BUILD long run
      // in a NON-deload week. The week after that cut is a return to a distance
      // the runner covered two weeks ago — not a spike; chronic load has not
      // moved — and was being reported as a §45 violation.
      //
      // Detected structurally (the previous week's long run is shorter than the
      // one before it) rather than by re-deriving the step-back cadence, so the
      // engine and this check cannot drift apart.
      const prevPrev = i >= 2 ? longRunForWeek(plan.weeks[i - 2]) : null
      const prevWasStepBack = prevPrev != null
        && prev.type !== 'race'
        && prevLR < prevPrev - 0.01
      if (prev.type === 'deload' || prevWasStepBack) {
        if (prevPrev != null && currLR <= prevPrev * stepBackTol + 0.01) continue
      }
      // ROUNDING HEADROOM (2026-08-20). Session distances round to
      // DISTANCE_ROUNDING_PRECISION_KM, so the two values being differenced are
      // each rounded while the cap is not. A long run landing 0.5km over is one
      // rounding step, not a coaching failure — the traced case was a 20.5km
      // run against a 20km allowance, from a 15km week before it.
      //
      // Same grounding as INV-PLAN-MAIN-SET-ORDERING's tolerance and §83's:
      // an assertion made finer than the data's own precision is asserting
      // noise. The cap itself (§45: +20% or +5km) does not move.
      const allowedJumpKm = Math.max(prevLR * capPct, capAbs)
        + GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM
      const actualJumpKm = currLR - prevLR
      if (actualJumpKm > allowedJumpKm + 0.01) {
        const pctJump = prevLR > 0 ? Math.round((actualJumpKm / prevLR) * 100) : 0
        violations.push({
          code: 'INV-PLAN-LR-PROGRESSION-CAP',
          principle_ref: 'CoachingPrinciples §45',
          severity: 'error',
          week: curr.n,
          message: `W${curr.n} long run ${currLR}km is a ${pctJump}% jump from W${prev.n} (${prevLR}km). Cap is +${GENERATION_CONFIG.LONG_RUN_PROGRESSION_CAP_PCT}% or +${capAbs}km, whichever is greater.`,
          actual: `${currLR} (jump +${actualJumpKm.toFixed(1)}km)`,
          expected: `≤ ${prevLR + allowedJumpKm}km`,
        })
      }
    }
  }

  // INV-PLAN-PEAK-VOLUME-FLOOR-LONG-RACES — time-targeted marathon and ultra
  // plans need an absolute peak weekly-volume floor scaled to race distance.
  // (CoachingPrinciples §46) Maintenance plans are exempt — they accept the
  // failed floor as an honest constraint and surface it via volume_constraint_note.
  if (isTimeTarget) {
    const dist = input.race_distance_km
    let requiredFloor = 0
    if (dist >= 40 && dist <= 43) {
      requiredFloor = dist * GENERATION_CONFIG.MARATHON_PEAK_VOLUME_FLOOR_RATIO
    } else if (dist > 43 && dist <= 55) {
      requiredFloor = dist * GENERATION_CONFIG.ULTRA_50K_PEAK_VOLUME_FLOOR_RATIO
    } else if (dist > 55) {
      requiredFloor = Math.min(
        dist * GENERATION_CONFIG.ULTRA_LONG_PEAK_VOLUME_FLOOR_RATIO,
        GENERATION_CONFIG.ULTRA_PEAK_VOLUME_FLOOR_CAP_KM,
      )
    }
    if (requiredFloor > 0 && plan.meta.volume_profile !== 'maintenance') {
      const peakWeeks = plan.weeks.filter(w => w.phase === 'peak')
      const peakKm = peakWeeks.length > 0 ? Math.max(...peakWeeks.map(w => w.weekly_km)) : 0
      if (peakKm + 0.01 < requiredFloor) {
        violations.push({
          code: 'INV-PLAN-PEAK-VOLUME-FLOOR-LONG-RACES',
          principle_ref: 'CoachingPrinciples §46',
          severity: 'error',
          week: 0,
          message: `Peak weekly volume ${peakKm}km is below the ${Math.round(requiredFloor)}km floor for a ${dist}km time-targeted race. Either increase volume, downgrade to maintenance, or trigger a prep-time warning.`,
          actual: peakKm,
          expected: `≥ ${Math.round(requiredFloor)}`,
        })
      }
    }
  }

  // INV-PLAN-QUALITY-VARIETY-FULL-PLAN — no single quality-session label may
  // appear more than floor(total/3) + 1 times across the plan.
  // (CoachingPrinciples §53) Race-week sharpening reps are excluded.
  {
    const labelCounts = new Map<string, number>()
    let totalQuality = 0
    for (const w of plan.weeks) {
      if (w.type === 'race') continue
      for (const s of Object.values(w.sessions)) {
        if (!s || s.type !== 'quality') continue
        // COUNTS THE CATALOGUE ROW, not the label (CAT-ULTRA-THIN-01, Coaching
        // Board 2026-08-21 — CORRECT, consistent with its sibling §36 /
        // INV-PLAN-TAPER-VARIETY, which already keys on `catalogue_id`). Variety
        // is a property of the TRAINING, which is the row; §22's goal-pace rename
        // deliberately makes label ≠ row, so label-counting both under-counts
        // (one row split across names) and mis-counts (two rows sharing a name).
        // `catalogue_id` (ADR-018) is the structural answer.
        //
        // The board ruled the residue this exposes is an ENGINE defect, not a
        // reason to loosen the cap: the stateless selector over-picked one row
        // while an eligible sibling sat unused. Fixed by the least-used-first
        // rotation in selectCatalogueSession, which drops the row-count residue
        // to baseline. A row that still exceeds the cap after rotation means the
        // eligible pool is genuinely exhausted — a catalogue CONTENT gap, tracked
        // as CAT-ULTRA-THIN-01, not a per-plan error the runner caused.
        //
        // Inline sessions with no row fall back to the label so they are still
        // counted (a plan of unnamed repeats is still monotonous).
        const key = (s.catalogue_id ?? s.label ?? '').trim()
        if (!key) continue
        labelCounts.set(key, (labelCounts.get(key) ?? 0) + 1)
        totalQuality++
      }
    }
    if (totalQuality > 0) {
      const fractionCap = Math.floor(totalQuality / GENERATION_CONFIG.QUALITY_VARIETY_DENOMINATOR)
        + GENERATION_CONFIG.QUALITY_VARIETY_ALLOWANCE
      // §53 (2026-09-02, Coaching Board) — the cap must be SATISFIABLE. D-21:
      // a principle no plan can satisfy is a defect in the principle.
      //
      // With `k` picks drawn from pools of size `s`, some row must appear at
      // least ceil(k/s) times. The pool VARIES BY PHASE, so the bound is taken
      // over every pool size present: for each size s, count the picks whose pool
      // was that small or smaller — those picks can only be served by s rows — and
      // require ceil(count/s). The largest such requirement is the floor.
      //
      // Real case: a finish-goal marathon at 12 km/week is threshold-only. Of the
      // five threshold rows, `tempo_cruise_short` is 5K/10K-only and
      // `threshold_ladder` needs min_weekly_km 45, leaving 3 in build and 2 in
      // peak/taper (`tempo_cruise` is build-only). Ten of eleven picks land in the
      // 2-row pool → floor 5, while the fraction cap says 4. A plan-level union
      // would have said 3 → 4 and still demanded the impossible.
      //
      // The fraction cap stays the FLOOR, so wherever the catalogue does offer
      // variety this is exactly as binding as before: a lazy rotation over a rich
      // pool still fires. Absent (legacy plans) → fraction cap alone, i.e. the
      // previous behaviour.
      const poolSizes = plan.meta.quality_pool_sizes
      let pigeonhole = 0
      if (poolSizes && poolSizes.length > 0) {
        for (const s of Array.from(new Set(poolSizes))) {
          if (s <= 0) continue
          const constrained = poolSizes.filter(x => x <= s).length
          pigeonhole = Math.max(pigeonhole, Math.ceil(constrained / s))
        }
      }
      const cap = Math.max(fractionCap, pigeonhole)
      for (const [row, count] of Array.from(labelCounts)) {
        if (count > cap) {
          violations.push({
            code: 'INV-PLAN-QUALITY-VARIETY-FULL-PLAN',
            principle_ref: 'CoachingPrinciples §53',
            severity: 'error',
            week: 0,
            message: `Quality session row "${row}" appears ${count} times across ${totalQuality} quality sessions; cap is ${cap} (fraction floor(${totalQuality}/${GENERATION_CONFIG.QUALITY_VARIETY_DENOMINATOR})+${GENERATION_CONFIG.QUALITY_VARIETY_ALLOWANCE}=${fractionCap}${pigeonhole ? `, pool floor ${pigeonhole}` : ', pool sizes unknown'}). The eligible pool had room to spread further.`,
            actual: count,
            expected: `≤ ${cap}`,
          })
        }
      }
    }
  }

  // INV-PLAN-LR-MAX-WEEKLY-PCT — no single run exceeds LONG_RUN_MAX_PCT_OF_WEEKLY
  // of the week's total volume. Race week and deload weeks exempt — race
  // week's only run is the race itself; deloads scale everything down together.
  // (CoachingPrinciples §52) Maintenance plans relax this — the constraint
  // is already surfaced in volume_constraint_note.
  if (plan.meta.volume_profile !== 'maintenance') {
    const cap = GENERATION_CONFIG.LONG_RUN_MAX_PCT_OF_WEEKLY / 100
    for (const w of plan.weeks) {
      if (w.type === 'race' || w.type === 'deload') continue
      if (w.weekly_km <= 0) continue
      // CB-1 (2026-09-03) — §5 low-session-count. A "fraction of the week" is
      // only meaningful once the week has runs to distribute across. A
      // foundation week that fits one or two sessions (§52b day-fitting: a 5.6km
      // fresh-return baseline supports exactly one 5.6km run) has a largest
      // session at 100% of the week by construction — that is a SMALL week, not
      // a LOPSIDED one, and §52's remedies (reduce the long run, raise volume,
      // downgrade to maintenance) are all inapplicable to it.
      //
      // Same reasoning and threshold as the INV-PLAN-FOUNDATION-BLOCK long-run
      // arm, which already carries `runKms.length >= 3` for this exact case.
      // Deliberately scoped to foundation weeks: main-week behaviour is owned by
      // §52's maintenance classification (closed to zero 2026-09-02, f1f8423)
      // and must not be relaxed here.
      if (w.phase === 'foundation') {
        const runCount = Object.values(w.sessions ?? {})
          .filter(x => x && x.type !== 'rest' && x.type !== 'cross-train').length
        if (runCount < 3) continue
      }
      for (const [day, s] of Object.entries(w.sessions) as [Day, Session | undefined][]) {
        if (!s) continue
        if (s.type === 'strength' || s.type === 'rest') continue
        if (s.distance_km == null) continue
        const fraction = s.distance_km / w.weekly_km
        if (fraction > cap + 0.005) {
          violations.push({
            code: 'INV-PLAN-LR-MAX-WEEKLY-PCT',
            principle_ref: 'CoachingPrinciples §52',
            severity: 'error',
            week: w.n,
            day,
            message: `${s.label ?? 'session'} ${s.distance_km}km is ${Math.round(fraction * 100)}% of weekly volume ${w.weekly_km}km — exceeds ${GENERATION_CONFIG.LONG_RUN_MAX_PCT_OF_WEEKLY}% cap. Lopsided week; reduce the long run, raise weekly volume, or downgrade to maintenance.`,
            actual: `${Math.round(fraction * 100)}%`,
            expected: `≤ ${GENERATION_CONFIG.LONG_RUN_MAX_PCT_OF_WEEKLY}%`,
          })
        }
      }
    }
  }

  // INV-PLAN-COVERS-RACE-DATE — the final week must contain race day, and the
  // race session must sit on race day's actual weekday.
  // (CoachingPrinciples §76, §77)
  //
  // These close the gap that let the highest-severity defect in the 2026-08-06
  // incident ship: before this, `race_date` appeared in this file exactly once,
  // in a metadata mapping, and never in an assertion. Every plan the engine had
  // ever produced finished before race day.
  //
  // Foundation weeks (n <= 0) are pre-plan and cannot be the race week.
  {
    const raceDateIso = plan.meta.race_date
    const planWeeks = plan.weeks.filter(w => w.n > 0)
    const finalWeek = planWeeks[planWeeks.length - 1]

    if (raceDateIso && finalWeek?.date) {
      const weekStart = parseDateLocal(finalWeek.date)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      const race = parseDateLocal(raceDateIso)

      if (race < weekStart || race > weekEnd) {
        const gapDays = Math.round((race.getTime() - weekEnd.getTime()) / 86_400_000)
        violations.push({
          code: 'INV-PLAN-COVERS-RACE-DATE',
          principle_ref: 'CoachingPrinciples §76',
          severity: 'error',
          week: finalWeek.n,
          message: gapDays > 0
            ? `Plan ends ${gapDays} day(s) before race day — final week is ${finalWeek.date}–${formatDate(weekEnd)}, race is ${raceDateIso}. The plan must be laid out backwards from race week.`
            : `Race day ${raceDateIso} falls before the final week (${finalWeek.date}–${formatDate(weekEnd)}).`,
          actual: `${finalWeek.date}–${formatDate(weekEnd)}`,
          expected: `a week containing ${raceDateIso}`,
        })
      }

      // INV-PLAN-RACE-ON-RACE-DAY — placing the race by weekday preference
      // rather than by its real date names the right week and still races on
      // the wrong day.
      const raceEntry = Object.entries(finalWeek.sessions ?? {})
        .find(([, s]) => s?.type === 'race')
      if (raceEntry) {
        const [placedDay] = raceEntry
        const expectedDay = DAYS_MON_SUN[(race.getDay() + 6) % 7]
        if (placedDay !== expectedDay) {
          violations.push({
            code: 'INV-PLAN-RACE-ON-RACE-DAY',
            principle_ref: 'CoachingPrinciples §77',
            severity: 'error',
            week: finalWeek.n,
            day: placedDay,
            message: `Race session placed on ${placedDay} but ${raceDateIso} is a ${expectedDay}`,
            actual: placedDay,
            expected: expectedDay,
          })
        }
        // §77 — no race-week session may fall after the race.
        const raceIdx = DAYS_MON_SUN.indexOf(expectedDay as DayKey)
        for (const [day, s] of Object.entries(finalWeek.sessions ?? {})) {
          if (!s || s.type === 'race' || s.type === 'rest') continue
          if (DAYS_MON_SUN.indexOf(day as DayKey) > raceIdx) {
            violations.push({
              code: 'INV-PLAN-RACE-ON-RACE-DAY',
              principle_ref: 'CoachingPrinciples §77',
              severity: 'error',
              week: finalWeek.n,
              day,
              message: `"${s.label ?? day}" is scheduled on ${day}, after the race on ${expectedDay}`,
              actual: day,
              expected: `a day before ${expectedDay}`,
            })
          }
        }
      }
    }
  }

  // INV-PLAN-TAPER-COPY-MATCHES-DURATION — a coach note may not state a taper
  // length that differs from the actual taper phase. (CoachingPrinciples §6)
  //
  // F9 was the note "Two week taper" over a three-week taper: the note's number
  // came from race distance while the taper length came from the config, two
  // owners for one fact. GEN-FIX-06 fixed it at source (applyV7TaperRationale
  // now counts real taper weeks), but the incident's §9 verification strategy
  // named this a deploy-blocking backstop so a future hardcoded taper string
  // can't silently reintroduce the lie — the N3/N4 pattern GEN-FIX-08's
  // governance thesis exists to close. Mirror the source's definition EXACTLY
  // (weeks whose phase === 'taper', race week included) so this can never
  // false-positive against the note the engine itself writes.
  {
    const actualTaperWeeks = plan.weeks.filter(w => w.phase === 'taper').length
    if (actualTaperWeeks > 0) {
      const WORD_TO_NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 }
      const TAPER_COPY_RE = /\b(one|two|three|four|five|\d+)[\s-]week taper\b/i
      for (const w of plan.weeks) {
        for (const [day, s] of Object.entries(w.sessions ?? {})) {
          const note = (s?.coach_notes ?? []).filter(Boolean).join(' ')
          const m = TAPER_COPY_RE.exec(note)
          if (!m) continue
          const stated = WORD_TO_NUM[m[1].toLowerCase()] ?? Number(m[1])
          if (Number.isFinite(stated) && stated !== actualTaperWeeks) {
            violations.push({
              code: 'INV-PLAN-TAPER-COPY-MATCHES-DURATION',
              principle_ref: 'CoachingPrinciples §6',
              severity: 'error',
              week: w.n,
              day,
              message: `Coach note says "${m[0]}" but the plan has ${actualTaperWeeks} taper-phase week(s)`,
              actual: m[0],
              expected: `${actualTaperWeeks}-week taper`,
            })
          }
        }
      }
    }
  }

  // INV-PLAN-LARGEST-SESSIONS-SPACED (CoachingPrinciples §7, CD-12) — the two
  // largest aerobic sessions of a week should sit ≥48h apart. WARN, not error:
  // a runner's fixed available days (e.g. 3-day Mon/Wed/Sat) can force them
  // closer, and life-first scheduling (§18) wins — but a lumpy week should be
  // surfaced, not shipped silently.
  {
    const minGapDays = Math.ceil(GENERATION_CONFIG.MIN_HOURS_BETWEEN_LARGEST_SESSIONS / 24)
    // Runs only — the race itself isn't a training session; rest is absent and
    // strength is disabled, so neither appears as a placed session here.
    const runSize = (s: import('@/types/plan').Session): number =>
      s.type === 'race' ? 0 : (s.distance_km ?? s.duration_mins ?? 0)
    for (const w of plan.weeks) {
      if (w.n <= 0 || w.type === 'deload') continue
      const placed = (Object.entries(w.sessions ?? {}) as [string, import('@/types/plan').Session | undefined][])
        .filter(([, s]) => !!s && runSize(s) > 0)
        .map(([day, s]) => ({ day, size: runSize(s!) }))
        .sort((a, b) => b.size - a.size)
      if (placed.length < 2) continue
      const [a, b] = placed
      const ia = DAYS_MON_SUN.indexOf(a.day as DayKey)
      const ib = DAYS_MON_SUN.indexOf(b.day as DayKey)
      if (ia < 0 || ib < 0) continue
      const gap = Math.min(Math.abs(ia - ib), 7 - Math.abs(ia - ib))
      if (gap < minGapDays) {
        violations.push({
          code: 'INV-PLAN-LARGEST-SESSIONS-SPACED',
          principle_ref: 'CoachingPrinciples §7',
          severity: 'warn',
          week: w.n,
          message: `The two largest sessions (${a.day}, ${b.day}) are ${gap} day(s) apart — under the ${minGapDays}-day target. Likely forced by available days.`,
          actual: `${gap} day(s)`,
          expected: `>= ${minGapDays} days`,
        })
      }
    }
  }

  // INV-PLAN-RECALIBRATION-HAS-SESSION — a week listed in
  // meta.recalibration_weeks must actually contain the benchmark session its
  // theme promises. (CoachingPrinciples §78)
  //
  // Before this, `recalibration_weeks` was written from intent: the theme told
  // the runner to "run a parkrun or timed 5K" and no session was ever placed,
  // in any plan, for any persona (analysis F8).
  {
    for (const weekN of plan.meta.recalibration_weeks ?? []) {
      const week = plan.weeks.find(w => w.n === weekN)
      if (!week) {
        violations.push({
          code: 'INV-PLAN-RECALIBRATION-HAS-SESSION',
          principle_ref: 'CoachingPrinciples §78',
          severity: 'error',
          week: weekN,
          message: `meta.recalibration_weeks lists week ${weekN}, which does not exist in the plan`,
          actual: 'missing week',
          expected: 'a week containing a benchmark session',
        })
        continue
      }
      const hasBenchmark = Object.values(week.sessions ?? {}).some(s => s?.type === 'hard')
      if (!hasBenchmark) {
        violations.push({
          code: 'INV-PLAN-RECALIBRATION-HAS-SESSION',
          principle_ref: 'CoachingPrinciples §78',
          severity: 'error',
          week: weekN,
          message: `Week ${weekN} is listed as a recalibration week but prescribes no benchmark session — the theme instructs a timed 5K that does not exist`,
          actual: 'no benchmark session',
          expected: 'one session of type "hard"',
        })
      }
    }
  }

  // INV-PLAN-PEAK-IN-PEAK-PHASE — the plan's highest-volume week should fall in
  // the peak phase. (CoachingPrinciples §23, §2)
  //
  // WARN when the plan is honestly labelled `maintenance`: a runner already near
  // their level-appropriate peak has little headroom, and a plateau that says so
  // is a valid outcome (§23). ERROR when the plan claims to be a build, because
  // then the label and the shape disagree. Before the §2 bounceback amendment
  // this fired on 4 of 7 personas — every deload ratcheted the ceiling down.
  {
    const nonDeload = plan.weeks.filter(w => w.n > 0 && w.type !== 'race' && w.type !== 'deload')
    const peakPhase = nonDeload.filter(w => w.phase === 'peak')
    if (nonDeload.length > 1 && peakPhase.length > 0) {
      const maxKm = Math.max(...nonDeload.map(w => w.weekly_km))
      // PLATEAU TOLERANCE (VOL-STRUCTURE-01, 2026-08-20). The peak phase must
      // reach the plan's maximum WITHIN PEAK_INVERSION_MATERIAL_PCT.
      //
      // This assertion was absolute, and 86% of the violations it produced were
      // inversions of less than 10% — the measured distribution is min 1.3%,
      // median 4.2%. That band is rounding and plateau, not a coaching failure:
      // session distances round to DISTANCE_ROUNDING_PRECISION_KM across 3-6
      // sessions a week, and this invariant's own note already allows holding
      // volume from build through peak as legitimate.
      //
      // NOTHING IS LEFT UNGUARDED, which is the point. The same numeric is the
      // §52 trigger: an inversion at or above it makes the plan `maintenance`
      // with a note explaining that the runner's volume cannot be built on
      // within their available days. Below it, tolerated here; at or above it,
      // declared there. Two mechanisms, one number, no gap between them.
      const plateauTolerance = 1 - GENERATION_CONFIG.PEAK_INVERSION_MATERIAL_PCT / 100
      // The assertion is that the peak phase REACHES the plan's maximum — not
      // that the maximum occurs there first. Hitting the ceiling in build and
      // holding it through peak is a legitimate plateau, and an earlier-first
      // occurrence is not evidence of the ratchet this guards against.
      const peakPhaseReachesMax = peakPhase.some(w => w.weekly_km >= maxKm * plateauTolerance)
      if (!peakPhaseReachesMax) {
        // Defensive: `find` cannot fail when weekly_km values are finite, but a
        // NaN anywhere makes every comparison false and this returned undefined,
        // crashing validatePlan with an opaque TypeError — and validatePlan
        // throws inside generateRulePlan, so the whole plan died. A missing
        // `current_weekly_km` was enough to trigger it (now rejected up front by
        // validateInputFields, but a crash here is never the right failure).
        const highest = nonDeload.find(w => w.weekly_km === maxKm) ?? nonDeload[0]
        const peakPhaseMax = Math.max(...peakPhase.map(w => w.weekly_km))
        violations.push({
          code: 'INV-PLAN-PEAK-IN-PEAK-PHASE',
          principle_ref: 'CoachingPrinciples §23',
          severity: plan.meta.volume_profile === 'maintenance' ? 'warn' : 'error',
          week: highest.n,
          message: `Peak phase tops out at ${peakPhaseMax}km but the plan reaches ${maxKm}km in week ${highest.n} (${highest.phase})`,
          actual: `peak-phase max ${peakPhaseMax}km`,
          expected: `>= ${maxKm}km`,
        })
      }
    }
  }

  // INV-PLAN-NO-PLACEHOLDER-COPY (warn) — no user-facing string may contain a
  // fallback placeholder. (analysis F6)
  //
  // "Race day: Target Race." shipped to the first organic user. The engine now
  // writes empty rather than inventing, but this guards reintroduction —
  // placeholders are truthy, so they render exactly as if they were real.
  {
    const PLACEHOLDERS = ['Target Race', 'TBD', 'undefined', 'null']
    const scan: Array<[string, string | undefined]> = []
    for (const w of plan.weeks) {
      scan.push([`w${w.n}.label`, w.label])
      scan.push([`w${w.n}.theme`, w.theme])
      scan.push([`w${w.n}.race_notes`, w.race_notes])
      for (const [day, sess] of Object.entries(w.sessions ?? {})) {
        if (!sess) continue
        scan.push([`w${w.n}.${day}.label`, sess.label])
        for (const n of sess.coach_notes ?? []) scan.push([`w${w.n}.${day}.coach_note`, n])
      }
    }
    for (const [where, text] of scan) {
      if (!text) continue
      const hit = PLACEHOLDERS.find(ph => text.includes(ph))
      if (hit) {
        violations.push({
          code: 'INV-PLAN-NO-PLACEHOLDER-COPY',
          principle_ref: 'analysis F6',
          severity: 'warn',
          week: 0,
          message: `Placeholder "${hit}" in user-facing copy at ${where}: "${text}"`,
          actual: hit,
          expected: 'a real value, or copy that omits it',
        })
      }
    }
  }

  // INV-PLAN-HR-ASSUMPTIONS-SURFACED — every plan declares hr_zone_method, and
  // every method that rests on an assumption surfaces hr_assumption_note.
  // (CoachingPrinciples §50, amended 2026-08-06)
  //
  // Previously this exempted `karvonen` outright, on the reasoning that having
  // both numbers meant having good numbers. It doesn't: a HealthKit-observed max
  // lands in the karvonen branch, so the runner whose zones were 28 bpm low was
  // guaranteed to be told nothing at all (analysis N2). Only a karvonen derived
  // from an unmarked, plausible max is silent now.
  {
    const method = plan.meta.hr_zone_method
    if (!method) {
      violations.push({
        code: 'INV-PLAN-HR-ASSUMPTIONS-SURFACED',
        principle_ref: 'CoachingPrinciples §50',
        severity: 'error',
        week: 0,
        message: 'Plan meta missing hr_zone_method — every plan must declare which of the four fallback methods was used',
        actual: 'undefined',
        expected: "one of the six §50 methods",
      })
    } else if (method !== 'karvonen' && !plan.meta.hr_assumption_note) {
      violations.push({
        code: 'INV-PLAN-HR-ASSUMPTIONS-SURFACED',
        principle_ref: 'CoachingPrinciples §50',
        severity: 'error',
        week: 0,
        message: `hr_zone_method is "${method}" but no hr_assumption_note surfaced — non-Karvonen methods MUST include the assumption note`,
        actual: method,
        expected: 'method + hr_assumption_note',
      })
    }
  }

  // INV-PLAN-USER-LEVEL-NO-UPWARD-TONNAGE — a runner who declares a level ABOVE
  // the engine's assessment gets the intensity allowance, never the tonnage. A
  // self-declaration is not evidence of tissue tolerance (§10, §79).
  //
  // Checks the guarantee DIRECTLY: the `peakKm` the volume curve was built from
  // must be the STRUCTURAL band's value. Delivered `weekly_km` is deliberately
  // not used — the curve cap bounds the volume sequence while actual session sums
  // run above it (a 100 km plan on a 72 km structural band delivers a 108 km peak,
  // long-run-dominated ultra weeks, identical with and without a declaration).
  // An earlier revision of this invariant compared delivered peak against the band
  // with a tolerance and produced 115 false violations across the property grid
  // while the engine was behaving correctly. Measure the property, not a proxy.
  //
  // Downward declarations are exempt by design: they legitimately bind structure,
  // so their peak SHOULD reflect the declared level. (CoachingPrinciples §79)
  {
    const declared = plan.meta.fitness_level_declared
    const structural = plan.meta.fitness_level
    const target = plan.meta.peak_km_target
    if (declared && structural && typeof target === 'number'
        && FITNESS_RANK[declared] > FITNESS_RANK[structural]) {
      const band = getDistanceConfig(plan.meta.race_distance_km ?? 0).peakKmByLevel
      const structuralTarget = band[structural]
      if (target > structuralTarget) {
        violations.push({
          code: 'INV-PLAN-USER-LEVEL-NO-UPWARD-TONNAGE',
          principle_ref: 'CoachingPrinciples §79',
          severity: 'error',
          week: 0,
          message: `Runner declared "${declared}" against an assessed "${structural}", and the volume curve was built from a ${target}km peak target — the ${structural} band is ${structuralTarget}km (${declared} is ${band[declared]}km). An upward declaration raises the intensity allowance, never tonnage.`,
          actual: `peak_km_target ${target}, declared ${declared}, structural ${structural}`,
          expected: `peak_km_target = ${structuralTarget} (${structural} band)`,
        })
      }
    }
  }

  // INV-PLAN-MAX-HR-NOT-BELOW-ESTIMATE-FLOOR — no plan may rest on a device-observed
  // or unattributed max HR below its own age-estimated max. A recorded max below the
  // estimate is a floor (§50 asymmetry, HR-MAX-01); the engine must have fallen back
  // to Tanaka. Only an explicitly user-confirmed max may sit below the estimate.
  // (CoachingPrinciples §50)
  {
    const derived = plan.meta.hr_derived_max
    const estimated = plan.meta.hr_estimated_max
    const source = plan.meta.hr_max_source
    if (
      typeof derived === 'number' &&
      typeof estimated === 'number' &&
      derived < estimated &&
      source !== 'user_confirmed'
    ) {
      violations.push({
        code: 'INV-PLAN-MAX-HR-NOT-BELOW-ESTIMATE-FLOOR',
        principle_ref: 'CoachingPrinciples §50',
        severity: 'error',
        week: 0,
        message: `Plan rests on max HR ${derived} bpm, below the age estimate ${estimated} bpm, without user confirmation (source: ${source ?? 'unattributed'}) — a device/unattributed max below the estimate is a floor and must fall back to Tanaka`,
        actual: `derived_max ${derived} < estimated_max ${estimated}, source ${source ?? 'unattributed'}`,
        expected: 'derived_max ≥ estimated_max, or hr_max_source = user_confirmed',
      })
    }
  }

  // INV-PLAN-RETURNING-RUNNER-NOTE-PRESENT — when returning_runner_allowance_active
  // or fresh_return_active is set in plan meta, returning_runner_note must be
  // present and non-empty. (CoachingPrinciples §51)
  if (plan.meta.returning_runner_allowance_active || plan.meta.fresh_return_active) {
    if (!plan.meta.returning_runner_note) {
      violations.push({
        code: 'INV-PLAN-RETURNING-RUNNER-NOTE-PRESENT',
        principle_ref: 'CoachingPrinciples §51',
        severity: 'error',
        week: 0,
        message: 'returning_runner_allowance_active or fresh_return_active is set but returning_runner_note is missing — silent allowance is a coaching defect',
        actual: 'undefined',
        expected: 'human-readable note explaining what was scaled and why',
      })
    }
  }

  // INV-PLAN-TAPER-DURATION-CAP — taper phase weeks (including race week) must
  // not exceed MAX_TAPER_PHASE_WEEKS for the race distance.
  // (CoachingPrinciples §49)
  {
    const distCfgKey = (() => {
      const km = input.race_distance_km
      if (km <= 6)  return '5K'
      if (km <= 12) return '10K'
      if (km <= 22) return 'HM'
      if (km <= 43) return 'MARATHON'
      if (km <= 55) return '50K'
      return '100K'
    })() as keyof typeof GENERATION_CONFIG.MAX_TAPER_PHASE_WEEKS
    const cap = GENERATION_CONFIG.MAX_TAPER_PHASE_WEEKS[distCfgKey]
    const taperWeeks = plan.weeks.filter(w => w.phase === 'taper').length
    if (taperWeeks > cap) {
      violations.push({
        code: 'INV-PLAN-TAPER-DURATION-CAP',
        principle_ref: 'CoachingPrinciples §49',
        severity: 'error',
        week: 0,
        message: `Taper phase is ${taperWeeks} weeks (including race week); cap for ${distCfgKey} is ${cap}. Excess weeks must flow to base or build, not taper.`,
        actual: taperWeeks,
        expected: `≤ ${cap}`,
      })
    }
  }

  // INV-PLAN-PEAK-LR-ALTERNATION — within peak phase, no two consecutive
  // weeks may both carry a peak-level long run (≥ PEAK_LR_ALTERNATION_THRESHOLD_PCT
  // of the plan's peak LR distance AND with race-pace segments).
  // (CoachingPrinciples §47) Exception: hard_session_relationship: 'love',
  // no injury_history, training_age '5yr+' may have ONE occurrence per plan.
  //
  // Scoped to HM and marathon only. 5K/10K peak LR pace segments (§24b) do
  // not trigger alternation — recovery demand is different at shorter distances.
  {
    const distKeyAlt = raceDistanceKey(input.race_distance_km)
    if (distKeyAlt !== 'HM' && distKeyAlt !== 'MARATHON') {
      // Not applicable — skip alternation check for shorter distances.
    } else
    {
    const peakWeeks = plan.weeks.filter(w => w.phase === 'peak' && w.type !== 'deload')
    if (peakWeeks.length >= 2) {
      const peakLrKms = peakWeeks.map(w => {
        const lr = Object.values(w.sessions).find(s =>
          !!s && isLongRun(s)
        )
        return lr?.distance_km ?? 0
      })
      const maxPeakLrKm = peakLrKms.length > 0 ? Math.max(...peakLrKms) : 0
      const threshold = (GENERATION_CONFIG.PEAK_LR_ALTERNATION_THRESHOLD_PCT / 100) * maxPeakLrKm
      const isPeakLevel = (week: typeof plan.weeks[number]): boolean => {
        const lr = Object.values(week.sessions).find(s =>
          !!s && isLongRun(s)
        )
        if (!lr || lr.distance_km == null) return false
        if (lr.distance_km + 0.01 < threshold) return false
        const label = (lr.label ?? '').toLowerCase()
        const hasRacePace = label.includes('pace') || label.includes(' mp') || label.startsWith('mp') || label.includes('hm-pace')
        return hasRacePace
      }
      const exceptionEligible = input.hard_session_relationship === 'love'
        && (input.injury_history ?? []).length === 0
        && input.training_age === '5yr+'
      let exceptionUsed = false
      for (let i = 1; i < peakWeeks.length; i++) {
        const prev = peakWeeks[i - 1]
        const curr = peakWeeks[i]
        if (isPeakLevel(prev) && isPeakLevel(curr)) {
          if (exceptionEligible && !exceptionUsed) {
            exceptionUsed = true
            continue
          }
          violations.push({
            code: 'INV-PLAN-PEAK-LR-ALTERNATION',
            principle_ref: 'CoachingPrinciples §47',
            severity: 'error',
            week: curr.n,
            message: `Peak weeks W${prev.n} and W${curr.n} both carry a peak-level long run (≥${GENERATION_CONFIG.PEAK_LR_ALTERNATION_THRESHOLD_PCT}% of peak distance with race-pace segments). Alternate via step-back or deload.`,
            actual: `W${prev.n}=${peakLrKms[i - 1]}km, W${curr.n}=${peakLrKms[i]}km`,
            expected: 'one of them is a step-back or easy long run',
          })
        }
      }
    }
    }
  }

  // INV-PLAN-FOUNDATION-BLOCK — foundation weeks must contain only easy/rest/
  // cross-train sessions, must not exceed the effective baseline volume, and
  // must not increase by more than +10% per week within the block.
  // (CoachingPrinciples §57)
  {
    const foundationWeeks = plan.weeks.filter(w => w.phase === 'foundation')
    if (foundationWeeks.length > 0) {
      const forbiddenTypes = new Set(['quality', 'tempo', 'intervals', 'hard', 'long', 'race'])
      for (const fw of foundationWeeks) {
        for (const [day, session] of Object.entries(fw.sessions)) {
          if (!session) continue
          if (forbiddenTypes.has(session.type)) {
            violations.push({
              code: 'INV-PLAN-FOUNDATION-BLOCK',
              principle_ref: 'CoachingPrinciples §57',
              severity: 'error',
              week: fw.n,
              day: day as Day,
              message: `Foundation week W${fw.n} contains forbidden session type '${session.type}'. Only easy/rest/cross-train allowed.`,
              actual: session.type,
              expected: 'easy | rest | cross-train',
            })
          }
        }
        // Volume cap: §57 permits the block to grow to effective baseline × 1.10
        // (+10%/week, capped at the final week). Effective baseline ≤
        // current_weekly_km, so current_weekly_km × 1.10 is a safe upper bound that
        // honours the growth allowance. The old bound was current_weekly_km flat,
        // which false-flagged a legitimate multi-week block for a non-fresh-return
        // runner (baseline == current_weekly_km, so week 2 at +10% tripped it).
        // The within-block +10%/week arm below enforces the tighter per-step limit.
        const statedKm = input.current_weekly_km ?? 0
        const volumeCeiling = statedKm * (1 + GENERATION_CONFIG.FOUNDATION_WEEKLY_INCREASE_PCT / 100)
        if (statedKm > 0 && fw.weekly_km > volumeCeiling + 0.01) {
          violations.push({
            code: 'INV-PLAN-FOUNDATION-BLOCK',
            principle_ref: 'CoachingPrinciples §57',
            severity: 'error',
            week: fw.n,
            message: `Foundation week W${fw.n} volume ${fw.weekly_km}km exceeds effective-baseline ceiling ${volumeCeiling.toFixed(1)}km (current_weekly_km ${statedKm}km × 1.10)`,
            actual: `${fw.weekly_km}km`,
            expected: `≤ ${volumeCeiling.toFixed(1)}km`,
          })
        }
        // Long-run fraction cap (§57 / §9): the longest session in a foundation
        // week must not exceed FOUNDATION_LONG_RUN_MAX_PCT of that week's volume.
        // A long run that dominates a reduced fresh-return week is a within-week
        // binge (§9's stated threshold) — the injury vector the Coaching Board
        // flagged for the returning population (Coaching-1). Foundation sessions
        // are all typed 'easy', so the long run is identified structurally as the
        // longest-distance session, not by label.
        //
        // Scoped to ≥3 running sessions: at 1–2 runs a week a long run is not a
        // distinct session (§5 — fraction is undefined at low session counts), and
        // the cap would otherwise mechanically force the single easy run above 35%
        // and false-flag a week that carries no binge.
        const runKms = Object.values(fw.sessions)
          .filter(s => s && s.type !== 'rest' && s.type !== 'cross-train')
          .map(s => s?.distance_km ?? 0)
        const longestKm = Math.max(0, ...runKms)
        const lrCapKm = fw.weekly_km * (GENERATION_CONFIG.FOUNDATION_LONG_RUN_MAX_PCT / 100)
        if (runKms.length >= 3 && fw.weekly_km > 0 && longestKm > lrCapKm + 0.01) {
          violations.push({
            code: 'INV-PLAN-FOUNDATION-BLOCK',
            principle_ref: 'CoachingPrinciples §57',
            severity: 'error',
            week: fw.n,
            message: `Foundation week W${fw.n} long run ${longestKm.toFixed(1)}km exceeds ${GENERATION_CONFIG.FOUNDATION_LONG_RUN_MAX_PCT}% of weekly ${fw.weekly_km}km`,
            actual: `${longestKm.toFixed(1)}km`,
            expected: `≤ ${lrCapKm.toFixed(1)}km`,
          })
        }
      }
      // +10%/week cap within the foundation block
      for (let i = 1; i < foundationWeeks.length; i++) {
        const prev = foundationWeeks[i - 1]
        const curr = foundationWeeks[i]
        if (prev.weekly_km > 0) {
          const maxAllowed = prev.weekly_km * 1.10 + 0.01
          if (curr.weekly_km > maxAllowed) {
            violations.push({
              code: 'INV-PLAN-FOUNDATION-BLOCK',
              principle_ref: 'CoachingPrinciples §57',
              severity: 'error',
              week: curr.n,
              message: `Foundation block W${curr.n} (${curr.weekly_km}km) increases by more than +10% from W${prev.n} (${prev.weekly_km}km)`,
              actual: `${curr.weekly_km}km`,
              expected: `≤ ${(prev.weekly_km * 1.10).toFixed(1)}km`,
            })
          }
        }
      }
    }
  }

  // INV-PLAN-5K10K-LR-PACE-CAP — for time-targeted 5K/10K plans, any embedded
  // lr_segment_pace on a long run in the final two peak weeks must be ≤ HM pace
  // (≈84% VDOT). Prevents the engine from accidentally prescribing race-pace
  // segments at 5K intensity on an easy session.
  // (CoachingPrinciples §24b)
  if (isTimeTarget && (distKey === '5K' || distKey === '10K') && plan.meta.vdot) {
    const hmCeilingPerKm = paceFromVdot(plan.meta.vdot * 0.97, 0.84)
    const taperPh = plan.weeks.find(w => w.phase === 'taper')
    for (const w of plan.weeks) {
      if (w.phase !== 'peak' || w.type === 'deload') continue
      const weekN = w.n
      const weeksUntilTaper = taperPh ? taperPh.n - weekN : 999
      if (weeksUntilTaper > 2) continue
      for (const [day, s] of Object.entries(w.sessions) as [string, Session | undefined][]) {
        if (!s || !isLongRun(s) || !s.lr_segment_pace) continue
        const segMid = parsePaceMidpoint(s.lr_segment_pace)
        if (segMid != null && segMid < hmCeilingPerKm - 0.05) {
          violations.push({
            code: 'INV-PLAN-5K10K-LR-PACE-CAP',
            principle_ref: 'CoachingPrinciples §24b',
            severity: 'error',
            week: w.n, day,
            message: `5K/10K peak long-run lr_segment_pace ${s.lr_segment_pace} midpoint ${segMid.toFixed(2)}/km is faster than HM ceiling ${hmCeilingPerKm.toFixed(2)}/km — segments must not exceed HM pace`,
            actual: segMid.toFixed(2),
            expected: `≥ ${hmCeilingPerKm.toFixed(2)} (≤ HM pace)`,
          })
        }
      }
    }
  }

  // INV-PLAN-BUILD-LR-SEGMENT-CAP — for time-targeted 5K/10K build-phase long
  // runs, the Z2-ceiling note segment is a notes-layer cue only (no lr_segment_pace).
  // This invariant guards that no structural pace segment leaks into build-phase
  // long runs for short distances.
  // (CoachingPrinciples §24c)
  if (isTimeTarget && (distKey === '5K' || distKey === '10K')) {
    for (const w of plan.weeks) {
      if (w.phase !== 'build' || w.type === 'deload') continue
      for (const [day, s] of Object.entries(w.sessions) as [string, Session | undefined][]) {
        if (!s || !isLongRun(s)) continue
        if (s.lr_segment_pace) {
          violations.push({
            code: 'INV-PLAN-BUILD-LR-SEGMENT-CAP',
            principle_ref: 'CoachingPrinciples §24c',
            severity: 'error',
            week: w.n, day,
            message: `5K/10K time-targeted build-phase long run must not carry lr_segment_pace — §24c is notes-only`,
            actual: s.lr_segment_pace,
            expected: 'undefined (no pace segment in build)',
          })
        }
      }
    }
  }

  // INV-PLAN-FINISH-GOAL-LR-CAP — finish-goal long runs must never carry
  // lr_segment_pace regardless of phase or distance. §24d prescribes a feel-based
  // negative-split note, not a pace target.
  // (CoachingPrinciples §24d)
  if (input.goal === 'finish') {
    for (const w of plan.weeks) {
      for (const [day, s] of Object.entries(w.sessions) as [string, Session | undefined][]) {
        if (!s || !isLongRun(s)) continue
        if (s.lr_segment_pace) {
          violations.push({
            code: 'INV-PLAN-FINISH-GOAL-LR-CAP',
            principle_ref: 'CoachingPrinciples §24d',
            severity: 'error',
            week: w.n, day,
            message: `Finish-goal long run must not carry lr_segment_pace — §24d prescribes feel-based negative-split only`,
            actual: s.lr_segment_pace,
            expected: 'undefined (no pace target for finish-goal LR)',
          })
        }
      }
    }
  }

  // INV-PLAN-ULTRA-NO-PACE-SEGMENTS — ultra (50K+) long runs must never carry
  // lr_segment_pace. Ultra training is pure aerobic time-on-feet.
  // (CoachingPrinciples §24e)
  if (distKey === '50K' || distKey === '100K') {
    for (const w of plan.weeks) {
      for (const [day, s] of Object.entries(w.sessions) as [string, Session | undefined][]) {
        if (!s || !isLongRun(s)) continue
        if (s.lr_segment_pace) {
          violations.push({
            code: 'INV-PLAN-ULTRA-NO-PACE-SEGMENTS',
            principle_ref: 'CoachingPrinciples §24e',
            severity: 'error',
            week: w.n, day,
            message: `Ultra long run must not carry lr_segment_pace — ultra training is pure aerobic time-on-feet (§24e)`,
            actual: s.lr_segment_pace,
            expected: 'undefined (no pace segments on ultra long runs)',
          })
        }
      }
    }
  }

  return violations
}

/**
 * Reshape-time constitutional check (RESHAPE-FIX-WAVE3-PHASE2).
 *
 * `validatePlan` needs a `GeneratorInput`, which the reshape path doesn't have.
 * Derive a best-effort one from `plan.meta` (persisted at generation precisely
 * so the R20 reshaper can operate without re-asking — see PlanMeta). Fields not
 * stored on meta (`current_weekly_km`, `longest_recent_run_km`,
 * `days_cannot_train`, `max_weekday_mins`) are left empty; every invariant that
 * reads them is guarded (`> 0` / optional) and self-skips, so this NEVER
 * produces a false violation. Net effect: all structural per-week invariants
 * (rest day, race-week sharpening, min distance, long-run cap, quality caps,
 * quality/long spacing) are enforced at reshape time; only the generation-time
 * volume-progression and blocked-days invariants are skipped — a within-week
 * reshape doesn't alter those, and the reshape builders respect blocked days at
 * construction.
 *
 * Two further generation-time invariants are skipped here for the same reason: a
 * within-week session swap cannot change whether the plan reaches race day
 * (`INV-PLAN-COVERS-RACE-DATE`) or whether the race sits on race day
 * (`INV-PLAN-RACE-ON-RACE-DAY`) — those are properties of the whole-plan week
 * layout, fixed at generation. Enforcing them here made every *legacy* plan
 * generated before GEN-FIX-03 (which by definition ends short of race day — that
 * was the F2 defect) report an error on ANY reshape, emitting a spurious
 * `reshape_invalid` ops event in prod and throwing in dev/test — attributing a
 * pre-existing generation defect to a reshape that neither caused nor can fix it.
 *
 * `INV-PLAN-COPY-MATCHES-SESSIONS` IS still enforced (a reshape can make a week's
 * copy false — that's what `refreshWeekCopyIfStale` guards), but only on the
 * reshaped week when it's known: stale copy on an untouched legacy week is a
 * pre-GEN-FIX-06 generation defect, not this reshape's responsibility.
 */
const RESHAPE_SKIP_INVARIANTS = new Set<string>([
  'INV-PLAN-COVERS-RACE-DATE',
  'INV-PLAN-RACE-ON-RACE-DAY',
])

export function validateReshapedPlan(plan: Plan, reshapedWeekN?: number): Violation[] {
  const m = plan.meta

  // ADR-020 / CB-2 (2026-09-03) — prefer the PERSISTED generator input.
  //
  // This function used to hand-rebuild the input from scattered meta fields and
  // zero out three of them, with comments reading "not on meta". Those comments
  // were stale: PV2-A (fff1ab3) persists the complete input at
  // `meta.generator_input`, and ruleEngine.ts names these very fields as the
  // reason it does — "current_weekly_km, longest_recent_run_km,
  // days_cannot_train and preferred_long_run_day are consumed by the engine and
  // were otherwise discarded".
  //
  // The cost of the stale version was three invariant families sitting INERT on
  // every reshape — the same failure class as SWEEP-VACUOUS-01: an input the
  // checker never reads tests nothing. Measured on 2,688 generated plans,
  // switching to the real input surfaces 1,380 INV-PLAN-MAX-WEEKDAY-MINS
  // violations that were previously invisible (all genuine — see MWM-02).
  //
  // MERGE, not replacement: the raw runner constraints come from the persisted
  // input, but `fitness_level` / `fitness_intensity_level` must still come from
  // meta. Those are what the engine DERIVED and built the plan with; the input's
  // own `fitness_level` is frequently absent (the assessed path) and would
  // re-derive the quality ceiling from the wrong level (§79).
  const persisted = m.generator_input
  const input: GeneratorInput = persisted
    ? {
        ...persisted,
        fitness_level:           m.fitness_level ?? persisted.fitness_level,
        fitness_intensity_level: m.fitness_intensity_level ?? persisted.fitness_intensity_level,
        user_declared_level:     m.fitness_level_declared ?? persisted.user_declared_level,
      }
    : {
    // Legacy plans generated before PV2-A carry no persisted input. Reconstruct
    // as before; the three zeroed fields self-skip their dependent invariants.
    race_date:             m.race_date,
    race_distance_km:      m.race_distance_km,
    goal:                  m.goal ?? 'finish',
    current_weekly_km:     0,   // absent on legacy meta — dependent invariants self-skip on 0
    longest_recent_run_km: 0,   // absent on legacy meta — dependent invariants self-skip on 0
    days_available:        m.days_available ?? 7,
    age:                   m.age ?? 40,
    fitness_level:         m.fitness_level,
    // §79 (2026-09-02) — carry the intensity level across the meta→input
    // round-trip. Without it the quality-per-week ceiling above re-derives from
    // the structural level and a legitimately elevated-intensity plan fails
    // validation on every reshape.
    fitness_intensity_level: m.fitness_intensity_level,
    user_declared_level:   m.fitness_level_declared,
    training_age:          m.training_age,
    injury_history:        m.injury_history,
    hard_session_relationship: m.hard_session_relationship,
    benchmark:             m.benchmark,
    days_cannot_train:     [], // absent on legacy meta — blocked-days invariant skipped
  }
  return validatePlan(plan, input).filter(v => {
    if (RESHAPE_SKIP_INVARIANTS.has(v.code)) return false
    // Copy-match is the reshaper's concern only for the week it touched.
    if (v.code === 'INV-PLAN-COPY-MATCHES-SESSIONS' && reshapedWeekN != null && v.week !== reshapedWeekN) {
      return false
    }
    return true
  })
}

const PHASE1_SESSION_TYPES = new Set(['easy', 'rest', 'cross-train', 'cross_train'])
const RACE_SPECIFIC_CATEGORIES = new Set(['race_specific', 'ultra_specific'])

/** Constitutional checks for maintenance weeks (MAINT-01). Called by generateMaintenanceBlock,
 *  not by validatePlan — maintenance weeks are generated separately from the main plan. */
export function validateMaintenanceBlock(
  weeks: import('@/types/plan').Week[],
  baseWeeklyKm: number,
  injured = false,
  sourceRunDays: number | null = null,
): Violation[] {
  const violations: Violation[] = []
  const qualityTypes = new Set(['tempo', 'threshold', 'intervals', 'quality', 'vo2max', 'cruise'])
  // Maintenance is a tick-over: it must never schedule MORE run days than the
  // athlete's real cadence (§75). Rest and cross-train aren't runs.
  const nonRunTypes = new Set(['rest', 'cross-train', 'cross_train'])
  // §75 rev — maintenance anchors to BASE; no week (Phase 1 or 2) may exceed it.
  const volumeCeiling = baseWeeklyKm * (GENERATION_CONFIG.POST_RACE_MAINTENANCE_BLOCK.VOLUME_CEILING_PCT_OF_BASE / 100)

  for (const w of weeks) {
    const isPhase1 = w.phase === 'maintenance_restoration'
    const sessions = Object.entries(w.sessions ?? {}) as [string, import('@/types/plan').Session | undefined][]
    const placed = sessions.filter(([, s]) => !!s)

    // INV-MAINT-REST-DAY — every maintenance week includes ≥1 rest day (§64 extended)
    if (!weekHasRestDay(placed.map(([, s]) => s))) {
      violations.push({
        code: 'INV-MAINT-REST-DAY',
        principle_ref: 'CoachingPrinciples §64, §75',
        severity: 'error',
        week: w.n,
        message: 'Maintenance week has no rest day',
        actual: 0,
        expected: '>= 1 rest day',
      })
    }

    // INV-MAINT-PHASE1-SESSION-TYPES — Phase 1 allows only easy, rest, cross-train
    if (isPhase1) {
      for (const [day, s] of placed) {
        if (!s || s.type === 'rest') continue
        if (!PHASE1_SESSION_TYPES.has(s.type)) {
          violations.push({
            code: 'INV-MAINT-PHASE1-SESSION-TYPES',
            principle_ref: 'CoachingPrinciples §75',
            severity: 'error',
            week: w.n, day,
            message: `Phase 1 maintenance week contains banned session type: ${s.type}`,
            actual: s.type,
            expected: 'easy | rest | cross-train only',
          })
        }
      }
    }

    // INV-MAINT-QUALITY-CAP — Phase 2 allows at most PHASE2_QUALITY_PER_WEEK quality sessions
    if (!isPhase1) {
      const qualityCount = placed.filter(([, s]) => s && qualityTypes.has(s.type)).length
      const cap = GENERATION_CONFIG.POST_RACE_MAINTENANCE_BLOCK.PHASE2_QUALITY_PER_WEEK
      if (qualityCount > cap) {
        violations.push({
          code: 'INV-MAINT-QUALITY-CAP',
          principle_ref: 'CoachingPrinciples §75',
          severity: 'error',
          week: w.n,
          message: `Phase 2 maintenance week has ${qualityCount} quality sessions (max ${cap})`,
          actual: qualityCount,
          expected: `<= ${cap}`,
        })
      }
    }

    // INV-MAINT-VOLUME-CEILING — no maintenance week exceeds base volume (§75 rev)
    if (w.weekly_km > volumeCeiling + 0.1) {
      violations.push({
        code: 'INV-MAINT-VOLUME-CEILING',
        principle_ref: 'CoachingPrinciples §75',
        severity: 'error',
        week: w.n,
        message: `Maintenance weekly volume ${w.weekly_km}km exceeds base ceiling ${volumeCeiling.toFixed(1)}km`,
        actual: w.weekly_km,
        expected: `<= ${volumeCeiling.toFixed(1)}km (base volume ${baseWeeklyKm}km)`,
      })
    }

    // INV-MAINT-CADENCE — maintenance never runs MORE days/week than the athlete's
    // real source cadence (§75 conservative tick-over). Skipped when cadence unknown.
    if (sourceRunDays != null) {
      const runDays = placed.filter(([, s]) => s && !nonRunTypes.has(s.type)).length
      if (runDays > sourceRunDays) {
        violations.push({
          code: 'INV-MAINT-CADENCE',
          principle_ref: 'CoachingPrinciples §75',
          severity: 'error',
          week: w.n,
          message: `Maintenance week schedules ${runDays} run days, above source cadence ${sourceRunDays}`,
          actual: runDays,
          expected: `<= ${sourceRunDays} run days/week`,
        })
      }
    }

    // INV-MAINT-INJURY-EASY-ONLY — injured athletes get no quality return anywhere
    // in the block (Layer 2). The mild-quality session is type 'easy' with strides,
    // so it's detected by label, not type.
    if (injured) {
      for (const [day, s] of placed) {
        if (s && /strides/i.test(s.label ?? '')) {
          violations.push({
            code: 'INV-MAINT-INJURY-EASY-ONLY',
            principle_ref: 'CoachingPrinciples §75',
            severity: 'error',
            week: w.n, day,
            message: `Injured athlete's maintenance week contains a strides/quality session`,
            actual: s.label,
            expected: 'easy-only when injury_history is non-empty',
          })
        }
      }
    }

    // INV-MAINT-NO-RACE-SPECIFIC — no race-specific or ultra-specific sessions in any maintenance week
    for (const [day, s] of placed) {
      if (!s || !RACE_SPECIFIC_CATEGORIES.has((s as any).category ?? '')) continue
      violations.push({
        code: 'INV-MAINT-NO-RACE-SPECIFIC',
        principle_ref: 'CoachingPrinciples §75',
        severity: 'error',
        week: w.n, day,
        message: `Maintenance week contains race-specific session category: ${(s as any).category}`,
        actual: (s as any).category,
        expected: 'no race_specific or ultra_specific sessions in maintenance',
      })
    }
  }

  // INV-MAINT-REENGAGEMENT-WINDOW — §75 Phase 3 (MAINT-07). The re-engagement
  // window is exactly the LAST `PHASE3_LAST_WEEKS` Phase 2 weeks (fewer only when
  // the block's Phase 2 is shorter than that). This is what the CA-03 goal ladder
  // gates on, so a mis-marked window would either re-open the forward
  // conversation mid-recovery or never open it at all — neither errors, both are
  // silent. Restoration weeks may never be marked: Phase 1 is a quality blackout
  // and forward goal language is forbidden there.
  const phase2 = weeks.filter(w => w.phase === 'maintenance_base')
  const expectedFrom = Math.max(0, phase2.length - GENERATION_CONFIG.POST_RACE_MAINTENANCE_BLOCK.PHASE3_LAST_WEEKS)
  phase2.forEach((w, i) => {
    const shouldMark = i >= expectedFrom
    if (!!w.reengagement !== shouldMark) {
      violations.push({
        code: 'INV-MAINT-REENGAGEMENT-WINDOW',
        principle_ref: 'CoachingPrinciples §75 (Phase 3), §67',
        severity: 'error',
        week: w.n,
        message: shouldMark
          ? 'Phase 2 week inside the re-engagement window is not marked `reengagement`'
          : 'Phase 2 week outside the re-engagement window is marked `reengagement`',
        actual: String(!!w.reengagement),
        expected: `reengagement === ${shouldMark} (last ${GENERATION_CONFIG.POST_RACE_MAINTENANCE_BLOCK.PHASE3_LAST_WEEKS} of ${phase2.length} Phase 2 weeks)`,
      })
    }
  })
  for (const w of weeks) {
    if (w.phase === 'maintenance_restoration' && w.reengagement) {
      violations.push({
        code: 'INV-MAINT-REENGAGEMENT-WINDOW',
        principle_ref: 'CoachingPrinciples §75 (Phase 3)',
        severity: 'error',
        week: w.n,
        message: 'Restoration (Phase 1) week is marked `reengagement` — the quality blackout never re-opens the forward conversation',
        actual: 'true',
        expected: 'reengagement only on Phase 2 weeks',
      })
    }
  }

  return violations
}

export function formatViolations(violations: Violation[]): string {
  if (violations.length === 0) return 'No violations.'
  return violations.map(v =>
    `[${v.severity.toUpperCase()}] ${v.code} (${v.principle_ref}) — week ${v.week}` +
    (v.day ? ` ${v.day}` : '') +
    `: ${v.message}. Got ${v.actual}, expected ${v.expected}.`
  ).join('\n')
}

/**
 * The single policy for what happens after validatePlan() runs: throw in
 * dev/test (so the matrix/property tests fail loudly), log in prod (never
 * break a runner's plan over a defect, per ADR-006). Extracted from
 * generateRulePlan's tail (ADR-020 Option A) so every caller that composes or
 * mutates a plan post-generation — the route, the foundation-block endpoint —
 * reacts to violations the same way, not a hand-copied variant.
 */
export function enforceViolations(violations: Violation[]): void {
  const errors = violations.filter(v => v.severity === 'error')
  if (errors.length === 0) return
  const msg = `Plan invariant violations:\n${formatViolations(errors)}`
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    throw new Error(msg)
  }
  console.error(msg)
}
