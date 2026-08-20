// SC-08b — the single owner (D-08) of "v2 shape + this runner → concrete set".
//
// Contract: docs/contracts/data/session-structure-v2.md
//
// A catalogue row is shared by every runner, so it cannot hold both "4 × 1000 m"
// AND this runner's numbers. The row holds the SHAPE; the session holds the
// RESOLVED set. This module is the only place that turns one into the other —
// and in particular the only place that turns a named pace anchor into a pace.
//
// Together with `catalogue_id` (ADR-018) this closes the seventh gap the audit
// called blocking: identity told us WHICH row, the derived set tells us WHAT
// this runner actually does. Without both, a v2 schema is invisible to a runner.
import type { PaceAnchor, StepTarget, StructureV2 } from './sessionStructureV2'

/** The runner's resolved paces, keyed by anchor. Absent anchors are legitimate —
 *  a beginner has no marathon pace, and `goal` exists only for a time target. */
export type PaceAnchorMap = Partial<Record<PaceAnchor, string>>

export interface ResolveContext {
  anchors: PaceAnchorMap
  /** Easy pace, used for `mirror` and `to_landmark` steps whose pace is not prescribed. */
  easyPaceStr?: string
  /**
   * Values for the row's `{ kind: 'parameter' }` references (SC-09 / CD-17a).
   * Supplied by the chosen variant — e.g. `{ rep_secs: 45, reps: 10 }` for
   * "Hill reps — 45s". A parameter with no value is a data defect, not a
   * runtime condition: the resolver throws rather than silently emitting a
   * zero-length step, because a session with a 0-second work interval is worse
   * than no session at all.
   */
  params?: Record<string, number>
}

/** One step, with everything the runner needs to execute it. No anchors remain. */
export interface DerivedStep {
  role: 'work' | 'recovery' | 'transition'
  modality: 'run' | 'jog' | 'walk' | 'stand' | 'hike'
  terrain?: 'flat' | 'uphill' | 'downhill' | 'rolling'
  /** Human-readable length: "3 min", "1000 m", "to the bottom of the hill". */
  length: string
  /** Resolved pace band, or null when the step is deliberately effort-governed. */
  pace: string | null
  /** How to read `pace` — a band to hit, an upper limit, or a lower limit. */
  pace_mode?: 'target' | 'ceiling' | 'floor'
  zone?: string
  rpe?: number
  advance: 'auto' | 'manual'
  note?: string
}

export interface DerivedBlock {
  repeat: number
  label?: string
  steps: DerivedStep[]
}

export interface DerivedSet {
  version: 2
  blocks: DerivedBlock[]
}

const LANDMARK_TEXT: Record<string, string> = {
  hill_base: 'to the bottom of the hill',
  hill_top: 'to the top of the hill',
  start: 'back to the start',
}

function formatSecs(secs: number): string {
  if (secs % 60 === 0) return `${secs / 60} min`
  if (secs < 60) return `${secs}s`
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
}

function formatDistance(m: number): string {
  return m >= 1000 && m % 1000 === 0 ? `${m / 1000} km` : `${m} m`
}

/**
 * Resolve a target to a pace string.
 *
 * Returns `null` when the step is deliberately effort-governed (hill reps), and
 * ALSO when the anchor is unavailable for this runner — a beginner has no
 * marathon pace, and `goal` exists only for a time target. Both are legitimate
 * absences, not errors: the step degrades to its zone or RPE rather than
 * inventing a number, which is the whole point of anchors over literals.
 */
function resolvePace(target: StepTarget, ctx: ResolveContext): string | null {
  if (target.kind !== 'pace') return null
  return ctx.anchors[target.anchor] ?? null
}

function requireParam(param: string, ctx: ResolveContext): number {
  const v = ctx.params?.[param]
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) {
    // Loud on purpose. A missing parameter means the row and the variant
    // disagree, which is a catalogue defect — INV-CAT-V2-WELL-FORMED catches it
    // ahead of generation. Failing soft here would ship a 0-second interval.
    throw new Error(`resolveMainSet: parameter "${param}" has no value in this variant`)
  }
  return v
}

export function resolveMainSet(structure: StructureV2, ctx: ResolveContext): DerivedSet {
  return {
    version: 2,
    blocks: structure.blocks.map(block => {
      const steps: DerivedStep[] = []
      // Tracks the most recent WORK step so a `mirror` step can take its length.
      // Scoped to the block, because "jog back down" mirrors the climb in the
      // same rep — not one from a previous block.
      let lastWorkLength: string | null = null

      for (const step of block.steps) {
        let length: string
        switch (step.length.kind) {
          case 'duration':    length = formatSecs(step.length.secs); break
          case 'distance':    length = formatDistance(step.length.m); break
          case 'to_landmark': length = LANDMARK_TEXT[step.length.landmark] ?? step.length.landmark; break
          case 'open':        length = 'until ready'; break
          case 'parameter':   length = formatSecs(requireParam(step.length.param, ctx)); break
          case 'mirror':
            // A mirror with no preceding work step is malformed data, not a
            // runtime condition to paper over — INV-CAT-V2-WELL-FORMED rejects
            // it at the row. The fallback keeps the renderer honest if one ever
            // slips through, rather than emitting an empty instruction.
            length = lastWorkLength ? `same as the ${lastWorkLength}` : 'back to the start'
            break
        }

        const pace = resolvePace(step.target, ctx)
        steps.push({
          role: step.role,
          modality: step.modality,
          ...(step.terrain ? { terrain: step.terrain } : {}),
          length,
          pace,
          ...(step.target.kind === 'pace' ? { pace_mode: step.target.mode } : {}),
          ...(step.target.kind === 'zone' ? { zone: step.target.zone } : {}),
          ...(step.target.kind === 'effort' ? { rpe: step.target.rpe } : {}),
          advance: step.advance,
          ...(step.note ? { note: step.note } : {}),
        })

        if (step.role === 'work') lastWorkLength = length
      }

      const repeat = typeof block.repeat === 'number'
        ? block.repeat
        : requireParam(block.repeat.param, ctx)
      return { repeat, ...(block.label ? { label: block.label } : {}), steps }
    }),
  }
}

/** One-line rendering, e.g. "5 × (3 min at 4:28–4:39 /km + 2 min jog)". */
export function describeDerivedSet(set: DerivedSet): string {
  return set.blocks.map(b => {
    const inner = b.steps.map(s => {
      const at = s.pace
        ? ` at ${s.pace_mode === 'ceiling' ? 'no faster than ' : s.pace_mode === 'floor' ? 'no slower than ' : ''}${s.pace}`
        : s.rpe ? ` at RPE ${s.rpe}`
        : s.zone ? ` in ${s.zone}`
        : ''
      const how = s.role === 'recovery' && s.modality !== 'run' ? ` ${s.modality}` : ''
      return `${s.length}${at}${how}`
    }).join(' + ')
    return b.repeat > 1 ? `${b.repeat} × (${inner})` : inner
  }).join(', then ')
}
