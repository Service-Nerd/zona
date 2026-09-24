// hrBand.ts — the single owner of "which HR band is this session in?".
//
// 🔴 IT EXISTS BECAUSE THE ANSWER WAS WRITTEN TWICE AND I WROTE THE SECOND COPY,
// ON 2026-09-24, AND IT CHANGED A LIVE RUNNER'S PRESCRIPTION.
//
// The generator decides by the session's CATALOGUE CATEGORY: `isVo2max` is
// `catalogueRow?.category === 'vo2max'` (`ruleEngine.ts:1497`), and both it and
// the effort-governed branch take `zones.intervalsZone` / `zones.intervalsHR`
// (`ruleEngine.ts:1806-1813`). Everything else quality takes the quality band.
//
// `applyHrToPlan` re-derived it from `session.type === 'quality'`. **Every VO2max
// session carries `type: 'quality'`** — the type is the slot, the category is the
// stimulus — so the two classifiers disagreed on exactly the VO2max set. Running
// the backfill rewrote plan `8a2858ab` weeks 5 and 9 from
//
//     "Zone 4–5"  157–182 bpm      ->      "Zone 3"  145–156 bpm
//
// which is a VO2max session downgraded to threshold, on a real plan, in both the
// header and the coach note at once — so the card looked CONSISTENT and wrong.
// Measured across all 22 live plans: 12 more sessions were one run away from the
// same rewrite.
//
// ⚠️ WHAT DID NOT CATCH IT, BECAUSE THE LIST IS THE POINT. Six unit tests, two
// mutation kills, `verify:parity` IDENTICAL over 5,994 cases, and a full green
// suite. The fixture is a 5K beginner plan that contains no VO2max session, and
// the parity grid never calls `applyHrToPlan` at all. **A test suite cannot see a
// classifier disagree with a producer it never runs beside** — which is why the
// gate for this module is `hrBandReach.test.ts`, asserting this predicate
// predicts the band the GENERATOR actually wrote, across a real corpus.
//
// Catalogue class: "parallel classifier drift" / "checker reads a different
// source from the producer". Third instance this week, first one I authored.
//
// ── THE RULE ─────────────────────────────────────────────────────────────────
//
// Read the producer's own discriminator — the stamped `catalogue_id` via
// `catalogueRowFor` (ADR-018, INV-CLASS) — never `type`, never the label, never
// the zone string. A session whose row cannot be resolved returns `null` and its
// caller must LEAVE IT ALONE. `null` is not "probably quality": guessing is what
// this module exists to stop.

import { catalogueRowFor } from './catalogueLink'
import { isShakeout } from './sessionRole'
import { isV2Structure, StructureV2Schema } from './sessionStructureV2'
import type { SessionCatalogueRow } from './sessionCatalogueData'

/** The four bands `computeZones` produces, plus `null` for "do not touch". */
export type HrBand = 'quality' | 'intervals' | 'easy' | 'shakeout' | null

interface BandableSession {
  type?: string
  role?: string
  label?: string | null
  catalogue_id?: string
  hr_target?: string
}

/**
 * `ruleEngine.ts:1513` — a row is effort-governed when every v2 work step is
 * anchored to an EFFORT rather than a pace. Derived from the row alone, which is
 * why it can live here rather than inside generation.
 */
export function isEffortGovernedRow(row: SessionCatalogueRow | null): boolean {
  if (!row || !isV2Structure(row.main_set_structure)) return false
  const parsed = StructureV2Schema.safeParse(row.main_set_structure)
  if (!parsed.success) return false
  const work = parsed.data.blocks.flatMap(b => b.steps).filter(st => st.role === 'work')
  return work.length > 0 && work.every(st => st.target.kind === 'effort')
}

/**
 * Which band did the generator put this session in?
 *
 * Returns `null` when the session has no HR band at all, or when its catalogue
 * row cannot be resolved — a caller must then leave the session untouched.
 */
export function hrBandFor(session: BandableSession | null | undefined): HrBand {
  if (!session) return null
  // A session with no band never had one and must not acquire one.
  if (typeof session.hr_target !== 'string') return null

  if (session.type === 'quality' || session.type === 'hard') {
    // §78's race-week shakeout is never a quality slot, so this order is safe.
    const row = catalogueRowFor(session)
    // ⚠️ UNRESOLVABLE IS NOT "QUALITY". A pre-SC-08a plan may carry no stamp and
    // a label the catalogue no longer knows. Guessing the band for those is the
    // exact move that downgraded a live VO2max session, so they return null and
    // keep whatever the generator gave them.
    if (!row) return null
    if (row.category === 'vo2max' || isEffortGovernedRow(row)) return 'intervals'
    return 'quality'
  }

  if (isShakeout(session as never)) return 'shakeout'
  if (session.type === 'easy') return 'easy'
  return null
}
