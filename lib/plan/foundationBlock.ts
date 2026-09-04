// FREE — infrastructure
// Foundation Block generator (CoachingPrinciples §57)
//
// A pre-plan preparation phase inserted before Week 1 when the gap between
// today and plan_start is large enough to warrant structured preparation.
// Foundation weeks carry `phase: 'foundation'` and negative `n` values
// (e.g. -2, -1, 0 for a 3-week block). Week 1 of the main plan is always n=1.

import { GENERATION_CONFIG } from './generationConfig'
import { normaliseDays } from './days'
import type { GeneratorInput } from '@/types/plan'
import type { Week } from '@/types/plan'

// ── Gap classification ─────────────────────────────────────────────────────

export type GapClass =
  | 'none'       // < 7 days — nudge only, no block
  | 'auto'       // 7–28 days — auto-generate silently
  | 'choice'     // > 28 days — surface three-option modal

export function classifyGap(gapDays: number): GapClass {
  if (gapDays < GENERATION_CONFIG.FOUNDATION_GAP_NUDGE_DAYS) return 'none'
  if (gapDays <= GENERATION_CONFIG.FOUNDATION_GAP_AUTO_DAYS) return 'auto'
  return 'choice'
}

export function gapDays(today: string, planStart: string): number {
  const t = new Date(today)
  const s = new Date(planStart)
  return Math.max(0, Math.floor((s.getTime() - t.getTime()) / 86_400_000))
}

// ── Effective baseline ─────────────────────────────────────────────────────
// When fresh_return_active, stated volume is aspirational — scale down.

export function effectiveBaseline(input: GeneratorInput): number {
  const fresh = (input.weeks_at_current_volume ?? Infinity) < GENERATION_CONFIG.FRESH_RETURN_WEEKS_THRESHOLD
  return fresh
    ? input.current_weekly_km * GENERATION_CONFIG.FRESH_RETURN_EFFECTIVE_BASELINE_FRACTION
    : input.current_weekly_km
}

// ── Foundation week count ──────────────────────────────────────────────────
// Clamps to FOUNDATION_MAX_WEEKS regardless of gap length.

export function foundationWeekCount(gapDays: number): number {
  const rawWeeks = Math.floor(gapDays / 7)
  return Math.min(rawWeeks, GENERATION_CONFIG.FOUNDATION_MAX_WEEKS)
}

// ── Foundation week themes ─────────────────────────────────────────────────

const THEMES: Record<number, string> = {
  1: 'Shake the rust off.',
  2: 'Building the base.',
  3: 'Last week before the plan proper. Keep it easy.',
}

function themeForPosition(position: number, total: number): string {
  if (total === 1) return THEMES[3]
  if (position === 1) return THEMES[1]
  if (position === total) return THEMES[3]
  return THEMES[2]
}

// ── Session builder ────────────────────────────────────────────────────────
// Foundation weeks: easy runs on training days + rest days.
// Long run placed on the last available training day (usually Sat/Sun).

const DEFAULT_DAYS: Array<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'> = [
  'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun',
]

/**
 * Floor to one decimal place, tolerant of binary floating-point representation.
 *
 * Plain `Math.floor(x * 10) / 10` is WRONG for values already at 1dp: `16.1 * 10`
 * is `160.99999999999997`, so the naive form floors it to 16.0 and silently
 * takes 100 m off the runner's week. Caught by `foundationDayFitting.test.ts`
 * within minutes of the naive version being written.
 *
 * The epsilon absorbs representation error (~1e-13) without touching genuine
 * values, which sit orders of magnitude further from the boundary. Flooring
 * rather than rounding is deliberate: `toFixed`/`Math.round` round half UP and
 * can carry a value PAST a cap the generator itself computed — the cause of
 * 1,728 INV-PLAN-FOUNDATION-BLOCK and 3,573 growth-ceiling violations before
 * this change ("got 6.2km, expected <= 6.2km").
 */
function floor1dp(km: number): number {
  return Math.floor(km * 10 + 1e-9) / 10
}

