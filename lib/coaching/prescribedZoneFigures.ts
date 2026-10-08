// §123 / READ-DIRECTION-OVERCLAIM-01 Am. 1 — the single owner of "how much of this run
// was in the band the session actually PRESCRIBED?"
//
// 🔴 WHY IT IS A MODULE. It was private to `app/api/analyse-run/route.ts`, and
// `app/api/recalibrate-hr/route.ts` carried a RE-IMPLEMENTATION that said so in its own
// comment: *"Re-implementation of derivePrescribedZoneHrFigures (private in
// analyse-run)"*. Two producers of one classification, acknowledged in writing and left
// in place. This repo's most expensive recorded class — the tier order written three
// times, the deload cadence in five places, `sumWeeklyKm` by hand in six. The band logic
// is about to get more complicated, which is exactly when a second copy becomes a drift.
//
// ─────────────────────────────────────────────────────────────────────────────
// 🔴 THE DEFECT THIS FIXES, AND IT IS NOT THE ONE THAT WAS FILED.
//
// `READ-DIRECTION-OVERCLAIM-01` was filed as a wording question ("most of it above the
// zone" against 38.7%). I took the Coaching Board a mechanism that was WRONG — I said
// the figures were Z2-anchored unconditionally. They are not: the histogram path has
// always bucketed relative to the prescribed zone. See that ruling's Amendment 1.
//
// THE REAL DEFECT: `zoneForSessionType` returns ONE zone for a session the catalogue
// prescribes in THREE bands. Measured across the 30 live plans, `progressive_tempo`'s
// own `derived_set` step targets are:
//
//     ceiling / Z2-Z3 / target          (while `session.zone` says "Zone 3")
//
// Scored against Z3 alone, on a CORRECTLY EXECUTED session:
//   - the opening third at the Easy ceiling lands in Z2 and counts BELOW FLOOR
//   - the closing third at Threshold reaches Z4-5 and counts ABOVE CEILING
//   - only the middle third counts as "in zone"
//
// The founder's own run: below 29.04 / in 32.26 / above 38.71. Almost exactly thirds,
// HR discipline 32, and HR discipline is HALF of §108's composite. **The engine scored
// the structure it prescribed as a failure to hold a band it never prescribed.**
//
// ⚠️ AND IT IS NOT ONE ROW TYPE. Every quality row carrying a `ceiling` step has the
// same shape — `threshold_ladder`, `cv_intervals`, `tempo_over_under`,
// `goal_pace_sharpener`, `threshold_pyramid` — because **a recovery jog is PRESCRIBED
// out of the work band.** That was McMillan's objection at the sitting, and the step
// data turns it from a worry into evidence.
//
// ─────────────────────────────────────────────────────────────────────────────
// ⚖️ HOW THIS SATISFIES BOTH SEATS, so the recorded disagreement is resolved by the data
// rather than by a casting vote:
//
// 📊 Seiler wanted a prescription-relative in-band percentage. 🎯 McMillan held that a
// percentage-in-band model imported from easy running would mislead on intervals,
// because recovery jogs fall out of band BY DESIGN. Scoring against the band set the
// session's own structure names gives Seiler his measure and makes McMillan's recovery
// steps **in prescription** rather than below floor.
//
// ⛔ WILLY'S BINDING CONDITION, and it shapes the whole file: this does NOT repoint
// `hr_above_ceiling_pct` / `hr_in_zone_pct` on `strava_activities`. `limiter.ts` reads
// those as a Z2 overload signal (`PACING_HOT_PCT_THRESHOLD`) and must keep doing so, or
// a correctly-executed tempo starts reading as "ran hot". The raw columns keep their
// meaning; this derives a SEPARATE answer from the same histogram.
//
// ⛔ SIMS' BINDING CONDITION is now the precise mechanism rather than a side note: the
// below-floor bucket must not score as indiscipline where the session prescribes a
// below-band opening third.

import { zoneForSessionType } from '@/lib/coaching/zoneRules'

export interface PrescribedHrFigures {
  /** Share of the run inside the band(s) the session prescribed. */
  hrInZonePct:       number | null
  /** Share above every prescribed band. */
  hrAboveCeilingPct: number | null
  /** Share below every prescribed band. */
  hrBelowFloorPct:   number | null
}

/** The five-zone model's buckets, lowest first. §14 is canonical. */
export type ZoneKey = 'z1' | 'z2' | 'z3' | 'z4_5'
const ORDER: readonly ZoneKey[] = ['z1', 'z2', 'z3', 'z4_5']

export interface ZoneHistogram {
  z1:   number | null | undefined
  z2:   number | null | undefined
  z3:   number | null | undefined
  z4_5: number | null | undefined
}

/**
 * Which zones does this session actually prescribe?
 *
 * ⚠️ IT READS THE SESSION'S STRUCTURE, NOT ITS TYPE. The type gives one zone; a v2
 * session's `derived_set` gives one target per step, and the steps disagree with each
 * other on purpose.
 *
 * Two signals, and neither is invented here:
 *   - a step naming a `zone` contributes that zone (and a RANGE like `Z2-Z3`
 *     contributes both — the vocabulary already exists in live data, where
 *     `mp_long_run` declares `session.zone: "Zone 2–3"`).
 *   - a step with `pace_mode: 'ceiling'` is a "no faster than" step: on a quality
 *     session that is the jog / recovery / easy-opening step, so it contributes the
 *     EASY band. ADR-019 defines `ceiling` as exactly that, and `resolveMainSet`
 *     renders it as *"no faster than"*.
 *
 * Returns null when the session prescribes no zone at all (rest / strength / cross) —
 * those are scored on other axes and must not be given a zone by default.
 */
