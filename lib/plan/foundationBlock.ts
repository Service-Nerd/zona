// FREE — infrastructure
// Foundation Block generator (CoachingPrinciples §57)
//
// A pre-plan preparation phase inserted before Week 1 when the gap between
// today and plan_start is large enough to warrant structured preparation.
// Foundation weeks carry `phase: 'foundation'` and negative `n` values
// (e.g. -2, -1, 0 for a 3-week block). Week 1 of the main plan is always n=1.

import { calendarDaysBetween } from '@/lib/dates'
import { GENERATION_CONFIG } from './generationConfig'
import { sessionFloorsFor, type SessionFloors } from './sessionFloors'
import { waterFillEasyKm } from './easyDistribution'
import { normaliseDays, DAY_ORDER, type Day } from './days'
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
  // DATE-DST-01 — calendar days through the single owner. This was exact only
  // by accident (`new Date('YYYY-MM-DD')` gives UTC midnight at both ends, so
  // the DST hour cancelled); it would have broken the moment either argument
  // carried a time. `classifyGap`'s 28-day boundary is not a place to rely on
  // a coincidence.
  return Math.max(0, calendarDaysBetween(today, planStart))
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

// ── How many foundation weeks WILL be prepended — the single owner ──────────
//
// §91 (CB-ONSET-02). `computePhases` has to know this number BEFORE the block
// exists, because the base-phase on-ramp is credited against it. Two callers
// therefore need the same answer:
//
//   1. generateRulePlan  — to size the base phase (§91)
//   2. composePlanWithFoundation — to actually build the block (ADR-020)
//
// They must never derive it independently. `computePhases` reasoning from
// `nextMonday()` while `compose` reasoned from the real `today` disagreed by a
// week whenever the plan was generated ON a Monday — the two-writer split this
// codebase keeps paying for (DELOAD-OWNER-01, the deload cadence in five
// places). One function, both callers, asserted in foundationOnRamp.test.ts.
export function plannedFoundationWeeks(
  today: string,
  planStartIso: string,
  decision?: 'add' | 'skip' | 'start_now',
): number {
  const gap = gapDays(today, planStartIso)
  const cls = classifyGap(gap)
  const shouldAdd = cls === 'auto' || (cls === 'choice' && decision === 'add')
  return shouldAdd ? foundationWeekCount(gap) : 0
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
  // §92 — true when the runner passed the §89 readiness gate. Read from
  // `plan.meta.early_quality_onset` by the caller rather than recomputed here:
  // the gate has one owner (generateRulePlan) and a second evaluation of the
  // same predicate is the two-writer split DELOAD-OWNER-01 removed.
  earlyOnset = false,
  /**
   * CB-SUBFLOOR-ADMIT-01 follow-up — floors resolved FOR THIS RUNNER.
   *
   * ⚠️ MEASURED HOLE, found immediately after §113 Am.1 shipped: this module
   * kept reading the flat `GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM`, so a
   * runner whose longest run is 3 km was handed a **5.0 km foundation session
   * (+67%)** — the exact leap the amendment removed from the main plan — and it
   * landed in week -1, BEFORE the 2.9 km week 1. The first session the runner
   * ever saw was the unsafe one.
   */
  floors: SessionFloors = GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM,
  /**
   * §122 (Coaching Board 2026-10-03, FOUNDATION-BUDGET-01) — the runner's easy pace and
   * their stated weekday time budgets.
   *
   * 🔴 BEFORE THIS, FOUNDATION SESSIONS CARRIED `distance_km` AND NEVER `duration_mins`,
   * so `applyWeekdayMinsCap` and `INV-PLAN-MAX-WEEKDAY-MINS` BOTH skipped them on
   * `!s.duration_mins` — neither trimmed nor checked. Measured 2026-10-03: 47.6% of
   * foundation weekday sessions exceeded the runner's stated budget, 77.5% of plans
   * carried at least one, median +39%, worst 90 min against a stated 30. On a live plan
   * the first three Mondays were 55, 60 and 60 minutes against a stated 30 — and the
   * main plan then dropped to 34. The gentlest part of the block was its heaviest.
   *
   * ⚠️ `easyPaceMinPerKm` is NULL-ABLE and a null means DECLINE, never a default. A
   * foundation block sized against a guessed pace is worse than one sized against none.
   * Same module, one input earlier: `CB-SUBFLOOR-ADMIT-01` threaded per-runner FLOORS in
   * here after a runner got a 5.0 km session in week −1 before a 2.9 km week 1 — and the
   * time budget was not threaded. This is that thread.
   */
  easyPaceMinPerKm?: number | null,
  dayBudgets?: Partial<Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri', number>>,
  maxWeekdayMins?: number | null,
  /**
   * FOUNDATION-PACE-STRIPPED-01 — the easy pace band and HR ceiling the runner
   * SEES, from `easyTargetsFromPlan` on the generated plan. Threaded exactly as
   * `easyPaceMinPerKm` is, and for the same reason: the engine already chose
   * these strings for every easy session it placed, and a second producer would
   * be the `DELOAD-OWNER-01` class.
   *
   * ⚠️ NULL-ABLE, AND A NULL MEANS OMIT THE FIELD — never a default band. A
   * foundation session showing a pace this runner was never given is worse than
   * one showing none, which is the `?? 0` class in display clothing.
   */
  easyTargets?: { paceTarget: string | null; hrTarget: string | null },
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

  const minEasyKm = floors.easy
  const minLongKm = floors.long
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

  // §122 Amendment 1 (Coaching Board 2026-10-03, FOUNDATION-LR-S9-01) — THE FOUNDATION
  // LONG RUN CARRIES A DURATION AND IS **NOT** CAPPED BY §9.
  //
  // The submission to the board framed this as §9 (cap it) vs §81 (don't shrink it). The
  // conflict scan found it is neither, because §9 answers it itself:
  //
  //   §9: "capped by an absolute time ceiling PER RACE DISTANCE … protects against
  //        unrealistic TIME-ON-FEET FOR THE RACE."
  //
  // That is a statement about the race-directed arc. §57 says foundation weeks are "never
  // part of the main plan's periodisation arc", and `effectiveBaseline()` sizes this block
  // from `current_weekly_km` — the runner's OWN existing volume. So capping it would
  // prescribe LESS THAN THE RUNNER ALREADY RUNS, in a block whose only job is to hold what
  // they have, which is what §106 Am./§2 Am.2's detraining rule forbids.
  //
  // Measured case: a 10K runner at 50 km/week with a 20 km longest recent run, handed
  // 135-minute foundation long runs. Willy: "19 km easy, for a runner whose longest recent
  // run is 20 km, is not a tissue-tolerance event. It is maintenance." McMillan: "what a
  // coach does here is nothing."
  //
  // ⚠️ WHAT THE BOARD DID REQUIRE (Willy's and Sims's condition): the session must be
  // MEASURABLE. Carrying no duration meant neither a rule nor the runner could see the
  // time commitment of their longest session — and for the caregiving-load cohort §81 was
  // written about, that is the one number they most need.
  const paceOk = easyPaceMinPerKm != null && Number.isFinite(easyPaceMinPerKm) && easyPaceMinPerKm > 0

  // FOUNDATION-PACE-STRIPPED-01 — the targets the card reads, spread onto both
  // constructors below so the long run and the weekday runs cannot diverge.
  //
  // 🔴 THESE FIELDS WERE NEVER SET HERE, IN THIS FILE'S WHOLE HISTORY (`git log -S`
  // on either name returns nothing). Measured across 33 composed plans: **381 of
  // 381 foundation easy sessions carried no `pace_target` and no `hr_target`,
  // against 0 of 1,355 main-plan easy sessions** — so the three weeks of on-ramp
  // said "Zone 2. Conversational pace." and gave the runner no number, while the
  // identical easy run in week 1 showed both. §12 caps an easy run at the top of
  // Z2; a ceiling with no number is not a ceiling.
  //
  // ⚠️ It survived because `INV-PLAN-EFFORT-OR-PACE` — the one invariant that
  // asks "does this session tell the runner how hard to go?" — scopes itself to
  // `quality | intervals | tempo`. **Easy sessions were outside its population
  // by construction**, and a foundation block is nothing but easy sessions.
  const easyDisplay = {
    ...(easyTargets?.paceTarget ? { pace_target: easyTargets.paceTarget } : {}),
    ...(easyTargets?.hrTarget   ? { hr_target:   easyTargets.hrTarget   } : {}),
  }

  if (longDay) {
    sessions[longDay] = {
      type: 'easy',
      // INV-CLASS-002 — structural classification is STAMPED, never inferred
      // from the label. This session was previously identified only by the word
      // "Long" in its label, the exact D-17 coupling INV-CLASS-001 forbids.
      role: 'long_run',
      label: 'Long easy',
      // FOUND-ROUND-01 — the STATED number is the number, so `detail` must be
      // built from the value that ships, not from the pre-rounded input.
      // `toFixed(1)` rounds half-up while `floor1dp` floors, so a 6.66 km run
      // shipped `distance_km: 6.6` under the text "6.7km easy" — the card and
      // its own sentence disagreeing on the first screen a new runner sees.
      // Same class as §40b/§78: the runner plans against the number.
      detail: `${floor1dp(longRunFinalKm).toFixed(1)}km easy — Zone 2 throughout. No exceptions.`,
      distance_km: floor1dp(longRunFinalKm),
      // §122 Am.1 — measurable, and deliberately uncapped. See the block comment above.
      ...(paceOk ? { duration_mins: Math.round(floor1dp(longRunFinalKm) * (easyPaceMinPerKm as number)) } : {}),
      zone: 'Zone 2',
      ...easyDisplay,
      coach_notes: ['This is your longest run of the week. Keep it slow.'],
    }
  }

  // §122 — SIZE THE EASY DAYS AGAINST THE RUNNER'S STATED BUDGETS, at construction.
  //
  // The Coaching Board (2026-10-03, sitting 2) ruled the remedy STRUCTURAL rather than a
  // percentage bound, and the measurement is why: of 1,132 over-budget sessions, 339
  // could not be fixed by capping at ANY bound, because trimming to the budget drops the
  // session under §9's easy floor and §82 then holds it there. A post-hoc trim cannot
  // win; the sizing has to happen before the distance is chosen.
  //
  // ⚠️ `waterFillEasyKm` is the MAIN PLAN's distributor, extracted to
  // `easyDistribution.ts` rather than reimplemented (EASY-DISTRIBUTION-OWNER-01). It
  // fills the tightest days first so a roomy day absorbs what a tight day cannot hold,
  // preserves the weekly total, and clamps each day under its ceiling. Its floor
  // behaviour IS §82: where the ceiling sits below `floors.easy` it returns the floor,
  // which exceeds the budget on purpose rather than prescribe a session that trains
  // nothing. That case is stamped so it stays visible and declarable.
  const WEEKDAY_SET = new Set(['mon', 'tue', 'wed', 'thu', 'fri'])
  const budgetFor = (d: string): number | null =>
    WEEKDAY_SET.has(d) ? (dayBudgets?.[d as 'mon'] ?? maxWeekdayMins ?? null) : null

  const perDayKm: number[] = (() => {
    if (!paceOk) return easyDays.map(() => eachKm)   // no pace => decline to resize, never guess
    const pace = easyPaceMinPerKm as number
    const pool = eachKm * easyDays.length
    const ceilings = easyDays.map(d => {
      const b = budgetFor(d)
      return b == null ? pool : b / pace
    })
    // 🔴 THE NO-OP TEST IS PER DAY, NOT AGAINST THE POOL — and getting this wrong is
    // exactly what the control gate caught. The first cut asked `c >= pool`, comparing one
    // day's ceiling against the WHOLE week's easy volume, which is almost never true, so
    // water-filling ran and REDISTRIBUTED the week for 540 plans that already fitted their
    // budgets perfectly. A bystander's distances moved for no reason.
    //
    // The question is whether each day's intended distance already fits under its own
    // ceiling. If it does, this runner needs no resizing and the week is returned untouched.
    if (ceilings.every(c => eachKm <= c)) return easyDays.map(() => eachKm)
    // 🔴 THIS SIZING MAY ONLY EVER REDUCE A SESSION, NEVER GROW ONE — and the clamp is
    // load-bearing, not defensive. `waterFillEasyKm` BASES every day at `floorKm`, which
    // is correct for the main plan (§9's floor applies there) and WRONG here: §113
    // Amendment 1 / `CB-SUBFLOOR-ADMIT-01` deliberately ADMITS sub-floor foundation
    // sessions, because a low-base runner's on-ramp legitimately starts below the floor.
    //
    // Without the clamp this fix re-created the very defect that amendment removed —
    // caught by `INV-PLAN-FOUNDATION-BLOCK` on the Hyde Park 5K fixture (a beginner,
    // shin splints, longest run 5 km), whose foundation easy runs were pushed UP to the
    // floor by a change that exists to bring sessions DOWN to a time budget.
    //
    // So: water-fill decides how to SHARE the week across days of differing room, and the
    // clamp guarantees the answer is never larger than what the block already intended.
    const filled = waterFillEasyKm(
      ceilings, pool, Math.min(floors.easy, eachKm), GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM,
    )
    return filled.map(km => Math.min(km, eachKm))
  })()

  easyDays.forEach((day, i) => {
    const km = floor1dp(perDayKm[i] ?? eachKm)
    const mins = paceOk ? Math.round(km * (easyPaceMinPerKm as number)) : undefined
    const budget = budgetFor(day)
    sessions[day] = {
      type: 'easy',
      label: 'Easy run',
      // FOUND-ROUND-01 — see the long run above. Built from the shipped value.
      detail: `${km.toFixed(1)}km easy — Zone 2. Conversational pace.`,
      distance_km: km,
      // §122 — a foundation session carries a DURATION. Without one it is invisible to
      // every rule that guards on time, which is the root cause this fixes.
      ...(mins != null ? { duration_mins: mins } : {}),
      zone: 'Zone 2',
      ...easyDisplay,
      coach_notes: ['Zone 2 only. If you can\'t hold a conversation, slow down.'],
      // §82 — held at the floor and therefore over the stated budget, on purpose.
      ...(mins != null && budget != null && mins > budget ? { floor_protected: true } : {}),
    }
  })

  // ── §92 — strides, for a §89-gated runner only ────────────────────────────
  //
  // §57 bans strides in the foundation block. That ban was written for the
  // block's actual population — fresh-return and novice runners whose
  // musculoskeletal readiness lags their cardiovascular readiness (CB-1) — and
  // §89's gated cohort did not exist when CB-1 ruled three days earlier.
  //
  // Strides are the one form of fast running with no grey-zone risk: 15-20
  // seconds, fully recovered, neuromuscular rather than metabolic. They add no
  // Z3 minutes (§1 untouched) and are not `quality`, so they do not count
  // against INTENSITY_DISTRIBUTION or change the session's type — the week stays
  // easy/rest/cross-train and INV-PLAN-FOUNDATION-BLOCK still holds.
  //
  // A FEEL fix, not a fitness one, and recorded as such: a runner who answered
  // experienced / quality-most-weeks / bring-it-on should not open the app to a
  // fortnight identical to a beginner's (§35). Willy's condition of approval is
  // the gate itself, which carries an absolute injury veto.
  //
  // Never on the long run, and never on the day before it.
  if (earlyOnset && GENERATION_CONFIG.FOUNDATION_STRIDES_REQUIRE_EARLY_ONSET) {
    const longDayHere = Object.keys(sessions).find(d => sessions[d as Day]?.role === 'long_run')
    const dayBeforeLong = longDayHere
      ? DAY_ORDER[(DAY_ORDER.indexOf(longDayHere as Day) - 1 + 7) % 7]
      : null
    for (const day of ['wed', 'tue', 'thu', 'mon', 'fri'] as Day[]) {
      const s = sessions[day]
      if (!s || s.type !== 'easy' || s.role === 'long_run') continue
      if (day === dayBeforeLong) continue
      const note = '4×20s strides at 5K effort, full recovery between.'
      // `coach_notes` is a 3-tuple, not an array — spreading widens the type and
      // would let a fourth note through. Built positionally, same shape as §28's
      // insertion on main weeks.
      const e0 = s.coach_notes?.[0]
      const e1 = s.coach_notes?.[1]
      s.coach_notes = e0 && e1 ? [e0, e1, note] : e0 ? [e0, note] : [note]
      break   // one stride run per week, same as §28 on main weeks
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
  /**
   * §92 — the runner passed the §89 readiness gate, so this block may carry
   * strides. Passed in from `plan.meta.early_quality_onset`, never recomputed:
   * the gate has exactly one owner and a second evaluation would drift.
   */
  earlyOnset?: boolean
  /**
   * §122 — this runner's easy pace (min/km), from `easyPaceFromPlan` on the GENERATED
   * plan. Passed in rather than derived: the engine already spent this number on every
   * easy session it placed, and a second producer of it would be the `DELOAD-OWNER-01`
   * class. Absent/null => the block is not resized and sessions carry no duration, which
   * is the pre-§122 behaviour and the safe direction.
   */
  easyPaceMinPerKm?: number | null
  /**
   * FOUNDATION-PACE-STRIPPED-01 — the easy pace band and HR ceiling the runner
   * sees, from `easyTargetsFromPlan` on the GENERATED plan. Same threading and
   * same reasoning as `easyPaceMinPerKm` above; absent/null omits the fields,
   * which is the pre-fix behaviour and the safe direction.
   */
  easyTargets?: { paceTarget: string | null; hrTarget: string | null }
  /**
   * §116 (P-16) — which volume policy sizes the weeks.
   *
   * `'flat'` is §57 and the DEFAULT: `min(baseline x 1.1^i, baseline x 1.10)`,
   * which means every week from the second is `baseline x 1.10`. That is
   * correct for a gap-filler, which is what §57 was ratified as, and it is why
   * §111's named remedy was structurally impossible.
   *
   * `'ramp'` is §116: §2's rate with §3's deload cadence, climbing to a target.
   * Used only by the base-build on-ramp and only behind its flag.
   *
   * ⚠️ TWO POLICIES, ONE WEEK-BUILDER, deliberately. A second week
   * construction is the D-08 duplicate-ownership shape this repo keeps
   * recording, and `buildFoundationSessions` is where the long-run cap, the
   * session floors and the day-fitting all live.
   */
  curve?: 'flat' | 'ramp'
  /** `'ramp'` only — the pre-computed weekly volumes from `onRampCurve`. */
  rampWeeklyKm?: number[]
}

export interface FoundationBlockResult {
  weeks: Week[]
  /** True if fresh_return baseline fraction was applied */
  freshReturnActive: boolean
  effectiveBaselineKm: number
}

export function generateFoundationBlock(opts: FoundationBlockOptions): FoundationBlockResult {
  const {
    input, planStartDate, today, forceWeeks, earlyOnset = false, curve = 'flat',
    rampWeeklyKm, easyPaceMinPerKm, easyTargets,
  } = opts

  const gap = gapDays(today, planStartDate)
  // §116 — a ramp's length is decided by `onRampWeeksNeeded`, not by the gap.
  const weekCount = curve === 'ramp'
    ? (rampWeeklyKm?.length ?? 0)
    : (forceWeeks ?? foundationWeekCount(gap))

  const baseline = effectiveBaseline(input)
  const freshReturnActive = baseline < input.current_weekly_km

  // Cap long run at the lesser of longest_recent_run_km and 50% of weekly_km
  const maxLongRunByHistory = input.longest_recent_run_km ?? (baseline * 0.5)

  const weeks: Week[] = []
  // §116 — carries the previous ramp week's LONGEST RUN OF ANY KIND, not its
  // long run, so §45's progression cap binds across the week a long run first
  // APPEARS.
  //
  // ⚠️ Tracking the previous LONG RUN was the first fix and it left two cases
  // breaching: below `FOUNDATION_MIN_SESSIONS_FOR_LONG_RUN` (4) a week has no
  // long run at all, so `prevLongRun` was null exactly when the cliff happened
  // (3.2 km even-split -> 5.4 km long run, +69%). Amendment 2 measures the
  // per-RUN step, and the runner does not care which session is labelled long.
  let prevLongestRunKm: number | null = null
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
    const weeklyKm = curve === 'ramp'
      ? (rampWeeklyKm as number[])[i]
      : floor1dp(
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
    // §116 — on a RAMP the long run tracks the week, bounded by
    // `FOUNDATION_LONG_RUN_MAX_PCT` (35%, already tighter than §52's 60%).
    // Pinning it to `longest_recent_run_km` for eleven weeks would reproduce
    // §57's flatness on the single session that matters most.
    //
    // ⚠️ AND IT IS ALSO BOUNDED BY §45's WEEK-ON-WEEK PROGRESSION CAP, which
    // is the fix for a defect the first end-to-end ramp plan exposed.
    //
    // MEASURED: the longest run jumped **4.3 -> 6.7 km in one week (+56%)** on
    // 4 of 36 generatable ramps. The cause is structural, not arithmetic — a
    // week below `FOUNDATION_MIN_SESSIONS_FOR_LONG_RUN` (4) has NO long run and
    // splits evenly, so the week it crosses that threshold a long run appears
    // at 35% and the per-run step is a cliff. The WEEKLY volume rose its lawful
    // 10% throughout; the single hardest session rose 56%.
    //
    // That is precisely Willy's amendment 2 — *"the per-run doubling is the
    // load event"*, not the weekly total — and it would have shipped invisibly,
    // because the weekly cap cannot see a session-count change. Caught only by
    // generating a plan end to end and validating it, which nobody had done.
    //
    // §45's `LONG_RUN_PROGRESSION_CAP_PCT` is EXISTING doctrine, applied here
    // rather than a new number invented for the ramp.
    //
    // 🔴 AND IT IS NOT SUFFICIENT ON ITS OWN — ONRAMP-STEP-UNITS-01 (2026-09-23).
    //
    // §45's cap is RELATIVE (+20%). §116 amendment 2's bound, which
    // `INV-PLAN-ONRAMP-PER-RUN-STEP` enforces, is ABSOLUTE
    // (`WEEK1_PER_RUN_STEP_MAX_KM`, 1.5 km). **Those two agree only while the
    // long run is at or below 7.5 km**, because 20% of 7.5 is exactly 1.5.
    // Above it they diverge and the relative cap alone BREACHES the absolute
    // bound, while obeying §45 perfectly:
    //
    //     prev 8.7 km → 8.7 × 1.20 = 10.4 km → step +1.7 km against a +1.5 cap
    //
    // MEASURED: 54 of 522 §118 get-running plans built for refused marathon
    // runners, every one at `current_weekly_km` 15 (effective 10.5), firing on
    // weeks 12-15. Zero fired on week 1, so it is not a start-volume artefact.
    //
    // ⚠️ THE 2026-09-20 FIX WAS RIGHT AND ITS CORPUS WAS TOO NARROW. "36 of 36
    // generatable ramps clean" is true — of §116 ON-RAMP plans, whose long runs
    // never reach 7.5 km. §118 reuses this builder over 8-15 weeks from a higher
    // base and walks straight past the crossover. **A cap measured in different
    // units from the bound it must satisfy is not a cap** — this repo has
    // recorded that shape for FLOORS three times; this is the same failure
    // wearing a ceiling.
    //
    // So: BOTH, and the tighter one binds. No new numeric is introduced.
    const lrCapByProgression: number = prevLongestRunKm != null
      ? Math.min(
          prevLongestRunKm * (1 + GENERATION_CONFIG.LONG_RUN_PROGRESSION_CAP_PCT / 100),
          prevLongestRunKm + GENERATION_CONFIG.WEEK1_PER_RUN_STEP_MAX_KM,
        )
      : Infinity
    const longRunKm: number = curve === 'ramp'
      ? floor1dp(Math.min(longRunCap, lrCapByProgression))
      : floor1dp(Math.min(maxLongRunByHistory, longRunCap))

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
      earlyOnset,
      sessionFloorsFor(input.longest_recent_run_km),
      // §122 — pace and the runner's own stated weekday budgets.
      easyPaceMinPerKm,
      input.day_budgets,
      input.max_weekday_mins,
      // FOUNDATION-PACE-STRIPPED-01 — the targets the card reads.
      easyTargets,
    )

    weeks.push({
      n: weekN,
      date: weekStartDate.toISOString().split('T')[0],
      label: curve === 'ramp' ? `Base ${position}` : `Foundation ${position}`,
      theme: themeForPosition(position, weekCount),
      // §116 — a ramp DELOADS, and it marks them exactly as the main plan does
      // (`type: 'deload'`), so every checker that already exempts a deload
      // bounceback exempts this one too. A second marker would be a second
      // semantics for one concept — D-16.
      type: curve === 'ramp' && i > 0 && weeklyKm < (rampWeeklyKm as number[])[i - 1]
        ? 'deload'
        : 'normal',
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
        && weeklyKm < sessionFloorsFor(input.longest_recent_run_km).easy
        ? sessionFloorsFor(input.longest_recent_run_km).easy
        : weeklyKm,
    })

    // §116 — what the NEXT week's §45 cap measures against. Read off the built
    // sessions rather than the intended long run, because a week below the
    // long-run session threshold has no long run and still has a longest run.
    if (curve === 'ramp') {
      const kms = Object.values(sessions)
        .filter(x => x && x.type !== 'rest' && x.type !== 'cross-train')
        .map(x => (x as { distance_km?: number | null }).distance_km ?? 0)
      const longest = kms.length ? Math.max(...kms) : 0
      if (longest > 0) prevLongestRunKm = longest
    }
  }

  return { weeks, freshReturnActive, effectiveBaselineKm: baseline }
}
