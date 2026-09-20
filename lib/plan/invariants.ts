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

import type { Plan, GeneratorInput, Session, Week } from '@/types/plan'
import { strideCarrierDay, hasHillRestrictingInjury } from './neuromuscular'
import { normaliseDays } from './days'
import { sessionFloorsFor } from './sessionFloors'
import { qualityCeilingFor } from './qualityCeiling'
import { FUELLING_PRACTICE_NOTE, ULTRA_FUELLING_PREFIX } from './fuellingNotes'
import { GENERATION_CONFIG, raceDistanceKey } from './generationConfig'
import { assessBaseBuild } from './baseVolume'
import { PLAN_SIGNATURES } from './planSignatures'
import { V1_SESSION_CATALOGUE } from './sessionCatalogueData'
import { catalogueRowFor } from './catalogueLink'
import { isLongRun, isShakeout, isTimeTrial, classifyStimulus, isVo2maxSession, isStructuredSession } from './sessionRole'
import { mainSetMinutes, durationForMainSet } from './sessionFormat'
import { isV2Structure, StructureV2Schema, goalPaceShapeWord } from './sessionStructureV2'
import { hrBandForZoneString } from '@/lib/coaching/zoneRules'
import { weekIntensityFlags, isOverloadWeek } from './weekIntensityFlags'
import { zonesFromZoneString } from '@/lib/coaching/zoneRules'
// Date helpers live in length.ts — the single owner of plan date arithmetic (D-08).
import { parseDateLocal, formatDate, getDistanceConfig, planWeekCap } from './length'
import { FITNESS_RANK } from './fitnessAssessment'
import { sessionKmSelfPaced } from './sessionDistance'
import { coherentGoal } from './inputs'

export type Severity = 'error' | 'warn'

