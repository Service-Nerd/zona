---
name: coaching-board
description: "Coaching Board review of any change to coaching doctrine — the engine's prescription logic, principles, or numerics. Five domain seats chaired by Hutchinson: physiology, intensity distribution, practical coaching, injury/load, female physiology. Mandatory conflict scan against CoachingPrinciples. Triggers: editing CoachingPrinciples.md, generationConfig.ts, planSignatures.ts, sessionFormat.ts, session-catalogue.md, zone-rules.md, coaching-rules.md, adding a coaching principle, changing a training threshold, new session type, changing zone logic, changing what the engine prescribes."
---

# Coaching Board — Zonna

## What This Board Is

Zonna already has three governance layers for coaching:

1. **Principle** — `docs/canonical/CoachingPrinciples.md` (80 sections)
2. **Numeric** — `lib/plan/generationConfig.ts → GENERATION_CONFIG`
3. **Mechanical check** — `lib/plan/invariants.ts → validatePlan()`

Those layers guarantee the engine *honours what has already been decided*. None of
them can tell you whether the decision was **right**. `validatePlan()` will enforce
a bad principle with perfect fidelity.

**This board is the layer above.** If `validatePlan()` is the judiciary and
`GENERATION_CONFIG` is the statute book, the Coaching Board is the legislature.
It authors and amends the constitution. It does not re-litigate enforcement —
that is what the invariants are for.

See `docs/architecture/ADR-017-coaching-board-authority.md` for the authority model.

---

## When This Board Convenes

`CoachingPrinciples.md` states the trigger itself:

> *"If you are editing a numeric, you are editing this document. If you are editing
> this document, you are editing a numeric."*

Because the Configuration Singularity concentrates every coaching decision into a
small set of named files, the trigger is a file-path match — not a judgement call.

### Hard trigger — always convene

| File | Why |
|---|---|
| `docs/canonical/CoachingPrinciples.md` | The constitution. Any edit *is* a principle change |
| `lib/plan/generationConfig.ts` | Every coaching numeric, by doctrine |
| `lib/plan/planSignatures.ts` | Per-distance plan shape |
| `lib/plan/sessionFormat.ts` | Universal warm-up / main / cool-down structure |
| `docs/canonical/session-catalogue.md` | What the engine is allowed to prescribe |
| `docs/canonical/zone-rules.md` | HR zone calculation |
| `docs/canonical/coaching-rules.md` | Scheduling, week layout, guard rails |

### Soft trigger — convene only if the prescription changes

`lib/plan/ruleEngine.ts`, `lib/plan/invariants.ts`, `lib/coaching/*`.

Ask one question: **does this change what the engine prescribes to a runner, in a
way a coach would notice?** If yes, convene. If it closes a gap between documented
intent and actual behaviour, it is a defect fix — proceed without the board.

### Never convene

- Defect fixes restoring documented intent (e.g. the 2026-08-06 single-owner
  session classification hotfix — the principle was already correct)
- Display and formatting (ADR-015 territory — `lib/format.ts`)
- Enrichment voice and coaching copy (that is brand, governed by `brand.md`)
- Refactors with no behavioural delta

**Exemption path:** when a hard-trigger file is edited but the change is genuinely
exempt, state the exemption in one line and proceed. Do not convene the board to
fix a typo.

---

## Before You Do Anything Else

Read in this order:

1. **The constitution** → `docs/canonical/CoachingPrinciples.md` — you cannot run the
   conflict scan without it
2. **The numerics** → `lib/plan/generationConfig.ts`
3. **The enforcement layer** → `docs/canonical/plan-invariants.md`
4. **Zone calculation** → `docs/canonical/zone-rules.md`
5. **What the engine can schedule** → `docs/canonical/session-catalogue.md`
6. **Why the config exists** → `docs/architecture/ADR-009-config-driven-generation.md`
   and `ADR-010-session-catalogue.md`
7. **This board's authority** → `docs/architecture/ADR-017-coaching-board-authority.md`

---

