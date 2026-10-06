// Deload cadence — the single owner of "is week N a recovery week?"
// (DELOAD-OWNER-01, 2026-09-04). CoachingPrinciples §3.
//
// WHY THIS MODULE EXISTS. `weekN % recoveryFreq === 0` was written out FIVE
// times in `ruleEngine.ts` — three building the volume curve, one placing the
// §32 tune-up race, one stamping `week.type = 'deload'`. They were not the same
// expression:
//
//   volume pass 1   weekN % rf === 0 && phase !== 'peak'          (taper skipped upstream)
//   volume pass 2   weekN % rf === 0 && phase !== 'peak'          (taper skipped upstream)
//   bounceback      prevWeekN % rf === 0 && prevPhase not peak/taper
//   tune-up scan    wn % rf === 0                                 (NO phase test at all)
//   week badge      !isRaceWeek && weekN % rf === 0 && phase not peak/taper
//
// They agreed only BY CONTEXT: the tune-up loop iterates build weeks exclusively,
// and the volume passes `continue` past taper before reaching their test. Every
// copy was correct where it stood and none of them said so, which made the
// agreement invisible and therefore unmaintainable.
//
// The cost was measured on 2026-09-04. Changing two of the five — an attempt to
// start quality work earlier in the plan — made the volume curve and the week
// badge disagree, and took plans with a deload blocking the first build week
// from 4 to 12. The failure class is `checker reads a different source from the
// producer`, except here it is producer-vs-producer: two writers of the same
// fact, drifting.
//
// D-08 single ownership. This is deliberately its own module rather than a
// helper further down `ruleEngine.ts`: a file-level owner is greppable, and
// `deloadCadence.test.ts` asserts the raw expression appears NOWHERE outside
// it. A rule that holds only while someone remembers is not a rule.
//
// NOT DERIVED FROM `week.type`. The obvious INV-CLASS answer — read the
// structural field the producer stamps — is unavailable here: the volume curve
// runs BEFORE any week object exists, and is what decides the stamp. This
// predicate is the producer.

import type { GeneratorPhase } from '@/types/plan'
import { GENERATION_CONFIG } from './generationConfig'

/**
 * Is `weekN` a deload week?
 *
 * @param weekN        1-indexed plan week.
 * @param phase        That week's phase. Peak and taper never deload — peak is
 *                     where the plan is meant to be at its hardest, and taper is
 *                     already a planned drop, so a deload inside one is either a
 *                     second drop or a contradiction.
 * @param recoveryFreq Every Nth week. Masters-aware (§3) — set once in
 *                     `generateRulePlan` so the volume curve and the week badge
 *                     cannot disagree about the cadence itself.
 *
 * Race week is NOT excluded here. It is excluded at the one call site that
 * stamps the badge, because "week N is on the deload cadence" and "we should
 * label this week a deload" are different questions, and only the second one
 * cares that the race is on Saturday.
 */
export function isDeloadWeek(
  weekN: number,
  phase: GeneratorPhase,
  recoveryFreq: number,
): boolean {
  // Guard the modulo rather than trusting callers. `recoveryFreq` comes from
  // config via a masters branch; a 0 would make every week a deload silently,
  // which is precisely the kind of failure this app produces instead of crashing.
  if (!Number.isFinite(recoveryFreq) || recoveryFreq <= 0) return false
  if (weekN < 1) return false
  return weekN % recoveryFreq === 0 && phase !== 'peak' && phase !== 'taper'
}

