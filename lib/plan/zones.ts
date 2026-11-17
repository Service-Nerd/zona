// zones.ts — the single owner of "what HR bands does this runner train in?".
//
// ⚠️ EXTRACTED FROM `ruleEngine.ts` 2026-09-24 (PLAN-ZONE-VS-HRTARGET-01) AND
// THE REASON IS A LIVE DEFECT, not tidiness.
//
// `computeZones` was PRIVATE to `ruleEngine.ts`, a server module. The dashboard
// needs the same arithmetic when a runner corrects their HR, could not reach it,
// and so hand-rolled `Math.round(rhr + 0.70 * (mhr - rhr))` inline — a second
// copy of the Z2 boundary living in a React component. That is the
// DELOAD-OWNER-01 / TIER-OWNER-01 / SESSION-KM-01 class, and it had already
// produced the bug this extraction exists to fix: HR changed, `meta` was
// updated, every session's `hr_target` kept the OLD band, and the runner saw
// "Zone 3 · 161–175 bpm" in the header above "158–171 bpm" in the note.
//
// Moved here for the same reason `tanakaMaxHR` went to `maxHrGuard.ts` and
// `assessFitness` to `fitnessAssessment.ts`: single owner, CLIENT-SAFE, shared
// with the surfaces that need it. This module imports only GENERATION_CONFIG.
//
// ⚠️ THE BODY IS VERBATIM. Nothing in the arithmetic changed during the move —
// `verify:parity` must come back IDENTICAL across 5,994 cases, and if it does
// not, the extraction is wrong and nothing else in the change matters.

import { GENERATION_CONFIG } from './generationConfig'
// ⚠️ THE SINGLE OWNER of "which HR band is this session in" (PLAN-VO2MAX-BAND-01).
// This module used to answer that inline from `session.type`, and `isShakeout`
// was imported here for the one case that got right. Both answers now live in
// `hrBand.ts`, beside the reason — a second copy of a classifier is what put a
// VO2max session in the threshold band on a live plan.
import { hrBandFor } from './hrBand'
import { bandForAnchors, anchorsForQualityPrescription } from './anchorBand'
import { catalogueRowFor } from './catalogueLink'

/**
 * 🔴 EVERY FIELD IS OPTIONAL SINCE `MAXHR-AGE-ABSENT-01` (Coaching Board 2026-11-17), AND THE
 * REASON IS THAT THE ENGINE USED TO INVENT AN AGE RATHER THAN ADMIT IT HAD NONE.
 *
 * `computeZones` always populates every field — it is handed a max. The absent case comes from
 * `buildHRZonesWithFallback`: with **no age and no max** there is nothing to derive a zone from,
 * and §50's fallback table says *"estimate max from age"* in every arm that could help. The old
 * code satisfied that by fabricating age 30 in the WIZARD (`GeneratePlanScreen.tsx:1024`), which
 * put a 60-year-old's easy ceiling at 150 bpm when 150 is above the top of their own Zone 3.
 *
 * ⚠️ SO THE OPTIONALITY IS THE POINT, NOT A CONVENIENCE: §14 Amendment 2 says *"where nothing
 * can be derived, the field stays absent and the talk test IS the prescription"*, and it warns
 * that *"nothing derivable means no `hr_derived_max`, not 'the runner supplied nothing'"* —
 * because §50 falls back to Tanaka. **With no age Tanaka cannot be computed, so this is the
 * first case that genuinely meets that clause's own test.** The compiler is what enumerates the
 * read sites; a sentinel number would have let them all pass.
 */
