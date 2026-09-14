# Coaching Board — §25 Amendment 1 (race-pace segment dose)

**Date:** 2026-09-14
**Type:** **VERIFICATION SITTING** on an already-shipped change (`c77e6f7`, deployed).
**Trigger:** `sessionCatalogueData.ts`, `generationConfig.ts`, `CoachingPrinciples.md` — hard. `ruleEngine.ts`, `sessionComposer.ts` — soft, qualifies (changes what the runner is told to run).
**Outcome:** the earlier sitting is **overturned in part**. Its gate ruling stands; its percentage ruling does not.

---

## Why this sitting happened

The founder asked whether a coaching review had been run. It had not — not properly. RACE-PACE-OVERLAY-REACH-01 was ruled **inline**, following the board's format from memory, without invoking the skill. The write-ups were honest about being write-ups; the sitting itself skipped the one step the skill calls mandatory.

**The conflict scan found the error in minutes.**

---

## 🔍 Conflict scan

| § | Relationship |
|---|---|
| **§25** | **The governing section, and the one the earlier sitting never read.** "Race-specific long run (HM and marathon, time-targeted)" ratifies *"The segment is the final 25–40% of the long run (the runner is already aerobically tired when they hit goal pace, simulating the late-race state)"*, citing Daniels and Pfitzinger. The rows' 35 and 40 sit inside it. |
| §16 | The universal run format. Its "20% of session time… HM and MARATHON only" is the **general default**; §25 is the specific principle for this session and overrides it. Not a contradiction once the hierarchy is stated — but it was never stated, which is how 20% won by accident. |
| §5 | Specificity. Peak is 60% specific. A 16%-of-the-run race-pace dose on the plan's single most race-specific session undercuts it. |
| §107 | `lr_segment_pace` records the segment's PACE. It never recorded the segment's SIZE, which is why the size survived only as prose. |
| §47 | Step-back weeks strip the row and the segment; unaffected, re-measured at 0. |
| §24b | The 5K/10K three-part long run states two segments in its own notes and is governed by `LR_5K10K_PEAK_*`. The new check reads only `^Final N% at ` notes, so it does not reach it. |
| §24e | Ultra carries no segment. Unaffected, re-measured at 0. |
| §1 | Untouched — session counts, plan-wide (CD-19). A longer segment inside one session cannot move it. |
| §19 | Label integrity. The session is named for its race pace and now delivers a dose consistent with that name. |

---

## What was measured

Three live answers for one segment, on a 165-minute marathon peak long run:

| Source | Says | Minutes at MP | Inside §25's 25–40%? |
|---|---|---|---|
| Catalogue row `mp_long_run` | `race_pace_pct: 40` | 66 | ✅ (at the ceiling) |
| Coach note, hand-typed at the call site | *"Final 30–50% at MP"* | 50–83 | ❌ **breaches the ceiling** |
| `composeSession` (session card) | *"20%"* of the MAIN set | 27 (**16% of the run**) | ❌ below the floor |

**Two of those rendered on the same card.** On HM: note *"Final third at HM pace"* against structure row *"20%"*.

---

## The board

**Hutchinson (chair).** I ruled this morning that the rows' percentages "were never a principle". §25 is a principle, it is titled for this exact session, and it ratifies 25–40% with the mechanism spelled out. That was not a close call I got wrong; it was a section I did not read, because the scan that would have put it in front of me was skipped. The substantive ruling is straightforward: **§25 governs, §16 is the default it overrides, and the rows are the per-distance encoding.** The wider lesson goes in the constitution: **an unread number is not automatically a wrong one.** "Read by nothing" is evidence that a consumer is missing, not evidence that the value is junk — and deleting on that basis destroys ratified doctrine while looking like tidying.

**Seiler.** No objection. §1 counts sessions; this cannot move the distribution. Worth noting the direction: a prescribed block at a named pace target on tired legs is the opposite of grey-zone accumulation. Delivering 16% where 35–40% was ratified was not a safety margin, it was a session quietly losing its stimulus.

