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
export function computeDeloadWeeks(
  totalWeeks: number,
  recoveryFreq: number,
  phaseForWeek: (weekN: number) => GeneratorPhase,
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
    if (dueNow || dueNext) { chosen.add(n); since = 0 }
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

  return chosen
}
