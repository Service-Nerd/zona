// SC-08b — v2 session structure: what a catalogue row says about the work
// inside a session, and how that description becomes concrete for one runner.
//
// Contract: docs/contracts/data/session-structure-v2.md
// Decision:  docs/architecture/ADR-019-session-structure-v2.md
//
// WHY THIS EXISTS. A v1 row describes its main set as one of eight ad-hoc
// shapes typed only as `Record<string, unknown>`. The 2026-08-19 catalogue
// audit scored those shapes against six things a coach would want to
// prescribe: 4 NO, 2 PARTIAL, 0 YES. Two structural limits cause all six —
// a repeat set is ONE repeated thing (one work step, one recovery step, a
// count), and the recovery step carries a free-text type word that nothing
// consumes, so walking recovery and jogged recovery produce identical output.
//
// A main set is an ordered list of BLOCKS. A block has a repeat count and an
// ordered list of STEPS. Everything else is composition.
import { z } from 'zod'

// ── Pace anchors ────────────────────────────────────────────────────────────
//
// THE RULE THAT MAKES THIS SAFE: a target names an ANCHOR, never a number.
// A catalogue row is shared by every runner, so a pace written into a row is
// wrong for all but one of them. The runner's own paces resolve the anchor at
// generation time. Enforced by INV-CAT-V2-NO-LITERAL-PACE.
export const PACE_ANCHORS = ['E', 'T', 'I', 'R', 'M', 'goal', 'race_5K', 'race_3K'] as const
export type PaceAnchor = typeof PACE_ANCHORS[number]

const PaceAnchorSchema = z.enum(PACE_ANCHORS)

// ── Targets ─────────────────────────────────────────────────────────────────
//
// `mode` is the concept v1 had no way to express: a pace is not always a band
// to hit. "Jog the recovery no slower than 6:30" is a FLOOR; "warm up no
// faster than X" is a CEILING. Same missing concept CD-11 asks for on easy
// runs (audit case 6).
export const TargetSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('pace'),
    anchor: PaceAnchorSchema,
    mode: z.enum(['target', 'ceiling', 'floor']).default('target'),
    tolerance_pct: z.number().min(0).max(20).optional(),
  }),
  z.object({ kind: z.literal('zone'), zone: z.string() }),
  // Effort with NO pace — the case hill reps need. §19's label-integrity rule
  // has nothing to check against here, which is why CD-17a requires a matching
  // principle on effort-governed sessions.
  z.object({ kind: z.literal('effort'), rpe: z.number().int().min(1).max(10) }),
  z.object({ kind: z.literal('none') }),
])
export type StepTarget = z.infer<typeof TargetSchema>

// ── Length ──────────────────────────────────────────────────────────────────
export const LengthSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('duration'), secs: z.number().int().positive() }),
  z.object({ kind: z.literal('distance'), m: z.number().int().positive() }),
  // "Run to the bottom of the hill" — a step whose length the terrain decides,
  // not the plan. v1 had no way to say this.
  z.object({ kind: z.literal('to_landmark'), landmark: z.enum(['hill_base', 'hill_top', 'start']) }),
  // "Jog back down" — length defined by the step it undoes.
  z.object({ kind: z.literal('mirror'), of: z.literal('previous_work') }),
  // Open-ended: until the runner is ready. Not a duration we can resolve, and
  // deliberately so.
  z.object({ kind: z.literal('open') }),
])
export type StepLength = z.infer<typeof LengthSchema>

// ── Step ────────────────────────────────────────────────────────────────────
//
// `modality` is a CLOSED set, which is the whole of audit case 4. In v1 the
// recovery "type" was free text nothing acted on, so a walking recovery and a
// jogged recovery produced identical plan output. Here they differ in the
// session's distance and duration because `jog` covers ground and `stand`
// does not.
export const StepSchema = z.object({
  role: z.enum(['work', 'recovery', 'transition']),
  modality: z.enum(['run', 'jog', 'walk', 'stand', 'hike']),
  terrain: z.enum(['flat', 'uphill', 'downhill', 'rolling']).optional(),
  grade_pct: z.tuple([z.number(), z.number()]).optional(),
  length: LengthSchema,
  target: TargetSchema,
  advance: z.enum(['auto', 'manual']).default('auto'),
  note: z.string().optional(),
})
export type Step = z.infer<typeof StepSchema>

export const BlockSchema = z.object({
  repeat: z.number().int().positive(),
  label: z.string().optional(),
  steps: z.array(StepSchema).min(1),
})
export type Block = z.infer<typeof BlockSchema>

// ── The structure ───────────────────────────────────────────────────────────
//
// NOTE THE OMISSION. The audit's spec put a sizing BUDGET here
// (`budget_basis` + `budget_pct_of_weekly`). SC-10 built exactly that, swept it
// across 18,056 plans and it was REJECTED: share-of-weekly-volume cannot
// express what it was meant to, because every session scales with the week it
// sits in. Encoding that basis into the row schema would spread a rejected
// model across the catalogue.
//
// `scaling` is kept — WHICH DIMENSION STRETCHES is a genuine property of a
// session shape and is independent of how a budget is computed. The budget
// itself waits for SIZING-REALLOC-01.
export const StructureV2Schema = z.object({
  version: z.literal(2),
  sizing: z.object({
    scaling: z.enum(['reps', 'rep_length', 'fixed']),
  }),
  blocks: z.array(BlockSchema).min(1),
})
export type StructureV2 = z.infer<typeof StructureV2Schema>

/** A row is v2 if — and only if — it says so. Unversioned rows keep v1 semantics forever (D-03). */
export function isV2Structure(s: unknown): s is StructureV2 {
  return !!s && typeof s === 'object' && (s as { version?: unknown }).version === 2
}
