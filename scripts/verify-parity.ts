/**
 * verify-parity — did this change alter what the engine generates?
 *
 *   npm run verify:parity            # vs HEAD~1
 *   npm run verify:parity <commit>   # vs any commit/branch/tag
 *
 * WHY THIS EXISTS. `npm run verify` proves generated plans are VALID (matrix,
 * sweep, invariants). It cannot tell you whether they are UNCHANGED — a plan can
 * be different and still pass every invariant. After a refactor in `lib/plan/`,
 * "no new violations" is not the same claim as "identical output", and the
 * second one is usually what you actually want to assert.
 *
 * HOW IT WORKS. Checks the baseline commit out into a throwaway git worktree,
 * COPIES ITSELF in, and runs the same grid on both sides in `--probe` mode.
 * Self-copying is the point: if each side ran its own version of the grid, the
 * comparison would be meaningless the moment the grid changed.
 *
 * TWO TRAPS IT IS BUILT TO AVOID, both hit for real while developing it:
 *
 *   1. VOLATILE FIELDS. The first version hashed the whole plan including
 *      `meta.generated_at`, a wall-clock stamp. It reported all 2592 plans as
 *      changed when nothing had changed at all. Volatile fields are stripped
 *      below; add to STRIP_META if a new one appears.
 *
 *   2. COMPARING NOTHING. A comparison of two empty outputs reports "identical"
 *      and is the most dangerous possible result. This asserts both sides
 *      produced the expected number of rows with a matching key set, and exits
 *      non-zero if not. (This repo has shipped a "successful" regression
 *      comparison that ran on two empty files. Once is enough.)
 *
 *   3. COMPARING HALF THE ENGINE — found 2026-09-13, and it had been true since
 *      this script was written. The grid hardcoded `goal: 'finish'`, so all 2,916
 *      cases ran ONE branch. Everything gated on `goal === 'time_target'` was
 *      invisible: §22's goal-pace renames, §24b/§24c's segmented long runs, §25's
 *      race-specific long runs, goal-paced quality, and the maintenance-label
 *      logic. LR-SEGMENT-RECORDED-§25 changed §25's producer, the golden snapshots
 *      caught it in four lines, and this script reported "IDENTICAL — 2916 cases,
 *      byte-for-byte unchanged" with total confidence.
 *
 *      Note that trap 2's guard did not help and could not have: row COUNT says
 *      nothing about input COVERAGE. 2,916 rows of the same branch is still one
 *      branch. `goal` is now an axis (×2 → 5,832), with a realistic per-distance
 *      `target_time` so the time-target plans are the ones a runner would get.
 *
 * NOT part of `npm run verify`: it needs a baseline commit and creates a
 * worktree, so it is an on-demand check, not a gate.
 */

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, copyFileSync, symlinkSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve , basename } from 'node:path'

// ── The grid ────────────────────────────────────────────────────────────────
// Deliberately spans the axes most likely to hide a regression: every distance
// (free and paid), both tiers, injury profiles (so injury-adaptation changes
// show up), and volumes that straddle the §44 refusal thresholds. Refusals are
// compared too — an input that used to be refused and now generates, or vice
// versa, is exactly the kind of silent change this is looking for.
const PLAN_START = '2026-09-14'                     // pinned Monday, never `new Date()`
const RACE_DATES = ['2026-12-06', '2027-01-17', '2027-03-28']
const DISTANCES = [5, 10, 21.1, 42.2, 50, 100]
const LEVELS = ['beginner', 'intermediate', 'experienced'] as const
const DAYS = [3, 4, 5]
// PARITY-GRID-PRODUCT-VALUES-01 (2026-09-25) — THE GRID SWEPT VALUES THE
// PRODUCT CANNOT EMIT. This axis was `[[], ['knee'], ['shin']]`. The wizard
// (`GeneratePlanScreen.tsx` → `INJURIES`) sends 'Achilles' · 'Knee' · 'Back' ·
// 'Hip' · 'Shin splints' · 'Plantar fasciitis' — capitalised, and two of them
// contain a SPACE.
//
// ⚠️ THE BLINDNESS IS NARROWER THAN "the values are wrong", and worth stating
// precisely so the fix is not oversold. `['shin']` DOES volume-cap today, because
// the matcher is bidirectional ('shin splints'.includes('shin')), so a blunt
// revert of `hasInjury` would still have been caught here. What could NOT be
// caught: **no value in this grid contained a space**, so every regression
// specific to the multi-word wizard strings was invisible — which is the whole
// 'Shin splints' family, and is exactly the defect INJURY-GUARD-PREDICATE-01
// fixed while this file reported IDENTICAL.
//
// Swapped for the product's own strings at NO extra cost: still three values,
// still 5,994 base rows, and now one of them carries a space.
const INJURIES: string[][] = [[], ['Knee'], ['Shin splints']]

