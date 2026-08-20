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
import { isLongRun, isShakeout } from './sessionRole'
// Date helpers live in length.ts — the single owner of plan date arithmetic (D-08).
import { parseDateLocal, formatDate } from './length'

export type Severity = 'error' | 'warn'

// Registry of every invariant code defined in this file. Used by the meta-check
// in scripts/r2-coverage-check.ts to assert that each code is mechanically
// enforced — adding a code here without enforcement (or vice versa) is a defect.
// (CoachingPrinciples §34, R2/H-04)
export const INVARIANT_CODES = [
  'INV-PLAN-NO-SESSIONS-ON-BLOCKED-DAYS',
  'INV-PLAN-COACH-NOTES-MATCH-INTENT',
  'INV-PLAN-LABEL-MATCHES-PACE',
  'INV-PLAN-INJURY-NO-HILLS',
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
  'INV-PLAN-LR-PROGRESSION-CAP',
  'INV-PLAN-PEAK-VOLUME-FLOOR-LONG-RACES',
  'INV-PLAN-PEAK-LR-ALTERNATION',
  'INV-PLAN-TAPER-DURATION-CAP',
  'INV-PLAN-RETURNING-RUNNER-NOTE-PRESENT',
  'INV-PLAN-QUALITY-VARIETY-FULL-PLAN',
  'INV-PLAN-LR-MAX-WEEKLY-PCT',
  'INV-PLAN-HR-ASSUMPTIONS-SURFACED',
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
  const fitness = input.fitness_level
  const qualityMaxPerWeek = fitness ? GENERATION_CONFIG.QUALITY_SESSIONS_PER_WEEK_MAX[fitness] : undefined
  const minHoursQualLong = GENERATION_CONFIG.MIN_HOURS_BETWEEN_QUALITY_AND_LONG
  const minDaysQualLong = Math.ceil(minHoursQualLong / 24)
  const blocked = parseBlockedDays(input)
  const totalWeeks = plan.weeks.length
  const halfWeek = Math.ceil(totalWeeks / 2)
  const isTimeTarget = input.goal === 'time_target'

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
    for (const [day, session] of sessions) {
      if (!session || session.type === 'rest') continue
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
        const label = (session.label ?? '').toLowerCase()
        const isVo2 = label.includes('vo2max') || label.includes('vo2 max')
        if (isVo2) continue
        if (!label.includes('pace')) {
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
      const isGoalPace = label.includes('-pace intervals') || label.includes('hm-pace') || label.includes('mp ') || label.includes('mp.')

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
    // (knee, ITB, Achilles, shin, calf, plantar) get no hill sessions in
    // base/build phases. (CoachingPrinciples §21)
    if (w.phase === 'base' || w.phase === 'build') {
      const hasRestricting = (input.injury_history ?? []).some(i => {
        const lower = i.toLowerCase()
        return GENERATION_CONFIG.HILL_RESTRICTING_INJURIES.some(k => lower.includes(k))
      })
      if (hasRestricting) {
        for (const { day, session } of placedRunning) {
          const label = (session.label ?? '').toLowerCase()
          if (label.includes('hill')) {
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
      const expected = isLong ? minDist.long : session.type === 'quality' ? minDist.quality : minDist.easy
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
      const planFitness = plan.meta.fitness_level
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
      const label = quality.label ?? ''
      const pace = quality.pace_target ?? ''
      if (prev && prev.label === label && prev.pace === pace) {
        violations.push({
          code: 'INV-PLAN-TAPER-VARIETY',
          principle_ref: 'CoachingPrinciples §36',
          severity: 'error',
          week: tw.n,
          message: `W${tw.n} repeats W${prev.weekN}'s taper quality (${label} @ ${pace}). Vary the stimulus.`,
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
      // Step-back from a deload — accept up to pre-deload distance.
      if (prev.type === 'deload') {
        const preDeload = i >= 2 ? longRunForWeek(plan.weeks[i - 2]) : null
        if (preDeload != null && currLR <= preDeload * stepBackTol + 0.01) continue
      }
      const allowedJumpKm = Math.max(prevLR * capPct, capAbs)
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
        const label = (s.label ?? '').trim()
        if (!label) continue
        labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1)
        totalQuality++
      }
    }
    if (totalQuality > 0) {
      const cap = Math.floor(totalQuality / GENERATION_CONFIG.QUALITY_VARIETY_DENOMINATOR)
        + GENERATION_CONFIG.QUALITY_VARIETY_ALLOWANCE
      for (const [label, count] of Array.from(labelCounts)) {
        if (count > cap) {
          violations.push({
            code: 'INV-PLAN-QUALITY-VARIETY-FULL-PLAN',
            principle_ref: 'CoachingPrinciples §53',
            severity: 'error',
            week: 0,
            message: `Quality session label "${label}" appears ${count} times across ${totalQuality} quality sessions; cap is floor(${totalQuality}/${GENERATION_CONFIG.QUALITY_VARIETY_DENOMINATOR})+${GENERATION_CONFIG.QUALITY_VARIETY_ALLOWANCE} = ${cap}.`,
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
      // The assertion is that the peak phase REACHES the plan's maximum — not
      // that the maximum occurs there first. Hitting the ceiling in build and
      // holding it through peak is a legitimate plateau, and an earlier-first
      // occurrence is not evidence of the ratchet this guards against.
      const peakPhaseReachesMax = peakPhase.some(w => w.weekly_km >= maxKm)
      if (!peakPhaseReachesMax) {
        const highest = nonDeload.find(w => w.weekly_km === maxKm)!
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
        // Volume cap: no foundation week may exceed stated current_weekly_km.
        // (The effective baseline ≤ stated_km, so this is a safe upper bound
        // without requiring the input object here.)
        const statedKm = input.current_weekly_km ?? 0
        if (statedKm > 0 && fw.weekly_km > statedKm * 1.001) {
          violations.push({
            code: 'INV-PLAN-FOUNDATION-BLOCK',
            principle_ref: 'CoachingPrinciples §57',
            severity: 'error',
            week: fw.n,
            message: `Foundation week W${fw.n} volume ${fw.weekly_km}km exceeds stated current_weekly_km ${statedKm}km`,
            actual: `${fw.weekly_km}km`,
            expected: `≤ ${statedKm}km`,
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
  const input: GeneratorInput = {
    race_date:             m.race_date,
    race_distance_km:      m.race_distance_km,
    goal:                  m.goal ?? 'finish',
    current_weekly_km:     0,   // not on meta — dependent invariants self-skip on 0
    longest_recent_run_km: 0,   // not on meta — dependent invariants self-skip on 0
    days_available:        m.days_available ?? 7,
    age:                   m.age ?? 40,
    fitness_level:         m.fitness_level,
    training_age:          m.training_age,
    injury_history:        m.injury_history,
    hard_session_relationship: m.hard_session_relationship,
    benchmark:             m.benchmark,
    days_cannot_train:     [], // not on meta — blocked-days invariant skipped (see doc)
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
