# ADR-023 — Design Board: Authority Model, Boundaries, and Automatic Convening

**Status**: Accepted
**Date**: 2026-09-22
**Authors**: Founder-authorised. Board composition proposed by the assistant, ratified by the founder.
**Related**: ADR-007 (Warm Slate), ADR-008 (single light theme), ADR-015 (display formatting singularity), ADR-017 (Coaching Board authority — the structural precedent this ADR mirrors).

---

## Context

Zonna has three layers that govern how the product looks and behaves:

1. **Pattern** — `docs/canonical/ui-patterns.md` (24 sections, ~2,750 lines),
   `ux-principles.md`, `screen-architecture.md`
2. **Token** — `app/globals.css` (ADR-007, ADR-008)
3. **Mechanical check** — `typeScale.test.ts`, `a11yContrast.test.ts`,
   `sectionSurfaces.test.ts`, `uiPatternsIntegrity.test.ts`, the `*.markup.test.ts`
   family, `clientBundleBoundary.test.ts`, `noEmDash.test.ts`, and the pre-commit style
   hook

This is the same three-layer shape ADR-009 and ADR-017 describe for coaching, and it
has the same hole: **the layers guarantee the product honours what has already been
decided, and none of them can tell you whether the decision was right.** A markup test
enforces a dull screen with perfect fidelity.

Four further gaps motivated this ADR.

**1. Design decisions were being taken by whoever was in the room.** The SLT ruled on
the homepage, on the website slickness programme, on copy patterns, on the PlanArc, and
on the Miles teardown. Its five seats are behavioural, commercial, product and
scientific. **Not one is a designer.** Design verdicts were reaching the founder as
engineering tickets or, in at least one recorded case, as *"a taste call made against
the documented rule"* taken by the assistant alone.

**2. Settled ground was being re-litigated, measurably.** On 2026-09-21 the v3 design
handoff asked for alternating warm bands, two ink bands, and a paper-grain overlay.
**All three had already been decided against, two of them the same day.** The same day,
`--surface-moss-wash` was added and deleted within eight hours because *the rule and the
token lived in different documents and had never met.*

**3. Design rulings had no register.** The Coaching Board learned in public that a
process whose memory depends on someone remembering to write it down has no memory
(`coaching-rulings.md`). Design had no equivalent file at all.

**4. Review depended on remembering to ask for it.** This repo already carries a
standing correction that exists solely because the `frontend-design` skill kept being
skipped for UI work. A gate that relies on remembering is not a gate.

---

## Decision

**A five-seat Design Board is established as the governing body for UI and UX. It sits
below the SLT and above build.**

### 1. Composition

| Seat | Lens |
|---|---|
| **Julie Zhuo** — Chair | Product design judgement: is this a decision or a preference, and what is it for? |
| **Miklu Silvanto** — CDO ŌURA, ex-Apple Industrial Design | Craft and legibility: does the screen show what matters *now* before what matters *over time*? Depth through progressive disclosure, not density. **⛔ Scoped veto: palette or type regression against `brand.md`** |
| **Kathy Sierra** | The customer: is the runner getting better, or is the app getting more engaging? |
| **Luke Wroblewski** | Interaction and input: what is it like to use, on a phone, with one hand? |
| **Brian Collins** — COLLINS | Structure and brand challenge: quiet because it's right, or quiet because it's safe? **Collapses taxonomies** — too many session types, phases, tabs? Can challenge the veto; **cannot override it** |

Full lens definitions, tone, and scope notes: `.claude/skills/design-board/SKILL.md`.

**The chair has final say inside the board**, subject to one scoped veto. The chair runs
the settled-ground scan, records dissent, issues the ruling, and carries escalations.

### 1a. The scoped veto — Silvanto, on palette and type regression

**Silvanto's seat may veto a change that regresses the palette or the type scale
against a documented rule.** Three constraints make it narrow rather than a second
chair:

1. **It covers a REGRESSION against a documented rule, not a disagreement about taste.**
   Exercising it requires **naming the rule** in `brand.md` or `ui-patterns.md`. A veto
   with no named rule is a preference, and the chair refuses it as one.
2. **It operates inside the board only.** It is not the Coaching Board's correctness
   veto: it does not bind the SLT, which may still overturn the resulting ruling on
   commercial grounds (§4), and that overturn is recorded like any other.
3. **The route around it is to change the rule, not to outvote the seat.** A sustained
   veto makes the ruling DON'T SHIP. Anyone who thinks the rule is wrong proposes
   amending it as its own ruling, which is a visible act with a register row.

**Collins can challenge a veto and cannot override it.** That asymmetry is deliberate:
his seat exists to push against restraint, and a challenge seat that could overrule the
regression seat would make the documented visual rules advisory.

**Why this seat and not the chair.** The two measured design failures in this repo's
record are exactly this shape and neither was caught by judgement in the room: a fourth
ground added to a site that had been deliberately cut to three (`--surface-moss-wash`,
added and deleted inside eight hours), and a type scale that had silently become **170
hand-typed sizes with an H1:H2 step of 1.02×** — no hierarchy at all, invisible by
looking. A standing seat whose specific job is to notice that class is cheaper than
rediscovering it.

### 2. Rulings

**SHIP · SHIP WITH AMENDMENT · DON'T SHIP · INSUFFICIENT EVIDENCE · ESCALATE.**

A DON'T SHIP may be marked **permanent** by the chair, which lands it in
`design-rulings.md` as a kill that may not be re-proposed without named new evidence.

### 3. Boundaries

> **Ownership is owned elsewhere, deliberately.** `docs/canonical/ownership-map.md` is
> the single owner of the full scope table for all three bodies plus the founder. This
> section states the principle; the map holds the list, and nothing else restates it.

**The seam rule, ratified 2026-09-22:**

> **Design owns the encoding. Coaching owns the meaning. The SLT owns the price.**

It generalises what P-01 already did — the Design Board re-pointed `--moss` to mean
*"held the zone"*, the Coaching Board kept `ZONE_DRIFT_ABOVE_CEILING_PCT = 20` — so the
seam cases (the session colour map, the zone bar, a marketing page making a training
claim) resolve by rule rather than by argument each time.

**What the board owns.** Layout, hierarchy, spacing, type, colour, motion, interaction,
component anatomy, screen jobs, states, the design tokens, and the marketing site's
visual and experiential design. ADR-007 and ADR-008 are amendable by this board, by
recorded ruling. **Ratified additionally 2026-09-22:** `lib/format.ts` (ADR-015 display
formatting), `promptDistanceFormatters` (the AI layer as a display surface), AIMark
provenance, and whether a copy string exists and where it sits.

**What binds the board and is owned elsewhere.**

| Domain | Owner | Rule |
|---|---|---|
| What the engine prescribes | Coaching Board | Route down before ruling. A pixel may present a prescription; it may not change one |
| Any claim about outcomes, physiology, or what training does — **on any surface, including marketing** | Coaching Board | W-03 is the precedent: a homepage commitments block was a coaching question and was killed as one |
| FREE/PAID line, pricing, build cost, roadmap order | SLT | Escalate |
| Locked brand strings (`BRAND.tagline`, `marketingH1`, `brandStatement`, `voiceAnchor`) | Founder / `brand.md` | Placement and treatment are the board's. The words are not |
| Copy tone and voice | `brand.md` | Whether a string exists, and where it sits, is the board's. How it sounds is not |

> ⚠️ **Do not let five design lenses ratify a coaching change that no coaching seat has
> examined.** This is the mirror of ADR-017's warning about the SLT, and the failure
> mode is identical.

**Unresolved at ratification, and deliberately so.** Several rules that read as design
doctrine currently live in `brand.md` § Visual Principles — *"one job per screen, no
dashboards, no noise"*, *"calm guidance, not alerts"*, *"restraint = progress"*, *"no
chrome"*. Whether these transfer to the Design Board or remain brand doctrine is
**the first sitting's business.** Until ruled, they bind the board and the board may not
overturn them alone.