export interface ZoneTargets {
  zone2Ceiling?: number
  /** Bottom of Z2. Added 2026-09-24 (PLAN-RESTING-HR-ZERO-01) because
   *  `race-times` was deriving it by hand — the third copy of this formula —
   *  and doing so UNGUARDED, so a stored `resting_hr: 0` gave a 187 bpm runner
   *  an aerobic floor of 112. A caller that has to re-derive half a band is a
   *  caller the owner has under-served. */
  zone2Floor?: number
  easyHR?: string
  shakeoutHR?: string
  qualityHR?: string
  /** §84 — the zone string that DESCRIBES `qualityHR`. Paired at construction. */
  qualityZone?: string
  /** §84 — the zone string that DESCRIBES `intervalsHR`. Paired at construction. */
  intervalsZone?: string
  intervalsHR?: string
  /** ADR-026 R1 — the two numbers `anchorHrBand` converts through, carried so a caller
   *  holding a `ZoneTargets` never re-fetches or re-guesses them. `restingHr` is `null`
   *  when the %MaxHR branch was taken, which is exactly when no band can be derived. */
  maxHr?: number
  restingHr?: number | null
}


export function computeZones(mhr: number, rhr?: number): ZoneTargets {
  const Z = GENERATION_CONFIG.ZONES
  // 🔴 A NON-POSITIVE RESTING HR IS ABSENT, NOT A MEASUREMENT (PLAN-RESTING-HR-ZERO-01).
  //
  // §14: "Karvonen when the user's resting HR is KNOWN; %MaxHR when only max HR
  // is known." A `0` is not known — but `0` IS a number, so the old
  // `rhr !== undefined` test took the KARVONEN branch with a zero baseline. That
  // makes the reserve the entire max HR and every band comes out wrong: measured
  // on three live plans, re-deriving from it left two unchanged and made one
  // WORSE. Falling through to %MaxHR is §14's own documented fallback.
  //
  // ⚠️ THE GUARD ALREADY EXISTED ON ONE READER — `ruleEngine.ts` wrote
  // `plan.meta.resting_hr > 0 ? ... : undefined` where it hit the problem, and
  // nowhere else. A judgement made at one call site is the producer/checker split
  // this repo keeps paying for; it belongs here, where both sides read it.
  const usable = typeof rhr === 'number' && Number.isFinite(rhr) && rhr > 0 ? rhr : undefined
  if (usable !== undefined) {
    // Karvonen (HR Reserve) — more personalised
    const hrr = mhr - usable
    const k = (pct: number) => Math.round(usable + (pct / 100) * hrr)
    const z1Top    = k(Z.Z1.karvonen_pct[1])  // top of Z1 → shakeout ceiling
    const z2Low    = k(Z.Z2.karvonen_pct[0])  // bottom of Z2 → aerobic floor
    const z2Top    = k(Z.Z2.karvonen_pct[1])  // top of Z2 → easy ceiling
    const z3Low    = k(Z.Z3.karvonen_pct[0])  // Z3 low → quality low
    const z3Top    = k(Z.Z3.karvonen_pct[1])  // Z3 top → quality high
    const z4Low    = k(Z.Z4.karvonen_pct[0])  // Z4 low → intervals low
    return {
      zone2Ceiling: z2Top,
      zone2Floor:   z2Low,
      easyHR:       `< ${z2Top} bpm`,
      shakeoutHR:   `< ${z1Top} bpm`,
      qualityHR:    `${z3Low}–${z3Top} bpm`,
      intervalsHR:  `${z4Low}–${mhr} bpm`,
      // §84 Amendment (Coaching Board 2026-09-04) — the zone STRING is authored
      // in the same expression as the HR string it describes, so the two cannot
      // drift. They had: every threshold session read `zone: 'Zone 3–4'` beside
      // `hr_target: qualityHR`, and qualityHR is z3Low–z3Top — Zone 3 ONLY. The
      // display derives its band from the zone string and the coach note renders
      // hr_target, so one card showed "145–172 bpm" above "Hold 145–158 bpm".
      // §84's own Config paragraph asserted these were written "consistently";
      // it was true for intervals and assumed for quality.
      qualityZone:   'Zone 3',
      intervalsZone: 'Zone 4–5',
      maxHr: mhr,
      restingHr: usable,
    }
  }
  // %MaxHR — used when resting HR not provided
  const m = (pct: number) => Math.round((pct / 100) * mhr)
  const z1Top = m(Z.Z1.maxhr_pct[1])
  const z2Low = m(Z.Z2.maxhr_pct[0])
  const z2Top = m(Z.Z2.maxhr_pct[1])
  const z3Low = m(Z.Z3.maxhr_pct[0])
  const z3Top = m(Z.Z3.maxhr_pct[1])
  const z4Low = m(Z.Z4.maxhr_pct[0])
  return {
    zone2Ceiling: z2Top,
    zone2Floor:   z2Low,
    easyHR:       `< ${z2Top} bpm`,
    shakeoutHR:   `< ${z1Top} bpm`,
    qualityHR:    `${z3Low}–${z3Top} bpm`,
    intervalsHR:  `${z4Low}–${mhr} bpm`,
    // §84 Amendment — see the Karvonen branch above. Same pairing, same reason.
    qualityZone:   'Zone 3',
    intervalsZone: 'Zone 4–5',
    maxHr: mhr,
    // 🔴 NO HR RESERVE, SO NO ANCHOR-DERIVED BAND, AND IT IS 35.2% OF LIVE THRESHOLD
    // SESSIONS (ADR-026, measured 2026-11-17). %HRR ≈ %VO2R needs a reserve; this branch
    // exists precisely because there isn't one. These sessions keep the zone-table band
    // above, so the floor-equals-easy-ceiling incoherence survives for them — declared in
    // §84 Amendment 2 with its number rather than hidden here.
    restingHr: null,
  }
}

