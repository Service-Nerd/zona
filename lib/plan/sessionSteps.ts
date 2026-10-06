// SESSION-STRUCTURE-REDESIGN — the display model for the "Session steps" UI
// (ui-patterns.md §"Session steps"). Turns a resolved `derived_set` (ADR-019)
// into scannable rows: one line per work / recovery step, grouped into repeat
// blocks, with a plain-language role, a primary amount, and a secondary detail.
//
// Pure and unit-injected so it is testable without React and honours the user's
// metric toggle. The component (components/shared/SessionSteps.tsx) renders it.
//
// Honesty note: when the toggle is on distance and a step is prescribed by TIME
// (an interval rep), we show an estimated distance as the primary and keep the
// duration in the detail — the same "derive distance from pace" convention the
// section totals already use (sessionComposer). A step with no pace (a hill rep
// at RPE) keeps time as its primary, because there is no honest distance to show.

import type { DerivedSet, DerivedStep } from './resolveMainSet'
import type { SessionStructure } from './sessionComposer'
import { apportionRoundedDistance, convertPaceString, formatDuration, formatStepDuration, splitAmount, formatZone } from '@/lib/format'
import { easyPaceAsCeiling, paceAsFloor } from './easyPaceCeiling'

export type StepKind = 'work' | 'rest'

export interface StepRow {
  kind: StepKind
  /** Plain-language action: "Hard", "Jog", "Uphill", "Stand", "Jog down", "Run to base". */
  role: string
  /** Primary metric — leads with the user's chosen unit. e.g. "~1.1 km", "1:30", "until ready". */
  amount: string
  /** True when `amount` is a pace-derived estimate (shows the ~ marker). */
  amountIsEstimate: boolean
  /**
   * THE TARGET — pace band, zone, or RPE. **Line two, first, on every row of
   * every session, with no exceptions** (SESSION-STEP-SLOTS-01, Design Board
   * 2026-10-06).
   *
   * 🎓 Sierra's finding, which is the whole ruling: mid-run the runner is
   * answering one question — *am I doing the right thing right now?* — and the
   * answer is the target. **Their watch already shows distance and time; it does
   * not show what we told them to hold.** Measured at 320px, the card gave 72px
   * of its strongest position to a number the watch displays and 192px of grey
   * 11px to the one only we know.
   */
  target: string
  /** The OTHER metric — the one the runner did not choose. Empty when it cannot
   *  be derived (no pace) or when it is the same as the lead. */
  secondary: string
  /** Lead amount split for the two-weight treatment: `~1.4` + `km`. */
  amountValue: string
  amountUnit: string
  /** Kept as `target · secondary` for any consumer that still wants one string. */
  detail: string
  /**
   * The step's coaching instruction, verbatim from the catalogue row
   * (SESSION-STEP-LEGIBILITY-01, Design Board 2026-10-06).
   *
   * 🔴 THE FIELD HAD A WRITER AND NO READER FOR AS LONG AS v2 HAS EXISTED.
   * `resolveMainSet` copies `step.note` off the catalogue row and stamps it into
   * `derived_set`; **5,152 of 6,014 rendered steps (85.7%) carried one and NOT ONE
   * REACHED A SCREEN.** The founder's own progressive tempo authored *"Hold back.
   * This is the part that makes the last third honest."* / *"Let it rise. Don't
   * chase it."* / *"Threshold now."* and the card showed **"Hard" three times**,
   * which is also why 18.0% of blocks had every row sharing one role: the thing
   * that distinguishes the steps WAS the note.
   *
   * ⚠️ NEVER TRUNCATED (Wroblewski, binding). Longest authored note is 106 chars
   * → 3 lines at 320px. Truncating a coaching instruction to fit is the worst
   * available outcome.
   */
  note?: string
}

export interface StepGroup {
  /** 1 = a one-off step (lead-in, single continuous effort); >1 = a repeat block. */
  repeat: number
  /** Short label for the repeat bar: "rounds of", "hill reps". Absent for repeat 1. */
  repeatLabel?: string
  rows: StepRow[]
}

