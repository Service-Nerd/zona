# 🏃 Coaching Board — `STRENGTH-PAIR-STRIDE-01` (prototype sitting), 2026-11-20

**Ruling: CORRECT WITH AMENDMENT. Option B: greedy cross-region pairing AND a session-scoped superset clock, in one
commit. The dose Willy held the fix on does not fall. It rises, and the reason it fell was a clock defect that is
live in production today.**

Seats: Hutchinson (chair), Seiler, McMillan, Willy, Sims, **Blagrove (seated, strength domain)**.

## The question the board could not answer without a prototype

The 2026-11-04 sitting held the pairing fix under Willy's binding condition: *the fix must not reduce the strength
dose*. Measured then, sets/session fell 15.397 → 14.813 and core sets 4.579 → 4.229. The fill loop was shown to stop
earlier (rejections *"would not fit"* 16,704 → 86,069). It was not shown **why** a paired session sits nearer the clock
when a pair is ~60 s cheaper per round than the same two items done apart. Two hypotheses had already died (the
remainder-solo costing; the fill's `partner.item.sets` guard, which fires 0 times). The item's named next step: trace
one session through `estimateMinutes`.

**The precise question:** is the dose loss a property of correct pairing (so the trade is real and the board must
price it), or an artefact of how the clock costs pairs (so a fix exists that pairs correctly AND keeps the dose)?

## What the prototype found: the clock charges a cross-block superset twice

`estimateMinutes` (`packages/strength/session.ts`) declares its `done` set **inside the per-block loop**. A superset
whose halves sit in two blocks (an accessory paired with a core item, which is the normal case for a cross-region pair)
is found once from the accessory block and charged in full, then found again from the core block, where `done` is
empty, and **charged in full a second time**. S10 says *"rest counted once per round"*; the code counts the whole
superset once per block it touches.

- **Live today, without the stride fix:** 160,862 of 545,112 sessions (29.5%) report a duration that an independent
  recount disagrees with: 36.9% of today's supersets cross two blocks. Reported clock use 88.9%, true 84.5%.
- **The held fix makes it worse, which is the whole dose loss:** greedy pairing creates many more cross-block pairs
  (45.9% of 969,610), every one double-charged, so the fill believes the session is fuller than it is. Option A reports
  **90.1%** of the clock used and truly uses **79.0%**. It *looked* fuller and *was* emptier.

## Options prototyped

Branch `proto/strength-pair-stride-01` (worktree `agent-ad191440eaa07a20e`), one module-level seam `PROTO_PAIRING`
(default = shipped behaviour), two switches:

| | Pairing walk | Clock |
|---|---|---|
| baseline | fixed adjacent pairs, `i += 2` (shipped) | `done` per block (shipped) |
| **A** (the held fix) | each unpaired item takes the first later unpaired item of a different region | shipped |
| **C** (clock fix alone) | shipped | `done` per session |
| **B** | greedy, as A | `done` per session |

## Evidence

Command: `npx tsx scripts/strength-pair-stride-proto.ts` (defaults `--cohort-stride 1499 --targeted-stride 187`, both
coprime to their grid, asserted in the script; production input shape, `fitness_level` never set by the script; the
grids are the gates' own). 61 run plans × 288 strength profiles = 16,992 strength plans per mode, **545,112 training
sessions per mode**, compared session by session (0 plans with a different session count in any mode). The "true"
clock is re-derived in the script from S10's constants, independently of `estimateMinutes`.

| Measure | baseline | A (held) | C (clock only) | **B** |
|---|---|---|---|---|
| acc+core items unpaired | 78.1% | 32.9% | 74.8% | **28.5%** |
| unpaired with a non-competing partner available | 60.2% | 0.0% | 60.0% | **0.0%** |
| mean training parts | 5.99 | 4.93 | 6.09 | **5.09** |
| sessions with ≥ 8 parts | 110,543 | 0 | 110,543 | **0** |
| **sets / session** | 15.433 | 14.856 | 15.970 | **16.441** |
| main / accessory / core sets | 5.823 / 4.917 / 4.600 | 5.772 / 4.739 / 4.253 | 5.859 / 5.270 / 4.748 | **5.951 / 5.431 / 4.966** |
| **lower main sets / session** (§7 stress) | 2.230 | 2.199 | 2.206 | **2.233** |
| heavy-legs sessions | 45.3% | 45.3% | 45.3% | **45.3%** |
| sessions with jumps / with upper work | 2.4% / 85.7% | 2.4% / 85.7% | 2.4% / 87.3% | **2.4% / 87.3%** |
| items / session | 6.785 | 6.708 | 6.989 | **7.114** |
| clock used, reported | 88.9% | 90.1% | 87.8% | **87.1%** |
| clock used, **true** (independent recount) | 84.5% | 79.0% | 87.6% | **86.9%** |
| sessions whose reported minutes ≠ recount | 160,862 | 320,205 | 0 | **0** |
| sessions truly over budget | 0 | 0 | 0 | **0** |
| training sessions under 0.9 of clock (reported) | 8,126 | 1,951 | 19,986 | **30,429** |
| per-session sets vs baseline, down / up | | 147,728 / 71,317 | 20,272 / 110,487 | **12,283 / 235,072** |
| largest per-session change | | −8 / +5 | −2 / +6 | **−2 / +6** |
| `validateStrengthPlan` violations | 0 | 0 | 0 | **0** |

Also run: `npx vitest run packages/strength lib/strength-bridge` with the seam's default flipped to B: **504 / 504
pass** (after routing the seam through the package index for `boundary.test.ts`). That is not reassurance: no strength
test recounts the clock independently, and `S-TIME-OVER` / `S-TIME-FILL` read the session's own `estimated_minutes`,
so the double count was invisible to every check. Full `tsc --noEmit` exit 0.

**Not run, deliberately:** `measure:fitness`, `cohort:shape`, `verify:parity`. None of the item's conditions names
them, and the strength engine does not write the run plan (it reads `planToRunContext`); no run-plan field can move.

## Conflict scan

- **S10 (principle)** — *"Accessories and core pair into supersets across regions (rest counted once per round)."* The
  shipped walk breaks the first clause for 60.2% of unpaired items; the shipped clock breaks the second for 36.9% of
  supersets. **B restores both; it amends nothing in the principle's intent.**
- **S10 Am. 4 (fill)** — `FILL_TARGET` 0.95, `FILL_ORDER` accessory → core → main. Untouched. B makes the fill read a
  true clock, so it now reaches its target honestly; the rise in "under 0.9 (reported)" is sessions that were *always*
  under 0.9 and were reported as fuller. `S-TIME-FILL` still fires 0 times: those sessions are at their set caps.
- **S10 Am. 5 (main pairs)** — *"a pair trims and fills as one"*. Main pairs are untouched by both switches (the main
  pair is always inside one block, so the clock defect never reached it). The accessory/core pairs still grow one half
  at a time; that is shipped behaviour and B does not change it.
- **S10 Am. 3 (protected upper)** — upper-work share 85.7% → 87.3%: more full bodies keep their upper movement.
- **S6 (dose)** — per-exercise caps (`ACCESSORY_SETS_MAX` 3, `CORE_SETS_MAX` 3, `MAIN_SETS_MAX` 4) unchanged and
  binding; the rise is sets inside the caps, not past them. **S2 / §7** — lower main sets 2.230 → 2.233 and heavy-legs
  share 45.3% → 45.3%: the stressor the run week is built around does not move. **S8 / §21** — jumps 2.4% → 2.4%.
- **Design Board, 2026-11-04 ruling 4** (2–4 exercises per screen, INSUFFICIENT EVIDENCE pending the part count): the
  number it was waiting on is now **5.09**, not the 4.93 the held fix measured, and 8–9 part sessions go to 0. Routed,
  not ruled here.

No conflicts found that B creates.

## The board

🏃 **Hutchinson (chair).** The 11-04 sitting was right to hold. It was shown a fix that pairs correctly and a dose
that fell, and the fall was real on the screen. What it was not shown is that the fall came from the scales, not the
food. A session the clock says is 90% full and that a recount says is 79% full is not a dose decision, it is a
measurement error, and we nearly priced a trade that does not exist.

📊 **Seiler.** No intensity-distribution question here: the run week is not read by either switch and the lower-limb
load is flat to three decimals. I would only note the units: the rise is sets of accessory and core work, which is
where the time *should* have gone under Am. 4.

🎯 **McMillan.** On a Tuesday this is a runner who picked 45 minutes and was told 45, and did 38. B tells the truth and
then fills it. Parts 5.99 → 5.09 and no 8–9 part sessions is the thing the founder saw on his phone, fixed. I want the
build to keep the reported minutes honest forever; that is what a runner plans their lunch around.

🩹 **Willy.** My condition was *the dose must not fall*. Under B it does not: sets 15.433 → 16.441, core 4.600 →
4.966, and 12,283 sessions down by at most 2 against 235,072 up. The question I now have to ask the other way is
whether a rise is a load spike. It is not on the structure I care about: lower main sets 2.230 → 2.233, heavy-legs
sessions unchanged, jumps unchanged, every set inside S6's caps. **Condition, binding: the sweep carries a dose
ratchet. Sets/session and core sets/session may not fall below the baseline figures above, and lower main
sets/session may not rise more than 0.05 above 2.230, or the build returns to this board.** Option A alone is still
refused: it is the fall I held.

⚕️ **Sims.** The rise is upper and trunk work inside the caps, and upper-work presence rises 85.7% → 87.3%. That is
the direction my Am. 3 dissent asked for, for bone. No objection from this seat.

💪 **Blagrove.** Two points. First, the engine should never claim a session is longer than it is: a strength
prescription whose clock is wrong cannot be progressed honestly, because the runner cannot tell whether they ran out
of time or the plan did. Second, the extra sets land on calf, hip and pulling work and core, exactly what a runner is
usually short of, and none of it is a heavy leg set: that is accessory volume, not a stressor. I would build B. On the
carries: the stride fix does not touch them (both carries are region `core`), so the 11-12 amendment stands on its
own. See the note below.

## ⚡ Recorded disagreements

None on the ruling. **McMillan vs Willy, mild, on the reported "under 0.9" count** (8,126 → 30,429): McMillan reads it
as honesty arriving; Willy wants it watched, because a session at its caps and under its clock means the template is
too short for the length chosen. Settled by: it is not a defect under S10 Am. 4 (the fill stops at the caps by
ruling) and `S-TIME-FILL` fires 0 times. Not filed.

## ⚖️ Ruling

**CORRECT WITH AMENDMENT.** Option **B** ships: greedy cross-region pairing **and** the session-scoped clock, in the
**same commit**. Option A alone is **INCORRECT** (the dose falls, Willy's condition). Option C (clock alone) is a
defect fix restoring S10 and is correct on its own, but it leaves 60.0% of unpaired items strandable; it ships only as
part of B.

## 📦 Build spec (the artifacts)

1. **Principle — `StrengthPrinciples.md` S10 Amendment 6 (STRENGTH-PAIR-STRIDE-01, 2026-11-20).** Text: *"Accessory
   and core items pair across regions by taking, for each unpaired item in session order, the first later unpaired
   item of a different region; a same-region neighbour never strands an item that has a partner later in the session.
   A superset is charged once per session on the clock, wherever its halves sit. **Why.** The fixed-stride walk left
   78.1% of accessory and core items unpaired, 60.2% of them with a partner available; the clock counted a superset
   once per block it touched, so 36.9% of supersets were charged twice and sessions reported 88.9% of their clock
   while using 84.5%. Fixing the walk alone made the dose fall (15.43 → 14.86 sets) because it doubled the cross-block
   pairs; fixed together, sets rise to 16.44, core to 4.97, lower main sets hold at 2.23 and parts fall 5.99 → 5.09
   (measured, 545,112 sessions)."*
2. **Numeric — none.** No constant moves and none is introduced; the change is a pairing rule and a counting rule.
   Stated rather than invented. (`ACCESSORY_SETS_MAX`, `CORE_SETS_MAX`, `MAIN_SETS_MAX`, `FILL_TARGET`, `REST_S`,
   `TRANSITION_S` all unchanged.)
3. **Invariants — two in `packages/strength/validate.ts`, both falsified on this branch's evidence:**
   - **`S-PAIR-STRANDED`** (error): a training session holds no two unsupersetted accessory/core items of different
     regions. Fires on the shipped walk wherever a recoverable pair exists (60.2% of unpaired items are recoverable; the session count was not measured separately), and cannot fire under B (recoverable 0.0%).
   - **`S-CLOCK-RECOUNT`** (error): `estimated_minutes` equals an independent recount that charges each superset tag
     once per session. **It must not call `estimateMinutes`** (a checker sharing the producer is blind). Fires on
     160,862 of 545,112 shipped sessions, 0 under B.
   - Both get arms in `validate.test.ts`'s falsification table and a `**Check:**` line on S10.
4. **Willy's ratchet (binding condition):** the strength sweep gate holds sets/session ≥ 15.433, core sets/session ≥
   4.600 and lower main sets/session ≤ 2.280 on this grid, or the build returns to this board.

**Build notes.** The prototype's greedy walk and the one-line `done` hoist in
`proto/strength-pair-stride-01` are the reference implementation; delete the `PROTO_PAIRING` seam and its index
export when building. `recovery.ts` calls `estimateMinutes` twice and inherits the fix with no change. `sessionParts`
already builds parts across blocks by tag, so display needs no change. Expect duration-baselined strength tests and
any snapshot of `estimated_minutes` to move: that is the defect being removed, and each moved value is a recount.

## `STRENGTH-CARRY-PATTERN-01`: independent, but NOT build-ready

Measured on the same run. Both carries are region `core`, so no pairing walk ever pairs them with each other: **0
sessions in every mode.** The item's 11-20 sweep was right that it does not depend on this fix. Under B, **52,767**
sessions hold both carries; in **22,845** (43.3%) both are standalone parts, and in the other 29,922 at least one carry
is now in a superset with an accessory, so *"two carries back to back"* no longer describes them.

Two spec questions remain that the 11-12 amendment (*"the merge keys on a named exercise set"*) does not answer:
**(1) precedence** (does the merge take the two carries out of the pairing pool before the walk, or apply only when
both end up standalone?), and **(2) the merged part's dose and clock** (rounds = the longer half's sets, rest = the
longer rest, as S10 Am. 5 for main pairs?). Neither needs a prototype; both are a one-paragraph ruling. Build it after
B, on B's walk. **Not filed here.**

## What this does not prove

- Nothing was run on a device; parts and minutes are engine outputs.
- The sample is 61 run plans (coprime strides through both grids) × the full 288-profile strength grid. It is not the
  whole grid; the shipped and held figures reproduce the 11-04 sweep to within 0.1pp (78.1 vs 78.2, 4.93 vs 4.93).
- "True" minutes is S10's own model recounted once per superset. It is a model of a session, not a stopwatch.
- Whether a rise of ~1 accessory/core set per session improves any runner outcome is not measured and cannot be from
  here. The board ruled it safe on load structure and correct under S10, not effective.
- The prototype was not regression-tested beyond `packages/strength` and `lib/strength-bridge` (504 tests) and `tsc`.

## Observed, not filed

- The guided-session and session screens show `estimated_minutes`; until B ships, 29.5% of strength sessions tell the
  runner a duration longer than S10's own model of them.