### 4. Relationship to the SLT — no veto

The Coaching Board holds a **correctness veto** the SLT cannot overrule on commercial
grounds (ADR-017, INV-COACH-003). **The Design Board holds no equivalent**, and the
asymmetry is deliberate: coaching correctness is closer to an objective property, and a
wrong prescription injures a runner. Design is judgement plus evidence.

⚠️ **Do not confuse this with §1a.** Silvanto's scoped veto operates *inside* the board
and stops a regression reaching a ruling. It does not travel upward: a Design Board
ruling, vetoed or not, remains overturnable by the SLT on commercial grounds.

Therefore:

- A Design Board ruling **binds build**.
- The **SLT may overturn it on commercial grounds** — cost, tier, sequencing, revenue.
- **Every overturn is recorded** in `design-rulings.md` with the commercial reason, so
  a pattern of overturning design on cost is visible rather than accumulating silently.
- A **Coaching Board INCORRECT ruling binds absolutely**, over both bodies.

### 5. Escalation route

The chair carries escalations to the SLT.

**Amended 2026-09-22, and the amendment closes what this ADR called its weakest joint.**
At ratification the Design Board held no SLT seat and Sutherland sponsored its
escalations — a weaker substitute, because ADR-017's escalation works precisely *because*
Hutchinson holds both a chair and a seat and therefore **is** the mechanism.

**Zhuo now holds an SLT seat and chairs this board**, the same dual-hat structure. The
SLT stays at five: **Des Traynor's commercial seat was stood down** and Zhuo took it in
the same capacity.

> ⚠️ **State the consequence rather than discovering it mid-sitting.** With Traynor stood
> down, **no SLT seat asks "what happens to churn if we don't build this, and to
> conversion if we do?"** Fried is nearest, but his lens is product value and calm
> software, not commercial mechanics: he will kill surface area, not price it. Traynor is
> **recallable, not deleted**. **Recall trigger:** any of revenue, a measurable
> trial-to-paid rate, a redeemed-code funnel, or meaningful installs — i.e. data for the
> lens to read. His own standing objection was *"what is the traffic?"*, and the record
> notes every ranking he took part in was a judgement about plausibility, not evidence.

### 6. Automatic convening

`.claude/hooks/design-guard.py` fires as a `PreToolUse` hook on
`Edit|Write|MultiEdit|NotebookEdit` **and on `Bash`**, matching the doctrine files in
§ Hard trigger of the skill. Advisory by default.

**The Bash path is not optional, and the reason is recorded.** For a year the coaching
guard matched only the dedicated file tools, so every doctrine edit made through Bash —
`sed -i`, a heredoc, `cat >` — passed with no guard, no prompt and no trace. That is the
path a session told to prefer Bash for file edits uses for everything. The design guard
ships with the Bash path from day one.

**Reads win ties, deliberately.** A doctrine path in a Bash command is necessary but not
sufficient: the command must also carry a write signal. `sed -n '1,40p'` and `grep` on
`ui-patterns.md` are dozens-of-times-a-session operations, and a guard that fires on
those gets switched off, which this repo has twice recorded as equivalent to having no
guard.

### 7. The three artifacts

Every SHIP ruling terminates in all three, in a single commit:

1. **Pattern** — a section in `ui-patterns.md` / `ux-principles.md` /
   `screen-architecture.md`, with the *why*
2. **Token or named constant** — in `globals.css` or a named constant. Never a literal
   in a component
3. **Mechanical check** — a test, or an explicit *"not mechanically checkable
   because…"*

Plus, always: a row in `design-rulings.md` and a decision note in `docs/decisions/`.

**The check is falsified before it is trusted.** This repo has shipped a green tick with
nothing behind it more than once.

### 8. Evidence standard

**Where a measurement exists, the board rules on it, and names the surface and the
method.**