export interface BuildStepOpts {
  metric: 'distance' | 'duration'
  /** Formats a km number in the user's units, e.g. (0.65) => "0.65 km" / "0.4 mi". */
  formatDist: (km: number) => string
  /** The reader's units. REQUIRED, not defaulted — PACE-UNITS-STEPS-01 shipped
   *  because a pace could reach this module without anyone being asked which
   *  unit it was for. `formatDist` already answered that question for the
   *  amount; nothing answered it for the pace beside it. Same reasoning as
   *  `LimiterInputs.units`: make the compiler put the question to every caller. */
  units: 'km' | 'mi'
  /**
   * Does the SESSION itself carry a distance? Default true.
   *
   * ui-patterns.md §21b Am. 4 — Design Board, 2026-10-06. 🔴 **On a
   * duration-anchored session the step rows were the ONLY figure on the card in
   * kilometres.** The session has no `distance_km`, so `resolveDisplayFigures`
   * gives minutes to the card total, both section headers and both bookends,
   * while `buildStepGroups` derived km from each step's own resolved pace — a
   * second producer answering a question the first had already answered.
   * Measured: **795 `quality_continuous` sessions**, reading
   * `15 min | 4 × 20s | ~3.8km | 4 min`.
   *
   * ⚠️ THIS IS NOT `UNITS-SUBUNIT-01` OPTION B, WHICH IS KILLED AND STAYS KILLED.
   * That option flipped a whole card to minutes **because one part was short**,
   * overruling a toggle the runner had set. This asks a different question: the
   * plan never prescribed this session in distance at all, so there is no
   * distance to honour the toggle WITH, and `6t.`'s own guarantee — *"the
   * fallback cannot hide real ground"* — has a hole here, because these parts
   * apportion to `undefined` rather than to exactly 0.
   *
   * ⚠️ A step's OWN prescription is never suppressed. A `400 m` rep still reads
   * `400 m`: that is the prescription, not a derivation. What stops is inventing
   * the unit the session does not have.
   */
  sessionHasDistance?: boolean
}

// ── length parsing ──────────────────────────────────────────────────────────

type ParsedLength =
  | { kind: 'duration'; secs: number }
  | { kind: 'distance'; km: number }
  | { kind: 'text'; text: string }

/** Parse a `derived_set` step length string into a typed value. A `mirror`
 *  step ("same as the 1:30") resolves to the length it mirrors. */
export function parseLength(raw: string): ParsedLength {
  const s = raw.trim()

  const mirror = s.match(/^same as the (.+)$/i)
  if (mirror) return parseLength(mirror[1])

  // "5 min"
  const min = s.match(/^(\d+(?:\.\d+)?)\s*min$/i)
  if (min) return { kind: 'duration', secs: Math.round(parseFloat(min[1]) * 60) }
  // "M:SS" (a clock value the engine writes for non-round seconds, e.g. 1:30)
  const clock = s.match(/^(\d+):(\d{2})$/)
  if (clock) return { kind: 'duration', secs: parseInt(clock[1], 10) * 60 + parseInt(clock[2], 10) }
  // "45s"
  const secs = s.match(/^(\d+)\s*s$/i)
  if (secs) return { kind: 'duration', secs: parseInt(secs[1], 10) }
  // "1000 m" / "400 m"
  const metres = s.match(/^(\d+(?:\.\d+)?)\s*m$/i)
  if (metres) return { kind: 'distance', km: parseFloat(metres[1]) / 1000 }
  // "5 km"
  const km = s.match(/^(\d+(?:\.\d+)?)\s*km$/i)
  if (km) return { kind: 'distance', km: parseFloat(km[1]) }

  // "until ready", "to the bottom of the hill", "back to the start", …
  return { kind: 'text', text: s }
}

/** Mean pace in seconds-per-km from a pace string ("4:25–4:35 /km" or "4:30 /km"). */
export function paceMeanSecPerKm(pace: string | null | undefined): number | null {
  if (!pace) return null
  const times = Array.from(pace.matchAll(/(\d+):(\d{2})/g)).map(m => parseInt(m[1], 10) * 60 + parseInt(m[2], 10))
  if (times.length === 0) return null
  return times.reduce((a, b) => a + b, 0) / times.length
}

/** Round an estimated distance for display: 0.05 km granularity under 1 km,
 *  0.1 km at or above — enough precision to be useful, not enough to lie. */
function roundEstKm(km: number): number {
  const g = km < 1 ? 0.05 : 0.1
  return Math.round(km / g) * g
}

// ── role labels ───────────────────────────────────────────────────────────

