# Coaching Board — 2026-09-15

Two questions, ruled in one sitting. Both premises measured before submission.

**Trigger:** `deloadCadence.ts` + `generationConfig.ts` (hard); `ruleEngine.ts` /
`invariants.ts` (soft — prescription changes).

---

## Conflict scan

**Q1** touches **§3** (masters 3:1 cadence), **§87** (a recovery week must not open
a phase; "recovery may RISE, never FALL" — Willy; "never lengthen a loading block
past what the cadence promised" — Sims), and the yield precedent in **§98**.

⚠️ **It does NOT touch §107.** `docs/releases/backlog.md` recorded the DELOAD-POS2-01
§1-yield as "§107". **§107 is "A session may not prescribe work it does not record"
(ZONE-BAND-02, 2026-09-12).** The position-2 rule ruled on 2026-09-14 was never
written as a principle at all — the reverted build took the section number with it.
Corrected here; the new section is **§108**.

**Q2** touches **§8** (Phase 2 — `progressive_tempo` sized by
`PROGRESSIVE_TEMPO_MAIN_MINS`, fitness × phase), **§5** (VO2max adaptation window,
CD-22), and **§22** (`ruleEngine.ts:5500` already records that late swapping breaks
§22).

**Live discrepancy found by the scan.** §8's prose says the invariant enforces that a
session's duration is "internally consistent with its own `derived_set`". For
`progressive_tempo` the CODE does not do that — `progressiveTempoExpectedMainMins`
reads the CONFIG TABLE, because the row carries `{kind:'parameter'}` lengths with no
literal to sum. The swapped session's delivered `derived_set` is 3 x 8 min = 24 min,
which IS internally consistent with its stated 43 min. **The session is not
incoherent; it is carrying the wrong dose for the block it now sits in.**

---

## Q1 — deload phase-position on short masters plans

**Measured premise.** Brute force over every subset of in-scope weeks on real
generated plans: the constraint set {no deload at phase position 1, none at position
2, no adjacent deloads, count never falls, worst loading run never lengthens} is
**UNSATISFIABLE on 1,944 of 3,726 masters plans (52.2%)** and **satisfiable on
3,726 of 3,726 standard plans (0 unsatisfiable)**. D-21 applies.

Root cause of the reverted build: the guard `since === recoveryFreq - 3` degenerates
to `since === 0` when `recoveryFreq === 3` (masters), placing a deload the week
immediately after one just placed (`[3,6] -> [3,4,7]`).

### Ruling — CORRECT WITH AMENDMENT (option A)

The position-2 rule is a **preference that yields when unsatisfiable**, exactly as
§98's onset yields to §1. Where no placement satisfies all five constraints, the
engine keeps the §87-legal placement and leaves `INV-PLAN-DELOAD-PHASE-POSITION` as
a **warn**.

**Adjacency and loading-run lengthening are HARD constraints and may never be
traded.** Option B (lengthen the loading block) rejected — Sims: masters are the
population with the slowest bone and connective recovery, and B removes recovery from
exactly them. Option C (adjacent deloads) rejected — Willy: back-to-back deloads do
not add recovery, they remove a loading stimulus; McMillan: it is §87's own
"plan says progressing, training says nothing is happening" complaint, doubled.

Seiler: no objection from this seat — deload placement moves no session out of the
quality count, so §1 is untouched either way.

---

## Q2 — the V2 adaptation-window swap moves phase-sized sessions without re-sizing

**This REPLACES the filed COHERENCE-SELECT-01 diagnosis, which was wrong.** The
defect is not that §53 selection lacks a coherence guard.

**Measured premise.** `applyV2Vo2MaxOnsetTiming` (ruleEngine.ts:4593-4597) physically
swaps two Session OBJECTS between weeks to meet the §5 adaptation deadline. It
updates only `session.id`. A `progressive_tempo` sized for BUILD (24 min main,
`derived_set` 3 x 8 min, `duration_mins` 43) is relocated into a PEAK week, which
requires 28 min main / ~48 total. `INV-PLAN-STRUCTURED-SESSION-DURATION-COHERENT`
(§8, ERROR) fires on 64 plans in a 2,916-input probe, all `progressive_tempo`,
concentrated at low weekly volume (km=15: 16, km=25: 8, km=40: 0, km=60: 0) because
pool thinness makes it the displaced row.

Latent on `main` only because §79's re-entry window is currently inert. Repairing
§79 (QUALITY-ONSET-ORDER-01) makes the swap fire and surfaces it.

### Ruling — CORRECT WITH AMENDMENT (option A)

A relocated session MUST be re-sized for its new phase. **Amendment: re-sizing goes
through the SAME sizer the constructor uses** (single owner, D-08), inheriting its
existing floor protections — not a bespoke resize path (Willy, Sims).

Option B (decline phase-sized swap candidates) **rejected**: it would make §5's
window unenforceable on exactly the low-volume plans where it fires, and CD-22
already ruled the window binding where reachable.

Option C (retire the swap in favour of construct-compliant placement) is the
**correct long-term direction** and is already documented at `ruleEngine.ts:5500`.
Out of scope here; must NOT be attempted in the same change.

Seiler, for the record: §1 counts SESSIONS plan-wide (CD-19), so changing a
session's duration cannot move the distribution. There is no §1 cost to re-sizing
and none should be invented as a blocker.

---

## Required artifacts

1. **Principle** — new **§108** (deload position-2 preference and its yield);
   **§8 Amendment** (a relocated session is re-sized for its new phase; and the
   invariant's `progressive_tempo` arm checks a CONFIG-derived dose, not the
   delivered `derived_set` — stated so the prose stops claiming otherwise).
2. **Numeric** — `DELOAD_PLACEMENT` extended with the position-2 preference.
   No new numeric for Q2 (reuses `PROGRESSIVE_TEMPO_MAIN_MINS`).
3. **Invariant** — `INV-PLAN-DELOAD-PHASE-POSITION` stays **warn**, with the yield
   documented in its comment; `INV-PLAN-STRUCTURED-SESSION-DURATION-COHERENT` stays
   **error** and passes once the dose is corrected at source.

## SLT escalation

None. Both questions are correctness.

---

# Second sitting, same day — V2-SWAP-S22-01

**Trigger:** `invariants.ts` + `ruleEngine.ts` (soft — changes what reaches a runner).

## Conflict scan

Touches **§79** (intensity re-entry), **§5** (VO2max adaptation window, CD-22),
**§22** (race-specific exposure) and its plan-level partner
`INV-PLAN-RACE-SPECIFIC-EXPOSURE-RATIO`.

**Decisive finding:** §22's per-week check ALREADY exempts three categories —
`isVo2maxSession`, effort-governed rows (§40b) and mixed-anchor rows (§85) — each
justified in the code with the same sentence: *"§22 is NOT weakened… the
plan-level ratio still holds the plan to a race-pace share."* And the failing week
was legal BEFORE the swap **only because a VO2max session sat in it**. §22 already
tolerates a non-goal-pace session in that exact slot.

## Measured premise

Repairing §79 makes §5's relocation fire (it fires on ZERO plans today —
V2-SWAP-INERT-01). The displaced threshold row lands in a §22-governed week:
**288 ERROR violations**, completely homogeneous — 144x 5K + 144x 10K, all
`goal: time_target`, all `intensity_reentry_active`, all
`recent_quality_training: 'regular'`. Visible only because GRID-COVERAGE-02
Phase 1 started varying that field the same morning.

