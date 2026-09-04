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