/** Plain-language action word for a step, from its role / modality / terrain. */
export function roleLabelForStep(step: DerivedStep, parsed: ParsedLength): string {
  const toLandmark = parsed.kind === 'text' && (parsed.text.startsWith('to the') || parsed.text.startsWith('back to'))

  if (step.role === 'transition') return toLandmark ? 'Run to base' : 'Run'
  if (step.role === 'work') {
    if (step.terrain === 'uphill') return 'Uphill'
    if (step.terrain === 'downhill') return 'Downhill'
    return 'Hard'
  }
  // recovery
  if (step.modality === 'stand') return 'Stand'
  if (step.modality === 'walk') return 'Walk'
  if (step.modality === 'hike') return 'Hike'
  if (step.modality === 'jog') return step.terrain === 'downhill' ? 'Jog down' : 'Jog'
  return 'Recover'
}

// ── target (secondary detail) ────────────────────────────────────────────

/**
 * What a step says when it has NO pace target, appended to whatever IS prescribed.
 *
 * ui-patterns.md §21b Am. 4 — Design Board, 2026-10-06 (evening re-sitting), SHIP
 * WITH AMENDMENT. The founder opened his own Progressive tempo and read step 4 as
 * a bug: steps 3, 4 and 5 are all 9:20, two lead with `~1.4km` / `~1.8km`, and the
 * middle one leads with `9:20 min` because its target is the zone band `Z2-Z3` and
 * it carries no pace.
 *
 * 🔴 THE NUMBER IS CORRECT AND RATIFIED — the defect is that nothing SAYS so.
 * `sessionCatalogueData.ts` authors that step (Coaching Board, 2026-09-03) as
 * *"no single pace anchor describes a moving target, so its target is the zone
 * band 'Z2-Z3' rather than a false-precision pace"*; §21b already says a rep with
 * no pace keeps time as its primary; CoachingPrinciples §40b says an effort-
 * governed step *"does not invent a number the runner cannot act on. What is
 * absent is the pace, and only the pace."* **A deliberate decision was rendering
 * identically to a failed computation**, so the runner reads a ruling as a bug.
 *
 * ⚠️ AND THE OBVIOUS FIX WAS REFUSED BY ALL THREE OF THOSE ROWS. `~1.7 km` over
 * `9:20` IS `5:29 /km` by division, on a step whose own note reads *"Let it rise.
 * Don't chase it."* Printing the distance hands back the pace the catalogue
 * deliberately withheld.
 *
 * ⚠️ WORDING IS THE RULING'S, NOT A PREFERENCE. Collins carried *"effort, not
 * pace"* over the schema language *"no pace target"* on Sierra's argument that it
 * teaches — it tells the runner HOW to run it. Silvanto's precision (a zone IS
 * holdable on HR, so nothing may imply the zone is absent) is satisfied by the
 * ORDER: what is prescribed comes first, the absence second.
 *
 * Measured: **1,174 of 9,506 v2 work steps (12.4%)** carry no pace — 941 zone-only
 * (`Z2-Z3`, the progressions) and 233 RPE-only (`RPE 8`, hill reps). Applied to
 * BOTH, uniformly: a rule, not a list (§21b Am. 2's own recorded lesson). The hill
 * reps do not LOOK broken today only because their neighbours are also in time,
 * and a rule conditioned on what the neighbours happen to show is not a rule.
 */
export const NO_PACE_QUALIFIER = 'effort, not pace'


/**
 * The pace / RPE / zone clause, without the length.
 *
 * 🔴 PACE-UNITS-STEPS-01 (2026-09-23) — this returned `step.pace` VERBATIM, and
 * `step.pace` is the `/km` string the engine welds on at generation. PACE-UNITS-01
 * fixed the session card's pace TILE the same day and never reached here, so a
 * miles runner opened a session and read **36 of 38 step rows in km** — beside an
 * amount this module had already converted. The row said `~0.1mi · 5:30–6:00 /km`:
 * two units on one line, which is worse than uniformly wrong.
 *
 * ⚠️ CONVERTED HERE, NEVER ON `step.pace` ITSELF. `buildRow` hands the SAME field
 * to `paceMeanSecPerKm` to estimate a distance from it, and that arithmetic is
 * seconds-per-KM by definition. Converting the field would silently corrupt every
 * `~X mi` amount on the card — a rate measured in different units from the thing
 * it divides. Convert at the point of DISPLAY only.
 */
