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
