# Coaching Board — RACE-PACE-OVERLAY-REACH-01

**Date:** 2026-09-14
**Trigger:** `lib/plan/sessionFormat.ts` (hard), `lib/plan/sessionCatalogueData.ts` + `docs/canonical/session-catalogue.md` (hard), `lib/plan/sessionComposer.ts` (soft — qualifies: it changes what the runner is told to run)
**Found by:** CONFIG-CONSUMER-01, extending the consumer scan to `SESSION_FORMAT`.

**Proposed change (one sentence).** Gate the peak race-pace long-run overlay on the catalogue row's declared shape rather than a substring of the session's name, so the HM half of §16's declared scope actually reaches a runner, and resolve the conflict between §16's 20% and the rows' 35/40%.

---

## What was measured, before any of it was argued

`SESSION_FORMAT.LONG_RUN_PEAK.race_pace_distances = ['HM', 'MARATHON']` was declared, ratified, documented in §16 — and **read by no product code**. The actual gate in `composeSession` was:

```ts
isMpLong = isLong && session.label.toLowerCase().includes('marathon-pace')
```

The two catalogue rows are named **"Marathon-pace long run"** (`mp_long_run`) and **"Long run with HM-pace finish"** (`hm_pace_long_run`). Only the first contains that substring.

Run through the real display path (`scripts/measure-race-pace-overlay-reach.ts`, 30 plans, peak non-deload race-specific long runs):

| distance | declared in `race_pace_distances` | sessions | render the overlay |
|---|---|---|---|
| **HM** | YES | 18 | **0 (0.0%)** |
| MARATHON | YES | 12 | 12 (100.0%) |

The HM runner's key peak session — the one whose stated purpose is *"race pace on legs that are already tired"* — rendered as a plain easy run. It was invisible because the card simply looked calm; nothing was missing from the screen, the work was just absent from it.

**Second unread fact.** The two rows declare their own split (`easy_pct: 65, race_pace_pct: 35` for HM; `60/40` for MP) against §16's flat 20%. Nothing read either row value. On the measured sessions:

| | shipped (§16, 20% of main) | row-declared |
|---|---|---|
| HM mean (127 min session) | 20 min | 35 min |
| MARATHON mean (158 min) | 25 min | **50 min** (63 if of session) |
| MARATHON longest (191 min) | 31 min | **61 min** (76 if of session) |

**Third unread fact.** `race_pace_zone` ('MP' / 'HM') was declared per row and read by nothing; the card hardcoded the words *"MP target"* for every case.

---

## Conflict scan

| § | Relationship |
|---|---|
| **§16** | **The governing section.** "Marathon and half-marathon long runs in peak phase add a race-pace segment… 20% of session time at race pace, peak phase, HM and MARATHON only." The code honoured neither the distance scope nor the ownership of the percentage. |
| §17 | "Every field is authority, superseded, committed, or gone." Already binds the row fields; this applies it. |
| §19 / ADR-018 | Re-keying off the row and away from the label is §19's own documented direction of travel (SC-08: *"re-key this check on the structural category"*). D-17. |
| §47 | Step-back peak long runs must NOT carry the overlay. §47 strips label, zone, `lr_segment_pace` **and** `catalogue_id`, so both the old and the new join fail. Measured: 30 step-back long runs, 0 overlays. |
| §24b | The 5K/10K three-part segmented long run (easy → MP → HM finish) is built inline with **no catalogue row** and must not be flattened into this two-part shape. Measured: 198 5K + 198 10K long runs, 0 overlays. |
| §24e | Ultra long runs carry no pace overlay. Measured: 342 50K long runs, 0 overlays. Also guarded by `INV-PLAN-ULTRA-NO-PACE-SEGMENTS`. |
| §1 | Untouched. §1 counts **sessions**, plan-wide (CD-19) — lengthening a segment inside one session cannot move it. |
| §107 | `lr_segment_pace` is the recorded segment pace; five invariants govern it and one says the point of recording it is that otherwise *"nothing downstream can check or render them"*. Nothing rendered it. Now the card quotes it. |

---

## The board

