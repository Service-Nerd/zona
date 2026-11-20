# 🏃 Coaching Board — `STRENGTH-CARRY-PATTERN-01`, 2026-11-20

**Ruling: CORRECT WITH AMENDMENT. The carries merge runs AFTER `STRENGTH-PAIR-STRIDE-01`'s walk and only on carries
the walk left standalone. The merged part runs as many rounds as its longer half and rests the SUM of the two rests,
not the longer one. Clock-neutral by construction; it changes how the session reads, not what it doses.**

Seats: Hutchinson (chair), Seiler, McMillan, Willy, Sims, **Blagrove (seated, strength domain)**.

**Trigger:** soft, qualifies. The build touches `packages/strength/config.ts` and `StrengthPrinciples.md` (hard-trigger
doctrine files) and changes what the strength engine prescribes (a rest and a part structure). Read-only sitting: no
doctrine file was edited here.

## The item, and what was left to rule

- 2026-11-04 (via Collins, Design Board): two carries in one session should read as **one part**, *"a merge not a
  superset"*. Ruled CORRECT; filed, not built.
- 2026-11-12 (`coaching-board-open-items-2026-11-12.md:130`): CORRECT WITH AMENDMENT. There is no `carry` pattern
  (`suitcase_carry` is `anti_rotation`, `farmer_carry` is `lateral_core`), so the merge **keys on a named exercise set**.
- 2026-11-20 `STRENGTH-PAIR-STRIDE-01` sitting (`coaching-2026-11-20-strength-pair-stride-01-prototype.md` § carries):
  independent of the stride fix (both carries are region `core`; 0 sessions pair them with each other in any mode), but
  two spec questions unruled: **(1) precedence** against the pairing walk, and **(2) the merged part's rounds and rest.**

This sitting rules those two and names the artifacts. It reopens nothing ruled before.

## Analysis (before any seat)

### Re-derived figures

Script: `/private/tmp/claude-501/-Users-russe-rts-training-hub/a8319fbc-b45c-4f4c-b30b-ad88b3e1bc09/scratchpad/carry/carry-evidence.ts`
(scratchpad, read-only; it imports `PROTO_PAIRING`, which exists only on the prototype branch, so it cannot live in
`scripts/` on `main` without breaking `tsc`). Run from the prototype worktree:

```
cd .claude/worktrees/agent-ad191440eaa07a20e   # proto/strength-pair-stride-01 @ 659bde67, clean
npx tsx --tsconfig ./tsconfig.json <scratchpad>/carry/carry-evidence.ts
```

Same input selection as `scripts/strength-pair-stride-proto.ts` (cohortGrid stride 1499, targetedGrid stride 187,
full 288-profile strength grid), mode **B** only. It generates sessions and post-processes them; it changes no engine
code.

| Measure (option B) | Prior sitting | Today |
|---|---|---|
| training sessions | 545,112 | **545,112** |
| sessions holding both carries | 52,767 | **52,767** |
| both carries standalone parts | 22,845 (43.3%) | **22,845 (43.3%)** |
| at least one carry in a superset with an accessory | 29,922 | **29,922** |
| carries with equal sets (all / standalone) | not measured | **51,631 / 52,767 · 21,905 / 22,845** |
| farmer/suitcase sets | not measured | 1/1 14,279 · 2/2 10,739 · 3/3 26,613 · **2/3 1,136** |

A carry's partner under B is always a different region: hip abduction (cable 7,087, banded side step 3,974), presses
(floor 3,383, bench 3,351, half-kneeling 2,136), rows/pulls (single-arm row 2,455, lat pulldown 2,112, band row 1,776,
table row 744, prone YTW 1,896, band pull-apart 1,008), calf (1,568 + 1,536 + 59).

### The two precedence options, measured

**P2: merge after the walk, only when both carries are standalone** (exact by post-processing, because with the
rest rule below the merge does not change the clock the fill reads):