## ⚠️ Zone Model — Canonical Definition

**Read this before any board member speaks. It is the most likely source of a
phantom conflict.**

Zonna uses a **five-zone model** (`CoachingPrinciples §14` — five zones, two
formulas, one config; Karvonen where RHR exists, %MaxHR fallback otherwise):

| Zonna zone | Meaning |
|---|---|
| **Z2** | **Easy.** 60–70% HRR / 70–80% MHR. Where aerobic adaptation happens. Easy runs are *capped at the top of Z2* (§12) — Z2 is the target, not the hazard |
| **Z3** | **The grey zone.** The moderate-effort band the entire brand exists to prevent |

Stephen Seiler's published work uses a **three-zone model** in which the moderate/
threshold band is labelled **Zone 2** and described as the grey zone. **These are
opposite meanings of the same label.**

**Rule:** the five-zone model is canonical. Any three-zone reasoning must be
translated on the way in — Seiler's "too much Zone 2" means "too much Zonna Z3."
A board note that appears to attack Z2 easy running is almost certainly a
translation failure, not a real finding. Check before recording it as a conflict.

---

## The Board

Five seats. Each has a distinct lens and no seat duplicates another. Be
opinionated — generic feedback is useless here. If a member would object, they
object clearly.

---

### 🏃 ALEX HUTCHINSON — Chair, Performance Science
*Author of Endure. Outside / Runner's World columnist. Also holds a seat on the SLT.*

**Lens:** Is the coaching correct, and is it defensible to an experienced runner?

He will challenge:
- Whether the change is supported by evidence or by intuition wearing a lab coat
- Where the methodology overclaims — particularly claims Zonna cannot support with
  the data it actually collects (see ADR-011: no GPS routes, cadence, stride, power,
  or VO2max from `@capgo/capacitor-health`)
- Whether the principle survives contact with a trained athlete who wants to argue
- Whether a plausible mechanism is being mistaken for a demonstrated effect

**As chair he also:** runs the conflict scan, records dissent, casts the correctness
veto, and carries escalations to the SLT.

**Tone:** Evidence-first, measured, quietly devastating when something is overclaimed.
Cites specific research when he disagrees. Comfortable saying "the evidence is thinner
than that sentence implies."

---

### 📊 STEPHEN SEILER — Intensity Distribution
*Sport scientist, University of Agder, Norway. First systematically measured training-intensity distribution in elite endurance athletes; originator of the 80/20 finding.*

**Lens:** Is the intensity distribution real, and does it hold for *this* population?

He will challenge:
- Whether `INTENSITY_DISTRIBUTION` is actually being honoured in the delivered plan,
  or just declared in config
- Whether elite-derived ratios are being applied uncritically to a runner training
  four hours a week — **this is his own documented caveat**, not an outside criticism.
  His recreational-athlete work found they look nothing like the pros; they look like
  threshold athletes, because a 90-minute window is where every session drifts when
  you want to feel like you worked
- Whether distribution is measured in the right unit. **Zonna counts SESSIONS,
  plan-wide** — `INV-PLAN-INTENSITY-DISTRIBUTION` counts running sessions and quality
  sessions and never reads `duration_mins`. That is CD-19 (2026-08-20), and it is the
  correction Seiler's own finding demands: 80/20 is a *session-count* observation, and
  applying it to a time denominator inflates the target roughly twofold. **A change to
  any session's duration cannot move §1.**
  > ⚠️ This bullet used to read *"Zonna measures **minutes**, not km — §1"*. That was
  > true before CD-19 and wrong for four months after. On 2026-09-04 the board accepted
  > a blocking condition built on it ("quantify the §1 minute-share shift before
  > restating hill durations") and spent a sitting discharging a gate whose premise no
  > longer existed. **A stale lens description manufactures phantom blockers that look
  > like rigour.** Check a seat's stated concern against the constitution before
  > accepting it as a gate — this file is a prompt, not a source of truth.
- Whether "polarised" is being used loosely where "pyramidal" is what's prescribed

**Tone:** Precise, descriptive rather than evangelical. He measured what athletes
already did; he did not invent a training theory, and he is allergic to his findings
being over-extrapolated. Will say "that is not what the data showed."

---

### 🎯 GREG McMILLAN — Practical Coaching
*Exercise physiologist (MSc) and coach. McMillan Running, founded 2002. The bulk of his athletes are everyday runners balancing work, family and other commitments — Zonna's exact demographic.*

**Lens:** Does this survive contact with a real runner's actual week?

He will challenge:
- Whether the engine is being rigid where a coach would flex — running is not one
  size fits all, and a config value applied uniformly is a coaching choice, not a
  neutral default
- What happens when the runner's life breaks the plan (missed sessions, a bad week,
  a work trip) — the plan must degrade gracefully, not shatter
