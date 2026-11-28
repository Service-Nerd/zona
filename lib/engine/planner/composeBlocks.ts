// FREE — infrastructure. ADR-027 B4a (ADR027-B4A-BLOCKS): L3's block planner.
//
// L3's canonical truth is THE DELIVERED PLAN, and this is its first brick: how many weeks of
// base, build, peak and taper a race plan gets, and which rule bound each number.
//
// 🔑 THIS IS A MOVE, NOT A SECOND COPY, and the distinction is the whole design.
// B3's verifier (L5) is allowed — required — to derive everything itself, because a checker that
// shares the producer's code cannot catch the producer being wrong. **L3 IS the producer.** A
// `composeBlocks` written beside `ruleEngine.ts`'s `computePhases` would be `DELOAD-OWNER-01` with
// a layer diagram on top: two derivations of one number, agreeing by accident of who was edited
// last. So `computePhases` is DELETED and its one call site calls this.
//
// The arithmetic below is byte-for-byte what `computePhases` did, including the rounding order and
// the overage take-back. ⚠️ **`composeBlocks.test.ts` cannot be the gate for that claim** — it shares
// the derivation, so it cannot tell a faithful move from a faithful-looking one.
//
// 🔴 AND `verify:parity` CANNOT BE IT EITHER, WHICH IS NOT WHAT THIS COMMENT FIRST SAID. Its grid
// pins `today` to `planStart` and never sets `recent_quality_training`, so `early_onset` is false and
// `foundation_weeks` 0 in **all 6,210 rows** — the whole `if (earlyOnset)` block below is outside it.
// IDENTICAL there is true and answers a narrower question than the one asked
// (`FOUNDATION-LONG-RUNWAY-01`'s class, in the layer above).
// 📐 So equivalence was measured directly against the pre-move function from `b41e3396`:
// **94,080 cases, 0 differences**, every branch reached (early onset 47,040 · foundation credit
// moving the base 34,778 · the §98 yield moving it 34,398 · `shortOnRamp` 12,320 · base zero 8,840).
// Falsified by widening §91's cap one week: 12,748 differences. See `docs/contracts/engine.md § L3`.
//
// ── WHAT MOVED WITH IT ──────────────────────────────────────────────────────────────────────
// §97's `shortOnRamp` predicate. It was computed seven lines above the `computePhases` call, had
// exactly one consumer (that call), and decides a PHASE LENGTH — the §91 cap it selects. It is a
// pure function of (onset × distance × days available), so it belongs inside the block planner
// rather than beside it. `composeBlocks.test.ts` sweeps `ruleEngine.ts` for the config key, so the
// old derivation cannot quietly come back.
//
// ── WHAT DID NOT MOVE, stated so a plausible name is not read as a wired one ─────────────────
//   · the §89 GATE (`early_onset`). It reads `peakKm` → `returningRunner` → the whole volume
//     model, which is B4b. It is an INPUT here.
//   · `total_weeks` (§17, `lib/plan/length.ts`). An input.
//   · §98's yield ladder and §95 Am. 1's deload yield. Both decide by REGENERATING the whole plan
//     and measuring it, so they are the orchestrator's, not the block planner's. `onset_relax` is
//     an input, exactly as it was an argument.
//   · ⚠️ `getPhaseForWeek` WAS LISTED HERE AND IT MOVED IN B4b, ONE DAY LATER. The reasoning
//     ("it reads a phase table, it does not compose one") is why it is not part of `composeBlocks`
//     itself — but the owner of a reader is the owner of the thing read, and the week planner needed
//     it. It is exported below. **A sentence that was true when written is the thing this wave
//     already paid for once; it is corrected rather than left to age.**
//
// ⚠️ NOTHING READS THE DECISIONS YET. L4 is B5. They are emitted now because the decision is only
// knowable at the moment the number is set — reconstructing "which rule bound this" afterwards is
// the fallback-chain the HLD exists to retire (16 hand-written note fields). `composeBlocks.test.ts`
// holds them to the phases they describe so they cannot drift the way copy drifts from sessions.