// PARITY-INJURY-EXTRA — the four injuries this grid had NEVER swept.
//
// Not a wider cartesian axis: PARITY-HSR-01 ruled that "a ninth cartesian axis
// would be the wrong fix — 4x on an already slow check", and PARITY-DST-01
// followed it. Third application of the same pattern: append a focused block.
//
// These are not decorative values. `ruleEngine.ts` caps the long run at 120
// MINUTES for back and plantar-fasciitis histories, and
// `HILL_RESTRICTING_INJURIES` excludes hill sessions for achilles and plantar.
// Both are real prescription levers that this file has never once exercised.
// 72 rows on 5,994 (+1.2%).
const INJURY_EXTRA: string[][] = [['Achilles'], ['Back'], ['Hip'], ['Plantar fasciitis']]
const VOLUMES = [15, 30, 55]

// PARITY-GRID-VOLUME-FLOOR-01 — THE GRID'S LOWEST VOLUME IS 15 km/week AND THE
// AFFECTED BAND WAS 4-8.
//
// 🔴 MEASURED 2026-11-07. `verify:parity` reported **IDENTICAL on 6,102 cases** for
// §111 Amendment 4, a change that moved 80 real inputs and rescued 14 from an
// outright refusal — because **not one row in this grid could express an affected
// runner**. Then again the same day for §117 Amendment 7, whose entire population
// sits at `effectiveStartKm` 6.
//
// ⚠️ AND THE LONGEST RUN IS DERIVED, WHICH IS A SECOND BLINDNESS IN THE SAME ROW.
// The cartesian sets `longest_recent_run_km: max(5, round(cw / 3))`, so it can
// never reach `lr 0` — the never-run runner — at any volume. That is
// `ENVELOPE-LRR-BLIND-01`'s class, in this file. Both axes are varied here
// INDEPENDENTLY, because varying one while deriving the other cannot reach the
// interaction (recorded: "varying an axis is not reaching the interaction").
//
// ⚠️ APPENDED, NOT MULTIPLIED, following this file's own ratified pattern —
// PARITY-HSR-01: *"a ninth cartesian axis would be the wrong fix: 4x on an already
// slow check"*, applied again by PARITY-DST-01, PARITY-GRID-PRODUCT-VALUES-01 and
// PARITY-NO-BENCHMARK-01. **108 rows on 6,102 (+1.8%)** — 6 variants x 6 distances x 3 levels.
const LOWVOL_EXTRA: ReadonlyArray<{ tag: string; cw: number; lr: number }> = [
  { tag: 'lv-4-0',  cw: 4, lr: 0 },   // never run, below §116's running floor
  { tag: 'lv-5-5',  cw: 5, lr: 5 },   // §111 Am. 4's measured corner: one 5 km run a week
  { tag: 'lv-6-0',  cw: 6, lr: 0 },   // ON the floor, never run — §117 Am. 7's whole population
  { tag: 'lv-6-5',  cw: 6, lr: 5 },   // ON the floor, 2.17x week-1 step (WEEK1-DELIVERED-CEILING-01)
  { tag: 'lv-8-0',  cw: 8, lr: 0 },   // above the floor, never run
  { tag: 'lv-8-5',  cw: 8, lr: 5 },   // above the floor, the leap's worst measured band
]

// 🔴 THE FIRST CUT OF THIS BLOCK WAS cw 4 AND 8 ONLY, AND ITS OWN FALSIFICATION EXPOSED IT.
// Mutating `BASE_BUILD_ONRAMP_MIN_START_KM` 6 -> 7 — a change that can only bite AT cw 6 —
// left parity reporting IDENTICAL across all 6,174 rows, because no row sat at 6. So the block
// written to end this file's volume blindness was itself blind to the exact value both of the
// day's amendments turn on (`effectiveStartKm` 6). **A falsification aimed at the wrong
// population proves nothing, and it looks exactly like a working check.** cw 5 and 6 added.
const TIERS = ['free', 'paid'] as const

// Both goal branches. `finish` and `time_target` diverge early and widely — see
// trap 3 above. The target times are realistic mid-pack goals for each distance,
// because an absurd one gets refused by §44 and would silently test nothing.
const TARGET_TIMES: Record<number, string> = {
  5: '0:25:00', 10: '0:52:00', 21.1: '1:55:00',
  42.2: '4:00:00', 50: '6:00:00', 100: '14:00:00',
}
const GOALS = ['finish', 'time_target'] as const

// PARITY-DST-01 (2026-09-21) — the grid could not see a change to PLAN LENGTH.
//
// ⚠️ TWO THINGS HAD TO BE TRUE AT ONCE and only one was. `PLAN_START` is
// pinned to 2026-09-14 and all three `RACE_DATES` put the race WEEK's Monday
// before the 2027-03-28 spring-forward, so no span in the grid crossed a DST
// transition. And even a span that does cross only changes anything when
// `weeksAvailable` is the BINDING constraint rather than the per-distance
// week cap, which needs a TIGHT runway. DATE-DST-01 changed the length of 25%
// of real Monday-to-Monday plan spans and this file reported IDENTICAL, twice
// (5,940 cases, then 7,884 after naively adding a later race date).
//
// So: a focused block with its own GMT plan start and race dates on the far
// side of the transition, each a realistic 12 to 17 week runway. 54 cases.
const DST_PLAN_START = '2027-01-11'                 // Monday, GMT
const DST_RACE_DATES = ['2027-04-04', '2027-04-18', '2027-05-09']   // Sundays, BST

