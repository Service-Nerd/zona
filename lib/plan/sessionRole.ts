// Single owner (D-08/D-16) of "what kind of session is this" for the two
// classifications that share `type: 'easy'` — the long run and the race-week
// shakeout. Both used to be told apart by matching words in the display label,
// which the AI enricher rewrites — silently breaking classification and, via the
// post-enrich invariant re-validation, reverting whole enriched plans to rule
// copy (D-17: never couple logic to a display string).
//
// The generator stamps `Session.role` at construction. These predicates read it.
// Legacy plans (generated before `role` existed) have no stamp, so they fall
// back to the original label heuristic — correct for those, and never reached
// once a plan carries the stamp.
import type { Session, SessionType } from '@/types/plan'
import { GENERATION_CONFIG } from './generationConfig'

// A session the engine models as `type: 'easy'`. Kept narrow so callers pass a
// real classification signal, not a bare string.
type ClassifiableSession = { type?: SessionType | string; role?: Session['role']; label?: string | null }

export function isLongRun(s: ClassifiableSession): boolean {
  // Explicit long type (legacy/hand-authored gist/manual entry) is authoritative.
  if (s.type === 'long') return true
  if (s.role) return s.role === 'long_run'
  return s.type === 'easy' && (s.label?.toLowerCase().includes('long') ?? false)
}

export function isShakeout(s: ClassifiableSession): boolean {
  if (s.role) return s.role === 'shakeout'
  return s.label?.toLowerCase().includes('shakeout') ?? false
}

/**
 * The §78 recalibration benchmark — the 5K time trial.
 *
 * `type === 'hard'` is structural and exact: `applyRecalibrationTimeTrial()`
 * in `ruleEngine.ts` is the ONLY producer of that type anywhere in the
 * codebase, and it is the type that keeps the trial out of §1's quality
 * numerator. Deliberately NOT the label, which the enricher may rewrite
 * (D-17), and not `meta.recalibration_weeks`, which would make this depend on
 * two fields staying in step.
 *
 * `enrich.ts` reached this same conclusion independently and wrote the
 * predicate out by hand; naming it once here is the D-08 fix for that. Because
 * it reads a field every existing plan already carries, it needs no new stamp
 * and classifies plans generated before it existed.
 */
export function isTimeTrial(s: ClassifiableSession): boolean {
  return s.type === 'hard'
}

/**
 * The canonical COACHING classification for a session, as a string. This is the
 * single source of truth for the `sessionType` signal that the coaching engine
 * (planAdjustment, limiter, manualSessionFeedback, readiness) branches on.
 *
 * The generator models long runs as `type: 'easy'`, so `session.type` alone is
 * NOT the coaching class — a long run must classify as `'long'` or every
 * long-run coaching path (fatigue/readiness trim, HARD_TYPES gating, spacing)
 * silently misses it. Always derive the signal through here, never from a raw
 * `session.type`.
 */
/**
 * QUALITY-TYPE-NO-OWNER-01 (Coaching Board 2026-10-24) — three questions, three owners.
 *
 * There were 42 hand-written type sets answering "is this a quality session", in at least eight shapes, and they
 * disagreed on `hard` and `long`. Measured, they were three different questions sharing one word:
 *
 *   isQualitySession  a training STIMULUS: what §1 and §8 count, what ENGINE-01 was calibrated on. Not the time trial:
 *                     §78 types it `hard` so a benchmark never consumes a quality slot ("a measurement, not a
 *                     training stimulus").
 *   isHardEffort      was it EFFORTFUL: RPE checks, fatigue flags, the coaching flag, the copy. Includes the time trial.
 *   isHardDay         is it a STRESSOR for spacing (§7: "a quality session and a long run ... cannot be back-to-back"),
 *                     the post-race blackout (§62) and the morning push's key session. Includes the long run, by ROLE.
 *
 * ⚠️ THE LONG RUN IS NEVER `type: 'long'`. It is `easy` + `role: 'long_run'`, and `intervals`, `tempo` and `long` occur in
 * no generated or stored plan (measured: 5,664 cohort plans, 36 production plans). Five sets named `long` to catch the
 * long run and never did; three of them were defects against written doctrine. The legacy `intervals`/`tempo` stay in
 * the sets so a stored plan that ever carried them still classifies.
 */