import { GENERATION_CONFIG, raceDistanceKey } from '@/lib/plan/generationConfig'
import type { Phase, GeneratorPhase } from '@/types/plan'
import type { Decision } from '@/lib/engine/contracts/decision'

/** What the block planner needs, and nothing else. Every field is a value some other owner
 *  decided; none is re-derived here (see the header's "what did not move"). */
export interface BlockRequest {
  /** §17's plan length, from `lib/plan/length.ts`. Main-plan weeks only: §57 foundation weeks are
   *  prepended after generation (ADR-020) and sit outside the arc. */
  total_weeks: number
  distance_km: number
  /** §89 / ADR-021's gate verdict. Decided by the volume model (B4b), never here. */
  early_onset: boolean
  /** §91 — all-easy foundation weeks that will sit in front of week 1, credited against the
   *  on-ramp because they are the same object to the tissue. From `plannedFoundationWeeks`. */
  foundation_weeks: number
  /** §98 — how many weeks of base to give BACK, set by the ladder in `generateRulePlan`. */
  onset_relax: number
  /** §97 Am. 1 reads it: a shortened base is affordable only where §1's ceiling permits ≥1 quality
   *  session per week the runner actually runs. */
  days_available: number
}

export interface BlockPlan {
  /** Phases in order, contiguous, covering weeks 1..`total_weeks`. A phase with no weeks is not a
   *  phase and is absent (PHASE-EMPTY-01), so this may hold fewer than four. */
  phases: Phase[]
  /** §97's verdict, returned because it is a decision this function now owns and a caller that
   *  wants to stamp it must not re-derive it. False whenever `early_onset` is false: §97 never ran. */
  short_on_ramp: boolean
  /** L4's input (ARCH-ENG-009). One per phase whose length was set, plus §97's verdict and any
   *  phase dropped for being empty. */
  decisions: Decision[]
}

/** More runway is the only lever a runner holds over a phase length. */
const LATER_RACE: Decision['lever'] = { field: 'race_date', direction: 'later' }