// PARITY-HSR-01 (2026-09-16) — `hard_session_relationship` was not varied AT
// ALL (grepped: 0 occurrences), so every run reported on a single value of it.
//
// ⚠️ THAT IS NOT A COSMETIC GAP. Four principles key off this input across 13
// call sites in `ruleEngine.ts` — §35's earned long-run tier (`love`), §47's
// consecutive-peak exception (`love`), §96's brake and Z2 cue (`overdo`) and
// §110's cap, dose and onset brake (`avoid`). §110 came back "IDENTICAL, 5832
// cases" on the very change that rewrote what an `avoid` runner is prescribed,
// which is the trap this file's own header warns about: IDENTICAL is not the
// same as VERIFIED, and a clean parity run is only evidence for the inputs the
// grid actually varies.
//
// A NINTH CARTESIAN AXIS WOULD BE THE WRONG FIX — 4x on an already slow check,
// to re-test 5,832 combinations against a lever that reads one field. Instead
// the main grid is untouched and a focused block is APPENDED: every distance x
// level x goal, at one race date / day count / volume, for the three non-default
// values. 108 rows on 5,832 (+1.9%) and every hsr-sensitive principle is
// exercised at every distance.
//
// Both sides of a parity run execute the SAME copy of this script (the
// orchestrator copies itself into the baseline worktree), so widening the key
// is safe — there is no stored baseline to invalidate.
const HSR_EXTRA = ['love', 'overdo', 'avoid'] as const

// ── PARITY-NO-BENCHMARK-01 (2026-10-14) — the grid had NEVER set a benchmark.
// Measured before this existed: the string `benchmark` appeared ZERO times in
// this file, across all 6,066 cases. That is expensive, because `benchmark` is
// the ONLY input reaching the engine's wall-clock read —
// `applyVdotDiscount(raw, b, new Date())` in `vdotFor` — and VDOT prices EVERY
// pace in the plan. So the harness this repo reaches for to prove "my refactor
// changed nothing" was structurally blind to the whole VDOT and pace path: a
// change repricing every benchmarked plan returned IDENTICAL.
//
// Same class as FOUNDATION-LONG-RUNWAY-01, different axis — there the grid
// pinned `plan_start` and held no runway cases; here it set no benchmark.
//
// 🔴 WHY ONLY TWO VARIANTS, AND WHY NEITHER IS "RECENT". The discount steps +1%
// per 4 weeks beyond VDOT_STALENESS_FRESH_WEEKS (4), from a 3% base, capped at
// VDOT_STALENESS_MAX_DISCOUNT_PCT (7). It reaches the cap at >= 16 weeks stale,
// and because the real "today" only moves forward a fixed past date stays
// capped FOREVER. Both variants are clock-stable by construction:
//   · no benchmark_date      -> base 3%, no clock read (invariants.ts asserts it)
//   · a date >= 16 weeks old -> pinned at the 7% cap
// A benchmark 5–15 weeks old sits ON the ramp, so its discount would move as the
// wall clock advances — it would make PARITY ITSELF non-deterministic, which is
// the opposite of the point. Deliberately absent.
//
// `benchmarkStability.test.ts` machine-checks that arithmetic rather than
// trusting this comment.
const BENCHMARK_EXTRA: ReadonlyArray<{ tag: string; benchmark: Record<string, unknown> }> = [
  { tag: 'bm-undated',
    benchmark: { type: 'race', distance_km: 10, time: '45:00' } },
  { tag: 'bm-capped',
    benchmark: { type: 'race', distance_km: 10, time: '45:00', benchmark_date: '2024-01-07' } },
]

/**
 * The key's field order, in one place. Both the axis-coverage guard and the
 * changed-by-axis report read positions out of the key, and until now each
 * carried its own copy of the layout — so appending `hsr` after `goal` silently
 * broke the guard (it asserted coverage with `endsWith('|finish')`, which stops
 * being true the moment anything follows `goal`). Two readers of one layout get
 * one definition.
 */
const KEY_FIELDS = ['distance', 'race', 'level', 'days', 'injuries',
  'volume', 'tier', 'goal', 'hsr'] as const
const keyField = (k: string, name: typeof KEY_FIELDS[number]) =>
  k.split('|')[KEY_FIELDS.indexOf(name)]

const EXPECTED_ROWS =
  DISTANCES.length * RACE_DATES.length * LEVELS.length *
  DAYS.length * INJURIES.length * VOLUMES.length * TIERS.length * GOALS.length
  + DISTANCES.length * LEVELS.length * GOALS.length * HSR_EXTRA.length
  + DISTANCES.length * LEVELS.length * DST_RACE_DATES.length          // PARITY-DST-01
  + DISTANCES.length * LEVELS.length * INJURY_EXTRA.length            // PARITY-GRID-PRODUCT-VALUES-01
  + DISTANCES.length * LEVELS.length * BENCHMARK_EXTRA.length        // PARITY-NO-BENCHMARK-01
  + DISTANCES.length * LEVELS.length * LOWVOL_EXTRA.length           // PARITY-GRID-VOLUME-FLOOR-01