/**
 * PLAN-ZONE-VS-HRTARGET-01 — the single owner of "this runner's HR changed,
 * bring their plan with it".
 *
 * 🔴 THE DEFECT THIS EXISTS FOR. `DashboardClient` updated `plan.meta` when a
 * runner corrected their HR and left every session's `hr_target` on the band
 * computed at generation. The session-detail HEADER derives its bpm from
 * `session.zone` + `meta`; the coach note renders `hr_target`. So one card read
 * "Zone 3 · 161–175 bpm" above "158–171 bpm" — measured on **6 of 22 live
 * plans**, every quality session of each.
 *
 * ⚠️ THREE COPIES OF ONE TRUTH, AND THE WRITERS UPDATED DIFFERENT PAIRS:
 * `user_settings` (the truth), `plan.meta` (a copy), `session.hr_target` (a
 * derived value). The profile-save path wrote the first two; the device-HR path
 * wrote only the first. Nothing wrote the third. This function is the only place
 * that may answer the question, so the three cannot diverge again.
 *
 * ⚠️ REBUILDS ONLY WHAT `computeZones` OWNS. Distances, durations, days, labels,
 * week numbers and coach notes are untouched — so `week_n`/`day` keys survive and
 * completions, run links and overrides keep pointing at the right sessions
 * (PLAN-WEEK-COLLISION-01's hazard, avoided by not going near it).
 *
 * Pure: takes the plan, returns a new one. No I/O, no clock — so it is testable
 * at a pinned instant and safe to call from a React component.
 */
