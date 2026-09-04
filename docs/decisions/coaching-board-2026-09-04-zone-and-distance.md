# Coaching Board — 2026-09-04 (second sitting)

**Displayed HR band · quality-session distance**

Convened from a founder screenshot of a live Session Detail card. Both questions
are the same shape: **a number the runner plans against, contradicted by another
number the system also believes, on the same screen.**

**Trigger:** `CoachingPrinciples.md`, `generationConfig.ts` — hard. Q2 revisits a
2026-09-03 ruling.

**Founder constraint (standing):** assess every ruling across all six race
distances and the full input space, and propagate rather than scope to the
surfacing case.

---

## 1. What was on the card

```
HOLD THE ZONE
Zone 3–4 · threshold
145–172 bpm                     ← header, derived from session.zone

Kit — YOUR COACH
Hold 145–158 bpm for the whole  ← coach card, {{session_hr}} from hr_target
interval.

SESSION STRUCTURE
WARM-UP  ~3km · Z1→Z2           ← 33% of an inflated 10 km headline
DISTANCE 10 km                  ← the session's own steps sum to ~8.4 km
```

Three numbers on one card, two of them wrong, none of the components at fault.

---

## 2. Conflict scan

**§84 asserted the very consistency that was broken, and did not check it.** Its
Config paragraph read:

> *"The engine already writes `session.zone` and `session.hr_target` together **and
> consistently** in every `makeQualitySession` branch (threshold →
> Zone 3–4/qualityHR; VO2 + hills → Zone 4–5/intervalsHR), so this principle
> changes only what the display reads, not what the engine prescribes."*

The pair it names is the pair that disagreed: `qualityHR` is `z3Low–z3Top` —
**Zone 3 only**. The VO2 pair in the same sentence *is* consistent. **True for one
half, assumed for the other**, and the display was then rebuilt on the assumption.

**§84 created the visible contradiction.** Before `4646b08` the header read
`getSessionHRDisplay(session.type, session.hr_target, …)` — the same field the
coach note reads. They agreed. The data inconsistency long predated §84; the
contradiction *on screen* was hours old.

**§19 gives the direction of travel.** *"If the engine cannot satisfy the label
given the runner's VDOT, it MUST rename the session to one the prescription does
satisfy."* The label follows the prescription, never the reverse.

**§84's own amendment already answered Q1** and was not implemented: *"range drawn
from main-set work steps only (Seiler — never blur into the recovery jogs)."*
The implementation used the zone string's full Karvonen span, which blurs across
the whole band — the same error one level up.

**§1 → Q2: no conflict.** Intensity distribution counts sessions (CD-19), so a
distance change cannot move it. **§12 → no conflict** — Zone 2 renders `< 145`
identically from both fields. **§40b Amendment 2 (same day) → direct precedent
for Q2.**

---

## 3. Evidence, taken before any seat spoke

**Q1 — zone string vs `hr_target`, as the screen renders them:**

| | 5K | 10K | HM | MAR | 50K | 100K |
|---|---|---|---|---|---|---|
| mismatched | 10.1% | 9.3% | 14.8% | 14.2% | 12.7% | 13.8% |

`Zone 3–4` (579 sessions) and `Zone 2–3` (48 long runs) mismatch; `Zone 4–5` (75)
and `Zone 2` (4,176) are consistent.

**Q2 — stated vs actually covered:**

| dist | sessions | stated | honest | overstated | worst single session |
|---|---|---|---|---|---|
| 5K | 78 | 791 km | 629 km | **25.7%** | stated 10 km vs ~6.9 |
| 10K | 66 | 652 km | 528 km | **23.5%** | stated 9.5 km vs ~6.8 |
| HM | 60 | 494 km | 443 km | 11.4% | stated 7 km vs ~5.8 |
| MAR | 114 | 985 km | 827 km | 19.1% | stated 16.5 km vs ~9.3 |

**Q2 blast radius, measured before writing any code** — and the first run was
*wrong*: re-summing `weekly_km` from `distance_km` zeroed duration-primary easy
runs and reported a 36% mean drop. Corrected to adjust by the quality delta only:
414 sessions resized, **0** below the quality floor, weekly change mean 0.8% /
max 7.1%, and **3** `INV-PLAN-PEAK-OVER-BASE`.

---

## 4. Rulings

### Q1 — CORRECT WITH AMENDMENT — shipped `3b9280a`

**`hr_target` is authoritative; `session.zone` is derived from it, never authored
beside it.** Two fields written independently will drift, and they did — silently,
until §84 put them on one screen. The threshold string becomes **"Zone 3"**,
because `qualityHR` *is* Zone 3. §1's grey-zone framing does not forbid it: §1
governs *easy* runs drifting into Z3, not threshold work prescribed there.

