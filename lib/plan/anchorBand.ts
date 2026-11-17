// anchorBand.ts — the single owner of "what HEART-RATE band does this session's PACE
// ANCHOR imply for this runner?" (ADR-026 R1/R2, Coaching Board 2026-11-16/17).
//
// 🔴 WHY IT EXISTS. Before this module the engine derived PACE from Daniels fractions of
// VO2max and HR from Karvonen fractions of HR reserve, and **converted between the two
// nowhere**. So one session carried two prescriptions describing two different efforts,
// and the measurement is not subtle: `z2Top` IS `z3Low` by construction, so a threshold
// session's HR FLOOR was the easy CEILING — a runner at the bottom of their "threshold"
// band was running at the top of easy. On 29 live runs at the prescribed threshold pace,
// 51% of the time was spent above the prescribed HR ceiling and peaks ran 13 bpm over.
//
// 🔑 THE FIX IS ONE DERIVATION, NOT A BETTER SECOND NUMBER. The board rejected ratifying
// a new constant (ADR-026 §3 option B: "ratifying 81–87% would be the same mistake 70–80%
// was"). The band is the pace prescription RE-EXPRESSED in heart rate, through the
// %HRR ≈ %VO2R identity, from the very fractions `buildPaceFromVDOT` already uses. No
// pace moves and no new physiological claim is made.
//
// ⚠️ WHAT THIS IS NOT. It is not a measured threshold heart rate for these runners.
// Direct device-backed evidence is n = 0 usable (ADR-026 §6) and ⚕️ Sims' objection is
// recorded and stands: Daniels' tables and the %VO2R conversion cohorts are male-derived
// end to end. The ground this stands on is coherence — provable from the code for every
// runner — with the telemetry as corroboration, never as the case.
//
// ⚠️ IT RETURNS `null` MORE OFTEN THAN THE ADR EXPECTED, AND THAT IS MEASURED.
// %HRR needs an HR RESERVE and the anchor is a fraction of VO2max, so a runner with no
// usable resting HR or no VDOT has no derivable band. Measured on live data 2026-11-17:
// **56 of 159 live threshold sessions (35.2%)** cannot take one — 14 of 43 plans carry no
// resting HR, 2 no max HR, 22 no VDOT, and only 14 carry all three. ADR-026 §4's three
// worked personas all carry all three, which is how the precondition went unstated.
// Those sessions keep the zone-table band and the incoherence survives for them; §84
// Amendment 2 declares that residual with its number rather than hiding it here.
//
// ⚠️ AND `null` IS NEVER "PROBABLY QUALITY". That guess is what `hrBand.ts`'s own header
// is forty lines about — a classifier that downgraded a live runner's VO2max session. A
// caller receiving `null` must LEAVE THE SESSION ALONE.

import { GENERATION_CONFIG } from './generationConfig'
import { VDOT_FRACTIONS, type FractionedAnchor } from './paceBands'
import { workAnchorsOf } from './sessionStructureV2'

/**
 * Resting VO2, ml·kg⁻¹·min⁻¹ — one MET.
 *
 * ⚠️ A PHYSICAL CONSTANT, NOT A COACHING CHOICE, so it is inline beside the identity it
 * belongs to rather than in `GENERATION_CONFIG` — the same exemption CLAUDE.md grants the
 * Daniels coefficients and Tanaka's `208 − 0.7 × age`. A coach cannot tune what one MET is.
 */
const RESTING_VO2 = 3.5

/**
 * %VO2R for a fraction of VDOT. ACSM / Swain & Leutholtz: %HRR ≈ %VO2R, which is the one
 * step that lets a VO2-anchored prescription be stated as a heart rate at all.
 *
 * Note the denominator: VO2 **reserve**, not VO2max. Using VO2max would give 83–88% HRR
 * where the identity gives 81.4–86.9%, and the difference is ~2 bpm of prescription.
 */
export function vo2Reserve(fraction: number, vdot: number): number {
  return (fraction * vdot - RESTING_VO2) / (vdot - RESTING_VO2)
}

/** Which anchors get an anchor-derived band, and which keep the zone table. */
export type BandableAnchor = Extract<FractionedAnchor, 'T' | 'CV' | 'I'>

/**
 * 🔴 EASY AND SHAKEOUT ARE EXCLUDED BY RULING, NOT BY OMISSION (ADR-026 §5).
 *
 * E's own fraction gives **55–72% HRR**, and 71.6% breaches §12's 70% Z2 ceiling — so
 * deriving the easy band would RAISE the easy ceiling into the grey zone §1 exists to
 * prevent. That measurement is why the board rejected the original brief's "a zone per
 * session type" outright (§3, option A). **Anchored from T upward; easy and shakeout keep
 * the zone table.** M and HM are long-run segment anchors inside a Z2-ceiling session
 * (`SEGMENTED-LR-HR-01`, 1,599 of 1,599 generated plans) whose `hr_target` is a CEILING
 * describing the aerobic portion — a different mechanism, explicitly out of scope in §84
 * Amendment 1 and left out of scope here.
 */