export function targetClause(step: DerivedStep, units: 'km' | 'mi'): string {
  if (step.pace) {
    const converted = convertPaceString(step.pace, units) ?? step.pace
    // 🔴 `≤` AND `≥` READ BACKWARDS FOR PACE, AND THE BOARD HAD ALREADY RULED IT.
    //
    // `design-rulings.md` (CD-11 / §12): *"'or slower' is ratified coaching
    // doctrine — never a ≤ symbol, which reads backwards for pace."* This clause
    // printed `≤ ` on **2,499 of 6,014 rendered steps (41.6%)**, and worse, over
    // the whole BAND: `≤ 5:53–7:02 /km` is an operator applied to a range.
    //
    // ⚠️ THE SIGN WAS INVERTED, NOT MERELY UGLY. ADR-019 defines the modes in
    // words — ceiling is *"warm up no faster than X"*, floor is *"jog the
    // recovery no slower than 6:30"*. Those are limits on SPEED, and pace runs
    // the opposite way: "no faster than 5:53" means the pace NUMBER must be
    // ≥ 5:53. Printing `≤ 5:53` tells the runner to go quicker, on the step whose
    // own note says *"Hold back."*
    //
    // ⚠️ AND THE SAME CARD ALREADY DISAGREED WITH ITSELF. `SessionPopupInner`
    // renders the Pace target tile through `easyPaceAsCeiling`, which says
    // "5:53 /km or slower" — so one screen stated the same fact two ways, one of
    // them backwards. This routes through that owner instead of being a second
    // writer of a pace qualifier (the duplication class this repo keeps paying
    // for: TIER-OWNER-01, DELOAD-OWNER-01, SESSION-KM-01/02).
    //
    // ⚠️ `easyPaceAsCeiling` GATES ON SESSION TYPE because its own callers pass
    // one; a step has no session type, and the mode IS the instruction here. So
    // the band→ceiling reduction is called with the type it expects, and the
    // mode decides whether to call it at all.
    if (step.pace_mode === 'ceiling') return easyPaceAsCeiling(converted, 'easy') ?? converted
    if (step.pace_mode === 'floor') return paceAsFloor(converted)
    return converted
  }
  // §21b Am. 4 — no pace on a WORK step is a decision, so the row says so.
  //
  // ⚠️ THE RECOVERY GUARD IS A DECLARED DEFENCE AND IS DEAD TODAY. "Jog", "Walk"
  // and "Stand" are already instructions by effort, so excluding them is right —
  // but measured, of **5,536 non-work steps, 5,303 carry a pace and 233 carry
  // neither a zone nor an RPE**, so both branches below return early or empty for
  // every one of them and REMOVING THIS GUARD CHANGES NOTHING. Falsifying the
  // gate by deleting it left the corpus arm GREEN, which is how that was found;
  // the arm now asserts `targetClause` directly as well. Same shape as
  // `paceAsFloor` (0 of 6,014): kept, stated, and live the moment the catalogue
  // gives a recovery step a zone.
  const absent = step.role === 'work' ? ` \u00b7 ${NO_PACE_QUALIFIER}` : ''
  if (step.rpe != null) return `RPE ${step.rpe}${absent}`
  if (step.zone) return `${formatZone(step.zone)}${absent}`
  return ''
}

// ── row assembly ───────────────────────────────────────────────────────────

/**
 * A step's duration, ALWAYS carrying a unit.
 *
 * 🔴 THE `M:SS` BRANCH USED TO RETURN A BARE `9:20`, and it lands in the AMOUNT
 * column where its sibling rows show `~1.4km`. **202 of 6,014 steps (3.4%)**, and
 * the founder read his own session and asked *"9:20 what?"* — reasonably: on a
 * card about distance, beside two rows showing kilometres, `9:20` reads as a pace.
 *
 * ⚠️ ADR-015 §1 RETIRED EXACTLY THIS GLYPH: *"never a lone `78m`. That glyph
 * ambiguity (minutes vs miles vs metres) is the defect this retires."* The other
 * two branches here already carried a unit (`9 min`, `30s`); the M:SS branch was
 * the only one that did not, which is why it was invisible.
 */
const formatSecsShort = formatStepDuration