export function prescribedZonesFor(session: unknown): Set<ZoneKey> | null {
  const s = session as { type?: string; derived_set?: unknown; zone?: string } | null
  if (!s) return null

  const byType = zoneForSessionType(s.type)
  if (!byType) return null

  const zones = new Set<ZoneKey>()
  for (const k of zoneKeysFromLabel(byType.zone)) zones.add(k)

  // 🔴 THE SESSION'S OWN `zone` LABEL, WHICH THE FIRST DRAFT OF THIS FILE IGNORED.
  // Caught by its own Z1 arm: I read the TYPE's zone and the STEP zones and skipped the
  // one field that already carries a RANGE in production. `mp_long_run` declares
  // `session.zone: "Zone 2–3"` on live plans today, and without this line it resolved
  // to Z2 alone from its type — the same single-band defect §123 exists to remove,
  // reintroduced one field over.
  for (const k of zoneKeysFromLabel(s.zone)) zones.add(k)

  // The structure, where the session has one. A v1 session has no `derived_set` and
  // keeps exactly its previous behaviour — this must not change what an easy run scores.
  const steps = stepsOf(s.derived_set)
  for (const step of steps) {
    if (typeof step.zone === 'string') {
      for (const k of zoneKeysFromLabel(step.zone)) zones.add(k)
    }
    // A "no faster than" step is the easy/jog step. It is PRESCRIBED to sit low, so
    // time spent there is compliance, not indiscipline. This single line is what
    // Sims' condition and McMillan's objection both reduce to.
    if (step.pace_mode === 'ceiling') zones.add('z2')
  }

  return zones.size ? zones : null
}

/** `'Z2'`, `'Zone 3'`, `'Z2-Z3'`, `'Zone 2–3'`, `'Z4-5'` → the buckets they name. */
export function zoneKeysFromLabel(label: string | undefined): ZoneKey[] {
  if (!label) return []
  // ⚠️ THERE IS NO SPECIAL CASE FOR `Z4-5`, AND THE MUTATION HARNESS IS WHY.
  // The first draft early-returned on `/4\s*[-–]\s*5/`, reasoning that "4-5" is ONE
  // histogram bucket and would otherwise read as the range 4 to 5. **It would, and the
  // range path gives the same answer anyway**: lo=4, hi=5, both map to `z4_5`, and the
  // dedup collapses them. The harness flagged a perturbation of that `4` as SURVIVING,
  // which was correct — the mutant was provably equivalent, because the branch was
  // redundant. Deleted rather than declared: a survivor you can delete is not a gap in
  // the test, it is dead code in the source.
  const nums = (label.match(/[1-5]/g) ?? []).map(Number)
  if (!nums.length) return []
  // ⚠️ TOTAL over 1–5 and NOT nullable, because `nums` comes from `/[1-5]/` — so there
  // is no `n` here that maps to nothing. The first draft returned `ZoneKey | null` and
  // guarded with `if (k && …)`, and the mutation harness proved that guard was DEAD by
  // flipping its `&&` to `||` without any test noticing. An unreachable guard is not
  // caution; it is a branch no one can test.
  const keyFor = (n: number): ZoneKey =>
    n === 1 ? 'z1' : n === 2 ? 'z2' : n === 3 ? 'z3' : 'z4_5'
  // A range `Z2-Z3` names every bucket between its ends, inclusive.
  const lo = Math.min(...nums)
  const hi = Math.max(...nums)
  const out: ZoneKey[] = []
  for (let n = lo; n <= hi; n++) {
    const k = keyFor(n)
    if (!out.includes(k)) out.push(k)
  }
  return out
}

function stepsOf(derivedSet: unknown): Array<{ zone?: string; pace_mode?: string }> {
  const ds = derivedSet as { blocks?: Array<{ steps?: unknown[] }> } | null | undefined
  if (!ds?.blocks) return []
  return ds.blocks.flatMap(b => (b?.steps ?? []) as Array<{ zone?: string; pace_mode?: string }>)
}

/**
 * Split the run against what the session prescribed.
 *
 * `legacy` is the activity's own Z2-anchored figures, used verbatim when no histogram
 * exists. ⚠️ **Measured 2026-10-08: only 5 of 77 live analyses (6.5%) carry the
 * histogram, so this fallback is doing almost all of the work today** — and it is
 * Z2-anchored, which the original comment admitted is *"meaningless elsewhere"* than
 * easy/long/recovery. Preserved rather than dropped, because changing what an old run
 * scored is a different decision from scoring new ones correctly; the gap is declared,
 * not hidden.
 */
export function prescribedZoneFigures(
  hist: ZoneHistogram,
  session: unknown,
  legacy: PrescribedHrFigures,
): PrescribedHrFigures {
  const hasHistogram = ORDER.some(k => hist[k] != null)
  if (!hasHistogram) return legacy

  const zones = prescribedZonesFor(session)
  if (!zones) return { hrInZonePct: null, hrAboveCeilingPct: null, hrBelowFloorPct: null }

  const pct = (k: ZoneKey): number => hist[k] ?? 0
  const round2 = (n: number): number => Math.round(n * 100) / 100

  // "Above" and "below" are relative to the prescribed SET's edges, so a session that
  // prescribes Z2 and Z3 has nothing "between" to penalise.
  const idx = ORDER.map((k, i) => (zones.has(k) ? i : -1)).filter(i => i >= 0)
  const lo = Math.min(...idx)
  const hi = Math.max(...idx)

  let inZone = 0, above = 0, below = 0
  ORDER.forEach((k, i) => {
    if (i < lo)      below  += pct(k)
    else if (i > hi) above  += pct(k)
    else             inZone += pct(k)   // inside the span, including any gap
  })

  return {
    hrInZonePct:       round2(inZone),
    hrAboveCeilingPct: round2(above),
    hrBelowFloorPct:   round2(below),
  }
}