const QUALITY_TYPE_SET: ReadonlySet<string> = new Set(['quality', 'intervals', 'tempo'])
const HARD_EFFORT_TYPE_SET: ReadonlySet<string> = new Set([...Array.from(QUALITY_TYPE_SET), 'hard'])

/** For a caller holding only a type string. */
export function isQualityType(t: string | null | undefined): boolean { return t != null && QUALITY_TYPE_SET.has(t) }
/** For a caller holding only a type string. */
export function isHardEffortType(t: string | null | undefined): boolean { return t != null && HARD_EFFORT_TYPE_SET.has(t) }

export function isQualitySession(s: ClassifiableSession | null | undefined): boolean { return !!s && isQualityType(s.type) }
export function isHardEffort(s: ClassifiableSession | null | undefined): boolean { return !!s && isHardEffortType(s.type) }
export function isHardDay(s: ClassifiableSession | null | undefined): boolean { return !!s && (isHardEffort(s) || isLongRun(s)) }
/** `isHardDay` for a caller holding a `coachingSessionType` label ('long' for the long run) rather than the session. */
export function isHardDayLabel(label: string | null | undefined): boolean { return label === 'long' || isHardEffortType(label) }

export function coachingSessionType(s: ClassifiableSession): string {
  if (isLongRun(s)) return 'long'
  return (s.type as string) ?? 'easy'
}

/**
 * The STIMULUS a quality session delivers — the axis `STIMULUS_RANK` orders.
 *
 * Moved here from ruleEngine.ts (2026-08-20, SC-07). It was a private helper
 * there while invariants.ts independently grew `label.includes('vo2max')` checks
 * in half a dozen places. SC-07 needed the same answer in both files, and a
 * third copy is precisely the drift D-17 warns about — so it lives with the
 * other classifiers instead.
 *
 * CLASSIFY-STIMULUS-01 (2026-08-21) — the generator now stamps `Session.stimulus`
 * at construction and this reads it first, the same remedy `role` applied to the
 * long run. The label heuristic below is the LEGACY FALLBACK: plans generated
 * before the stamp, and the case D-17 warns about — an AI enricher rewriting a
 * session name can no longer reclassify a stamped session. The stamp is taken
 * from the trusted generator label (never `catalogue_id` → row.category, which
 * would mis-map a threshold row re-prescribed at goal pace as `tempo` rather than
 * `race_pace` — §22 makes those two things different on purpose). The category is used only as the FALLBACK when
 * the label reads as nothing (`STIMULUS_OF_CATEGORY`, STIMULUS-FROM-CATALOGUE-01), never ahead of it.
 */
export function classifyStimulus(
  session: { label?: string | null; zone?: string | null; stimulus?: keyof typeof GENERATION_CONFIG.STIMULUS_RANK },
): keyof typeof GENERATION_CONFIG.STIMULUS_RANK | null {
  if (session.stimulus) return session.stimulus
  const label = (session.label ?? '').toLowerCase()
  const zone  = (session.zone  ?? '').toLowerCase()
  // VO2max is unambiguous — drives off both label and zone.
  if (label.includes('vo2') || zone.includes('zone 4–5') || zone.includes('zone 5')) return 'vo2max'
  // Goal-pace and tempo both sit at rank 4 (race_pace / tempo). Distinguish for
  // the audit log; rank is identical so escalation logic isn't affected.
  if (label.includes('-pace') || label.includes('goal pace') || label.includes('sharpener')) return 'race_pace'
  if (label.includes('tempo') || label.includes('cruise') || label.includes('threshold') || label.includes('progressive')) return 'tempo'
  if (label.includes('hill'))  return 'hills'
  if (label.includes('strid')) return 'strides'
  if (label.includes('aerobic') || label.includes('steady')) return 'steady_aerobic'
  return null
}

