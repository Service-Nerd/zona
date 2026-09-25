# Board brief — the delivered-volume checks do not run for five of the six injuries

**For sign-off. Coaching Board. Nothing implemented.**
**Raised:** 2026-09-25, from the daily ops digest's board item on plan `c8aef8f9`.
**Build measured:** `36b3d26` (production, deployed 2026-09-24 19:46 UTC).
**Tag:** 🏃 COACHING BOARD — changes what the engine's load guards cover. Does not change
what the engine prescribes.

---

## 0. The question the digest asked, and why it is not the right one

The digest asked: *plan `c8aef8f9` (marathon "finish", `injury_history: ["achilles"]`) let
week 4 rise ~41%, long-run driven, beyond the 10% guideline — should the load-residual
exception be capped or gated when `injury_history` is populated?*

**Both halves of the premise are wrong, and the measurement says so.** Regenerating that
runner's exact `generator_input` on the current build reproduces the plan identically:

| n | phase | type | weekly_km | Δ% | long_km | non-long | Δ% non-long |
|---|---|---|---|---|---|---|---|
| 2 | base | normal | 24 | +20% | 7 | 17.0 | +21% |
| 3 | base | **deload** | 17 | −29% | 5 | 12.0 | −29% |
| 4 | base | normal | 24 | **+41%** | 7 | 17.0 | +42% |

1. **Week 4 is a post-deload bounceback, not a progression.** It returns to week 2's
   *exact* volume: 24 → 17 → 24 km, non-long 17 → 12 → 17 km. Net progression across the
   deload is **0%**. The +41% is measured against the deload trough, which is the wrong
   denominator; §2 Amendment 3 makes a return *to* pre-deload explicitly legal for
   injury-history runners, and `INV-PLAN-DELOAD-BOUNCEBACK-BOUNDED` compares against
   week 2 for exactly this reason.
2. **It is not long-run driven.** The long run contributed +2 km of the +7 km. The
   non-long portion contributed +5 km. The §52 long-run exemption the digest names as
   "the load-residual exception" is not what let this through — nothing needed to let it
   through.

**So there is no defect at week 4.** The real finding sits one layer underneath, and it
is larger.

---

## 1. The finding

On the current build, **for five of the six injuries `GeneratePlanScreen` offers, no
delivered-volume check executes at all.**

There are two arms, and each one declines these runners for a separately defensible
reason:

| Arm | Principle | Gate, verbatim from `lib/plan/invariants.ts` |
|---|---|---|
| `INV-PLAN-DELIVERED-RAMP` | §94 (§2), §100 | `const healthy = (input.injury_history ?? []).length === 0; if (healthy) {` — line 3732 |
| `INV-PLAN-INJURY-CAP-DELIVERED` | §90 (ADR-022) | `s.includes('knee') \|\| s.includes('shin_splints')` — line 3516 |

An Achilles-history runner is not healthy, so the first arm skips them. They are not knee
or shin, so the second arm skips them. **Neither runs.**

### Measured, same input, injury value varied (marathon "finish", `current_weekly_km` 20, `training_age: "<6mo"`, longest recent run 8 km)

| `injury_history` | producer caps volume? | §94 arm runs | §90 arm runs | delivered check | worst wk-on-wk | warnings fired |
|---|---|---|---|---|---|---|
| `[]` | no | **yes** | no | yes | +23% | **4** |
| `["Knee"]` | yes | no | **yes** | yes | +26% | 0 |
| `["Achilles"]` | no | no | no | **NONE** | +23% | 0 |
| `["Back"]` | no | no | no | **NONE** | **+36%** | 0 |
| `["Hip"]` | no | no | no | **NONE** | +23% | 0 |
| `["Shin splints"]` | **yes** | no | no | **NONE** | +26% | 0 |
| `["Plantar fasciitis"]` | no | no | no | **NONE** | **+36%** | 0 |

**The healthy twin of this runner gets four delivered-volume warnings. The Back and
Plantar-fasciitis versions reach +36% in complete silence.**

### 🔴 The inversion, stated plainly

§94's own principle text records why it was written:

> *"So a healthy runner had **no delivered-volume check at all**, and the divergence was
> invisible rather than absent."*

§94 fixed that — and, by writing `if (healthy)`, created the mirror-image hole for the
cohort with *more* reason to be guarded, not less. **Declaring an injury currently
removes a load check that declaring nothing would have given you.**

This is the *orphaned by unioned exclusions* class: §94 scoped to healthy because §90
already owned injury; §90 scoped to knee/shin because ADR-022's measurement was
knee/shin; no guard is individually wrong and the union leaves a hole nothing measures.

---

## 2. A separate, smaller defect found alongside it — ⚙️ NOT for the board

`'Shin splints'` — the wizard's own string — **does not match `'shin_splints'`.** Space
versus underscore.

The engine's `hasInjury` was made separator-insensitive on **2026-09-16** precisely
because three of six wizard values never matched. `bouncebackInjuryCapped` in
`invariants.ts` was not, and **its own comment claims otherwise**:

> *"Predicate matches the engine's injury-cap gate exactly (`ruleEngine.ts`:
> `hasInjury('knee') || hasInjury('shin_splints')`)."*

That sentence has been false since 2026-09-16. Measured across the six wizard values:

| wizard value | producer caps | checker guards | agree |
|---|---|---|---|
| Knee | true | true | yes |
| **Shin splints** | **true** | **false** | ***NO*** |
| Achilles / Back / Hip / Plantar fasciitis | false | false | yes |

