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
import { apportionRoundedDistance } from '@/lib/format'

export type StepKind = 'work' | 'rest'

export interface StepRow {
  kind: StepKind
  /** Plain-language action: "Hard", "Jog", "Uphill", "Stand", "Jog down", "Run to base". */
  role: string
  /** Primary metric — leads with the user's chosen unit. e.g. "~1.1 km", "1:30", "until ready". */
  amount: string
  /** True when `amount` is a pace-derived estimate (shows the ~ marker). */
  amountIsEstimate: boolean
  /** Secondary line: "5 min · 4:25–4:35 /km", "RPE 8", "≤ 5:53–7:02 /km", "rest". */
  detail: string
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

/** The pace / RPE / zone clause, without the length. */
export function targetClause(step: DerivedStep): string {
  if (step.pace) {
    const prefix = step.pace_mode === 'ceiling' ? '≤ ' : step.pace_mode === 'floor' ? '≥ ' : ''
    return `${prefix}${step.pace}`
  }
  if (step.rpe != null) return `RPE ${step.rpe}`
  if (step.zone) return step.zone
  return ''
}

// ── row assembly ───────────────────────────────────────────────────────────

function formatSecsShort(secs: number): string {
  if (secs % 60 === 0) return `${secs / 60} min`
  if (secs < 60) return `${secs}s`
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
}

function buildRow(step: DerivedStep, opts: BuildStepOpts): StepRow {
  const parsed = parseLength(step.length)
  const kind: StepKind = step.role === 'work' ? 'work' : 'rest'
  const role = roleLabelForStep(step, parsed)
  const target = targetClause(step)

  // Distance-native step: the prescription IS a distance ("400 m") — show it.
  if (parsed.kind === 'distance') {
    return { kind, role, amount: opts.formatDist(parsed.km), amountIsEstimate: false, detail: target }
  }

  // Duration-native step.
  if (parsed.kind === 'duration') {
    const durStr = formatSecsShort(parsed.secs)
    const paceSec = paceMeanSecPerKm(step.pace)
    if (opts.metric === 'distance' && paceSec) {
      // Estimate distance from pace — same convention as the section totals.
      const estKm = roundEstKm(parsed.secs / paceSec)
      const detail = [durStr, target].filter(Boolean).join(' · ')
      return { kind, role, amount: `~${opts.formatDist(estKm)}`, amountIsEstimate: true, detail }
    }
    // Duration primary (toggle on time, or no pace to estimate from — e.g. a
    // hill rep at RPE, where there is no honest distance to show).
    return { kind, role, amount: durStr, amountIsEstimate: false, detail: target }
  }

  // Text length ("until ready", "to the bottom of the hill").
  return { kind, role, amount: parsed.text, amountIsEstimate: false, detail: target || (kind === 'rest' ? 'rest' : '') }
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
  return metric === 'distance' ? `~${value}${units}` : `${value} min`
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