/** Wall-clock / run-scoped fields. Present on both sides, different every run. */
// 🔴 `last_updated` ADDED 2026-11-07, AND IT WAS FOUND BY A FALSIFICATION THAT FAILED.
// The new low-volume block reported 72 of 72 rows CHANGED with the engine untouched. Two
// `--probe` runs in the SAME tree differed, and the single differing field across two
// identical `runEngine` calls was `meta.last_updated` — a millisecond wall-clock stamp the
// staged path writes and this list did not name. ⚠️ **A gate that cries wolf every run is
// one that gets switched off**, which this repo records as equivalent to having no gate;
// `meta.generated_at` made the FIRST version of this whole file report all 2,592 plans as
// changed, so this is the same defect in the same list, one field over.
const STRIP_META = ['generated_at', 'created_at', 'updated_at', 'last_updated']

/**
 * 🔴 NESTED CLOCK-DERIVED FIELDS, WHICH `STRIP_META`'S LOOP CANNOT REACH (2026-11-07,
 * `/code-review`). The loop above deletes top-level and `meta.*` keys only, so
 * `plan.pre_plan.week_estimate` survives — and it is literally `${todayIso} → ${planStartIso}`
 * (`ruleEngine.ts:6342`), day-granular, present on 9 of 18 sampled MAIN-grid cases.
 *
 * ⚠️ So the main cartesian has been able to flip roughly half its pre-plan rows across a
 * midnight straddle since it was written, and the commit that added `last_updated` declared
 * the volatile-field hole closed while this one was still open. **A strip list is only as deep
 * as its traversal.**
 */
const STRIP_PATHS = [['pre_plan', 'week_estimate']] as const
const stripVolatile = (o: any): void => {
  for (const f of STRIP_META) {
    if (o?.meta) delete o.meta[f]
    delete o?.[f]
  }
  for (const path of STRIP_PATHS) {
    let cur = o
    for (const k of path.slice(0, -1)) cur = cur?.[k]
    if (cur) delete cur[path[path.length - 1]]
  }
}