**McMillan.** The card contradicted itself, and that is the part I care about. A runner reads *"Final third at HM pace"* in the note and *"20%"* in the structure block and has to pick one on a Sunday morning, alone, ninety minutes in. They will pick whichever they remember, which means the plan stopped being the authority. Deriving both from one field is the fix; the size of the number is secondary to the two of them agreeing.

**Willy.** My position from this morning is unchanged in substance and changed in relevance. 66 minutes at marathon pace inside a 165-minute long run is a genuinely large dose, and at the 191-minute extreme it is 76. But I was objecting to it as though it were **new load being added**, and it is not: the coach note has been prescribing "Final 30–50% at MP" all along. The runner was already being told to do it. What changed today is that the card stopped understating it. Given that, and given §25 is ratified, I do not veto. **I want my guard on the record:** the dose is a percentage, so it scales with the longest sessions, and I would prefer an absolute minutes ceiling on top. That is new doctrine and belongs to its own sitting — §24's `LONG_RUN_CAP_MINUTES` already bounds the session the percentage is taken from, so the exposure is capped, if loosely.

**Sims.** My binding point from this morning holds and is now correctly implemented: the HM runner is told **HM**, not MP. One addition — the note said *"at MP pace"*, which expands to "at marathon pace pace"; MP and HM already contain the word. Fixed. On the dose itself: 40% of a long run at marathon pace on a peak week is a significant carbohydrate demand, and this is the session where under-fuelling shows up first for the women and masters runners in this cohort. It is not an argument against the dose — it is an argument that §24e's fuelling logic should eventually reach the HM/marathon race-specific long run too, not only the ultra. Flagged, not blocking.

---

## ⚡ Recorded disagreements

**Willy vs the ruling, on the ceiling.** He would add an absolute minutes cap to the percentage. The board declined to add one here because it would be new doctrine rather than a reading of §25. What would change the board's mind: evidence of injury or non-completion clustering on peak race-specific long runs at the top of the band. Nothing in the data today speaks to it.

---

## ⚖️ Ruling — CORRECT WITH AMENDMENT (overturning this morning's percentage ruling)

1. **`main_set_structure.race_pace_pct` is restored and is the SINGLE OWNER** — HM 35, MARATHON 40. Read by the coach note and the session card alike. `easy_pct` stays deleted: it was a second way of stating the complement and could drift from it.
2. **The percentage is OF THE LONG RUN**, as §25's words say — not of the main set. The structure block's parts now sum to the session.
3. **The hand-typed note strings are deleted.** `'Final 30–50% at MP'` and `'Final third at HM pace'` were literal arguments at the call site. A coaching number inside prose is a number no check can see, which is exactly how "30–50%" outlived §25's own ceiling.
4. **§16 is amended** to record that it is the general default and §25 overrides it for this session.
5. The gate ruling from this morning (catalogue row, not label substring) **stands unchanged**.

### 📦 Artifacts

1. **Principle** — §25 Amendment 1 (and the §16 cross-reference).
2. **Numeric** — `GENERATION_CONFIG.LR_RACE_SEGMENT_PCT_MIN` (25) / `LR_RACE_SEGMENT_PCT_MAX` (40), plus the per-row `race_pace_pct`.
3. **Invariant** — `INV-PLAN-LR-RACE-SEGMENT-PCT` + `plan-invariants.md` row. It reads the percentage **the session's own note states**, not a recomputation from the row: a checker that re-derives the producer's input races it rather than checking it. Proven wakeable by a new liveness mutation (`inflate race segment pct`).

### ↗️ SLT escalation

None. Not a commercial question.

### Verification

- `npm run verify` — exit 0, **1780 tests / 198 files**; sweep 0 hard failures, 0 violations; `cohort:shape` unchanged.
- `npm run verify:parity` — **540 of 5,832 cases changed, and the blast radius is exactly what §25 predicts**: HM 324/972 and MARATHON 216/972, `time_target` 540 / `finish` 0. 5K, 10K, 50K and 100K are **0**. Golden snapshots show the per-plan delta is the two note strings and nothing else.
- Card coherence re-measured: HM note *"Final 35% at HM: 4:59 /km."* against structure row *"35%"*; marathon *"Final 40% at MP: 5:20 /km."* against *"40%"*.
