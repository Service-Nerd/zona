# Coaching Board — 2026-11-14. Wave 3: what the wizard asks about injuries

Two items. The third, `WIZARD-PAID-INPUTS-TIER-01`, is **⏸️ parked by the founder** (*"park point 2
in the backlog for now"*, 2026-10-28) and was not brought.

Seats: Hutchinson (chair), Seiler, McMillan, Willy, Sims.

---

## 🔍 Settled ground, and it set the agenda

**SLT 2026-10-28 (`docs/decisions/slt-2026-10-28-injury-recency.md`): don't build yet.** Its order,
verbatim in effect: *the Coaching Board first states what each answer (current / within a year /
longer ago) changes, **per injury, with a measurement; if nothing changes, it is not collected**.
Then the Design Board rules on a per-chip toggle on the existing step.*

**So the measurement IS the deliverable, and the SLT wrote the disposal rule in advance.**

⚠️ **And the item's premise needs one correction before the board reads it.** It says *"the wizard
does not ask whether an injury is current"*. The wizard's own copy asks twice: the step subtitle is
*"Old injuries that still show up. Skip if you're clean."* and the field note is *"Select any that
are **still an issue**."* **What is missing is a structured field, not the question.**

---

## 📐 The measurement, per chip

Counterfactual on the engine: identical input with and without each chip the wizard offers.
⚠️ **The first version of this table was WRONG and said "Achilles: nothing changes".** It printed
peak / long run / quality / weeks and **had no hill column**, so it could not see the one thing
Achilles does. Columns added, beginner row added, re-run.

**Marathon, 20 km/week:**

| chip | intermediate | beginner |
|---|---|---|
| **Achilles** | nothing | **all 6 hill weeks removed** |
| **Hip** | **nothing** | **nothing** |
| Knee | peak 53→32, LR 25.5→19 | peak 52→33, LR→19, hills 6→0 |
| Shin splints | peak 53→32, LR 25.5→19 | peak 52→33, LR→19, hills 6→0 |
| Back | LR 25.5→14.5 | peak 52→49, LR→14.5 |
| Plantar fasciitis | LR 25.5→14.5 | peak 52→49, LR→14.5, hills 6→0 |

**At 40 km/week** `Back` and `Plantar` additionally flip the plan `build → maintenance`.
**Live chips ticked** (36 plans carrying `generator_input`): knee 6 · plantar 4 · **hip 4** ·
achilles 3 · shin 3 · back 1.

---

## 1. `INJURY-RECENCY-01` — ⚖️ CORRECT: recency is worth collecting, for FOUR chips. Build routed on.

**🏃 Hutchinson (chair):** *"The measurement answers the SLT's question and it answers it loudly.
A runner who ticks `Back` for something from a decade ago loses eleven kilometres off their
marathon long run and, at forty a week, loses the build phase entirely. That is not a cautious
default, it is a different plan. Recency changes what we prescribe for Knee, Shin, Back and
Plantar, so by the SLT's own rule it is collected for those four."*

**🩹 Willy:** *"And I want the asymmetry on the record, because it is the whole reason this is safe
to collect. Tissue that failed ten years ago and has been loaded since is not the same risk as
tissue that failed in March. But the direction of error is not symmetric: treating a current injury
as historic is an injury, treating a historic one as current is a smaller plan. **So a missing or
refused answer must default to CURRENT**, not to historic. I will not sign a version where
skipping the question quietly removes the cap."*

**🎯 McMillan:** *"Three buckets, not a date. 'Still a problem' / 'last year' / 'longer ago than
that' is what a runner can answer standing in a kitchen. A date picker gets abandoned or guessed."*

**⚕️ Sims:** *"No objection to collecting. One condition: the chip text must not make them
re-litigate it. They already told us it 'still shows up' — asking again in different words reads as
not having been believed."*

**📊 Seiler:** *"No objection from this seat. It does not touch intensity distribution."*

### ⚖️ Ruling: CORRECT

Recency is collected for the four chips where it changes the prescription. **Three buckets**
(current / within a year / longer ago). **Absent or skipped defaults to CURRENT** (Willy, binding).

🔻 **NOT BUILT HERE, and the SLT said so:** *"Then the **Design Board** rules on a per-chip toggle
on the existing step (not a new step)."* That sitting has not happened; this board does not author
the control. **Routed, with the measurement attached.** ⚠️ The engine half is a new input field
plus four predicates reading it — real work, not a bolt-on at the end of a day with nothing run on
a device.

## 2. `Hip` is collected and changes nothing, for anybody — ⚖️ CORRECT (new finding)

📐 **`Hip` moves no number in any case measured: both levels, three distances, two volumes.** And
**four live runners have ticked it.**

**🩹 Willy:** *"Then we are asking a question we discard. A hip history is usually a glute or
mobility problem and the honest remedies are strength and cadence, not volume — which is why it
reaches nothing here. But four people told us something and the plan did not change by a metre."*
**🏃 Hutchinson (chair):** *"The SLT's rule is explicit: **if nothing changes, it is not
collected.** It applies to this chip as written, today, regardless of recency."*
**🎯 McMillan:** *"Or it earns an effect. I would rather it earned one than vanished — a hip that
flares is a real thing to plan around — but I cannot name the restriction without evidence, and
this board does not invent caps."*

### ⚖️ Ruling: CORRECT — and it is a choice for the next sitting, with a deadline

The chip is **either given a prescription effect or removed from the step.** This board will not
invent a cap without evidence, so the default on **2026-12-12** (the standing blocked-item
re-measure date) is **removal**, unless `STRENGTH-ENGINE-01` gives hip history a strength-side
effect first — which is where Blagrove's seat would own it. ⚠️ **Filed, not built**: removing a
chip four live runners have used changes what they are asked, which is the Design Board's step.

## 3. `WIZARD-ZERO-LONGEST-VS-WEEKLY-01` — 🔴 CLOSED. Zero live instances.

The item's own words: *"what would settle it is evidence, not argument: do runners who leave the
slider at zero mean it?"*

📐 **Measured on live plans: of 36 carrying `generator_input`, exactly ONE has
`longest_recent_run_km` of 0 — and that one has `current_weekly_km` 0 as well.** A coherent true
non-runner, not an untouched slider. **The pair the item describes has never occurred.**

**🎯 McMillan, whose disagreement this was:** *"Then I withdraw it as a live defect and keep it as a
thing to watch. My objection was that a seven-kilometre first week against thirty declared is a
refusal wearing a plan's clothes. It still would be. It just has not happened."*
**🏃 Hutchinson (chair):** *"Closed on the evidence the item asked for. If it appears, it reopens
with a real case attached, which is worth more than this sitting could have produced."*

### ⚖️ Ruling: CLOSED, premise has no live instance

⚠️ **What this does not prove:** not that runners who leave it at zero mean it — **that is still
uncollected** — only that the pair does not occur. The telemetry the item wanted is unbuilt and
nothing here changes that.

## ⇗ SLT escalation

None. Ruling 1 returns to the Design Board for the control, as the SLT's own order requires.