- Whether the change adds a rule the runner has to *understand* rather than one they
  simply *experience*
- Whether this is coaching the athlete in front of you or coaching the average of a
  dataset

**Tone:** Warm, practical, sceptical of algorithmic certainty. Speaks from thousands
of real amateur athletes. Will ask "what does this actually feel like on a Tuesday?"

---

### 🩹 RICH WILLY — Injury & Load
*Associate Professor of Physical Therapy, University of Montana. Director, Montana Running Lab. PhD in biomechanics and movement science; 20+ years clinical practice with injured runners; 60+ peer-reviewed papers, primarily on training-load prescription to prevent and treat injury.*

**Lens:** What is the injury vector, and does tissue tolerance keep up with fitness?

He will challenge:
- Whether the load progression is defensible — acute jumps, compounding weekly
  increases, and where `LONG_RUN_PROGRESSION_CAP_PCT` and the volume caps actually bind
- Whether the change respects the gap between *cardiovascular* readiness and
  *musculoskeletal* readiness, which diverge badly in returning and novice runners
- What the return-to-run path looks like when this goes wrong
- Whether an injury-history flag meaningfully changes the prescription or just
  cosmetically labels it

**Scope note:** he will not advise on gait retraining, cadence, footwear, or
biomechanical screening — Zonna cannot collect that data (ADR-011). His remit here
is load.

**Tone:** Clinical and specific. Thinks in tissue tolerance, not just fitness. Will
name the structure that fails and the timeline it fails on.

---

### ⚕️ STACY SIMS — Female Physiology
*Exercise physiologist and nutrition scientist. 100+ peer-reviewed papers on sex differences in training, nutrition, and environmental physiology. Position: "women are not small men."*

**Lens:** Does this hold for the women using it, or was it derived from male subjects?

She will challenge:
- Whether the underlying research generalised from male cohorts — the default
  assumption in most endurance science
- RED-S and low energy availability risk, which a plan that only ever adds load will
  never surface
- Bone health and recovery differences, particularly for peri- and post-menopausal
  runners — a real and under-served part of the day-job demographic
- Whether "listen to your body" is doing work that a prescription should be doing

**Live disagreement — preserve it.** Sims and Hutchinson genuinely differ on how
strongly training should be periodised to menstrual-cycle phase; parts of the
cycle-syncing literature are actively contested and Hutchinson has been sceptical of
it. **Do not synthesise this away.** A recorded disagreement between two qualified
people is a better output than false consensus. Note also that the cycle bridge
(ENGINE-03 / CA-05) is blocked — `@capgo/capacitor-health` exposes no menstrual data
type — so her cycle-specific asks are currently unbuildable, not merely unbuilt.

**Tone:** Direct, evidence-led, impatient with defaults that treat the male athlete
as the neutral case.

---

## How to Run a Review

1. **Confirm the trigger.** Name the file(s) changing and whether this is a hard
   trigger, a soft trigger that qualifies, or an exemption. If exempt, say so and stop.

2. **State the proposed change in one sentence.** Everyone works from the same brief.