**Hutchinson (chair).** §16 is the ratified authority and it is unambiguous: 20%, HM and MARATHON. The rows' 35/40 were never a principle — they are row metadata with no reasoning attached, which have never governed anything. Raising the marathon MP block from 25 to 50–63 minutes on the strength of a field nobody reads would be making a coaching decision by accident of registry tidying, which is the precise failure mode §93 exists to name. **§16 governs.** The row percentages are superseded and must stop being declared as though they were authority.

**Seiler.** No objection on distribution. §1 counts sessions, so this cannot move the ratio. Worth saying the obvious thing though: a prescribed block at a named pace target is the *opposite* of grey-zone drift. Giving the HM runner an explicit race-pace segment replaces an unstructured hour with a structured one.

**McMillan.** The HM case is the one that matters. A session titled "Long run with HM-pace finish" whose breakdown showed an entirely easy run is worse than a missing feature — the name and the card disagreed, and the runner resolves that by guessing. They either ran it easy and lost the session, or invented their own finish and ran it too hard. Fix it.

**Willy.** I reject the rows' 40% outright. On the measured mean peak long run that is 50–63 minutes at marathon pace, and 76 on the longest — a marathon-pace tempo bolted onto a three-hour run in the heaviest week of the plan, prescribed to runners whose floor on that row is merely `intermediate`. That is a classic peak-week injury setup. §16's 20% (25 min mean, 31 max) is a defensible race-pace dose on tired legs. For HM going 0 → 20 min: accepted, peak-phase only, `fitness_level_min: 'intermediate'`, and **§47's step-back guard binds** — the overlay must never appear on a step-back week. Confirmed by measurement, not by reading.

**Sims.** No sex-specific objection to the dose. One binding point on the copy: once HM receives this, the card must say **HM**, not MP. A woman training for a half being told to hit "MP target" on her key session is being handed the wrong number on the one session where the number is the whole point. The row already declares `race_pace_zone`. Wire it or the fix is half-done.

---

## Recorded disagreements

None material. Hutchinson and Willy converge independently on rejecting 35/40.

---

## Ruling — CORRECT WITH AMENDMENT

1. The gate moves from the session **label** to the catalogue row's declared `main_set_structure.type === 'long_run_with_segment'` (ADR-018 / D-17). HM receives the overlay.
2. **§16's 20% governs.** The rows' `easy_pct` / `race_pace_pct` are **superseded and removed** from `hm_pace_long_run` and `mp_long_run` — §17's rule: a declared-and-unread field looks identical to a working one, so the catalogue must not carry a second, contradicting number.
3. `race_pace_zone` becomes **authority**: the card quotes the row's own word for the pace.
4. The pace quoted is the session's recorded `lr_segment_pace` (§107), falling back to plan goal pace for plans generated before it.
5. `race_pace_distances` is **superseded** by the rows' `distance_eligibility`, which is what now enforces the scope. Kept as §16's readable statement of scope and registered as such.

**§16's "20% of session time" vs the code's 20% of the main set was examined and deliberately NOT changed.** The UI renders the segment as a bare `20%` with no referent, so the distinction is invisible to the runner, and changing it would move the marathon block 25 → 32 min for no visible gain. Recorded here so it is not re-found as a defect.

### Artifacts

1. **Principle** — §16 Amendment 1.
2. **Numeric** — no new numeric. `SESSION_FORMAT.LONG_RUN_PEAK.race_pace_segment_pct` is confirmed as the sole owner; two competing row values were deleted.
3. **Mechanical check** — `lib/plan/racePaceOverlay.test.ts` (11 cases: both distances reached, the copy quotes the row's zone, and the three negative guards — no row, §24b's three-part long run, §47's step-back). **Not a `validatePlan()` invariant, deliberately**: this is a display-boundary rule over a session the validator has already passed, so there is no plan property to assert. `INV-PLAN-LR-SEGMENT-RECORDED` already guards the generation side.

**SLT escalation:** none. Not a commercial question.

### Verification

- `npm run verify` — exit 0, 1777 tests / 198 files.
- `npm run verify:parity` — **IDENTICAL, 5832 cases**. Generation is provably unaffected; this is a display-path change.
- Reach after the fix: **HM 18/18, MARATHON 12/12**. Guards: 30 step-back, 198 5K, 198 10K, 342 50K long runs — **0 overlays**.
