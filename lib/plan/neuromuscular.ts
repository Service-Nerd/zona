// §28 + §28 Amendment 1 — the single owner of "which run carries this week's
// neuromuscular stimulus, and what does it say?"
//
// WHY THIS MODULE EXISTS. `INV-PLAN-BEGINNER-NEUROMUSCULAR` has to know whether
// a plan COULD have carried strides before it can fault a plan for not carrying
// them. The first cut re-implemented that eligibility inside the invariant —
// "is there an easy run that is not the long run or a shakeout" — and it was
// wrong in a way the cohort grid could not see and the property sweep could:
// **12 cases, every one a 2-day plan.** §28 also requires the day to be in
// `STRIDE_PREFERRED_DAYS` (which excludes Saturday and Sunday) and not blocked
// by the day-before-long-run or day-after-quality rules. A two-day runner on
// Saturday and Sunday has an eligible easy run by the invariant's reading and
// no carrier by §28's.
//
// A checker re-deriving the producer's predicate is this repo's most repeated
// defect class (deloadCadence, supersedeCoverage, tierResolution). So the
// predicate lives here and BOTH sides call it.

import type { Session, Week } from '@/types/plan'
import type { Day } from './days'
import { GENERATION_CONFIG } from './generationConfig'
import { isLongRun, isShakeout } from './sessionRole'

/** DAY_ORDER-aligned. Sat and Sun are absent on purpose: Sunday is the long run
 *  for most runners and Saturday is the day before it. */
export const STRIDE_PREFERRED_DAYS: readonly Day[] = ['wed', 'tue', 'thu', 'mon', 'fri']

const DAYS: readonly Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

/**
 * The day that carries this week's stride/hill note, or `null` when the week
 * cannot carry one.
 *
 * `null` is a legitimate, common answer — see the 2-day case above. §34: the
 * gap is recorded, not enforced.
 */
export function strideCarrierDay(
  sessions: Partial<Record<Day, Session | undefined>>,
  longDay: Day,
  blocked: ReadonlySet<Day>,
): Day | null {
  const blockedFromStrides = new Set<Day>()
  // Not the day before the long run (heavy legs)...
  blockedFromStrides.add(DAYS[(DAYS.indexOf(longDay) - 1 + 7) % 7]!)
  // ...nor the day after a quality session (recovery day).
  for (const d of DAYS) {
    if (sessions[d]?.type === 'quality') {
      blockedFromStrides.add(DAYS[(DAYS.indexOf(d) + 1) % 7]!)
    }
  }
  const eligible = (d: Day): boolean => {
    if (blocked.has(d) || blockedFromStrides.has(d)) return false
    const s = sessions[d]
    if (!s || s.type !== 'easy') return false
    if (isLongRun(s) || isShakeout(s)) return false
    return true
  }
  for (const d of STRIDE_PREFERRED_DAYS) {
    if (eligible(d)) return d
  }
  // §28 Amendment 3 (Coaching Board 2026-09-24, S28-WEEKEND-CARRIER-01) —
  // FALLBACK, NOT A NEW TARGET. Midweek is searched first above and Wednesday is
  // still preferred; this only runs when midweek yielded nothing.
  //
  // §28's own WHY justifies EASY ("legs fresh enough to execute proper form")
  // and gives no mechanism for MIDWEEK. Without this, 12.8% of plans
  // (1,824/14,230) carry a week with no neuromuscular stimulus at all, and the
  // live 9-week case got strides on ONE session in nine weeks.
  //
  // ⚠️ The day this returns is almost always the day AFTER the long run —
  // measured, of 17,434 carrier-less weeks, allowing any easy day recovers
  // 10,410 (59.7%) and barring the post-long-run day recovers 0 (0.0%). The
  // board accepted FLAT strides there and refused HILL strides; that half of the
  // ruling is enforced in `isHillStrideWeek`, which takes the carrier day.
  if (!GENERATION_CONFIG.STRIDE_CARRIER_FALLBACK_ENABLED) return null
  for (const d of DAYS) {
    if (STRIDE_PREFERRED_DAYS.includes(d)) continue   // already tried
    if (eligible(d)) return d
  }
  return null
}

/**
 * §28 Am.3 — is this carrier the day AFTER the long run?
 *
 * ⚠️ SHARED BY THE PRODUCER AND THE CHECKER, deliberately. The whole reason this
 * module exists is that `INV-PLAN-STRIDES-PRESENT` re-derived
 * `strideCarrierDay`'s predicate by hand and diverged from it
 * (STRIDES-CHECKER-OWNER-01, 2026-09-24). Adding a second predicate and writing
 * it out twice would repeat the defect one function later.
 */
export function isDayAfterLongRun(day: Day, longDay: Day): boolean {
  return day === DAYS[(DAYS.indexOf(longDay) + 1) % 7]
}

/**
 * §21 — the single owner of "does this runner's history bar hill work?".
 *
 * ⚠️ THIS EXISTED THREE TIMES BEFORE IT EXISTED ONCE. The same expression was
 * written out in `ruleEngine`'s catalogue selector, in `invariants`' §21 check,
 * and was about to be written a fourth time here. That is the producer/checker
 * split this repo has paid for in `deloadCadence`, `tierResolution` and §47's
 * positions-vs-pairs: a predicate two sides must agree on gets ONE owner.
 */