/**
 * STIMULUS-FROM-CATALOGUE-01 (2026-10-23) — the stimulus a catalogue CATEGORY implies, for the generator to stamp
 * when the label says nothing. Used ONLY as the fallback: CLASSIFY-STIMULUS-01 keeps the label first, because a
 * threshold row prescribed at goal pace is `race_pace` and an aerobic-repurposed one is aerobic, and the label is
 * what records those decisions. The fallback exists because four threshold rows carry labels the heuristic cannot
 * read ("CV intervals", "Over-unders", "1600m repeats", "Threshold pyramid"): 6,213 of their sessions on 5,664 cohort
 * plans were stamped with NO stimulus, invisible to every rule that reads one, including §8's ordering (22 sweep
 * plans compared an 18-minute VO2max set with a taper tempo while their 24-minute CV set did not count).
 */
export const STIMULUS_OF_CATEGORY: Readonly<Record<string, keyof typeof GENERATION_CONFIG.STIMULUS_RANK>> = {
  threshold: 'tempo',
  race_specific: 'race_pace',
  vo2max: 'vo2max',
  aerobic: 'steady_aerobic',
}

/**
 * Is this session VO2max work — structurally, not by what it is called?
 *
 * Added 2026-08-20 (SC-09). The label test `label.includes('vo2max')` was
 * correct while every VO2max session was NAMED "… VO2max". `hill_reps` broke
 * that: it is `category: 'vo2max'` and labelled "Hill reps — 45s", so §22's
 * VO2max exemption silently stopped applying to it and the plan failed its own
 * race-specific-exposure check.
 *
 * D-17 again, and the third site this week where `catalogue_id` (ADR-018) makes
 * the structural answer available. The label fallback stays for legacy plans
 * generated before the stamp.
 */
export function isVo2maxSession(
  session: { catalogue_id?: string; label?: string | null },
  catalogue: Array<{ id: string; category: string }>,
): boolean {
  if (session.catalogue_id) {
    const row = catalogue.find(r => r.id === session.catalogue_id)
    if (row) return row.category === 'vo2max'
  }
  const label = (session.label ?? '').toLowerCase()
  return label.includes('vo2max') || label.includes('vo2 max')
}

/**
 * §81 (Coaching Board, 2026-09-03) — is this session's prescription its STRUCTURE
 * rather than its distance?
 *
 * A quality/tempo/interval session is defined by what you DO: "7 × 400 m at
 * 4:30–5:00/km", carried on `derived_set` / `catalogue_id` (ADR-018/019). Its
 * `distance_km` and `duration_mins` are consequences of that structure, not the
 * prescription.
 *
 * This matters because `applyWeekdayMinsCap` scales distance and duration and
 * does NOT scale `derived_set`. Measured before the exemption: a "Short VO2max"
 * went from 9 km / 43 min to 6.5 km / 30 min while its derived_set still read
 * 7 × 400 m — identical work, a duration that no longer described it. The cap
 * shortened the LABEL, not the session, so the runner blocked out 30 minutes for
 * a workout that needs 43. Every week.
 *
 * An easy run is the opposite case and is NOT structured: its prescription IS
 * its distance/duration, so scaling it is coherent and the cap applies normally.
 *
 * Kept here because sessionRole.ts is the single owner of "what kind of session
 * is this" (INV-CLASS-001) — a second predicate elsewhere would be free to drift.
 */
export function isStructuredSession(s: ClassifiableSession): boolean {
  return s.type === 'quality' || s.type === 'tempo'
      || s.type === 'intervals' || s.type === 'hard'
}