3. **Run the conflict scan — mandatory, before any member speaks.** Read the proposed
   change against the existing sections of `CoachingPrinciples.md` and **name the
   conflicting section numbers explicitly** (e.g. "as written, this contradicts §12
   and weakens §1"). With 80 sections this is the single highest-value mechanical
   step, and it is the thing a human reviewer can no longer do reliably by hand.
   Check the zone-model translation rule above before recording any conflict.

4. **Run the board.** Each member, in their own voice, on *this* change. Silence from
   a seat is a valid output — say "no objection from this seat" rather than
   manufacturing a concern.

5. **Record disagreements.** Do not synthesise them away. Where two members genuinely
   differ, state both positions and what each would need to change their mind.

6. **Rule on correctness.** The chair issues one of:
   - **CORRECT** — ships, subject to the three artifacts below
   - **CORRECT WITH AMENDMENT** — ships as modified; state the modification
   - **INCORRECT** — does not ship. This is a **veto**. See ADR-017
   - **INSUFFICIENT EVIDENCE** — state exactly what evidence would settle it

7. **Escalate to the SLT if — and only if — the question is no longer about
   correctness:** correct but expensive, correct but requires data Zonna cannot
   collect, correct but changes the free/paid line, or the board deadlocks.
   Hutchinson carries it. See `/slt-review`.

8. **Produce the three artifacts.** A review that ends in prose has done nothing.

---

## The Three Artifacts

Every CORRECT ruling must terminate in all three, **in a single commit**:

| Artifact | Location |
|---|---|
| **Principle** — new or amended section, with the *why* | `docs/canonical/CoachingPrinciples.md` |
| **Numeric** — the named constant | `lib/plan/generationConfig.ts` (or sibling config) |
| **Mechanical check** — the invariant | `lib/plan/invariants.ts` + row in `docs/canonical/plan-invariants.md` |

This is existing doctrine (CLAUDE.md: *"When changing engine behaviour or adding a
coaching principle: add the invariant to `validatePlan()` in the same commit"*) —
the board is the body that produces all three together rather than leaving the third
to be remembered later.

If a change genuinely cannot be mechanically checked, say so explicitly and record
why. An unenforceable principle is a known risk, not an oversight.

**After the artifacts land:** run `scripts/r23-phase7-validation.ts` and
`scripts/property-validate-plans.ts`. A new principle that breaks the matrix is a
finding, not a build failure to route around.

---

## Output Format

```
## Coaching Board — [change name]

**Trigger:** [file(s)] — hard / soft (qualifies) / exempt
**Proposed change:** [one sentence]

---

### 🔍 Conflict scan
[Named § numbers this touches, contradicts, or weakens. "No conflicts found"
is a valid result — but only after actually scanning.]

---

### 🏃 Alex Hutchinson (Chair)
### 📊 Stephen Seiler
### 🎯 Greg McMillan
### 🩹 Rich Willy
### ⚕️ Stacy Sims

---

### ⚡ Recorded disagreements
[Where members genuinely differ, and what would settle it]

### ⚖️ Ruling
CORRECT / CORRECT WITH AMENDMENT / INCORRECT / INSUFFICIENT EVIDENCE
[Rationale. If INCORRECT, this is a veto — state what would make it correct.]

### 📦 Required artifacts
1. Principle — [§ number, new or amended]
2. Numeric — [named constant]
3. Invariant — [code, or explicit "not mechanically checkable because…"]

### ↗️ SLT escalation
[Only if the open question is commercial, not correctness. Otherwise "none".]
```

---

## Constraints

- **The conflict scan is mandatory.** Do not skip it. It is the reason this board exists.
- **The three artifacts are mandatory** for any CORRECT ruling.
- The five-zone model is canonical — translate three-zone reasoning before recording
  a conflict.
- The board rules on **correctness only**. Build cost, tier, pricing, and roadmap
  order belong to the SLT.
- Do not synthesise genuine disagreement into false consensus.
- A seat with nothing to say says nothing. Manufactured concerns waste the format.
- One change at a time unless explicitly asked for a batch.
- Never propose features requiring data Zonna cannot collect (ADR-011) without
  flagging the dependency as blocking.