## Ruling — CORRECT WITH AMENDMENT (option B, narrowly)

A session displaced into a §22-governed week **by §5's adaptation-window
relocation** is exempt from §22's per-week naming check, as a fourth exemption on
the same footing as the existing three.

**Binding amendments:**
1. **Structural, never by label or row id** (D-17) — the relocation stamps
   `Session.displaced_by_adaptation_window`, unreachable from `EnrichedWeekSchema`.
2. Exempts **only** the displaced session, only in the week it was displaced into.
3. **`INV-PLAN-RACE-SPECIFIC-EXPOSURE-RATIO` must still pass.** MEASURED at
   ratification: across **576 plans** carrying a displaced session, ratio
   violations **0** and per-week §22 violations **0**. If it ever fails, the
   exemption is void.

**Rejected, not deferred:**
- **§79 yields** — reinstates the defect §79 exists for: a returning runner's
  FIRST quality session at Zone 4-5 (Willy, Sims).
- **§5 yields** — Willy: pushing VO2max later compresses the same dose into fewer
  weeks before the taper, a DENSITY increase for the runner whose tissue is
  already limiting.
- **Swap with a race-pace partner** — MEASURED insufficient: only **144 of 288**
  failing plans have a `race_pace` candidate in the first half (first-half
  quality mix vo2max 288 / race_pace 144, no threshold at all).