function buildFoundationSessions(
  weeklyKm: number,
  longRunKm: number,
  daysAvailable: number,
  blockedDays: string[],
  preferredLongRunDay: 'sat' | 'sun' | undefined,
): Week['sessions'] {
  // Normalise before comparing. The wizard sends full day names ('monday') and
  // DEFAULT_DAYS is short form ('mon'), so a raw `new Set(blockedDays)` matched
  // nothing and every foundation week ignored the runner's blocked days
  // (life-first, §18). Shared with the rule engine via lib/plan/days.ts so the
  // two placement paths cannot drift apart again.
  const blocked = normaliseDays(blockedDays)
  const available = DEFAULT_DAYS.filter(d => !blocked.has(d))
  const sessions: Week['sessions'] = {}
  if (!available.length || weeklyKm <= 0) return sessions

  const minEasyKm = GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.easy
  const minLongKm = GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.long
  const minRatio  = GENERATION_CONFIG.LONG_RUN_MIN_RATIO_VS_EASY
  // §64 — six training days is the upper limit for a non-elite runner; every
  // week keeps a rest day (INV-PLAN-WEEK-HAS-REST-DAY). Foundation weeks are no
  // exception, and a runner offering 7 days is telling us their schedule, not
  // asking for seven runs. Caught by the widened sweep (ADR-020): 448 foundation
  // weeks with no rest day, all of them days_available = 7.
  const maxDays   = Math.min(
    daysAvailable,
    available.length,
    GENERATION_CONFIG.MAX_TRAINING_DAYS_PER_WEEK,
  )

  // ── CB-1 §52b day-fitting — reduce DAYS, never shrink sessions ─────────────
  //
  // The old sizing floored each easy run at a hardcoded 3 km
  // (`Math.max(3, remaining / days)`) with no relationship to the long-run cap.
  // At low volume the two collided: an 8 km week gave 3.0 km easy runs and a
  // 2.8 km "Long easy" — the long run was the SHORTEST run of the week, and the
  // sessions sat under §9's floor. Measured before this shipped: 49,974
  // INV-PLAN-LONG-IS-LONGEST and 36,585 INV-PLAN-MIN-SESSION-SIZE violations
  // across 24,219 foundation weeks.
  //
  // Coaching Board CB-1 (2026-09-03): "when a runner's volume can't fill the
  // days they've offered, the coaching answer has never been smaller sessions —
  // it's fewer days" (McMillan); "consolidate, don't fragment" (Willy). Same
  // remedy §52b/INPUT-FLOOR-01 already applies to main weeks.
  //
  // A week carries a DISTINCT long run only when every §9 constraint can hold at
  // once. Searching from the most days downward: more days means smaller easy
  // runs, which improves the long-vs-easy ratio but pushes toward the size
  // floor. The largest day-count clearing the floor therefore also gives the
  // best ratio — if it fails there, no smaller count can succeed.
  let plan: { longKm: number; easyCount: number; eachKm: number } | null = null
  for (let n = maxDays; n >= GENERATION_CONFIG.FOUNDATION_MIN_SESSIONS_FOR_LONG_RUN; n--) {
    if (longRunKm < minLongKm) break            // no admissible long run at all
    const each = (weeklyKm - longRunKm) / (n - 1)
    if (each < minEasyKm) continue              // too many days for this volume
    if (longRunKm < minRatio * each) break      // inverted, and worse at fewer days
    plan = { longKm: longRunKm, easyCount: n - 1, eachKm: each }
    break
  }

  // No admissible long run — the honest object is equal easy runs. Below
  // FOUNDATION_MIN_SESSIONS_FOR_LONG_RUN, or when history caps the long run
  // below the easy runs, a week has no long run and must not label one.
  if (!plan) {
    const n = Math.max(1, Math.min(maxDays, Math.floor(weeklyKm / minEasyKm)))
    // FRESH-FLOOR-01 (2026-09-04) — hold the session at the floor when the WEEK
    // itself is smaller than one session.
    //
    // `Math.max(1, ...)` above guarantees a foundation week is never empty, and
    // that is right. But when `weeklyKm < minEasyKm` the single session it forces
    // is BELOW §9's floor by construction, and §52b has nothing left to give — it
    // reduces days, and one day is the minimum. Worked case: a returning runner on
    // 5 km/week hits §29's fresh-return path, which starts at
    // FRESH_RETURN_START_FRACTION (0.7) x 5 = a 3.5 km week; day-fitting correctly
    // lands on one run; that run IS the week, and 3.5 < 4.
    //
    // D-21: a floor a valid input cannot satisfy is a defect in the code enforcing
    // it, not an acceptable session. The remedy is the one §82 already ruled for
    // the weekday cap, one field over — hold at the floor and exceed the stated
    // number slightly, rather than ship a session that looks compliant and trains
    // nothing (§9: "too short to be coaching-meaningful"). The overshoot is at most
    // `minEasyKm` and lands on a single foundation run before the plan begins.
    //
    // Found by the input-coverage gate: `weeks_at_current_volume` had been on
    // GeneratorInput since M-02 and was never once set by the property sweep, so
    // §29's whole fresh-return path was unreachable. 1,426 violations across 660 of
    // 16,141 plans, invisible until the field was swept.
    plan = { longKm: 0, easyCount: n, eachKm: Math.max(minEasyKm, weeklyKm / n) }
  }

  const canCarryLongRun = plan.longKm > 0

  // Long-run day: honour the user's chosen day. Mirrors ruleEngine's
  // `longDayPref` — Sun by default, Sat if chosen, then Fri, then the last
  // available day. §18: never a blocked day.
  const longDayPref: Array<(typeof DEFAULT_DAYS)[number]> =
    preferredLongRunDay === 'sat' ? ['sat', 'sun', 'fri'] : ['sun', 'sat', 'fri']
  const longDay = canCarryLongRun
    ? (longDayPref.find(d => !blocked.has(d)) ?? available[available.length - 1])
    : undefined

  const longRunFinalKm = plan.longKm
  const eachKm = plan.eachKm

  const easyDays = available.filter(d => d !== longDay).slice(0, plan.easyCount)

  if (longDay) {
    sessions[longDay] = {
      type: 'easy',
      // INV-CLASS-002 — structural classification is STAMPED, never inferred
      // from the label. This session was previously identified only by the word
      // "Long" in its label, the exact D-17 coupling INV-CLASS-001 forbids.
      role: 'long_run',
      label: 'Long easy',
      detail: `${longRunFinalKm.toFixed(1)}km easy — Zone 2 throughout. No exceptions.`,
      distance_km: floor1dp(longRunFinalKm),
      zone: 'Zone 2',
      coach_notes: ['This is your longest run of the week. Keep it slow.'],
    }
  }

  for (const day of easyDays) {
    sessions[day] = {
      type: 'easy',
      label: 'Easy run',
      detail: `${eachKm.toFixed(1)}km easy — Zone 2. Conversational pace.`,
      distance_km: floor1dp(eachKm),
      zone: 'Zone 2',
      coach_notes: ['Zone 2 only. If you can\'t hold a conversation, slow down.'],
    }
  }

  // Rest days get no entry (absence = rest in the plan schema)
  return sessions
}