export function hasHillRestrictingInjury(injuryHistory: readonly string[] | undefined): boolean {
  return (injuryHistory ?? []).some(i =>
    GENERATION_CONFIG.HILL_RESTRICTING_INJURIES.some(k => i.toLowerCase().includes(k)))
}

/**
 * §28 Am.1 — for a BEGINNER, every Nth stride week becomes a hill-stride week.
 *
 * ⚠️ ALTERNATES, NEVER ADDS. On a hill week the stride run BECOMES the hill
 * run. A hill run alongside the stride run would double the weekly
 * neuromuscular dose; the board authorised hills "dosed like §28's strides".
 *
 * 🔴 §21 GATE — ADDED 2026-09-19, AND IT CLOSED A LIVE SAFETY DEFECT.
 * §28 Am.1 shipped on 2026-09-18 without consulting `injury_history`, so a
 * knee-history beginner was prescribed "6×10s hill strides up a moderate
 * gradient" in weeks 5 and 9 — with 'knee' in `HILL_RESTRICTING_INJURIES` and
 * §21 barring exactly that.
 *
 * ⚠️ IT WAS INVISIBLE BECAUSE THE LABEL LIED. `INV-PLAN-INJURY-NO-HILLS`
 * classifies by matching the session LABEL, and the label was
 * `Easy run — Zone 2` while the coach note said hill strides. The invariant was
 * looking straight at the session and could not see it. It surfaced the moment
 * STRIDE-VISIBILITY-01 made the label tell the truth — the D-17 failure mode
 * (never couple logic to a display string) catching itself.
 *
 * A barred runner still gets §28's flat strides every stride week, which is the
 * alternation collapsing to its safe arm, not a loss of stimulus.
 */
export function isHillStrideWeek(
  weekN: number, fitnessLevel: string | undefined, injuryHistory?: readonly string[],
  onPostLongRunDay = false,
): boolean {
  if (fitnessLevel !== 'beginner') return false
  if (hasHillRestrictingInjury(injuryHistory)) return false
  // 🔴 §28 Am.3, WILLY'S BOUND — never hills on the day after the long run.
  //
  // §28 Am.1's case for hill strides is that they are ECCENTRIC-HEAVY ("it
  // builds exactly the tissue stiffness that pure easy volume does not"), and
  // they were authorised "dosed like §28's strides" on a FRESH midweek day. The
  // Am.3 fallback lands on this cohort's most fatigued easy day, where that same
  // eccentric loading is the wrong stimulus. The alternation collapses to its
  // safe arm — the identical collapse §28 Am.2 applies for injury history — so
  // the runner still gets flat strides, not nothing.
  if (onPostLongRunDay && GENERATION_CONFIG.STRIDE_POST_LONG_RUN_FLAT_ONLY) return false
  return (weekN - GENERATION_CONFIG.STRIDES_FIRST_WEEK)
    % GENERATION_CONFIG.BEGINNER_HILL_STRIDE_EVERY_N_WEEKS === 0
}

export function neuromuscularNote(
  weekN: number, fitnessLevel: string | undefined, injuryHistory?: readonly string[],
  onPostLongRunDay = false,
): string {
  return isHillStrideWeek(weekN, fitnessLevel, injuryHistory, onPostLongRunDay)
    ? '6×10s hill strides up a moderate gradient, walk back down. Not a hard session: short, fast, then recover fully.'
    : '4×20s strides at 5K effort, full recovery between.'
}

/**
 * STRIDE-VISIBILITY-01 (SLT 2026-09-18, built 2026-09-19) — the label says the
 * session carries strides.
 *
 * §28 places strides on one midweek easy run from week 3 — measured, **100% of
 * eligible weeks across 22,558 weeks in the corpus**, mean 10.1 stride runs per
 * plan — and every one of them was labelled `Easy run — Zone 2`, byte-identical
 * to a plain easy run. The runner did the work for months and the plan never
 * said so.
 *
 * ⚠️ DERIVED FROM THE STRUCTURAL FACT, NEVER PARSED BACK (D-17). This is called
 * at the point the note is placed, because that is where "strides were placed"
 * is known. Nothing branches on the resulting string — the enricher rewrites
 * labels, which is exactly why `role` and `catalogue_id` exist.
 *
 * ⚠️ WOOD'S BINDING CONDITION: descriptive, never congratulatory. It names what
 * the session contains. No chip, no badge, no encouragement, and no change to
 * the description — those were explicitly excluded from the ruling.
 */
export function neuromuscularLabel(
  baseLabel: string, weekN: number, fitnessLevel: string | undefined, injuryHistory?: readonly string[],
  onPostLongRunDay = false,
): string {
  if (/\+ (strides|hill strides)/.test(baseLabel)) return baseLabel   // idempotent
  const kind = isHillStrideWeek(weekN, fitnessLevel, injuryHistory, onPostLongRunDay) ? 'hill strides' : 'strides'
  // Insert before the zone suffix so the existing "— Zone N" convention holds.
  const m = baseLabel.match(/^(.*?)(\s+—\s+Zone\s+.*)$/)
  return m ? `${m[1]} + ${kind}${m[2]}` : `${baseLabel} + ${kind}`
}

/** Does any session in this week carry the note? Used by the invariant. */
export function weekHasNeuromuscular(w: Week): boolean {
  return Object.values(w.sessions).some(s =>
    (s as Session | undefined)?.coach_notes?.some(n => typeof n === 'string' && /strides/i.test(n)) ?? false)
}
