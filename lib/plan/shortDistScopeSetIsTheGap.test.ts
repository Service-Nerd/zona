// §117 Am. 8 — the band `INV-PLAN-RUNWALK-SHORTDIST-SCOPE` counts is a GAP, not a complement.
//
// 🔴 WHY THIS GATE EXISTS. `runWalkOutOfScopeUnready` first tested "any distance outside
// `RUNWALK_INSTRUCTION_RACE_KEYS`", which swept in the 50K and 100K — **62% of all firings** —
// and `runWalkPlan.ts` excludes the ultras from §117 for a different, ratified reason: *"the
// ultras have their own §24e machinery."* Their exclusion is a RULING with its own mechanism,
// so counting them as "§117 Am. 8's residual" attributes them to the wrong cause.
//
// So the set is the GAP between three things that each have an owner:
//   · what §117 named                     — the marathon
//   · what Amendment 8 added              — 5K, 10K      (`RUNWALK_INSTRUCTION_RACE_KEYS`)
//   · what §24e governs instead           — 50K, 100K
// …leaving exactly the half marathon, which nothing covers.
//
// ⚠️ The constant is NAMED rather than derived, because the complement is the wrong answer.
// These arms are what stops the three drifting apart: widen the instruction scope, or bring the
// ultras in, and the arithmetic below says so instead of the invariant silently changing
// population. **A named constant with no gate linking it to its reason is the thing code review
// flagged; this is the link.**
import { describe, it, expect } from 'vitest'
import { GENERATION_CONFIG, raceDistanceKey, type RaceDistanceKey } from './generationConfig'
import { runWalkDistanceApplies, runWalkInstructionDistanceApplies, runWalkOutOfScopeUnready } from './runWalkPlan'
import { derivedLevelsFor } from './ruleEngine'
import type { GeneratorInput } from '../../types/plan'

/** One representative distance per `raceDistanceKey` band, from the wizard's own list.
 *  🔴 `Record<RaceDistanceKey, number>`, NOT `Record<string, number>`. With `string` a seventh
 *  band could be added to `raceDistanceKey` and the loops here would never visit it, so a
 *  distance governed by NOBODY could ship.
 *  ⚠️ TWO THINGS CATCH THAT, NOT ONE — this comment claimed the compiler was "the only thing"
 *  and the arm added beside it in `2ec65bf5` says otherwise, which left one file asserting
 *  opposite things about the same detection path (code review). The TYPE makes a one-part edit
 *  a compile error; the LAST ARM compares this map's keys against `INTENSITY_DISTRIBUTION`'s at
 *  runtime, and is what remains if the type is ever loosened. */
const BY_KEY: Record<RaceDistanceKey, number> = { '5K': 5, '10K': 10, HM: 21.1, MARATHON: 42.2, '50K': 50, '100K': 100 }
/** §24e's band — the ultras, excluded from §117 by their own machinery. */
const ULTRA_KEYS = ['50K', '100K'] as const

const mk = (km: number): GeneratorInput => ({
  athlete_name: 'A', age: 38, race_name: 'T', primary_metric: 'distance',
  plan_start: '2026-04-27', race_distance_km: km, race_date: '2026-10-04', goal: 'finish',
  days_available: 4, days_cannot_train: [], current_weekly_km: 10, longest_recent_run_km: 0,
  training_age: '<6mo', recent_quality_training: 'none',
  hard_session_relationship: 'neutral', injury_history: [], max_weekday_mins: 60,
} as unknown as GeneratorInput)