/**
 * WHERE the deload weeks actually fall (CB-DELOAD-01, §87).
 *
 * `isDeloadWeek` above answers "is week N on the cadence". This answers the
 * different and harder question: "given that cadence, which weeks should
 * ACTUALLY be recovery weeks?" — because the raw cadence is computed from
 * absolute week number and knows nothing about phase boundaries.
 *
 * THE DEFECT THIS EXISTS FOR, measured across 24 plans (6 distances x 2
 * day-counts x 2 ages): a deload landed on the FIRST WEEK OF BUILD in 25% of
 * them, dropping volume 30-41% at the exact moment the plan says the hard work
 * begins — and pushing the first quality session back a week (HM W6→W7,
 * 50K W8→W9, 100K W9→W10). 71% entered build with no volume step-up at all.
 *
 * Not one of those placements was chosen. They were determined by where week 1
 * happened to fall relative to the phase split. Hutchinson's objection at the
 * sitting is the whole point: a deload before a hard block is defensible
 * coaching, but **a defensible outcome reached at random is a coincidence, not
 * a decision** — and a coincidence lands wrong as often as right.
 *
 * THE RULES, from the board:
 *   1. A deload may not fall on the first week of a phase. Shift it.
 *   2. SHIFT, NEVER SKIP (Willy). The count is preserved exactly. The trade the
 *      request implied — fewer recovery weeks so intensity starts sooner — was
 *      explicitly declined, and the ultras are where deloads matter most: a
 *      50K runner dropping 79km→47km is not a defect, that is recovery working.
 *   3. Never lengthen a loading block beyond the cadence's own promise (Sims).
 *
 * RULES 1 AND 3 CANNOT BOTH BE SATISFIED BY MOVING A DELOAD ONE WEEK. Shifting
 * in either direction steals a week from one loading block and gives it to the
 * other, so rule 3 rejects both whenever the cadence divides evenly — on the HM
 * masters case, raw {3,6,9} has a worst run of 2, and both 6->5 and 6->7 give 3.
 * Measured, the first implementation moved NOTHING while reading perfectly
 * plausibly. The mechanism below is therefore RE-ANCHORING, not shifting: walk
 * the plan forward, place a deload one week early when the next would open a
 * phase, and restart the count there. Same case yields {3,5,8}.
 *
 * A backward normalisation pass then restores even spacing behind an early
 * placement — the forward pass is greedy and produced {3,5,8}, two deloads with
 * a single loading week between them, which is safe but is not the 3:1 cadence
 * §3 promises. {2,5,8} is. The archetype matrix caught that as `cadence 2`.
 */
/**
 * §119 / DELOAD-PLAN-OPENING-01 — THE SEARCH OVER LEGAL PLACEMENTS.
 *
 * 🔴 WHY A SEARCH AND NOT A THRESHOLD. The greedy walk below places a deload before
 * it knows a later one will be pulled early to clear a phase boundary, and its
 * backward normalisation then parks the earliest at WEEK 2 — its own comment records
 * `{3,5,8} -> {2,5,8}`. Measured on 5,664 cohort plans: `INV-PLAN-MIN-LOADING-BLOCK`
 * fires on **25.8%**, and on **week 2 in 100.0% of cases**. It is a long-race
 * defect: 5K 2.8% · 10K 2.8% · **HM 52.1% · marathon 50.0%**.
 *
 * ⚠️ THE OBVIOUS FIX IS PROVABLY UNIMPLEMENTABLE, which is why the board named a
 * search. Moving a placed deload by one week always takes a week from one loading
 * block and gives it to the other, so Sims's §87 rule 3 (never lengthen the worst
 * loading run) rejects BOTH directions whenever the cadence divides evenly.
 *
 * Dynamic programme over IN-SCOPE weeks only, in E-INDEX SPACE so a peak or taper
 * week can never be miscounted as a loading week.
 *
 * HARD: §87 not a phase's first week · §95 not phase position 2 · §119 every loading
 * run >= MIN_LOADING_BLOCK_WEEKS INCLUDING THE OPENING RUN · §23 trailing run >= 1.
 *
 * BOUNDS, read off the LEGACY placement rather than assumed — the two constraints
 * ratified when §95's first build was reverted:
 *   · 🩹 Willy  the deload COUNT may rise, never fall
 *   · ⚕️ Sims   the WORST loading run may never lengthen (`run <= maxRun`)
 *
 * SOFT: minimise `sum |gap - recoveryFreq|`, ties to the earlier placement.
 *
 * ⚠️ RETURNS `null` WHEN INFEASIBLE and the caller falls back to the legacy walk, so
 * a plan is never left without deloads. For masters HM that is the NORMAL case: the
 * shape is base 1-5, build 6-10, peak 11-13 at cadence 3, so a run is exactly 2
 * (`maxRun === MIN`) and the only legal second placement is week 6 — a phase's first
 * week, which §87 excludes. That cell is 99.1% infeasible and 82% of the residual.
 * ⛔ Closing it needs a 3-WEEK masters loading block, which §95 named and refused
 * and the board re-affirmed as a VETO on 2026-10-05.
 *
 * ⚠️ ONE BOUND WAS INVENTED AND CORRECTED BY MEASUREMENT: requiring the TRAILING run
 * to be `>= MIN` too. §119 counts loading weeks BEFORE a deload and nothing follows
 * the trailing block, so it can never fire there. The correction changed the firing
 * count by 0.
 */