function buildRow(step: DerivedStep, opts: BuildStepOpts): StepRow {
  const parsed = parseLength(step.length)
  const kind: StepKind = step.role === 'work' ? 'work' : 'rest'
  const target = targetClause(step, opts.units)

  /**
   * 🔴 THE NOTE IS THE ROLE (Design Board, 2026-10-06, Am. 2). A work step that
   * carries a note renders no role word; a work step without one keeps it, and a
   * RECOVERY step always keeps it — `Jog`, `Walk`, `Stand`, `Hike`, `Jog down`
   * are the only modality signal on the row. Measured: of 373 same-role blocks,
   * 373 (100.0%) had distinct notes, targets AND lengths. Zero were rep sets.
   */
  const role = kind === 'work' && step.note ? '' : roleLabelForStep(step, parsed)

  /**
   * ONE MODEL FOR BOTH METRICS, AND IT IS SYMMETRIC (SESSION-STEP-SLOTS-01).
   *
   * A step is PRESCRIBED in one metric and the other is DERIVED from its pace.
   * The lead slot takes whichever matches the runner's toggle; the other goes to
   * `secondary`. When the chosen one cannot be derived, the lead holds the
   * prescription — marked by the ABSENCE of a `~`, never silently swapped.
   *
   * 🔴 THE OLD CODE WAS ASYMMETRIC AND THAT IS WHY THE TOGGLE LEAKED. The
   * distance branch never consulted `opts.metric` at all, so a runner who chose
   * DURATION read `400 m` on every distance-prescribed rep. Measured: the lead
   * number switched unit mid-block on **29.2%** of blocks on the distance
   * setting and **33.2%** on duration — the duration runner was served worse, and
   * nobody had looked.
   *
   * ⚠️ `roundEstKm` and the zero-estimate guard are unchanged (STEP-SUBUNIT-ZERO-01):
   * an estimate that rounds to zero is not an estimate, so the lead falls back to
   * the prescription rather than claiming the step covers no ground.
   */
  const paceSec = paceMeanSecPerKm(step.pace)
  const wantsDistance = opts.metric === 'distance' && opts.sessionHasDistance !== false
  let lead: string
  let secondary = ''
  let isEstimate = false

  if (parsed.kind === 'distance') {
    const distStr = opts.formatDist(parsed.km)
    const derivedSecs = paceSec ? Math.round(parsed.km * paceSec) : null
    if (wantsDistance || derivedSecs == null) {
      lead = distStr
      if (derivedSecs != null) secondary = `~${formatStepDuration(derivedSecs)}`
    } else {
      lead = `~${formatStepDuration(derivedSecs)}`; isEstimate = true
      secondary = distStr
    }
  } else if (parsed.kind === 'duration') {
    const durStr = formatStepDuration(parsed.secs)
    const estKm = paceSec ? roundEstKm(parsed.secs / paceSec) : null
    const estStr = estKm != null ? opts.formatDist(estKm) : null
    const estUsable = estStr != null && estStr !== opts.formatDist(0)
    if (wantsDistance && estUsable) {
      lead = `~${estStr}`; isEstimate = true
      secondary = durStr
    } else {
      lead = durStr
      if (estUsable) secondary = `~${estStr}`
    }
  } else {
    lead = parsed.text
  }

  const { value, unit } = splitAmount(lead)
  return {
    kind, role,
    amount: lead, amountValue: value, amountUnit: unit,
    amountIsEstimate: isEstimate,
    target: target || (kind === 'rest' && parsed.kind === 'text' ? 'rest' : ''),
    secondary,
    detail: [target, secondary].filter(Boolean).join(' · '),
    ...(step.note ? { note: step.note } : {}),
  }
}

// ── session-total reconciliation (SESSION-RECONCILE-01) ─────────────────────
//
// The card shows a per-phase breakdown (warm-up / main set / cool-down) plus,
// on an MP long run, a race-pace row inside the main set. Every figure a runner
// can add up must sum to the session total they see at the top of the card —
// by distance when the toggle is on km, by duration when it is on time.
//
// Two ways it used to fail:
//   1. the race-pace segment rendered as a bare "40%" with no km/min, so the
//      visible parts summed to (total − segment), never the total;
//   2. each part was rounded to whole km independently, so 1.4 + 7.1 + 1.4
//      showed 1 + 7 + 1 = 9 against a 10 km header.
// This owner fixes both: the segment folds into the main-set total, and the
// distance figures are apportioned (largest-remainder) to hit the session total
// exactly. Durations already sum exactly, so the time path needs no apportioning.

export interface SessionDisplayFigures {
  /** Section header totals — warm-up + main-set + cool-down sum to the session total. */
  warmup:   string
  mainSet:  string   // easy body + race-pace segment
  cooldown: string
  /** Main-set rows — mainEasy + racePace sum to `mainSet`. `racePace` is null when
   *  the session has no race-pace segment. */
  mainEasy: string
  racePace: string | null
}

export interface DisplayFigureOpts {
  metric: 'distance' | 'duration'
  units: 'km' | 'mi'
  /** The session's own total distance (the number at the top of the card). Parts
   *  are apportioned to hit `Math.round` of this. Falls back to the sum of the
   *  part distances when absent. */
  sessionDistanceKm?: number | null
}