describe('§117 Am. 8 — the counted band is the gap between three owners', () => {
  it('every raceDistanceKey has EXACTLY ONE owner — a partition, not a covering', () => {
    // 🔴 THIS ARM COULD NOT FAIL FOR THE DRIFT ITS HEADER CLAIMS TO HOLD (code review,
    // 2026-11-13). It tested `owned = scope.has(k) || ultras.has(k) || isCounted` — an OR —
    // and `runWalkOutOfScopeUnready` has NO dependence on `RUNWALK_INSTRUCTION_RACE_KEYS`, so
    // widening the scope only made `owned` MORE true. Falsified against the real tree both
    // ways: adding 'HM' to the scope left 4/4 green with the half simultaneously in scope and
    // counted as "the band nothing covers"; adding '50K' left 12/12 green with the 50K owned
    // by §117 Am. 8 and §24e at once. Only NARROWING the scope could red it.
    // ⚠️ A covering is not a partition. The claim is that each band has exactly ONE owner, so
    // the arm has to test pairwise DISJOINTNESS as well as completeness — and I wrote this
    // file while fixing a finding about a gate that guarded a copy of itself.
    const scope = new Set<string>(GENERATION_CONFIG.RUNWALK_INSTRUCTION_RACE_KEYS)
    const ultras = new Set<string>(ULTRA_KEYS)
    const counted: string[] = []
    const unaccounted: string[] = []
    const doubleOwned: string[] = []
    for (const [key, km] of Object.entries(BY_KEY)) {
      expect(raceDistanceKey(km), `${km}km no longer maps to ${key}`).toBe(key)
      const i = mk(km)
      const isCounted = runWalkOutOfScopeUnready(i, derivedLevelsFor(i).structural)
      if (isCounted) counted.push(key)
      const owners = [scope.has(key) && 'instruction scope', ultras.has(key) && '§24e ultras',
        isCounted && 'counted residual'].filter(Boolean) as string[]
      if (owners.length === 0) unaccounted.push(key)
      if (owners.length > 1) doubleOwned.push(`${key}: ${owners.join(' AND ')}`)
    }
    expect(unaccounted,
      'a distance band is governed by nobody: not in §117 Am. 8s instruction scope, not an '
      + 'ultra under §24e, and not counted as the residual. Either it belongs in one of them '
      + 'or the invariant needs a ruling for it.').toEqual([])
    expect(doubleOwned,
      'a distance band has TWO owners, which means one of them is wrong about it. The three '
      + 'sets partition the distances: §117 Am. 8 prescribes, §24e governs the ultras, and the '
      + 'residual is what is left. Widening one without narrowing another is the drift this '
      + 'arm exists to catch.').toEqual([])
    expect(counted,
      'the residual band moved. It must be the HALF alone: §117 names the marathon, Am. 8 added '
      + '5K and 10K, §24e governs the ultras, and nothing covers the half.').toEqual(['HM'])
  })

  it('🔴 the ultras are NOT counted — their exclusion is a ruling, not an omission', () => {
    for (const key of ULTRA_KEYS) {
      const i = mk(BY_KEY[key]!)
      expect(runWalkOutOfScopeUnready(i, derivedLevelsFor(i).structural),
        `${key} is being counted as §117 Am. 8s residual, but runWalkPlan.ts excludes the ultras `
        + 'because "the ultras have their own §24e machinery". 62% of the first cut\'s firings '
        + 'were ultras for exactly this reason.').toBe(false)
    }
  })

  it('the instruction scope and the PEAK scope are still different sets', () => {
    // The regression §117 Am. 4 separates by ruling, and the one a one-line fix would have made.
    expect(GENERATION_CONFIG.RUNWALK_INSTRUCTION_RACE_KEYS.includes('5K')).toBe(true)
    expect(runWalkInstructionDistanceApplies(5)).toBe(true)
    expect(runWalkDistanceApplies(5), 'the PEAK scope widened to the 5K').toBe(false)
    expect(runWalkDistanceApplies(42.2)).toBe(true)
  })

  it('🔴 every name in the scope is a REAL band — a typo would land the ruling INERT', () => {
    // 🔴 `RUNWALK_INSTRUCTION_RACE_KEYS` is `readonly string[]`, so a typo compiles. Verified:
    // `['5K','10K','MARATHON','HALF']` gives tsc 0 errors and leaves every other arm here
    // green, while `runWalkInstructionDistanceApplies` never matches 'HALF' — **a board-ruled
    // WIDENING of this scope would land completely inert with the drift gate passing.** That is
    // the decorative-config class, in the one constant a board ruling writes to.
    //
    // ⚠️ TYPING THE CONSTANT AS `readonly RaceDistanceKey[]` IS NOT AVAILABLE AND IT WAS TRIED:
    // `RaceDistanceKey` is `keyof typeof GENERATION_CONFIG.INTENSITY_DISTRIBUTION`, so annotating
    // a field INSIDE `GENERATION_CONFIG` with it makes the object's type depend on itself and
    // tsc degrades the whole literal — six unrelated files start erroring. So the membership is
    // asserted at runtime, against the same object the type is derived from.
    const realBands = Object.keys(GENERATION_CONFIG.INTENSITY_DISTRIBUTION)
    const unknown = GENERATION_CONFIG.RUNWALK_INSTRUCTION_RACE_KEYS.filter(k => !realBands.includes(k))
    expect(unknown,
      'a name in RUNWALK_INSTRUCTION_RACE_KEYS is not a raceDistanceKey band, so it matches '
      + 'nothing and the scope it was added to is inert. Compare against `raceDistanceKey`s own '
      + 'bands: ' + realBands.join(', ')).toEqual([])
  })

  it('BY_KEY still covers every band — the loop above is not short', () => {
    // ⚠️ RENAMED: it read "the representatives really span every band", and after the subsumed
    // assertion was deleted nothing in here reads `Object.values(BY_KEY)` or calls
    // `raceDistanceKey` — mutating `HM: 11` makes that titled property false while this arm
    // stays green (arm 1 is what reds). A name written for a deleted assertion is a false record.
    // ⚠️ The previous version of this arm was a TAUTOLOGY (`new Set(keys).size === keys.length`
    // over `Object.keys`), in the commit whose subject was shipping a gate that could not fail.
    // The property with detection power is that `BY_KEY` covers the SAME set the type is derived
    // from — so a band dropped from the map (were the type ever loosened, as the arm above shows
    // it can be) reds here instead of silently shrinking arm 1's population.
    // ⚠️ FALSIFIED BY A TWO-PART EDIT, AND THAT IS THE ONLY WAY IT CAN RED: while `BY_KEY` is
    // `Record<RaceDistanceKey, number>`, adding or dropping a key alone is a COMPILE error, so
    // this arm is unreachable with tsc green. Loosen the map to `Record<string, number>` and drop
    // '100K' and it reds ALONE (1 failed / 4 passed) — which is its job: to be the detector for
    // exactly the loosening the typo arm above proves this codebase permits.
    //
    // 🔴 AND THE REASON THE OTHERS STAY GREEN IS WORSE THAN "THEY DO NOT NOTICE" — corrected by
    // code review, which caught this comment stating the wrong mechanism. Arm 1 iterates
    // `Object.entries(BY_KEY)`, so a dropped key is simply NEVER VISITED; it is ARM 2 ABOVE —
    // the `mk(BY_KEY[key]!)` in the ultras arm — that receives `undefined`. (This read "below"
    // and pointed the wrong way, which is the same misattribution the rest of this comment was
    // rewritten to fix.) And arm 2 then passes VACUOUSLY:
    // `raceDistanceKey(undefined)` falls through every `<=` comparison to return '100K', and
    // `runWalkOutOfScopeUnready` short-circuits on its first line. So the loosening breaks TWO
    // things — it shrinks arm 1's population silently and it makes arm 2 assert nothing about
    // the band it names — and this arm is the only one that says so.
    expect(new Set(Object.keys(BY_KEY))).toEqual(new Set(Object.keys(GENERATION_CONFIG.INTENSITY_DISTRIBUTION)))
    // ⚠️ AND NOTHING ELSE. A second assertion here —
    // `new Set(values.map(raceDistanceKey)).size === keys.length` — was REMOVED: it is subsumed
    // by arm 1's per-entry `expect(raceDistanceKey(km)).toBe(key)` and can never red alone
    // (falsified with `HM: 11`, which reds arm 1 and this one together, 2 failed / 3 passed).
    // The tautology deleted in `2ec65bf5` had been replaced by one assertion that detects and one
    // that still could not fire first; an arm earns its line by failing where the others pass.
    // ⚠️ SHAs, not "two commits ago": I wrote that twice and it was wrong both times, because a
    // relative position changes every time the file is touched while a SHA does not. Same shape
    // as the review-round total removed from the state blocks.
  })
})