const BANDABLE: readonly BandableAnchor[] = ['T', 'CV', 'I'] as const

/** ⚠️ `unknown`, not `string | null`: `Array.isArray` does not narrow a `readonly T[]` out
 *  of a union, so the single-anchor path below is still typed as possibly an array. A
 *  membership test is safe on anything and a cast at the call site would hide the case. */
export function isBandableAnchor(a: unknown): a is BandableAnchor {
  return typeof a === 'string' && (BANDABLE as readonly string[]).includes(a)
}

export interface AnchorBand {
  lo: number
  hi: number
  /** The prescription, formatted exactly as `computeZones` formats its bands. */
  hr: string
  /** §84 Am. 1's rule, one step further back: the LABEL is read off the band. */
  zone: string
  anchor: BandableAnchor
}

export interface AnchorBandInput {
  /** One anchor, or every work anchor of a row that uses more than one. */
  anchor: string | null | undefined | readonly (string | null | undefined)[]
  vdot: number | null | undefined
  maxHr: number | null | undefined
  restingHr: number | null | undefined
}

/**
 * The zone string for a band: every zone in `GENERATION_CONFIG.ZONES` the band overlaps.
 *
 * 🔑 ADR-026 R2, extending §84 Amendment 1 ("the zone string is DERIVED from the HR
 * target, not authored beside it") one step back — the target is now derived too, so the
 * label follows a band that followed an anchor. It yields `Zone 4` for a trained runner
 * and `Zone 3–4` for a beginner on the SAME T-pace session, which is correct: the same
 * effort is a different fraction of two different runners' reserves, and a single
 * hardcoded `'Zone 3'` cannot say that.
 *
 * ⚠️ Karvonen only. A runner reaching this has a usable resting HR by construction (the
 * caller returns `null` otherwise), so reading `karvonen_pct` is not a branch that can be
 * taken with the wrong formula — which is `PLAN-RESTING-HR-ZERO-01`'s defect.
 */
export function zoneStringForBand(lo: number, hi: number, maxHr: number, restingHr: number): string {
  const hrr = maxHr - restingHr
  const k = (pct: number) => Math.round(restingHr + (pct / 100) * hrr)
  const hit: number[] = []
  for (const [key, def] of Object.entries(GENERATION_CONFIG.ZONES)) {
    const zLo = k((def as { karvonen_pct: readonly number[] }).karvonen_pct[0])
    const zHi = k((def as { karvonen_pct: readonly number[] }).karvonen_pct[1])
    // Overlap, inclusive. A band ending exactly on a boundary touches both zones and the
    // boundary belongs to both by construction (`z2Top` IS `z3Low`), so a half-open test
    // would silently drop one of them.
    if (hi >= zLo && lo <= zHi) hit.push(Number(key.replace('Z', '')))
  }
  if (!hit.length) return ''
  hit.sort((a, b) => a - b)
  return hit.length === 1 ? `Zone ${hit[0]}` : `Zone ${hit[0]}–${hit[hit.length - 1]}`
}

/**
 * The band this anchor implies for this runner, or `null` when it cannot be derived.
 *
 * ⚠️ THE INTERVAL BAND IS NOT THE `I` FRACTION, AND THAT IS DELIBERATE (ADR-026 §5).
 * Its FLOOR is the CV ceiling and its TOP is max HR, so T · CV · I are contiguous with
 * no gap and no overlap — T 160–167, CV 167–173, I 173–185 for a VDOT-41 runner at
 * 185/48. 📊 Seiler's steady-state-vs-ramp doctrine is the justification for the widths:
 * threshold is ~7 bpm because HR plateaus at a steady state, an interval band is ~12 bpm
 * because HR climbs through each rep. Taking the raw `I` floor (178) instead would leave
 * 173–178 prescribed by nothing.
 */
/**
 * 🔑 A ROW WITH TWO WORK ANCHORS GETS THE BAND THAT SPANS BOTH, AND THAT IS WHY TWO
 * SESSIONS THE ADR HANDLED BY EXCEPTION NEED NO EXCEPTION (Coaching Board 2026-11-17,
 * amending R1). Measured on the catalogue: 19 of 31 rows have exactly one work anchor,
 * and the two multi-anchor rows are both threshold rows, both multi BY DESIGN.
 *
 * · `tempo_over_under` is **CV + T** — the session IS an excursion either side of
 *   threshold, so the band spanning T's floor to CV's ceiling (160–173 at VDOT 41/185/48)
 *   is the work it actually prescribes. ADR-026 §5 called this "condition 3 repeating"
 *   and fixed it by narrowing R3; the union answers it from R1 directly.
 * · `progressive_tempo` is **E + T**, and E is not bandable by ruling (§12's Z2 ceiling),
 *   so the whole row falls back to the zone table and KEEPS its deliberate `Z2–Z3`
 *   transition target — which ADR-026 §5 requires in as many words. The rule delivers it
 *   by construction instead of by a named special case, which is the difference between a
 *   principle and a patch.
 *
 * ⚠️ ALL-OR-NOTHING: one unbandable anchor forfeits the whole band. The alternative —
 * banding the bandable ones and ignoring the rest — prescribes a heart rate for part of a
 * session and is how `progressive_tempo` would quietly lose its ramp.
 */