function searchDeloadPlacements(
  eWeeks: readonly number[],
  recoveryFreq: number,
  isFirstWeekOfPhase: (n: number) => boolean,
  isPhasePosition2: (n: number) => boolean,
  avoidPosition2: boolean,
  legacy: ReadonlySet<number>,
): Set<number> | null {
  const E = eWeeks.length
  const MIN = GENERATION_CONFIG.MIN_LOADING_BLOCK_WEEKS
  if (E < 1) return null

  const legacyE: number[] = []
  for (let i = 0; i < E; i++) if (legacy.has(eWeeks[i] as number)) legacyE.push(i)
  const minCount = legacyE.length
  if (minCount === 0) return null
  let maxRun = legacyE[0] as number
  for (let i = 1; i < legacyE.length; i++) {
    maxRun = Math.max(maxRun, (legacyE[i] as number) - (legacyE[i - 1] as number) - 1)
  }
  const legacyTrailing = E - 1 - (legacyE[legacyE.length - 1] as number)
  maxRun = Math.max(maxRun, legacyTrailing)
  // ⚠️ THE TRAILING BOUND IS READ OFF THE LEGACY PLACEMENT, NOT ASSERTED AS 1.
  // The first cut required a trailing loading week unconditionally, on the §23
  // reasoning that a block must not END on a deload — and that made the search
  // unable to reproduce a RATIFIED placement. The E-window is base+build only
  // (peak and taper are out of scope), so on a 16-week plan it is weeks 1–12 and
  // the legacy deload IS week 12: legacy trailing is 0, and the weeks that follow
  // it are the peak, which is not a loading week this function places anything in.
  // §23 is about the PLAN's last week, which this window cannot see. Caught by
  // `deloadCadence.test.ts`'s §95 case, which pins {4,8,12}; the search returned
  // {4,8,11} — a WORSE placement (run of 5 against legacy's 4) that my own
  // `maxRun` bound should have rejected and could not, because the infeasible
  // trailing rule had already removed the legacy answer from the candidate set.
  const minTrailing = Math.min(1, legacyTrailing)

  const legal = (i: number): boolean => {
    const n = eWeeks[i] as number
    if (isFirstWeekOfPhase(n)) return false
    if (avoidPosition2 && isPhasePosition2(n)) return false
    return true
  }

  const INF = Number.POSITIVE_INFINITY
  const cost: number[][] = Array.from({ length: E }, () => Array(E + 2).fill(INF))
  const prev: number[][] = Array.from({ length: E }, () => Array(E + 2).fill(-1))

  for (let i = 0; i < E; i++) {
    if (!legal(i)) continue
    const opening = i
    if (opening < MIN) continue
    if (opening > maxRun) continue
    cost[i]![1] = Math.abs(opening + 1 - recoveryFreq)
  }

  for (let k = 1; k <= E; k++) {
    for (let i = 0; i < E; i++) {
      const c = cost[i]![k] as number
      if (!Number.isFinite(c)) continue
      for (let j = i + 1; j < E; j++) {
        if (!legal(j)) continue
        const run = j - i - 1
        if (run < MIN) continue
        if (run > maxRun) continue
        const add = Math.abs(run + 1 - recoveryFreq)
        if (c + add < (cost[j]![k + 1] as number)) {
          cost[j]![k + 1] = c + add
          prev[j]![k + 1] = i
        }
      }
    }
  }

  let bestI = -1, bestK = -1, bestC = INF
  for (let k = minCount; k <= E; k++) {
    for (let i = 0; i < E; i++) {
      const c = cost[i]![k] as number
      if (!Number.isFinite(c)) continue
      const trailing = E - 1 - i
      if (trailing < minTrailing) continue
      if (trailing > maxRun) continue
      if (c < bestC) { bestC = c; bestI = i; bestK = k }
    }
    if (bestI >= 0) break
  }
  if (bestI < 0) return null

  const out = new Set<number>()
  let i = bestI, k = bestK
  while (i >= 0 && k >= 1) {
    out.add(eWeeks[i] as number)
    i = prev[i]![k] as number
    k -= 1
  }
  return out
}