function amountStr(value: number, metric: 'distance' | 'duration', units: 'km' | 'mi'): string {
  if (metric === 'distance') return `~${value}${units}`
  // 🔴 ADR-015 LOCKS THE ≥60 RULE — `45 min`, `1h 18`, never a bare `78m` and
  // never `172 min`. This line wrote raw minutes, and `formatDuration` has owned
  // the rule since INV-FMT-002.
  //
  // MEASURED 2026-09-23 across 48,547 sessions: the main-set header read 60+
  // raw minutes on **21,062 of them (43.4%)**, to a maximum of **172 min** —
  // which ADR-015 says is `2h 52`. The runner reading "172 min" has to do the
  // division themselves, on the one figure that tells them how long the session
  // actually is.
  //
  // ⚠️ THE REGISTER POINTED AT ELEVEN DURATION SITES AND TEN OF THEM CANNOT
  // FIRE. `sessionComposer`'s descriptions and `buildStepGroups`' rows produced
  // **zero** values ≥60 in the same corpus — a rep or a warm-up is minutes by
  // construction. Only the session-level header is long enough to break the
  // rule. **Measuring which entries were reachable is what found the one that
  // mattered**, and it is why this is not eleven edits.
  return formatDuration(value) ?? `${value} min`
}

/** Reconciled per-phase figures for the session-structure card. Pure; the
 *  component renders it and the corpus test asserts the parts sum to the total. */
export function resolveDisplayFigures(
  structure: SessionStructure,
  opts: DisplayFigureOpts,
): SessionDisplayFigures {
  const seg = structure.race_pace_segment

  // ── Time trial (§78) — the one shape whose parts do not partition the total ──
  //
  // The trial's distance IS the main set; the warm-up and cool-down sit OUTSIDE
  // it (see the branch in sessionComposer). So there is nothing to apportion and
  // no honest distance to put on the warm-up: "cool down easy" carries no
  // number, and inventing one would contradict zone-rules.md's never-invent
  // rule. The parts therefore differ in KIND — minutes for the bookends, the
  // measured distance for the trial — which is the same principle Pattern 21b
  // already applies to a hill rep at RPE ("there is no honest distance to
  // show"), applied per PART rather than per session.
  //
  // The distance is EXACT, not `~`: you run precisely this far and the clock is
  // the output. Every other figure on this card is an estimate; this one is the
  // prescription.
  if (structure.shape === 'time_trial') {
    const wu = amountStr(structure.warmup.duration_mins, 'duration', opts.units)
    const cd = amountStr(structure.cooldown.duration_mins, 'duration', opts.units)
    const trialKm = structure.main.distance_km ?? opts.sessionDistanceKm ?? null
    // Same owner as every other distance on this card — apportioning a single
    // part against itself is just "convert and round to the header", which is
    // exactly the guarantee we want and saves a second km→mi constant.
    const mainStr = opts.metric === 'distance' && trialKm != null
      ? `${apportionRoundedDistance([trialKm], trialKm, opts.units)[0]}${opts.units}`
      : amountStr(structure.main.duration_mins, 'duration', opts.units)
    return { warmup: wu, mainSet: mainStr, mainEasy: mainStr, racePace: null, cooldown: cd }
  }

  const hasDistances =
    structure.warmup.distance_km != null &&
    structure.main.distance_km != null &&
    structure.cooldown.distance_km != null &&
    (seg == null || seg.distance_km != null)

  // Distance path only when the toggle is on km AND every part has a distance
  // (a pure-duration session has none — nothing to apportion, show minutes).
  if (opts.metric === 'distance' && hasDistances) {
    const partsKm = [
      structure.warmup.distance_km!,
      structure.main.distance_km!,
      seg?.distance_km ?? 0,
      structure.cooldown.distance_km!,
    ]
    const totalKm = opts.sessionDistanceKm ?? partsKm.reduce((a, b) => a + b, 0)
    const [wu, easy, race, cd] = apportionRoundedDistance(partsKm, totalKm, opts.units)
    // ── SUB-UNIT PARTS (UNITS-SUBUNIT-01) ────────────────────────────────────
    //
    // 🔴 A PART THAT APPORTIONS TO ZERO MUST NOT SAY "~0mi". A cool-down of
    // 0.71 km is 0.44 of a mile; rounding it to a whole unit prints `~0mi`,
    // which asserts the runner covers NO GROUND. Measured across 48,547
    // sessions: **39.7% of sessions in miles** and **3.7% in km** carried a
    // `~0` part, cool-down in every one of them, real distances 0.25-1.27 km.
    //
    // ⚠️ THE RCA THAT FILED THIS SAID "never happens in km". It does — 3.7%,
    // mostly shakeouts — and it blamed `formatDistance`, which fires ZERO times
    // on session distances. `apportionRoundedDistance` is the only live
    // mechanism. Both were corrected by measuring rather than reasoning.
    //
    // ⚠️ THE REMEDY IS NOT NEW. `ui-patterns.md` § 21b already rules it for the
    // time-trial branch below: *"the bookends stay in minutes. There is no
    // honest distance to put on them… inventing one breaks zone-rules.md's
    // never-invent rule… applied per PART rather than per session."* This
    // widens the trigger from one SHAPE to any part with no honest whole unit.
    //
    // ⚠️ MINUTES, NOT A DECIMAL. The bookends are PRESCRIBED in minutes and the
    // distance is derived (`withDistances`), so minutes is the source of truth;
    // `~0.4mi` would assert a precision the derivation has not got, on a card
    // where every other figure is a whole unit behind a `~`.
    //
    // ⚠️ THE RECONCILIATION SURVIVES BY CONSTRUCTION, which is why this is safe:
    // a part apportioned to 0 contributes 0 to the sum, so swapping its TEXT
    // cannot break SESSION-RECONCILE-01. The parts that still carry a distance
    // still sum to the header.
    const part = (units: number, mins: number) =>
      // A part with no distance AND no duration has nothing honest to say, so
      // it keeps the distance form rather than asserting "0 min". Measured 0 of
      // 15,638 — but "zero in the corpus" is not "cannot fire".
      units === 0 && mins > 0
        ? amountStr(mins, 'duration', opts.units)
        : amountStr(units, 'distance', opts.units)
    return {
      warmup:   part(wu, structure.warmup.duration_mins),
      mainEasy: part(easy, structure.main.duration_mins),
      racePace: seg ? part(race, seg.duration_mins) : null,
      // The main-set header is the SUM of its two rows, so it is sub-unit only
      // when both are. Its duration is the main block's own total.
      mainSet:  part(easy + race, structure.main.duration_mins + (seg?.duration_mins ?? 0)),
      cooldown: part(cd, structure.cooldown.duration_mins),
    }
  }

  // Duration path — minutes already sum to the total exactly.
  const wu = structure.warmup.duration_mins
  const easy = structure.main.duration_mins
  const race = seg?.duration_mins ?? 0
  const cd = structure.cooldown.duration_mins
  return {
    warmup:   amountStr(wu, 'duration', opts.units),
    mainEasy: amountStr(easy, 'duration', opts.units),
    racePace: seg ? amountStr(race, 'duration', opts.units) : null,
    mainSet:  amountStr(easy + race, 'duration', opts.units),
    cooldown: amountStr(cd, 'duration', opts.units),
  }
}