export function applyHrToPlan<T extends {
  meta?: Record<string, unknown>
  // ⚠️ `catalogue_id` IS READ (ADR-026 — the band comes from the row's anchors), so it is
  // declared rather than reached through `as never`: a caller stripping it would silently get
  // the zone-table band back on every quality session.
  weeks?: Array<{ sessions?: Record<string, { type?: string; role?: string; label?: string; zone?: string; hr_target?: string; catalogue_id?: string } | undefined> }>
}>(plan: T, restingHr: number, maxHr: number): T {
  if (!plan?.weeks?.length) return plan
  if (!Number.isFinite(restingHr) || !Number.isFinite(maxHr) || maxHr <= 0) return plan

  const z = computeZones(maxHr, restingHr)

  const weeks = plan.weeks.map(w => {
    if (!w?.sessions) return w
    const sessions: Record<string, unknown> = {}
    for (const [day, s] of Object.entries(w.sessions)) {
      if (!s) { sessions[day] = s; continue }
      // 🔴 THE BAND IS THE PRODUCER'S DECISION, NOT A GUESS FROM `type`
      // (PLAN-VO2MAX-BAND-01, 2026-09-24). This branched on
      // `s.type === 'quality'` and sent every VO2max session to the quality
      // band, because a VO2max session IS typed quality — the type is the slot,
      // the CATEGORY is the stimulus. It rewrote a live runner's
      // "Zone 4–5" 157–182 bpm to "Zone 3" 145–156 bpm, twice.
      // `hrBandFor` reads the stamped catalogue row, exactly as the generator
      // does, and returns null for anything it cannot resolve.
      const band = hrBandFor(s as never)
      if (band === null) { sessions[day] = s; continue }

      // §84 — the zone string and the HR string are written TOGETHER, from the
      // same expression, exactly as `computeZones` pairs them at generation.
      // Authoring them apart is the defect §84 Am. was written for.
      // ADR-026 §8 — forward-only, by the producer's stamp. A plan generated before the release
      // carries no `hr_band_source`, so it keeps the band it has always had rather than being
      // migrated silently on an unrelated HR correction. See the stamp's comment in ruleEngine.
      const derivesBands = plan.meta?.hr_band_source === 'anchor'
      if (band === 'quality') {
        // 🔑 ADR-026 — the DERIVED band, and this path must agree with the generator or the
        // next HR recalculation silently un-does the release. `hrBandFor` has already resolved
        // the catalogue row, so the anchors come from the same place the generator reads them.
        // ⚠️ `vdot` comes off `plan.meta`, which is where the generator recorded the DISCOUNTED
        // anchor VDOT (§10) — the same number the pace was built from. Without it the band is
        // `null` and the session keeps the zone table, which is the honest answer rather than a
        // band derived from a different VDOT than the pace.
        const derived = !derivesBands ? null : bandForAnchors(anchorsForQualityPrescription(catalogueRowFor(s)), {
          maxHr, restingHr,
          vdot: typeof plan.meta?.vdot_training_anchor === 'number' ? plan.meta.vdot_training_anchor
            : typeof plan.meta?.vdot === 'number' ? plan.meta.vdot : null,
        })
        sessions[day] = { ...s, zone: derived?.zone ?? z.qualityZone, hr_target: derived?.hr ?? z.qualityHR }
      } else if (band === 'intervals') {
        const derived = !derivesBands ? null : bandForAnchors(['I'], {
          maxHr, restingHr,
          vdot: typeof plan.meta?.vdot_training_anchor === 'number' ? plan.meta.vdot_training_anchor
            : typeof plan.meta?.vdot === 'number' ? plan.meta.vdot : null,
        })
        sessions[day] = { ...s, zone: derived?.zone ?? z.intervalsZone, hr_target: derived?.hr ?? z.intervalsHR }
      } else if (band === 'shakeout') {
        // §78's race-week shakeout — a Z1 ceiling, not Z2.
        sessions[day] = { ...s, hr_target: z.shakeoutHR }
      } else {
        sessions[day] = { ...s, hr_target: z.easyHR }
      }
    }
    return { ...w, sessions }
  })

  return {
    ...plan,
    meta: { ...(plan.meta ?? {}), resting_hr: restingHr, max_hr: maxHr, zone2_ceiling: z.zone2Ceiling },
    weeks,
  } as T
}


/**
 * The zone facts for a runner with NO AGE AND NO MAX HR — which is to say, none.
 *
 * ⚠️ IT IS AN EMPTY OBJECT ON PURPOSE AND THAT IS NOT A SHRUG. Every alternative writes an
 * absence as a value: a sentinel max, a zero ceiling, an assumed age. §14 Amendment 2's
 * remedy is the field STAYING ABSENT, and `hr_derived_max == null` is already the escape hatch
 * `INV-PLAN-ZONE-LABEL-HAS-PRESCRIPTION` tests for (`invariants.ts`, *"the only genuine
 * exemption is a plan where nothing could be derived at all"*). This is the producer finally
 * emitting the state the checker was already written to accept.
 *
 * 📐 Live population 2026-11-17: 10 of 16 runners with no age also have no stored max, 1 of
 * whom has a generated plan (`df2cc6e6`, `percent_of_estimated_max` off a fabricated 30).
 */
export const UNDERIVABLE_ZONES: ZoneTargets = {}