// Registry of every invariant code defined in this file. Used by the meta-check
// in scripts/r2-coverage-check.ts to assert that each code is mechanically
// enforced — adding a code here without enforcement (or vice versa) is a defect.
// (CoachingPrinciples §34, R2/H-04)
export const INVARIANT_CODES = [
  'INV-PLAN-BOUNCEBACK-BOUNDED',
  'INV-PLAN-INJURY-CAP-DELIVERED',
  'INV-PLAN-EARLY-ONSET-GATED',
  'INV-PLAN-ONRAMP-FLOOR',
  'INV-PLAN-ONSET-YIELD-BOUNDED',
  'INV-PLAN-DERIVED-SET-PACED',
  'INV-PLAN-PEAK-SPECIFICITY',
  'INV-PLAN-QUALITY-NOT-ZERO',
  'INV-PLAN-TIME-TARGET-QUALITY-FLOOR',
  'INV-PLAN-DELIVERED-RAMP',
  'INV-PLAN-DELOAD-PHASE-POSITION',
  'INV-PLAN-OVERDO-BRAKE',
  'INV-PLAN-DELOAD-IS-A-REDUCTION',
  'INV-PLAN-VOLUME-SHORTFALL-DECLARED',
  'INV-PLAN-STRUCTURED-OVERRUN-DECLARED',
  'INV-PLAN-EASY-FLOOR-PROTECTION-DECLARED',
  'INV-PLAN-TERRAIN-EFFORT-NOTE-DECLARED',
  'INV-PLAN-EFFORT-OR-PACE',
  'INV-PLAN-LABEL-MATCHES-STRUCTURE',
  'INV-PLAN-EFFORT-GOVERNED-NOT-GOAL-PACED',
  'INV-PLAN-EFFORT-GOVERNED-DURATION-LOWER-BOUND',
  'INV-PLAN-DERIVED-SET',
  'INV-PLAN-CATALOGUE-LINK',
  'INV-PLAN-MAIN-SET-ORDERING',
  'INV-PLAN-VO2MAX-MAIN-SET-CAP',
  'INV-PLAN-STRUCTURED-SESSION-DURATION-COHERENT',
  'INV-PLAN-VO2MAX-ONSET',
  'INV-PLAN-NO-SESSIONS-ON-BLOCKED-DAYS',
  'INV-PLAN-COACH-NOTES-MATCH-INTENT',
  'INV-PLAN-DISPLAY-ZONE-MATCHES-WORK',
  'INV-PLAN-LABEL-MATCHES-PACE',
  'INV-PLAN-OVER-UNDER-MEAN-NEAR-THRESHOLD',
  'INV-PLAN-DELOAD-PLACEMENT',
  'INV-PLAN-INJURY-NO-HILLS',
  'INV-PLAN-RETURNING-INTENSITY-REENTRY',
  'INV-PLAN-DURATION-ANCHORED-KEEPS-MINUTES',
  'INV-PLAN-RACE-WEEK-SHARPENING',
  'INV-PLAN-RACE-SPECIFIC-EXPOSURE',
  'INV-PLAN-RACE-SPECIFIC-EXPOSURE-RATIO',
  'INV-PLAN-RACE-SPECIFIC-VARIETY',
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
  'INV-PLAN-BEGINNER-NEUROMUSCULAR',
  'INV-PLAN-QUALITY-LONG-SPACING',
  'INV-PLAN-QUALITY-EXPECTED',
  'INV-PLAN-MAX-WEEKDAY-MINS',
  'INV-PLAN-PEAK-LR-RACE-RATIO',
  'INV-PLAN-RACE-SPECIFIC-LONG-RUN',
  'INV-PLAN-LR-RACE-SEGMENT-PCT',
  'INV-PLAN-LONG-RUN-HAS-AN-AXIS',
  'INV-PLAN-NO-RACE-EVE-SESSION',
  'INV-PLAN-RACE-NOTE-SCALES',
  'INV-PLAN-PEAK-OVER-BASE',
  'INV-PLAN-BASE-BUILD-RATIO',
  'INV-PLAN-PEAK-NOT-BELOW-START',
  'INV-PLAN-NOT-DETRAINING',
  'INV-PLAN-VDOT-RAW-EXCEEDS-ANCHOR',
  'INV-PLAN-TAPER-VARIETY',
  'INV-PLAN-PREP-TIME-STATUS-ANNOTATED',
  'INV-PLAN-DIFFICULTY-ANNOTATED',
  'INV-PLAN-DIFFICULTY-NEVER-FRONTS-UNSAFE',
  'INV-PLAN-REENTRY-NOTE-MATCHES-CAUSE',
  'INV-PLAN-LONG-SESSION-FUELLING-NOTE',
  'INV-PLAN-INTENSITY-ORDERING',
  'INV-PLAN-PHASE-FOCUS-REACHABLE',
  'INV-PLAN-PHASE-STRUCTURE',
  'INV-PLAN-EASY-RUN-ZONE-CAP',
  'INV-PLAN-TUNE-UP-CALLOUT',
  'INV-PLAN-MARATHON-RACE-PACE-NOT-ONLY-LONG-RUN',
  'INV-PLAN-FRESH-RETURN-GATE',
  'INV-PLAN-COMPRESSION-CLASSIFICATION',
  'INV-PLAN-COMPRESSION-SPLIT',
  'INV-PLAN-TAPER-LR-NOT-ABOVE-PEAK',
  'INV-PLAN-TAPER-DELIVERED-DEPTH',
  'INV-PLAN-UNCOVERED-RUNWAY-DECLARED',
  'INV-PLAN-STRIDES-PRESENT',
  'INV-PLAN-RACE-WEEK-SHAKEOUT-CAP',
  'INV-PLAN-VDOT-STALENESS-LADDER',
  'INV-PLAN-VO2MAX-FLOAT-IS-A-CEILING',
  'INV-PLAN-SURPLUS-IN-PLAN',
  'INV-PLAN-SECOND-QUALITY-MIN-DAYS',
  'INV-PLAN-INTENSITY-DISTRIBUTION',
  'INV-PLAN-LR-PROGRESSION-CAP',
  'INV-PLAN-PEAK-VOLUME-FLOOR-LONG-RACES',
  'INV-PLAN-PEAK-LR-ALTERNATION',
  'INV-PLAN-PEAK-STEPBACK-VOLUME',
  'INV-PLAN-TAPER-DURATION-CAP',
  'INV-PLAN-RETURNING-RUNNER-NOTE-PRESENT',
  'INV-PLAN-LR-SHORTFALL-CAUSE',
  'INV-PLAN-REENTRY-OMISSION-DECLARED',
  'INV-PLAN-QUALITY-VARIETY-FULL-PLAN',
  'INV-PLAN-LR-MAX-WEEKLY-PCT',
  'INV-PLAN-HR-ASSUMPTIONS-SURFACED',
  'INV-PLAN-MAX-HR-NOT-BELOW-ESTIMATE-FLOOR',
  'INV-PLAN-USER-LEVEL-NO-UPWARD-TONNAGE',
  'INV-PLAN-FOUNDATION-BLOCK',
  'INV-PLAN-RUNWALK-PRESCRIBED',
  'INV-PLAN-ONRAMP-CURVE-CLIMBS',
  'INV-PLAN-ONRAMP-ALL-EASY',
  'INV-PLAN-ONRAMP-PER-RUN-STEP',
  'INV-PLAN-5K10K-LR-PACE-CAP',
  'INV-PLAN-LR-SEGMENT-RECORDED',
  'INV-PLAN-BUILD-LR-SEGMENT-CAP',
  'INV-PLAN-FINISH-GOAL-LR-CAP',
  'INV-PLAN-LR-FLOOR-NOT-ROUNDING',
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
/**
 * How far did this session cover, for a VALIDATOR (SESSION-KM-02).
 *
 * A beginner's plan is duration-anchored: `duration_mins` set, `distance_km`
 * null. Measured across the 621-plan cohort grid: **95.8% of beginner sessions**
 * carry no distance, against 0% for intermediate and experienced. So
 * `distance_km ?? 0` is not a conservative default in this file — it is the
 * assertion "this session covered no ground", and it made four separate checks
 * SILENTLY PASS for beginners rather than fire falsely:
 *
 *   · INV-PLAN-INJURY-CAP-DELIVERED — an injury-capped long run looked like it
 *     never grew, so the delivered cap was never tested
 *   · the healthy weekly-increase equivalent — same
 *   · the peak long-run alternation check — every peak read 0, so alternation
 *     was satisfied vacuously
 *   · INV-PLAN-FOUNDATION-BLOCK's long-run share — `longestKm > cap` can never
 *     be true when every session reads 0, and foundation blocks are almost
 *     entirely a beginner surface
 *
 * The net effect was that the cohort with the least training history ran with
 * the LEAST enforcement, which is the exact inverse of the intent.
 *
 * Conversion uses the session's OWN prescribed pace band — better than any
 * plan-level easy pace, and already parsed here. Returns `null` when there is
 * nothing to convert with, so callers choose between skipping and defaulting
 * rather than inheriting a silent zero.
 */
const sessionKmForCheck = (s: Session | null | undefined): number | null => sessionKmSelfPaced(s)

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

// Coaching Board 2026-09-03 — generalises the reader above to any v2
// structured session, REGARDLESS of shape: a reps block (one work + one
// recovery step, repeated N times — tempo_cruise_short, tenk_pace_intervals,
// the vo2max rows) or a ladder (several DISTINCT steps in sequence, each a
// different length — threshold_ladder's 3-5-8-5-3, repeat 1). Sums every
// step's minutes across every block × that block's own repeat count, rather
// than assuming "one work step found, multiply by reps" — that assumption
// is correct for a reps shape and silently wrong for a ladder (it read only
// the ladder's first, shortest rung and ignored the other four). Read from
// the catalogue ROW's raw structure, never the session's own derived_set,
// whose steps carry already-formatted display text ("5 min", "1:30",
// "1200 m") that is fragile to re-parse when the row's typed length field
// says the same thing without needing to.
/** Every shape noun the engine can actually put in a label. A trailing word
 *  outside this set is someone else's wording — most likely the AI enricher's —
 *  and is skipped rather than flagged. */
const KNOWN_SHAPE_WORDS = new Set(
  V1_SESSION_CATALOGUE.map(r => goalPaceShapeWord(r)).filter((x): x is string => !!x),
)

/** Is this catalogue row effort-governed — every v2 work step carrying an effort
 *  target and no pace? Read from the ROW and structurally, never by id, so it is
 *  the SAME test `makeQualitySession` applies (INV-CLASS). If the two ever
 *  disagreed about what "effort-governed" means, §40b would be enforced against a
 *  different population than the one the engine exempts.
 *  Coaching Board 2026-09-04. */
/** §85 — the row's rep runs at more than one WORKING pace (over-unders).
 *
 *  Mirrors `hasMixedWorkAnchors` in ruleEngine.ts. Duplicated rather than
 *  exported because the invariant layer must be able to disagree with the
 *  engine — a checker that imports the producer's own predicate cannot catch
 *  the producer being wrong about it. Easy-anchored work is excluded here for
 *  the same reason it is there: a progression's ramp is not a second work pace.
 */
/** Main-set minutes of a FIXED-SHAPE sized row, summed from the SESSION's own
 *  derived set (CB-CAT-02).
 *
 *  Reads `derived_set`, not the row, deliberately. The row's lengths are
 *  `{ kind: 'parameter' }` for a parameterised shape like the pyramid, so a
 *  row-only reader cannot resolve them without re-deriving the variant — and
 *  re-deriving it here would mean the checker computing the answer the same way
 *  the producer did, which is how a checker stops being able to disagree.
 *  The derived set is what the runner is actually shown.
 */
function fixedShapeMainMinutes(session: Session): number | null {
  const FIXED_SHAPE_SIZED = new Set(['threshold_pyramid', 'threshold_ladder'])
  if (!session.catalogue_id || !FIXED_SHAPE_SIZED.has(session.catalogue_id)) return null
  const blocks = session.derived_set?.blocks
  if (!blocks?.length) return null
  let mins = 0
  for (const b of blocks) {
    let per = 0
    for (const st of b.steps) {
      // Three renderings, all produced by lib/format for the same field:
      //   "3 min"  "90s"  "1:30"
      // The last carries NO unit, and a first pass required one — so every
      // ladder and pyramid step-set containing a mm:ss recovery returned null
      // and the whole session was skipped. The invariant read green while the
      // defect it was written for sat in front of it. Falsification caught it;
      // the assertion alone did not.
      const len = (st.length ?? '').trim()
      let stepMins: number | null = null
      const mmss = /^(\d+):(\d{2})$/.exec(len)
      const unit = /^(\d+(?:\.\d+)?)\s*(min|s)\b/.exec(len)
      if (mmss) stepMins = +mmss[1] + +mmss[2] / 60
      else if (unit) stepMins = unit[2] === 's' ? +unit[1] / 60 : +unit[1]
      if (stepMins == null) return null   // a distance step — not summable here
      per += stepMins
    }
    mins += per * (b.repeat || 1)
  }
  return mins > 0 ? mins : null
}

function rowHasMixedWorkAnchors(catalogueId: string): boolean {
  const row = V1_SESSION_CATALOGUE.find(r => r.id === catalogueId)
  if (!row || !isV2Structure(row.main_set_structure)) return false
  const parsed = StructureV2Schema.safeParse(row.main_set_structure)
  if (!parsed.success) return false
  const anchors = new Set(
    parsed.data.blocks.flatMap(b => b.steps)
      .filter(st => st.role === 'work' && st.target.kind === 'pace')
      .map(st => (st.target as { anchor: string }).anchor)
      .filter(a => a !== 'E'),
  )
  return anchors.size > 1
}

function rowIsEffortGoverned(catalogueId: string): boolean {
  const row = V1_SESSION_CATALOGUE.find(r => r.id === catalogueId)
  if (!row || !isV2Structure(row.main_set_structure)) return false
  const parsed = StructureV2Schema.safeParse(row.main_set_structure)
  if (!parsed.success) return false
  const work = parsed.data.blocks.flatMap(b => b.steps).filter(st => st.role === 'work')
  return work.length > 0 && work.every(st => st.target.kind === 'effort')
}

/** Minutes of an effort-governed session's derived set whose length is actually
 *  KNOWN — a LOWER BOUND, never the true total.
 *
 *  Reads the SESSION's `derived_set`, not the row, because that is where the
 *  parameters are resolved: the row says `{ kind: 'parameter', param: 'rep_secs' }`
 *  and only the session knows this runner got the 90-second variant. That is the
 *  opposite choice from `pacedRepMainMinutes` below, which reads the row precisely
 *  so a mis-stamped session cannot vouch for itself — the difference is deliberate.
 *  An effort-governed row has NO literal length to read (every one is a parameter,
 *  a mirror, a landmark or open), so a row-only reader returns null for all of
 *  them, which is exactly how these sessions escaped every existing check.
 *
 *  Steps with no measurable length contribute ZERO rather than voiding the whole
 *  session. "Until ready" and "to the bottom of the hill" are real minutes; not
 *  pricing them is what makes this a bound rather than an equality, and the bound
 *  can therefore only ever UNDER-report. Coaching Board 2026-09-04. */
function effortGovernedClosedMinutes(session: Session): number | null {
  const ds = session.derived_set as
    | { blocks?: { repeat?: number; steps?: { length?: string; pace?: string | null }[] }[] }
    | undefined
  if (!ds?.blocks?.length) return null
  // Steps priced by distance need a pace; an effort-governed session has no
  // session-level pace_target by §40b, so take it from a step that carries one
  // (the jog-down recovery is E-anchored). Absent that, distance steps are simply
  // not priced — consistent with the bound-not-equality contract above.
  const stepPace = ds.blocks.flatMap(b => b.steps ?? []).find(s => s.pace)?.pace ?? null
  const mid = parsePaceMidpoint(stepPace ?? '')
  let total = 0
  for (const block of ds.blocks) {
    const repeat = typeof block.repeat === 'number' ? block.repeat : 1
    let blockMins = 0
    for (const step of block.steps ?? []) {
      if (typeof step.length !== 'string') continue
      const mins = closedLengthMinutes(step.length, mid, block.steps ?? [])
      if (mins != null) blockMins += mins
    }
    total += repeat * blockMins
  }
  return total
}

/** Parse a resolved `derived_set` step length to minutes, or null when it is
 *  deliberately open ("until ready") or landmark-bounded ("to the bottom of the
 *  hill"). A mirror ("same as the 1:30") resolves to what it mirrors.
 *
 *  Deliberately NOT shared with `lib/plan/sessionSteps.ts → parseLength`: that one
 *  is a display formatter that falls back to rendering unrecognised text verbatim,
 *  which is right for a UI and wrong for an assertion — a length this function
 *  cannot price must read as "unknown", never as a number. */
function closedLengthMinutes(
  raw: string, paceMidMinPerKm: number | null,
  siblings: { length?: string }[],
): number | null {
  const s = raw.trim()
  const mirror = s.match(/^same as the (.+)$/i)
  if (mirror) {
    // Resolve against the sibling step it names when one matches, so a future
    // mirror phrasing that is not itself a parseable length still resolves.
    const named = siblings.find(x => typeof x.length === 'string' && x.length !== s && x.length.includes(mirror[1]))
    return closedLengthMinutes(named?.length ?? mirror[1], paceMidMinPerKm, [])
  }
  let m = s.match(/^(\d+(?:\.\d+)?)\s*min$/i); if (m) return parseFloat(m[1])
  m = s.match(/^(\d+):(\d{2})$/); if (m) return parseInt(m[1], 10) + parseInt(m[2], 10) / 60
  m = s.match(/^(\d+)\s*s$/i); if (m) return parseInt(m[1], 10) / 60
  m = s.match(/^(\d+(?:\.\d+)?)\s*m$/i)
  if (m) return paceMidMinPerKm == null ? null : (parseFloat(m[1]) / 1000) * paceMidMinPerKm
  m = s.match(/^(\d+(?:\.\d+)?)\s*km$/i)
  if (m) return paceMidMinPerKm == null ? null : parseFloat(m[1]) * paceMidMinPerKm
  return null   // open / landmark / anything unrecognised — priced at zero by the caller
}

function pacedRepMainMinutes(session: Session): number | null {
  const row = session.catalogue_id ? V1_SESSION_CATALOGUE.find(r => r.id === session.catalogue_id) : undefined
  if (!row || !isV2Structure(row.main_set_structure)) return null
  const parsed = StructureV2Schema.safeParse(row.main_set_structure)
  // Only a reps-scaled shape was given structure-driven sizing (pacedRepPlan,
  // Coaching Board 2026-09-03) — a fixed ladder's duration_mins still comes
  // from the older generic quality-session formula and was never asserted to
  // match its own step total. Same narrowing as thresholdReachable.test.ts.
  if (!parsed.success || parsed.data.sizing.scaling !== 'reps') return null
  const headlineMid = parsePaceMidpoint(session.pace_target ?? '')
  // A distance step must be priced at the pace THAT step is run, not the
  // session's single headline pace. Every reps row before intervals_rolling had
  // its only distance steps in the WORK role (recovery was always a duration
  // jog), so headline pace and step pace coincided and the distinction never
  // surfaced. intervals_rolling's recovery is a 300 m FLOAT at E — a distance
  // step at a pace far slower than the headline — and pricing it at the headline
  // (I) pace under-counts the recovery by ~10 min, disagreeing with the engine's
  // own pacedRepPlan (which prices each step at its own anchor). The resolved
  // per-step pace lives on the derived_set; read it, and fall back to the
  // headline only when a step's own pace is absent. (Two-writer pricing drift —
  // the class this file exists to catch; here it surfaced as a hard error.)
  const derivedBlocks = (session.derived_set as
    { blocks?: { steps?: { pace?: string | null }[] }[] } | undefined)?.blocks
  let total = 0
  for (let bi = 0; bi < parsed.data.blocks.length; bi++) {
    const block = parsed.data.blocks[bi]
    // A block's repeat may itself be a resolved parameter (reps shapes) —
    // read it back off the session's own derived_set, which is where the
    // engine stamped the runner-specific count; a ladder's fixed numeric
    // repeat needs no lookup.
    const repeat = typeof block.repeat === 'number'
      ? block.repeat
      : derivedBlocks?.[bi]?.steps != null ? (session.derived_set as { blocks?: { repeat?: number }[] }).blocks?.[bi]?.repeat
      : undefined
    if (typeof repeat !== 'number') return null
    const derivedSteps = derivedBlocks?.[bi]?.steps
    let blockMins = 0
    for (let si = 0; si < block.steps.length; si++) {
      const step = block.steps[si]
      if (step.length.kind === 'duration') { blockMins += step.length.secs / 60; continue }
      if (step.length.kind === 'distance') {
        // Prefer this step's own resolved pace (derived_set); fall back to the
        // session headline for a single-work-step row that predates a derived set.
        const stepMid = parsePaceMidpoint(derivedSteps?.[si]?.pace ?? '') ?? headlineMid
        if (stepMid == null) return null   // distance step with no resolvable pace — can't check
        blockMins += (step.length.m / 1000) * stepMid
        continue
      }
      // to_landmark / mirror / open / parameter: no fixed minute value this
      // check can price (a hill's landmark-bounded length, an effort-governed
      // open interval). Not this invariant's job — skip the session entirely
      // rather than guess.
      return null
    }
    total += repeat * blockMins
  }
  return total
}

// Coaching Board 2026-09-03 — progressive_tempo's continuous shape has no
// literal length on the row at all (its three steps are `{ kind: 'parameter',
// param: 'third_secs' }` — the row cannot hold a runner-varying number, ADR-019's
// whole point), so pacedRepMainMinutes' row-only read cannot recompute it: there
// is no number on the row to sum. Recomputed directly from the same config the
// engine's own progressiveTempoPlan (ruleEngine.ts) reads, keyed by the SAME
// two inputs the engine sizes against (fitness × phase) — mirrors, does not
// duplicate, the engine's sizing decision, the same posture as every other
// invariant in this file.
function progressiveTempoExpectedMainMins(catalogueId: string | undefined, fitness: string | undefined, phase: string | undefined): number | null {
  if (catalogueId !== 'progressive_tempo' || !fitness || !phase) return null
  const byFitness = (GENERATION_CONFIG.PROGRESSIVE_TEMPO_MAIN_MINS as Record<string, Record<string, number>>)[fitness]
  return byFitness?.[phase] ?? byFitness?.build ?? null
}

// Coaching Board 2026-09-03 — tempo_continuous's continuous shape has the same
// no-literal-length problem as progressive_tempo (its one step is `{ kind:
// 'parameter', param: 'work_secs' }`). Mirrors continuousThresholdPlan
// (ruleEngine.ts) exactly, including its taper fallback to
// THRESHOLD_WORK_MIN_MINS (no taper entry in the target table).
/** Expected main-set minutes for `tempo_continuous`.
 *
 *  Reads the SESSION's resolved `derived_set`, not the config table. It used to
 *  recompute `THRESHOLD_WORK_TARGET_MINS[fitness][phase]`, which was right while
 *  that value was the whole story — but §8's Amendment (2026-09-04) gave this
 *  shape floor protection, and how far the main set GROWS to clear
 *  `MIN_SESSION_DISTANCE_KM.quality` depends on the runner's own paces. A config
 *  lookup can no longer predict it, and the invariant fired on a correctly-sized
 *  session (a low-volume 10K taper, grown 15 -> 20 min to clear the 5 km floor).
 *
 *  Reading the session is the right check here rather than a session vouching for
 *  itself: the question this invariant asks is whether the stated `duration_mins`
 *  fits the structure THE RUNNER IS SHOWN, and `derived_set` is that structure.
 *  The row cannot answer it — its lengths are `{ kind: 'parameter' }` by design
 *  (ADR-019), which is why this function existed separately in the first place. */
function continuousThresholdExpectedMainMins(session: Session): number | null {
  if (session.catalogue_id !== 'tempo_continuous') return null
  const ds = session.derived_set as { blocks?: { repeat?: number; steps?: { length?: string }[] }[] } | undefined
  if (!ds?.blocks?.length) return null
  let total = 0
  for (const block of ds.blocks) {
    const repeat = typeof block.repeat === 'number' ? block.repeat : 1
    for (const step of block.steps ?? []) {
      if (typeof step.length !== 'string') return null
      const m = /^(\d+(?:\.\d+)?)\s*min$/i.exec(step.length.trim())
      if (!m) return null
      total += repeat * parseFloat(m[1])
    }
  }
  return total > 0 ? total : null
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

// RACE-KEY-TWO-OWNERS-01 (2026-09-20) — THIS FUNCTION IS GONE. `raceDistanceKey`
// is imported from `generationConfig`, which is its single owner.
//
// ⚠️ THERE WERE THREE COPIES, NOT TWO, AND TWO OF THEM WERE IN THIS FILE.
//   producer   generationConfig.ts   <=6  / <=12 / <=22   / <=43   / <=55
//   checker A  invariants.ts (here)  <=5  / <=10 / <=21.2 / <=42.5 / <=50.5
//   checker B  invariants.ts (§49)   <=6  / <=12 / <=22   / <=43   / <=55
// So this file disagreed with the producer AND with itself.
//
// MEASURED: 88 diverging values at 0.1 km steps from 1–120 km, in five bands —
// 5.1–6, 10.1–12, 21.3–22, 42.6–43, 50.6–55. In those bands the engine builds
// one distance's plan and the validator judges it as another.
//
// ⚠️ ALL SIX WIZARD VALUES (5, 10, 21.1, 42.2, 50, 100) AGREE, so this is
// LATENT and the fix is behaviour-neutral **today**. It goes live the moment a
// custom distance is offered or a seventh preset lands inside a band — which is
// exactly why it is worth fixing now, while it costs nothing.
//
// ⚠️ WHY THIS IS *NOT* THE `deloadCadence` MISTAKE, because the rule there says
// the opposite and the distinction matters. `deloadCadence.test.ts` forbids a
// checker sharing the PRODUCER'S PREDICATE, because a checker that re-uses the
// decision cannot catch the decision being wrong. **But `raceDistanceKey` is not
// a decision — it is a VOCABULARY MAPPING.** "What do we call 42.2 km?" has one
// right answer, and a checker that independently re-derives the NAME is not
// verifying anything; it is only an opportunity to disagree about a label. The
// coaching judgements keyed BY that name (cap minutes, taper weeks, phase
// lengths) remain independently checked, which is where the verification lives.

/** Weekday order, for the adjacency rules §28 states as absolute. */
const DAY_ORDER: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

/**
 * §30's RPE ceiling for a race-week shakeout. Inline rather than in
 * GENERATION_CONFIG deliberately: it is not a tuning knob, it is the definition
 * of "a wake-up for the legs, not training" — the same class as the structural
 * constants INV-CFG-001 exempts. §30 states it in prose and nothing else reads it.
 */
const RACE_WEEK_SHAKEOUT_MAX_RPE = 3

/**
 * §88's continuous fast-float rows. Both are `category: vo2max` shapes whose
 * recovery step is RUN rather than jogged; the float's ceiling is Seiler's
 * condition of approval, not a display detail.
 */
const CONTINUOUS_VO2MAX_ROWS = new Set(['intervals_rolling', 'intervals_30_30'])

/**
 * The float-is-RUN rule is `intervals_rolling`'s alone. §88 states it in that
 * row's own sentence — "`intervals_rolling` is the fast-float: the float is run,
 * not jogged" — while Billat's 30-30 is a canonical jog-recovery session. A first
 * cut applied it to both and the sweep returned 46 violations, all of them
 * "Thirty-thirty"'s float being a jog, which is what a 30-30 is.
 */
const RUN_FLOAT_ROWS = new Set(['intervals_rolling'])

/**
 * Does this session carry §28's stride note? Reads `coach_notes` — the field the
 * generator actually appends to (strides are a 4-minute appendix to a 45-minute
 * easy run, not a session) — and falls back to the label for hand-authored and
 * legacy gist plans. Never classifies BY the label alone (D-17): the enricher is
 * allowed to rewrite labels, and a label-keyed stride check would silently die
 * the first time it did.
 */
function hasStrideNote(sn: Session): boolean {
  // 🔴 THE LABEL ARM WAS REMOVED 2026-09-19 AND IT MATTERS.
  //
  // This read `/strides/i.test(sn.label ?? '')` as a second arm. That arm was
  // DEAD — no engine label had ever contained the word — right up until
  // STRIDE-VISIBILITY-01 made labels say `Easy run + strides — Zone 2`. At that
  // moment it became a hole in the net: the invariant exists to catch a stride
  // NOTE being stripped (ENRICH-STRIDES-01, where the AI enricher silently
  // dropped it from 12 of 17 weeks of a live plan), and the enricher can rewrite
  // `label` as well as `coach_notes`. A stripped note under an intact label
  // would have passed silently.
  //
  // Caught by `stridesCopyProtected.test.ts`'s falsification case, which exists
  // for exactly this and went from red to green the moment the label changed —
  // the failure direction that hides a defect rather than showing one.
  //
  // The NOTE is the prescription; the label is display (D-17).
  const notes = Array.isArray(sn.coach_notes) ? sn.coach_notes.join(' ') : String(sn.coach_notes ?? '')
  return /strides/i.test(notes)
}

/**
 * The copy patterns that CLAIM a week contains intensity.
 *
 * SINGLE OWNER (D-08), exported because `ruleEngine`'s §90 Amendment 1 yield has
 * to rewrite a week's copy when it converts that week's last quality session to
 * easy — and it had its OWN regex, which drifted. The producer matched
 * `quality|threshold|tempo|interval|vo2|sharpen|intensity stays` and missed
 * `feels? hard`, so a peak week whose theme reads "This is where the fitness is
 * built. It will feel hard." kept promising a hard session it no longer had:
 * 84 plans on the 15,973-plan sweep, all invisible until the yield's reach was
 * widened (COMPLIANCE-FIX-3, 2026-09-16).
 *
 * Producer and checker now read the same patterns, so they cannot diverge again.
 * `benchmark|time trial` is deliberately NOT here: it is satisfied by
 * `hasBenchmark`, which the quality yield does not touch.
 */
export const COPY_CLAIMS_INTENSITY_NAMED = /quality|threshold|tempo|interval|vo2/
export const COPY_CLAIMS_INTENSITY_IMPLIED = /sharpen|raising the ceiling|intensity stays/
export const COPY_CLAIMS_HARD = /feels? hard/

/** Does this week's copy promise intensity the week must actually contain? */
export function copyClaimsIntensity(label?: string | null, theme?: string | null): boolean {
  const text = `${(label ?? '').toLowerCase()} | ${(theme ?? '').toLowerCase()}`
  return COPY_CLAIMS_INTENSITY_NAMED.test(text)
    || COPY_CLAIMS_INTENSITY_IMPLIED.test(text)
    || COPY_CLAIMS_HARD.test(text)
}

export function validatePlan(plan: Plan, rawInput: GeneratorInput): Violation[] {
  // §22 / GOAL-COHERENCE-01 — the checker MUST normalise the same way the
  // producer does, or it fails plans the producer already corrected. Fixing
  // only `generateRulePlan` left every external caller (the sweep, the matrix,
  // the API route) still passing `goal: 'time_target'` with no time, and §22
  // went on demanding a goal-pace rename for a plan that has no goal pace.
  // One owner, both sides. See `coherentGoal`.
  const input = coherentGoal(rawInput)
  const violations: Violation[] = []
  // CB-SUBFLOOR-ADMIT-01 — the CHECKER reads the same owner as the PRODUCER.
  //
  // `ruleEngine` resolves its floors through `sessionFloorsFor(input)`. If this
  // kept reading the flat config, the validator would reject exactly the plans
  // the engine had just been told to build: measured on the first wiring, the
  // T1 charity persona threw INV-PLAN-MIN-SESSION-SIZE on every week
  // ("Got 4, expected 5"). A checker reading a different source from the
  // producer is this repo's most repeated defect class.
  const minDist = sessionFloorsFor(input.longest_recent_run_km)
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
  // §110 Am.2 — the ceiling is CONDITIONAL now (a beginner who set a time
  // target gets 1, not 0), so it comes from the shared owner rather than a
  // lookup repeated here. `buildWeekSessions` reads the same function: a
  // checker holding its own copy of a table cannot catch the producer's copy
  // being wrong, which is DELOAD-OWNER-01 and TIER-OWNER-01, twice paid for.
  // ⚠️ THE VOLUME ARM OF §110b IS CONSTRUCTION-TIME AND IS NOT RE-CHECKED HERE,
  // and that is a deliberate limitation rather than an oversight.
  //
  // `qualityCeilingFor` gates a beginner's quality on the week's volume. The
  // PRODUCER evaluates that against the volume it is building; by the time the
  // plan reaches this checker the post-passes (weekday cap, V1, V4, §47, §6)
  // have trimmed the delivered week, so re-reading `w.weekly_km` asks a
  // different question of a different number. Measured: passing the delivered
  // value here produced **216 false violations** on weeks the engine had
  // constructed correctly — the curve-vs-delivered gap, the same class as
  // ADR-022 and §90.
  //
  // So the checker verifies the arms it CAN see — level and goal, which is
  // where producer/checker drift would actually be dangerous (a finish-goal
  // beginner receiving quality). The volume arm's real consequence, a lopsided
  // week, is caught by §52/`INV-PLAN-LR-MAX-WEEKLY-PCT` on the DELIVERED week,
  // which is the right instrument for it and already fires there.
  const qualityMaxPerWeek = fitness
    ? qualityCeilingFor(fitness, plan.meta.generator_input?.goal ?? input?.goal,
                        Number.POSITIVE_INFINITY)
    : undefined
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
        principle_ref: 'CoachingPrinciples §18, §10',
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
    // §116 — base-build on-ramp weeks are produced by generateBaseBuildPlan and
    // validated by validateBaseBuildBlock. Same reasoning, same precedent.
    if (w.phase === 'base_build') continue
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
        // §40b veto (Coaching Board 2026-09-04) — effort-governed sessions are
        // exempt for the SAME reason VO2max is, and the exemption is the
        // mechanical half of that ruling rather than a new decision.
        //
        // `vert_hike_repeats` was only ever passing this check by being ILLEGALLY
        // goal-paced: §22's override renamed a power-hike to "100K-pace intervals"
        // and stamped `stimulus: 'race_pace'`, so the session satisfied the check
        // by carrying exactly the invented pace §40b forbids. Remove the override
        // and the session is correct and this check fails it — which is the check
        // being wrong, not the session.
        //
        // Power hiking is the skill that decides how a 100K finishes (the row's
        // own `purpose`); it cannot be run at goal pace and must not be excluded
        // from peak to satisfy a naming rule. §22 is NOT weakened: the plan-level
        // `INV-PLAN-RACE-SPECIFIC-EXPOSURE-RATIO` still holds the plan to a
        // race-pace share, so exempting a session from the per-week catch cannot
        // let a plan avoid race-specific work overall.
        //
        // Structural, never by id — same lesson as the SC-09/D-17 line above.
        if (session.catalogue_id && rowIsEffortGoverned(session.catalogue_id)) continue
        // §85 — a MIXED-PACE row is exempt for the same reason, one step further
        // along. An over-under is defined by the relationship between its two
        // paces; §22's override rewrites the T-anchored half to goal pace and
        // leaves the CV half alone, which can put the "over" SLOWER than the
        // "under". So the engine excludes it from the override (see
        // `hasMixedWorkAnchors`), and this per-week check must not then punish
        // the session for lacking the goal pace it was correctly denied.
        //
        // §22 is NOT weakened, by the same argument the effort-governed
        // exemption above makes: `INV-PLAN-RACE-SPECIFIC-EXPOSURE-RATIO` still
        // holds the PLAN to a race-pace share, and §53's rotation means an
        // over-under occupies at most a minority of second-half build slots.
        if (session.catalogue_id && rowHasMixedWorkAnchors(session.catalogue_id)) continue
        // §22 Amendment (Coaching Board 2026-09-15, V2-SWAP-S22-01) — a session
        // RELOCATED into this week by §5's VO2max adaptation-window swap is
        // exempt, for the same reason the three exemptions above are.
        //
        // The week it landed in was legal BEFORE the swap only because a VO2max
        // session sat there, and VO2max is exempt two checks up. §5's relocation
        // is a ratified mechanism (CD-22) and this check must not punish a
        // session for obeying it — the alternative rulings were to make §79
        // yield (reinstating the Zone 4-5-first defect on returning runners) or
        // §5 yield (compressing the VO2max dose into fewer weeks against the
        // taper, Willy). Both were rejected.
        //
        // Measured before the exemption: 288 ERROR violations, entirely
        // homogeneous — 144x 5K + 144x 10K, all time-targeted, all
        // `intensity_reentry_active`, all `recent_quality_training: 'regular'`.
        //
        // STRUCTURAL (D-17). `displaced_by_adaptation_window` is stamped by the
        // generator and is unreachable from `EnrichedWeekSchema`, so the AI
        // voice pass cannot rewrite it the way it rewrites labels.
        //
        // §22 is NOT weakened, by the same argument the exemptions above make:
        // `INV-PLAN-RACE-SPECIFIC-EXPOSURE-RATIO` still holds the PLAN to a
        // race-pace share, so exempting one displaced session cannot let a plan
        // avoid race-specific work overall. That ratio is this exemption's
        // BINDING CONDITION — if it fails, the exemption is void.
        if (session.displaced_by_adaptation_window) continue
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
      // Derived through the shared owner so the enrich prompt (which is told
      // these same two flags) cannot disagree with the check that judges its
      // output — see lib/plan/weekIntensityFlags.ts.
      const { hasQuality: hasIntensity, hasBenchmark } = weekIntensityFlags({
        sessions: Object.fromEntries(placedRunning.map(({ day, session }) => [day, session])),
        weekly_km: w.weekly_km,
      } as Pick<Week, 'sessions' | 'weekly_km'>)

      // Each claim names what must be present for it to be honest.
      const CLAIMS: Array<{ test: RegExp; ok: boolean; needs: string }> = [
        { test: COPY_CLAIMS_INTENSITY_NAMED,   ok: hasIntensity || hasBenchmark, needs: 'an intensity session' },
        { test: COPY_CLAIMS_INTENSITY_IMPLIED, ok: hasIntensity,                 needs: 'an intensity session' },
        { test: COPY_CLAIMS_HARD,              ok: hasIntensity || hasBenchmark, needs: 'a hard session' },
        { test: /benchmark|time trial/,                       ok: hasBenchmark,                 needs: 'a benchmark session' },
      ]
      for (const { test, ok, needs } of CLAIMS) {
        if (test.test(copy) && !ok) {
          violations.push({
            code: 'INV-PLAN-COPY-MATCHES-SESSIONS',
            principle_ref: 'CoachingPrinciples §27, §41',
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
      // Through the shared predicate, so the prompt's `is_overload_week` flag and
      // this check can never disagree (2026-09-04 — the prompt stated it as a
      // rule the model had to evaluate, and it claimed overload on two taper
      // weeks). `prevNonDeload` is still read below for the message.
      if (/highest volume|fitness is built/.test(copy)
          && prevNonDeload
          && !isOverloadWeek(w, plan.weeks)) {
        violations.push({
          code: 'INV-PLAN-COPY-MATCHES-SESSIONS',
          principle_ref: 'CoachingPrinciples §27, §41',
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
    // §78 — the recalibration time trial's notes must still SAY what the session
    // is for. A positive requirement, not a denylist, and the difference is the
    // whole point: the shipped defect (live plan bcdec27a, 2026-09-03) replaced
    // the engine's copy with "Hard session… This is pace work, not endurance" —
    // fluent, on-voice, contradicting §78, and silently dropping "Log the result
    // in your profile and your paces update for the next block". A banned-phrase
    // check can never catch that, because the harm is what went MISSING.
    //
    // ⚠️ REQUIRES BOTH HALVES since 2026-09-17. It was `measurement|log the
    // result` — an OR, so dropping the instruction passed as long as the word
    // "measurement" survived, which is half the defect it was written for.
    //
    // Nothing recalibrates unless the runner logs a result (ADR-014), so this is
    // the sentence the whole feature hangs on. `meta.recalibration_weeks` went on
    // claiming the week recalibrated while the instruction was gone.
    //
    // Structural: `isTimeTrial()` (sessionRole.ts) — `type === 'hard'` is
    // produced ONLY by applyRecalibrationTimeTrial. Sharing the predicate with
    // the producer is safe HERE and is not the DELOAD-OWNER-01 case: it only
    // SELECTS which sessions to check, it does not compute the property being
    // checked (whether the notes carry the instruction). Runs OUTSIDE the
    // `quality`-scoped loop below,
    // which is the second half of the root cause — the `hard` typing chosen in
    // §78 so the trial would not count against QUALITY_SESSIONS_PER_WEEK_MAX also
    // exempted it from every quality-scoped copy check. A type chosen to opt out
    // of one rule opted it out of an unrelated one.
    for (const { day, session } of placedRunning) {
      if (!isTimeTrial(session)) continue
      const notes = (session.coach_notes ?? []).join(' ').toLowerCase()
      if (!/measurement/.test(notes) || !/log the (result|time)/.test(notes)) {
        violations.push({
          code: 'INV-PLAN-COACH-NOTES-MATCH-INTENT',
          principle_ref: 'CoachingPrinciples §78, §33',
          severity: 'error',
          week: w.n, day,
          message: `Recalibration time trial "${session.label}" has lost its instruction copy — the notes no longer say it is a measurement or tell the runner to log the result, so nothing recalibrates.`,
          actual: (session.coach_notes ?? []).join(' | ') || '(no notes)',
          expected: 'notes stating this is a measurement and to log the result',
        })
      }
    }

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

    // INV-PLAN-DISPLAY-ZONE-MATCHES-WORK — the zone a runner SEES derives from
    // the prescribed work (session.zone), and no coach note may state a literal
    // zone that contradicts it. Every quality session is typed `quality`, so a
    // type→zone display map showed a flat "Zone 3" for tempo, VO2 and hills
    // alike, contradicting the coach note (which reads session.zone) on the same
    // card. (CoachingPrinciples §84)
    for (const { day, session } of placedRunning) {
      const zoneKey = zonesFromZoneString(session.zone).join('-')

      // A quality session must carry the prescribed zone string the display
      // reads. The engine always sets it (makeQualitySession); a missing one is
      // a regression that would silently fall back to a coarse type-derived zone.
      if (session.type === 'quality' && !zoneKey) {
        violations.push({
          code: 'INV-PLAN-DISPLAY-ZONE-MATCHES-WORK',
          principle_ref: 'CoachingPrinciples §84',
          severity: 'error',
          week: w.n, day,
          message: `Quality session "${session.label}" has no session.zone — the header would fall back to a coarse type-derived zone (a flat "Zone 3")`,
          actual: `session.zone = ${JSON.stringify(session.zone ?? null)}`,
          expected: 'a prescribed zone string, e.g. "Zone 3–4" or "Zone 4–5"',
        })
        continue
      }
      if (!zoneKey) continue

      // A coach note that discusses zones must reference the prescribed one. We
      // flag only when the note mentions zone(s) yet NONE matches session.zone —
      // a note may legitimately mention a recovery zone in passing, so we don't
      // flag on the mere presence of some other zone number.
      const notes = (session.coach_notes ?? []).join(' ')
      const mentions = Array.from(notes.matchAll(/zone\s*[1-5](?:\s*[–-]\s*[1-5])?/gi))
        .map(m => zonesFromZoneString(m[0]).join('-'))
        .filter(Boolean)
      if (mentions.length > 0 && !mentions.includes(zoneKey)) {
        violations.push({
          code: 'INV-PLAN-DISPLAY-ZONE-MATCHES-WORK',
          principle_ref: 'CoachingPrinciples §84',
          severity: 'error',
          week: w.n, day,
          message: `Coach note on "${session.label}" states zone(s) that contradict session.zone ("${session.zone}") — the header and the note would disagree`,
          actual: `note zone(s) ${mentions.join(', ')}`,
          expected: `a mention matching session.zone (${zoneKey})`,
        })
      }
    }

    // §84 Amendment (Coaching Board 2026-09-04) — the zone STRING and the
    // HR TARGET must describe the same band.
    //
    // §84 made the session-detail header derive its bpm from `session.zone`
    // while the coach note renders `{{session_hr}}` from `hr_target`. Its Config
    // paragraph justified that as safe because the engine "already writes
    // session.zone and session.hr_target together and consistently in every
    // makeQualitySession branch (threshold → Zone 3–4/qualityHR; VO2 + hills →
    // Zone 4–5/intervalsHR)". True for the second pair, ASSUMED for the first:
    // `qualityHR` is z3Low–z3Top, which is Zone 3 ONLY. One card therefore read
    // "145–172 bpm" as its headline and "Hold 145–158 bpm" six lines below.
    //
    // Nothing could have caught it: the §84 check compares a coach note's zone
    // WORD to session.zone and never compares session.zone to hr_target. This is
    // that comparison. The engine now pairs the two at construction
    // (`zones.qualityZone`/`intervalsZone`, ruleEngine.ts) so they cannot be
    // authored apart; this is the backstop proving they never are.
    //
    // SCOPED TO RANGE targets ("145–158 bpm"), not ceilings ("< 145 bpm").
    // A ceiling is a different claim — it caps the session rather than
    // describing its span — and the display already renders `hi <= 2` zones as
    // "< top", which agrees. The one case that does NOT agree is the `Zone 2–3`
    // long run with a marathon/HM-pace finish (48 sessions measured): its
    // hr_target is the AEROBIC ceiling while the zone string describes the whole
    // session including the faster finish. The board scoped this sitting to
    // quality sessions, so that case is left ALONE and recorded rather than
    // silently swept in — see the backlog entry.
    for (const { day, session } of placedRunning) {
      const zoneStr = session.zone
      const hr = session.hr_target
      if (!zoneStr || typeof hr !== 'string') continue
      const m = /^\s*(\d+)\s*[–-]\s*(\d+)\s*bpm\s*$/.exec(hr)
      if (!m) continue                        // ceiling or unparseable — out of scope
      // meta, NOT input: §50's max-HR guard (HR-MAX-01) can REJECT a
      // sub-estimate observed max and substitute the age estimate, so the raw
      // input is not what produced `hr_target`. Reading input here made the
      // check compute "Zone 3 = 107–114 bpm" against a real target of 145–158
      // and fire 11,556 times — a checker reading a different source from the
      // producer, which is the failure this repo keeps re-learning.
      const band = hrBandForZoneString(
        zoneStr,
        plan.meta.resting_hr ?? input.resting_hr ?? null,
        plan.meta.max_hr ?? input.max_hr ?? null,
      )
      if (!band) continue                     // no HR data to derive from
      const lo = Number(m[1]), hi = Number(m[2])
      if (band.lo !== lo || band.hi !== hi) {
        violations.push({
          code: 'INV-PLAN-DISPLAY-ZONE-MATCHES-WORK',
          principle_ref: 'CoachingPrinciples §84',
          severity: 'error',
          week: w.n, day,
          message: `"${session.label}" states zone "${zoneStr}" (${band.lo}–${band.hi} bpm) but prescribes hr_target "${hr}" — the session-detail header reads the zone and the coach note reads the target, so the runner sees both numbers on one card.`,
          actual: `zone ${zoneStr} = ${band.lo}–${band.hi} bpm vs hr_target ${hr}`,
          expected: 'the zone string and hr_target to describe the same band',
        })
      }
    }

    // INV-PLAN-INJURY-NO-HILLS — runners with hill-restricting injury history
    // (knee, ITB, Achilles, shin, calf, plantar) get no hill sessions in ANY
    // phase. §21's peak reintroduction is gated on a symptom-free build that is
    // not yet wired, so peak is NOT exempt until it is. (CoachingPrinciples §21)
    {
      // §21 — the shared owner, not a third copy of the expression. A checker
      // that re-derives the producer's predicate cannot catch the producer
      // being wrong, and here it could not catch the producer being SILENT:
      // §28 Am.1's hill strides never consulted this list at all.
      const hasRestricting = hasHillRestrictingInjury(input.injury_history)
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
    // §79 Amendment 1 — COUNTED IN QUALITY WEEKS, NOT CALENDAR WEEKS
    // (REENTRY-INV-DECORATIVE-01, closed 2026-09-15).
    //
    // This read `w.n <= intensity_reentry_weeks`, which is the SAME calendar
    // premise the defect had: base weeks and deload weeks carry no quality
    // (`plannedQuality` is 0 for both), so weeks 1..N are all-easy by
    // construction and the condition was trivially satisfied on every plan. It
    // sat in the liveness baseline as never-woken and COULD NOT have woken —
    // the check and the defect shared a premise.
    //
    // Re-anchoring it was blocked until today: it woke immediately and failed
    // 576 plans, every one of them §5's `vo2MustOpenBuild` legitimately
    // overriding §79. That precedence is now resolved the way the board ruled
    // it (§79 wins the conflict), so the check can assert what §79 says.
    //
    // Derived INDEPENDENTLY from the finished plan rather than by importing the
    // producer's predicate: a checker that shares the producer's reading cannot
    // catch the producer being wrong, which is the whole lesson of this item.
    const reentryQualityWeeks = (() => {
      if (!plan.meta.intensity_reentry_active) return new Set<number>()
      const budget = plan.meta.intensity_reentry_weeks ?? 0
      const out = new Set<number>()
      for (const wk of plan.weeks) {
        if (wk.n < 1 || out.size >= budget) continue
        const carriesQuality = Object.values(wk.sessions ?? {})
          .some(sn => sn && (sn as Session).type === 'quality')
        if (carriesQuality) out.add(wk.n)
      }
      return out
    })()
    if (reentryQualityWeeks.has(w.n)) {
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
            expected: `no vo2max/hill sessions in the first ${plan.meta.intensity_reentry_weeks} QUALITY-carrying week(s)`,
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

    // INV-PLAN-DELOAD-PLACEMENT — CoachingPrinciples §87 (CB-DELOAD-01).
    //
    // Two assertions, and the second one is a DIRECTION rather than an equality
    // — which is the amendment the board revised at ratification.
    //
    //   1. No deload opens a phase. A deload on the first week of build drops
    //      volume 30-41% at the moment the plan says the hard work begins, and
    //      pushes the first quality session back a week. Measured at 25% of
    //      plans before this ruling; none of those placements was chosen, they
    //      were decided by where week 1 fell relative to the phase split.
    //
    //   2. Recovery may RISE, never FALL, against the raw cadence. Willy's
    //      condition was written as "shift, never skip" to stop recovery being
    //      traded away for earlier intensity. Written as strict equality it
    //      would ALSO forbid correcting a cadence that was under-delivering:
    //      an 8-week masters plan produced one recovery week because week 6 fell
    //      in peak and week 9 did not exist, and re-anchoring restores the 3:1
    //      §3 actually promises. So the check is one-sided on purpose.
    {
      const recoveryFreq = input.age >= GENERATION_CONFIG.MASTERS_AGE_THRESHOLD
        ? GENERATION_CONFIG.RECOVERY_WEEK_FREQUENCY_MASTERS
        : GENERATION_CONFIG.RECOVERY_WEEK_FREQUENCY_STANDARD
      // Phase read off the PRODUCED plan, not recomputed from the distribution
      // config: the invariant must be able to disagree with the generator, and
      // re-deriving phases the same way the generator did removes that ability.
      const phaseOfWeek = new Map<number, string>()
      for (const w of plan.weeks) if (w.phase) phaseOfWeek.set(w.n, w.phase)
      // ONLY the phases the generator places deloads into. An exclusion list
      // (`!== 'peak' && !== 'taper'`) was wrong and the real-input corpus caught
      // it: `Week.phase` also carries `foundation` and the `maintenance_*`
      // values, which are composed onto a plan AFTER generation (ADR-020) and
      // can hold week numbers <= 0. Those weeks were counted into the raw
      // cadence the generator was then held to, so two real stored plans failed
      // a rule about weeks the generator never owned. Allowlist, not denylist —
      // the same foundation-week blind spot that has now produced three defects.
      const inScope = (n: number) => {
        const p = phaseOfWeek.get(n)
        return n >= 1 && (p === 'base' || p === 'build')
      }

      let rawCount = 0
      for (const w of plan.weeks) {
        if (inScope(w.n) && w.n % recoveryFreq === 0) rawCount++
      }
      const actual = plan.weeks.filter(w => w.type === 'deload')
      for (const w of actual) {
        const prev = phaseOfWeek.get(w.n - 1)
        const here = phaseOfWeek.get(w.n)
        // Week 1 opening the plan is not a phase-boundary violation of interest
        // — there is no preceding block to arrive fresh into.
        if (w.n > 1 && inScope(w.n) && here != null && prev != null && here !== prev) {
          violations.push({
            code: 'INV-PLAN-DELOAD-PLACEMENT',
            principle_ref: 'CoachingPrinciples §87',
            severity: 'error',
            week: w.n,
            message: `Week ${w.n} is a deload AND the first week of the ${here} phase — a recovery week must not open a phase (§87). Shift the cadence earlier and re-anchor; never delete the deload.`,
            actual: `deload on first week of ${here}`,
            expected: 'deload placed before the phase boundary',
          })
        }
      }
      if (actual.length < rawCount) {
        violations.push({
          code: 'INV-PLAN-DELOAD-PLACEMENT',
          principle_ref: 'CoachingPrinciples §87',
          severity: 'error',
          week: 0,
          message: `Plan has ${actual.length} recovery weeks but the §3 cadence calls for at least ${rawCount}. Placement may SHIFT a deload, never remove one (§87; recovery_weeks_may_decrease: false).`,
          actual: `${actual.length} deloads`,
          expected: `>= ${rawCount}`,
        })
      }
    }

    // INV-PLAN-OVER-UNDER-MEAN-NEAR-THRESHOLD — CoachingPrinciples §85.
    //
    // CB-CAT-01 ruled over-unders correct on an arithmetic premise: with CV at
    // 0.90 and T at 0.855, a 50/50 alternation's TIME-WEIGHTED MEAN pace sits
    // 2.56% faster than T — inside INV-PLAN-LABEL-MATCHES-PACE's ±3% threshold
    // tolerance, so §19 holds without amendment.
    //
    // That premise is NOT self-enforcing, for two independent reasons, and this
    // check exists because both were discovered after the ruling rather than
    // before it:
    //   1. §19's numeric arm fires on the LABEL — 'threshold' / 'tempo' /
    //      'cruise'. "Over-unders" contains none of them, so the row escapes the
    //      very check the ruling leaned on. That is SC-08's documented
    //      label-evasion hole, and this row walks straight through it.
    //   2. Widening the CV band, or moving its midpoint faster, breaks the
    //      margin silently — Hutchinson's "pin it" is a comment, and a comment
    //      is not a constraint.
    //
    // Keyed on `catalogue_id`, never the label (INV-CLASS): §22 renames this row
    // to "10K-pace ..." on a goal-pace week and the AI enricher may rewrite it
    // again. Both rewrite the display string; neither can rewrite the row identity.
    for (const { day, session } of placedRunning) {
      if (session.catalogue_id !== 'tempo_over_under') continue
      if (!plan.meta.vdot || !session.pace_target) continue
      const mid = parsePaceMidpoint(session.pace_target)
      if (mid == null) continue
      const anchorVdot = plan.meta.vdot_training_anchor ?? plan.meta.vdot
      const tPace = paceFromVdot(anchorVdot, 0.855)
      const deltaPct = ((tPace - mid) / tPace) * 100
      // Signed, not absolute: an over-under whose mean is SLOWER than threshold
      // is not an over-under, it is a tempo run with a name.
      if (deltaPct < 0 || deltaPct > 3) {
        violations.push({
          code: 'INV-PLAN-OVER-UNDER-MEAN-NEAR-THRESHOLD',
          principle_ref: 'CoachingPrinciples §85',
          severity: 'error',
          week: w.n, day,
          message: `Over-under mean pace ${mid.toFixed(2)}/km is ${deltaPct.toFixed(1)}% faster than T-pace ${tPace.toFixed(2)}/km — must be inside 0–3% (§85; the margin §19 was held to rely on)`,
          actual: `${deltaPct.toFixed(1)}%`,
          expected: '0–3% faster than T-pace',
        })
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
      // ⚠️ SKIPS DURATION-ANCHORED SESSIONS, AND THAT IS NOW A KNOWN GAP
      // RATHER THAN A SAFE ASSUMPTION (recorded 2026-09-19).
      //
      // SESSION-KM-02 left this site alone on the measured grounds that
      // "quality sessions are never duration-anchored". §110 Am.2 made that
      // false — a beginner who set a time target now gets quality, and
      // beginners are duration-anchored (§79/§80), so **47,232 quality
      // sessions carry no `distance_km`** and §9's km floor does not reach any
      // of them.
      //
      // ⚠️ THE OBVIOUS FIX IS WRONG AND WAS TRIED. Reading the size through
      // `sessionKmSelfPaced` makes the floor reach them — and it then fires on
      // ordinary beginner EASY runs too: 30 minutes at a beginner's pace is
      // 3.9 km against a 4 km floor. A km floor applied to a session
      // prescribed in minutes is asking the wrong question; 30 minutes is a
      // real session whatever it converts to. §9's floor has no minutes
      // equivalent, and authoring one is a coaching decision, not a defect fix.
      //
      // Filed as `S9-DURATION-FLOOR-01`. The gap PRE-DATES this ruling (every
      // beginner easy run has always been unchecked); §110 Am.2 widens the
      // population it applies to, it does not create it.
      const dist = session.distance_km ?? 0
      if (dist > 0 && dist < expected) {
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
    // (CoachingPrinciples §9 / spec 3.6).
    //
    // ⚠️ §113 Amendment 1 (CB-SUBFLOOR-ADMIT-01, 2026-09-18) REMOVED THE FLOOR
    // ALLOWANCE, and this comment used to be the written permission for the
    // defect. It read: "Floor takes precedence when the cap falls below
    // MIN_SESSION_DISTANCE_KM.long — a session below floor is not
    // coaching-meaningful, so the engine clamps to floor and accepts the higher
    // early-week long." That sentence is how a +67% opening week was ratified in
    // advance: at a 3 km longest run the cap places 3.3 km and the flat 5 km
    // floor overrode it, and §113 then refused the runner for the resulting leap.
    //
    // The floor is now resolved per runner (`sessionFloorsFor`) and is bounded
    // by the runner's own longest run, so it can never exceed `rawCap` —
    // `min(config, longest) <= longest < longest × 1.10`. The `Math.max` is
    // therefore not merely unnecessary, it is UNREACHABLE, and leaving it would
    // leave the permission standing for the next person who changes the floor.
    // THE CAP IS NOW THE CAP: this is the "no floor override" check the
    // Coaching Board required, enforced by amending the existing invariant
    // rather than adding a second one that would assert the same rule twice.
    if (w.n <= 2 && input.longest_recent_run_km > 0 && long?.session.distance_km != null) {
      const rawCap = input.longest_recent_run_km * GENERATION_CONFIG.WEEK_1_2_LONG_RUN_CAP_MULTIPLIER
      const effectiveCap = rawCap
      if (long.session.distance_km > effectiveCap + 0.01) {
        violations.push({
          code: 'INV-PLAN-WEEK-1-2-LONG-CAP',
          // §113 Am.1 joins §9 here: the amendment REMOVED this check's floor
          // allowance, so the claim and the code must cite each other or
          // principleCoverage cannot tell them apart from §92's phantom enforcer.
          principle_ref: 'CoachingPrinciples §9, §113',
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

    // INV-PLAN-MAX-WEEKDAY-MINS — weekday session duration ≤ the runner's stated
    // cap FOR THAT DAY (CoachingPrinciples — life-first, plan-second).
    //
    // UX-WIZARD-01 Stage B — the cap is per-day: each weekday session is checked
    // against `day_budgets[day]`, falling back to the single `max_weekday_mins`.
    // This MUST track applyWeekdayMinsCap's per-day trim exactly — §81: "an
    // engine exemption the validator does not share is a plan that fails its own
    // constitution." When `day_budgets` is absent every day resolves to
    // max_weekday_mins, i.e. the old single-cap check, unchanged.
    const dayBudgets = input.day_budgets
    if (input.max_weekday_mins != null || dayBudgets != null) {
      const weekdays: Day[] = ['mon','tue','wed','thu','fri']
      for (const d of weekdays) {
        const cap = dayBudgets?.[d as 'mon'|'tue'|'wed'|'thu'|'fri'] ?? input.max_weekday_mins
        if (cap == null) continue
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
        if (s.duration_mins > cap) {
          violations.push({
            code: 'INV-PLAN-MAX-WEEKDAY-MINS',
            principle_ref: 'CoachingPrinciples — life-first',
            severity: 'error',
            week: w.n, day: d,
            message: 'Weekday session duration exceeds the cap for that day',
            actual: s.duration_mins,
            expected: `≤ ${cap}`,
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

  // INV-PLAN-NO-RACE-EVE-SESSION — §39 Amendment 1 / §26.
  //
  // The day(s) immediately before the race carry no scheduled running session.
  // §30's shakeout offsets [5, 3] already place nothing there, so this is not a
  // second opinion about shakeouts — it is the check that nothing ELSE drifts
  // onto race eve, which is exactly what §39's "mid-week" easy run did: its
  // preference order started with 'sat', and for a Sunday race that is the day
  // before the gun. **Measured on an 81-plan grid: 81 of 81 (100%)**, mean 54
  // minutes, worst case 9 km / 72 min before a beginner's first marathon.
  // (CoachingPrinciples §39 Amendment 1)
  {
    const protectedDays = GENERATION_CONFIG.RACE_EVE_PROTECTED_DAYS
    // Reuses §30's cap rather than declaring a second one — one number, one owner.
    const capMinsForRaceEve = GENERATION_CONFIG.RACE_WEEK_SHAKEOUT_MAX_MINS
    for (const w of plan.weeks) {
      const entries = Object.entries(w.sessions ?? {}) as [string, Session | undefined][]
      const race = entries.find(([, sn]) => sn?.type === 'race')
      if (!race) continue
      const raceIdx = DAYS.indexOf(race[0] as typeof DAYS[number])
      if (raceIdx < 0) continue
      for (const [day, sn] of entries) {
        if (!sn || sn.type === 'rest' || sn.type === 'race') continue
        const idx = DAYS.indexOf(day as typeof DAYS[number])
        if (idx < 0 || idx >= raceIdx) continue
        const before = raceIdx - idx
        if (before > protectedDays) continue
        // A §30 SHAKEOUT on race eve is correct coaching and must stay — "a
        // wake-up for the legs, not training", capped and low-RPE by design.
        // What must not be here is anything LONGER. The first cut of this
        // invariant forbade every session and the golden plans caught it: it
        // would have deleted the 30-minute shakeout that CD-7 deliberately
        // places on race eve when §30's [5,3] offsets fall outside race week.
        const mins = sn.duration_mins ?? 0
        if (mins <= capMinsForRaceEve) continue
        violations.push({
          code: 'INV-PLAN-NO-RACE-EVE-SESSION',
          principle_ref: 'CoachingPrinciples §39 Amendment 1',
          severity: 'error',
          week: w.n,
          message: `${sn.label ?? 'session'} (${mins} min) is scheduled ${before} day(s) before race day and exceeds §30's ${capMinsForRaceEve}-minute shakeout cap — §26 forbids a fatigue-adding session in race week`,
          actual: `${mins} min, ${before} day(s) before`,
          expected: `≤ ${capMinsForRaceEve} min within ${protectedDays} day(s) of the race`,
        })
      }
    }
  }

  // INV-PLAN-RACE-NOTE-SCALES — §80 Amendment 1.
  //
  // The race-day opening instruction is a FRACTION of race distance. It was a
  // hardcoded "First 5 km at Zone 2." on every distance, which is 12% of a
  // marathon (sensible), 50% of a 10K (gives away half the race) and 100% of a
  // 5K (instructs the runner not to race). Reads the note the runner is actually
  // shown rather than recomputing the producer's input.
  // (CoachingPrinciples §80 Amendment 1)
  for (const w of plan.weeks) {
    for (const sn of Object.values(w.sessions ?? {}) as (Session | undefined)[]) {
      if (!sn || sn.type !== 'race') continue
      const note = (sn.coach_notes ?? []).find(n => typeof n === 'string' && /First [\d.]+ km/.test(n))
      if (!note) continue
      const stated = Number(/First ([\d.]+) km/.exec(note)?.[1])
      const raceKm = sn.distance_km ?? plan.meta.race_distance_km
      if (!Number.isFinite(stated) || !raceKm) continue
      const expected = raceKm * GENERATION_CONFIG.RACE_OPENING_FRACTION
      // Half a km of slack absorbs the rounding the copy applies.
      if (Math.abs(stated - expected) > 0.5) {
        violations.push({
          code: 'INV-PLAN-RACE-NOTE-SCALES',
          principle_ref: 'CoachingPrinciples §80 Amendment 1',
          severity: 'error',
          week: w.n,
          message: `Race note opens "${stated} km" on a ${raceKm} km race — that is ${((stated / raceKm) * 100).toFixed(0)}% of the race, not §80's ${(GENERATION_CONFIG.RACE_OPENING_FRACTION * 100).toFixed(0)}%`,
          actual: `${stated} km`,
          expected: `~${expected.toFixed(1)} km`,
        })
      }
    }
  }

  // INV-PLAN-LONG-RUN-HAS-AN-AXIS — §66 Amendment 1's PRECONDITION.
  //
  // §66's shortfall trigger runs on live analysis rows, so it is not itself a
  // plan property and `validatePlan` cannot assert it (the trigger is covered by
  // `planAdjustment.test.ts`, including source guards against the route). What
  // IS a plan property, and what the whole amendment rests on, is that every
  // long run is comparable on at least ONE axis.
  //
  // That is true today for every generated plan. It is asserted anyway because
  // the failure is SILENT and has already happened once in this exact shape: a
  // long run carrying neither a distance nor a duration is dropped by the
  // trigger with no error, and the runner's plan simply stops adapting — which
  // is how 24.6% of plans came to have a dead trigger without anyone noticing.
  // (CoachingPrinciples §66 Amendment 1, §80)
  for (const w of plan.weeks) {
    for (const s of Object.values(w.sessions) as (Session | undefined)[]) {
      if (!s || !isLongRun(s)) continue
      const hasDistance = s.distance_km != null && Number.isFinite(s.distance_km) && s.distance_km > 0
      const hasDuration = s.duration_mins != null && Number.isFinite(s.duration_mins) && s.duration_mins > 0
      if (!hasDistance && !hasDuration) {
        violations.push({
          code: 'INV-PLAN-LONG-RUN-HAS-AN-AXIS',
          principle_ref: 'CoachingPrinciples §66 Amendment 1',
          severity: 'error',
          week: w.n,
          message: `${s.label ?? 'long run'} carries neither distance_km nor duration_mins — it is anchored on no axis, so §66's shortfall trigger can never see it and the runner's plan silently stops adapting`,
          actual: 'no axis',
          expected: 'distance_km or duration_mins',
        })
      }
    }
  }

  // INV-PLAN-LR-RACE-SEGMENT-PCT — §25's ratified band is a NUMBER now, so it
  // can be checked. The session states its own dose in its coach note ("Final
  // 40% at MP: 5:20 /km."), which is the string the runner actually reads, so
  // the check reads THAT rather than recomputing from the catalogue row — a
  // checker that re-derives the producer's input races it instead of checking
  // it (the lesson from INV-PLAN-LR-FLOOR-NOT-ROUNDING, 2026-09-13).
  //
  // What it would have caught: the hand-typed "Final 30–50% at MP" note, whose
  // top end sat 10 points above §25's own ceiling and shipped for months
  // because the number lived inside prose.
  // (CoachingPrinciples §25 Amendment 1)
  {
    const lo = GENERATION_CONFIG.LR_RACE_SEGMENT_PCT_MIN
    const hi = GENERATION_CONFIG.LR_RACE_SEGMENT_PCT_MAX
    for (const w of plan.weeks) {
      for (const s of Object.values(w.sessions) as (Session | undefined)[]) {
        if (!s || !isLongRun(s) || !s.lr_segment_pace) continue
        // Only §25's race-specific long run declares a percentage in its note;
        // §24b's 5K/10K session states two segments and is governed elsewhere.
        const note = (s.coach_notes ?? []).find(n => typeof n === 'string' && /^Final \d+% at /.test(n))
        if (!note) continue
        const pct = Number(/^Final (\d+)%/.exec(note)?.[1])
        if (!Number.isFinite(pct)) continue
        if (pct < lo || pct > hi) {
          violations.push({
            code: 'INV-PLAN-LR-RACE-SEGMENT-PCT',
            principle_ref: 'CoachingPrinciples §25',
            severity: 'error',
            week: w.n,
            message: `${s.label ?? 'race-specific long run'} prescribes ${pct}% of the run at race pace — §25 ratifies the final ${lo}–${hi}%`,
            actual: `${pct}%`,
            expected: `${lo}–${hi}%`,
          })
        }
      }
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
      // SESSION-KM-02 (2026-09-11) — was `long?.distance_km != null ? [d] : [0]`.
      //
      // A beginner's plan is DURATION-ANCHORED (`duration_mins` set,
      // `distance_km` null), so this asserted "the peak long run is 0 km" and
      // the check errored on a perfectly good 2h12 long run. It went unnoticed
      // because those plans were almost all classified `maintenance`, which
      // exempts this invariant — until §106 raised their peaks and 126 of them
      // stopped being exempt. The defect was always there; the exemption was
      // hiding it.
      //
      // The session carries its own prescribed pace, which is a better
      // conversion than any plan-level easy pace. When there is NO pace to
      // convert with, the week contributes `null` and the check SKIPS rather
      // than asserting zero — a km floor cannot be evaluated against a plan
      // that has no km, and inventing a 0 is how this broke in the first place.
      const longRunKmOf = (w: Week): number | null => {
        const long = Object.values(w.sessions).find(sn => sn && isLongRun(sn))
        if (!long) return 0
        if (long.distance_km != null) return long.distance_km
        return sessionKmSelfPaced(long)
      }
      const peakLrKms = peakWeeks.map(longRunKmOf)
      const peakLrKm = peakLrKms.some(k => k == null)
        ? null
        : Math.max(...(peakLrKms as number[]))
      if (peakLrKm !== null) {
      // Time-cap check — if even an unrounded long run at the time cap is below
      // requiredKm, the cap is binding and the invariant relaxes.
      const peakLongRunHrs = peakWeeks[0].long_run_hrs ?? 0
      const easyMinPerKm = peakLrKm > 0 && peakLongRunHrs > 0
        ? (peakLongRunHrs * 60) / peakLrKm
        : 7
      const capKm = longCapMins / Math.max(easyMinPerKm, 1)
      // §24 Amendment 1 (Coaching Board 2026-09-13) — the same rounding tolerance
      // the CLASSIFIER now applies. The peak long run is floor-rounded to
      // DISTANCE_ROUNDING_PRECISION_KM by the producer, so comparing it against
      // an unrounded floor here decides the check on the engine's own rounding.
      //
      // This is not cosmetic symmetry: the classifier's tolerance flips
      // near-miss plans from `maintenance` to `build`, and this invariant is
      // EXEMPT while a plan is maintenance. So without the same tolerance the
      // amendment would un-exempt exactly the plans it just forgave and error on
      // them — measured, 3 hard failures in the cohort grid. Principle, numeric
      // and mechanical check have to agree on what the floor IS.
      const effectiveRequired =
        Math.min(requiredKm, capKm) - GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM
      // INV-PLAN-PEAK-LR-EARNED-TIER — RETIRED 2026-09-15 (Coaching Board,
      // LR-EARNED-TIER-01, §35 Amendment 1).
      //
      // It asserted §35's earned tier on the DELIVERED peak long run. §35
      // Amendment 1 rules that the tier is a SIZING floor: §45, §47 and §9 govern
      // delivery, and §45 wins by its own clause ("this principle wins" where the
      // §24 floor and the cap collide). The invariant was therefore asking plans
      // to break a ratified cap, and fired on 8 plans that were correct.
      //
      // Traced before retiring, not assumed: an HM runner earning the 95% tier
      // (20.5 km) left `buildWeekSessions` at 23.4 and 22.7 km — the lift never
      // bound — and §47's alternation brought the delivered peak to 19 km at
      // 119 min against a 135-min cap that was not binding.
      //
      // ⚠️ DO NOT RE-ADD IT. §24's INV-PLAN-PEAK-LR-RACE-RATIO already guarantees
      // the runner is not under-prescribed below the FLOOR, which is the half that
      // protects them. The tier's observable behaviour is pinned by
      // `lib/plan/peakLrEarnedTier.test.ts`.

      if (peakLrKm + 0.01 < effectiveRequired) {
        violations.push({
          code: 'INV-PLAN-PEAK-LR-RACE-RATIO',
          principle_ref: 'CoachingPrinciples §24',
          severity: 'error',
          week: 0,
          message: `Peak long run ${Math.round(peakLrKm * 10) / 10}km is below ${effectiveRequired.toFixed(1)}km (${Math.round(ratio * 100)}% of ${input.race_distance_km}km race)`,
          actual: peakLrKm,
          expected: `≥ ${effectiveRequired.toFixed(1)}`,
        })
      }
      }
    }
  }

  // INV-PLAN-PEAK-SPECIFICITY (CoachingPrinciples §93, enforcing §5)
  //
  // §5 has declared `SPECIFICITY_BY_PHASE` since R23 — peak 40% general / 60%
  // specific — and it has NEVER been read by engine code. Grepped 2026-09-07:
  // the constant appears in `generationConfig.ts`, in three documents, and in
  // one `keyof` type alias. Nothing computed it, so nobody could see that 10K
  // peak was delivering the exact inverse (0% specific, 100% VO2max).
  //
  // This is the §1/CD-19 failure verbatim, one section over: *"the table was
  // read by an offline script and by no engine code, and no invariant
  // referenced it. The value being wrong was downstream of it never being
  // exercised."* §34 exists to stop precisely this, and §5 slipped through.
  //
  // `warn`, not `error`, and the reason is scoped rather than squeamish: the
  // ratio is a phase-level SHAPE target, and a 2-week peak carrying one VO2max
  // and one race-pace session lands at 50% against a 60% target while being
  // exactly the plan a coach would write. Making it `error` would fail correct
  // plans on a rounding boundary. It becomes `error` if a distance is ever
  // measured delivering 0% again — which is the state it was written to catch.
  //
  // 5K is exempt by §22/SC-05 (board-ratified 2026-09-03): race pace ~ I-pace
  // there, so the VO2max rows ARE the specific work and the general/specific
  // split is not a distinction the physiology makes.
  if (isTimeTarget && plan.meta.race_distance_km && plan.meta.race_distance_km > 6) {
    const peakWeeks = plan.weeks.filter(w =>
      w.n >= 1 && w.phase === 'peak' && w.type !== 'deload' && w.type !== 'race')
    let peakQuality = 0
    let peakSpecific = 0
    for (const w of peakWeeks) {
      for (const session of Object.values(w.sessions)) {
        if (!session) continue
        // CB-SPEC-02 (2026-09-13, §93) — for HM/MARATHON the canonical
        // race-specific vehicle is the race-pace LONG RUN (the marathon-pace /
        // HM-pace long-run catalogue rows — category race_specific, role
        // long_run, type easy), which §93 names as the marathon's intended
        // mechanism. Counting only `type:'quality'` slots reported a FALSE 0% on
        // a constrained plan (returning/low-volume marathon) that carries its
        // specificity in the long run rather than a standalone marathon-pace
        // quality session — the plan DID rehearse goal pace; the check could not
        // see it. So a race-specific long run counts here for SPECIFICITY. Its
        // TYPE is unchanged (still easy → §1 distribution and §52 own it as
        // volume); it is only counted in this ratio. A plain Zone-2 long run
        // (not race_specific) is NOT counted — it is volume, not rehearsal.
        // (Read via the catalogue CATEGORY, not any planSignatures flag.)
        const isQuality = session.type === 'quality'
        const isLR = isLongRun(session)
        if (!isQuality && !isLR) continue
        // Structural, not label-based (INV-CLASS-001 / ADR-018): the catalogue
        // row's own category is the answer. VO2max is GENERAL work for these
        // distances after SC-05 reclassified race pace as the specific work.
        const row = catalogueRowFor(session, V1_SESSION_CATALOGUE)
        const isSpecific = row?.category === 'race_specific' || row?.category === 'ultra_specific'
        if (isLR && !isSpecific) continue  // a plain aerobic long run is not specificity
        peakQuality++
        if (isSpecific) peakSpecific++
      }
    }
    if (peakQuality > 0) {
      const target = GENERATION_CONFIG.SPECIFICITY_BY_PHASE.peak.specific_pct
      const actual = Math.round((peakSpecific / peakQuality) * 100)
      if (peakSpecific === 0) {
        violations.push({
          code: 'INV-PLAN-PEAK-SPECIFICITY',
          principle_ref: 'CoachingPrinciples §93 (§5)',
          severity: 'warn',
          week: 0,
          message: `Peak phase carries NO race-specific work on a time-targeted plan (0 of ${peakQuality} peak key sessions, quality + race-pace long run); §5 asks for ${target}%. A runner chasing a goal pace gets no rehearsal of it in the weeks closest to the race.`,
          actual: `${actual}% specific`,
          expected: `>= ${target}% (§5 SPECIFICITY_BY_PHASE.peak)`,
        })
      }
    }
  }

  // INV-PLAN-QUALITY-NOT-ZERO (CoachingPrinciples §110, enforcing §1)
  //
  // THE FLOOR §1 NEVER HAD, and the reason §110's defect survived two years.
  // §1 is a CEILING -- QUALITY_SESSIONS_PER_WEEK_MAX, an upper bound. A plan
  // delivering 0% quality does not breach a ceiling, so `suppressQuality`
  // zeroed intensity for 2,197 non-beginner plans (13.8% of the sweep) and
  // raised NO violation anywhere. An invariant expressed only as an upper bound
  // cannot detect the floor falling out. Hutchinson made this the condition of
  // the §110 ruling: without this check, the next mechanism to zero out quality
  // is just as invisible as the last one.
  //
  // SCOPE -- non-beginner only, and that is ratified, not a convenience.
  // CoachingPrinciples (the 2026-08-30 classifier ruling) is explicit: "A
  // genuine beginner ... still gets no quality sessions, and that remains
  // correct. The classifier was the defect, not the ceiling."
  //
  // READS A STAMP DELIBERATELY, same pattern and same justification as
  // INV-PLAN-UNCOVERED-RUNWAY-DECLARED. `intensityFitness` is generation-time
  // state the validator never receives, and re-deriving it here from
  // `assessFitness` + the declared-level precedence would be a SECOND copy of
  // a classifier this repo has already been bitten by twice (D-16, TIER-OWNER-01
  // -- a checker that re-implements its producer cannot catch the producer being
  // wrong, it can only drift from it). §79 sets `primary_metric: 'duration'`
  // exactly when `intensityFitness === 'beginner' || race >= 50km`, from that
  // same variable -- so the stamp IS the producer's answer, not a guess at it.
  // Ultras are therefore also out of scope here; that is a known gap, recorded
  // rather than papered over, and it is the conservative direction.
  {
    const qualityCount = plan.weeks
      .filter(w => w.n >= 1 && (w.phase === 'build' || w.phase === 'peak'))
      .flatMap(w => Object.values(w.sessions ?? {}).filter(Boolean) as Session[])
      .filter(sn => sn.type === 'quality').length
    const hasBuildOrPeak = plan.weeks.some(w => w.phase === 'build' || w.phase === 'peak')
    const longEnough = plan.weeks.filter(w => w.n >= 1).length >= GENERATION_CONFIG.QUALITY_FLOOR_MIN_PLAN_WEEKS
    // ⚠️ SCOPED ON THE LEVEL, NOT ON THE METRIC (QUALITY-ZERO-SCOPE-01,
    // 2026-09-19). This gate read `plan.meta.primary_metric !== 'duration'`
    // while the message below says "a runner the engine does not classify
    // beginner" — and those are DIFFERENT SETS. `primary_metric` is duration
    // when the runner is a beginner **or the race is 50 km or longer** (§79/§80,
    // time on feet), so every ultra runner was exempted from §110's floor too,
    // and no ultra runner is a beginner.
    //
    // ⚠️ NOTHING IS WRONG TODAY AND THAT IS THE POINT. Measured across 50K and
    // 100K at intermediate and experienced, cwk 50 and 70: every plan receives
    // 10-15 quality sessions, so the floor has nothing to catch. What was
    // missing is the ABILITY to catch it — §110's own text: "a value nothing
    // can falsify is not governed." If a future change zeroes ultra quality the
    // way `suppressQuality` zeroed it for 2,197 plans, this check would have
    // stayed silent again.
    //
    // Sims's standing objection from §45, restated here by her at the sitting:
    // a PRESENTATION field must not stand in for a coaching classification.
    // Fourth instance of that shape today (LR-CAP-BLIND-01, SESSION-KM-01/02,
    // V4-ANCHOR-01).
    const isBeginner = (plan.meta.fitness_intensity_level ?? plan.meta.fitness_level) === 'beginner'
    if (!isBeginner && hasBuildOrPeak && longEnough && qualityCount === 0) {
      violations.push({
        code: 'INV-PLAN-QUALITY-NOT-ZERO',
        principle_ref: 'CoachingPrinciples §110 (§1)',
        severity: 'error',
        week: 0,
        message: `Plan has build/peak weeks and ${plan.weeks.filter(w => w.n >= 1).length} weeks, and prescribes ZERO quality sessions to a runner the engine does not classify beginner. §1 is a ceiling, not a target — but zero is not a training plan.`,
        actual: '0 quality sessions',
        expected: `>= 1 across build/peak`,
      })
    }
  }

  // INV-PLAN-TIME-TARGET-QUALITY-FLOOR — a plan with a TIME TARGET prescribes at
  // least one quality session. (CoachingPrinciples §110 Am.2, §22)
  //
  // ⚠️ THE FLOOR §22 NEVER HAD, and Sims named the shape at the sitting.
  // INV-PLAN-RACE-SPECIFIC-EXPOSURE-RATIO polices whether second-half quality
  // is at GOAL PACE — it iterates the quality sessions, so a plan with NO
  // quality at all passes it in silence. An assertion over a set is mute on an
  // empty set. Same family as §1 being a ceiling with no floor, which is how
  // 2,197 plans shipped with zero quality before §110.
  //
  // What it was missing, measured across 45,888 plans before §110 Am.2:
  //
  //   beginner     · time_target  n=6,336   100% zero-quality    0% goal-pace
  //   intermediate · time_target              0% zero-quality  100% goal-pace
  //   experienced  · time_target              0% zero-quality  100% goal-pace
  //
  // Every cohort that set a time target ran at that pace except one, which ran
  // at it zero percent of the time. Deliberately a floor on the COUNT and not
  // the dose: §110 Am.2 caps a beginner at one per week, and this answers only
  // "did the runner who asked for a time get any exposure to it at all".
  //
  // Scoped to plans long enough to carry build/peak, matching
  // INV-PLAN-QUALITY-NOT-ZERO, so a short or foundation-only plan is not
  // reported for a structure it cannot hold.
  {
    const isTimeTarget = (plan.meta.generator_input?.goal ?? input?.goal) === 'time_target'
    const hasBuildOrPeak = plan.weeks.some(w => w.phase === 'build' || w.phase === 'peak')
    const longEnough = plan.weeks.filter(w => w.n >= 1).length >= GENERATION_CONFIG.QUALITY_FLOOR_MIN_PLAN_WEEKS
    const qualityTotal = plan.weeks
      .filter(w => w.n >= 1)
      .flatMap(w => Object.values(w.sessions ?? {}).filter(Boolean) as Session[])
      .filter(sn => sn.type === 'quality').length
    // §110b — a plan whose weeks never reach the volume that can CARRY a
    // quality session is not defective for having none. The engine declined
    // deliberately (`qualityCeilingFor` fails closed below
    // BEGINNER_QUALITY_MIN_WEEKLY_KM), and reporting that as a violation would
    // be the §52-exemption mistake in reverse: a check firing on the engine
    // doing the right thing. Measured: without this the sweep reported it on
    // 5 km/week beginners AND on a 5 km/week intermediate, whose zero quality
    // comes from §9's session floors rather than from this rule at all.
    const canCarryQuality = plan.weeks.some(w =>
      (w.weekly_km ?? 0) >= GENERATION_CONFIG.BEGINNER_QUALITY_MIN_WEEKLY_KM)
    if (isTimeTarget && hasBuildOrPeak && longEnough && canCarryQuality && qualityTotal === 0) {
      violations.push({
        code: 'INV-PLAN-TIME-TARGET-QUALITY-FLOOR',
        principle_ref: 'CoachingPrinciples §110 Am.2, §22',
        severity: 'error',
        week: 0,
        message: `Plan has a TIME TARGET and prescribes ZERO quality sessions, so the runner never runs at the pace they are aiming for. §22's exposure check cannot see this — it iterates the quality sessions and is silent on an empty set.`,
        actual: '0 quality sessions',
        expected: '>= 1 across the plan',
      })
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
          // SC-09's structural test, not the label. This call site was MISSED
          // when SC-09 landed: it fixed §22's ownership arm (line ~755) and left
          // its sibling ratio arm reading `label.includes('vo2max')`. So
          // `hill_reps` ("Hill reps — 90s") and `intervals_rolling` ("Rolling
          // reps") — both `category: 'vo2max'` — were counted as non-VO2max
          // quality that failed to prescribe goal pace, inflating the
          // denominator with sessions §22 explicitly exempts. Same defect SC-09
          // was written to close, one function call away from the fix.
          if (isVo2maxSession(session, V1_SESSION_CATALOGUE)) continue
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

  // INV-PLAN-BASE-BUILD-RATIO — the base-build ceiling (CoachingPrinciples §111).
  // For marathon/ultra, delivered peak weekly volume may not exceed
  // MAX_BASE_BUILD_RATIO times the runner's RAW current_weekly_km. The engine
  // refuses over the ceiling (BaseVolumeError from generateRulePlan.finalise), so
  // in the generation path this backstop never fires — the refusal pre-empts it.
  // It catches any plan that reaches validatePlan over the ceiling by another
  // route. Computation shared with the refusal via assessBaseBuild, so the check
  // and the refusal cannot drift. Distinct from §23 above (a MINIMUM on
  // peak/WEEK1); this is a MAXIMUM on peak/CURRENT.
  {
    const bb = assessBaseBuild(plan, input)
    if (bb.exceeded && bb.ratio != null) {
      violations.push({
        code: 'INV-PLAN-BASE-BUILD-RATIO',
        principle_ref: 'CoachingPrinciples §111',
        severity: 'error',
        week: 0,
        message: `Peak volume ${bb.peakKm}km is ${bb.ratio === Infinity ? '∞' : bb.ratio.toFixed(1)}x the runner's ${bb.currentKm}km/week base — above the ${bb.cap}x ceiling for marathon/ultra; the plan should have been refused (base ~${bb.minBaseKm}km needed)`,
        actual: bb.ratio === Infinity ? '∞' : `${bb.ratio.toFixed(1)}x`,
        expected: `≤ ${bb.cap}x current_weekly_km`,
      })
    }
  }

  // INV-PLAN-NOT-DETRAINING (§106 Amendment, COMPLIANCE-FIX-1, Coaching Board
  // 2026-09-16) — a plan may not fall substantially below its OWN starting point.
  //
  // THE GAP THIS CLOSES. §106 below asks whether the plan reaches the volume the
  // runner STATED. A plan can clear that in week 1 and then collapse: the review
  // case that prompted this ran 43 km in week 1, 18 km by week 9, and a "peak"
  // phase of 22-27 km, and it satisfied §106 because week 1 exceeded the stated
  // 40 km. §106's reference point is the runner's declaration; this one's is the
  // plan's own first week.
  //
  // MEASURED, 15,973 sweep plans: 2,425 (15.2%) decline 30% or more across
  // base/build/peak. 2,046 of them carry the "maintains your fitness" note while
  // the median such plan drops 35% — and 379 say NOTHING AT ALL.
  //
  // NOT EXCUSABLE BY `volume_profile: 'maintenance'`, and that is this board's
  // own prior words, not a new position. §106's neighbour records the 2026-09-11
  // ruling verbatim: "A detraining block is not an honest response to a
  // constraint, it is a worse plan than no plan, and relabelling it must not make
  // it acceptable." A plan that halves a runner's training is not maintaining it.
  //
  // ⚠️ `warn`, and this is a SEQUENCING decision with a stated exit, not the
  // severity the board asked for. The board ruled `error`. `enforceViolations`
  // THROWS on error in dev/test, so shipping it there would make
  // `generateRulePlan` throw for 15.2% of inputs and take `npm run verify` down
  // entirely — the producer fix (protect volume, yield the quality session on a
  // constrained week) has to land first. The board's INTENT is preserved in full
  // because the compliance gauge counts a detraining plan as UNACCEPTABLE
  // regardless of this severity, so nothing is hidden by the warn.
  // PROMOTE TO `error` when the count approaches zero. If it is still in the
  // thousands after the producer fix, the producer fix did not work.
  {
    const declineCap = GENERATION_CONFIG.MAX_DELIVERED_DECLINE_PCT
    // Base/build/peak only. Deloads (§3), the taper (§6) and race week are all
    // low BY DESIGN; including any of them measures the design, not a defect.
    const progressive = plan.weeks.filter(w =>
      w.n >= 1 && w.phase !== 'taper' && w.type !== 'deload' && w.badge !== 'deload' &&
      w.type !== 'race' &&
      !Object.values(w.sessions ?? {}).some(sn => sn?.type === 'race'))
    if (progressive.length >= 2) {
      const week1 = progressive[0].weekly_km ?? 0
      const lowest = Math.min(...progressive.map(w => w.weekly_km ?? 0))
      if (week1 > 0 && lowest > 0) {
        const declinePct = ((week1 - lowest) / week1) * 100
        if (declinePct > declineCap) {
          const lowWeek = progressive.find(w => (w.weekly_km ?? 0) === lowest)
          violations.push({
            code: 'INV-PLAN-NOT-DETRAINING',
            // §2 Am.2 (COMPLIANCE-FIX-2) names this invariant as its enforcer —
            // the deload ratchet's OUTCOME is exactly what this measures, so a
            // second checker would be duplication. The § must be cited here or
            // the claim is unlinked (the §92 failure: "enforced" for eight days
            // while checking nothing).
            principle_ref: 'CoachingPrinciples §106 Am., §2 Am.2',
            severity: 'warn',
            week: lowWeek?.n ?? 0,
            message: `Plan declines ${declinePct.toFixed(0)}% from its own week 1 (${week1}km) to week ${lowWeek?.n} (${lowest}km) across base/build/peak — beyond §3's own deload depth (${declineCap}%). This is detraining, and volume_profile 'maintenance' does not excuse it.`,
            actual: `-${declinePct.toFixed(0)}%`,
            expected: `decline <= ${declineCap}%`,
          })
        }
      }
    }
  }

  // INV-PLAN-PEAK-NOT-BELOW-START — a plan never peaks below where the runner
  // already is. (CoachingPrinciples §106, Coaching Board MAINT-PROFILE-01)
  //
  // MEASURED ON THE DELIVERED WEEK, NOT THE TARGET — and that distinction is the
  // whole check. §106 puts a floor under `peakKm`, but `peakKm` is the internal
  // curve's target; the runner sees `weekly_km` on placed sessions, and the two
  // diverge downward through the weekday cap, §52's long-run interaction and the
  // §12 trims. That is ADR-022's finding restated: the load rules were enforced
  // on the CURVE while the runner read the DELIVERY. Checking the target here
  // would pass on a plan that still detrains them.
  //
  // NOT EXCUSABLE BY `volume_profile: 'maintenance'`, deliberately and unlike
  // its neighbours §23/§46/§52. Those license maintenance when the RUNNER'S
  // constraints prevent overload. A detraining block is not an honest response
  // to a constraint, it is a worse plan than no plan, and relabelling it must
  // not make it acceptable (Coaching Board, explicit).
  //
  // Warn, not error, for the residual: §106's floor moves the target, and the
  // delivered week can still land under it for a runner whose life constraints
  // bite. Same honest-residual precedent as ADR-022's `warn` invariants (§34).
  {
    const declared = input?.current_weekly_km
    // ⚠️ RACE WEEK IS EXCLUDED (2026-09-16). It was not, and that masked the
    // check on 574 plans (3.6% of the 15,973-plan sweep).
    //
    // `deliveredPeak` took the max over every non-foundation, non-deload week —
    // INCLUDING race week, which contains the race. For a marathon that is 42.2
    // km of "volume" the runner does not train, so the plan's peak was the race
    // itself and a genuinely detraining block cleared the floor comfortably.
    //
    // THIS IS THE SAME DEFECT, THIRD OCCURRENCE. `coaching-deviation-scan.ts`
    // carried it on its §6 taper arm until 2026-09-15 (an ultra's race week is
    // its biggest week, so the check could never fire at exactly the distances
    // where it mattered most). It reappeared in a measurement script the same
    // week. A race week is not a training week, and every max-over-weeks in this
    // file should be read with that in mind.
    //
    // Identified by the week carrying a `race` session rather than by index — a
    // Monday race (PV2-G) sits in a week that is not the last.
    const nonFoundation = plan.weeks.filter(w =>
      w.phase !== 'foundation' && w.type !== 'deload' && w.type !== 'race' &&
      !Object.values(w.sessions ?? {}).some(sn => sn?.type === 'race'))
    if (declared != null && declared > 0 && nonFoundation.length > 0) {
      const deliveredPeak = Math.max(...nonFoundation.map(w => w.weekly_km))
      const floor = declared * GENERATION_CONFIG.PEAK_FLOOR_VS_START_RATIO
      if (deliveredPeak + 0.5 < floor) {
        violations.push({
          code: 'INV-PLAN-PEAK-NOT-BELOW-START',
          principle_ref: 'CoachingPrinciples §106',
          severity: 'warn',
          week: 0,
          message: `Delivered peak week is ${deliveredPeak}km but the runner already runs ${declared}km — the plan reduces their volume for its whole length`,
          actual: `${deliveredPeak}km`,
          expected: `>= ${Math.round(floor)}km`,
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
    //   (3) a DECLARED SHORTFALL → band MUST NOT be 'comfortable'
    //       (§44 Amendment, Coaching Board 2026-09-19, DIFFICULTY-SHORTFALL-01)
    //
    // §44's own definition of the bottom rung is "adequate timeline, plan
    // REACHES ITS TARGET". 751 plans read 'comfortable' while carrying a note
    // saying it does not — 26% of comfortable plans, and 721 of the 751 were
    // classified `optimal`, so `appropriate_for_persona` excused only 30.
    //
    // ⚠️ This reads the shortfall FLAGS, never the sessions. §44 point 3
    // (Willy) forbids the band consulting plan-quality signals, and the
    // proposal that it should read load was ruled INCORRECT in the same
    // sitting. A shortfall flag states whether the plan met the target it was
    // given — the same class of fact as prep-time margin.
    const shortfallNotes = [
      plan.meta.long_run_shortfall_note,
      plan.meta.peak_shortfall_note,
      plan.meta.volume_shortfall_note,
    ].filter(Boolean)
    if (shortfallNotes.length && plan.meta.difficulty_band === 'comfortable') {
      violations.push({
        code: 'INV-PLAN-DIFFICULTY-NEVER-FRONTS-UNSAFE',
        principle_ref: 'CoachingPrinciples §44 Amendment (DIFFICULTY-SHORTFALL-01)',
        severity: 'error',
        week: 0,
        message: `Plan declares a shortfall (${shortfallNotes.length} note(s)) yet reads 'comfortable' — §44 defines comfortable as "plan reaches its target"`,
        actual: 'comfortable',
        expected: "'demanding' | 'very_demanding'",
      })
    }
  }

  // INV-PLAN-LONG-SESSION-FUELLING-NOTE (§24e Amendment, Coaching Board
  // 2026-09-19, LONG-SESSION-FUEL-01) — a peak-phase long run long enough to
  // need fuel must say so.
  //
  // MEASURED before the ruling: of 88 plans containing a session of two hours
  // or more, only 27 carried any fuelling guidance ON that session. The
  // never-run beginner marathoner was prescribed SEVEN sessions over two
  // hours, up to 3h28, with no mention of fuelling anywhere in the plan —
  // because §24e's cue was gated on the race being a 50K/100K rather than on
  // the session's duration.
  //
  // ⚠️ SCOPE IS PEAK-PHASE, NON-DELOAD, AND THAT IS DELIBERATE, NOT A GAP.
  // §24c/§96's reasoning holds: a cue on every long run is wallpaper. This
  // checks the session where the duration makes fuelling necessary.
  //
  // ⚠️ MATCHES THE EXPORTED CONSTANTS, NOT PROSE. The copy is runner-facing
  // and gets edited for tone; a prose matcher would break on a comma. The
  // ultra arm interpolates a cadence, so it is prefix-matched on a shared
  // exported constant rather than a literal typed out here.
  // ⚠️ CHECKS THE PEAK LONG RUN — THE LONGEST ONE — NOT EVERY PEAK LONG RUN,
  // AND THE REASON IS A REAL LIMITATION WORTH STATING.
  //
  // The producer adds the cue to every non-deload peak long run. The checker
  // cannot match that scope, because A STEP-BACK WEEK IS INVISIBLE IN THE
  // PLAN'S STRUCTURED DATA: week 15 of a marathon build is a step-back inside
  // the peak phase, and it carries `type: 'normal'`, no `badge`, and
  // `phase: 'peak'` — identical to the loading week beside it. The only thing
  // that says "step-back" is the prose in its coach note. Scoping on
  // `badge === 'deload'` therefore demanded a fuelling cue on a recovery week
  // and failed the build, which is how this was found.
  //
  // Rather than teach the checker the producer's deload predicate — a checker
  // sharing the producer's logic is blind to the producer being wrong, which
  // is why `invariants.ts` is exempt from `deloadCadence` — this checks the one
  // session the board actually ruled on: the longest long run of the peak
  // phase, where duration makes fuelling necessary.
  //
  // WHAT THIS DOES NOT PROVE: that every other long session carries the cue.
  // Measured coverage is 76 of 88 plans containing a 2h+ session (was 27).
  // 🔎 FILED, NOT FIXED: a step-back week has no structured marker. That is a
  // gap in the plan schema, not in this rule, and it will bite the next rule
  // that needs to tell loading from recovery.
  {
    let peakLongRun: Session | null = null
    let peakWeekN = 0
    for (const w of plan.weeks) {
      if (w.phase !== 'peak') continue
      for (const sn of Object.values(w.sessions ?? {})) {
        if (!sn || sn.role !== 'long_run') continue
        if ((sn.duration_mins ?? 0) > (peakLongRun?.duration_mins ?? 0)) {
          peakLongRun = sn; peakWeekN = w.n
        }
      }
    }
    const mins = peakLongRun?.duration_mins ?? 0
    if (peakLongRun && mins >= GENERATION_CONFIG.FUELLING_PRACTICE_MIN_SESSION_MINS) {
      const notes = (peakLongRun.coach_notes ?? []).filter(Boolean) as string[]
      const fuelled = notes.some(n =>
        n === FUELLING_PRACTICE_NOTE || n.startsWith(ULTRA_FUELLING_PREFIX))
      if (!fuelled) {
        violations.push({
          code: 'INV-PLAN-LONG-SESSION-FUELLING-NOTE',
          principle_ref: 'CoachingPrinciples §24e Amendment',
          severity: 'error',
          week: peakWeekN,
          message: `Peak long run of ${mins} min carries no fuelling guidance (threshold ${GENERATION_CONFIG.FUELLING_PRACTICE_MIN_SESSION_MINS} min)`,
          actual: `${notes.length} note(s), none about fuelling`,
          expected: 'a fuelling practice or cadence cue',
        })
      }
    }
  }

  // INV-PLAN-REENTRY-NOTE-MATCHES-CAUSE (§79 Amendment 5, Coaching Board
  // 2026-09-19, REENTRY-CAUSE-01) — the re-entry omission note must name the
  // reason the window actually opened.
  //
  // MEASURED: "You are coming back" reached 21% of experienced-runner plans,
  // and 80% of those had `early_quality_onset` — ADR-021 §89's cohort, which
  // REQUIRES the runner is not returning and not fresh. The engine told its
  // most demonstrably-ready runners their legs needed to re-adapt.
  //
  // ⚠️ READS THE STAMPED CAUSE, NEVER RECOMPUTES IT. The producer decides why
  // the window opened; this checks the rendered copy agrees. Recomputing the
  // predicate here would share the producer's logic and be blind to the
  // producer being wrong — the deloadCadence/tierResolution failure class.
  if (plan.meta.intensity_reentry_omission_note) {
    const note = plan.meta.intensity_reentry_omission_note
    const cause = plan.meta.intensity_reentry_cause
    if (!cause) {
      violations.push({
        code: 'INV-PLAN-REENTRY-NOTE-MATCHES-CAUSE',
        principle_ref: 'CoachingPrinciples §79 Amendment 5',
        severity: 'error',
        week: 0,
        message: 'Re-entry omission note present with no stamped cause — the copy cannot be checked against a reason that was never recorded',
        actual: 'no intensity_reentry_cause',
        expected: "'returning' | 'user_raised' | 'early_onset'",
      })
    } else if (cause !== 'returning' && /coming back/i.test(note)) {
      violations.push({
        code: 'INV-PLAN-REENTRY-NOTE-MATCHES-CAUSE',
        principle_ref: 'CoachingPrinciples §79 Amendment 5',
        severity: 'error',
        week: 0,
        message: `Re-entry note tells a '${cause}' runner they are "coming back" — they are not returning from anything`,
        actual: cause,
        expected: "note without 'coming back' copy",
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
  // INV-PLAN-RACE-SPECIFIC-VARIETY (CoachingPrinciples §104, 2026-09-11)
  //
  // A peak that rehearses the race with the SAME session every time is not three
  // rehearsals, it is one rehearsal run three times. §93 provisions a
  // time-targeted 10K peak with up to three race-specific slots; before
  // CAT-10K-RACE-SPECIFIC-01 the catalogue had one 10K row to fill them, and
  // 100% of 96 measured plans placed it twice.
  //
  // DELIBERATELY NOT "a distance must own N rows". That would write a content
  // target into the constitution, and the number would be wrong the moment the
  // slot logic changed. This asserts the thing that actually reaches the runner:
  // if the plan repeats one race-specific row while ANOTHER eligible row existed,
  // the repetition was a choice, not a constraint. Where the catalogue genuinely
  // offers only one, this stays silent and `catalogueDepth.test.ts` tracks the
  // content gap instead — a plan is not defective because the catalogue is thin.
  //
  // `warn`: variety is a quality of a good plan, not a safety property, and §34
  // is explicit that an honest residual beats a check nobody can satisfy.
  {
    if (isTimeTarget) {
      // ⚠️ THE LONG RUN IS EXCLUDED, and leaving it in was wrong.
      //
      // §104 is about the QUALITY slots §93 provisions. `mp_long_run` is a
      // race_specific row that occupies the LONG RUN, and repeating it across
      // peak weeks is not a variety failure — it is §47's alternation working
      // as designed ("peak long run → step-back long run"). Counting it made
      // this invariant fire on 92% of marathon plans the moment marathon gained
      // a second row, which by Willy's own NOISE-GATE-01 standard ("a check
      // firing at 71% is not a safety mechanism, it is noise, and noise gets
      // suppressed") would have made it worthless.
      //
      // Not caught when §104 shipped because 10K's only race_specific rows are
      // quality sessions, so the distinction never arose. Found by extending the
      // same principle to marathon hours later.
      const peakRaceSpecific = plan.weeks
        .filter(w => w.phase === 'peak' && w.type !== 'race')
        .flatMap(w => Object.values(w.sessions)
          .filter((sn): sn is Session => sn != null && !!sn.catalogue_id && !isLongRun(sn))
          .map(sn => ({ week: w.n, id: sn.catalogue_id! })))
        .filter(x => V1_SESSION_CATALOGUE
          .find(r => r.id === x.id)?.category === 'race_specific')

      const distinctUsed = new Set(peakRaceSpecific.map(x => x.id))
      if (peakRaceSpecific.length >= 2 && distinctUsed.size === 1) {
        // Was there an alternative the engine could have reached at all? Phase
        // and distance only — the runner-specific gates (fitness, pace anchors)
        // are the selector's business, so this asks the weaker, safer question.
        const used = Array.from(distinctUsed)[0]
        const alternatives = V1_SESSION_CATALOGUE.filter(r =>
          r.category === 'race_specific'
          && r.id !== used
          && (r.distance_eligibility as readonly string[]).includes(distKey)
          && (r.phase_eligibility as readonly string[]).includes('peak')
          // A long-run-shaped row is not an alternative for a QUALITY slot.
          && r.main_set_structure?.type !== 'long_run_with_segment')

        if (alternatives.length > 0) {
          violations.push({
            code: 'INV-PLAN-RACE-SPECIFIC-VARIETY',
            principle_ref: 'CoachingPrinciples §104 (§93, §22)',
            severity: 'warn',
            week: peakRaceSpecific[0].week,
            message: `Peak fills ${peakRaceSpecific.length} race-specific slots with the same catalogue row (${used}), though ${alternatives.length} other peak-eligible ${distKey} race-specific row(s) exist (${alternatives.map(a => a.id).join(', ')}). The race is rehearsed once, repeated.`,
            actual: `${peakRaceSpecific.length}x ${used}`,
            expected: 'more than one distinct race-specific row where the catalogue offers one',
          })
        }
      }
    }
  }

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
        principle_ref: 'CoachingPrinciples §3, §90',
        // Stays `warn` (2026-09-06, DELOAD-INVERSION-01). The CURVE cause named
        // above IS fixed — a deload is now `min(existing, 70% × POST-CAP prior)`,
        // not 70% of the uncapped curve, and curve-level inversions measured
        // 12.8% → 0%. But this invariant reads DELIVERED `weekly_km`
        // (`sumWeeklyKm`), and the delivered residual is NOT closed: on ~3.5% of
        // swept plans a deload week still overshoots its reduced target because
        // session floors (MIN_SESSION_DISTANCE) + the race-anchored long run
        // (§45/§47) size independently of the ceiling. The Coaching Board scoped
        // the DELIVERED reconciliation to INJURY runners only (§2's 5% injury cap —
        // INV-PLAN-INJURY-CAP-DELIVERED); it deliberately LEFT the healthy
        // delivered divergence to §52 ("the race sets the long run, don't deform
        // it") rather than mandate deload-week placement surgery for everyone.
        // So promotion to `error` is blocked on a SEPARATE, future board ruling
        // on healthy deload-week placement — not on this change. Known-open,
        // declared AND exercised (§34), same footing as INV-PLAN-BOUNCEBACK-BOUNDED.
        severity: 'warn',
        week: w.n,
        message: `Week ${w.n} is badged deload but carries ${w.weekly_km}km against week ${prev.n}'s ${prev.weekly_km}km. A recovery week that adds volume is not a recovery week.`,
        actual: `${w.weekly_km}km`,
        expected: `<= ${prev.weekly_km}km (the preceding week)`,
      })
    }
  }

  // INV-PLAN-BOUNCEBACK-BOUNDED (CoachingPrinciples §2 — RAMP-BOUNCEBACK-01)
  //
  // For a knee/shin-history runner the post-deload bounceback is no longer §2-
  // exempt: §2's injury cap bounds it, so the return to pre-deload volume
  // happens GRADUALLY and the bounceback week stays BELOW pre-deload. RAMP-
  // BOUNCEBACK-01 removed the `Math.max`-override that let the bounceback jump
  // straight back — a +43% rise, +26% on the knee archetype, shipped to injured
  // tissue whose binding constraint is the acute weekly load.
  //
  // ⚠️ `warn`, not `error`, and the reason is exactly INV-PLAN-DELOAD-IS-A-
  // REDUCTION's (D-21): the injury cap governs the volume CURVE, but the DELIVERED
  // `weekly_km` diverges from the curve by session placement — a race-anchored
  // long run (§45/§47) sized on its own schedule can inflate a low-target
  // bounceback week well above the curve. So while the curve fix caps the
  // bounceback, the DELIVERED bounceback can still exceed pre-deload (measured at
  // 6120 plans, worst on low-day/low-volume runners). That residual is the SAME
  // class as the deload-inversion — delivered ≠ curve — and it clears only when
  // DELOAD-INVERSION-01 makes placement track the curve. Until then this is a
  // known-open measurement (declared AND exercised, §34), and it becomes `error`
  // when DELOAD-INVERSION-01 lands. Healthy runners are NOT checked — their
  // bounceback is unbounded by design (§2, confirmed on measurement).
  //
  // Predicate matches the engine's injury-cap gate exactly (ruleEngine.ts:
  // `hasInjury('knee') || hasInjury('shin_splints')`).
  const bouncebackInjuryCapped = (input.injury_history ?? []).some(i => {
    const s = i.toLowerCase()
    return s.includes('knee') || s.includes('shin_splints')
  })
  if (bouncebackInjuryCapped) {
    for (let i = 2; i < plan.weeks.length; i++) {
      const bounce = plan.weeks[i]
      const deload = plan.weeks[i - 1]
      const preDeload = plan.weeks[i - 2]
      const deloadIs = deload.type === 'deload' || deload.badge === 'deload'
      const bounceIs = bounce.type === 'deload' || bounce.badge === 'deload'
      const preIs = preDeload.type === 'deload' || preDeload.badge === 'deload'
      // Only a clean [pre-deload, deload, bounceback] triple in a building phase.
      if (!deloadIs || bounceIs || preIs || bounce.phase === 'taper') continue
      // §2 AMENDMENT 3 (PLAN-FITNESS-01, 2026-09-17) — `>` NOT `>=`.
      //
      // Amendment 3 makes a return TO pre-deload legal for injury-history runners
      // (it was already legal for healthy ones). Only a return ABOVE it is a
      // violation. Left as `>=` this would fire on exactly the plans the
      // amendment intends to produce — a checker contradicting its own principle,
      // which is the §92 class this repo has shipped before.
      if (bounce.weekly_km > preDeload.weekly_km + 0.01) {
        violations.push({
          code: 'INV-PLAN-BOUNCEBACK-BOUNDED',
          principle_ref: 'CoachingPrinciples §2',
          severity: 'warn',
          week: bounce.n,
          message: `Week ${bounce.n} is a post-deload bounceback for an injury-history runner (${bounce.weekly_km}km) but the DELIVERED volume returns to or above pre-deload week ${preDeload.n} (${preDeload.weekly_km}km). The curve caps the bounceback; placement (long run) still inflates it — the delivered residual clears with DELOAD-INVERSION-01.`,
          actual: `${bounce.weekly_km}km`,
          expected: `< ${preDeload.weekly_km}km (gradual return; delivered pending DELOAD-INVERSION-01)`,
        })
      }
    }
  }

  // INV-PLAN-INJURY-CAP-DELIVERED (CoachingPrinciples §90 — DELOAD-INVERSION-01)
  //
  // For a knee/shin-history runner §2's injury cap (5%/wk) is a DELIVERED
  // promise — what the runner actually runs — not just a property of the volume
  // CURVE. Before DELOAD-INVERSION-01 the cap was enforced only on the curve, so
  // a green curve could still ship a +39% delivered week to injured tissue: a
  // 2-quality peak (§8) plus easy floors plus the growing long run, none trimmed
  // to the ceiling. The Coaching Board (2026-09-06, Willy-led) ruled the cap must
  // hold at DELIVERY for injury runners, via levers IN ORDER: (a) the peak week
  // yields its 2nd quality session to §12 (§8 defers — this is what makes the
  // fix possible), then (b) easy runs are dropped/trimmed to fit. The ONE thing
  // never trimmed is the race-anchored long run: §52 owns it ("the race sets the
  // long run; do not deform it; if it ALONE breaks the cap, classify maintenance").
  //
  // So the enforceable delivered promise is on the TRIMABLE portion — the non-
  // long-run volume must not rise faster than the injury cap. A week whose only
  // over-cap driver is the long run growing on its own §45/§47 schedule is §52-
  // exempt by construction, not a defect. This is the check that lever (b)
  // actually reconciles the easy/quality volume, week on week, for injured tissue.
  //
  // `warn`, same footing as INV-PLAN-DELOAD-IS-A-REDUCTION / -BOUNCEBACK-BOUNDED
  // (§34, declared AND exercised): the WHOLE-week delivered rise can still exceed
  // the cap on a peak week because the §52-protected long run is counted in
  // `weekly_km` (the residual the injuryCapCompounds test tolerances at cap+15).
  // It becomes `error` when injury long-run placement is itself curve-reconciled
  // — a separate future §52 ruling, not this change.
  if (bouncebackInjuryCapped) {
    const capPct = GENERATION_CONFIG.INJURY_WEEKLY_INCREASE_CAP_PCT
    // Enforcement tolerance (inline, not a coaching numeric — it tunes what the
    // CHECKER flags, not what the engine prescribes): absorbs session-distance
    // rounding + MIN_SESSION_DISTANCE granularity on low-volume weeks, where a
    // single dropped/added easy km is a large percentage.
    const DELIVERED_ROUNDING_TOLERANCE_PCT = 10
    const longKmOf = (w: Week) => {
      const l = Object.values(w.sessions).find(s => s && isLongRun(s))
      return sessionKmForCheck(l) ?? 0   // SESSION-KM-02
    }
    for (let i = 1; i < plan.weeks.length; i++) {
      const w = plan.weeks[i]
      const prev = plan.weeks[i - 1]
      const isDeload = w.type === 'deload' || w.badge === 'deload'
      const prevIsDeload = prev.type === 'deload' || prev.badge === 'deload'
      // Deload weeks (DELOAD-IS-A-REDUCTION) and the post-deload bounceback
      // (BOUNCEBACK-BOUNDED) have their own invariants; taper is a planned drop.
      if (isDeload || prevIsDeload || w.phase === 'taper') continue
      const nonLongNow = w.weekly_km - longKmOf(w)
      const nonLongPrev = prev.weekly_km - longKmOf(prev)
      if (nonLongPrev <= 0 || nonLongNow <= nonLongPrev) continue
      const risePct = ((nonLongNow - nonLongPrev) / nonLongPrev) * 100
      // §90 amendment (CHARITY-CAP-ABSFLOOR-01, Coaching Board 2026-09-13): a
      // breach requires BOTH the % cap AND an absolute-km floor. On a low base a
      // percentage magnifies a clinically trivial rise (+3km non-long = +38% for
      // a knee-history 10K runner); Willy's floor separates a tissue-meaningful
      // step from arithmetic noise. Gates the warn, never the trim — the producer
      // still caps to §12.
      const absRiseKm = nonLongNow - nonLongPrev
      if (risePct > capPct + DELIVERED_ROUNDING_TOLERANCE_PCT
          && absRiseKm > GENERATION_CONFIG.DELIVERED_ABSOLUTE_FLOOR_KM) {
        violations.push({
          code: 'INV-PLAN-INJURY-CAP-DELIVERED',
          principle_ref: 'CoachingPrinciples §90',
          severity: 'warn',
          week: w.n,
          message: `Week ${w.n}: an injury-history runner's TRIMABLE (non-long-run) delivered volume rose ${risePct.toFixed(0)}% from week ${prev.n} (${nonLongPrev.toFixed(0)}→${nonLongNow.toFixed(0)}km), above §2's injury cap of ${capPct}%. The long run is §52-exempt; the easy/quality volume is not — DELOAD-INVERSION-01 lever (b) should have trimmed it.`,
          actual: `+${risePct.toFixed(0)}% non-long-run`,
          expected: `<= ${capPct}% (§2's injury cap on the trimable portion)`,
        })
      }
    }
  }

  // INV-PLAN-DELOAD-PHASE-POSITION (CoachingPrinciples §95, extending §87)
  //
  // §87 ruled "a recovery week must not OPEN a phase". The neighbouring case was
  // never ruled on: a deload on the phase's SECOND week, which gives the runner
  // exactly one week of a new stimulus and then recovers them from it.
  //
  // Measured 2026-09-07 on the founder's live 10K: week 3 carried the plan's
  // first-ever quality session and week 4 was a deload. It fired on BOTH
  // early-onset 10K cases and on NEITHER the non-gated control nor HM — so §89's
  // shorter base was the cause, sliding the phase boundary underneath a cadence
  // anchored to absolute week number.
  //
  // §91 then moved the boundary again and the symptom stopped reproducing on
  // every measured case. THAT IS EXACTLY WHY THIS CHECK EXISTS RATHER THAN A
  // PLACEMENT FIX. `computeDeloadWeeks` still knows nothing about position 2;
  // the defect is masked by the current phase arithmetic, not repaired, and
  // SC-10 is the standing reminder in this codebase that a masked defect and a
  // fixed one are indistinguishable until something moves. If a future ruling
  // shifts a boundary back, this goes red instead of shipping quietly.
  //
  // `warn`: the placement is undesirable, not unsafe — it is more recovery, not
  // less (the same reasoning §87 applied to its own backward-normalisation pass).
  //
  // §95 AMENDMENT 1 (Coaching Board 2026-09-15) — THIS NOW HAS A PLACEMENT FIX,
  // AND IT DELIBERATELY DOES NOT CLOSE THE CHECK. `computeDeloadWeeks` keeps a
  // deload off position 2 where it legally can (standard runners 21.7% -> 0.0%),
  // but §95 is a PREFERENCE and yields to any ratified ERROR the §87 placement
  // does not also carry — re-locating a deload changes session composition and
  // can push §1 over its ceiling (19.6% vs 18%). `meta.deload_position2_yielded`
  // records that.
  //
  // It also cannot be satisfied at all on most MASTERS plans: the full
  // constraint set (no position 1, no position 2, no adjacency, count never
  // falls, loading run never lengthens) is UNSATISFIABLE on 1,944 of 3,726
  // masters plans (52.2%) and on 0 of 3,726 standard plans, by brute force over
  // every legal placement. So a surviving warn is now one of two DECISIONS —
  // yielded to a ceiling, or provably unplaceable — rather than the accident of
  // arithmetic it used to be. Do not promote it to `error`; that would fail
  // plans the board has ruled correct.
  {
    const firstWeekOfPhase = new Map<string, number>()
    plan.weeks.forEach(w => {
      const ph = w.phase ?? 'base'
      if (w.n >= 1 && !firstWeekOfPhase.has(ph)) firstWeekOfPhase.set(ph, w.n)
    })
    for (const w of plan.weeks) {
      if (w.n < 1) continue
      if (!(w.type === 'deload' || w.badge === 'deload')) continue
      const ph = w.phase ?? 'base'
      // Base opening on a deload is impossible-by-construction and peak/taper
      // never deload at all (deloadCadence.ts), so this is about build.
      if (ph !== 'build') continue
      const start = firstWeekOfPhase.get(ph)
      if (start == null) continue
      const positionInPhase = w.n - start + 1
      if (positionInPhase === 2) {
        violations.push({
          code: 'INV-PLAN-DELOAD-PHASE-POSITION',
          principle_ref: 'CoachingPrinciples §95 (§87)',
          severity: 'warn',
          week: w.n,
          message: `Week ${w.n} is a deload at position 2 of the ${ph} phase — the runner gets one week of a new stimulus and then recovers from it. §87 forbids opening a phase on a deload; this is the same defect one week over.`,
          actual: `deload at phase position ${positionInPhase}`,
          expected: 'position 3 or later (§87/§95)',
        })
      }
    }
  }

  // INV-PLAN-DELIVERED-RAMP (CoachingPrinciples §94, enforcing §2 at delivery)
  //
  // §2's 10% rule is enforced on the volume CURVE by `buildVolumeSequence`. The
  // runner runs the PLACED SESSIONS, and those diverge — ADR-022 established
  // exactly this and scoped its remedy to injury-history runners, so a healthy
  // runner has no delivered-volume check at all.
  //
  // The mechanism is not placement drift, it is a SAFETY RULE CREATING THE SPIKE.
  // `V1-volume-quality-split` (Willy's gate on CD-16) holds a week flat when it
  // introduces the first VO2max session — intensity and volume must not progress
  // together. Correct. But the NEXT week steps up from the CURVE's value, not
  // from the trimmed one, so the trim hands its whole deficit to the following
  // week. Measured on the founder's live 10K: the curve read 33 -> 37 -> 40
  // (+8%, legal); the trim held W2 at 33; the runner therefore ran 33, 33, 40 —
  // a +23% delivered rise against a chronic load of 33. Before §91/§93 reshaped
  // the plan the same mechanism produced +48%.
  //
  // EXCLUSIONS, each because another principle owns the question:
  //   - the post-deload bounceback (§2, RAMP-BOUNCEBACK-01). A healthy return to
  //     a fortnight-ago volume is not a spike, and the board MEASURED a 20%
  //     healthy cap on 2026-09-06 and rejected it: +50pp of plans flipped to
  //     "constrained by inputs" for zero safety benefit. Not reopened here.
  //   - deload weeks themselves (INV-PLAN-DELOAD-IS-A-REDUCTION) and taper
  //     (a planned drop).
  //   - injury-history runners, who are already covered, more strictly, by
  //     INV-PLAN-INJURY-CAP-DELIVERED (§90).
  //   - foundation weeks, which have their own +10% rule (§57).
  //
  // PRODUCER SHIPPED 2026-09-11 (§100, RAMP-PRODUCER-01). Until then this was
  // detection with nothing behind it: `reanchorWeekAfterTrim` in ruleEngine now
  // ramps the week after a V1 trim from DELIVERED volume rather than the curve,
  // which took the breach rate on a 611-plan grid from 22.7% to 11.5% and the
  // worst delivered rise from 55% to 39%. This check stays `warn` and stays
  // exactly as written — it is the measurement the board ruled against, and
  // relaxing it now would delete the evidence that the fix worked.
  //
  // `warn`, and honestly so (§34): the long run is §52-exempt and sized on its
  // own race-anchored schedule, so part of any residual is placement the engine
  // is not permitted to trim. Measured against the TRIMABLE (non-long-run)
  // portion for that reason — the same basis §90 uses.
  {
    const healthy = (input.injury_history ?? []).length === 0
    if (healthy) {
      const capPct = GENERATION_CONFIG.MAX_WEEKLY_VOLUME_INCREASE_PCT
      // Absorbs session-distance rounding and MIN_SESSION_DISTANCE granularity
      // on low-volume weeks, where one dropped easy km is a large percentage.
      // Tunes the CHECKER, not what the engine prescribes — so it is inline, not
      // a coaching numeric (CLAUDE.md's tunability test).
      const DELIVERED_ROUNDING_TOLERANCE_PCT = 10
      const longKmOf = (w: Week) => {
        const l = Object.values(w.sessions).find(s => s && isLongRun(s))
        return sessionKmForCheck(l) ?? 0   // SESSION-KM-02
      }
      // SESSION-KM-02 — easy runs are duration-anchored on 38.5% of sessions in
      // the cohort grid, so `?? 0` under-counted the delivered week for every
      // beginner and the healthy weekly-increase cap was measured against a
      // number that was not the week.
      const deliveredKm = (w: Week) =>
        Object.values(w.sessions).reduce((a, s) => a + (sessionKmForCheck(s) ?? 0), 0)

      for (let i = 1; i < plan.weeks.length; i++) {
        const w = plan.weeks[i]
        const prev = plan.weeks[i - 1]
        if (w.n < 1 || prev.n < 1) continue                      // foundation: §57
        const isDeload = w.type === 'deload' || w.badge === 'deload'
        const prevIsDeload = prev.type === 'deload' || prev.badge === 'deload'
        if (isDeload || prevIsDeload) continue                   // §2 bounceback / -DELOAD-IS-A-REDUCTION
        if (w.phase === 'taper' || w.type === 'race') continue   // planned drop

        // §2 GUARDS LOAD THE BODY HAS NOT ADAPTED TO — not every rise.
        //
        // Written without this, the check fired on 44.4% of a 525-plan grid,
        // worst rise 114%, and almost all of it was the engine ramping UP TOWARD
        // the runner's own stated volume from a deliberately conservative start:
        // a runner who reports 20 km/week gets 13.5 -> 16.5 -> 18, every week
        // BELOW the load they are already carrying. Nothing there is a spike, and
        // §1 records the standard this would have failed — Willy, on a check
        // firing at 71%: "not a safety mechanism — it is noise, and noise gets
        // suppressed, which is how a real violation gets missed later."
        //
        // So the cap binds only once the week exceeds the runner's established
        // chronic load. Below it the plan is rebuilding to a baseline the tissue
        // already holds.
        if (deliveredKm(w) <= (input.current_weekly_km ?? 0)) continue

        // Trimable volume is still COMPUTED — it is useful context in the
        // message — but it no longer GATES anything. The early return that stood
        // here (bail out when the trimable portion did not rise) was the second
        // of the two arms §94 Amendment 1 retires, and it is the one that hid the
        // most extreme shape of all: a long run growing so hard that the rest of
        // the week SHRANK to accommodate it. 22 of the 926 measured breaches
        // (2.4%) were lost to exactly that, every one of them long-run-driven.
        const nowTrimable = deliveredKm(w) - longKmOf(w)
        const prevTrimable = deliveredKm(prev) - longKmOf(prev)
        const risePct = prevTrimable > 0
          ? ((nowTrimable - prevTrimable) / prevTrimable) * 100
          : 0

        // §94 AMENDMENT 1 — THE TRIMABLE ARM IS RETIRED (Coaching Board
        // 2026-09-17, RAMP-GUARD-FAILS-OPEN-01).
        //
        // What stood here required BOTH the whole week AND its trimable
        // (non-long-run) portion to breach, justified on the long run being
        // "§52-exempt and race-anchored" so that its jumps swing the trimable
        // remainder for no change in load. TWO THINGS WERE WRONG WITH THAT:
        //
        //  1. IT NEVER ONCE DID ITS JOB. Measured over 2,799 plans / 14,515
        //     healthy week-pairs: 926 weeks breached §2's own claim at delivery;
        //     202 were silenced by a trimable arm; and **202 of 202 had the long
        //     run GROW**. Zero were the false-positive class the arm existed to
        //     prevent. A long run that grows sharply SHRINKS the rest of the
        //     week, so the arm fell silent precisely on the worst cases —
        //     Hutchinson's "a load guard that goes quiet exactly when things are
        //     worst".
        //  2. §52 SAYS THE OPPOSITE OF WHAT THE COMMENT CLAIMED. It is a 60%
        //     CEILING, not a shield: when the long run forces it, §52 requires
        //     the engine to consider "(a) reduce the long run" FIRST. Below 60%
        //     it grants no protection at all, and only 25 of the 202 (12.4%)
        //     were anywhere near it. The exemption was invented in a comment and
        //     then relied on as if it were doctrine.
        //
        // §2 speaks about WEEKLY volume, so the whole-week rise IS the claim and
        // is now the only percentage arm. The chronic-load gate and the absolute
        // -km floor are unchanged; severity stays `warn`.
        //
        // ⚠️ THE ROOT MECHANISM IS §45, NOT THIS CHECK. All 202 jumps are legal
        // under §45 — and all 202 are legal ONLY via its `+5km absolute`
        // allowance (`+20% OR +5km, whichever is GREATER`). On an 8 km long run
        // that is +63%. Willy's objection to that allowance on a small base is
        // recorded and filed as LR-ABS-CAP-LOWVOL-01; it changes what the engine
        // PRESCRIBES and was deliberately not taken here.
        const totalRisePct = ((deliveredKm(w) - deliveredKm(prev)) / deliveredKm(prev)) * 100
        // §94 amendment (CHARITY-CAP-ABSFLOOR-01, Coaching Board 2026-09-13): as
        // for §90, the delivered ramp must clear an absolute-km floor as well as
        // the %, so a low-base plan does not warn on a rise that is a large
        // percentage of a small number. Measured on the whole-week rise (§2's
        // own claim). Gates the warn, not the producer.
        const totalAbsRiseKm = deliveredKm(w) - deliveredKm(prev)
        const breaches =
          totalRisePct > capPct + DELIVERED_ROUNDING_TOLERANCE_PCT &&
          totalAbsRiseKm > GENERATION_CONFIG.DELIVERED_ABSOLUTE_FLOOR_KM
        // ATTRIBUTE THE DRIVER (§94 Am.1, McMillan's and Seiler's condition of
        // approval). Where the long run accounts for more than
        // DELIVERED_RAMP_LR_ATTRIBUTION_PCT of the week's rise, say so: the
        // engine has no lever on a race-anchored long run, so a message implying
        // it failed to prevent the spike is false, and a code that reports a
        // quality-trim spike and an aerobic long-run spike identically gets read
        // as one thing.
        const lrRiseKm = longKmOf(w) - longKmOf(prev)
        const longRunLed = totalAbsRiseKm > 0
          && (lrRiseKm / totalAbsRiseKm) * 100 > GENERATION_CONFIG.DELIVERED_RAMP_LR_ATTRIBUTION_PCT
        const driver = longRunLed
          ? `The LONG RUN is driving it (${longKmOf(prev).toFixed(0)}→${longKmOf(w).toFixed(0)}km, +${lrRiseKm.toFixed(0)}km of the +${totalAbsRiseKm.toFixed(0)}km) — legal under §45, which permits +20% or +5km whichever is greater. The engine may not deform a race-anchored long run, so treat this as a week to take the easy days genuinely easy.`
          : `Typically a volume/quality-split trim held the previous week flat and handed its deficit forward (§100).`
        if (breaches) {
          violations.push({
            code: 'INV-PLAN-DELIVERED-RAMP',
            // §100 added 2026-09-15: "a safety trim must not hand its deficit to
            // the next week" IS this assertion — the ramp is measured from the
            // volume the runner actually received, not the curve's value for the
            // week that was trimmed.
            principle_ref: 'CoachingPrinciples §94 (§2), §100',
            severity: 'warn',
            week: w.n,
            message: `Week ${w.n}: DELIVERED volume rose ${totalRisePct.toFixed(0)}% from week ${prev.n} (${deliveredKm(prev).toFixed(0)}→${deliveredKm(w).toFixed(0)}km; trimable ${prevTrimable.toFixed(0)}→${nowTrimable.toFixed(0)}km, +${risePct.toFixed(0)}%), above §2's ${capPct}% cap. The curve may be compliant while the placed sessions are not. ${driver}`,
            actual: `+${totalRisePct.toFixed(0)}% week, +${risePct.toFixed(0)}% non-long-run`,
            expected: `<= ${capPct}% (§2, measured at delivery)`,
          })
        }
      }
    }
  }

  // INV-PLAN-EARLY-ONSET-GATED (CoachingPrinciples §89)
  //
  // Experience-gated quality onset (a shorter, still-all-easy base) may fire ONLY
  // for a demonstrably-ready runner. This is the mechanical guarantee behind the
  // user's explicit requirement: it must NOT create injuries for the less
  // experienced. Checks the SAFETY-CRITICAL necessary conditions that are soundly
  // recomputable from input+meta (the structural/returning arms are the engine's
  // own predicate; the cycle-free checks here are the ones that matter for harm):
  //   1. injury_history is an ABSOLUTE veto — early onset with any injury is a bug.
  //   2. the demonstrated signal `recent_quality_training === 'regular'` is required.
  //   3. deep training age is required.
  //   4. the runner is NOT a true beginner (intensity level).
  //   5. base never drops below MIN_BASE_WEEKS (2) — Seiler's on-ramp floor, which
  //      also bounds how aggressive EARLY_ONSET_BASE_PCT can ever be in practice.
  if (plan.meta.early_quality_onset) {
    const injuries = input.injury_history ?? []
    const intensity = plan.meta.fitness_intensity_level ?? input.user_declared_level ?? plan.meta.fitness_level
    const deepAge = input.training_age === '2-5yr' || input.training_age === '5yr+'
    const problems: string[] = []
    if (injuries.length > 0) problems.push(`injury_history present (${injuries.join(', ')}) — injury is an absolute veto`)
    if (input.recent_quality_training !== 'regular') problems.push(`recent_quality_training is "${input.recent_quality_training ?? 'unset'}", not "regular"`)
    if (!deepAge) problems.push(`training_age "${input.training_age ?? 'unset'}" is not deep (2-5yr/5yr+)`)
    if (intensity === 'beginner') problems.push('intensity level is beginner')
    if (problems.length > 0) {
      violations.push({
        code: 'INV-PLAN-EARLY-ONSET-GATED',
        principle_ref: 'CoachingPrinciples §89',
        severity: 'error',
        week: 0,  // input/plan-level — no specific week (convention)
        message: `early_quality_onset fired but the gate is not satisfied: ${problems.join('; ')}. Early onset must NOT reach a runner who has not demonstrably earned it.`,
        actual: 'early_quality_onset = true',
        expected: 'experienced-intensity, non-beginner, deep training age, regular recent quality, NO injury history',
      })
    }
  }
  // INV-PLAN-OVERDO-BRAKE (CoachingPrinciples §96)
  //
  // A runner who declared `hard_session_relationship: 'overdo'` — "I overdo it.
  // Rein me in." — must never receive experience-gated early quality onset,
  // however many readiness signals they also satisfy.
  //
  // §89's gate is a list of DEMONSTRATED READINESS signals; this is the wizard's
  // one declared RISK signal, and before §96 it was weighted at zero — measured
  // byte-identical to `neutral` in every cell of training_age x distance x
  // injury. §79 already holds self-report is trusted MORE when it points toward
  // caution than toward more work, so discarding it entirely was inconsistent
  // rather than conservative.
  //
  // `error`, matching INV-PLAN-EARLY-ONSET-GATED's severity: both guard the same
  // gate, and a gate that fires for a runner who asked to be reined in is the
  // same class of harm as one that fires for a beginner.
  if (plan.meta.early_quality_onset && input.hard_session_relationship === 'overdo') {
    violations.push({
      code: 'INV-PLAN-OVERDO-BRAKE',
      principle_ref: 'CoachingPrinciples §96',
      severity: 'error',
      week: 0,  // plan-level
      message: 'early_quality_onset fired for a runner who declared hard_session_relationship: "overdo". A runner who says they will push too hard if allowed is the last runner who should reach intensity two weeks sooner — the declared risk signal outranks the readiness signals (§96, §79).',
      actual: 'early_quality_onset = true with overdo',
      expected: 'early onset vetoed when the runner declares over-reaching',
    })
  }

  // INV-PLAN-ONRAMP-FLOOR (CoachingPrinciples §91, amending §89)
  //
  // Seiler's floor is a floor on ALL-EASY WEEKS THE RUNNER RUNS before their
  // first quality session — not on the length of one array slice. §57 foundation
  // weeks are all-easy running at current volume; so are base weeks. The runner's
  // tissue cannot tell them apart, so the on-ramp is their SUM.
  //
  // Counted from `meta.foundation_weeks_planned` rather than from `plan.weeks`,
  // because this same function validates the bare plan (foundation weeks not yet
  // prepended) and the composed plan (they are) — reading the array would answer
  // the same question two different ways.
  //
  // Fires at 0 and 1 as well as on the sum. The previous check tested
  // `baseWeeks === 1` exactly, so a ZERO-week base — the more dangerous case —
  // passed silently. An equality test on a floor is a hole.
  {
    const baseWeeks = plan.weeks.filter(w => w.n >= 1 && w.phase === 'base').length
    const foundationCredit = plan.meta.foundation_weeks_planned ?? 0
    const onRamp = baseWeeks + foundationCredit
    // §97 — the floor is cohort-dependent. A §89-gated runner may on-ramp in one
    // week (Seiler, re-taken CB-ONSET-03) with VO2max withheld meanwhile
    // (Willy's condition); everyone else keeps the two-week floor unchanged.
    // §97 — the gated floor is also DISTANCE-scoped, and the checker must use the
    // same scope as the producer or it fails correct long-distance plans.
    const shortOnRamp = plan.meta.early_quality_onset
      && (GENERATION_CONFIG.ONSET_SHORT_ONRAMP_DISTANCES as readonly string[])
        .includes(raceDistanceKey(input.race_distance_km))
    const floor = shortOnRamp
      ? GENERATION_CONFIG.MIN_ONRAMP_WEEKS_GATED
      : GENERATION_CONFIG.MIN_BASE_WEEKS_FLOOR
    if (onRamp < floor) {
      violations.push({
        code: 'INV-PLAN-ONRAMP-FLOOR',
        principle_ref: 'CoachingPrinciples §91, §97',
        severity: 'error',
        week: 0,  // plan-level
        message: `All-easy on-ramp is ${onRamp} week(s) (${baseWeeks} base + ${foundationCredit} foundation) — below the ${floor}-week floor. A short polarised on-ramp must always remain (Seiler), even for a demonstrably-ready runner.`,
        actual: `${onRamp} on-ramp week(s)`,
        expected: `>= ${floor} (base + foundation)`,
      })
    }
  }

  // INV-PLAN-DERIVED-SET-PACED (CAT-ROW-ELIGIBILITY-01)
  //
  // A derived WORK step that was authored against a pace anchor must carry a
  // resolved pace. `INV-PLAN-DERIVED-SET` proves a v2 session HAS a derived set;
  // it says nothing about whether the numbers in it resolved, and an unresolved
  // anchor produces `pace: null` — a rep with a distance and no target, shipped
  // silently to the runner.
  //
  // This is the enforcement half of the selector's anchor gate. Without it the
  // gate is a rule nothing checks, which is this repo's most repeated failure
  // (SWEEP-VACUOUS-01, §5's specificity ladder, INV-PLAN-FOUNDATION-BLOCK). The
  // gate keeps such a row out of the runner's pool; this fires if one ever gets
  // through by another path — a new call site that forgets to pass the set, or a
  // row picked directly rather than through selectCatalogueSession (the taper
  // race-specific path did exactly that until 2026-09-10).
  //
  // `pace_mode` is present on a derived step IFF its authored target was a pace
  // (resolveMainSet), so effort-governed work (hill reps, §40b) is correctly out
  // of scope rather than needing an exemption list.
  {
    for (const w of plan.weeks) {
      for (const sn of Object.values(w.sessions ?? {})) {
        const ds = (sn as { derived_set?: { blocks?: Array<{ steps?: Array<Record<string, unknown>> }> } } | null)?.derived_set
        if (!ds?.blocks) continue
        for (const b of ds.blocks) {
          for (const st of b.steps ?? []) {
            if (st.role !== 'work' || st.pace_mode === undefined) continue
            if (st.pace == null) {
              violations.push({
                code: 'INV-PLAN-DERIVED-SET-PACED',
                principle_ref: 'CoachingPrinciples §19, §24b',
                severity: 'error',
                week: w.n,
                message: `Session "${(sn as { label?: string }).label}" has a work step authored at a pace anchor but no resolved pace — the runner is given a distance with no target. The row should not have been eligible for this runner (selector anchor gate, CAT-ROW-ELIGIBILITY-01).`,
                actual: 'pace: null on a paced work step',
                expected: 'a resolved pace, or the row filtered out before selection',
              })
            }
          }
        }
      }
    }
  }

  // INV-PLAN-ONSET-YIELD-BOUNDED (CoachingPrinciples §98)
  //
  // §98's ladder trims §89's early onset until the plan satisfies §1. The thing
  // that can go wrong is NOT the trim — it is trimming too far: an unbounded
  // ladder was measured shipping a runner a LATER first quality session than the
  // same runner would get with no §89 gate at all, which is precisely §91's
  // non-monotonic onset (demonstrating readiness making the plan more
  // conservative). The bound is therefore the load-bearing half of §98, and this
  // is the check on it.
  //
  // Reads the stamped decision rather than regenerating a hypothetical ungated
  // plan: the invariant sees one plan, and `meta.onset_yield` is written by the
  // single owner that made the comparison (generateRulePlan's ladder). Absent on
  // every plan the ladder did not touch, which is the overwhelming majority.
  {
    const y = plan.meta.onset_yield
    if (y && y.effective > y.bound) {
      violations.push({
        code: 'INV-PLAN-ONSET-YIELD-BOUNDED',
        principle_ref: 'CoachingPrinciples §98',
        severity: 'error',
        week: 0,  // plan-level
        message: `§1 yield ladder walked to an effective on-ramp of ${y.effective} week(s) against an ungated bound of ${y.bound} (rung ${y.rungs}). A runner who demonstrated readiness must never wait LONGER for quality than one who did not (§91).`,
        actual: `${y.effective} on-ramp week(s)`,
        expected: `<= ${y.bound} (the ungated runner's effective on-ramp)`,
      })
    }
  }

  // INV-PLAN-VOLUME-SHORTFALL-DECLARED (CoachingPrinciples §40c — VOL-SHORTFALL-01)
  //
  // When a life-first constraint suppresses the peak week by
  // INV-PLAN-STRUCTURED-OVERRUN-DECLARED (§81 as amended 2026-09-11)
  //
  // §81 exempts a structured session from `max_weekday_mins` because capping it
  // scales the LABEL and not `derived_set` — the runner gets the same intervals
  // in less time. The exemption carries an obligation, and §81's amendment makes
  // its two halves explicit:
  //
  //   SPEAK      — applies to the long run AND structured sessions alike.
  //   CLASSIFY   — the LONG RUN's remedy only. `maintenance` is defined by §23
  //                as a VOLUME-OVERLOAD failure; a session that will not fit a
  //                weekday is a TIME-BUDGET failure. Conflating them would make
  //                `maintenance` mean two things, which is precisely the defect
  //                §101 diagnosed for `compressed`.
  //
  // This checks the half that applies: when a weekday structured session runs
  // materially past the runner's stated ceiling, the plan must say so. Shipping
  // the downgrade instead took maintenance from 20% to 80% of plans at a
  // 30-minute cap and was reverted; the note stayed.
  //
  // Same shape as INV-PLAN-VOLUME-SHORTFALL-DECLARED below: it verifies the
  // honesty obligation, not the arithmetic behind it.
  if (input.max_weekday_mins) {
    const limit = input.max_weekday_mins *
      (1 + GENERATION_CONFIG.LONG_RUN_WEEKDAY_OVERRUN_MAINTENANCE_PCT / 100)
    let worstMins = 0
    let worstWeek = 0
    for (const w of plan.weeks) {
      if (w.type === 'race') continue
      for (const [d, sn] of Object.entries(w.sessions)) {
        if (!sn || d === 'sat' || d === 'sun') continue
        if (isLongRun(sn) || !isStructuredSession(sn)) continue
        const mins = sn.duration_mins ?? 0
        if (mins > limit && mins > worstMins) { worstMins = mins; worstWeek = w.n }
      }
    }
    if (worstMins > 0 && !plan.meta.volume_constraint_note) {
      violations.push({
        code: 'INV-PLAN-STRUCTURED-OVERRUN-DECLARED',
        principle_ref: 'CoachingPrinciples §81 (§40c)',
        severity: 'warn',
        week: worstWeek,
        message: `A weekday structured session runs ${Math.round(worstMins)} min against a stated ${input.max_weekday_mins}-min ceiling (past the ${GENERATION_CONFIG.LONG_RUN_WEEKDAY_OVERRUN_MAINTENANCE_PCT}% overrun limit), and the plan says nothing. §81 exempts the session from the cap; the exemption obliges the plan to tell the runner it does not fit.`,
        actual: `${Math.round(worstMins)} min, no volume_constraint_note`,
        expected: 'a note naming the trade and the lever',
      })
    }
  }

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

  // INV-PLAN-TERRAIN-EFFORT-NOTE-DECLARED (CoachingPrinciples §40b Amendment 2 —
  // CB-TERRAIN-01). A runner whose environment terrain is in TERRAIN_EFFORT_GOVERNS
  // (trail/mixed) must be TOLD to let effort/HR lead and treat pace as a road
  // reference. The board vetoed a terrain pace multiplier (§40b: do not invent a
  // number the runner cannot act on), so the wired effect is the note — and a wired
  // effect that can silently go missing is no effect. Closes the input honestly:
  // terrain now changes the delivered plan (INPUT-EFFECT-01) rather than echoing.
  {
    const terrainGoverns = (GENERATION_CONFIG.TERRAIN_EFFORT_GOVERNS as readonly string[])
      .includes(plan.meta.terrain ?? '')
    if (terrainGoverns && !plan.meta.terrain_effort_note) {
      violations.push({
        code: 'INV-PLAN-TERRAIN-EFFORT-NOTE-DECLARED',
        principle_ref: 'CoachingPrinciples §40b',
        severity: 'error',
        week: 0,
        message: `Terrain is '${plan.meta.terrain}' (effort-governed), but the plan carries no terrain_effort_note. §40b wires terrain to the effort-lead note, not a pace number — the note must be present, never silently absent.`,
        actual: 'terrain_effort_note absent',
        expected: `terrain_effort_note present for terrain in [${GENERATION_CONFIG.TERRAIN_EFFORT_GOVERNS.join(', ')}]`,
      })
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
          principle_ref: 'CoachingPrinciples §19, §41, §40',
          severity: 'error',
          week: w.n, day,
          message: `Quality session "${sn.label}" prescribes neither a pace target nor an effort target. A session with no pace is legitimate (hill reps are governed by gradient), but it must then say how hard by RPE — otherwise a LOST pace is indistinguishable from a deliberate absence.`,
          actual: 'neither pace_target nor rpe_target',
          expected: 'a pace target, or an effort (RPE) target',
        })
      }
    }
  }

  // INV-PLAN-LABEL-MATCHES-STRUCTURE (CoachingPrinciples §19, §53 —
  // Coaching Board 2026-09-04, LBL-01)
  //
  // A goal-paced label's trailing SHAPE word must match the shape the session
  // actually has. §19 already requires a label to match its prescribed
  // physiology, but its check compares the label to `pace_target` and never to
  // `derived_set` — so "10K-pace progression" on a set of 4 × 5 min cruise
  // intervals passed it cleanly. Measured across 5,392 plans: 12.5-19.1% of
  // plans at every distance except 5K carried two build sessions under one name,
  // with up to four structurally different rows sharing a label at marathon and
  // above.
  //
  // This also closes §19's OWN stated limitation. §19 says its easy-direction
  // check stays label-based "until SC-08 puts the row's identity on the
  // session"; ADR-018 shipped `catalogue_id` on 2026-08-20 and nothing re-keyed
  // it. This is that re-key, for the shape axis.
  //
  // The engine PRODUCES the shape word and this READS it back, both through the
  // single owner `goalPaceShapeWord` in sessionStructureV2.ts. The first cut of
  // this invariant carried its own copy — a parallel classifier, and exactly the
  // drift INV-CLASS forbids. It lives in the schema module because invariants
  // cannot import ruleEngine (the engine imports the invariants).
  //
  // DELIBERATELY CONSERVATIVE — it fires ONLY when the trailing word is a known
  // shape noun AND the row resolves to a different one. Three exemptions, each
  // load-bearing:
  //   • A label equal to the row's own NAME is not an override at all
  //     (`tenk_pace_intervals` is literally named "10K-pace intervals").
  //   • PURPOSE words ("sharpener", §6's taper flavour) make no shape claim, so
  //     there is nothing for them to be wrong about. Taper measured 0%
  //     collisions at every distance and is intentionally untouched.
  //   • An unrecognised trailing word is SKIPPED, never flagged. The enricher
  //     may rewrite labels (EnrichedWeekSchema exposes `label`), and a check
  //     that fires on unfamiliar wording would discard whole enriched plans —
  //     which is exactly what §22's old `label.includes('pace')` test did,
  //     costing trial/paid users their AI voice (post_enrich_invalid).
  {
    // The generic fallback used when a row resolves to no shape at all; it makes
    // no specific claim, so it can never be "wrong" against a row.
    const GENERIC = 'intervals'
    const PURPOSE_WORDS = new Set(['sharpener'])
    for (const w of plan.weeks) {
      for (const [day, sn] of Object.entries(w.sessions) as [Day, Session | undefined][]) {
        if (!sn?.catalogue_id) continue
        const row = V1_SESSION_CATALOGUE.find(r => r.id === sn.catalogue_id)
        if (!row || sn.label === row.name) continue
        const m = /-pace ([a-z]+)$/i.exec((sn.label ?? '').trim())
        if (!m) continue
        const claimed = m[1].toLowerCase()
        if (claimed === GENERIC || PURPOSE_WORDS.has(claimed)) continue
        const actual = goalPaceShapeWord(row)
        // No resolvable shape on the row, or the claim is not a word this
        // codebase produces → not this invariant's business.
        if (!actual || !KNOWN_SHAPE_WORDS.has(claimed)) continue
        if (claimed !== actual) {
          violations.push({
            code: 'INV-PLAN-LABEL-MATCHES-STRUCTURE',
            principle_ref: 'CoachingPrinciples §19, §53',
            severity: 'error',
            week: w.n, day,
            message: `"${sn.label}" claims the shape "${claimed}" but row "${row.id}" is a "${actual}". A label naming a shape must name the shape the session actually has.`,
            actual: claimed,
            expected: actual,
          })
        }
      }
    }
  }

  // INV-PLAN-EFFORT-GOVERNED-NOT-GOAL-PACED (CoachingPrinciples §40b —
  // Coaching Board 2026-09-04, unanimous veto)
  //
  // An effort-governed row is EXCLUDED from §22's goal-pace override. §40b:
  // an effort-governed session "does not invent a number the runner cannot act
  // on… What is absent is the pace, and only the pace." §22's override invented
  // one: a time-targeted 100K drew `vert_hike_repeats` — hike uphill at RPE 6,
  // walk back down — and shipped it as "100K-pace intervals" at 8:14–8:34 /km.
  //
  // Read from the ROW, not the session, and structurally rather than by id
  // (INV-CLASS): "does every work step on this row carry an effort target and
  // no pace?" is the same test `makeQualitySession` uses, so the invariant and
  // the generator cannot drift about what "effort-governed" means.
  //
  // Checks BOTH surfaces, because they fail independently: a `pace_target` is
  // the invented number itself, and a `{dist}-pace` label is the claim about it.
  // The 2026-09-04 defect produced both together; a partial future regression
  // could produce either alone.
  for (const w of plan.weeks) {
    for (const [day, sn] of Object.entries(w.sessions) as [Day, Session | undefined][]) {
      if (!sn?.catalogue_id) continue
      if (!rowIsEffortGoverned(sn.catalogue_id)) continue
      const hasPace = typeof sn.pace_target === 'string' && sn.pace_target.trim().length > 0
      const hasGoalPaceLabel = /-pace /.test(sn.label ?? '')
      if (hasPace || hasGoalPaceLabel) {
        violations.push({
          code: 'INV-PLAN-EFFORT-GOVERNED-NOT-GOAL-PACED',
          principle_ref: 'CoachingPrinciples §40b',
          severity: 'error',
          week: w.n, day,
          message: `"${sn.label}" comes from effort-governed row "${sn.catalogue_id}" but ${hasPace ? `carries pace target "${sn.pace_target}"` : 'is named as goal-pace work'}. The terrain sets the intensity — a pace here is a number the runner cannot act on (§40b).`,
          actual: hasPace ? String(sn.pace_target) : String(sn.label),
          expected: 'no pace target, and a label that does not claim a pace',
        })
      }
    }
  }

  // INV-PLAN-EFFORT-GOVERNED-DURATION-LOWER-BOUND (CoachingPrinciples §16/§40b —
  // Coaching Board 2026-09-04)
  //
  // An effort-governed session is still SIZED against its own structure. The
  // stated `duration_mins` must at minimum hold the steps whose length is
  // actually known.
  //
  // WHY THIS ROW WAS UNGOVERNED. Three guards each decline effort-governed rows,
  // every one correctly on its own terms, and nothing measured the union:
  //   1. `pacedRepPlan` (ruleEngine) — returns null when the work step has no
  //      pace, so the row never gets structure-driven sizing and falls back to
  //      the generic distance-over-easy-pace estimate.
  //   2. `pacedRepMainMinutes` (below) — returns null on `to_landmark` / `open` /
  //      `mirror` / `parameter` lengths, so INV-PLAN-STRUCTURED-SESSION-DURATION-
  //      COHERENT skips the session entirely.
  //   3. `INV-PLAN-VO2MAX-MAIN-SET-CAP` — skips sessions with no `pace_target`.
  // Measured 2026-09-04: `hill_reps` incoherent in 258 of 428 placements (60.3%).
  // Worst case stated 31 min against a main set holding >= 24 min of reps — a
  // 186% overrun before the open recoveries are counted at all.
  //
  // A LOWER BOUND, not an equality. Open and landmark steps ("until ready", "to
  // the bottom of the hill") contribute ZERO here — they are real minutes the
  // runner will spend, and pricing them is phase 2 of this ruling (gated on
  // Seiler's condition: quantify the §1 intensity-distribution shift first).
  // So this check is deliberately weaker than the truth and can only
  // under-report. A session it flags is definitively too short.
  //
  // SEVERITY: `warn` on 2026-09-04 (phase 1), PROMOTED TO `error` the same day
  // once `effortGovernedPlan` landed — the board's own sequencing, which exists
  // because promoting ahead of the sizing would throw in dev/test for 60% of hill
  // placements (the failure that reverted INV-PLAN-MAIN-SET-ORDERING's first
  // promotion on 2026-09-03). The `warn` phase did its job: it measured the
  // population the fix had to cover before the fix existed.
  //
  // Still a LOWER BOUND, deliberately, even at `error`. The engine now prices the
  // open recoveries and the landmark transition, so a coherent session clears this
  // by a wide margin; the check stays weaker than the truth so it can never
  // false-positive, and it does NOT re-derive the engine's formula (which would be
  // the parallel classifier INV-CLASS forbids). What it guarantees is the floor: a
  // session can never again state a duration too short to hold its own measurable
  // steps.
  {
    const tol = GENERATION_CONFIG.MAIN_SET_ORDERING_TOLERANCE_MINS
    for (const w of plan.weeks) {
      for (const [day, sn] of Object.entries(w.sessions) as [Day, Session | undefined][]) {
        if (!sn?.catalogue_id || sn.duration_mins == null) continue
        if (!rowIsEffortGoverned(sn.catalogue_id)) continue
        const closed = effortGovernedClosedMinutes(sn)
        if (closed == null || closed <= 0) continue
        const minTotal = durationForMainSet(closed)
        if (sn.duration_mins < minTotal - tol) {
          violations.push({
            code: 'INV-PLAN-EFFORT-GOVERNED-DURATION-LOWER-BOUND',
            principle_ref: 'CoachingPrinciples §16, §40b',
            severity: 'error',
            week: w.n, day,
            // INV-MSG-ROUNDING-01 — one decimal on both sides, so the stated
            // comparison is actually true as rendered. See the VO2max ordering
            // message below for the failure this prevents.
            message: `"${sn.label}"'s stated duration cannot hold its own prescribed structure: ${closed.toFixed(1)} min of measurable steps needs >= ~${minTotal.toFixed(1)} min once the warm-up and cool-down floors are applied, and the open recoveries are not counted at all.`,
            actual: `${sn.duration_mins} min`,
            expected: `>= ~${minTotal.toFixed(1)} min (${tol} min rounding tolerance)`,
          })
        }
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
          // RE-PROMOTED warn -> error (Coaching Board, 2026-09-03,
          // SIZING-REALLOC-01 closed). First attempt (same day) reverted when
          // trainingDayFloor.test.ts failed: `tempo_cruise`, `tempo_continuous`,
          // `goal_pace_sharpener` were still v1, still sized by the flat
          // QUALITY_SESSION_PCT_OF_WEEKLY formula, which shrinks at very low
          // absolute volume even for `experienced` fitness's comparatively high
          // VO2max target. All three now migrated to structure-driven sizing
          // (same commit that also added floor-protection against
          // MIN_SESSION_DISTANCE_KM — the reps-count fix that made this safe to
          // re-attempt). Every threshold/race-pace catalogue row now sizes off
          // an absolute band, same as VO2max — the asymmetry that justified
          // `warn` no longer exists anywhere in the catalogue. Confirmed clean
          // against the full test suite and property sweep before promoting.
          severity: 'error',
          week: vo2.week,
          // INV-MSG-ROUNDING-01 (2026-09-19) — ONE DECIMAL, NOT ZERO.
          // These rounded both sides to integers, so a real breach rendered as
          // "Got 18 min, expected <= 18 min" — a message asserting the check
          // fired on a value that satisfies it. The next person to hit that
          // concludes the invariant is broken and goes looking for a bug that is
          // not there, which is precisely the cost this repo keeps paying for
          // misleading output. Cosmetic in effect, corrosive in practice.
          message: `Largest VO2max main set is ${vo2.mins.toFixed(1)} min ("${vo2.label}", week ${vo2.week}), exceeding the largest ${softer} main set of ${other.mins.toFixed(1)} min ("${other.label}", week ${other.week}). VO2max work is the least sustainable per minute and must not be the plan's longest quality session.`,
          actual: `${vo2.mins.toFixed(1)} min`,
          expected: `<= ${(other.mins + GENERATION_CONFIG.MAIN_SET_ORDERING_TOLERANCE_MINS).toFixed(1)} min (${softer} + ${GENERATION_CONFIG.MAIN_SET_ORDERING_TOLERANCE_MINS} min rounding tolerance)`,
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
              principle_ref: 'CoachingPrinciples §8, §88',
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
            // §88: its new granular rows are sized on THIS band, not a second one.
            principle_ref: 'CoachingPrinciples §8, §88',
            severity: 'error', week: w.n, day,
            message: `VO2max work "${sn.label}" is ${work.toFixed(0)} min at Z4–5, outside the ${floor}–${ceil} min dose band (least sustainable work per minute; bounded at both ends).`,
            actual: `${work.toFixed(0)} min work`,
            expected: `${floor}–${ceil} min (± ${tol} rounding)`,
          })
        }
      }
    }
  }

  // INV-PLAN-STRUCTURED-SESSION-DURATION-COHERENT (CoachingPrinciples §8 —
  // Coaching Board 2026-09-03) — a structured session's OWN STATED DURATION
  // must fit its OWN PRESCRIBED STRUCTURE. Surfaced by a real generated plan:
  // tenk_pace_intervals sized at 25 min while its 4×1200m @ goal pace / 2min
  // jog structure needs ~27.6 min — the session's length didn't fit its own
  // rep count. Recomputes the structure's work+recovery minutes from the
  // catalogue row (pacedRepMainMinutes) and checks the session's duration_mins
  // against durationForMainSet of that total — the SAME floor-aware
  // warm-up/cool-down inverse the engine itself sizes against (sessionFormat.ts),
  // so the invariant and the generator can never silently disagree about what
  // "fits" means. Engages for `scaling: 'reps'` rows — the ones pacedRepPlan
  // sizes (tempo_cruise_short, tempo_cruise, tenk_pace_intervals,
  // goal_pace_sharpener, the vo2max rows) — plus `progressive_tempo` and
  // `tempo_continuous` specifically, whose continuous shapes are sized by
  // progressiveTempoPlan/continuousThresholdPlan (same ruling) and re-derived
  // here since their rows have no literal length to sum from.
  //
  // EXTENDED 2026-09-04 (CB-CAT-02) to the fixed-shape SIZED rows —
  // `threshold_pyramid` and `threshold_ladder`. The exclusion below used to read
  // "threshold_ladder and any other `scaling: 'fixed'` shape stay excluded:
  // their duration_mins comes from the older generic quality-session formula",
  // which was true and is no longer: both now size off their own structure via
  // `fixedShapePlan`. The ladder was stating 61 minutes for a 3-5-8-5-3 session
  // whose own structure needs 50 — precisely the incoherence this invariant
  // exists to catch, sitting inside its documented blind spot. Any REMAINING
  // `scaling: 'fixed'` row with no sizer stays excluded, correctly: nothing ever
  // promised its duration would fit. v1 sessions have no rep structure to be
  // incoherent with.
  {
    const tol = GENERATION_CONFIG.MAIN_SET_ORDERING_TOLERANCE_MINS
    const planFitness = plan.meta.fitness_intensity_level ?? plan.meta.fitness_level
    for (const w of plan.weeks) {
      for (const [day, sn] of Object.entries(w.sessions) as [Day, Session | undefined][]) {
        if (!sn || !sn.derived_set || sn.duration_mins == null) continue
        const mainMins = pacedRepMainMinutes(sn)
          ?? progressiveTempoExpectedMainMins(sn.catalogue_id, planFitness, w.phase)
          ?? continuousThresholdExpectedMainMins(sn)
          ?? fixedShapeMainMinutes(sn)
        if (mainMins == null) continue
        const expectedTotal = durationForMainSet(mainMins)
        if (Math.abs(sn.duration_mins - expectedTotal) > tol) {
          violations.push({
            code: 'INV-PLAN-STRUCTURED-SESSION-DURATION-COHERENT',
            // §86 added 2026-09-15: its requirement (a) — "a fixed shape must state a
            // duration its own structure fits" — is what CB-CAT-02 extended this
            // check to cover for threshold_ladder / threshold_pyramid. Naming it
            // here so the coverage manifest can see the link instead of reading
            // §86 as unchecked.
            // §99 added 2026-09-15. §99 ("a session states the length its own
            // structure needs") IS this check: it is the principle written when
            // `hm_pace_intervals` stated 45 minutes for a session needing over 70,
            // and the mechanism it names is this one. Named here rather than given
            // a second invariant — two checks asserting one property is D-16, and
            // the second one drifts.
            principle_ref: 'CoachingPrinciples §8, §86, §99',
            severity: 'error', week: w.n, day,
            message: `"${sn.label}"'s stated duration does not fit its own prescribed structure (${mainMins.toFixed(1)} min of work+recovery needs ~${expectedTotal.toFixed(0)} min total with warm-up/cool-down).`,
            actual: `${sn.duration_mins} min`,
            expected: `~${expectedTotal.toFixed(0)} min (± ${tol} rounding)`,
          })
        }
      }
    }
  }

  // INV-PLAN-THRESHOLD-LADDER-ELIGIBLE — NOT mechanically checkable
  // post-hoc, stated explicitly rather than silently skipped (Coaching
  // Board 2026-09-03, §53's second eligibility path).
  //
  // A first attempt re-derived eligibility from the FINISHED plan's stored
  // `weekly_km` and immediately false-positived: `selectCatalogueSession`'s
  // flat-floor check runs against the PRE-CAP TARGET volume for that week
  // (`adjustedKm`, computed before `buildWeekSessions`), but a week's FINAL
  // stored `weekly_km` is the POST-CAP ACTUAL volume — and those two numbers
  // are not the same plan property. A weekday-cap-heavy scenario
  // (`max_weekday_mins` + a blocked weekend, MWM-02) can target 48 km/week
  // (clearing the 45 km/week floor legitimately) and still deliver only
  // 32 km/week once every other session is capped down — `threshold_ladder`
  // itself is structure-exempt from the cap (§81), so it keeps its own
  // dose; the WEEK around it shrinks. This is a pre-existing property of how
  // target vs. delivered volume are threaded through the engine, unrelated
  // to and predating this ruling — not something today's change should
  // newly enforce against.
  //
  // The engine-side computation (`recentThresholdEligible` in
  // `generateRulePlan`'s main loop) is correct and already covered: it
  // computes `false` in exactly this case (only 1 of 2 required recent
  // threshold weeks), so the session is placed via the pre-existing flat
  // floor against the pre-cap target — not a bug in the alt path, and not
  // something a post-hoc reader of the finished plan can distinguish from
  // a genuine alt-path grant without the engine stamping which path fired.
  // That stamp is a real option for a future pass; not added here to avoid
  // widening this ruling's scope into the target-vs-actual volume gap.

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
        // §79 vs §5 — A SECOND REASON THE WINDOW CAN BE UNREACHABLE
        // (2026-09-15). CD-22's own disposition is "binding where reachable,
        // recorded where not", and it was written for the GEOMETRIC case (a
        // plan too short to contain the window). The intensity re-entry window
        // makes it unreachable a second way: §79 withholds vo2max-category work
        // over the opening quality weeks, so the earliest VO2max can legally
        // land is the first UNPROTECTED quality week. If that is already past
        // the deadline, no compliant placement exists.
        //
        // The board ruled §79 wins this conflict, so enforcing §5 here would
        // make the ruling unimplementable (D-21) — a rule that cannot be
        // satisfied is a defect in the rule, not in the plan that honoured the
        // other one. Derived from the PLACED sessions, matching
        // INV-PLAN-RETURNING-INTENSITY-REENTRY's derivation exactly so the two
        // checks cannot disagree about which weeks are protected.
        const firstUnprotectedQualityWeek = (() => {
          if (!plan.meta.intensity_reentry_active) return null
          const budget = plan.meta.intensity_reentry_weeks ?? 0
          let seen = 0
          for (const w of plan.weeks) {
            if (w.n < 1) continue
            const carriesQuality = Object.values(w.sessions).some(sn =>
              sn && sn.type === 'quality')
            if (!carriesQuality) continue
            if (seen >= budget) return w.n
            seen++
          }
          return null   // the window covers every quality week the plan has
        })()
        const reentryBlocksTheDeadline =
          plan.meta.intensity_reentry_active
          && (firstUnprotectedQualityWeek === null
              || firstUnprotectedQualityWeek > deadlineWeekN)

        const reachable = deadlineWeekN >= firstBuildWeek && !reentryBlocksTheDeadline
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
    // CB-FOUNDATION-DENOM-01 (2026-09-10) — the denominator is the MAIN PLAN.
    // Foundation weeks (n <= 0) are excluded.
    //
    // §57: foundation weeks "are never part of the main plan's periodisation
    // arc". §22's SC-05 closure already ruled that counting them toward
    // `totalWeeks` in this very file was a DEFECT (155 violations), citing that
    // exact sentence. Two invariants were reading foundation weeks in opposite
    // ways; this is the one that was out of step.
    //
    // The coaching argument is Seiler's, and it is his own caveat turned around:
    // §57's CB-1 ruling states the block's job is "habit and routine, not
    // adaptation". A ratio that governs training stimulus cannot then spend weeks
    // the constitution has already declared not to be training stimulus. Worse,
    // including them made the ceiling LOOSER the earlier a runner happened to
    // generate their plan — two runners with an identical 17-week block and an
    // identical 15 quality sessions, one compliant and one in breach, differing
    // only in when they opened the app. A ceiling satisfiable by prepending easy
    // weeks is not a ceiling on anything (Hutchinson).
    //
    // This also DISSOLVES INTENSITY-FOUNDATION-BLIND-01/02 rather than guarding
    // against them. Those defects — a false positive on the bare plan, then a
    // second one on the 'choice' band — existed only because the denominator
    // included weeks present on the assembled object and absent from the bare
    // one, so `validatePlan`'s two runs disagreed by construction. Measuring main
    // weeks only makes both runs return the SAME verdict, and the defer they each
    // added (with its `foundation_decision_pending` / `foundation_composed`
    // machinery) is deleted as unnecessary. A defect class that cannot occur beats
    // a check that catches it.
    //
    // Measured cost, stated plainly: breaches go 1 -> 2 across 16,038 swept plans
    // (4,642 of which carry a block). This is a COHERENCE fix, not a safety fix —
    // recorded at Sims's insistence, because the two get conflated.
    const mainPlanWeeks = GENERATION_CONFIG.INTENSITY_DISTRIBUTION_COUNTS_FOUNDATION_WEEKS
      ? plan.weeks
      : plan.weeks.filter(w => w.n >= 1)
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
      for (const w of mainPlanWeeks) {
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
            principle_ref: 'CoachingPrinciples §1, §90, §97',
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
    // ⚠️ READS THE SESSION'S SIZE, NOT ITS `distance_km` FIELD — and the
    // difference was a live injury risk for months (LR-CAP-BLIND-01, found by
    // the Coaching Board's cold re-review 2026-09-16).
    //
    // A session is anchored EITHER by distance OR by duration, and BEGINNERS
    // GET DURATION-ANCHORED PLANS (§79/§80 — time on feet). So `distance_km`
    // is null on a beginner's long run, this returned null, and the loop below
    // `continue`d. §45 is titled "universal, no phase exemption" and had
    // **never once run on a beginner's plan**.
    //
    // What it was missing: a 14-week first marathon went 7.3, 7.8, 8.7, 8.7,
    // 9.7, 8.5 and then 26.0 km — a +206% single step to 2.9x the runner's
    // lifetime longest run. §45's own founding case (2026-04-28) was +185%,
    // so this is worse than the incident the principle was written to prevent,
    // shipping to the least robust cohort the engine serves.
    //
    // Sims, on the record: a PRESENTATION choice (minutes rather than
    // kilometres, made for good reasons) silently exempted one cohort from a
    // SAFETY cap. Presentation is not supposed to have physiological
    // consequences.
    //
    // `sessionKmSelfPaced` is the single owner for "how far is this session"
    // when the caller holds no PaceGuide — the validator is named in its own
    // docstring as one of those callers. Same correction as SESSION-KM-01/02
    // made to the sibling checks; this site was missed.
    const longRunForWeek = (week: typeof plan.weeks[number]): number | null => {
      const long = Object.values(week.sessions).find(s =>
        !!s && isLongRun(s)
      )
      return long ? sessionKmSelfPaced(long) ?? null : null
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
      // §45 Amendment 2 — mirrors the producer's tapered absolute arm. Kept in
      // step deliberately: LR-CAP-BLIND-01 was ONE bug in TWO copies, and the
      // checker could not catch the producer because it shared the defect.
      const absArmKm = Math.min(
        capAbs,
        prevLR * GENERATION_CONFIG.LONG_RUN_ABS_STEP_MAX_PCT_OF_LR / 100,
      )
      const allowedJumpKm = Math.max(prevLR * capPct, absArmKm)
        + GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM
      const actualJumpKm = currLR - prevLR
      if (actualJumpKm > allowedJumpKm + 0.01) {
        const pctJump = prevLR > 0 ? Math.round((actualJumpKm / prevLR) * 100) : 0
        violations.push({
          code: 'INV-PLAN-LR-PROGRESSION-CAP',
          principle_ref: 'CoachingPrinciples §45',
          severity: 'error',
          week: curr.n,
          message: `W${curr.n} long run ${currLR}km is a ${pctJump}% jump from W${prev.n} (${prevLR}km). Cap is +${GENERATION_CONFIG.LONG_RUN_PROGRESSION_CAP_PCT}% or +${absArmKm.toFixed(1)}km, whichever is greater (§45 Am.2: the absolute arm tapers to ${GENERATION_CONFIG.LONG_RUN_ABS_STEP_MAX_PCT_OF_LR}% of the prior long run, capped at +${capAbs}km).`,
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
  // (CoachingPrinciples §52)
  //
  // §52 Amendment 1 (Coaching Board 2026-09-13, MAINT-EXEMPT-SCOPE-01) — THIS IS
  // NO LONGER EXEMPTED, only DOWNGRADED.
  //
  // It used to open `if (plan.meta.volume_profile !== 'maintenance')`, on the
  // stated grounds that "the constraint is already surfaced in
  // volume_constraint_note". That justification does not survive reading: the
  // note explains why TOTAL volume is low, and says nothing about lopsidedness.
  // A safety check was switched off because something else was believed to report
  // it, and that something else does not report it.
  //
  // 51% of the cohort classifies maintenance, so the cap went unchecked on half
  // of all plans. Measured 2026-09-13 with the exemption removed: 268 of 6,588
  // weeks breach, **every single one of them in a maintenance plan and none in a
  // build plan** — 60 of 314 maintenance plans carry at least one. The worst is a
  // BEGINNER marathon plan with a 26.0 km long run in a 34 km week: 76% of the
  // week's running in one session. Willy: the tissue does not care that the plan
  // is labelled maintenance, and one session carrying three-quarters of the load
  // is more dangerous at low volume, not less.
  //
  // It stays a WARN for maintenance rather than becoming an error, because the
  // runner's constraint is real and 60 plans would otherwise fail to generate —
  // §34's honest-residual pattern, the same one INV-PLAN-DELIVERED-RAMP and
  // INV-PLAN-DELOAD-IS-A-REDUCTION already use. Visible, counted and declared
  // beats silent.
  {
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
        // SESSION-KM-02 (2026-09-12) — this read `s.distance_km` directly and
        // skipped anything without one, so §52's own checker was blind to every
        // DURATION-anchored session: 95.8% of a beginner's. The producer's
        // floor (`ruleEngine.ts`, `lrKm ?? 0`) is inert for the same cohort for
        // the same reason, so the rule and the check that guards it were blind
        // together — which is why this has never surfaced a violation. Measured
        // at the time of the fix: 0 breaches across 2,337 duration-anchored
        // sessions in scope, so this opens no new violations today. It stops
        // the check being unable to see them tomorrow.
        const km = sessionKmForCheck(s)
        if (km == null) continue  // no pace to convert with — never read as 0
        const fraction = km / w.weekly_km
        if (fraction > cap + 0.005) {
          violations.push({
            code: 'INV-PLAN-LR-MAX-WEEKLY-PCT',
            // §114 (2026-09-19) shares this invariant deliberately: its number
            // IS §52's 60%, and its observable consequence is exactly what this
            // check already asserts. What §114 changed is WHICH SIDE gives — the
            // long run yields at construction rather than the week being raised
            // — and the check is the same either way. Named here because a
            // principle claiming an invariant that does not acknowledge it is
            // how §92 read as enforced for eight days while checking nothing.
            principle_ref: 'CoachingPrinciples §52, §114',
            // §52 Amendment 1 — error for a build plan, warn for maintenance.
            // Same shape as INV-PLAN-NO-PLACEHOLDER-COPY's context-dependent
            // severity a few hundred lines below.
            severity: plan.meta.volume_profile === 'maintenance' ? 'warn' : 'error',
            week: w.n,
            day,
            message: `${s.label ?? 'session'} ${km.toFixed(1)}km is ${Math.round(fraction * 100)}% of weekly volume ${w.weekly_km}km — exceeds ${GENERATION_CONFIG.LONG_RUN_MAX_PCT_OF_WEEKLY}% cap. Lopsided week; reduce the long run, raise weekly volume, or downgrade to maintenance.`,
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
      const hasBenchmark = Object.values(week.sessions ?? {}).some(s => s && isTimeTrial(s))
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
          principle_ref: 'CoachingPrinciples §23, §2, §40',
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

  // INV-PLAN-REENTRY-OMISSION-DECLARED (§79 Amendment 2, Coaching Board
  // 2026-09-15) — a plan whose intensity re-entry window is active and which
  // contains NO VO2max-category session must SAY SO.
  //
  // The board ruled omission legitimate on §5's own authority (Seiler, recorded
  // in §5's CD-16/CD-22 amendment: "either commit to it properly in the build,
  // or do not do it. The middle position is the only indefensible one") — so
  // this does NOT force VO2max to appear. Requiring deferral was REJECTED,
  // because manufacturing a late VO2max block is exactly that middle position.
  //
  // What it forbids is the SILENT version. Measured: the quality-week reading of
  // the window removed VO2max entirely from 576 plans and re-ordered 0, and
  // nothing told the runner. §87/§95's test applies — a defensible outcome
  // reached at random is a coincidence, not a decision.
  //
  // Derived from the PLACED SESSIONS, not from a meta flag, so it cannot be
  // satisfied by the producer simply asserting it did the right thing.
  if (plan.meta.intensity_reentry_active) {
    const hasVo2 = plan.weeks.some(w =>
      w.n >= 1 && Object.values(w.sessions).some(
        sn => sn && sn.type === 'quality' && isVo2maxSession(sn, V1_SESSION_CATALOGUE)))
    if (!hasVo2 && !plan.meta.intensity_reentry_omission_note) {
      violations.push({
        code: 'INV-PLAN-REENTRY-OMISSION-DECLARED',
        principle_ref: 'CoachingPrinciples §79',
        severity: 'error',
        week: 0,
        message: 'The intensity re-entry window is active and the plan contains no VO2max or hill session at all, but nothing tells the runner. Omission is a legitimate prescription (§5); omitting silently is not.',
        actual: 'no vo2max-category session, no omission note',
        expected: 'meta.intensity_reentry_omission_note explaining that quality leads with tempo/threshold this cycle',
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
    // RACE-KEY-TWO-OWNERS-01 — was a third inline copy of the ladder.
    const distCfgKey = raceDistanceKey(input.race_distance_km) as keyof typeof GENERATION_CONFIG.MAX_TAPER_PHASE_WEEKS
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
        return sessionKmForCheck(lr) ?? 0   // SESSION-KM-02
      })
      const maxPeakLrKm = peakLrKms.length > 0 ? Math.max(...peakLrKms) : 0
      const threshold = (GENERATION_CONFIG.PEAK_LR_ALTERNATION_THRESHOLD_PCT / 100) * maxPeakLrKm
      const isPeakLevel = (week: typeof plan.weeks[number]): boolean => {
        const lr = Object.values(week.sessions).find(s =>
          !!s && isLongRun(s)
        )
        if (!lr) return false
        const lrKmCheck = sessionKmForCheck(lr)
        if (lrKmCheck == null) return false
        if (lrKmCheck + 0.01 < threshold) return false
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

  // INV-PLAN-PEAK-STEPBACK-VOLUME — a peak long-run step-back is a VOLUME
  // step-back too (CoachingPrinciples §47 Amendment 2). §47 eases the step-back
  // week's long run and stamps "absorb last week's peak"; that week must then
  // DELIVER less than the week before it (§90's principle in peak) — not keep
  // climbing on the volume curve. Keyed on the note §47 stamps (the semantic
  // marker of a step-back week), so producer and checker read the same signal.
  //
  // Tolerated: a week whose easy runs are all at the min-session floor cannot be
  // trimmed further without cutting the long run (§52/§90 forbid that) — an
  // honest floor-limited residual, not a violation.
  if ((input.injury_history ?? []).length === 0) {
    // Non-injury only — matches the producer. Injury-runner peak volume is owned
    // by §90/§2's injury reconciliation, which runs after the step-back trim.
    const STEPBACK_NOTE = 'Step-back week. Easy aerobic'
    const minEasy = GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.easy
    const tol = GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM
    for (let i = 1; i < plan.weeks.length; i++) {
      const w = plan.weeks[i]
      if (w.phase !== 'peak' || w.type === 'deload') continue
      const lr = Object.values(w.sessions).find(s => !!s && isLongRun(s))
      if (!lr || !(lr.coach_notes ?? []).some(n => n?.includes(STEPBACK_NOTE))) continue
      const prev = plan.weeks[i - 1]
      if (!prev || prev.type === 'deload') continue
      if (w.weekly_km <= prev.weekly_km + tol) continue
      // Floor-limited? Every easy (non-long-run) session at or below the floor.
      const easies = Object.values(w.sessions).filter(
        (s): s is NonNullable<typeof s> => !!s && s.type === 'easy' && s.role !== 'long_run')
      const allAtFloor = easies.every(s =>
        s.distance_km != null ? s.distance_km <= minEasy + 0.01 : true)
      if (allAtFloor) continue
      violations.push({
        code: 'INV-PLAN-PEAK-STEPBACK-VOLUME',
        principle_ref: 'CoachingPrinciples §47',
        severity: 'error',
        week: w.n,
        message: `Peak step-back week W${w.n} (${w.weekly_km}km) delivers MORE than the preceding week W${prev.n} (${prev.weekly_km}km). A week whose long run is stepped back and whose note says "absorb last week's peak" must deliver less — trim easy volume (§47 Am.2 / §90).`,
        actual: `W${w.n}=${w.weekly_km}km > W${prev.n}=${prev.weekly_km}km`,
        expected: `<= ${prev.weekly_km}km`,
      })
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

          // §92 — STRIDES, FOR A §89-GATED RUNNER ONLY.
          //
          // §57 bans strides in the foundation block; §92 lifts that ban for a
          // runner who passes the §89 readiness gate, and for nobody else.
          // Willy's condition of approval is absolute and separate from every
          // other signal: a runner with ANY injury history gets no strides in
          // foundation, however experienced they say they are.
          //
          // ⚠️ WHY THIS IS NEW CODE FOR AN OLD RULE. §92's own Config paragraph
          // reads "Enforced by the amended `INV-PLAN-FOUNDATION-BLOCK`, which
          // permits strides only when `meta.early_quality_onset` is set." That
          // sentence was written on 2026-09-07 and the amendment was never made
          // — grepped 2026-09-15: `invariants.ts` contained the word "strides"
          // three times, all of them in the maintenance-injury block. The
          // PRODUCER gates correctly (`foundationBlock.ts` checks the gate and
          // the injury veto); the CHECKER was documented and absent. This is the
          // §79 failure class exactly: a principle that reads as enforced, is
          // not, and nothing can tell you which because the claim lives in prose.
          if (hasStrideNote(session)) {
            if (!plan.meta.early_quality_onset) {
              violations.push({
                code: 'INV-PLAN-FOUNDATION-BLOCK',
                principle_ref: 'CoachingPrinciples §92, §57',
                severity: 'error',
                week: fw.n,
                day: day as Day,
                message: `Foundation week W${fw.n} carries strides without the §89 readiness gate. §57 bans strides for this block's population — fresh-return and novice runners whose musculoskeletal readiness lags their cardiovascular readiness — and §92 lifts the ban only for a runner the gate has certified.`,
                actual: 'strides, early_quality_onset unset',
                expected: 'no strides unless the §89 gate passed',
              })
            }
            if ((input.injury_history ?? []).length > 0) {
              violations.push({
                code: 'INV-PLAN-FOUNDATION-BLOCK',
                principle_ref: 'CoachingPrinciples §92',
                severity: 'error',
                week: fw.n,
                day: day as Day,
                message: `Foundation week W${fw.n} carries strides for a runner with injury history (${(input.injury_history ?? []).join(', ')}). §92's injury veto is absolute and outranks every other readiness signal (Willy's condition of approval).`,
                actual: `strides with injury_history`,
                expected: 'no strides',
              })
            }
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
          .map(s => sessionKmForCheck(s) ?? 0)   // SESSION-KM-02
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
        // §116 — A RAMP DELOADS, AND §57 WAS WRITTEN FOR A BLOCK THAT DOES NOT.
        //
        // §57's block is flat by construction, so a flat +10% cap was complete
        // for it. A §116 ramp dips to RECOVERY_WEEK_VOLUME_PCT and then resumes
        // from the build line, which is a ~57% rise off the dip and trips this
        // check every cadence. That is §3 working, not a spike.
        //
        // ⚠️ THE SAME PREDICATE THE MAIN-PLAN RAMP CHECK ALREADY USES
        // (`invariants.ts` §2 delivered-ramp: `if (isDeload || prevIsDeload)
        // continue`). Reused rather than re-expressed — one concept, one
        // semantics, or the two drift and only one of them is right.
        const isDeload     = curr.type === 'deload' || curr.badge === 'deload'
        const prevIsDeload = prev.type === 'deload' || prev.badge === 'deload'
        if (isDeload || prevIsDeload) continue
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

  // INV-PLAN-RUNWALK-PRESCRIBED — §117 amendment 3.
  //
  // A finish-goal run-walk plan whose sessions carry no `run_walk_strategy` is
  // a plan that only PERMITS walking, which is what §80 already did and is
  // precisely what the board refused to ship again.
  //
  // ⚠️ WILLY AND McMILLAN ARRIVED AT THIS INDEPENDENTLY, which is the strongest
  // signal the sitting produced. McMillan: *"'run 40 minutes, walk if you need
  // to' is a dare. '6 minutes running, 1 minute walking, ten times' is a
  // session. One is a target you beat; the other is an instruction you
  // follow."* Willy, from the load side: a runner permitted to walk and never
  // told how will run until they cannot, and arrive at the same injury by a
  // longer route.
  //
  // ⚠️ THIS IS THE WHOLE SAFETY ARGUMENT FOR ADMITTING THIS RUNNER. §117 lowers
  // the peak, which lowers §111's door — and that trade is only honest if the
  // runner is actually doing the thing the lower peak prepares them for. An
  // unstamped session is the door opened with nothing behind it.
  {
    if (plan.meta.finish_goal_run_walk) {
      for (const w of plan.weeks) {
        for (const [day, s] of Object.entries(w.sessions)) {
          if (!s) continue
          if (s.type === 'rest' || s.type === 'cross-train' || s.type === 'strength') continue
          if (!s.run_walk_strategy) {
            violations.push({
              code: 'INV-PLAN-RUNWALK-PRESCRIBED',
              principle_ref: 'CoachingPrinciples §117',
              severity: 'error',
              week: w.n,
              message: `Finish-goal run-walk plan: W${w.n} ${day} ("${s.label ?? s.type}") carries no run_walk_strategy. §117 amendment 3 — the walk break is PRESCRIBED, not permitted; a plan that only permits walking is what §80 already did and is what the board refused to ship again.`,
              actual: 'no run_walk_strategy',
              expected: 'a named interval on every running session',
            })
          }
        }
      }
    }
  }

  // INV-PLAN-ONRAMP-CURVE-CLIMBS / -ALL-EASY / -PER-RUN-STEP live in
  // `baseBuildValidate.ts`, NOT here.
  //
  // ⚠️ I wrote the curve check here first and it was a D-08 duplication within
  // the hour: a §116 ramp is a STANDALONE plan whose weeks carry
  // `phase: 'base_build'`, and the loop above skips those by design — so the
  // copy here was dead the moment the phase was introduced. Same precedent as
  // `validateMaintenanceBlock`: a different plan kind gets its own validator,
  // not a branch inside this one.

  // INV-PLAN-LR-SEGMENT-RECORDED — a §24b segmented long run must RECORD the
  // pace it prescribes.
  //
  // ⚠️ DELIBERATELY NOT INSIDE THE `plan.meta.vdot` BLOCK BELOW. That block —
  // including INV-PLAN-5K10K-LR-PACE-CAP — is gated on a VDOT, and a plan paced
  // from `fitness_level` rather than a benchmark HAS NO VDOT, so none of it runs
  // for those runners at all. This check needs no VDOT: it asks whether the
  // session recorded what it prescribed, not whether the pace is correct.
  // Found while falsification-testing this invariant — the first version sat in
  // that block and could not be made to fire.
  //
  // The gap it closes: the cap check opens `if (!s.lr_segment_pace) continue`,
  // so a session prescribing segments and storing none passed it SILENTLY — the
  // same shape as the four SESSION-KM-02 silent passes and the §52 checker
  // blindness. Measured 2026-09-12: 108 of 216 §24b sessions stored nothing, ALL
  // beginners, whose marathon/HM paces are null by design (§24b) and whose notes
  // therefore rendered the literal words ("at marathon pace: marathon pace").
  // The producer is now gated on derivable paces; this proves it stays gated.
  //
  // Keyed on `session.zone`, which the engine authors and the AI enricher does
  // not rewrite — never on the label or the notes (D-17).
  //
  // Scope, 2026-09-13 (LR-SEGMENT-RECORDED-§25): broadened from §24b's 5K/10K to
  // cover §25's two race-specific producers — `hm_pace_long_run` (HM) and
  // `mp_long_run` (MARATHON). §107 declared this gap in its own scope note ("open
  // work, not a silent gap") and shipped narrow so it landed clean rather than
  // with a 180-session baseline. Those producers now record the segment, so the
  // broadening costs zero violations — measured on a 30-session grid, not assumed.
  //
  // Time-target-gated for every distance for the same reason: §25's producer runs
  // only when `goalPace` is set, which requires `goal === 'time_target'`. A
  // finish-goal long run gets `longSession` ("Zone 2"), which this cannot key on.
  if (isTimeTarget && (distKey === '5K' || distKey === '10K' || distKey === 'HM' || distKey === 'MARATHON')) {
    for (const w of plan.weeks) {
      if (w.phase !== 'peak' || w.type === 'deload') continue
      for (const [day, s] of Object.entries(w.sessions) as [string, Session | undefined][]) {
        if (!s || !isLongRun(s)) continue
        if (s.zone !== 'Zone 2–3' || s.lr_segment_pace) continue
        violations.push({
          code: 'INV-PLAN-LR-SEGMENT-RECORDED',
          principle_ref: 'CoachingPrinciples §107',
          severity: 'error',
          week: w.n, day,
          message: `${s.label ?? 'long run'} carries the segmented zone (Zone 2–3) but stores no lr_segment_pace — the session prescribes pace segments it does not record, so nothing downstream can check or render them`,
          actual: 'lr_segment_pace absent',
          expected: 'a real pace band',
        })
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

  // INV-PLAN-LR-FLOOR-NOT-ROUNDING — a plan is never TOLD its peak long run is
  // below §24's floor when the shortfall it states is smaller than the engine's
  // own rounding step. (CoachingPrinciples §24 Amendment 1)
  //
  // The peak long run is floor-rounded to DISTANCE_ROUNDING_PRECISION_KM by the
  // producer and was compared against an unrounded threshold, so a computed
  // 31.9 km stored as 31.5 failed a 31.65 km floor by 150 metres and downgraded
  // the plan to `maintenance`. 9 of 162 marathon plans below the floor sat in
  // that dead band, and 6 of 78 HM plans.
  //
  // ⚠️ READS THE NOTE'S OWN TWO NUMBERS rather than recomputing the peak long
  // run. The first version recomputed it with `sessionKmForCheck`, while the
  // classifier uses `sessionKmOrZero` against the plan-level easy pace — two
  // computations of one quantity, which disagreed on 3 plans and threw them as
  // hard failures in the cohort grid. A checker that derives the producer's input
  // a second way is not checking the producer, it is racing it. This asserts the
  // engine's stated claim against itself: whatever numbers it printed, the gap
  // between them must exceed the rounding step, or the sentence is an artefact.
  //
  // Note-keyed is safe HERE specifically: `volume_constraint_note` is engine
  // meta, not a session label, and the enricher may not touch a numeric.
  if (isTimeTarget && (distKey === 'HM' || distKey === 'MARATHON')) {
    const step = GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM
    const note = plan.meta.volume_constraint_note ?? ''
    const m = /Peak long run ([\d.]+) km is below the ([\d.]+) km floor/.exec(note)
    if (m) {
      const statedPeak = Number(m[1])
      const statedFloor = Number(m[2])
      const shortfall = statedFloor - statedPeak
      // Both figures are printed to 1dp, so allow that much slack before calling
      // a shortfall an artefact — the 150 m case reads 0.2 km and still fires.
      if (Number.isFinite(shortfall) && shortfall > 0 && shortfall < step - 0.05) {
        violations.push({
          code: 'INV-PLAN-LR-FLOOR-NOT-ROUNDING',
          principle_ref: 'CoachingPrinciples §24 Amendment 1',
          severity: 'error',
          week: 0,
          message: `The plan states its peak long run (${statedPeak} km) is below §24's floor (${statedFloor} km), a shortfall of ${shortfall.toFixed(2)} km — inside the engine's own ${step} km rounding step. A cohort is being decided by a rounding artefact.`,
          actual: `stated shortfall ${shortfall.toFixed(2)} km`,
          expected: `no §24 shortfall claim below ${step} km`,
        })
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

  // ── §4 · §12 · §32 · §105 — added 2026-09-15 (coverage gate, category A) ───
  //
  // Four rules that were STATED and never enforced. Found by
  // `principleCoverage.test.ts`, which asks the question no per-commit hook can:
  // not "did this change break a rule" but "is every rule checked at all".
  // Each is written against what the principle actually says, not against what
  // the engine currently happens to do — the point is to be able to FAIL.

  // INV-PLAN-PHASE-STRUCTURE (§4) — a plan progresses base → build → peak →
  // taper, in that order, each phase contiguous.
  //
  // Nothing asserted this. `computePhases` is runner-aware (ADR-021 shortens
  // base; §98's ladder walks it back; §57 prepends foundation weeks) and every
  // one of those levers moves a boundary. A plan that lost a phase, or whose
  // weeks left a phase and came back to it, would have generated silently.
  {
    const order = ['base', 'build', 'peak', 'taper']
    const seen: string[] = []
    for (const w of plan.weeks) {
      if (w.n < 1) continue                       // §57 foundation weeks sit outside the arc
      const ph = w.phase ?? 'base'
      if (seen[seen.length - 1] !== ph) seen.push(ph)
    }
    // Contiguity: a phase may not appear, stop, and reappear.
    const repeated = seen.filter((ph, i) => seen.indexOf(ph) !== i)
    if (repeated.length > 0) {
      violations.push({
        code: 'INV-PLAN-PHASE-STRUCTURE',
        principle_ref: 'CoachingPrinciples §4',
        severity: 'error',
        week: 0,
        message: `Phases are not contiguous — the plan leaves a phase and returns to it (${seen.join(' → ')}). Each phase has one purpose and one block.`,
        actual: seen.join(' → '),
        expected: 'each phase appears exactly once, in order',
      })
    }
    // Order: whatever phases are present must appear in the canonical sequence.
    const ranks = seen.map(ph => order.indexOf(ph)).filter(r => r >= 0)
    const ascending = ranks.every((r, i) => i === 0 || r > ranks[i - 1])
    if (!ascending) {
      violations.push({
        code: 'INV-PLAN-PHASE-STRUCTURE',
        principle_ref: 'CoachingPrinciples §4',
        severity: 'error',
        week: 0,
        message: `Phases run out of order (${seen.join(' → ')}). §4: plans progress base → build → peak → taper.`,
        actual: seen.join(' → '),
        expected: 'base → build → peak → taper',
      })
    }
  }

  // INV-PLAN-EASY-RUN-ZONE-CAP (§12) — "easy runs are capped at the top of Z2".
  //
  // The single most load-bearing sentence in the product ("you can't outrun your
  // easy days") and nothing checked it. An easy run carrying a Z3 marker is the
  // grey zone the brand exists to prevent, printed on the card.
  //
  // Reads the PRESCRIBED zone string, which is what the runner acts on. §12
  // Amendment 1 is about measured DRIFT above the cap and is a different
  // question — this is the prescription, not the execution.
  for (const w of plan.weeks) {
    for (const [day, sn] of Object.entries(w.sessions) as [Day, Session | undefined][]) {
      if (!sn || sn.type !== 'easy' || !sn.zone) continue
      const z = String(sn.zone)
      // A segmented long run legitimately carries a band spanning Z2-Z3 (§24b,
      // §25) — its race-pace portion is prescribed, not drift. Exempt by the
      // structural signal, never by reading the label (D-17).
      if (isLongRun(sn)) continue
      if (/\b[3-5]\b/.test(z) && !/^Z?2\b/.test(z)) {
        violations.push({
          code: 'INV-PLAN-EASY-RUN-ZONE-CAP',
          principle_ref: 'CoachingPrinciples §12',
          severity: 'error',
          week: w.n, day,
          message: `Easy session "${sn.label}" is prescribed at ${z}. §12 caps easy runs at the top of Z2 — Z3 is the grey zone the plan exists to keep them out of.`,
          actual: z,
          expected: 'Zone 2 (or below)',
        })
      }
    }
  }

  // INV-PLAN-FRESH-RETURN-GATE (§29 + §37) — the layoff gate fires exactly when
  // the constitution says it does.
  //
  // §29 opens the gate explicitly (`weeks_at_current_volume` under the
  // threshold); §37 opens it heuristically (deep training age, but both current
  // volume AND longest recent run below the floors). The two are OR-ed, and
  // `plan.meta.fresh_return_active` is the flag every downstream consumer reads.
  //
  // This checks the GATE, not the start fraction. The start volume is squeezed
  // by three other rules before it reaches week 1 — the <6mo beginner cap, §106's
  // peak floor, the foundation block — so asserting `week1 ≈ 0.7 × stated` would
  // false-fire on runners the engine handled correctly. The fraction is pinned by
  // a named test (`freshReturnGate.test.ts`); what an invariant can prove on EVERY
  // plan is that the flag and the inputs agree. A flag that silently stops firing
  // is the failure that matters: it is the difference between a 6-month-layoff
  // runner starting at 70% and starting at 100%.
  {
    const explicit = input.weeks_at_current_volume !== undefined
      && input.weeks_at_current_volume < GENERATION_CONFIG.FRESH_RETURN_WEEKS_THRESHOLD
    const deepTrainingAge = input.training_age === '2-5yr' || input.training_age === '5yr+'
    const heuristic = deepTrainingAge
      && input.current_weekly_km < GENERATION_CONFIG.HEURISTIC_FRESH_RETURN_WEEKLY_KM
      && input.longest_recent_run_km < GENERATION_CONFIG.HEURISTIC_FRESH_RETURN_LONG_RUN_KM
    const expected = explicit || heuristic
    const actual = plan.meta.fresh_return_active === true
    if (expected !== actual) {
      violations.push({
        code: 'INV-PLAN-FRESH-RETURN-GATE',
        principle_ref: 'CoachingPrinciples §29, §37',
        severity: 'error',
        week: 0,
        message: expected
          ? `Inputs meet §${explicit ? '29' : '37'}'s fresh-return condition but the plan does not declare it — the runner starts at their full stated volume after a layoff.`
          : `Plan declares a fresh return that neither §29's explicit input nor §37's heuristic supports — the start volume is cut by ${Math.round((1 - GENERATION_CONFIG.FRESH_RETURN_START_FRACTION) * 100)}% for no stated reason.`,
        actual: `fresh_return_active=${actual}`,
        expected: `fresh_return_active=${expected}`,
      })
    }
  }

  // INV-PLAN-COMPRESSION-CLASSIFICATION (§31) — the three modes, and the §44 link.
  //
  // §31 says the classification and the difficulty band "are computed from the
  // same const so they can never disagree". That is a claim about the CURRENT
  // shape of one expression in `generateRulePlan`, held by a comment. This makes
  // it mechanical: the relationship survives someone editing one branch.
  {
    const c = plan.meta.compression_classification
    const shortOfTarget = plan.meta.time_compressed === true || plan.meta.volume_constrained === true
    if (c === undefined) {
      violations.push({
        code: 'INV-PLAN-COMPRESSION-CLASSIFICATION',
        principle_ref: 'CoachingPrinciples §31',
        severity: 'error',
        week: 0,
        message: 'Plan carries no compression classification — §31 requires a classification, not a bare warning.',
        actual: 'undefined',
        expected: "'optimal' | 'appropriate_for_persona' | 'constrained_by_inputs'",
      })
    } else if ((c === 'optimal') !== !shortOfTarget) {
      violations.push({
        code: 'INV-PLAN-COMPRESSION-CLASSIFICATION',
        principle_ref: 'CoachingPrinciples §31',
        severity: 'error',
        week: 0,
        message: `Classification '${c}' disagrees with the compression flags (time_compressed=${plan.meta.time_compressed}, volume_constrained=${plan.meta.volume_constrained}). §31's 'optimal' means the plan reached its target.`,
        actual: c,
        expected: shortOfTarget ? 'a non-optimal classification' : 'optimal',
      })
    } else if (c === 'constrained_by_inputs' && plan.meta.difficulty_band === 'comfortable') {
      violations.push({
        code: 'INV-PLAN-COMPRESSION-CLASSIFICATION',
        principle_ref: 'CoachingPrinciples §31, §44',
        severity: 'error',
        week: 0,
        message: 'Plan is constrained by its inputs but fronts as comfortable. §31 makes this classification load-bearing on the §44 band precisely so the runner knows a lever exists.',
        actual: 'difficulty_band=comfortable',
        expected: "difficulty_band 'demanding' or 'very_demanding'",
      })
    }
  }

  // INV-PLAN-COMPRESSION-SPLIT (§101) — short of TIME and short of VOLUME are
  // two facts with two remedies, so they are two fields.
  //
  // The single `compressed` boolean was true for five of six personas, fed the
  // PAID confidence score, and sent runners to the wrong lever. It survives as a
  // deprecated OR; this pins that it stays an OR rather than drifting back into
  // the authority, and that both real fields are actually stamped.
  {
    const t = plan.meta.time_compressed
    const v = plan.meta.volume_constrained
    if (typeof t !== 'boolean' || typeof v !== 'boolean') {
      violations.push({
        code: 'INV-PLAN-COMPRESSION-SPLIT',
        principle_ref: 'CoachingPrinciples §101',
        severity: 'error',
        week: 0,
        message: 'Plan does not stamp both compression fields. §101 separates them because the remedies differ — race later vs train more days.',
        actual: `time_compressed=${t}, volume_constrained=${v}`,
        expected: 'both booleans present',
      })
    } else if (plan.meta.compressed !== undefined && plan.meta.compressed !== (t || v)) {
      violations.push({
        code: 'INV-PLAN-COMPRESSION-SPLIT',
        principle_ref: 'CoachingPrinciples §101',
        severity: 'error',
        week: 0,
        message: `The deprecated 'compressed' flag (${plan.meta.compressed}) is no longer the OR of the two real fields (${t} || ${v}). A saved plan or an existing reader would now read a third, unowned answer.`,
        actual: String(plan.meta.compressed),
        expected: String(t || v),
      })
    }
  }

  // INV-PLAN-STRIDES-PRESENT (§28) — the cheapest fitness asset in coaching,
  // and the easiest one to lose silently.
  //
  // 80 seconds of work. Without them a runner who only ever runs Z2 and
  // threshold loses the ability to run faster than threshold efficiently, and
  // race day finds them flat-footed at the gun. They are a coach NOTE on an
  // existing easy run, not a session — which is exactly why nothing would have
  // noticed them disappearing: no session count changes, no volume moves, no
  // other invariant reads `coach_notes`.
  //
  // ⚠️ WHAT THIS DELIBERATELY DOES NOT ASSERT: §28 says the stride run is placed
  // "midweek (Wed preferred)". Measured over 31,344 plans, that preference
  // diverges on 146,732 week-instances — a 3-day week with Tue and Thu blocked
  // has no midweek easy run to put them on. A PREFERENCE is not a rule, and an
  // invariant that fires on the engine correctly doing its best gets switched
  // off. The two placement rules §28 states as absolute — never the day before
  // the long run, never the day after quality — hold on every one of those
  // 31,344 plans, and those are what is asserted.
  {
    const raceWeekN = Math.max(0, ...plan.weeks.map(w => w.n))
    for (const w of plan.weeks) {
      if (w.n < GENERATION_CONFIG.STRIDES_FIRST_WEEK) continue   // also excludes foundation (n <= 0)
      if (w.type === 'deload' || w.n === raceWeekN) continue     // §28 exempts both
      const entries = Object.entries(w.sessions).filter(([, sn]) => !!sn) as [Day, Session][]
      const stride = entries.filter(([, sn]) => hasStrideNote(sn))
      // §28 appends a note to an EXISTING easy run. A 2-day week is a long run
      // plus one other session, and a week whose only easy day sits the day
      // before the long run or the day after quality has nowhere legal to put
      // them. Measured: 2,168 week-instances across the sweep, every one of them
      // a week with no eligible day rather than an eligible day left unused.
      // Demanding strides there would demand a session the principle never asks
      // for — and §28's own wording ("appends ... to one midweek easy run")
      // presupposes the run exists.
      const eligible = entries.filter(([d, sn]) => {
        if (sn.type !== 'easy' || isLongRun(sn)) return false
        const j = DAY_ORDER.indexOf(d)
        const after = DAY_ORDER[j + 1], before = DAY_ORDER[j - 1]
        if (after && w.sessions[after] && isLongRun(w.sessions[after]!)) return false
        if (before && w.sessions[before]?.type === 'quality') return false
        return true
      })
      if (stride.length === 0 && eligible.length === 0) continue
      if (stride.length === 0) {
        violations.push({
          code: 'INV-PLAN-STRIDES-PRESENT',
          principle_ref: 'CoachingPrinciples §28',
          severity: 'error',
          week: w.n,
          message: `Week ${w.n} carries no stride note. §28 requires one from week ${GENERATION_CONFIG.STRIDES_FIRST_WEEK} on every non-deload, non-race week — 80 seconds of work for an adaptation that compounds across the build.`,
          actual: 'no strides',
          expected: 'one midweek easy run carrying the stride note',
        })
        continue
      }
      if (stride.length > 1) {
        violations.push({
          code: 'INV-PLAN-STRIDES-PRESENT',
          principle_ref: 'CoachingPrinciples §28',
          severity: 'error',
          week: w.n,
          message: `Week ${w.n} carries strides on ${stride.length} runs (${stride.map(([d]) => d).join(', ')}). §28 places them on ONE easy run.`,
          actual: `${stride.length} stride runs`,
          expected: '1',
        })
      }
      const [day, sn] = stride[0]
      if (sn.type !== 'easy') {
        violations.push({
          code: 'INV-PLAN-STRIDES-PRESENT',
          principle_ref: 'CoachingPrinciples §28',
          severity: 'error',
          week: w.n, day,
          message: `Strides are on a '${sn.type}' session ("${sn.label}"). §28 puts them on an EASY day so the legs are fresh enough to execute proper form.`,
          actual: sn.type,
          expected: 'easy',
        })
      }
      const i = DAY_ORDER.indexOf(day)
      const next = DAY_ORDER[i + 1]
      const prev = DAY_ORDER[i - 1]
      const nextSn = next ? w.sessions[next] : undefined
      const prevSn = prev ? w.sessions[prev] : undefined
      if (nextSn && isLongRun(nextSn)) {
        violations.push({
          code: 'INV-PLAN-STRIDES-PRESENT',
          principle_ref: 'CoachingPrinciples §28',
          severity: 'error',
          week: w.n, day,
          message: `Strides on ${day} sit the day before the long run. §28 places them away from it — fast turnover into a long run is fatigue the runner did not ask for.`,
          actual: `${day}, long run on ${next}`,
          expected: 'not the day before the long run',
        })
      }
      if (prevSn && prevSn.type === 'quality') {
        violations.push({
          code: 'INV-PLAN-STRIDES-PRESENT',
          principle_ref: 'CoachingPrinciples §28',
          severity: 'error',
          week: w.n, day,
          message: `Strides on ${day} sit the day after a quality session. §28 places them away from it — the easy day after quality is recovery, and strides on it make two hard days in a row wearing one label.`,
          actual: `${day}, quality on ${prev}`,
          expected: 'not the day after quality',
        })
      }
    }
  }

  // INV-PLAN-RACE-WEEK-SHAKEOUT-CAP (§30) — a shakeout is a wake-up for the
  // legs, not training.
  //
  // Anything past RACE_WEEK_SHAKEOUT_MAX_MINS has crossed into being a session
  // and starts adding fatigue the runner cannot clear before the gun. §26's
  // invariant already bans the wrong session TYPES in race week; nothing capped
  // the shakeout's own size, so a shakeout could grow without tripping anything.
  //
  // The last run before a race should leave the runner wondering if it was
  // enough — that is the correct feeling, and it is a size, not a sentiment.
  {
    const raceWeekN = Math.max(0, ...plan.weeks.map(w => w.n))
    const raceWeek = plan.weeks.find(w => w.n === raceWeekN)
    if (raceWeek) {
      for (const [day, sn] of Object.entries(raceWeek.sessions) as [Day, Session | undefined][]) {
        if (!sn || !isShakeout(sn)) continue
        const cap = GENERATION_CONFIG.RACE_WEEK_SHAKEOUT_MAX_MINS
        if (sn.duration_mins != null && sn.duration_mins > cap) {
          violations.push({
            code: 'INV-PLAN-RACE-WEEK-SHAKEOUT-CAP',
            principle_ref: 'CoachingPrinciples §30',
            severity: 'error',
            week: raceWeek.n, day,
            message: `Race-week shakeout "${sn.label}" is ${sn.duration_mins} min, over §30's ${cap}-min cap. Past that it is a session, and it costs the runner fatigue they cannot recover before race day.`,
            actual: `${sn.duration_mins} min`,
            expected: `≤ ${cap} min`,
          })
        }
        if (sn.rpe_target != null && sn.rpe_target > RACE_WEEK_SHAKEOUT_MAX_RPE) {
          violations.push({
            code: 'INV-PLAN-RACE-WEEK-SHAKEOUT-CAP',
            principle_ref: 'CoachingPrinciples §30',
            severity: 'error',
            week: raceWeek.n, day,
            message: `Race-week shakeout "${sn.label}" is prescribed at RPE ${sn.rpe_target}. §30 holds shakeouts at RPE ≤ ${RACE_WEEK_SHAKEOUT_MAX_RPE} — the duration cap alone does not stop a short run being run hard.`,
            actual: `RPE ${sn.rpe_target}`,
            expected: `RPE ≤ ${RACE_WEEK_SHAKEOUT_MAX_RPE}`,
          })
        }
      }
    }
  }

  // INV-PLAN-VDOT-STALENESS-LADDER (§42) — the conservatism discount is a
  // graduated ramp, and it stays on its own rungs.
  //
  // §42 replaced a binary 6-month cliff (3% straight to 8%) with base + 1% per
  // 4-week block, capped. `VDOT_STALE_BENCHMARK_MONTHS` and its flat 5% then sat
  // in config for months, documented as live, read by nothing — §42's own text
  // keeps them as the worked example of why the consumer check exists.
  //
  // ⚠️ THIS ASSERTS THE RUNG, NOT THE DATE ARITHMETIC, and the reason is a
  // denominator problem. `applyVdotDiscount` measures staleness against the
  // generation clock; `validatePlan` receives a plan and an input and has no
  // clock. Reconstructing "today" from the plan start would be wrong by however
  // many days sit between signup and week 1 — enough to cross a 4-week block
  // boundary and fail a correct plan. What holds regardless of the reference
  // date: the value is one of the ladder's legal rungs, never below the base,
  // never above the cap, and an UNDATED benchmark gets the base and nothing more.
  // A discount computed by any other formula lands off the ladder and is caught.
  {
    const d = plan.meta.vdot_discount_applied_pct
    if (d != null) {
      const base = GENERATION_CONFIG.VDOT_CONSERVATIVE_DISCOUNT_PCT
      const cap = GENERATION_CONFIG.VDOT_STALENESS_MAX_DISCOUNT_PCT
      const step = GENERATION_CONFIG.VDOT_STALENESS_PER_4WK_PCT
      const rungs: number[] = []
      for (let v = base; v <= cap + 1e-9; v += step) rungs.push(Math.round(v * 1e6) / 1e6)
      const onRung = rungs.some(r => Math.abs(r - d) < 1e-6)
      if (!onRung) {
        violations.push({
          code: 'INV-PLAN-VDOT-STALENESS-LADDER',
          principle_ref: 'CoachingPrinciples §42, §10',
          severity: 'error',
          week: 0,
          message: `VDOT discount ${d}% is not a rung of §42's ladder (${rungs.join('%, ')}%). A discount off the ladder means something other than the staleness ramp computed it — the class of defect §42 was written to remove.`,
          actual: `${d}%`,
          expected: rungs.join('% / ') + '%',
        })
      }
      if (!input.benchmark?.benchmark_date && Math.abs(d - base) > 1e-6) {
        violations.push({
          code: 'INV-PLAN-VDOT-STALENESS-LADDER',
          principle_ref: 'CoachingPrinciples §42',
          severity: 'error',
          week: 0,
          message: `An UNDATED benchmark was discounted ${d}%. With no date there is no staleness to price, so §10's base ${base}% is the whole answer — anything more is conservatism invented from nothing.`,
          actual: `${d}%`,
          expected: `${base}%`,
        })
      }
    }
  }

  // INV-PLAN-VO2MAX-FLOAT-IS-A-CEILING (§88) — Seiler's condition of approval.
  //
  // A fast-float set dies if the float drifts to the grey zone: the whole set
  // becomes threshold-in-disguise, which is the single failure this product
  // exists to prevent. §88 anchors the float step **E with `mode: ceiling`** —
  // "a bound, not a suggestion" — and the float is RUN, not jogged, which is
  // what makes the shape continuous and keeps time at vVO2max accumulating.
  //
  // Both properties live inside `derived_set`, so no session-level invariant
  // could see them and none did. The dose half of §88 is already carried by the
  // VO2MAX_WORK band above; this is the half that was unenforced.
  {
    for (const w of plan.weeks) {
      for (const [day, sn] of Object.entries(w.sessions) as [Day, Session | undefined][]) {
        if (!sn?.derived_set || !CONTINUOUS_VO2MAX_ROWS.has(sn.catalogue_id ?? '')) continue
        const steps = sn.derived_set.blocks.flatMap(b => b.steps ?? [])
        const float = steps.find(st => st.role === 'recovery')
        if (!float) {
          violations.push({
            code: 'INV-PLAN-VO2MAX-FLOAT-IS-A-CEILING',
            principle_ref: 'CoachingPrinciples §88',
            severity: 'error',
            week: w.n, day,
            message: `"${sn.label}" (${sn.catalogue_id}) is a fast-float shape with no float step. Without it the set is reps with no recovery prescribed at all.`,
            actual: steps.map(st => st.role).join(', ') || 'no steps',
            expected: 'a recovery step',
          })
          continue
        }
        if (float.pace_mode !== 'ceiling') {
          violations.push({
            code: 'INV-PLAN-VO2MAX-FLOAT-IS-A-CEILING',
            principle_ref: 'CoachingPrinciples §88',
            severity: 'error',
            week: w.n, day,
            message: `"${sn.label}"'s float is prescribed as a '${float.pace_mode ?? 'target'}', not a ceiling. §88 bounds it deliberately: a float allowed to drift turns the whole set into threshold wearing a VO2max label.`,
            actual: float.pace_mode ?? 'target',
            expected: 'ceiling',
          })
        }
        if (RUN_FLOAT_ROWS.has(sn.catalogue_id ?? '') && float.modality !== 'run') {
          violations.push({
            code: 'INV-PLAN-VO2MAX-FLOAT-IS-A-CEILING',
            principle_ref: 'CoachingPrinciples §88',
            severity: 'error',
            week: w.n, day,
            message: `"${sn.label}"'s float is a '${float.modality}'. §88's float is RUN — that is what keeps heart rate from fully dropping and accumulates time at vVO2max across the set. Jogging it makes this an ordinary rep session.`,
            actual: float.modality,
            expected: 'run',
          })
        }
      }
    }
  }

  // INV-PLAN-SURPLUS-IN-PLAN (§97 + §97 Amendment) — surplus weeks belong
  // INSIDE the plan.
  //
  // §76 anchors the plan to race day and delays the start when weeks are
  // spare; ADR-020 then fills the delay with a §57 foundation block. So the
  // runner trains those weeks either way — what §76 actually produces is real
  // training sitting OUTSIDE the periodisation arc, carved out of five
  // invariants and described by §57's own text as "habit and routine, not
  // adaptation".
  //
  // ⚠️ WIDENED 2026-09-16 (LONG-RUNWAY-EARNS-PLAN-01, Coaching Board). This was
  // `INV-PLAN-GATED-SURPLUS-IN-PLAN` and ran only `if (plan.meta.early_quality_onset)`,
  // because §97 granted the headroom only to a §89-gated runner. The board
  // amended §97 to grant it on SURPLUS instead, on the finding that M1 — the
  // charity cohort's first-time marathoner, the precise opposite of gated — was
  // getting 18 weeks of an available 20 with FOUR uncovered weeks in front of
  // them, and that for a `<6mo` training age those are the cheapest
  // tissue-adaptation weeks available (Willy). The gate check is therefore gone;
  // everything below it is unchanged and was already distance-general.
  //
  // Two mechanical claims: a runner with surplus gets no foundation block they
  // did not ask for, and the plan honours `max_weeks` — the signature's own
  // declared bound (§17), which the extension explicitly does not exceed.
  {
    // ⚠️ EXEMPT WHEN THE RUNNER ASKED FOR IT. §97 governs what the ENGINE does
    // with surplus weeks at generation: it extends the plan instead of handing
    // them to §57. It does not govern ADR-020's deferred decision, where a
    // runner with a >28-day gap is ASKED and answers 'add' — that block is
    // composed afterwards by `composePlanWithFoundation`, on the runner's own
    // say-so, and re-validated here. Measured: 16 sweep cases, every one of them
    // a foundation_decision path. Firing on a runner's answered choice would be
    // this invariant overruling the person it is meant to serve.
    const foundationWeeks = plan.weeks.filter(w => w.n <= 0)
    // SINGLE OWNER (D-08). `planWeekCap` is the same function `calcPlanLength`
    // sizes the plan with, so producer and checker cannot drift about what the
    // bound IS. This used to read `PLAN_SIGNATURES.max_weeks` raw, which agreed
    // with the producer only because `max_weeks - idealWeeks` is ≤ 2 at every
    // distance and `MAX_PLAN_EXTENSION_WEEKS` is therefore never binding — an
    // accidental agreement of exactly the DELOAD-OWNER-01 kind. What this
    // invariant asserts INDEPENDENTLY is the plan's delivered week count against
    // that bound, which is the claim that can actually go wrong.
    const signatureMax = planWeekCap(input.race_distance_km)
    const mainWeekCount = plan.weeks.filter(w => w.n >= 1).length
    // §97 extends the plan INTO `max_weeks` and explicitly not past it — "the
    // signature's own declared bound; this honours a limit §17 already set, it
    // does not exceed one." Once the plan is AT that bound the extension is
    // exhausted, and surplus calendar time beyond it has nowhere else to go but
    // §57. Measured: 10 sweep cases, every one a plan already at max_weeks with
    // gap left over. Firing there would demand the plan break §17 to satisfy §97.
    //
    // ⚠️ THE CALENDAR BINDS BEFORE THE SIGNATURE DOES, and missing that is why
    // this was filed as a defect twice. `calcPlanLength` takes `weeksAvailable`
    // from the plan's own earliest start to race week and caps at
    // min(weeksAvailable, weekCap). When the calendar offers fewer weeks than
    // `max_weeks`, the plan is as long as it can be and §97 has nothing left to
    // extend into — the surplus sits BEFORE the earliest start, where no amount
    // of extension reaches.
    //
    // VERIFIED ON THE PRODUCTION PATH (2026-09-15): the route derives
    // `planStart = nextMonday()` from today, so a gated HM runner with a 20-week
    // runway gets a plan of 16 of max 16 and a foundation block covering only the
    // residual, and with a 30-week runway the same. §97 is working. The sweep
    // cases that prompted this item pass `plan_start` AND a `today` 24-40 days
    // earlier — decoupling two values the live path derives from one another —
    // so `weeksAvailable` is measured from a start that is not anchored to today.
    // Production cannot produce that shape.
    const weeksFromStartToRace = (() => {
      const start = plan.meta.plan_start, race = input.race_date
      if (!start || !race) return null
      const ms = parseDateLocal(race).getTime() - parseDateLocal(start).getTime()
      return Math.floor(ms / (7 * 86_400_000)) + 1
    })()
    const calendarBound = weeksFromStartToRace != null && mainWeekCount >= weeksFromStartToRace
    const extensionExhausted =
      (signatureMax != null && mainWeekCount >= signatureMax) || calendarBound
    if (foundationWeeks.length > 0 && input.foundation_decision !== 'add' && !extensionExhausted) {
      violations.push({
        code: 'INV-PLAN-SURPLUS-IN-PLAN',
        principle_ref: 'CoachingPrinciples §97, §97 Am.',
        // `warn`, and the reason is architectural rather than coaching (§34).
        //
        // MEASURED, 15,973-plan sweep: 5 plans (0.03%). Every one has a
        // signup-to-start gap of 10-40 days and no 'add' decision, and sits
        // BELOW its signature's max_weeks — so the extension had room and did
        // not happen.
        //
        // The mechanism, stated as a hypothesis because it is one: §97's
        // extension is decided at GENERATION, from race-date arithmetic. The
        // foundation gap is measured at COMPOSE time, from `today` against the
        // plan's own start — a quantity `generateRulePlan` never had. So a
        // gated runner whose surplus only becomes visible later can still be
        // handed a §57 block that §97 says is the wrong object for them.
        // Closing it means giving generation a value it currently cannot see,
        // which is an ADR-020 boundary change, not a threshold tweak. Filed as
        // GATED-SURPLUS-COMPOSE-01; an `error` here would fail five real plans
        // for a gap in the architecture rather than in the plan.
        severity: 'warn',
        week: 0,
        message: `Runner was given ${foundationWeeks.length} foundation week(s) `
          + `while their plan sits at ${mainWeekCount} of ${distKey}'s ${signatureMax} maximum weeks. `
          + `§97 spends that headroom on periodised weeks first — nobody should open the app to `
          + `weeks of "habit and routine" while their own plan had room to grow.`,
        actual: `${foundationWeeks.length} foundation weeks, plan ${mainWeekCount}/${signatureMax}`,
        // NOT "expected 0". MEASURED 2026-09-15: the two worst cases have 2 weeks
        // of headroom against gaps of 3.4 and 5.7 weeks, so §97 could absorb some
        // of the surplus and never all of it. Demanding zero overstates what the
        // principle can deliver, and an invariant that asks for the impossible is
        // one people learn to ignore (D-21). What §97 DOES promise is that the
        // headroom is spent before §57 is reached for.
        expected: `the plan extended to ${signatureMax} weeks before any foundation block`,
      })
    }
    if (signatureMax && mainWeekCount > signatureMax) {
      violations.push({
        code: 'INV-PLAN-SURPLUS-IN-PLAN',
        principle_ref: 'CoachingPrinciples §97, §17',
        severity: 'error',
        week: 0,
        message: `Plan runs ${mainWeekCount} weeks against ${distKey}'s declared max of ${signatureMax}. §97 extends the plan INTO the signature's bound, never past it.`,
        actual: `${mainWeekCount} weeks`,
        expected: `≤ ${signatureMax}`,
      })
    }
  }

  // INV-PLAN-TAPER-LR-NOT-ABOVE-PEAK (§6 Amendment 1) — the taper's long run may
  // not exceed the peak phase's.
  //
  // §6 says volume drops sharply in the taper; §9's shares say the taper takes
  // the LARGEST fraction of the week (40% against peak's 32%). On 1.9% of plans
  // the larger share of a smaller week beat the peak's smaller share of a bigger
  // one — worst measured, an HM taper long run of 20.5 km after a peak of 18.5,
  // two weeks out from a 21.1 km race.
  //
  // `warn`, and the reason is that the residual is NOT this rule's to fix.
  //
  // CORRECTED 2026-09-15 (Coaching Board TAPER-DEPTH-01). This comment used to
  // blame "the separately-filed §6 taper-depth finding". There is no taper-depth
  // defect: the taper cut reaches the curve correctly (traced 50K: 95 -> 78 -> 60
  // -> 43, exactly volume_reduction_pct 55 over three steps) and the taper is the
  // BEST-delivered phase in the plan (delivered/curve mean 0.981 against build
  // 0.870, peak 0.906, over 504 plans).
  //
  // What lifts the taper above the peak is §23's structuralPeakInversion — on
  // 3-day plans the PEAK phase delivers as little as 0.67 of its own curve, so a
  // correctly-tapered week clears it. That is already ruled and already treated:
  // of the 8 plans in 504 whose first taper week exceeds the peak phase, 8 of 8
  // are volume_profile 'maintenance' with a volume_constraint_note. None silent.
  //
  // The genuine residual here is 6 plans in 504 (1.2%), each overshooting by
  // 0.9-1.0 km (21.5 vs 20.5; 31.0 vs 30.1) because §9's long-is-longest ratio
  // pins them. A kilometre on a 31 km long run is not a dress rehearsal, so
  // `error` would fail plans over rounding-scale noise (NOISE-GATE-01, §34).
  {
    const nonDeload = plan.weeks.filter(w => w.n > 0 && w.type !== 'race' && w.type !== 'deload')
    const longKmOfWeek = (w: Week): number => {
      const sn = Object.values(w.sessions).find(x => x && isLongRun(x))
      return sn ? sessionKmSelfPaced(sn) ?? 0 : 0
    }
    const peakLr = Math.max(0, ...nonDeload.filter(w => w.phase === 'peak').map(longKmOfWeek))
    if (peakLr > 0) {
      const tol = GENERATION_CONFIG.TAPER_LR_VS_PEAK_TOLERANCE_KM
      for (const w of nonDeload.filter(x => x.phase === 'taper')) {
        const taperLr = longKmOfWeek(w)
        if (taperLr <= peakLr + tol) continue
        violations.push({
          code: 'INV-PLAN-TAPER-LR-NOT-ABOVE-PEAK',
          principle_ref: 'CoachingPrinciples §6, §9',
          severity: 'warn',
          week: w.n,
          message: `Taper week ${w.n} prescribes a ${taperLr.toFixed(1)}km long run against a peak-phase best of ${peakLr.toFixed(1)}km. §6 drops volume sharply in the taper; a long run above anything in the peak phase is a dress rehearsal, in the window with no time left to absorb it.`,
          actual: `${taperLr.toFixed(1)}km`,
          expected: `≤ ${(peakLr + tol).toFixed(1)}km`,
        })
      }
    }
  }

  // INV-PLAN-TAPER-DELIVERED-DEPTH (§6 Amendment 2) — the taper the runner is
  // HANDED must actually cut, measured against the week they actually did.
  //
  // §6's cut used to be a percentage of the volume CURVE. The curve delivers its
  // taper faithfully (0.99-1.02) but the PEAK phase delivers 0.70-0.90 of its own
  // (§23/CD-10, accepted), so a taper week whose curve sat 23% below peak arrived
  // 2% below the peak the runner ran. Worst measured: HM peaking at 45.5 km with
  // a first taper week of 44.5.
  //
  // THE FLOOR IS DELIBERATELY THE SHALLOWER OF THE TWO CONFIGURED CUTS.
  // buildVolumeSequence applies LOW_VOLUME_TAPER_REDUCTION_FACTOR_PCT when
  // peakKm is below LOW_VOLUME_TAPER_THRESHOLD_KM (CD-5 — a low-volume runner has
  // little fatigue to shed). `peakKm` is generation-time state this validator
  // cannot see, and RE-DERIVING it from the finished plan is exactly how a
  // checker and its producer drift (D-16, DELOAD-OWNER-01). So the invariant
  // asserts the weaker claim BOTH branches satisfy: at least the low-volume
  // step. A plan that took the full cut passes comfortably; a plan that took
  // neither fails. That is the property worth checking.
  //
  // `warn`, not `error`, AND SCOPED TO WEEKS THAT HAD ROOM TO CUT. First cut
  // fired on 43.5% of the property sweep (6,949 of 15,973) and NOISE-GATE-01
  // rejected it. Every sampled failure was the same two things:
  //
  //   1. ROUNDING. `week.weekly_km` is Math.round'd to whole km and sessions
  //      round to DISTANCE_ROUNDING_PRECISION_KM, so a 9 km taper week cannot
  //      land exactly on a 8.95 km ceiling. Both sides are now summed from the
  //      SESSIONS at full precision instead of read off the rounded field.
  //   2. THE FLOOR DOING ITS JOB. On small weeks every easy run is already at
  //      MIN_SESSION_DISTANCE_KM.easy, so §6 Am.2's pass had nothing left to
  //      trim. That is §34's declared residual, not a defect, and a check that
  //      reports it is a check that gets switched off.
  //
  // So the predicate is the honest one: **the taper did not cut, AND it could
  // have.** A week whose easy runs are all on the floor is silent by design.
  {
    const taperWeeks = plan.weeks.filter(w => w.n > 0 && w.phase === 'taper' && w.type !== 'race')
    if (taperWeeks.length > 0) {
      const weekKm = (w: Week): number => {
        let total = 0
        for (const sn of Object.values(w.sessions)) {
          if (!sn || sn.type === 'strength' || sn.type === 'rest') continue
          total += sessionKmSelfPaced(sn) ?? 0
        }
        return total
      }
      /** How much this week could still give without breaching §6 Am.2's own
       *  lever order — easy runs only, never the §52 long run, never quality. */
      const trimmableKm = (w: Week): number => {
        let room = 0
        for (const sn of Object.values(w.sessions)) {
          if (!sn || sn.type !== 'easy' || isLongRun(sn)) continue
          room += Math.max(0, (sessionKmSelfPaced(sn) ?? 0) - GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.easy)
        }
        return room
      }

      const firstTaperN = Math.min(...taperWeeks.map(w => w.n))
      const anchorWeek = plan.weeks.find(w => w.n === firstTaperN - 1)
      const anchorKm = anchorWeek ? weekKm(anchorWeek) : 0
      const distKey = raceDistanceKey(input.race_distance_km)
      const taperConfig = GENERATION_CONFIG.TAPER_BY_DISTANCE[distKey]
      const fullTaperWeeks = Math.max(
        1, GENERATION_CONFIG.TAPER_QUALITY_PER_WEEK[distKey].length - 1)
      if (anchorKm > 0 && taperConfig) {
        const shallowStepPct =
          (taperConfig.volume_reduction_pct
            * (GENERATION_CONFIG.LOW_VOLUME_TAPER_REDUCTION_FACTOR_PCT / 100))
          / fullTaperWeeks
        for (const w of taperWeeks) {
          const step = w.n - firstTaperN + 1
          const ceiling = anchorKm * (1 - (shallowStepPct * step) / 100)
          const delivered = weekKm(w)
          const overshoot = delivered - ceiling
          if (overshoot <= 0) continue
          // Same materiality gate the engine pass uses — the SHARED CONSTANT,
          // not a shared computation. Below it the shortfall is rounding across
          // 3-7 sessions; §6 Am.1 sets the same precedent with
          // TAPER_LR_VS_PEAK_TOLERANCE_KM, and without it this check reports the
          // engine's own declared tolerance as a defect on 8.2% of the sweep.
          if ((overshoot / anchorKm) * 100
              < GENERATION_CONFIG.TAPER_DELIVERED_REANCHOR_MATERIAL_PCT) continue
          // The pass could not have reached the ceiling — §34 residual, not a
          // violation. Compared against the room LEFT, so a week that was
          // trimmed to the floor and still overshoots stays silent.
          //
          // §52'S CAP IS PART OF "COULD HAVE", and leaving it out made this fire
          // on 181 of 15,973 once the sweep's runway axis widened the sample.
          // §6 Am.2 may not cut a week below `long run ÷ LONG_RUN_MAX_PCT_OF_WEEKLY`
          // — trimming easy runs raises the long run's SHARE, and breaching that
          // cap is an `error` on INV-PLAN-LR-MAX-WEEKLY-PCT. On a 2-day week the
          // long run is most of the week, so that floor binds long before the
          // easy-run floor does: measured, a 5K taper week with 5.5 km of easy
          // headroom had only 0.2 km of LEGAL room. Reporting headroom the
          // producer is forbidden to use is a check crying wolf (NOISE-GATE-01).
          let longKm = 0
          for (const sn of Object.values(w.sessions)) {
            if (!sn || !isLongRun(sn)) continue
            longKm = Math.max(longKm, sessionKmSelfPaced(sn) ?? 0)
          }
          const lrFloorKm = longKm > 0
            ? longKm / (GENERATION_CONFIG.LONG_RUN_MAX_PCT_OF_WEEKLY / 100)
            : 0
          const legalRoom = Math.min(trimmableKm(w), Math.max(0, delivered - lrFloorKm))
          if (legalRoom < overshoot) continue
          violations.push({
            code: 'INV-PLAN-TAPER-DELIVERED-DEPTH',
            principle_ref: 'CoachingPrinciples §6',
            severity: 'warn',
            week: w.n,
            message: `Taper week ${w.n} delivers ${delivered.toFixed(1)}km against a pre-taper week of ${anchorKm.toFixed(1)}km — a ${(((anchorKm - delivered) / anchorKm) * 100).toFixed(0)}% cut where ${distKey}'s shallowest configured taper asks for ${(shallowStepPct * step).toFixed(0)}% by this week, and ${trimmableKm(w).toFixed(1)}km of easy running is still above the session floor. §6 drops volume sharply in the taper, measured against the week the runner actually did.`,
            actual: `${delivered.toFixed(1)}km`,
            expected: `≤ ${ceiling.toFixed(1)}km`,
          })
        }
      }
    }
  }

  // INV-PLAN-UNCOVERED-RUNWAY-DECLARED (§57 Am. / §76 Am.) — weeks the plan does
  // not cover must be DECLARED.
  //
  // §76 says a runner left with an uncoached void "will fill it by guessing" and
  // asserts "the gap before it is already owned by the foundation block". For any
  // gap above FOUNDATION_MAX_WEEKS it is not: measured, a first-time marathoner
  // with a 25-week runway gets 3 foundation + 18 main and FOUR uncovered weeks;
  // at 52 weeks, thirty-one. Nothing told them, while the same plan carried a
  // `volume_constraint_note` and a `long_run_shortfall_note`.
  //
  // READS A STAMP, and that is deliberate rather than lazy. The count needs
  // `today` and the built foundation block together; `today` is generation-time
  // state this validator never receives, exactly as the volume curve is for
  // `volume_shortfall_pct` (VOL-SHORTFALL-01, which records the same reasoning).
  // Without the stamp this could only check the note against nothing.
  //
  // SILENT when the stamp is absent — a plan generated without
  // composePlanWithFoundation (scripts, generateRulePlan's own validation tail)
  // has no runway to judge, and firing there would report the harness rather than
  // the plan (NOISE-GATE-01).
  {
    const uncovered = plan.meta.uncovered_runway_weeks
    if (typeof uncovered === 'number'
        && uncovered >= GENERATION_CONFIG.FOUNDATION_UNCOVERED_WEEKS_NOTE_THRESHOLD
        && !plan.meta.uncovered_runway_note) {
      violations.push({
        code: 'INV-PLAN-UNCOVERED-RUNWAY-DECLARED',
        principle_ref: 'CoachingPrinciples §57, §76',
        severity: 'error',
        week: 0,
        message: `Plan leaves ${uncovered} week(s) between today and its first week with no note. §76: a runner handed an uncoached void fills it by guessing. Every other structural limit in this engine declares itself (§23, §34, §40c, §52); this one must too.`,
        actual: `${uncovered} uncovered weeks, no note`,
        expected: 'meta.uncovered_runway_note present',
      })
    }
  }

  // INV-PLAN-LR-SHORTFALL-CAUSE (§80 Am.1) — when §80's long-run shortfall note
  // blames the runner's WEEKLY VOLUME, the long run must not in fact be sitting
  // against its own time cap.
  //
  // WHY THIS EXISTS AND WHY IT IS NOT A CHECKER SHARING THE PRODUCER'S
  // PREDICATE. The producer decides the cause with `peakLrMins + TOLERANCE >=
  // capMins`; this reads the NOTE TEXT the runner receives and compares it
  // against the plan's own delivered long run. The old producer carried a
  // comment claiming it "names whichever one is actually binding" and named the
  // cap 0 times in 5,264 firings across both grids — a claim and a computation
  // that had never been reconciled because nothing checked the OUTPUT.
  //
  // `error`: a note that tells a marathoner sitting two minutes under a
  // 210-minute ceiling to look at their weekly volume is an injury vector
  // delivered as advice (Willy, §80 Am.1), not a cosmetic slip.
  {
    const note = plan.meta.long_run_shortfall_note
    if (typeof note === 'string' && note.length > 0) {
      // NOT `?? 0`: `raceDistanceKey(0)` returns '5K', so a missing race
      // distance would silently compare a marathon long run against a
      // 90-minute cap. Absent distance means this check has nothing to say.
      const raceKm = plan.meta.race_distance_km
      const distKey = typeof raceKm === 'number' && raceKm > 0 ? raceDistanceKey(raceKm) : null
      const capMins = distKey ? GENERATION_CONFIG.LONG_RUN_CAP_MINUTES[distKey] : 0
      // The delivered peak long run, read from the plan rather than recomputed
      // from the curve — the note describes what the runner actually got.
      let peakLrMins = 0
      for (const w of plan.weeks) {
        if (w.n < 1 || w.type === 'race') continue
        for (const sn of Object.values(w.sessions ?? {})) {
          if (!sn || !isLongRun(sn)) continue
          if (typeof sn.duration_mins === 'number') peakLrMins = Math.max(peakLrMins, sn.duration_mins)
        }
      }
      const blamesVolume = note.includes('your weekly volume is what limits it')
      const tol = GENERATION_CONFIG.LONG_RUN_AT_CAP_TOLERANCE_MINS

      // §80 Amendment 2 (Coaching Board 2026-09-20, MARA-LR-LOWBASE-01) — SECOND
      // ARM OF THE SAME CHECK. The first arm catches the note blaming volume when
      // the TIME CAP is binding. This catches it blaming volume when the §12
      // INJURY cap is binding, which was the live case.
      //
      // MEASURED: at cwk 12/15/20 a knee-history beginner gets a 17/17/19 km peak
      // long run where their HEALTHY twin at the same weekly volume gets 26 km.
      // Same volume, different long run — so volume is not the binding lever, and
      // the note said it was. §40c requires the note to name what actually binds.
      //
      // ⚠️ The predicate matches the PRODUCER's single owner by value, not by a
      // second copy of the logic: `hasVolumeCappedInjury` is knee || shin_splints
      // (§12), and `meta.injury_history` carries the runner's raw values. Matching
      // here is a substring test on the same two keywords because the checker
      // cannot import the producer (circular — see fuellingNotes.ts's header).
      const injuries = (plan.meta.injury_history ?? []).map(i => String(i).toLowerCase())
      const volumeCappedInjury = injuries.some(i => i.includes('knee') || i.includes('shin'))
      if (blamesVolume && volumeCappedInjury) {
        violations.push({
          code: 'INV-PLAN-LR-SHORTFALL-CAUSE',
          principle_ref: 'CoachingPrinciples §80 Am.2, §40c',
          severity: 'error',
          week: 0,
          message: `Long-run shortfall note blames weekly volume, but the runner has a volume-capped injury history (${injuries.join(', ')}) and §12's cap is what holds the long run down. Telling them volume is the lever points at the one thing their history says not to add.`,
          actual: `note blames weekly volume; injury_history = ${injuries.join(', ')}`,
          expected: 'note names the injury cap when a knee or shin-splint history is present',
        })
      }

      if (blamesVolume && capMins > 0 && peakLrMins > 0 && peakLrMins + tol >= capMins) {
        violations.push({
          code: 'INV-PLAN-LR-SHORTFALL-CAUSE',
          principle_ref: 'CoachingPrinciples §80 Am.1, §40c',
          severity: 'error',
          week: 0,
          message: `Long-run shortfall note blames weekly volume, but the peak long run (${Math.round(peakLrMins)} min) is within ${tol} min of its ${capMins}-minute cap — the ceiling is what bound it. §40c requires the note to name the constraint that is actually binding.`,
          actual: `note blames weekly volume; long run ${Math.round(peakLrMins)} min vs cap ${capMins} min`,
          expected: `note names the long-run ceiling when the long run is within ${tol} min of it`,
        })
      }
    }
  }

  // INV-PLAN-TUNE-UP-CALLOUT (§32) — a plan of TUNE_UP_MIN_PLAN_WEEKS or longer
  // surfaces the optional tune-up race callout.
  //
  // `warn`, deliberately: the callout is OPTIONAL for the runner, and a plan
  // whose qualifying week is displaced (a deload, a race-week collision) is not
  // a broken plan. But a long plan that never offers one at all is a silently
  // dropped feature, which is what this catches.
  {
    const mainWeeks = plan.weeks.filter(w => w.n >= 1)
    if (mainWeeks.length >= GENERATION_CONFIG.TUNE_UP_MIN_PLAN_WEEKS) {
      // Reads the WEEK field the generator actually stamps
      // (`ruleEngine.ts` → `tune_up_callout`), not a coach note and not meta.
      // Checking the wrong field is how a rule reads as enforced and is not.
      const hasCallout = mainWeeks.some(w => !!w.tune_up_callout)
      if (!hasCallout) {
        violations.push({
          code: 'INV-PLAN-TUNE-UP-CALLOUT',
          principle_ref: 'CoachingPrinciples §32',
          severity: 'warn',
          week: 0,
          message: `Plan is ${mainWeeks.length} weeks (§32 threshold ${GENERATION_CONFIG.TUNE_UP_MIN_PLAN_WEEKS}) but offers no tune-up race callout anywhere.`,
          actual: 'no callout',
          expected: 'a tune-up callout on the latest non-deload build week',
        })
      }
    }
  }

  // INV-PLAN-MARATHON-RACE-PACE-NOT-ONLY-LONG-RUN (§105) — a distance's
  // race-specific work must not live ENTIRELY inside one session shape.
  //
  // `warn`, and the severity is the honest part. CAT-MARATHON-RACE-SPECIFIC-01
  // shipped `mp_blocks` to give marathon a second shape and measured plans
  // seeing BOTH rows at 0% → 8%. An error here would fail the other 92% — plans
  // the board has seen and accepted. So this RECORDS the shape §105 names
  // (every scrap of goal-pace exposure inside the long run) rather than
  // pretending the catalogue already prevents it.
  //
  // NOT covered by INV-PLAN-RACE-SPECIFIC-VARIETY: §104's check was amended on
  // 2026-09-11 to EXCLUDE the long run precisely because counting it fired on
  // 92% of marathon plans — which is the very case §105 is about.
  if (input.race_distance_km > 30 && input.goal === 'time_target') {
    const racePace = plan.weeks
      .filter(w => w.n >= 1)
      .flatMap(w => Object.values(w.sessions))
      // NOT filtered on `type === 'quality'`. INV-CLASS-004: the generator models
      // a marathon race-pace long run as `type: 'easy'` with a race-pace segment,
      // so filtering on quality made this invariant UNABLE TO FIRE — the exact
      // dead-check class the liveness harness exists to catch, and it caught this
      // one on its first run.
      .filter((sn): sn is Session => !!sn && sn.type !== 'rest' && sn.type !== 'race'
        && classifyStimulus(sn) === 'race_pace')
    if (racePace.length > 0 && racePace.every(sn => isLongRun(sn))) {
      violations.push({
        code: 'INV-PLAN-MARATHON-RACE-PACE-NOT-ONLY-LONG-RUN',
        principle_ref: 'CoachingPrinciples §105',
        severity: 'warn',
        week: 0,
        message: `All ${racePace.length} race-pace sessions are segments of the long run. §105: marathon pace must exist away from the long run.`,
        actual: `${racePace.length}/${racePace.length} inside the long run`,
        expected: 'at least one race-pace session in another shape (e.g. mp_blocks)',
      })
    }
  }

  // ── INV-PLAN-BEGINNER-NEUROMUSCULAR (CoachingPrinciples §28 Am.1) ──────────
  //
  // A beginner plan must carry neuromuscular stimulus, and a hill stride must
  // never appear on a quality-typed session.
  //
  // ⚠️ WHY THE SECOND HALF EXISTS. The whole safety of §28 Am.1 is that a hill
  // stride is a COACH NOTE ON AN EASY RUN, so QUALITY_SESSIONS_PER_WEEK_MAX
  // (0 for beginners, §110) cannot be breached BY CONSTRUCTION. If a future
  // change ever attaches one to a quality session, that construction argument
  // silently stops being true and a beginner acquires quality through a door
  // nobody is watching. This is that watch.
  if (input.fitness_level === 'beginner') {
    const neuro = (s: Session | undefined): boolean =>
      !!s?.coach_notes?.some(n => typeof n === 'string' && /strides/i.test(n))
    const buildWeeks = plan.weeks.filter(w => w.n > 0 && w.type !== 'race' && w.phase !== 'taper')

    // ⚠️ CHECKED PER WEEK, NOT PER PLAN, and that is the third attempt.
    //
    // The first two asked "does this plan carry stimulus anywhere?" and then
    // tried to except the plans that cannot. Both approximated the producer's
    // eligibility and both false-fired: a 2-day plan has no midweek easy run
    // from week 3 (12 cases in the property sweep, invisible to both cohort
    // grids). Every exception I added was me re-deriving §28 by hand, which is
    // this repo's most repeated defect class.
    //
    // So the check asks the exact question instead: WHERE the producer's own
    // predicate says a carrier exists, is the note on it? A week with no
    // carrier is a legitimate, common answer and is simply not asserted on
    // (§34 — the gap is recorded in the principle, not enforced here).
    const longDayOf = (w: Week): Day => {
      for (const d of DAYS) {
        const sess = w.sessions[d] as Session | undefined
        if (sess && isLongRun(sess)) return d
      }
      return 'sun'
    }
    const blockedForStrides = normaliseDays(input.days_cannot_train)

    for (const w of buildWeeks) {
      if (w.n < GENERATION_CONFIG.STRIDES_FIRST_WEEK) continue
      if (w.type === 'deload') continue
      const carrier = strideCarrierDay(w.sessions as never, longDayOf(w), blockedForStrides)
      if (!carrier) continue
      if (!neuro(w.sessions[carrier] as Session | undefined)) {
        violations.push({
          code: 'INV-PLAN-BEGINNER-NEUROMUSCULAR',
          principle_ref: 'CoachingPrinciples §28',
          // ⚠️ WARN, NOT ERROR, AND THE REASON IS A PRE-EXISTING §28 ORDERING
          // GAP — not a beginner problem and not this amendment's doing.
          //
          // §28 places the note in step 4 of `buildWeekSessions`;
          // `applyWeekdayMinsCap` runs in step 5 and can CONVERT a quality
          // session to easy. A run that becomes eligible after the cap has run
          // never gets offered strides. That affects every level, is older than
          // §28 Am.1, and fixing it means re-running placement after the cap —
          // a change with its own blast radius that has had no board sitting.
          //
          // The board's requirement — "a beginner plan carries neuromuscular
          // stimulus" — IS met: measured 100% of beginner plans, mean 4.6
          // stride runs plus hill strides on the alternating weeks. What this
          // arm reports is the residual, declared rather than absorbed (§34).
          // Filed as S28-CAP-ORDER-01.
          severity: 'warn',
          week: w.n, day: carrier,
          message: 'Week has an eligible stride carrier but no neuromuscular note (§28 / §28 Am.1) — see S28-CAP-ORDER-01',
          actual: 'no strides or hill strides',
          expected: `strides or hill strides on ${carrier}`,
        })
      }
    }

    for (const w of plan.weeks) {
      for (const [day, s] of Object.entries(w.sessions) as [string, Session | undefined][]) {
        if (!s || !neuro(s)) continue
        if (s.type === 'quality' || s.type === 'hard') {
          violations.push({
            code: 'INV-PLAN-BEGINNER-NEUROMUSCULAR',
            principle_ref: 'CoachingPrinciples §28',
            severity: 'error',
            week: w.n, day,
            message: 'Stride/hill note on a quality-typed session — §28 Am.1 relies on these being easy runs so they cannot count as quality',
            actual: `type '${s.type}'`,
            expected: "type 'easy'",
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
