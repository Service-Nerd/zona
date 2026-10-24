# Design Board — NO-RUNNER-TURNED-AWAY-01 (2026-10-24)

**Trigger:** hard. A new plan state (a race plan that starts with base building and a checkpoint), a new moment (the
checkpoint) and a new screen state (the checkpoint's outcome). Coaching has ruled the meaning
(`docs/decisions/coaching-2026-10-24-no-runner-turned-away.md`); this sitting rules the encoding.
**Tier:** every tier (a refused runner was free or comped; the plan itself is never gated).

## Settled-ground scan

| Ruling | Effect |
|---|---|
| **`REFUSAL-SCREEN-01`** | The "not yet" view. **Base volume stops reaching it**; §44/§52 still do, unchanged |
| **`PreviewPhaseStrip` DON'T SHIP** | Two bar-like rows where height meant different things. **Binding:** the checkpoint may not add a second bar row beside `PlanArc` |
| Foundation `PhaseSummaryCard` (*"Pre-plan easy running"*) | **The pattern exists.** A pre-race phase already renders as a phase card. Reused, not reinvented |
| **`MODIFY-CONFIRM-DIFF-01`** | A structural change is a **consent screen**, not a reveal: *"what changes"*, the accepted value outranks the old, one factual sentence of why from a named owner, **never a training-effect claim**; chart / illustration / ceremony DECLINED |
| **`BASEBUILD-ADJUST-DOOR-01`, `-REBUILD-01`** | An affordance is withheld when the ACTION cannot succeed, and offered only where it changes the producer's output. Applies to what a staged plan can adjust before its checkpoint |
| **§118 SLT name** | **"Base building"**, chosen by the SLT for what it says to a runner who does run. Settled |
| ADR-012 | Structural changes surface for confirmation. The not-passing outcome is one |
| **Website** | `PlanArc` and `PhaseSummaryCard` also render on marketing surfaces. Any change must be additive and leave marketing output identical |

## The board

**🧭 Zhuo (chair).** What is this for? So that the answer to "I want to run London" is never "no". The success
condition, stated before any design: **a runner at 10 km a week who asks for a marathon lands on the plan preview of
their marathon, with base building as its first phase and the checkpoint's date on it, and never sees the refusal
view.** That is observable, and its failure is countable: the refusal view reached on a base-volume refusal, which
should be zero.

**✋ Silvanto.** Hierarchy of horizon. Today is today's run; the checkpoint is an over-time fact and belongs on Plan.
Today mentions it only in the final week of base building, in the coach-note slot it already has. The race block
before the checkpoint is not a plan yet, so it must not look like one: an **outline**, no filled bars, no session rows,
from tokens that exist (`--line`, `--mute`). No new colour, no new size. No veto.

**🎓 Sierra.** The checkpoint is the most useful sentence this product will ever say to a beginner, because it is
about them: *"You ran 11.6 km a week."* That is a fact they can learn to feel. So the figure shows, plainly, and there
is **no progress meter toward 12**: a bar filling up turns a coaching threshold into a game they can cheat by logging
a walk. If the checkpoint does not pass, the runner must leave it **more capable**, choosing between real options, not
being told they failed.

**📱 Wroblewski.** Three things about using it. The outcome screen is at most **three options, the recommended one
first, one tap**, each saying what it changes, which is `MODIFY-CONFIRM-DIFF-01`'s shape. The checkpoint **asks
nothing**: it reads what was logged. And there is a state nobody has drawn yet: **no runs recorded at all** (an
iPhone-only runner who never logged). That gets its own screen, saying so, with logging runs or connecting Apple Health
as the first option, because the coaching ruling is observed volume and a typed number is not that.

**🎪 Collins.** The taxonomy. Internally this has five names: foundation, base build, on-ramp, get-running, pre-plan.
A runner sees one thing: easy weeks before the training proper. **One runner-facing name, "Base building"**, the
SLT's, and the other four stay in the code. I would also rename foundation weeks to it; that is a separate decision
with its own surfaces, and I will not win it bolted onto this one.

## Recorded disagreements

**Collins and the chair on foundation weeks.** Collins: rename them "Base building" now, one name everywhere. Zhuo:
foundation fills a long runway for a runner who already has a base, which is a different job, and renaming it needs
its own sitting. **Filed, not ruled:** `FOUNDATION-NAME-COLLAPSE-01`.

## Ruling

**SHIP WITH AMENDMENT** (the encoding for the build):

| # | Amendment | Seat |
|---|---|---|
| 1 | A base-volume refusal no longer reaches the refusal view: the wizard lands on the **race plan's preview** | Zhuo |
| 2 | Base building is the **first phase**, rendered by the existing `PhaseSummaryCard`, and names the **checkpoint**: its week and the volume it asks | Zhuo, Silvanto |
| 3 | The race block before the checkpoint is an **outline**: an additive `PlanArc` prop for the not-yet-built weeks, and a phase card saying it is built after the checkpoint. **No session rows. No second bar row** (`PreviewPhaseStrip`) | Silvanto |
| 4 | Today names the checkpoint **only in the last week of base building**, in the existing coach-note slot | Silvanto |
| 5 | The checkpoint shows the **observed weekly figure, plainly; no progress meter** | Sierra |
| 6 | Passing: one line on Today and the plan fills in. **No ceremony** (`MODIFY-CONFIRM-DIFF-01`'s decline stands) | Sierra, Zhuo |
| 7 | Not passing: a **consent screen**, at most three options, recommended first, each saying what it changes, one factual sentence of why with the observed figure, never a training-effect claim | Wroblewski, Sierra |
| 8 | **No runs recorded**: its own state, first option to log runs or connect Apple Health; never a typed number | Wroblewski |
| 9 | The 0 km/week start renders the same way, as a "Walk-run start" first phase | Zhuo |
| 10 | One runner-facing name, **"Base building"**; "on-ramp", "get-running", "pre-plan" stay internal | Collins |

## Artifacts (at build)

1. **Pattern** — `ui-patterns.md` § *Staged race plan*: the phase card, the outline, the checkpoint line, the
   outcome consent screen, the no-data state.
2. **Token / constant** — no new colour or size; the outline from `--line`; the checkpoint's copy from one owner
   (`lib/plan/checkpointCopy.ts`, the pattern of `baseBuildCopy.ts`).
3. **Checks** — a markup arm that a base-volume refusal with a staged plan available never renders `RefusalView`;
   a `PlanArc` arm that the outline renders only for not-yet-built weeks and that marketing output is unchanged;
   an arm that no meter element exists on the checkpoint. Each falsified.
4. **Register row** — `design-rulings.md`.

## Routing

- **Founder** — the words: the checkpoint line, the outcome screen, the no-data state, "Walk-run start".
- **Build** — after the words. The coaching artifacts and these land together.

## What this does not settle

The words, and foundation weeks' name (`FOUNDATION-NAME-COLLAPSE-01`). Nothing has been drawn on a device.
