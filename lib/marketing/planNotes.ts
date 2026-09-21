// MKT-PLAN-PHASE-NOTE-01 — the phase note is derived from the weeks it sits
// above, not written once and hoped for.
//
// The single owner (D-08) of the prose that introduces each phase block on a
// `/plans/*` page. It used to be a constant map in `PlanPage.tsx`, and the
// base entry read "All easy. Building the engine, with no hard running yet,
// and that is the point." above a block that, on five of the nine published
// plans, contained a 5K time trial. §78 puts the benchmark in a base deload
// week deliberately (fresher legs), so the plan was right and the sentence was
// wrong, on a public page, every day, against the one claim those pages exist
// to make.
//
// This is the failure CLAUDE.md already names: prose about a rule drifts from
// the rule. So the note is computed and `planNotes.test.ts` fails the build if
// a claim stops being true of the weeks underneath it.

import type { Week, Session } from '@/types/plan'

const HARD_TYPES = new Set(['quality', 'tempo', 'intervals', 'hard'])

/** Sessions in `weeks` that are not easy running: quality, tempo, intervals, a time trial. */
export function hardSessionsIn(weeks: Week[]): Session[] {
  return weeks.flatMap(w => Object.values(w.sessions).filter((s): s is Session => !!s && HARD_TYPES.has(s.type)))
}

export const PHASE_LABEL: Record<string, string> = {
  base: 'Base',
  build: 'Build',
  peak: 'Peak',
  taper: 'Taper',
  foundation: 'Foundation',
  maintenance_base: 'Base',
  maintenance_restoration: 'Recovery',
}

/**
 * The note for one run of consecutive weeks in the same phase.
 *
 * `weeks` is that run, in order. Returns an empty string for a phase with
 * nothing worth saying, which the page renders as no paragraph at all.
 */
export function phaseNote(phase: string, weeks: Week[]): string {
  switch (phase) {
    case 'base': {
      // §78 schedules the recalibration time trial into a base deload week.
      // When it lands here, say so: a reader can see it in the table.
      const hard = hardSessionsIn(weeks)
      if (hard.length === 0) return 'All easy. Building the engine, with no hard running yet, and that is the point.'
      return 'Easy running, plus a time trial to set your paces. Building the engine is still the job.'
    }
    case 'build':
      // "most weeks", not "a week": the recovery weeks inside the build block
      // drop the quality session, and three of the nine published plans have
      // one. Measured, not assumed.
      return 'Quality arrives. One hard session most weeks; the rest stays genuinely easy.'
    case 'peak':
      return 'The sharpest weeks. Hold the zone on the hard days, protect the easy ones.'
    case 'taper':
      return 'Less volume, same intensity. Arrive fresh, not flat.'
    case 'foundation':
      return 'Settling in before the plan proper begins.'
    case 'maintenance_base':
      return 'Steady aerobic work.'
    case 'maintenance_restoration':
      return 'Backing off on purpose.'
    default:
      return ''
  }
}