/**
 * EVERY ROW THE SESSION CARD RENDERS, from one producer.
 *
 * 🔴 WHY THIS EXISTS. `sessionStepLegibility.test.ts` first asserted its
 * properties over `buildStepGroups` alone — which is the v2 MAIN SET and nothing
 * else. **Measured: that is 1,974 of 16,919 sessions (11.7%).** The other 88.3%
 * — every easy run and long run (14,221), the 5K time trial (422), race week
 * (302) — plus the warm-up, strides and cool-down rows of ALL of them, render
 * through the same `StepRowView` and were covered by nothing. The founder asked
 * whether the other session types had been regression-tested. They had not.
 *
 * ⚠️ AND THE TEST MUST NOT REBUILD THE COMPOSITION ITSELF. A test that assembles
 * its own idea of the rows is a second writer of the card's shape and drifts from
 * it silently — this repo's most expensive class, and the reason `deloadCadence`,
 * `tierResolution` and `sumWeeklyKm` all have single owners. So the COMPONENT
 * renders what this returns, and the GATE asserts over what this returns, and
 * there is no third version.
 *
 * Returns the rows in render order with their section, so a caller can style per
 * section without knowing how a section is built.
 */
/** Narrow the Session's `unknown` derived_set to a renderable v2 set.
 *  Lives here, beside the row producer, so the component and the gate cannot
 *  disagree about what "renderable" means. */
export function isV2DerivedSet(ds: unknown): ds is DerivedSet {
  return !!ds && (ds as { version?: number }).version === 2
    && Array.isArray((ds as { blocks?: unknown }).blocks) && (ds as DerivedSet).blocks.length > 0
}

export interface SessionRow { section: 'warmup' | 'main' | 'cooldown'; row: StepRow; repeat?: number; repeatLabel?: string; startsGroup?: boolean }