async function probe(): Promise<void> {
  // Imported lazily so the orchestrator never loads the engine itself.
  const { runEngine } = await import('../lib/plan/engine')
  const rows: string[] = []

  // 🔴 PARITY-STAGED-BLIND-01 (2026-11-10) — THE SINGLE PRODUCER FOR EVERY ROW, AND IT IS
  // `runEngine`, NOT `generateRulePlan`.
  //
  // Six blocks each wrote out their own `generateRulePlan` + hash + catch, and ONE of them
  // (`LOWVOL_EXTRA`) wrote `runEngine` instead. So this file answered two different questions
  // at once — *what does the engine GENERATE* in five blocks, *what does the runner RECEIVE*
  // in the sixth — which is the parallel-semantics failure this repo has paid for repeatedly
  // (`TIER-OWNER-01`, `DELOAD-OWNER-01`, `SESSION-KM-01/02`). It is now one owner and one
  // question: **what the runner receives.**
  //
  // 🔑 WHY THAT IS THE RIGHT QUESTION, MEASURED 2026-11-10. `generateRulePlan` THROWS on a
  // designed refusal, so a refused row stored the exception MESSAGE, **truncated to 140
  // characters**. **1,648 of 6,210 rows (26.5%) were refusals.** `runEngine` returns
  // `kind: 'plan' | 'base_build' | 'refusal'` with an OBJECT in every case, so:
  //
  //   before: 4,454 OK  · 1,648 REFUSED (a string)  ·  72 BASE_BUILD  ·  36 PLAN
  //   after : 4,490 PLAN · 1,602 REFUSAL (a body)   · 118 BASE_BUILD
  //
  // **46 rows were never refusals at all** — they are `base_build` STAGED PLANS (ultras at
  // 15 km/week; 16 × 50 km and 6 × 100 km reach a `door_km`, `checkpoint_week` and three
  // weeks of real sessions), and the gate saw a sentence. The other 1,602 gained the whole
  // refusal body: on the marathon days-warning case the `error` string alone is 211 chars, so
  // 71 were dropped, along with three `alternatives` and four numeric fields.
  //
  // ✅ FALSIFIED, AND THE DISCRIMINATING MUTATION WAS THE THIRD TRIED.
  // `BASE_BUILD_ONRAMP_MIN_START_KM` 6 → 7 and `BASE_BUILD_ONRAMP_DELOAD_FREQUENCY` 4 → 5 moved
  // **the same rows under both producers** (60 and 69) — *a falsification aimed at the wrong
  // population*, because `LOWVOL_EXTRA` already covered them.
  // `MAX_WEEKLY_VOLUME_INCREASE_PCT` 10 → 15: **old 3,990 rows, new 4,012 — 22 rows the old
  // grid could not see**, every one an ultra at 15 km/week.
  //
  // ⚠️ AND THE HONEST NUANCE, BECAUSE "INVISIBLE" OVERSTATES IT: on that mutation the old grid
  // DID catch **24** refused rows, since their refusal message quotes the volume it recommends
  // ("Get to about 16 km a week first"). It was partly sighted on refusals, never fully blind.
  // The 22 are the rows whose staged PLAN moved while their MESSAGE did not.
  //
  // ⚠️ THE ITEM'S STATED COST WAS FALSE AND IT IS WORTH SAYING WHY. It said routing the main
  // cartesian through `runEngine` means "every baseline hash moves once". There is no committed
  // baseline: `main()` does `copyFileSync(self, ...)` into the baseline worktree, so BOTH sides
  // run this file. Changing the producer changes both sides together and costs nothing.
  //
  // ⚠️ `acceptBaseBuild` IS DELIBERATELY UNSET. It is client intent ("I'll take the base
  // build"), and what the runner receives FIRST is whatever the engine offers unprompted.
  // Setting it would hash the accepted branch instead, and passing both would double the grid.
  //
  // ⚠️ `today` IS PINNED TO `planStart`, per block. `runEngine` defaults it to the wall clock,
  // and 36 of the low-volume rows carry `meta.uncovered_runway_weeks` derived from it — two
  // probes either side of a midnight would have reported them as CHANGED. Pinning does NOT make
  // the engine fully deterministic (`applyVdotDiscount` reads the real clock when a benchmark
  // is present, by design — `docs/contracts/engine.md` § The clock), but that was already true
  // of `generateRulePlan`, which owns that call: this change adds no clock dependency.
  const emit = (key: string, input: unknown, tier: string, planStart: string): void => {
    try {
      const out: any = runEngine({ input: input as any, tier: tier as any,
        planStart, today: planStart, displayUnits: 'km' } as any)
      const stable = JSON.parse(JSON.stringify(out?.plan ?? out?.body ?? out))
      stripVolatile(stable)
      // ⚠️ THE REFUSAL'S `reason` RIDES IN THE STATUS COLUMN, because hashing the body
      // alone cost the gate the only human-readable output it had: 1,602 rows used to print
      // their refusal sentence in the CHANGED report and would otherwise print two opaque
      // hashes (`/code-review`, 2026-11-10). It is part of the compared value on purpose —
      // a refusal changing its REASON is a change — and `reason` is a short enum
      // (`warn_unacknowledged`, …), never the message, so it cannot reintroduce the
      // truncated-string comparison this block exists to replace.
      const kind = String(out?.kind ?? 'none').toUpperCase()
      const why = out?.kind === 'refusal' && typeof out?.body?.reason === 'string'
        ? `:${out.body.reason}` : ''
      rows.push(`${key}\t${kind}${why}\t${createHash('sha256')
        .update(JSON.stringify(stable)).digest('hex').slice(0, 16)}`)
    } catch (e: any) {
      // A THROW from `runEngine` is a GENUINE fault, never a designed refusal (its own
      // docblock: "Throws only on a GENUINE fault"). Recording the message keeps a crash
      // comparable instead of aborting the whole probe.
      rows.push(`${key}\tTHREW\t${String(e?.message ?? e).replace(/\s+/g, ' ').slice(0, 140)}`)
    }
  }

  for (const race_distance_km of DISTANCES)
    for (const race_date of RACE_DATES)
      for (const user_declared_level of LEVELS)
        for (const days_available of DAYS)
          for (const injury_history of INJURIES)
            for (const current_weekly_km of VOLUMES)
              for (const tier of TIERS)
              for (const goal of GOALS) {
                const input = {
                  goal, age: 40, resting_hr: 55, max_hr: 180,
                  preferred_long_run_day: 'sun',
                  ...(goal === 'time_target' ? { target_time: TARGET_TIMES[race_distance_km] } : {}),
                  race_date, race_distance_km, current_weekly_km,
                  longest_recent_run_km: Math.max(5, Math.round(current_weekly_km / 3)),
                  days_available, user_declared_level, injury_history,
                }
                const key = [race_distance_km, race_date, user_declared_level, days_available,
                  injury_history.join('+') || 'none', current_weekly_km, tier, goal,
                  // The main grid sends no `hard_session_relationship` at all;
                  // 'unset' is the honest label for that, not 'neutral'.
                  'unset'].join('|')
                emit(key, input, tier, PLAN_START)
              }

  // ── PARITY-HSR-01 block — see HSR_EXTRA above for why this is appended
  // rather than folded into the cartesian product.
  for (const race_distance_km of DISTANCES)
    for (const user_declared_level of LEVELS)
      for (const goal of GOALS)
        for (const hard_session_relationship of HSR_EXTRA) {
          const race_date = RACE_DATES[0]
          const days_available = 5
          const current_weekly_km = 30
          const tier = 'paid'
          const input = {
            goal, age: 40, resting_hr: 55, max_hr: 180,
            preferred_long_run_day: 'sun',
            ...(goal === 'time_target' ? { target_time: TARGET_TIMES[race_distance_km] } : {}),
            race_date, race_distance_km, current_weekly_km,
            longest_recent_run_km: Math.max(5, Math.round(current_weekly_km / 3)),
            days_available, user_declared_level, injury_history: [],
            hard_session_relationship,
          }
          const key = [race_distance_km, race_date, user_declared_level, days_available,
            'none', current_weekly_km, tier, goal, hard_session_relationship].join('|')
          emit(key, input, tier, PLAN_START)
        }

  // ── PARITY-INJURY-EXTRA block — the four wizard injuries the main grid has
  // never carried. One race date / day count / volume / tier / goal, so the
  // injury value is the only thing varying beside distance and level.
  for (const race_distance_km of DISTANCES)
    for (const user_declared_level of LEVELS)
      for (const injury_history of INJURY_EXTRA) {
        const race_date = RACE_DATES[0]
        const days_available = 4
        const current_weekly_km = 30
        const tier = 'paid'
        const input = {
          goal: 'finish', age: 40, resting_hr: 55, max_hr: 180,
          preferred_long_run_day: 'sun',
          race_date, race_distance_km, current_weekly_km,
          longest_recent_run_km: Math.max(5, Math.round(current_weekly_km / 3)),
          days_available, user_declared_level, injury_history,
        }
        // `KEY_FIELDS` is positional and these injury values appear in no other
        // block, so the key is unique without a prefix — same argument as DST.
        const key = [race_distance_km, race_date, user_declared_level, days_available,
          injury_history.join('+'), current_weekly_km, tier, 'finish', 'unset'].join('|')
        emit(key, input, tier, PLAN_START)
      }

  // ── PARITY-GRID-VOLUME-FLOOR-01 block — see LOWVOL_EXTRA above. Volume and the
  // longest run varied INDEPENDENTLY, below the cartesian's floor of 15.
  for (const race_distance_km of DISTANCES)
    for (const user_declared_level of LEVELS)
      for (const lv of LOWVOL_EXTRA) {
        // RACE_DATES[2] (the longest runway), for BENCHMARK_EXTRA's measured reason: at
        // the nearer dates §44 refuses most distances, and a refused row carries a
        // message rather than a plan hash, so it can never detect a prescription change.
        const race_date = RACE_DATES[2]
        const days_available = 4
        const tier = 'paid'
        const goal = 'finish'
        const input = {
          goal, age: 40, resting_hr: 55, max_hr: 180,
          preferred_long_run_day: 'sun',
          race_date, race_distance_km,
          current_weekly_km: lv.cw,
          longest_recent_run_km: lv.lr,
          days_available, user_declared_level, injury_history: [],
          // A real low-volume runner acknowledges the prep warning; an envelope that
          // never does counts every confirmation prompt as a refusal.
          acknowledged_days_warning: true, acknowledged_prep_warning: true,
        }
        const key = [race_distance_km, race_date, user_declared_level, days_available,
          'none', lv.cw, tier, goal, lv.tag].join('|')
        // ✅ PARITY-STAGED-BLIND-01 (2026-11-10) — THIS BLOCK NO LONGER NEEDS ITS OWN PRODUCER.
        // It was the ONLY block on `runEngine`, because without it most of it was decorative:
        // measured 2026-11-07, **24 of its 36 distance × variant combinations are REFUSED by
        // `generateRulePlan`** (LongRunReadinessError / BaseVolumeError) while `runEngine`
        // returns a **base_build staged plan**, which is what the runner receives. ⚠️ NOT
        // "every one", and the first cut of this comment said every one: 5K and 10K generate
        // 6 of 6, so 12 of 36 were never refused at all (`/code-review`, same day).
        // Hashing the refusal MESSAGE could not detect a change to the staged block — the
        // first cut reported IDENTICAL with `BASE_BUILD_ONRAMP_MIN_START_KM` mutated 6 → 7
        // directly underneath it. **Every block now shares that producer**; `emit` carries the
        // reasoning and the pinned `today` that this block used to carry alone.
        emit(key, input, tier, PLAN_START)
      }

  // ── PARITY-NO-BENCHMARK-01 block — see BENCHMARK_EXTRA above. Appended rather
  // than multiplied into the cartesian product: every distance x level x the two
  // clock-stable benchmark variants, at one race date / day count / volume.
  for (const race_distance_km of DISTANCES)
    for (const user_declared_level of LEVELS)
      for (const bm of BENCHMARK_EXTRA) {
        // 🔴 RACE_DATES[2], NOT [0], AND THE REASON IS MEASURED. The first cut used
        // RACE_DATES[0] ('2026-12-06') like the blocks above it, and TWELVE of the
        // eighteen capped cases came back REFUSED with PrepTimeError — too few weeks
        // for a half, marathon or ultra. So the axis exercised VDOT at 5K and 10K
        // only, while reading as full coverage. Measured at four race dates:
        // 2026-12-06 refuses 4 of 6 distances, 2027-01-17 refuses 2, 2027-03-28
        // refuses none. A refused row carries a message rather than a plan hash, so
        // it can never detect a pricing change.
        const race_date = RACE_DATES[2]
        const days_available = 5
        const current_weekly_km = 30
        const tier = 'paid'
        const goal = 'time_target'
        const input = {
          goal, age: 40, resting_hr: 55, max_hr: 180,
          preferred_long_run_day: 'sun',
          target_time: TARGET_TIMES[race_distance_km],
          race_date, race_distance_km, current_weekly_km,
          longest_recent_run_km: Math.max(5, Math.round(current_weekly_km / 3)),
          days_available, user_declared_level, injury_history: [],
          benchmark: bm.benchmark,
        }
        const key = [race_distance_km, race_date, user_declared_level, days_available,
          'none', current_weekly_km, tier, goal, bm.tag].join('|')
        emit(key, input, tier, PLAN_START)
      }

  // ── PARITY-DST-01 block — tight runways that cross spring-forward.
  for (const race_distance_km of DISTANCES)
    for (const user_declared_level of LEVELS)
      for (const race_date of DST_RACE_DATES) {
        const days_available = 4
        const current_weekly_km = 30
        const tier = 'paid'
        const input = {
          goal: 'finish', age: 40, resting_hr: 55, max_hr: 180,
          preferred_long_run_day: 'sun',
          race_date, race_distance_km, current_weekly_km,
          longest_recent_run_km: Math.max(5, Math.round(current_weekly_km / 3)),
          days_available, user_declared_level, injury_history: [],
        }
        // No 'dst' prefix: `KEY_FIELDS` is positional, and the race dates in
        // this block appear nowhere else, so the key is already unique.
        const key = [race_distance_km, race_date, user_declared_level, days_available,
          'none', current_weekly_km, tier, 'finish', 'unset'].join('|')
        emit(key, input, tier, DST_PLAN_START)
      }

  rows.sort()
  process.stdout.write(rows.join('\n') + '\n')
}