- **Retire the swap** — correct long-term direction, out of scope.

## What this sitting did NOT settle, and must not be assumed settled

Implementing the ruling surfaced **two further conflicts** that no ruling covers.
Both are filed and neither was decided here:

- **REENTRY-DEPTH-01.** Reading §79's window in QUALITY weeks instead of CALENDAR
  weeks **re-units a ratified numeric**. `RETURNING_RUNNER_INTENSITY_REENTRY_WEEKS
  = 4` was calibrated where it did nothing; read as quality weeks it withholds the
  first FOUR quality sessions, which on a short 10K plan is most of them and
  removes hill work entirely. D-22: that changes what the numeric MEANS. **Board.**
- **§5 vs §79 precedence at construction.** `vo2MustOpenBuild` forces VO2max to
  open build on plans too short to adapt it otherwise, overriding §79's withhold
  on **576 plans** (5K/10K, both goal types, all `recent_quality_training:
  'regular'`). Arguably already implied by CD-22's "binding where reachable", but
  never ruled. **Board.**

---

# Correction — provenance of the "remaining" items (2026-09-15, after founder challenge)

The three items left open after this session's rulings were presented as new
findings. **They were not.** All three were already recorded in the backlog's
QUALITY-ONSET-ORDER-01 entry before the session began.

- **REENTRY-INV-DECORATIVE-01** — pre-existing. The backlog already said
  `INV-PLAN-RETURNING-INTENSITY-REENTRY` is *"a DECORATIVE invariant… trivially
  true on every plan and cannot fail… the check and the defect share a premise"*,
  with the explicit instruction *"Also fix the invariant, not just the engine."*
- **§5 vs §79 precedence** — pre-existing **and already ruled**. The backlog
  records: *"The board ruled §79 wins that conflict."* It also records that the
  obvious implementation **breaks 29 tests including `cohortShape`** and had
  **zero effect on the residual**. The first filing of this item in this session
  claimed it was "never ruled" — **that was factually wrong and is withdrawn.**
- **REENTRY-VO2MAX-BASELINE-01** — the QUESTION was pre-existing (*"a third
  option is that a finish-goal beginner needs no VO2max at all"*). Only the
  measurement (49.7% / 74.8%) is new.

**Why this matters beyond tidiness.** Re-filing known sub-tasks as fresh
discoveries inflates what a session appears to have found and, worse, discards
the prior work attached to them — in the §5/§79 case a ruling and a measured
failed implementation. The lesson is the repo's own
[[feedback-written-assumptions-are-the-dangerous-ones]]: I wrote "never ruled"
into a backlog entry without checking the backlog's own record of that ruling.

**Check before filing:** `git show <last-commit-before-session>:docs/releases/backlog.md`
and grep the item's own parent entry before creating a new row.
