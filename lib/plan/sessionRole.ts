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
import { zonesFromZoneString, zoneStringFromZoneKeys } from '@/lib/coaching/zoneRules'
// ⚠️ ACYCLIC, CHECKED: `sessionCatalogueData` imports only `generationConfig` and
// `sessionStructureV2`, neither of which reaches back here.
import { V1_SESSION_CATALOGUE } from './sessionCatalogueData'

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

/**
 * Is this the week's SECOND, softer quality session rather than its primary?
 *
 * Recovered STRUCTURALLY: in a week carrying more than one quality session the largest is
 * the primary and the rest are secondary. That is the relationship the engine creates by
 * construction (`SECONDARY_QUALITY_PCT_OF_PRIMARY = 80`), so producer and reader cannot
 * disagree — and never the label, which the enricher may rewrite (D-17).
 *
 * ⚠️ OWNED HERE BECAUSE IT HAD TWO CONSUMERS AND ONE INLINE COPY.
 * `INV-PLAN-MIN-SESSION-SIZE` has derived it inline since 2026-09; the V2 resize seam
 * needs the same answer, and a second hand-written copy of a classifier is the shape
 * `DELOAD-OWNER-01` and `TIER-OWNER-01` are both named after. The V2 seam's comment used
 * to claim the slot was "not recoverable" there, which `/code-review` found to be false.
 *
 * ⚠️ A DURATION-ANCHORED QUALITY SESSION CANNOT BE RANKED and reads as primary.
 * `distance_km` is null on those (§79/§80 beginners), so `?? 0` would make every one of
 * them the smallest and therefore secondary — the wrong direction, since the primary
 * floor is the larger and a misread would SHRINK a session. The known gap is the same one
 * `INV-PLAN-MIN-SESSION-SIZE` records at its own km-floor site.
 */
export function isSecondaryQuality(
  session: ClassifiableSession & { distance_km?: number | null },
  weekSessions: ReadonlyArray<(ClassifiableSession & { distance_km?: number | null }) | null | undefined>,
): boolean {
  if (!isQualitySession(session)) return false
  if (session.distance_km == null) return false
  const qualityKms = weekSessions
    .filter((sn): sn is ClassifiableSession & { distance_km?: number | null } => !!sn && isQualitySession(sn))
    .map(sn => sn.distance_km)
    .filter((km): km is number => km != null)
  if (qualityKms.length < 2) return false
  return session.distance_km < Math.max(...qualityKms)
}
export function isHardEffort(s: ClassifiableSession | null | undefined): boolean { return !!s && isHardEffortType(s.type) }
export function isHardDay(s: ClassifiableSession | null | undefined): boolean { return !!s && (isHardEffort(s) || isLongRun(s)) }
/** `isHardDay` for a caller holding a `coachingSessionType` label ('long' for the long run) rather than the session. */
export function isHardDayLabel(label: string | null | undefined): boolean { return label === 'long' || isHardEffortType(label) }

export function coachingSessionType(s: ClassifiableSession): string {
  if (isLongRun(s)) return 'long'
  return (s.type as string) ?? 'easy'
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
  session: { label?: string | null; zone?: string | null; stimulus?: keyof typeof GENERATION_CONFIG.STIMULUS_RANK; catalogue_id?: string },
  catalogue: Array<{ id: string; category: string }> = V1_SESSION_CATALOGUE,
): keyof typeof GENERATION_CONFIG.STIMULUS_RANK | null {
  if (session.stimulus) return session.stimulus
  const label = (session.label ?? '').toLowerCase()
  const zone  = (session.zone  ?? '').toLowerCase()
  // 🔴 VO2max IS UNAMBIGUOUS, AND THE ZONE STRING IS NOT THE WAY TO ASK
  // (ZONE-STRING-CLASSIFIER-01, 2026-11-17). This read `zone.includes('zone 4–5')`, so the
  // answer moved with a DISPLAY label. It is latent today only because the generator writes
  // one string per band; under ADR-026 the band is derived per RUNNER, a threshold row can
  // read "Zone 4–5", and this would stamp it `vo2max` — which is how a 24-minute CV
  // THRESHOLD session came to be judged against the 12–18 min VO2max dose bound.
  //
  // ⚠️ THE ZONE READ IS KEPT AS THE FALLBACK AND ONLY THERE. A plan from before ADR-018
  // carries no stamp, and for those the string is the only record of the band there is.
  // `workClassFor` returns null for exactly that case, which is when the old test runs.
  const workClass = workClassFor(session, catalogue)
  if (label.includes('vo2')) return 'vo2max'
  if (workClass === 'vo2max') return 'vo2max'
  if (workClass === null && (zone.includes('zone 4–5') || zone.includes('zone 5'))) return 'vo2max'
  // Goal-pace and tempo both sit at rank 4 (race_pace / tempo). Distinguish for
  // the audit log; rank is identical so escalation logic isn't affected.
  if (label.includes('-pace') || label.includes('goal pace') || label.includes('sharpener')) return 'race_pace'
  if (label.includes('tempo') || label.includes('cruise') || label.includes('threshold') || label.includes('progressive')) return 'tempo'
  if (label.includes('hill'))  return 'hills'
  if (label.includes('strid')) return 'strides'
  if (label.includes('aerobic') || label.includes('steady')) return 'steady_aerobic'
  // 🔴 THE CATEGORY FALLBACK MOVED IN HERE, AND THE REASON IS THAT IT LIVED AT ONE CALLER OF
  // EIGHT (ZONE-STRING-CLASSIFIER-01). `ruleEngine.ts`'s stamp site wrote
  // `classifyStimulus(...) ?? STIMULUS_OF_CATEGORY[row.category]` by hand, so the seven
  // invariant call sites answered `null` for a session whose class is sitting on its own
  // stamped row. Harmless today only because the stamp short-circuits at line 1 — a default
  // assembled by the caller is a default most callers do not have.
  //
  // Still the FALLBACK and never ahead of the label, which is CLASSIFY-STIMULUS-01's own
  // ruling: a threshold row re-prescribed at goal pace is `race_pace`, and the label is where
  // that decision was recorded.
  return workClass ? STIMULUS_OF_CATEGORY[workClass] ?? null : null
}


