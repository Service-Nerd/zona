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

export type Severity = 'error' | 'warn'

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

function isLongRun(s: Session): boolean {
  return s.type === 'easy' && (s.label?.toLowerCase().includes('long') ?? false)
}

function isShakeout(s: Session): boolean {
  return s.label?.toLowerCase().includes('shakeout') ?? false
}

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
    const isRaceWeek = w.type === 'race'
    const sessions = Object.entries(w.sessions) as [Day, Session | undefined][]
    const placedRunning = sessions
      .filter(([, s]) => !!s && s.type !== 'strength' && s.type !== 'rest')
      .map(([d, s]) => ({ day: d, session: s! }))

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

    // INV-PLAN-RACE-SPECIFIC-EXPOSURE — time-targeted plans get race-specific
    // quality in second-half build/peak weeks. VO2max sessions exempt — their
    // physiology is too valuable to lose. (CoachingPrinciples §22)
    if (isTimeTarget && w.n > halfWeek && (w.phase === 'build' || w.phase === 'peak') && w.type !== 'deload') {
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

    // INV-PLAN-LABEL-MATCHES-PACE — VO2max-named sessions land in Z4–Z5;
    // threshold/tempo/cruise-named sessions land in Z3.
    // (CoachingPrinciples §19 — session name carries physiological meaning.)
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
    }

    // INV-PLAN-MIN-SESSION-SIZE — every placed session ≥ MIN_SESSION_DISTANCE_KM
    // (CoachingPrinciples §9 — "Below these, the session is too short to be coaching-meaningful.")
    for (const { day, session } of placedRunning) {
      if (session.type === 'race' || isShakeout(session)) continue  // exempt
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
    if (long) {
      const qualities = placedRunning.filter(({ session }) => session.type === 'quality')
      for (const q of qualities) {
        if (dayGap(q.day, long.day) < minDaysQualLong) {
          violations.push({
            code: 'INV-PLAN-QUALITY-LONG-SPACING',
            principle_ref: 'CoachingPrinciples §7',
            severity: 'error',
            week: w.n, day: q.day,
            message: 'Quality session too close to long run',
            actual: dayGap(q.day, long.day),
            expected: `≥ ${minDaysQualLong} day(s)`,
          })
        }
      }
    }

    // INV-PLAN-QUALITY-EXPECTED — build/peak/taper non-deload weeks with
    // intermediate/experienced fitness and no quality suppression must place
    // at least one quality session, unless every eligible day is blocked.
    // (CoachingPrinciples §1, §6, §8 — quality work drives fitness adaptation
    // beyond base aerobic capacity. Skipping it across an entire build/peak
    // phase is a coaching defect, not a tuning choice.)
    if (!isRaceWeek && w.phase && w.phase !== 'base' && w.type !== 'deload') {
      const planFitness = plan.meta.fitness_level
      const hsr = input.hard_session_relationship
      const hasAchilles = (input.injury_history ?? []).some(i => i.toLowerCase().includes('achilles'))
      const expectQuality = (planFitness === 'intermediate' || planFitness === 'experienced')
        && hsr !== 'avoid' && !hasAchilles
      if (expectQuality) {
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