The website audit found no type scale at all (170 hand-typed sizes, 30 half-pixels) and
an H1:H2 step of 1.02×. None of that was visible by looking. In the same period: a
headless capture was read as a clipped layout and was a **capture artefact**; a real
cross-fade defect was **dismissed as** one; `scrollWidth === innerWidth` stayed true
while a 320px gutter collapsed to 5px; and *"their palette is ours"* was true of one
surface by one method and false of another surface by another.

---

## Consequences

**Positive**

- UI and UX decisions get five qualified lenses instead of being absorbed by a
  commercial board or taken alone as a taste call.
- Settled ground is scanned mechanically before a sitting, not recalled. The
  measured re-litigation failures above become detectable.
- Design gains the artifact discipline the engine has had since ADR-009: a pattern, a
  token, and a check that has been made to go red.
- Overturns are visible. A pattern of design losing to cost becomes a fact rather than
  a feeling.

**Negative, accepted**

- **A third board is process.** Three bodies now sit between an idea and a build. The
  mitigation is the exemption path and a soft trigger that asks one question: would a
  user notice, and would they have to learn something new?
- **No veto over the SLT means design can be overruled on cost.** Deliberate. The
  record of the overturn is the mitigation.
- **The scoped veto (§1a) gives one seat asymmetric power over the palette and type
  scale.** Accepted, and bounded three ways: it requires a named rule, it covers
  regression rather than taste, and it does not reach the SLT. ⚠️ **The failure mode to
  watch is scope creep** — a veto exercised on "this feels wrong" rather than a named
  regression. The chair refusing an unnamed veto is the control, and it is a judgement
  call rather than a mechanical one.
- **The escalation joint is weak until the chair holds an SLT seat.** Named in §5.
- **The board's mandate contains a real tension.** Stand out, wow factor, make people
  feel something, on a product whose documented aesthetic is austere. That tension is
  the reason for the Collins seat and the reason the first sitting is a review of the
  restraint rules themselves.

**Neutral**

- `/frontend-design` is unchanged in scope but subordinate: **the Design Board decides,
  `frontend-design` builds.** A build that departs from a ruling is a defect.

---

## Invariants

- **INV-DESIGN-001** — A hard-trigger doctrine file may not be edited without a Design
  Board ruling or a stated one-line exemption. Hook-enforced, both tool paths.
- **INV-DESIGN-002** — Every Design Board ruling appends a row to
  `docs/canonical/design-rulings.md` in the same commit, including DON'T SHIPs.
- **INV-DESIGN-003** — A SHIP ruling lands a pattern, a token or constant, and a
  mechanical check (or an explicit statement that it cannot be checked) in one commit.
- **INV-DESIGN-004** — A design change that alters what the engine prescribes, or that
  makes a claim about outcomes or physiology on any surface, routes to the Coaching
  Board before the Design Board rules.
- **INV-DESIGN-005** — An SLT overturn of a Design Board ruling is recorded in
  `design-rulings.md` with its commercial reason.
- **INV-DESIGN-006** — A palette or type veto names the rule in `brand.md` or
  `ui-patterns.md` being regressed against. An unnamed veto is refused by the chair.

⚠️ **INV-DESIGN-002 is now GATED (2026-09-22).** `ship-record-check.py` fires on a
`feat`/`fix` commit that edits design doctrine (`ui-patterns.md`, `ux-principles.md`,
`screen-architecture.md`, `app/globals.css`) **without** a matching change to
`design-rulings.md`. Deliberately narrow: it does **not** fire on ordinary UI commits,
engine work or markup tests, because a guard that fires on everyday work gets switched
off, which this repo has twice recorded as equivalent to having no guard. Falsified in
both directions; 11 cases in `ship-record-check.test.py`.

⚠️ **INV-DESIGN-003 and 005 remain architectural, not mechanically checked.** Nothing
verifies that a SHIP ruling's *three artifacts* all landed, or that an SLT overturn was
recorded with its commercial reason. Stated as invariants so the gap stays visible.