**The engine caps a shin-splints runner's volume and the checker that is supposed to
verify that cap never looks.** This is a defect restoring documented intent and is
therefore **exempt from the board** — but it must be fixed *before* the board rules,
because widening §90's scope is one of the options below and its true cost cannot be
priced while the predicate is wrong. Filed as `INJURY-GUARD-PREDICATE-01`.

---

## 3. Conflict scan — sections this touches

Run against sections **and amendments** (§1 CD-21 Am. 1 is the standing reminder that a
scan stopping at headings is not a scan).

| § | Touched how |
|---|---|
| **§2 / §2 Am. 3** | Owns the 10% weekly cap and makes return-to-pre-deload legal for injury runners. Am. 3 is why week 4 is correct. **Not contradicted.** |
| **§12** | Owns the injury volume cap on the producer. Untouched — this brief is about the *checker*. |
| **§52** | Long run is race-anchored and not deformable; both arms measure the trimable portion for that reason. **Not contradicted** — and note §94 Am. 1 already records that the "§52 shield" was *"invented in a comment and then relied on as if it were doctrine"*. Do not re-import that reasoning. |
| **§90 / ADR-022** | Scoped its remedy to knee/shin **deliberately and on measurement**. Widening it is a change to that scope and is the board's to make. |
| **§94** | The `if (healthy)` gate is the hole's other half. Any widening must say which arm owns which cohort, or the two will overlap and double-warn. |
| **§34** | Both arms are `warn` under the honest-residual pattern. Nothing here proposes promoting them to `error`. |
| **§100** | "A safety trim must not hand its deficit to the next week" — the mechanism producing these rises. Unchanged. |

**No contradiction found.** This is a **coverage** question, not a correctness one: no
principle says these runners should be unchecked; no principle says they should be
checked either, because nobody has ruled.

---

## 4. What the board is being asked

**Not** whether to cap the long run. **Not** whether week 4 was wrong. The question is:

> **Which injuries should the delivered-volume checks cover, and which arm owns them?**

### Option A — widen §90's predicate to any non-empty `injury_history`
One-line change, symmetrical with the engine's own `injury_history.length > 0` gate used
at `ruleEngine.ts:4439/4692/6576`.
· **For:** no cohort is unguarded; matches how the rest of the engine already defines
"injury runner".
· **Against:** §90's 5% cap plus the 10% tolerance is *tighter* than §94's 10% + 10%.
Applying the tighter cap to Back and Hip — neither of which is a running-load injury in
the way knee, shin and Achilles are — may warn on plans Willy would call fine.
Unmeasured.

### Option B — invert §94's gate: drop `if (healthy)`, let it cover everyone, keep §90 as the tighter overlay for knee/shin
· **For:** closes the hole with the *looser* cap, so no new tight-cap noise. The runner
gets the same check the healthy twin gets, which is the minimum defensible position.
· **Against:** an injury runner then gets the healthy cap, which reads as saying injury
history earns no extra caution at the delivered layer.
· **Note:** §94 Am. 1 already demands driver attribution in the message; that carries over
unchanged.

### Option C — widen §90 to the load-bearing injuries only (knee, shin, Achilles, calf, plantar), §94 covers the rest
Mirrors `HILL_RESTRICTING_INJURIES` (`['knee','itb','achilles','shin','calf','plantar']`),
which is already a ratified list of running-load injuries in `GENERATION_CONFIG`.
· **For:** reuses an existing ratified taxonomy rather than inventing a second one; puts
the tight cap where the tissue argument is strongest and the loose cap everywhere else.
· **Against:** two lists to keep in step. Mitigated by naming a single constant.

**Recommendation, offered not decided: C, with B's gate change as its mechanism** — §94
covers everyone, §90 overlays the load-bearing list. It closes the hole for all six
values, keeps the tight cap where ADR-022's measurement supports it, and reuses a list
the board has already ratified.

### What Willy in particular needs to rule on
ADR-022 scoped to knee/shin on measurement (deload inversions 12.8%, bouncebacks 18.8%).
**Is Achilles a load-progression injury in the same sense?** The engine already treats it
as one for hills. If yes, Option A/C follow. If no, the board should say so explicitly
and the honest answer becomes "Achilles is checked by §94's looser arm", which is still
better than nothing.

---

## 5. Evidence the board should have before ruling

Per the standing rule that a prescription ruling needs `npm run measure:fitness` numbers:
**this brief deliberately does not carry them, because no option here changes what the
engine prescribes** — all three change only which plans are *reported*. What it does need,
and what has **not** been measured:

- 🔴 **How many plans each option would newly warn on.** Unmeasured. Must be run before
  the ruling, because §1's standard applies: Willy, on an `error` firing at 71% —
  *"not a safety mechanism — it is noise, and noise gets suppressed."*
- 🔴 **Whether `INJURY-GUARD-PREDICATE-01` alone changes any baseline.** Must land first.
- ⚠️ **Population:** 1 of 23 stored plans carries a non-knee injury (`["achilles"]`), and
  1 carries `["plantar fasciitis"]`. **Two runners.** This is a correctness question, not
  a volume one, and should be priced as such.

---

## 6. What this brief does not prove

- It does not prove any of these runners were **harmed**. It proves a check that runs for
  the healthy version of the same runner does not run for them.
- It does not prove the rises are **wrong**. §45's `+20% or +5km, whichever is greater`
  makes them legal, and Willy's standing objection to that allowance on a small base is
  already filed separately as `LR-ABS-CAP-LOWVOL-01`.
- It says nothing about the **producer**. Every cap the engine applies, it still applies.
  Only the verification is missing.
