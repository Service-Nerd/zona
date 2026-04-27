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
  'INV-PLAN-THEME-MATCHES-PRESCRIPTION',
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
  'INV-PLAN-LR-PROGRESSION-CAP',
  'INV-PLAN-PEAK-VOLUME-FLOOR-LONG-RACES',
  'INV-PLAN-PEAK-LR-ALTERNATION',
] as const

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

    // INV-PLAN-THEME-MATCHES-PRESCRIPTION — weekly theme must not contradict
    // the prescription. "highest volume" / "fitness is built" requires
    // overload vs prior non-deload week; "intensity stays" requires ≥1
    // quality session. (CoachingPrinciples §27)
    {
      const themeText = (w.theme ?? '').toLowerCase()
      const qualityCount = Object.values(w.sessions).filter(s => s?.type === 'quality').length
      const prevNonDeload = plan.weeks.slice(0, plan.weeks.indexOf(w)).reverse().find(p => p.type !== 'deload')

      if ((themeText.includes('highest volume') || themeText.includes('fitness is built'))
          && prevNonDeload
          && w.weekly_km <= prevNonDeload.weekly_km) {
        violations.push({
          code: 'INV-PLAN-THEME-MATCHES-PRESCRIPTION',
          principle_ref: 'CoachingPrinciples §27',
          severity: 'error',
          week: w.n,
          message: `Theme implies overload but weekly_km ${w.weekly_km}km ≤ prior non-deload ${prevNonDeload.weekly_km}km`,
          actual: `${w.weekly_km}km vs ${prevNonDeload.weekly_km}km`,
          expected: `> ${prevNonDeload.weekly_km}km`,
        })
      }
      if (themeText.includes('intensity stays') && qualityCount === 0) {
        violations.push({
          code: 'INV-PLAN-THEME-MATCHES-PRESCRIPTION',
          principle_ref: 'CoachingPrinciples §27',
          severity: 'error',
          week: w.n,
          message: `Theme says "intensity stays" but week has 0 quality sessions`,
          actual: 0,
          expected: '≥ 1 quality session',
        })
      }
      // R2/L-02 — "It will feel hard" / "feel hard" effort copy must coincide
      // with at least one quality session.
      if ((themeText.includes('feel hard') || themeText.includes('feels hard')) && qualityCount === 0) {
        violations.push({
          code: 'INV-PLAN-THEME-MATCHES-PRESCRIPTION',
          principle_ref: 'CoachingPrinciples §41',
          severity: 'error',
          week: w.n,
          message: `Theme says "feel hard" but week has 0 quality sessions`,
          actual: 0,
          expected: '≥ 1 quality session',
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

  // INV-PLAN-RACE-SPECIFIC-LONG-RUN — time-targeted HM/marathon plans need
  // at least one peak-phase long run with race-pace finish.
  // (CoachingPrinciples §25)
  if (isTimeTarget && (distKey === 'HM' || distKey === 'MARATHON')) {
    const peakLongRuns = plan.weeks
      .filter(w => w.phase === 'peak' && w.type !== 'deload')
      .flatMap(w => Object.values(w.sessions).filter((s): s is Session =>
        !!s && s.type === 'easy' && (s.label?.toLowerCase().includes('long') ?? false)
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
          s && s.type === 'easy' && (s.label?.toLowerCase().includes('long') ?? false)
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
    const w1 = plan.weeks[0]?.weekly_km ?? 0
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
        !!s && s.type === 'easy' && (s.label?.toLowerCase().includes('long') ?? false)
      )
      return long?.distance_km ?? null
    }
    for (let i = 1; i < plan.weeks.length; i++) {
      const prev = plan.weeks[i - 1]
      const curr = plan.weeks[i]
      if (curr.type === 'race') continue
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

  // INV-PLAN-PEAK-LR-ALTERNATION — within peak phase, no two consecutive
  // weeks may both carry a peak-level long run (≥ PEAK_LR_ALTERNATION_THRESHOLD_PCT
  // of the plan's peak LR distance AND with race-pace segments).
  // (CoachingPrinciples §47) Exception: hard_session_relationship: 'love',
  // no injury_history, training_age '5yr+' may have ONE occurrence per plan.
  {
    const peakWeeks = plan.weeks.filter(w => w.phase === 'peak' && w.type !== 'deload')
    if (peakWeeks.length >= 2) {
      const peakLrKms = peakWeeks.map(w => {
        const lr = Object.values(w.sessions).find(s =>
          !!s && s.type === 'easy' && (s.label?.toLowerCase().includes('long') ?? false)
        )
        return lr?.distance_km ?? 0
      })
      const maxPeakLrKm = peakLrKms.length > 0 ? Math.max(...peakLrKms) : 0
      const threshold = (GENERATION_CONFIG.PEAK_LR_ALTERNATION_THRESHOLD_PCT / 100) * maxPeakLrKm
      const isPeakLevel = (week: typeof plan.weeks[number]): boolean => {
        const lr = Object.values(week.sessions).find(s =>
          !!s && s.type === 'easy' && (s.label?.toLowerCase().includes('long') ?? false)
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
