/**
 * ADR027-B0-SCORECARD — the shapes every plan-read predicate and scorecard line share.
 */
import type { GeneratorInput, Plan, Week } from '@/types/plan'
import type { RunContext, StrengthPlan, StrengthProfile } from '@/packages/strength'
import type { MaintenanceBlockOptions } from '@/lib/plan/maintenance'

/**
 * Where a predicate came from.
 * - `NEW`        a defect class the final plan read (2026-11-20) found, covered by no item, triage row or ruling
 * - `FIX`        a FIX class from the objection triage (2026-11-20): the board ruled it must reach 0
 * - `NOTE-TRUTH` a note that claims something false about its own plan
 */
export type PredicateClass = 'NEW' | 'FIX' | 'NOTE-TRUTH'

interface PredicateMeta {
  /** Stable id. A line in the baseline is keyed by it; never reuse one for a different predicate. */
  id: string
  /** The principle the plan breaks, e.g. `§3` or `§117 Am. 2` or `S8`. */
  section: string
  cls: PredicateClass
  /** Which slice of the read (or triage row) it came from. */
  source: string
  /** One sentence: what fires, in the runner's terms. */
  description: string
}

export type PlanKind = 'race' | 'base_build'

/** Fires on a generated plan. Returns a short detail string when it fires, else null. */
export interface PlanPredicate extends PredicateMeta {
  /** Plan kinds it reads. Default: race plans only. */
  kinds?: PlanKind[]
  test: (p: Plan, i: GeneratorInput) => string | null
}

export interface StrengthPredicate extends PredicateMeta {
  test: (sp: StrengthPlan, ctx: RunContext, profile: StrengthProfile, i: GeneratorInput) => string | null
}

export interface MaintenancePredicate extends PredicateMeta {
  test: (weeks: Week[], opts: MaintenanceBlockOptions) => string | null
}

/** A row of the scorecard. `better` says which way is worse:
 *  - `zero`   any value above 0 is WORSE (hard rules: error violations, crashes)
 *  - `lower`  may only fall (FIX / NEW / NOTE-TRUTH counts, objection counts)
 *  - `higher` may only rise (fit rates, build medians), within `tol`
 *  - `stable` may not move beyond `tol` either way (corpus sizes, cohort shape)
 *  - `pass`   1 = the step's own gate passed, 0 = it failed; anything but 1 is WORSE */
export type Direction = 'zero' | 'lower' | 'higher' | 'stable' | 'pass'

export interface Line {
  id: string
  /** `null` = could not be measured. Unverified is never a pass. */
  value: number | null
  better: Direction
  /** Allowed movement in the worse direction (or either direction for `stable`). Default 0. */
  tol?: number
  /** Printed in the table by default. Detail lines are compared but printed only when not OK. */
  headline?: boolean
}

export interface BaselineLine { value: number; better: Direction; tol?: number }

export type Verdict = 'OK' | 'BETTER' | 'WORSE' | 'MOVED' | 'NEW' | 'MISSING' | 'NOT MEASURED'
export const FAILING: ReadonlySet<Verdict> = new Set<Verdict>(['WORSE', 'MOVED', 'NEW', 'MISSING', 'NOT MEASURED'])

export interface Row { id: string; today: number | null; baseline: number | null; delta: number | null; verdict: Verdict; headline: boolean }

/** A corpus case. `planStart` and `today` are pinned so the run is reproducible (ARCH-ENG-005). */
export interface CorpusCase { input: GeneratorInput; planStart: string; today: string }
export interface Corpus { name: string; cases: CorpusCase[] }

/**
 * The hook for the golden corpus (ADR-027 B0, built in parallel as `lib/plan/goldenCorpus.ts`).
 * The scorecard accepts any provider of this shape; it does not import the golden corpus itself,
 * so it builds and runs before that file exists.
 */
export type CorpusProvider = (mode: 'full' | 'fast') => Corpus[]
