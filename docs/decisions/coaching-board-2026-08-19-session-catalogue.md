# Coaching Board Ruling — Session Catalogue (CD-14 … CD-18)

**Date:** 2026-08-19
**Convened by:** hard trigger — `session-catalogue.md`, `planSignatures.ts`, `generationConfig.ts`
**Board:** Hutchinson (chair) · Seiler · McMillan · Willy · Sims
**Evidence:** `docs/coaching-review/2026-08-19/session-catalogue-audit.md`
**Authority:** ADR-017. An INCORRECT ruling is a veto the SLT cannot overrule commercially.

**Status of this document.** This is the **signed ruling record** — the successor to `coaching-register-2026-08.md` (CD-1…CD-13), continuing the same numbering. The audit is the evidence; this is the decision. Engineering proceeds from here, not from the audit.

**Written for:** a coach. No code references in the rulings. Implementation detail lives in the backlog items named at the end of each entry.

---

## What the board was asked

The August register (CD-1…CD-13) settled how plans are *generated*. It did not examine **what the engine is allowed to prescribe** — the catalogue of concrete sessions itself. An audit of that catalogue, traced through a live 12-week 10K plan, produced five decisions. The board added a sixth on its own motion.

---

## Rulings at a glance

| # | Decision | Ruling | Backlog |
|---|---|---|---|
| **CD-14** | Should a quality session's size depend on what kind of session it is? | **CORRECT WITH AMENDMENT** — principle ships, numbers held | SC-10 |
| **CD-15** | Should 5K/10K runners be able to receive threshold work? | **CORRECT** | SC-04 |
| **CD-16** | Does VO2max belong in build for short-distance time goals? | **CORRECT WITH AMENDMENT** | SC-06, SC-07 |
| **CD-17a** | Structured hill repeats | **CORRECT** | SC-09 |
| **CD-17b** | Prescribed downhill work | **INCORRECT — VETO** | — |
| **CD-18** | Should a 10K race-specific session exist? | **CORRECT** | SC-05 |
| **CD-19** | *(Board's own motion)* Is the declared intensity distribution right, and why does nothing check it? | **INSUFFICIENT EVIDENCE** — blocks CD-14 | SC-03 |

Two engineering defects were found in the course of the review and are **not** board matters. They are recorded here because no ruling can be implemented until the first is closed: **SC-00** (two catalogues) and **SC-01** (the second quality session's missing candidate day).

---

## CD-14 — Should a quality session's size depend on what kind of session it is?

**Today.** Every quality session is sized identically — a flat share of the week's volume — whatever kind of session it is. A threshold run, a set of VO2max intervals and a race-pace session at the same weekly volume come out the same length. Rep count, rep length and recovery duration are fixed numbers written on the catalogue entry: they do not change with the runner, the week or the phase. A runner on 30 km a week and one on 60 km a week both get five three-minute intervals.

**Why it was in question.** The three kinds of hard running have genuinely different sustainable volumes. Twenty-five minutes of threshold work is a normal session; twenty-five minutes of VO2max work is a race. Sizing them identically is the same category of error as CD-1 — a real distinction erased by a single number.

**Ruling: CORRECT WITH AMENDMENT.**

The principle is correct and every seat supported it. Willy on tissue load ("twenty-five minutes at threshold and twenty-five at VO2max are not the same tissue event"), Seiler on sustainable volume, Hutchinson on the existing constant never having been justified.

**Three amendments, all binding:**

1. **The specific percentages are not ratified.** They are a share of a weekly total whose intensity target is itself unresolved (CD-19). Setting them now would encode that error a layer deeper. The principle ships; the numbers return once CD-19 settles.
2. **A rep-count ceiling per category is required, not optional.** Deriving rep count from a budget alone produced *twenty-one thirty-second repetitions* in the modelling. High rep counts at short duration are where Achilles and calf loading accumulates fastest (Willy). The budget must overflow into rep *length* once the count ceiling is reached.
3. **The evidence claim must be withdrawn.** The audit argued that its model reproducing the existing five-by-three-minutes at 40 km/week "validates the current constant". Hutchinson: that recovers the model's own inputs and is not corroboration. The honest statement is that the proposal is *consistent with* a constant that was itself never justified. Neither number has external support.

**What would change our mind.** If the coaching view is that a non-elite runner is better served by a session size that stays put while their volume moves — one fewer variable, more comparable week to week — then the flat share is correct and we stop describing the catalogue as sized. Defensible for our audience; it should be chosen rather than defaulted into.

**Who this affects.** Every plan containing any quality work, every distance, every level. Systemic.

**Blocked on:** CD-19.

---

## CD-15 — Should 5K and 10K runners be able to receive threshold work?

**Today.** They cannot. Every threshold session in the catalogue is restricted to half-marathon and longer. The consequence, traced live: the entire build phase of a 10K plan is filled by an aerobic easy run, which the engine then prescribes at threshold pace under the name *"Steady aerobic"*. For a runner with a knee, shin or Achilles history the hills option is filtered out too, leaving **exactly one** eligible session for the whole build phase. In the live database, the 5K and 10K **taper has no eligible session at all**.

**Why it was in question.** A 10K is raced at or just above threshold. No coach holds that a 10K plan should contain no threshold work. The likelihood is that the catalogue was written marathon-first and never revisited — but it is a prescription change, so it is the board's call and not engineering's.

**Ruling: CORRECT.** Unanimous, and the board considers this the least discretionary item in the batch.

**Adopt: widen the three existing threshold sessions to 5K and 10K, then add a short-distance variant with shorter reps.**

The conflict scan strengthened the case beyond what the audit argued. **§24b was written on the explicit premise that 5K/10K runners already receive threshold work** — its own rationale says so, in those words. That premise has never been true. This is therefore closer to correcting a false statement in the constitution than to making a new coaching decision.

**The labelling fix is mandatory and unconditional, and does not wait for the eligibility change.** An aerobic session named "Steady aerobic", prescribed at threshold pace in the grey zone, breaches §19 and sits against §12's easy-run ceiling. It ships today, in production, to every 5K and 10K runner in build phase. McMillan: *"whatever else you decide, that runner is being poorly served today."*

**Amendment adopted (McMillan):** band the short-distance threshold rep at four to twelve minutes rather than fixing it at five. Variety across a block matters more than any single rep length.

**Who this affects.** Every 5K and 10K plan, both tiers — our two free-tier flagship distances, so this is also the shape of what a free user sees.

**Backlog:** SC-02 (labelling, urgent) · SC-04 (eligibility).

---

## CD-16 — Does VO2max work belong in the build phase for short-distance time goals?

**Today.** VO2max is eligible only in the peak phase. In the traced 12-week 10K plan that placed both VO2max sessions in weeks 9 and 10 — the last two before the taper. Our own principle requires at least five weeks between the first VO2max session and the taper. **The engine recorded its own violation and proceeded anyway**, noting that the catalogue gave it nowhere else to put them. The plan contains 72 minutes of prescribed work above threshold across twelve weeks, all of it too late to adapt to.

A second and sharper problem sits in the same area. **For an ambitious target, goal pace overtakes interval pace.** The traced runner's goal pace is *faster* than their derived VO2max pace — while carrying a heart-rate ceiling far lower. The sessions named VO2max are prescribed slower and easier than the sessions named race pace. A runner following pace and a runner following heart rate would run two different plans.

**Ruling: CORRECT WITH AMENDMENT.**

**Option (b) — removing VO2max from short-distance plans — is ruled out**, on Sims's dissent, which the board accepts. See Recorded Disagreements.

**Three amendments, all binding:**

1. **Willy's gate is a condition of approval.** VO2max may enter build only under the rule that already governs the first quality session of a plan: the week that introduces it holds volume flat. Intensity and volume do not progress in the same week. Without this, moving VO2max earlier lands it on a rising volume curve — the combination §2 exists to prevent.
2. **The pace inversion is a live prescription error, is severable, and is fixed first.** When derived goal pace is faster than derived interval pace, the plan is incoherent by both metrics and nothing catches it — because every existing check validates one session in isolation. The engine must either reconcile the two or surface the honesty signal. **§44's difficulty band is the correct surface**: it is already ordinal, already free, and already exists to say "this is a real ask" without pretending to a probability. A target beyond current measured fitness is the same class of statement.
3. **The five-week adaptation window is either binding or it is deleted.** A principle the engine logs a violation against and then proceeds past is not a principle (Hutchinson). Whichever way the placement question lands, that number stops being advisory.

**Seiler's note, recorded:** two isolated exposures produce essentially nothing, so the current state is the worst available — we carry the injury and fatigue cost of the hardest work in the plan and collect none of the adaptation. *"Either commit to it properly in the build, or do not do it. The middle position we are in now is the only indefensible one."*

**Who this affects.** Every 5K and 10K plan (placement) and every time-goal plan at any distance where the target is meaningfully ahead of measured fitness (the inversion). Systemic on both counts.

**Backlog:** SC-06 (inversion, first) · SC-07 (placement).

---

## CD-17 — Should structured hill work and prescribed-downhill work enter the catalogue?

**Today.** One hill session exists — an easy run over hilly ground. There are no hill *repeats*: no set, no rep length, no rest, no descent instruction. There is no downhill session of any kind. The engine's own progression ladder already contains a rung called "hills" between steady aerobic and tempo, and nothing in the catalogue can occupy it.

### CD-17a — Hill repeats: **CORRECT**

Unanimous, which was unusual. McMillan on practicality (*"no track, no measured loop, self-limiting by gradient, effort-governed so it works on a day when the legs are flat — close to the perfect session for a time-poor amateur"*). Sims on bone stimulus at sub-maximal speed, which matters specifically for perimenopausal runners and is hard to get elsewhere in a training week. Willy raising no objection to uphill loading. Seiler noting it fills a genuine mid-band gap. The chair noting it fills a rung the engine already references.

**Adopt a single parameterised session with a label that renders its parameter** — "Hill reps — 45s", "Hill reps — 90s" — rather than three near-identical entries. One entry, one set of voice copy, distinct labels so the variety rule still works.

**Amendment adopted (McMillan): drop the manual rep advance.** Express it as a coaching instruction, not an interaction. *"You are asking a runner to interact with their watch at the top of every rep while breathing hard."* Every added interaction is one a tired runner gets wrong.

### CD-17b — Prescribed downhill work: **INCORRECT. This is a veto.**

It does not ship as specified. Willy's reasoning, accepted in full:

Eccentric downhill loading is the highest-risk session in the proposal and the most reliable way to produce persistent patellofemoral symptoms in a masters runner. Three specific failures in the specification:

1. **The exclusion list it inherits was written for uphill work.** Downhill loads the knee extensor mechanism differently. Inheriting the uphill filter is an assumption, not a safety design.
2. **There is no dose progression.** Eccentric work has a repeated-bout protective effect — the *first* exposure is disproportionately damaging and every subsequent one is safer. A prescription that starts at full dose is precisely inverted.
3. **There is no symptom gate and no return-to-run path.** When this hurts someone, the plan has no mechanism to notice or back off.

Sims concurred on independent grounds: post-menopausal bone is where eccentric load compounds, which is a separate argument from the soft-tissue one. McMillan dissented on value — runners with a hilly goal race will run downhill on race day whether we prescribe it or not — but accepted the veto as drafted.

**What would make it correct:** all three of — its own exclusion criteria, a graded first exposure, and a hard prohibition inside the final three weeks with a defined symptom back-off. Per ADR-017 §3 this is not overrulable on commercial grounds.

**Backlog:** SC-09 (hills). Downhill is **not** backlogged — it returns only as a re-specified proposal.

---

## CD-18 — Should a 10K race-specific session exist?

**Today.** No. There is a half-marathon-pace interval session, a half-marathon-pace long run, a marathon-pace long run and an all-distance taper sharpener — but nothing at 10K pace. The nearest a 10K runner gets is a set of kilometre repeats at 5K pace, plus a build-phase session the engine renames "10K-pace progression" on the fly with no catalogue entry behind it.

**Why it was in question.** 10K is one of our two free-tier flagship distances. That it has no race-specific session while the half-marathon has two is not a decision anyone made — it is where the catalogue stopped. Because the engine papers over it with a rename, the gap is invisible in the product: the plan *looks* like it contains 10K-pace work.

**Ruling: CORRECT.** Adopt the 10K-pace interval session, mirroring the half-marathon one.

Shippable without waiting for schema work, mirrors an entry that already exists and is understood, and closes the specificity gap on a flagship free-tier distance where "specific" currently resolves to intervals at 5K pace.

**A correction to the audit's framing, recorded because the lesson generalises.** The audit treated the on-the-fly rename as an undocumented workaround. It is not: **§33 explicitly sanctions it**, names this exact case, and requires the borrowed voice be replaced — which the engine does correctly. The board's finding is different and worse: **§33 closed the review by fixing the symptom (borrowed voice) and left the cause (no 10K entry) in place.** A principle can close a review without closing a gap. Worth remembering the next time a principle is written to describe existing behaviour rather than to correct it.

**Who this affects.** Every 10K plan, both tiers — and by the same argument every 5K plan, which has the identical gap.

**Backlog:** SC-05.

---

## CD-19 — *(Board's own motion)* The declared intensity distribution is unenforced, and its value is contested

Raised by Seiler, seconded by the chair. The board declined to leave this buried inside another item's conflict scan.

**Today.** The constitution declares an intensity distribution per race distance — 75% easy / 25% quality for 10K, measured in minutes. The traced 12-week 10K plan delivers **9.6% quality**. Nothing checks it: the table is read by an offline validation script and by no engine code, and no invariant references it.

**Why it's in question — two separate faults.**

*Fault one: nothing enforces it.* A declared constitutional value with zero mechanical enforcement is exactly what §34 exists to prevent.

*Fault two: the value is probably wrong, and not in the direction the audit assumed.* Seiler's objection, in his own territory:

> The 80/20 finding is a **session-count** observation. Roughly four in five *sessions* sat below the first ventilatory threshold. Measured by *time*, the ratio is far more skewed — typically 90/10 or beyond, because the easy sessions are long and the hard ones are short. Taking a session-count ratio and applying it to a time denominator inflates the target by roughly a factor of two.

So the audit's framing — 9.6% against a declared 25% is under-delivery — is contested. Seiler's reading is the opposite: **9.6% of running time above easy, for a four-hour-a-week 43-year-old, is close to right. The delivered plan is more defensible than the config it fails to honour.**

There is a second reason for caution, and it is the reason this product exists. Seiler's recreational-athlete work found amateurs cluster in the moderate band — in our terms, Z3 — because a 90-minute window is where every session drifts when you want to feel like you worked. "Fixing" 9.6% by raising prescribed quality volume would push a drift-prone population further up. **That is the failure mode Zonna was built to prevent, introduced by the product's own config.**

**Ruling: INSUFFICIENT EVIDENCE.** The board cannot set the correct number today.

**What would settle it:** a decision on whether the ratio is expressed **per session** or **per minute**, and a restatement of the six values to match. Seiler will ratify 25% as a share of *sessions*. He will not ratify it as a share of *minutes*.

**This blocks CD-14's numerics.** It does not block CD-15, CD-17a or CD-18.

**Not a new discovery — a re-opened one.** `backlog.md` § *Free/paid audit* has carried this note since before the audit: *"engine produces ~90% easy across distances; spec target was 75–88%. Currently kept by design (restraint as the brand)."* It was noticed, filed as a commercial watch item, and never resolved as a **coaching** decision. That misfiling is the reason it survived. It is now a coaching decision with a board ruling attached.

**Backlog:** SC-03.

---

## Recorded disagreements

Preserved per ADR-017 §2. These are not synthesised.

### 1. Seiler vs. the audit (and partly Hutchinson) — is 9.6% quality a failure or a success?

The audit frames the gap as under-delivery and notes it "cuts against the brand". Seiler holds the target itself misapplies a session-count finding to a time denominator, that 9.6% is close to appropriate for this population, and that correcting it upward would push runners further into the grey zone. Hutchinson takes no view on which number is right, but holds that a config declaring a figure the engine misses by fifteen points, with nothing checking it, is a §34 failure regardless.

*Settled by:* a decision on session-count vs minutes. Tracked as CD-19 / SC-03.

### 2. Sims vs. the audit's CD-16 fallback — may VO2max be removed from short-distance plans?

The audit offered, as a fallback, leaving VO2max peak-only and deleting the unsatisfiable adaptation-window principle, on the grounds that Zone 5 work at 43 may not be worth its injury cost.

Sims objects, and asked that it be recorded as a dissent rather than a footnote:

> For peri- and post-menopausal women, high-intensity interval work is among the strongest available levers for lean mass retention, bone mineral density and metabolic health. It is arguably *more* valuable to a 48-year-old woman than to the 28-year-old man the protocol was written for. Dropping it on general injury-caution grounds would take the most useful stimulus away from the cohort that needs it most, and it would be a decision made without a single female-specific data point.

Willy is sympathetic to the caution in general but agrees the answer is gating, not deletion.

*Settled by:* nothing available — the engine does not collect sex, so a cohort-differentiated answer is unbuildable. **The board resolved this by ruling the option out for everyone** rather than by resolving the disagreement.

### 3. Willy (+ Sims) vs. McMillan — prescribed downhill work

McMillan sees real value for runners with a hilly goal race. Willy holds the specification lacks a graded first exposure, its own exclusion criteria and a symptom gate. Sims adds the post-menopausal bone-loading argument.

*Settled by:* a revised specification with those three elements. McMillan accepts the veto and does not contest it.

---

## Standing findings the board recorded but did not rule on

These are **not** coaching decisions. They are recorded because the rulings above cannot be implemented without them.

### Two catalogues, and the one that ships is not the one in the database — SC-00

The plan generator does not read the live catalogue table. It reads a separate in-repository copy which has since gained two sessions and one eligibility change that were never migrated. Every plan ever shipped came from the in-repository copy.

Consequences: anyone reviewing "the catalogue" via the database has been reviewing a list that never produced a plan; and connecting the generator to the live table today would **immediately empty the 5K and 10K taper**.

The board's rulings are made against the 16-entry list, because that is what runners received. **No ruling may be implemented until this is closed.**

### The second quality session fails on a hardcoded day list, not on coaching rules — SC-01

The audit reported that a four-day-a-week runner with a Sunday long run and a Wednesday quality session "can never receive a second quality session", and attributed it to the 48-hour spacing doctrine.

McMillan found that is not what happens. The engine considers only three candidate days for the second session, all of which correctly fail — and **Friday is never considered**, despite sitting two days from both. The spacing doctrine is fine; the candidate list is wrong.

This is a defect, not a constraint, and it materially changes CD-16: some of the "nowhere to put VO2max" premise dissolves once it is fixed. **Re-run the 10K trace afterwards.**

---

## Required artifacts

Per ADR-017 §4, each CORRECT ruling terminates in principle + numeric + mechanical check, in one commit.

| Ruling | Principle | Numeric | Invariant |
|---|---|---|---|
| **CD-15** | Amend §17 (signature focus must be reachable); amend §24b (false premise); extend §19 to labels implying *easy* work | Distance eligibility on three threshold entries; new short-distance entry, 4–12 min rep band | Widen `INV-PLAN-LABEL-MATCHES-PACE` to catch an aerobic-category entry prescribed above Z2 without a rename; new `INV-PLAN-PHASE-FOCUS-REACHABLE` |
| **CD-18** | Amend §5 and §22 — for 5K/10K, "specific" resolves to race pace, not VO2max | New 10K-pace interval entry | Extend `INV-PLAN-RACE-SPECIFIC-EXPOSURE` to require a real catalogue entry, not a rename |
| **CD-16 (inversion)** | Amend §44 (band reflects a target beyond measured fitness); new § for cross-session ordering | Tolerance for goal pace exceeding derived interval pace | **`INV-PLAN-INTENSITY-ORDERING` — a new class of check.** Compares sessions *across* the plan rather than validating one in isolation, which is why nothing caught this |
| **CD-16 (placement)** | Amend §5 and the VO2max onset rule | Volume-flat gate on the VO2max-introducing week | Extend the existing volume/quality split check |
| **CD-17a** | New § — effort-governed sessions, and how §19 applies with no pace to check; reconcile with §28 (strides) | Parameterised hill entry + rep-length parameter set | Extend `INV-PLAN-INJURY-NO-HILLS`; new check that a session without a pace target carries an effort target |
| **CD-14** | Amend §8 — one sizing figure becomes four | **Held pending CD-19** | Restate `INV-PLAN-MIN-SESSION-SIZE` and `INV-PLAN-QUALITY-PER-WEEK` in work terms |
| **CD-19** | Amend §1 — state session-count vs minutes, restate all six values | Corrected distribution table | New `INV-PLAN-INTENSITY-DISTRIBUTION` — §34 requires it |

**Recorded as not mechanically checkable (ADR-017 §4):** Sims's recovery-duration and masters-threshold findings. The engine does not collect sex. Record in the relevant § as a known gap rather than leaving it silent.

---

## SLT escalation

Two items, both correctness-complete but blocked on data the product does not collect. Carried by Hutchinson.

1. **Sex is not collected anywhere in the plan inputs.** Verified. This blocks sex-aware recovery prescription and a sex-aware masters threshold. Unlike the cycle bridge, this is an ordinary input, not device data — so it is a **product** decision, not a platform limitation. The board has no view on whether to ask. It notes that continuing without it means the male trajectory is the default for every runner, and that this is currently undocumented.
2. **The cycle bridge remains hard-blocked** — the health plugin exposes no menstrual data type. Unchanged from ADR-011; noted for completeness.

**Not escalated:** the downhill veto (final); SC-00 and SC-01 (engineering); CD-15's free-tier reach (adds content within an existing tier, does not move the line).

---

## Build order

Full specs and wave assignment in `docs/releases/backlog.md` § *Session catalogue remediation (Wave 1d)*.

| Order | Item | Why here |
|---|---|---|
| 1 | **SC-00** catalogue reconciliation | Blocks everything. Nothing else can be implemented against two diverging lists. |
| 2 | **SC-01** second-quality candidate day | One-line defect; changes CD-16's premise; cheap to do before the trace is re-run. |
| 3 | **SC-02** label integrity — aerobic entry at threshold pace | Live §19 breach in production today. Does not wait for CD-15. |
| 4 | **SC-06** pace inversion | Live prescription error visible to an experienced runner. Severable from CD-16's placement half. |
| 5 | **SC-04** 5K/10K threshold eligibility | Largest content gap; cheapest fix; unblocks CD-18's fallback. |
| 6 | **SC-05** 10K race-specific session | Shippable on today's schema; flagship free-tier distance. |
| 7 | **SC-03** intensity distribution | Blocks CD-14. Needs a coaching decision before a numeric. |
| 8 | **SC-07** VO2max placement | Re-assess after SC-01 — the constraint may be smaller than it looked. |
| 9 | **SC-08** v2 session structure schema | Prerequisite for hills. Largest single piece of work. |
| 10 | **SC-09** hill repeats | Gated on SC-08. |
| 11 | **SC-10** category-specific sizing | Gated on SC-03. |

---

*No code was written in producing this ruling. CD-17b is vetoed. CD-14 and CD-19 are open. Everything else is authorised to build, subject to its three artifacts.*