function run(cmd: string, args: string[], cwd: string): string {
  return execFileSync(cmd, args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
}

function parse(out: string, side: string): Map<string, string> {
  const m = new Map<string, string>()
  for (const line of out.split('\n')) {
    if (!line.trim()) continue
    const [k, status, v] = line.split('\t')
    m.set(k, `${status}\t${v}`)
  }
  // Trap 2: never let an empty or truncated run masquerade as agreement.
  if (m.size !== EXPECTED_ROWS) {
    console.error(`\n✗ ${side} produced ${m.size} rows, expected ${EXPECTED_ROWS}.`)
    console.error('  Refusing to compare — an incomplete run cannot prove parity.')
    process.exit(2)
  }
  // Trap 3: row COUNT is not input COVERAGE. The grid ran 2,916 rows of a single
  // `goal` branch for months and reported IDENTICAL across a change it could not
  // see. A count guard cannot catch that — only asserting the axis is actually
  // varied can. Cheap, and it fails the moment someone narrows the grid again.
  // Read by POSITION, not by suffix. The suffix form asserted coverage only
  // while `goal` happened to be the last field, and quietly stopped asserting
  // anything when `hsr` was appended after it — a coverage guard that fails
  // open is worse than none, which is the exact lesson trap 3 records.
  for (const g of GOALS) {
    if (!Array.from(m.keys()).some(k => keyField(k, 'goal') === g)) {
      console.error(`\n✗ ${side} produced no \`${g}\` rows.`)
      console.error('  Refusing to compare — a grid that runs one branch cannot prove parity for the other.')
      process.exit(2)
    }
  }

  // PARITY-HSR-01 — the same assertion for the axis this file was blind to.
  // Without it, someone narrowing the HSR block back out would restore the
  // original gap and every run would still print IDENTICAL.
  for (const h of HSR_EXTRA) {
    if (!Array.from(m.keys()).some(k => keyField(k, 'hsr') === h)) {
      console.error(`\n✗ ${side} produced no \`${h}\` rows.`)
      console.error('  Refusing to compare — hard_session_relationship drives §35, §47, §96 and §110,')
      console.error('  and a grid that pins it cannot prove parity for the runners those rules govern.')
      process.exit(2)
    }
  }
  return m
}

async function main(): Promise<void> {
  if (process.argv.includes('--probe')) return probe()

  const repo = resolve(__dirname, '..')
  const baseRef = process.argv[2] ?? 'HEAD~1'
  const baseSha = run('git', ['rev-parse', '--short', baseRef], repo).trim()
  const headSha = run('git', ['rev-parse', '--short', 'HEAD'], repo).trim()

  // The "current" side runs from the REPO DIRECTORY, so it executes whatever is
  // in the working tree — uncommitted edits included. That is the behaviour you
  // want (you are usually checking work you have not committed yet), but the
  // report used to name two commit shas, which reads as "I compared these two
  // commits" and is false the moment the tree is dirty. Say which it was.
  const dirty = run('git', ['status', '--porcelain'], repo).trim().length > 0
  const headLabel = dirty ? `working tree (on top of ${headSha})` : headSha

  if (baseSha === headSha && !dirty) {
    console.error(`✗ ${baseRef} resolves to HEAD (${headSha}) and the tree is clean. Nothing to compare.`)
    process.exit(2)
  }

  console.log(`Plan-generation parity`)
  console.log(`  baseline : ${baseSha} (${baseRef})`)
  console.log(`  current  : ${headLabel}`)
  console.log(`  cases    : ${EXPECTED_ROWS}\n`)

  // ⚠️ DERIVED FROM argv, NOT HARDCODED — 2026-09-19. This was
  // `join(repo,'scripts','verify-parity.ts')`, so a COPY of this script (made
  // to strip extra fields and prove a change is confined to them) copied the
  // ORIGINAL into the worktree: the baseline side ran a different strip list
  // from the current side and the diff was meaningless, while looking exactly
  // like a real prescription change. Caught only because the result was
  // implausible. A self-reference that names one file cannot survive being
  // copied, and copying it is the natural way to scope a parity run.
  const selfName = basename(process.argv[1] ?? 'verify-parity.ts')
  const self = join(repo, 'scripts', selfName)
  const wt = mkdtempSync(join(tmpdir(), 'zonna-parity-'))
  let created = false

  try {
    console.log(`→ generating from the ${dirty ? 'working tree' : 'current commit'}`)
    const headOut = run('npx', ['tsx', '--tsconfig', 'tsconfig.json', self, '--probe'], repo)

    console.log(`→ checking out ${baseSha} into a worktree`)
    run('git', ['worktree', 'add', '--detach', wt, baseSha], repo)
    created = true

    // The baseline commit has no node_modules of its own, and may not even
    // contain this script — so bring both in from HEAD.
    const nm = join(wt, 'node_modules')
    if (!existsSync(nm)) symlinkSync(join(repo, 'node_modules'), nm, 'dir')
    copyFileSync(self, join(wt, 'scripts', selfName))

    console.log(`→ generating at ${baseSha}\n`)
    const baseOut = run('npx', ['tsx', '--tsconfig', 'tsconfig.json',
      join(wt, 'scripts', selfName), '--probe'], wt)

    const head = parse(headOut, 'HEAD')
    const base = parse(baseOut, baseSha)

    // Array.from, not [...spread] — the repo's tsconfig target rejects
    // spreading a Map iterator (the same note is in CLAUDE.md for Set).
    const changed = Array.from(base.keys()).filter(k => base.get(k) !== head.get(k))

    if (changed.length === 0) {
      console.log(`✓ IDENTICAL — ${EXPECTED_ROWS} cases, byte-for-byte unchanged.`)
      console.log(`  Generation is provably unaffected between ${baseSha} and ${headLabel}.`)
      return
    }

    console.log(`✗ ${changed.length} of ${EXPECTED_ROWS} cases CHANGED.\n`)
    console.log('  key = distance|race|level|days|injuries|volume|tier|goal\n')

    // WHERE the change landed, not just how much. Only 25 keys are printed
    // below, so without this a 900-case diff cannot be checked for containment
    // — "did my ultra-only change touch a 10K plan?" is exactly the question a
    // parity run should answer, and counting a truncated list cannot answer it.
    const AXES = ['distance', 'race', 'level', 'days', 'injuries', 'volume', 'tier', 'goal', 'hsr']
    console.log('  changed cases by axis:')
    for (let i = 0; i < AXES.length; i++) {
      const axis = AXES[i]
      const tally = new Map<string, number>()
      for (const k of changed) {
        const v = k.split('|')[i]
        tally.set(v, (tally.get(v) ?? 0) + 1)
      }
      const all = new Map<string, number>()
      for (const k of Array.from(head.keys())) {
        const v = k.split('|')[i]
        all.set(v, (all.get(v) ?? 0) + 1)
      }
      const parts = Array.from(all.keys()).map(v => {
        const c = tally.get(v) ?? 0
        return `${v}=${c}/${all.get(v)}`
      })
      console.log(`    ${axis.padEnd(9)} ${parts.join('  ')}`)
    }
    console.log('')
    for (const k of changed.slice(0, 25)) {
      console.log(`  ${k}`)
      console.log(`     ${baseSha}: ${base.get(k)}`)
      console.log(`     ${headLabel}: ${head.get(k)}`)
    }
    if (changed.length > 25) console.log(`\n  ...and ${changed.length - 25} more.`)
    console.log(`\n  If this was intended, say so explicitly and record WHY.`)
    console.log(`  If it was not, you just caught a silent prescription change.`)
    process.exitCode = 1
  } finally {
    if (created) {
      try { run('git', ['worktree', 'remove', '--force', wt], repo) } catch { /* best effort */ }
      run('git', ['worktree', 'prune'], repo)
    }
    rmSync(wt, { recursive: true, force: true })
  }
}

main().catch(err => { console.error(err); process.exit(2) })