/**
 * ZONE-STRING-CLASSIFIER-01 (2026-11-17) — the single owner of "what KIND of work does this session
 * prescribe", read from the stamp the producer wrote.
 *
 * 🔴 WHY IT EXISTS. Five places asked that question of `session.zone`, which is a DISPLAY STRING —
 * §84 Amendment 1 settled it in as many words: *"`hr_target` is the prescription; `session.zone` is
 * a label ABOUT it"*. That is INV-CLASS verbatim (*classify by a structural signal the producer
 * stamps, never by a display string another layer can rewrite*), and the signal has been stamped
 * since ADR-018. It was latent only because the generator wrote one zone string per band; ADR-026
 * makes the string runner-dependent and every one of the five starts answering a different question
 * for the same session.
 *
 * ⚠️ IT WAS ALREADY WRONG, TODAY, IN ONE OF THEM, AND THE COMMENT BESIDE IT SAID SO. §53's
 * `physBucket` is documented *"Zone 3 / Zone 3–4 = threshold; Zone 4–5 = vo2max"* and returned
 * `vo2max` for anything containing "zone 4" — so `cv_intervals` and `tempo_over_under`, which
 * declare `[Z3,Z4]` and are threshold TRAINING, could never enter the threshold swap pool.
 *
 * 🔑 TWO PREDICATES, BECAUSE THE SITES ASK TWO DIFFERENT QUESTIONS AND `cv_intervals` PROVES THEY
 * ARE DIFFERENT FACTS: its `category` is `threshold` while its `intensity_zones` are `[Z3,Z4]`. So
 * the zone SET cannot answer "is this VO2max training" and the CATEGORY cannot answer "which zones
 * is the work in". `workClassFor` is the first; `workZonesFor` is the second.
 */
export type WorkClass = 'vo2max' | 'threshold' | 'race_specific' | 'aerobic' | 'ultra_specific' | null

/**
 * The catalogue CATEGORY of this session's work. `null` when no row resolves — and `null` means
 * "leave this session's classification alone", never "probably threshold". Guessing a band for an
 * unresolvable session is the move that downgraded a live runner's VO2max set (see `hrBand.ts`).
 *
 * ⚠️ The LABEL fallback is kept and the ZONE fallback is deliberately not added. A label is at
 * least authored next to the prescription; the zone string is derived from it, so reading the zone
 * to classify the prescription is circular the moment the band moves.
 */
/**
 * ⚠️ INDEXED, AND THE REASON IS A MEASURED 3.2x. `classifyStimulus` consults `workClassFor` on
 * every call and is itself called per session by seven invariants, so the obvious
 * `catalogue.find(...)` scan of 31 rows put `effortGovernedBand.test.ts` from 1,161 ms to
 * 3,705 ms — caught by `npm run check:slow`, which is what that gate is for. Keyed on the ARRAY
 * so an injected test catalogue gets its own index and a mutated one is never served a stale map.
 */
const CATEGORY_INDEX = new WeakMap<object, Map<string, string>>()
function categoryOf(catalogue: Array<{ id: string; category: string }>, id: string): string | undefined {
  let idx = CATEGORY_INDEX.get(catalogue)
  if (!idx) {
    idx = new Map(catalogue.map(r => [r.id, r.category]))
    CATEGORY_INDEX.set(catalogue, idx)
  }
  return idx.get(id)
}

export function workClassFor(
  session: { catalogue_id?: string; label?: string | null },
  catalogue: Array<{ id: string; category: string }> = V1_SESSION_CATALOGUE,
): WorkClass {
  if (session.catalogue_id) {
    const category = categoryOf(catalogue, session.catalogue_id)
    if (category) return (category as WorkClass) ?? null
  }
  const label = (session.label ?? '').toLowerCase()
  if (label.includes('vo2max') || label.includes('vo2 max')) return 'vo2max'
  return null
}

/**
 * The zone NUMBERS this session's work sits in, from the row's own `intensity_zones` declaration —
 * `[3, 4]` for a row declaring `['Z3','Z4']`. Empty when no row resolves.
 *
 * ⚠️ READS THE ROW, NEVER THE SESSION'S ZONE STRING, and the two are not the same claim: the row
 * declares what the work IS, the string displays what the runner is told. `zoneStringFromZoneKeys`
 * exists for exactly this round trip (§107) and `zonesFromZoneString` expands a span, so a row
 * declaring `['Z3','Z5']` yields `[3,4,5]`.
 */
export function workZonesFor(
  session: { catalogue_id?: string; label?: string | null },
  catalogue: Array<{ id: string; category: string; intensity_zones?: readonly string[] }> = V1_SESSION_CATALOGUE,
): number[] {
  const row = session.catalogue_id ? catalogue.find(r => r.id === session.catalogue_id) : undefined
  if (!row) return []
  return zonesFromZoneString(zoneStringFromZoneKeys(row.intensity_zones))
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
 *
 * ⚠️ DELEGATES to `workClassFor` since ZONE-STRING-CLASSIFIER-01 — it was the first half of that
 * owner and keeping a second copy of the category test is the drift this file exists to prevent.
 */
export function isVo2maxSession(
  session: { catalogue_id?: string; label?: string | null },
  catalogue: Array<{ id: string; category: string }>,
): boolean {
  return workClassFor(session, catalogue) === 'vo2max'
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