export function composeBlocks(req: BlockRequest): BlockPlan {
  const { total_weeks: totalWeeks, distance_km: distanceKm, early_onset: earlyOnset } = req
  const { foundation_weeks: foundationWeeks, onset_relax: onsetRelax, days_available: daysAvailable } = req

  const distKey = raceDistanceKey(distanceKm)

  // §97 / §97 Am. 1 (INTENSITY-3DAY-01) — the shortened on-ramp is distance-scoped AND
  // denominator-scoped. A shortened base drives ~1 quality session a week, which breaches §1 on a
  // low-day plan: the 3-day 10K and 4-day HM the distance-only gate never saw. False here means
  // §91's two-week floor binds instead.
  const ceilingFraction = GENERATION_CONFIG.INTENSITY_DISTRIBUTION[distKey].max_quality_session_pct / 100
  const shortOnRamp = earlyOnset
    && (GENERATION_CONFIG.ONSET_SHORT_ONRAMP_DISTANCES as readonly string[]).includes(distKey)
    && ceilingFraction * daysAvailable >= GENERATION_CONFIG.ONSET_SHORT_ONRAMP_MIN_WEEKLY_QUALITY_HEADROOM

  // §49 — the taper is authored, not proportioned: its length is the number of entries in
  // `TAPER_QUALITY_PER_WEEK` for this distance, race week included. Base/build/peak share what is
  // left. ⚠️ The take-back below never REDUCES the taper directly, but it can fail to absorb the
  // overage, and the taper is what the shortfall comes out of — see the note on that take-back.
  const taperPhaseWeeks = GENERATION_CONFIG.TAPER_QUALITY_PER_WEEK[distKey].length
  const remaining = Math.max(0, totalWeeks - taperPhaseWeeks)

  const dist = GENERATION_CONFIG.PHASE_DISTRIBUTION
  // §89 — a demonstrably-ready runner gets a SHORTER base so quality starts sooner. The base stays
  // all-easy: this is a shorter base, not a base with quality in it (§88's veto).
  const basePct = earlyOnset ? GENERATION_CONFIG.EARLY_ONSET_BASE_PCT : dist.base_pct
  const denom = basePct + dist.build_pct + dist.peak_pct
  const baseFloor = GENERATION_CONFIG.MIN_BASE_WEEKS_FLOOR

  // Which rule last bound the base. It is tracked rather than reconstructed, because by the end of
  // this function four different rules could have set the same number and only the planner knows which.
  //
  // 🔴 THE FLOOR IS §91'S, NOT §4'S, and the first cut attributed it to §4 on 23,040 grid rows.
  // `INV-PLAN-ONRAMP-FLOOR` applies to the UNGATED runner too — `invariants.ts` selects
  // `MIN_BASE_WEEKS_FLOOR` when `early_quality_onset` is false — so when `Math.max` is what set the
  // base, Seiler's on-ramp floor is what bound it. §4 governs ORDER and CONTIGUITY, not length.
  // Latent until L4 reads decisions, which is exactly when an attribution becomes runner-facing copy.
  const proportional = Math.round(remaining * basePct / denom)
  let baseWeeks = Math.max(baseFloor, proportional)
  let baseBoundBy: Decision['bound_by'] =
    baseWeeks > proportional ? 'INV-PLAN-ONRAMP-FLOOR'
    : earlyOnset ? 'INV-PLAN-EARLY-ONSET-GATED'
    : 'INV-PLAN-PHASE-STRUCTURE'

  if (earlyOnset) {
    // §91 (CB-ONSET-02) — THE ON-RAMP IS COUNTED IN WEEKS THE RUNNER RUNS.
    //   (a) cap base in WEEKS as well as percent, or a percentage re-grows it on longer plans —
    //       the runner 14 weeks out got MORE on-ramp than one 12 weeks out, which is backwards;
    //   (b) credit foundation weeks against it, because all-easy running at current volume is the
    //       same stimulus whichever side of week 1 it sits on. Uncredited, §89's whole effect was
    //       cancelled for the 62% of plans that carry a block.
    // Base may reach ZERO, and that is the intended terminal case: two foundation weeks ARE the
    // two-week floor. Never negative, and the floor binds in full for every ungated runner.
    const cap = shortOnRamp
      ? GENERATION_CONFIG.EARLY_ONSET_BASE_MAX_WEEKS
      : GENERATION_CONFIG.MIN_BASE_WEEKS_FLOOR
    const beforeOnRamp = baseWeeks
    baseWeeks = Math.min(baseWeeks, cap)
    baseWeeks = Math.max(0, baseWeeks - Math.min(foundationWeeks, baseWeeks))
    if (baseWeeks !== beforeOnRamp) baseBoundBy = 'INV-PLAN-ONRAMP-FLOOR'

    if (onsetRelax > 0) {
      // §98 — the §1 yield: walk §89's benefit down one rung at a time, bounded by the base an
      // UNGATED runner would receive. §89 may be trimmed to nothing, never past nothing.
      const ungatedBase = Math.max(
        baseFloor,
        Math.round(remaining * dist.base_pct / (dist.base_pct + dist.build_pct + dist.peak_pct)),
      )
      const beforeYield = baseWeeks
      baseWeeks = Math.min(ungatedBase, baseWeeks + onsetRelax)
      if (baseWeeks !== beforeYield) baseBoundBy = 'INV-PLAN-ONSET-YIELD-BOUNDED'
    }
  }

  let buildWeeks = Math.max(1, Math.round(remaining * dist.build_pct / denom))

  // §49 AMENDMENT 1 (BLOCK-TAPER-SQUEEZE-01, Coaching Board 2026-11-28) — THE TAPER IS RESERVED
  // BEFORE THE PEAK FLOOR, AND THE PEAK IS THE PHASE THAT YIELDS.
  //
  // §49's table is a CEILING with no floor ("MUST NOT allocate MORE weeks to the taper phase than
  // the cap"), and §4's peak floor was a bare `Math.max(2, …)` with no principle behind it. Applied
  // first, it took priority over §6's authored shape: `base 2 + build 1 + peak 2 + taper 2` needs
  // SEVEN weeks at 5K, so below that the taper absorbed the shortfall.
  // 📐 Measured: a 5-week 5K delivered **0** actual taper weeks and a 6-week 5K **0** (its taper
  // phase was race week alone), against §49's table of 1 — and at 6 weeks the week BEFORE THE RACE
  // was the plan's highest volume week, 26 km against a peak of 24. One live plan, generated
  // 2026-11-27: `[17, 13, 19, 21, 5]`.
  //
  // ⚠️ THE YIELD IS SCOPED, which is the board's first amendment. It fires only when the floors
  // cannot ALL be met — not whenever the peak sits above its floor. 📐 That confines the change to
  // **5K at 5 and 6 weeks**: every 7-week-plus 5K and every producible 10K (min 7w), HM (min 9w) and
  // marathon (min 11w) comes out byte-identical, because `remaining` already clears the floors.
  // ⚠️ Willy's condition is binding and lives in `INV-PLAN-TAPER-WEEKS-FLOOR`: the delivered taper
  // week must carry its §6 quality session, or the plan is refused rather than shipped short.
  // 🔻 AND THE PEAK PHASE THEN HAS NO WEEKS, which is the intended terminal case (PHASE-EMPTY-01
  // drops it). Declared limit: `INV-PLAN-PEAK-IN-PEAK-PHASE` is guarded on `peakPhase.length > 0`,
  // so it goes SILENT on these plans. A known hole, surfaced at the sitting, not a new one.
  const peakFloor = GENERATION_CONFIG.MIN_PEAK_WEEKS_FLOOR
  // 🔴 `baseWeeks`, NOT `baseFloor`. The first cut tested the UNGATED floor (2), so for a
  // §89-gated runner whose base had legitimately been shortened it dropped the peak floor that this
  // same commit introduces — measured by code review: 4 of 10,962 producible plans got a ONE-week
  // peak, below `MIN_PEAK_WEEKS_FLOOR`, with the taper already correct in both readings. Both of the
  // new test arms pass `early_onset: false`, so that cohort was outside the test population, and
  // `INV-PLAN-PEAK-LR-ALTERNATION` / `INV-PLAN-PEAK-STEPBACK-VOLUME` need ≥2 peak weeks, so they
  // would have gone silent rather than caught it. The question is whether the floors fit the weeks
  // THIS runner's phases actually need.
  const floorsFit = remaining >= baseWeeks + 1 + peakFloor
  let peakWeeks = Math.max(floorsFit ? peakFloor : 0, remaining - baseWeeks - buildWeeks)

  // §4 — a phase has one purpose and one block, so build has a floor of 1 week and peak of 2. When
  // those floors push the total past `remaining`, take it back from build first (most flexible),
  // then base.
  //
  // 🔴 THE LINE THIS REPLACES SAID "preserves taper duration as authored" AND THAT WAS NOT WHAT
  // THE CODE DID. The take-back never touches the taper, which is what the sentence was reaching
  // for, but `taperEnd` is pinned to `totalWeeks` while `peakEnd` grows — so any overage build and
  // base could not absorb came out of the TAPER. ✅ **§49 Amendment 1 closed that above**, by
  // reserving the taper before the peak floor; the squeeze is no longer reachable on any runway §44
  // permits. The note stays because the ORDERING is the fix: reverse it and the squeeze returns.
  // ⚠️ And the two counts are different numbers, which is what made the old defect hard to see:
  // `INV-PLAN-TAPER-DURATION-CAP` counts taper-phase weeks INCLUDING race week, while §49's floor
  // counts actual taper weeks BEFORE it. A 6-week 5K passed the cap with a taper phase of one week,
  // because that one week was race week.
  let overage = (baseWeeks + buildWeeks + peakWeeks) - remaining
  if (overage > 0 && buildWeeks > 1) {
    const take = Math.min(overage, buildWeeks - 1)
    buildWeeks -= take
    overage -= take
  }
  if (overage > 0 && baseWeeks > baseFloor) {
    const take = Math.min(overage, baseWeeks - baseFloor)
    baseWeeks -= take
    // The take-back overrides whichever onset rule had set the base: §4's floors won.
    baseBoundBy = 'INV-PLAN-PHASE-STRUCTURE'
  }

  const baseEnd = baseWeeks
  const buildEnd = baseEnd + buildWeeks
  const peakEnd = buildEnd + peakWeeks
  const taperEnd = totalWeeks

  const built: Phase[] = [
    { name: 'base', start_week: 1, end_week: baseEnd },
    { name: 'build', start_week: baseEnd + 1, end_week: buildEnd },
    { name: 'peak', start_week: buildEnd + 1, end_week: peakEnd },
    { name: 'taper', start_week: peakEnd + 1, end_week: taperEnd },
  ]
  // A PHASE WITH NO WEEKS IS NOT A PHASE (PHASE-EMPTY-01, 2026-09-19). §89's gate shortens the base
  // and on a short plan shortens it to nothing: `baseWeeks` reaches 0 and this emitted
  // `{ base, 1, 0 }` — an INVERTED range persisted into `plan_json`, which `PlanSchema` rejects and
  // nothing else did, because the schema only ever ran against ENRICHER output. Measured 12 of 360
  // plans in the affected cell, and ⚠️ **0 of 45,776 corpus plans could reach it** — neither grid
  // combines an experienced runner with regular recent quality on a short runway.
  const phases = built.filter(p => p.end_week >= p.start_week)
  const dropped = built.filter(p => p.end_week < p.start_week)

  const lengthOf = (name: Phase['name']) => {
    const p = phases.find(x => x.name === name)
    return p ? p.end_week - p.start_week + 1 : 0
  }
  const block = (
    what: string, value: Decision['value'], unit: Decision['unit'],
    bound_by: Decision['bound_by'], lever: Decision['lever'],
  ): Decision => ({ what, week: null, day: null, value, unit, bound_by, lever })

  const decisions: Decision[] = [
    block('plan.phases.base_weeks', lengthOf('base'), 'weeks', baseBoundBy, LATER_RACE),
    block('plan.phases.build_weeks', lengthOf('build'), 'weeks', 'INV-PLAN-PHASE-STRUCTURE', LATER_RACE),
    block('plan.phases.peak_weeks', lengthOf('peak'), 'weeks', 'INV-PLAN-PHASE-STRUCTURE', LATER_RACE),
    // The taper is authored per distance, so the only lever is the distance itself.
    block('plan.phases.taper_weeks', lengthOf('taper'), 'weeks', 'INV-PLAN-TAPER-DURATION-CAP',
      { field: 'race_distance_km', direction: 'set' }),
  ]
  if (earlyOnset) {
    // §97's verdict is recorded only when the gate it modifies actually opened. Emitting `false`
    // for an ungated runner would read as "§97 considered this and declined", which it did not.
    decisions.push(block('plan.phases.short_on_ramp', shortOnRamp, null, 'INV-PLAN-ONRAMP-FLOOR',
      { field: 'days_available', direction: 'increase' }))
  }
  for (const p of dropped) {
    decisions.push(block('plan.phases.dropped', p.name, null, 'INV-PLAN-PHASE-STRUCTURE', LATER_RACE))
  }

  return { phases, short_on_ramp: shortOnRamp, decisions }
}

/**
 * Which phase does week `n` fall in? The phase table's reader, so it lives with the phase table's
 * owner (ADR-027 B4b). Moved verbatim from `ruleEngine.ts`, where it was private with 9 callers.
 *
 * ⚠️ THE `?? 'base'` IS A REAL FALLBACK, not defensive noise: a week outside every phase range
 * reads as base. That happens on a runway too short for §4's floors, where the table overruns
 * `total_weeks` (see the arm in `composeBlocks.test.ts`), and §57 foundation weeks (`n <= 0`) sit
 * outside the arc by design. Changing it would change plan output, so it is preserved exactly.
 */
export function getPhaseForWeek(weekN: number, phases: Phase[]): GeneratorPhase {
  return (phases.find(p => weekN >= p.start_week && weekN <= p.end_week)?.name ?? 'base') as GeneratorPhase
}