export function computeDeloadWeeks(
  totalWeeks: number,
  recoveryFreq: number,
  phaseForWeek: (weekN: number) => GeneratorPhase,
  /**
   * §95 — also keep a deload off phase position 2. Default true; the caller
   * passes false when §95 has YIELDED to §1 (Amendment 1, Coaching Board
   * 2026-09-15), which reverts placement to §87's behaviour exactly.
   */
  avoidPosition2 = true,
): Set<number> {
  if (!Number.isFinite(recoveryFreq) || recoveryFreq <= 0 || totalWeeks < 1) return new Set()

  const phaseOf = (n: number) => phaseForWeek(n)
  const isFirstWeekOfPhase = (n: number) => n === 1 || phaseOf(n) !== phaseOf(n - 1)
  const chosen = new Set<number>()
  const inScope = (n: number) => {
    const p = phaseOf(n)
    return n >= 1 && n <= totalWeeks && p !== 'peak' && p !== 'taper'
  }

  // SEQUENTIAL PLACEMENT WITH ONE WEEK OF LOOKAHEAD, not a post-hoc shift.
  //
  // The obvious implementation — take the raw cadence, then move any deload that
  // lands on a phase's first week — is UNIMPLEMENTABLE under the board's own
  // constraints, and measurement is what showed it. Moving a deload by one week
  // always steals a week from one loading block and gives it to the other, so
  // rule 3 ("never lengthen a loading block beyond the cadence's promise")
  // rejects BOTH directions whenever the cadence divides evenly. On the HM
  // masters case the raw cadence is {3,6,9} with a worst run of 2; shifting
  // 6→5 gives {3,5,9} with a run of 3, and 6→7 gives {3,7,9}, also 3. Nothing
  // moved, and the code read perfectly plausibly while doing nothing.
  //
  // Walking forward and RE-ANCHORING the cadence from each placed deload
  // satisfies both rules at once: the same HM case yields {3,5,8} — worst run
  // still 2, count still 3, and no deload on a phase's first week. `dueNext` is
  // the lookahead: when a deload would otherwise land on the first week of the
  // next phase, place it one week early and restart the count there, so the
  // runner arrives fresh into the new block (the placement every seat called
  // good practice) instead of being deloaded on its opening week.
  let since = 0     // consecutive loading weeks since the last deload
  for (let n = 1; n <= totalWeeks; n++) {
    if (!inScope(n)) { since = 0; continue }
    const dueNow = since >= recoveryFreq - 1
    const dueNext =
      since === recoveryFreq - 2 &&
      n + 1 <= totalWeeks &&
      inScope(n + 1) &&
      isFirstWeekOfPhase(n + 1)
    // §108 (Coaching Board 2026-09-15) — A RECOVERY WEEK SHOULD NOT SIT AT
    // PHASE POSITION 2 EITHER. §87 stopped a deload opening a phase; the same
    // defect one week over is "build week 1 loads, build week 2 deloads" —
    // one week of a new stimulus, then recovery from it. Measured at 16.1% of
    // the swept population and 37.0% of the cohort grid.
    //
    // Firing the SAME one-week lookahead one count earlier places the deload at
    // S-1 (the last week of the outgoing phase, §87's own stated ideal) and
    // re-anchors from there, so the next one lands at S+freq-1 — position 3 or
    // later. Standard runners measure [4,8,12] -> [2,6,10].
    //
    // ⚠️ `since >= 1` IS THE WHOLE FIX, and its absence is why the first build
    // was reverted. With RECOVERY_WEEK_FREQUENCY_MASTERS = 3 the count test
    // `since === recoveryFreq - 3` DEGENERATES TO `since === 0`, which is true
    // on the very week AFTER a placement — so it placed a deload adjacent to
    // the one just placed ([3,6] -> [3,4,7], count inflated, peak crushed, 453
    // plans flipped to maintenance). Adjacency is a HARD constraint: Willy —
    // back-to-back deloads do not add recovery, they remove a loading stimulus.
    const dueIn2 =
      avoidPosition2 &&
      since === recoveryFreq - 3 &&
      since >= 1 &&
      n + 1 <= totalWeeks &&
      inScope(n + 1) &&
      isFirstWeekOfPhase(n + 1)
    if (dueNow || dueNext || dueIn2) { chosen.add(n); since = 0 }
    else since++
  }

  // BACKWARD NORMALISATION — restore §3's cadence behind an early placement.
  //
  // The forward pass is greedy: it places a deload before it knows a later one
  // will be pulled early to clear a phase boundary. On the masters marathon
  // archetype that produced {3,5,8} — deloads at W3 and W5 with a SINGLE loading
  // week between them. Nothing is unsafe about it (it is more recovery, not
  // less) but it is not the 3:1 cadence §3 promises, and the archetype matrix
  // caught it as `deload cadence 2`.
  //
  // Walking back and pulling the earlier deload of any too-close pair further
  // back restores even spacing: {3,5,8} -> {2,5,8}, gaps 3 and 3. A shift is
  // taken only where it is legal AND does not simply move the problem onto the
  // pair behind it.
  const ordered = () => Array.from(chosen).sort((a, b) => a - b)
  for (let pass = 0; pass < ordered().length; pass++) {
    const weeks = ordered()
    let moved = false
    for (let i = weeks.length - 1; i >= 1; i--) {
      const gap = weeks[i] - weeks[i - 1]
      if (gap >= recoveryFreq) continue
      const target = weeks[i] - recoveryFreq
      if (target < 1 || !inScope(target)) continue
      if (chosen.has(target) || isFirstWeekOfPhase(target)) continue
      // Do not create a too-close pair with the deload before this one.
      if (i >= 2 && target - weeks[i - 2] < recoveryFreq) continue
      chosen.delete(weeks[i - 1])
      chosen.add(target)
      moved = true
      break
    }
    if (!moved) break
  }

  // §119 — THE SEARCH REPLACES THE WALK WHERE IT CAN.
  //
  // The walk above is retained deliberately and is NOT dead: it supplies the two
  // bounds the board ratified (count may not fall, worst run may not lengthen),
  // both defined RELATIVE to the placement this engine already produces. A search
  // bounded by assumed numbers is how §95's first build shipped a count inflation.
  const eWeeks: number[] = []
  for (let n = 1; n <= totalWeeks; n++) if (inScope(n)) eWeeks.push(n)
  const isPhasePosition2 = (n: number) =>
    n >= 2 && phaseOf(n) === phaseOf(n - 1) && isFirstWeekOfPhase(n - 1)
  const searched = searchDeloadPlacements(
    eWeeks, recoveryFreq, isFirstWeekOfPhase, isPhasePosition2, avoidPosition2, chosen)

  return searched ?? chosen
}

