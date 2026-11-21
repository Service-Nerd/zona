/**
 * The scorecard's corpora: the EXISTING corpora, sampled by a coprime stride, in production shape.
 *
 * ⚠️ This is the interim population. ADR-027 B0 is building a production-shaped golden corpus in
 * parallel (`lib/plan/goldenCorpus.ts`, another owner). It plugs in through `CorpusProvider`
 * (`runScorecard({ corpora })` / `scripts/scorecard.ts --corpus golden`); nothing here imports it.
 *
 * Every case pins `planStart` and `today` (ARCH-ENG-005). The one clock the scorecard cannot pin is
 * the engine's own VDOT staleness read (`docs/contracts/engine.md` § The clock); `slowGoalGrid` is
 * dated from today by its owner (`slowGoalDates`) for exactly that reason.
 */
import type { GeneratorInput } from '@/types/plan'
import { cohortGrid, targetedGridCore, targetedGridExtra, COHORT_PLAN_START } from '@/lib/plan/cohortGrid'
import { slowGoalGrid, slowGoalDates } from '@/lib/plan/slowGoalGrid'
import { fullEnvelope, ENVELOPE_PLAN_START } from '@/lib/plan/useCaseEnvelope'
import { PLAN_PERSONAS, charityInput, CHARITY_PLAN_START } from '@/lib/plan/charityCohort'
import { beginnerMarathonGrid, BEGINNER_MARATHON_PLAN_START } from '@/lib/plan/beginnerMarathonGrid'
import type { Corpus, CorpusCase, CorpusProvider } from './types'

const minusDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) - n * 864e5).toISOString().slice(0, 10)
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)

/** `n` rows spread across `xs` by a stride coprime with its length. A prefix of an ordered grid is
 *  not a sample (LIVENESS-DEBT-01), and an even stride aliases a structured grid. */
export function spread<T>(xs: readonly T[], n: number): T[] {
  if (xs.length <= n) return [...xs]
  let s = 7919
  while (gcd(s, xs.length) !== 1) s += 2
  return Array.from({ length: n }, (_, k) => xs[(k * s) % xs.length] as T)
}

/** COHORT-GRID-UNSET-LEVEL-01 / ARCH-ENG-007: `fitness_level` is the API's structural override and
 *  no product path sends it. Stripped from every row, whatever the provider. */
export function productionShape(input: GeneratorInput): GeneratorInput {
  if (!('fitness_level' in (input as object))) return input
  const { fitness_level: _drop, ...rest } = input as GeneratorInput & { fitness_level?: unknown }
  void _drop
  return rest as GeneratorInput
}

const cases = (inputs: GeneratorInput[], planStart: string): CorpusCase[] =>
  inputs.map(input => ({ input: productionShape(input), planStart, today: minusDays(planStart, 3) }))

/** Sample sizes. `fast` is the vitest gate; `full` is `npm run scorecard`. */
const N = {
  full: { cohort: 3000, targeted: 1500, slow: Infinity, envelope: 3000, beginnerMarathon: Infinity },
  fast: { cohort: 90, targeted: 40, slow: 40, envelope: 90, beginnerMarathon: 120 },
} as const

export const existingCorpora: CorpusProvider = mode => {
  const n = N[mode]
  const slow = slowGoalDates()
  return [
    { name: 'cohortGrid', cases: cases(spread(cohortGrid(), n.cohort), COHORT_PLAN_START) },
    { name: 'targetedGrid', cases: cases([...spread(targetedGridCore(), n.targeted), ...targetedGridExtra()], COHORT_PLAN_START) },
    { name: 'slowGoalGrid', cases: cases(spread(slowGoalGrid(slow.planStart, slow.benchmarkDate) as unknown as GeneratorInput[], n.slow), slow.planStart) },
    { name: 'envelope', cases: cases(spread(fullEnvelope().map(c => c.input), n.envelope), ENVELOPE_PLAN_START) },
    { name: 'beginnerMarathon', cases: cases(spread(beginnerMarathonGrid(), n.beginnerMarathon), BEGINNER_MARATHON_PLAN_START) },
    { name: 'personas', cases: cases(PLAN_PERSONAS.map(p => charityInput(p)), CHARITY_PLAN_START) },
  ] satisfies Corpus[]
}
