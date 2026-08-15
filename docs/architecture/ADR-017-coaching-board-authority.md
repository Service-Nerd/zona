# ADR-017 — Coaching Board: Authority Model and Automatic Convening

**Status**: Accepted
**Date**: 2026-08-15
**Authors**: Founder-authorised; board composition researched and confirmed 2026-08-15.
**Related**: ADR-009 (config-driven generation), ADR-010 (session catalogue), ADR-012 (reshape authority — the precedent for a board framing deciding an architecture).

---

## Context

Zonna has three governance layers for coaching:

1. **Principle** — `docs/canonical/CoachingPrinciples.md`
2. **Numeric** — `lib/plan/generationConfig.ts → GENERATION_CONFIG`
3. **Mechanical check** — `lib/plan/invariants.ts → validatePlan()`

ADR-009 established the config layer; the invariant registry (`plan-invariants.md`)
established the enforcement layer. Together they guarantee the engine honours what
has already been decided.

**None of them can tell you whether the decision was right.** `validatePlan()` will
enforce a bad principle with perfect fidelity. The constitution has grown to 80
sections across ~1,600 lines — past the point where any single reviewer can reliably
hold it in working memory and notice that a proposed principle contradicts an
existing one. Conflict detection across the corpus is now the binding constraint on
coaching quality, and it is a task humans do badly and reviewers skip.

Two further gaps motivated this:

- **The SLT could not fill it.** Its five seats are behavioural, commercial, and
  product. Hutchinson alone carries coaching correctness, and a single seat cannot
  cover physiology, intensity distribution, practical amateur coaching, injury load,
  and female physiology. In practice coaching changes were being ratified by a body
  with one qualified voice.
- **Review depended on remembering to ask for it.** Skill-description triggering has
  a documented failure history in this repo — a standing correction exists solely
  because `frontend-design` kept being skipped for UI work. A governance gate that
  relies on the founder remembering is not a gate.

---

## Decision

### 1. A Coaching Board is established as the layer above the existing three

If `validatePlan()` is the judiciary and `GENERATION_CONFIG` is the statute book, the
Coaching Board is the legislature. It authors and amends the constitution. It does
not re-litigate enforcement — that is what the invariants are for.

Implemented as the `coaching-board` skill (`.claude/skills/coaching-board/SKILL.md`).

### 2. Five seats, chaired by Hutchinson

| Seat | Member | Lens |
|---|---|---|
| Chair — performance science | **Alex Hutchinson** | Is it correct and defensible to an experienced runner? |
| Intensity distribution | **Stephen Seiler** | Is the distribution real, and does it hold for *this* population? |
| Practical coaching | **Greg McMillan** | Does it survive contact with a real runner's week? |
| Injury & load | **Rich Willy** | What is the injury vector? Does tissue tolerance keep up with fitness? |
| Female physiology | **Stacy Sims** | Does it hold for the women using it, or was it derived from male subjects? |

Seats were selected for non-overlap and for direct relevance to the day-job amateur.
Two deliberate properties:

- **Seiler is the authority on Zonna's own failure mode.** His recreational-athlete
  work found that amateurs do not look like the pros — they look like threshold
  athletes, because a 90-minute window is where every session drifts when you want to
  feel like you worked. That is the product thesis, described by the researcher who
  measured it. He also carries the counterweight: elite-derived 80/20 ratios should
  not be applied uncritically to a four-hour-a-week runner.
- **Sims and Hutchinson genuinely disagree** on cycle-phase periodisation, parts of
  which are actively contested. This is preserved deliberately. A recorded
  disagreement between two qualified people is a better output than false consensus.

### 3. The board rules on correctness, and that ruling carries a veto

The chair issues one of: **CORRECT**, **CORRECT WITH AMENDMENT**, **INCORRECT**, or
**INSUFFICIENT EVIDENCE**.

**An INCORRECT ruling is a veto. The SLT cannot overrule it on commercial grounds.**
No conversion argument makes wrong coaching right. "Credibility over cleverness" is a
positioning commitment, not a preference — and the population Zonna serves is the one
least equipped to detect bad prescription on their own.

The SLT retains full authority over everything that is not correctness: whether to
build, what tier, what order, what it costs. Where the Coaching Board's open question
becomes commercial — correct but expensive, correct but requires data Zonna cannot
collect (ADR-011), correct but moves the free/paid line, or the board deadlocked —
Hutchinson escalates, using the SLT seat he already holds.

### 4. Every CORRECT ruling terminates in three artifacts, in one commit

| Artifact | Location |
|---|---|
| Principle (new or amended §, with the *why*) | `docs/canonical/CoachingPrinciples.md` |
| Numeric (named constant) | `lib/plan/generationConfig.ts` or sibling config |
| Mechanical check | `lib/plan/invariants.ts` + row in `plan-invariants.md` |