- **Amendment 1 — no prescribed heart rate changes.** A relabel. Say so in the
  principle or a future reader mistakes it for a de-load (Willy). Confirmed by the
  goldens: 41 lines, all `"Zone 3–4"` → `"Zone 3"`, nothing else.
- **Amendment 2 — §84's Config paragraph is corrected, not merely superseded.** It
  asserted a consistency it did not check, and that assertion is why the display
  was rebuilt on the wrong field. The correction is the useful artifact.

**Recorded as INSUFFICIENT EVIDENCE, not folded in:** `qualityHR`'s floor *equals*
the Zone 2 ceiling. Hutchinson: *"nobody does four times five minutes at 10K pace
and touches 145 except on the way up."* Seiler: *"a 27-beat range is not a target;
it is a weather forecast."* Both hold that neither number is right for the work.
Narrowing it needs observed HR this product does not collect → **ZONE-BAND-01**.

**Out of scope, deliberately:** the `Zone 2–3` long run with a pace finish (48
sessions), whose `hr_target` is a *ceiling* describing only the aerobic portion.
Different mechanism; the invariant is scoped to **range** targets so it cannot
sweep in a case this sitting did not rule on → **ZONE-BAND-02**.

### Q2 — CORRECT WITH AMENDMENT — shipped `7aad674`

Warm-up and cool-down are priced at **easy pace**. A stated distance must be one
the runner would actually cover — the identical reasoning to §40b Amendment 2
earlier the same day.

- **Amendment 1 — gated on measurement**, as EG-02 was. It *was* measured first;
  see §3, including the correction to the measurement itself.
- **Amendment 2 — freed distance goes to easy or nowhere**, never back into
  quality to keep `weekly_km` looking familiar (McMillan, Willy, Sims,
  independently). Delivered by §9's existing re-derivation, which sums **actual**
  placed distances: measured mean weekly change **+0.10%**, total 779 → 786 km.
  The 3 predicted `PEAK-OVER-BASE` violations did not materialise, for that reason.
- **Amendment 3 — the 2026-09-03 ruling is amended, not overturned.**
  Structure-driven *sizing* stays; only the conversion pace changes.

---

## 5. Recorded disagreements

**Hutchinson vs. McMillan on Q1's scope.** McMillan: pick one number today, the
choice matters less than the consistency — *"the runner does not think 'interesting
field-precedence question'. They think the app doesn't know."* Hutchinson agreed
for today but refused to let the relabel close the question, holding that both
numbers are wrong. **Resolved as sequencing, not substance.**

**No disagreement on Q2's direction.** Willy and Sims attached the same condition
independently: measure the downstream effect first, and do not add volume back to
preserve appearances.

---

## 6. What the implementation got wrong, and what caught it

Recorded because both are the transferable part.

1. **Duration followed distance down.** They were two views of one number, so
   segment-pricing the distance dragged the duration with it — a 4 × 5 min session
   reading 41 minutes instead of 46. **That is §40b Amendment 2's defect from the
   same morning, reintroduced one field over.** Caught by inspecting the generated
   plan, not by the suite.
2. **The floor checks used the old pricing.** `pacedRepPlan`'s loop still divided
   total duration by work pace, and `tempo_continuous` had **no floor protection at
   all** — a low-volume 10K taper produced a 4.5 km quality session against a 5 km
   floor. Caught by `userDeclaredLevel.test.ts`, a profile the pre-flight
   measurement grid did not cover. **A floor measured in different units from the
   thing it guards is not a floor.**

Both are now instances of a named failure class in the `zona-debug` catalogue:
*checker reads a different source from the producer*.

---

## 7. Artifacts

| | Principle | Numeric | Invariant |
|---|---|---|---|
| Q1 | §84 Amendment 1 | `zones.qualityZone` / `intervalsZone` | `INV-PLAN-DISPLAY-ZONE-MATCHES-WORK` extended — zone band **equals** `hr_target` for range targets |
| Q2 | §8 Amendment | none new — `segmentPricedDistance()` | existing `-STRUCTURED-SESSION-DURATION-COHERENT` + `-MIN-SESSION-SIZE`, now measured in the engine's own units |

Regressions: `displayZoneMatchesHr.test.ts`, `segmentPricedDistance.test.ts` —
both falsification-tested.

**SLT escalation: none.** Both correctness. No tier movement, no data Zonna
cannot collect.

## 8. Verification

939 tests, matrix 17/17, sweep 16,141 plans / 0 violations. Golden snapshots
audited line by line before acceptance in both cases.

**Not verified:** nothing rendered in the UI — all of this is from stored plan
JSON and the pure modules. The founder's next generated plan is the first look at
either change on a real card.