// ── Main generator ─────────────────────────────────────────────────────────

export interface FoundationBlockOptions {
  input: GeneratorInput
  planStartDate: string  // ISO date — first day of Week 1
  today: string          // ISO date — used for gap calculation
  /** Override week count (e.g. after user selects "Add Foundation Block") */
  forceWeeks?: number
}

export interface FoundationBlockResult {
  weeks: Week[]
  /** True if fresh_return baseline fraction was applied */
  freshReturnActive: boolean
  effectiveBaselineKm: number
}

export function generateFoundationBlock(opts: FoundationBlockOptions): FoundationBlockResult {
  const { input, planStartDate, today, forceWeeks } = opts

  const gap = gapDays(today, planStartDate)
  const weekCount = forceWeeks ?? foundationWeekCount(gap)

  const baseline = effectiveBaseline(input)
  const freshReturnActive = baseline < input.current_weekly_km

  // Cap long run at the lesser of longest_recent_run_km and 50% of weekly_km
  const maxLongRunByHistory = input.longest_recent_run_km ?? (baseline * 0.5)

  const weeks: Week[] = []
  for (let i = 0; i < weekCount; i++) {
    const position = i + 1
    // Volume: W1 = effective baseline, each subsequent week may grow by ≤ +10%.
    // Hard ceiling: effective_baseline × 1.10 (applied to every week, not just final).
    const maxCeiling = baseline * (1 + GENERATION_CONFIG.FOUNDATION_WEEKLY_INCREASE_PCT / 100)
    // FLOOR to 1dp, never round. `toFixed` rounds half-up, so a week landing on
    // 6.16 km became 6.2 — above its own +10% ceiling — and
    // INV-PLAN-FOUNDATION-BLOCK correctly flagged the generator for exceeding a
    // bound the generator itself had computed ("got 6.2km, expected <= 6.2km",
    // 3,573 occurrences). Rounding must never carry a value past a cap.
    const weeklyKm = floor1dp(
      Math.min(
        baseline * Math.pow(1 + GENERATION_CONFIG.FOUNDATION_WEEKLY_INCREASE_PCT / 100, i),
        maxCeiling,
      ),
    )

    const longRunCap = weeklyKm * (GENERATION_CONFIG.FOUNDATION_LONG_RUN_MAX_PCT / 100)
    // FLOOR, never round — same reason as weeklyKm above. A 23.1 km week caps
    // the long run at 8.085 km; `toFixed(1)` rounded that to 8.1, carrying it
    // past its own cap and tripping INV-PLAN-FOUNDATION-BLOCK ("got 8.1km,
    // expected <= 8.1km", 1,728 occurrences). Rounding must never cross a bound.
    const longRunKm = floor1dp(Math.min(maxLongRunByHistory, longRunCap))

    // Week index: count down from -(weekCount-1) to 0
    const weekN = i - weekCount  // e.g. for 3 weeks: -3, -2, -1 → but spec says ≤ 0

    // Compute the ISO date for this foundation week's start
    const weekStartDate = new Date(planStartDate)
    weekStartDate.setDate(weekStartDate.getDate() - (weekCount - i) * 7)

    const sessions = buildFoundationSessions(
      weeklyKm,
      longRunKm,
      input.days_available ?? 4,
      input.days_cannot_train ?? [],
      input.preferred_long_run_day,
    )

    weeks.push({
      n: weekN,
      date: weekStartDate.toISOString().split('T')[0],
      label: `Foundation ${position}`,
      theme: themeForPosition(position, weekCount),
      type: 'normal',
      phase: 'foundation',
      sessions,
      long_run_hrs: longRunKm > 0 ? parseFloat((longRunKm / (input.current_weekly_km > 0 ? 8 : 6)).toFixed(2)) : null,
      // FRESH-FLOOR-01 — when the floor-hold binds, the stated volume must move
      // with it, or `weekly_km` disagrees with the week's own sessions.
      //
      // NARROWLY SCOPED, and the first attempt was not. Deriving `weekly_km` by
      // summing the sessions looked more principled and was wrong: session
      // distances are ROUNDED, so the sum differs from the budget by a little on
      // EVERY foundation week, which shifted the long-run-percentage and +10%
      // arms everywhere and broke a real user's stored plan (`e876c470`) in the
      // corpus test. The budget stays authoritative; only the one case that
      // provably cannot hold a floor-sized session moves.
      //
      // The condition mirrors the sizing branch exactly: `Math.max` there binds
      // if and only if `weeklyKm < minEasyKm`, because for any larger week the
      // day-fitting picks n such that weeklyKm/n >= minEasyKm by construction.
      weekly_km: Object.keys(sessions).length > 0
        && weeklyKm < GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.easy
        ? GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.easy
        : weeklyKm,
    })
  }

  return { weeks, freshReturnActive, effectiveBaselineKm: baseline }
}
