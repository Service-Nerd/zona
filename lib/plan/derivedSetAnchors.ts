import { catalogueRowFor } from './catalogueLink'
import { StructureV2Schema, isV2Structure, type Step as StructureStep } from './sessionStructureV2'
import type { DerivedSet, DerivedStep } from './resolveMainSet'
import type { SessionCatalogueRow } from './sessionCatalogueData'

/**
 * RECAL-PACE-TWO-WRITER-01 Stage 0 — RECOVERING A STORED STEP'S ANCHOR.
 *
 * `applyRecalibration` must re-price a forward session's work steps, and a
 * resolved step carries only its OUTCOME (`pace: "5:12–5:27 /km"`), never the
 * anchor that produced it. Re-pricing therefore needs the anchor back.
 *
 * ⚠️ `resolveMainSet` CANNOT BE RE-RUN, and that was the first design. A
 * session stamps `catalogue_id` but NO variant id and NO params, so a
 * re-resolve has to GUESS which variant produced `length: "18 min"` — and a
 * guess that lands on the wrong variant silently reshapes the session.
 * Coaching Board RECAL-SIZING-PROPERTY-01 amendment 2 then settled it from the
 * other side: **re-derivation only, never re-selection.** The variant must not
 * change, so it never needs to be known.
 *
 * What IS recoverable is the structural TARGET, because the catalogue row is
 * static data keyed by `catalogue_id` and the resolver preserves shape: one
 * derived block per structural block, one derived step per structural step.
 * Measured before this module was written — 297 of 297 generated quality
 * sessions align 1:1 on both counts.
 *
 * ⚠️ IT RETURNS `null` RATHER THAN A PARTIAL WALK. An unalignable session is
 * one whose anchors cannot be recovered, and the only safe thing to do with it
 * is leave it alone. A caller that re-prices half a session has produced a
 * worse artefact than one that re-prices none of it, so there is no
 * best-effort mode on purpose — and Stage 2 counts the refusals instead of
 * absorbing them.
 */
export interface AlignedStep {
  /** The stored, already-resolved step — what the runner currently sees. */
  derived: DerivedStep
  /** Its structural counterpart, which carries the anchor. */
  structural: StructureStep
  blockIndex: number
  stepIndex: number
}

type Alignable = { catalogue_id?: string; label?: string | null; derived_set?: DerivedSet | null }

/**
 * Pairs every stored derived step with the structural step that produced it,
 * or `null` when the pairing cannot be established.
 */
export function alignDerivedToStructure(
  session: Alignable | null | undefined,
  catalogue?: SessionCatalogueRow[],
): AlignedStep[] | null {
  const derived = session?.derived_set
  if (!derived || !Array.isArray(derived.blocks)) return null

  const row = catalogue ? catalogueRowFor(session, catalogue) : catalogueRowFor(session)
  if (!row || !isV2Structure(row.main_set_structure)) return null

  const parsed = StructureV2Schema.safeParse(row.main_set_structure)
  if (!parsed.success) return null

  const sBlocks = parsed.data.blocks
  if (derived.blocks.length !== sBlocks.length) return null

  const out: AlignedStep[] = []
  for (let b = 0; b < sBlocks.length; b++) {
    const dSteps = derived.blocks[b]?.steps
    const sSteps = sBlocks[b].steps
    if (!Array.isArray(dSteps) || dSteps.length !== sSteps.length) return null
    for (let s = 0; s < sSteps.length; s++) {
      out.push({ derived: dSteps[s], structural: sSteps[s], blockIndex: b, stepIndex: s })
    }
  }
  return out
}

/**
 * The anchors a session's steps were priced from, in step order. `null` where a
 * step is not pace-anchored at all — effort-governed (§40b / CD-17a), zoned, or
 * targetless — which is a legitimate absence (§24b) and never a failure.
 */
export function recoverStepAnchors(
  session: Alignable | null | undefined,
  catalogue?: SessionCatalogueRow[],
): (string | null)[] | null {
  const aligned = alignDerivedToStructure(session, catalogue)
  if (!aligned) return null
  return aligned.map(a => (a.structural.target.kind === 'pace' ? a.structural.target.anchor : null))
}