export function anchorHrBand(input: AnchorBandInput): AnchorBand | null {
  const { anchor, vdot, maxHr, restingHr } = input
  if (Array.isArray(anchor)) {
    if (!anchor.length) return null
    const parts = anchor.map(a => anchorHrBand({ ...input, anchor: a }))
    if (parts.some(b => b === null)) return null
    const bands = parts as AnchorBand[]
    if (bands.length === 1) return bands[0]
    const lo = Math.min(...bands.map(b => b.lo))
    const hi = Math.max(...bands.map(b => b.hi))
    // The widest anchor names the band, so `anchor` still says what it was derived from.
    const widest = bands.reduce((a, b) => (b.hi > a.hi ? b : a))
    return {
      lo, hi, hr: `${lo}–${hi} bpm`,
      zone: zoneStringForBand(lo, hi, maxHr as number, restingHr as number),
      anchor: widest.anchor,
    }
  }
  if (!isBandableAnchor(anchor)) return null
  if (typeof maxHr !== 'number' || !Number.isFinite(maxHr) || maxHr <= 0) return null
  // 🔴 THE SAME TEST `computeZones` APPLIES, for the same reason: a `0` resting HR is
  // ABSENT, not a measurement (`PLAN-RESTING-HR-ZERO-01`). Taking the Karvonen branch
  // with a zero baseline makes the reserve the whole max HR and every band comes out
  // wrong. Here there is no %MaxHR fallback to take: without a reserve there is no
  // %HRR, so there is no band — see the module header's 56-of-159.
  if (typeof restingHr !== 'number' || !Number.isFinite(restingHr) || restingHr <= 0) return null
  if (typeof vdot !== 'number' || !Number.isFinite(vdot) || vdot <= RESTING_VO2) return null
  if (restingHr >= maxHr) return null

  const hrr = maxHr - restingHr
  const [fLo, fHi] = anchor === 'I'
    // The interval floor is the CV CEILING, not I's own floor. See the doc comment.
    ? [VDOT_FRACTIONS.CV[1], VDOT_FRACTIONS.I[1]]
    : VDOT_FRACTIONS[anchor]

  const lo = Math.round(restingHr + vo2Reserve(fLo, vdot) * hrr)
  const hi = anchor === 'I'
    // Top of the interval band is max HR, exactly as `intervalsHR` has always been:
    // `vo2Reserve(1.00, vdot)` is 1 by definition, so this is the identity, written as
    // the max rather than computed, so a VDOT rounding artefact cannot put it at 184.
    ? maxHr
    : Math.round(restingHr + vo2Reserve(fHi, vdot) * hrr)

  // A band that inverted or collapsed means the inputs are not a runner. Refuse rather
  // than emit "167–160 bpm": absence must not be written as a value.
  if (!(hi > lo)) return null

  return { lo, hi, hr: `${lo}–${hi} bpm`, zone: zoneStringForBand(lo, hi, maxHr, restingHr), anchor }
}

/**
 * 🔑 THE ONE FUNCTION BOTH PRODUCERS CALL: "what band does this catalogue row get for
 * this runner?" — the generator at construction, and `applyHrToPlan` when a runner's HR
 * changes.
 *
 * 🔴 IT EXISTS BECAUSE THOSE TWO HAVE ALREADY DISAGREED, TWICE, ON EXACTLY THIS QUESTION.
 * `hrBand.ts`'s header is the first (`applyHrToPlan` re-derived the band from
 * `session.type` and downgraded a live runner's VO2max session to threshold, in both the
 * header and the coach note at once, so the card looked CONSISTENT and wrong). §40b
 * Amendment 4 is the second, pointing the other way. A new band derivation with two call
 * sites and no owner would be the third, and this time the disagreement would be about a
 * number no screen could show was wrong.
 *
 * Returns `null` whenever the row has no single bandable anchor set or the runner has no
 * derivable band — and `null` means LEAVE THE SESSION ALONE, never "probably quality".
 */
export function bandForRow(
  row: { main_set_structure?: unknown } | null | undefined,
  runner: { maxHr: number | null | undefined; restingHr: number | null | undefined; vdot: number | null | undefined },
): AnchorBand | null {
  const anchors = workAnchorsOf(row)
  if (!anchors.length) return null
  return anchorHrBand({ anchor: anchors, vdot: runner.vdot, maxHr: runner.maxHr, restingHr: runner.restingHr })
}