export function buildSessionRows(
  structure: SessionStructure,
  derivedSet: unknown,
  opts: BuildStepOpts & { figures: SessionDisplayFigures; raceSegmentTarget: string; raceSegmentSecondary: string },
): SessionRow[] {
  const out: SessionRow[] = []
  const { figures } = opts

  /**
   * 🔴 THE SAME THREE SLOTS ON EVERY ROW OF EVERY SESSION — founder, 2026-10-06:
   * *"any changes we make need to apply to all types of sessions and the warm up
   * and cool down. The look and feel has to be the same for the user."*
   *
   * These rows are hand-built (they have no `DerivedStep` behind them), so before
   * this they carried a free-text `detail` and nothing else. Under
   * SESSION-STEP-SLOTS-01 they take `target` and `secondary` like any main-set
   * step: **the target is line two, first, on a warm-up row exactly as on a
   * threshold rep.** The TYPE forced this — `StepRow` now requires the slots, so
   * a hand-built row cannot quietly opt out of the layout, which is how these
   * four drifted from the main set in the first place.
   *
   * ⚠️ The strings are the EXISTING ratified copy, re-SLOTTED, not rewritten:
   * "Final third in Z2" and "conversational or slower" were always targets
   * wearing a detail's clothes, and strides' "fast & relaxed, full recovery" is a
   * target and a note joined by a comma.
   */
  const row = (r: Omit<StepRow, 'amountValue' | 'amountUnit' | 'detail'>): StepRow => {
    const { value, unit } = splitAmount(r.amount)
    return { ...r, amountValue: value, amountUnit: unit,
      detail: [r.target, r.secondary].filter(Boolean).join(' · ') }
  }

  out.push({ section: 'warmup', row: row({ kind: 'work', role: 'Easy run', amount: figures.warmup, amountIsEstimate: true, target: 'Final third in Zone 2', secondary: '' }) })
  if (structure.strides) {
    out.push({ section: 'warmup', row: row({ kind: 'work', role: 'Strides', amount: `${structure.strides.count} × ${structure.strides.duration_secs}s`, amountIsEstimate: false, target: 'Fast and relaxed', secondary: '', note: 'Full recovery between each.' }) })
  }

  // §21b Am. 4 — one answer to "is this card measured in distance?", asked of
  // the composer's own stamp, so the step rows cannot disagree with the four
  // figures `resolveDisplayFigures` already produced from the same fact.
  const stepOpts: BuildStepOpts = { ...opts, sessionHasDistance: structure.main.distance_km != null }
  const groups = isV2DerivedSet(derivedSet) ? buildStepGroups(derivedSet, stepOpts) : null
  const seg = structure.race_pace_segment
  if (groups) {
    for (const g of groups) {
      g.rows.forEach((row, ri) => out.push({
        section: 'main', row,
        ...(g.repeat > 1 ? { repeat: g.repeat, repeatLabel: g.repeatLabel } : {}),
        ...(ri === 0 ? { startsGroup: true } : {}),
      }))
    }
  } else {
    // v1 session (no derived_set): the main block's ZONE is its target, and its
    // description is the instruction — the same split the v2 rows get.
    out.push({ section: 'main', row: row({ kind: 'work', role: seg ? 'Easy' : 'Main set', amount: figures.mainEasy, amountIsEstimate: true, target: formatZone(structure.main.zone), secondary: '', note: structure.main.description }), startsGroup: true })
  }
  if (seg && figures.racePace) {
    out.push({ section: 'main', row: row({ kind: 'work', role: 'Race pace', amount: figures.racePace, amountIsEstimate: true, target: opts.raceSegmentTarget, secondary: opts.raceSegmentSecondary }), ...(groups ? {} : { startsGroup: true }) })
  }

  out.push({ section: 'cooldown', row: row({ kind: 'rest', role: 'Easy jog / walk', amount: figures.cooldown, amountIsEstimate: true, target: 'Conversational or slower', secondary: '' }) })
  return out
}

/** Turn a resolved derived set into display-ready step groups. */
export function buildStepGroups(set: DerivedSet, opts: BuildStepOpts): StepGroup[] {
  return set.blocks.map(block => {
    const rows = block.steps.map(step => buildRow(step, opts))
    const isHills = block.steps.some(s => s.terrain === 'uphill' || s.terrain === 'downhill')
    return {
      repeat: block.repeat,
      ...(block.repeat > 1 ? { repeatLabel: isHills ? 'hill reps' : 'rounds of' } : {}),
      rows,
    }
  })
}