/**
 * §119 Amendment 1 — THE RESIDUAL, REPORTED BY THE PLACEMENT OWNER ITSELF.
 *
 * Returns the recovery weeks whose preceding loading run is shorter than
 * `MIN_LOADING_BLOCK_WEEKS` AFTER the search has done what it can. Empty when
 * the placement is compliant.
 *
 * ⚠️ THIS EXISTS BECAUSE THE RESIDUAL IS NOT RECOMPUTABLE FROM THE PLAN.
 * Reading `plan.weeks` tells you a loading run is short; it cannot tell you
 * whether a compliant placement EXISTED, which is the whole difference between
 * a defect and an infeasibility. Same reasoning as `uncovered_runway_weeks`:
 * the phase map that bounds the search is generation-time state `validatePlan`
 * never receives.
 *
 * 🔴 AND IT IS A SECOND READER OF THE SAME QUANTITY, SO IT SHARES THE PRODUCER.
 * It calls `computeDeloadWeeks` rather than re-deriving a placement, because a
 * checker that computes its own copy cannot catch the producer being wrong —
 * DELOAD-OWNER-01's whole finding, and the reason `deloadCadence.test.ts` fails
 * any producer outside this module.
 *
 * ⚠️ TWO DECLARED INFEASIBLE CELLS, measured on the cohort grid 2026-10-06 and
 * ratified by the board's sitting 2 (masters) and recorded here (experienced):
 *   • masters x HM — 735/741 (99.2%), 82.2% of the whole residual. Cadence 3 in a
 *     10-week base+build window with a mid-window phase boundary: runs must be
 *     exactly 2, and the only arithmetic slot is the boundary week §87 forbids.
 *     §95 already refused the 3-week masters loading block that would close it
 *     (Sims: masters are the slowest to recover connective tissue).
 *   • experienced, ADR-021 early onset — 159 cases (~3.2% of everything outside
 *     the masters cell), EVERY ONE `fitness_level: 'experienced'`. A 15% base
 *     floored at 2 weeks puts a phase boundary at week 3, so §119's two-week
 *     opening has nowhere legal to land either.
 * Both are the same shape: a phase shorter than the cadence can accommodate.
 */