This restates existing doctrine rather than inventing it — CLAUDE.md already requires
the invariant in the same commit as the principle. The change is that the board is the
body that produces all three *together*, instead of the third being left to memory.

Where a principle genuinely cannot be mechanically checked, that must be stated and
recorded. An unenforceable principle is a known risk, not an oversight.

### 5. Convening is automatic, not remembered

Because the Configuration Singularity concentrates coaching decisions into a small set
of named files, the trigger is a file-path match rather than a judgement call. Three
enforcement layers, mirroring the existing hook idioms:

| Layer | Mechanism | Catches |
|---|---|---|
| **PreToolUse** | `.claude/hooks/coaching-guard.py` on `Edit\|Write\|MultiEdit` | The edit before it lands |
| **SessionStart** | `.claude/hooks/session-start.sh` doctrine check | A change already in flight from a prior session |
| **PostToolUse** | `git commit` hook, extended | A doctrine commit missing its artifacts |

**Hard-trigger files:** `CoachingPrinciples.md`, `session-catalogue.md`, `zone-rules.md`,
`coaching-rules.md`, `generationConfig.ts`, `planSignatures.ts`, `sessionFormat.ts`.

**Soft trigger** (`ruleEngine.ts`, `invariants.ts`, `lib/coaching/*`) is deliberately
*not* hook-enforced. Those files carry ordinary bug fixes, and a hook that fires on
every one of them would be disabled within a week — which is the same outcome as having
no hook. The judgement question stays with the skill: *does this change what the engine
prescribes, in a way a coach would notice?*

The PreToolUse guard defaults to advisory injection rather than hard denial
(`HARD_BLOCK = False`), because the party that forgets is the assistant, not the
founder, and an injected instruction is sufficient for that. The flag exists to
escalate to denial if advisory proves too easy to sail past.

### 6. The five-zone model is canonical

`CoachingPrinciples §14` defines five zones: **Z2 is easy** (60–70% HRR / 70–80% MHR)
and easy runs are capped at the top of Z2 (§12); **Z3 is the grey zone**.

Seiler's published work uses a three-zone model in which the moderate/threshold band is
labelled **Zone 2** and called the grey zone. These are opposite meanings of the same
label. Three-zone reasoning must be translated on the way in. This is recorded here
because zones are the brand, and an untranslated collision would generate confident,
entirely phantom conflicts on the board's first review.

---

## Consequences

**Positive**

- Coaching correctness gains a qualified, multi-lens body instead of one seat on a
  commercial board.
- Conflict detection across 80 principles becomes a mandatory mechanical step rather
  than a thing a tired reviewer might do.
- The third artifact (the invariant) stops being the one that gets forgotten, because
  a ruling is not complete without it.
- The gate cannot be skipped by forgetting, which is the failure mode that actually
  occurs.

**Negative / accepted**

- Two boards for a one-person company. Accepted because the trigger is narrow and the
  volume is low — the constitution is amended on the order of monthly, not weekly.
- A doctrine edit now carries review latency. Mitigated by the explicit exemption path:
  defect fixes restoring documented intent, formatting, and no-behaviour-delta
  refactors proceed on a stated one-line exemption.
- Advisory-mode PreToolUse can be sailed past by an inattentive session. Accepted for
  now; `HARD_BLOCK` is the escalation.
- The board can rule INCORRECT on something commercially attractive. That is the
  point, not a defect.

**Explicitly not adopted**

- **A sixth SLT seat for opportunity cost.** Considered and declined 2026-08-15. Build
  economics stays with Fried and Traynor.
- **Hook-enforcing the soft-trigger files.** Rejected as self-defeating, per §5.
- **Benno Nigg for the injury seat.** His paradigms are impact, pronation, and footwear
  biomechanics; ADR-011 confirms `@capgo/capacitor-health` exposes no gait, cadence, or
  stride data. He would be advising on data Zonna cannot collect.
- **Matt Fitzgerald for the coaching seat.** Closest thesis alignment (*80/20 Running*),
  but he co-founded 80/20 Endurance — a direct competitor in training plans — and the
  seat would be committed to his own commercial framework.

---

## References

- **Skill**: `.claude/skills/coaching-board/SKILL.md`
- **Hook**: `.claude/hooks/coaching-guard.py` (+ `coaching-guard.test.py`)
- **Constitution**: `docs/canonical/CoachingPrinciples.md`
- **Enforcement registry**: `docs/canonical/plan-invariants.md`
- **Invariant**: `INV-COACH-001` (architectural-principles skill)
- **Upstream ADRs**: ADR-009 (config-driven generation), ADR-010 (session catalogue), ADR-011 (data source doctrine), ADR-012 (reshape authority)
- **SLT interface**: `.claude/skills/slt-review/SKILL.md` § Relationship to the Coaching Board