- touches **22,845** sessions; training parts there **6.520 → 5.520**;
- with rest = **sum** of the two standalone rests: clock unchanged in **21,905**; the **940** with unequal sets move
  by at most **1.000 min** (the clock charges a superset's longer half for both works); **0** sessions over budget
  after (0 before);
- with rest = **longer** (S10 Am. 5's main-pair rule): the merge removes **1.025 min** of rest per session on average,
  i.e. one carry's 30 s rest per round.

**P1: merge first, carries leave the pairing pool** (static estimate: the remaining pool re-walked with B's greedy
rule; the over-budget trim and fill were **not** re-run, so the fill's reaction is not measured):

- touches **29,922** sessions; parts **5.281 → 4.788**;
- breaks **15,196** non-competing accessory/core supersets (net);
- leaves **more** stranded non-carry items in **12,033** sessions;
- raises the clock in **12,229** sessions (mean +0.526 min) and puts **2,622** over budget, which in the engine means
  S10's over-budget trim drops accessories: the dose Willy's ratchet protects.

### Settled-ground / conflict scan (sections and amendments)

- **S10 principle.** *"Accessories and core pair into supersets **across regions**"*: the carries merge is same-region
  by definition. It is not that rule's superset; it is an exception by name and must say so. *"**never shorten
  rest**"*: binding on question (2). It forbids Am. 5's longer-rest rule here, because the merge drops one carry's
  rest per round.
- **S10 Am. 5** (main pairs): longer rest is right there because the halves do not compete (legs rest while the upper
  lift works). Carries compete on grip and trunk, so the premise of the longer-rest rule does not hold. Not a
  conflict: a different case.
- **S10 Am. 4** (fill, `FILL_TARGET`, `FILL_ORDER`): untouched. With summed rest the merged part costs what the two
  standalone parts cost, so the fill reads the same clock.
- **S10 Am. 6** (STRENGTH-PAIR-STRIDE-01, to land first): the walk's pairing of a carry with an accessory is the S10
  superset working as designed. P1 would undo it in 29,922 sessions.
- **S6** (caps): `CORE_SETS_MAX` 3 unchanged; no set is added or removed by the merge.
- **S11 / `S-CORE-DOSE`**: counts core exposures per session; a merge cannot move it.
- **S13** (recovery ease, `recovery.ts`): it drops items and untags a lone superset half. A carry left alone must go
  back to its own rest. Build note below.
- **D-17 / `INV-CLASS`** (the 11-12 worry): an exercise **id** is a stable identifier, not a display label. Keyed on a
  named id set in config and checked against the catalogue, it is not label matching.
- **Design Board 2026-11-04 ruling 4** (2–4 exercises per screen, waiting on part count): this moves mean training
  parts by 22,845 / 545,112 = **0.042** (derived from the counts above, not separately measured). Routed, not ruled.

No conflicts with the recommended form. P1 conflicts with S10's own cross-region pairing in 29,922 sessions.

### What the evidence can and cannot show

It can show the structure: who is touched, parts, clock, rest. It cannot show the fill's reaction to P1 (static
only), any runner outcome, or how a carry medley feels to do. Nothing ran on a device.

## The board

🏃 **Hutchinson (chair).** We are asked two small questions, and the measurements answer both. Take the carries out
first and you break an accessory superset in half the sessions you touch to build a part made of two things that
compete for the same grip. Merge only what the walk left behind and nothing else moves. The engine's own rule
already says what to do with two lifts that compete for rest: do not shorten it.

📊 **Seiler.** No intensity-distribution question. The run week is not read. No objection from this seat.

🎯 **McMillan.** On a Tuesday: a runner who sees *Farmer carry* as Part 6 and *Suitcase carry* as Part 7 walks the
gym twice with the same dumbbells. A medley (farmer down, suitcase back, a minute off) is how anyone coaches it. Six
and a half parts to five and a half in the sessions it reaches is the finding Collins raised, fixed where it still
exists. I would not take an accessory off a carry to get there: a calf raise between carries is time well spent.

🩹 **Willy.** Two conditions. **First, rest is not shortened.** Back-to-back carries load the grip and the trunk
twice with no break between; folding two 30 s rests into one 30 s rest takes a minute of recovery out of the session
and calls it tidiness. The sum keeps the total. **Second, the dose does not move.** P1 puts 2,622 sessions over the
clock before the trim runs, and the trim drops accessories: refused. Under P2 the clock is unchanged in 21,905 of
22,845 and at most a minute in the rest, with none over. **Binding: the build re-runs the STRENGTH-PAIR-STRIDE-01
sweep with the merge on and holds that sitting's ratchet** (sets/session ≥ 15.433, core sets/session ≥ 4.600, lower
main ≤ 2.280), and reports sets, core and lower main against B's 16.441 / 4.966 / 2.233 to three decimals. A fall
in core sets/session below B's is declared with its count, not absorbed.

⚕️ **Sims.** Loaded carries are whole-body, upright, weight-bearing work; for bone that is the right thing to keep and
nothing here removes it. No objection.

💪 **Blagrove.** My 11-12 error was naming a pattern that does not exist; the honest key is the two exercise ids,
named once, in config, checked against the catalogue so a rename fails loudly rather than switching the merge off.
On (1): a carry superset with a hip abduction or a row is a better use of the rest than a second carry, so the walk
goes first and the merge is what is left. On (2): rounds are the longer half, as for every superset this engine
builds, and the rest is the sum: a medley is done continuously, so the recovery that used to sit between the carries
sits after the round. I would not rule the order inside the part; farmer first is common, but both are moderate
loads at 30 s and nothing in the evidence turns on it. Block order stands.

## ⚡ Recorded disagreements

None on the ruling. **McMillan vs Blagrove, mild, on in-part order** (McMillan: farmer first, heavier while the grip is
fresh; Blagrove: not worth a rule). Settled by the chair: not ruled; block order stands. What would change it: a
device report that runners find the order confusing (Design Board's question, not this one).

## ⚖️ Ruling

**CORRECT WITH AMENDMENT.**

1. **Precedence: P2.** The merge applies **after** S10 Am. 6's pairing walk, and **only** when every carry in the
   named set is in the session and none of them was paired by the walk. A carry the walk paired with an accessory stays
   in that superset. **P1 (carries leave the pool first) is INCORRECT:** it breaks 15,196 non-competing supersets
   S10 asks for and puts 2,622 sessions over the clock before the trim (Willy's dose condition).
2. **Rounds and rest.** The merged part runs as many **rounds as its longer half** (as every superset in this engine,
   and as `sessionParts` already counts). It **rests the sum** of the two carries' standalone rests (`REST_S.core` × 2
   = 60 s after the round, none between the carries), **not the longer of the two**: the carries compete on grip and
   trunk, and S10 says never shorten rest. Fill and trim are unchanged: the carries fill and drop as they do today,
   one at a time in `FILL_ORDER` and by slot priority, and when either leaves the session there is no merge.
3. The merged part is **one part, done as a medley**. It uses the existing superset tag as its data shape; it is not
   S10's cross-region superset and is excused from that clause by name.

## 📦 Build spec (the artifacts, one commit, after STRENGTH-PAIR-STRIDE-01 lands)

1. **Principle: `StrengthPrinciples.md` S10 Amendment 7 (STRENGTH-CARRY-PATTERN-01, 2026-11-20).** Text: *"The
   carries in `CARRY_MEDLEY` are one part when the session holds all of them and the pairing walk (Am. 6) has paired
   none: done back to back as a medley, as many rounds as the longer half, then the **sum** of their rests, never the
   longer, because both load the grip and the trunk and S10 never shortens rest. The walk goes first: a carry paired
   with an accessory stays paired. Fill and trim are unchanged. **Why.** Two carries printed as two parts was a
   taxonomy the engine did not mean (Design Board, 2026-11-04); there is no carry pattern, so the set is named by
   exercise id (2026-11-12). Merging first breaks 15,196 cross-region supersets and puts 2,622 sessions over the clock;
   merging after touches 22,845 sessions, takes their parts 6.52 → 5.52, and leaves the clock unchanged in 21,905 and
   within a minute in the rest (measured, 545,112 sessions). **Check:** `S-CARRY-MEDLEY`."*
2. **Constant: `CARRY_MEDLEY: ['farmer_carry', 'suitcase_carry']`** in `packages/strength/config.ts` (`STRENGTH_CONFIG`).
   A named exercise set, not a numeric; `strengthConfigSync.test.ts` requires S10 Am. 7 to name it in backticks. Plus
   a `catalogue.test.ts` arm: every id exists in the catalogue, is `measure: 'seconds'`, and is region `core` (a
   rename or a re-region fails loudly instead of disabling the merge).
3. **Invariant: `S-CARRY-MEDLEY`** (error) in `packages/strength/validate.ts`. It reads the set from config but
   recomputes everything else itself (never calls the producer):
   - **(a) missing:** a training session holding every `CARRY_MEDLEY` id, none in a superset with a non-carry item,
     and they do not share one tag;
   - **(b) shape:** a tag shared by a carry with another carry holds exactly the `CARRY_MEDLEY` ids and nothing else;
   - **(c) rest:** each merged carry's `rest_s` equals the sum of the members' own rests (`REST_S.core` × 2); a lone
     carry's equals `REST_S.core`;
   - **(d) precedence:** a medley coexists with no unsupersetted accessory item (under B's walk an unpaired accessory
     would have taken a standalone carry, so its presence beside a medley means the merge ran first). ⚠️ An accepted
     recovery ease (S13) drops items and un-tags without re-walking, so it can leave an accessory unpaired beside a
     correct medley: (d) takes the same recovery exemption `S-PAIR-STRANDED` takes, and the build confirms it with a
     recovery case in the falsification table.
   - Arms in `validate.test.ts`'s falsification table. Expected on B without the merge: (a) fires on 22,845 sessions;
     with a longer-rest merge, (c) fires on the same 22,845. (d) on a merge-first mutation: **not measured**; the
     build measures it. A `**Check:**` line on S10.
4. **Willy's condition (binding):** the STRENGTH-PAIR-STRIDE-01 sweep, re-run with the merge, holds its ratchet
   (sets ≥ 15.433, core ≥ 4.600, lower main ≤ 2.280) and the build reports sets / core / lower main against B
   (16.441 / 4.966 / 2.233). A fall in core sets/session below B is declared with its count, or the build returns.

**Build notes.** Do the merge inside `assemble`, immediately after the pairing walk, so every over-budget and fill
pass re-derives it (a carry dropped by the trim simply leaves no medley). Write the summed rest onto both items, as
Am. 5 writes the longer rest onto both mains; `estimateMinutes`, the independent `S-CLOCK-RECOUNT` and `sessionParts`
then agree with no change (they charge a tag once with its largest `rest_s`). **`recovery.ts` must reset a carry it
un-tags to `REST_S.core`**, or (c) fires. `partnerOf` (main pairs only) is not extended: the fill grows the carries one
at a time as it does every accessory/core superset.

## Hand-offs

- **🧭 Design Board:** what the merged part is called and how a medley round reads in the guided session (continuous,
  rest after the round); and ruling 4 (2–4 exercises per screen), whose part count moves by about 0.04. Encoding is
  design's; any label copy is the founder's. Not ruled here.

## What this does not prove

- P1's figures are static: the trim and fill were not re-run, so its true dose effect is not measured. It is refused
  on structure (broken supersets, sessions over the clock), not on a measured dose fall.
- P2's "clock unchanged" is exact only for the rest rule ruled here and equal sets; the 940 unequal-set sessions move
  ≤ 1 min, and how the fill reacts to that minute is not measured (the build's sweep measures it).
- Measured on the prototype branch under B, not on `main`. The figures hold only once STRENGTH-PAIR-STRIDE-01 lands.
- Nothing ran on a device; whether a 60 s rest after a carry medley is enough for a recreational runner's grip is a
  coaching judgement, not a measurement.
- No runner outcome is measured or claimed.

## Observed, not filed

- The 940 standalone carry pairs with unequal sets (2/3) show S10's clock charges a superset's longer half for both
  works, over-counting the shorter half's missing round. That is how every accessory/core superset is charged today,
  not something this item introduces.