export function shortOpeningBlockWeeks(
  totalWeeks: number,
  recoveryFreq: number,
  phaseForWeek: (weekN: number) => GeneratorPhase,
  avoidPosition2 = true,
): number[] {
  const placed = Array.from(
    computeDeloadWeeks(totalWeeks, recoveryFreq, phaseForWeek, avoidPosition2),
  ).sort((a, b) => a - b)
  if (!placed.length) return []

  const phaseOf = (n: number) => phaseForWeek(n)
  const inScope = (n: number) => {
    const p = phaseOf(n)
    return n >= 1 && n <= totalWeeks && p !== 'peak' && p !== 'taper'
  }
  const eWeeks: number[] = []
  for (let n = 1; n <= totalWeeks; n++) if (inScope(n)) eWeeks.push(n)

  const out: number[] = []
  let prevIdx = -1
  for (const w of placed) {
    const idx = eWeeks.indexOf(w)
    if (idx < 0) continue              // a deload outside the base/build window
    const run = idx - prevIdx - 1
    if (run < GENERATION_CONFIG.MIN_LOADING_BLOCK_WEEKS) out.push(w)
    prevIdx = idx
  }
  return out
}

/**
 * How deep a deload week cuts, as a fraction of the week it steps back from.
 *
 * SINGLE OWNER of deload DEPTH, for the same reason this module owns cadence.
 * `RECOVERY_WEEK_VOLUME_PCT / 100` had TWO writers in `ruleEngine.ts` and they
 * point in opposite directions:
 *   · `buildVolumeSequence` multiplies BY it to cut the week;
 *   · the day-count pass divides BY it to gross the week back up, so a deload
 *     keeps the surrounding frequency (DELOAD-INVERSION-01 part 3).
 * Split the depth by cohort in one of those places only and they silently
 * disagree — the divider would recover a pre-deload volume that was never cut.
 * That is producer-vs-producer drift, the exact fault this module exists for.
 *
 * §2 Amendment 2 (2026-09-16): a runner §12's volume cap governs gets a
 * SHALLOWER cut, because the cap cannot climb back out of a deep one before the
 * next deload arrives (0.70 x 1.05^3 = 0.81 — a 19% loss per cycle, compounding).
 */
export function deloadVolumeFraction(volumeCappedInjury: boolean): number {
  return (volumeCappedInjury
    ? GENERATION_CONFIG.INJURY_RECOVERY_WEEK_VOLUME_PCT
    : GENERATION_CONFIG.RECOVERY_WEEK_VOLUME_PCT) / 100
}

/**
 * DELOAD-WEEK-PREDICATE-01 — "is THIS WEEK OBJECT a deload?", one answer.
 *
 * 🔴 DELOAD-OWNER-01 one level down. This module already owns *is week N on
 * the cadence* (`isDeloadWeek`) and *where do they land* (`computeDeloadWeeks`).
 * Nothing owned the third question, asked of a week that already exists — and
 * the expression `w.type === 'deload' || w.badge === 'deload'` is hand-written
 * in **twelve** places across `invariants.ts`, `baseBuildValidate.ts` and the
 * measurement scripts.
 *
 * ⚠️ AND THEY DO NOT AGREE. Two sites read `type` ALONE
 * (`invariants.ts:2093` counts `plan.weeks.filter(w => w.type === 'deload')`;
 * `:2632` skips on `w.type === 'deload'`), so they see a different set of weeks
 * from the other ten whenever a week carries the badge without the type. **This
 * is the same shape as the five copies of the cadence expression that agreed
 * only by accident of surrounding control flow.**
 *
 * ⚠️ THE TWO DIVERGENT SITES ARE NOT MIGRATED HERE, DELIBERATELY. Pointing them
 * at this predicate would widen what those invariants fire on, which is an
 * engine behaviour change with its own blast radius and belongs to its own
 * item, measured — not folded silently into a display build. Filed as
 * `DELOAD-WEEK-PREDICATE-01`.
 */
export function isDeloadWeekObject(week: { type?: string | null; badge?: string | null } | null | undefined): boolean {
  if (!week) return false
  return week.type === 'deload' || week.badge === 'deload'
}
