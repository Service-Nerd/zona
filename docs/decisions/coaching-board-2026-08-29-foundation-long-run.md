# Coaching Board Ruling — Foundation long run (CD-20)

**Date:** 2026-08-29
**Convened by:** hard trigger — `CoachingPrinciples.md` §57, `generationConfig.ts`, `invariants.ts`
**Board:** Hutchinson (chair) · Seiler · McMillan · Willy · Sims
**Evidence:** `docs/investigations/onboarding-audit-2026-08-29.md` (Coaching-1)
**Authority:** ADR-017. Continues the CD numbering (last: CD-19).

**Status of this document.** Signed ruling record. Engineering proceeded from here.
Shipped in commit `f9d609f`.

**Written for:** a coach. Implementation detail lives in the audit and the commit.

---

## What the board was asked

A fresh-account audit of onboarding and plan generation flagged the Foundation
Block — the optional easy-running phase inserted before Week 1 when a runner
generates a plan well ahead of their start date. Two questions:

1. The block places its easy runs on consecutive days (e.g. Mon/Tue/Wed) with no
   rule spacing them out. Is that wrong? Does the block need a session-spacing
   rule?
2. A traced 10K plan produced a ~15 km long run inside a Foundation week. Is the
   long run too big?

## Rulings at a glance

| # | Decision | Ruling |
|---|---|---|
| **CD-20a** | Does the all-easy Foundation block need a session-spacing rule? | **CORRECT AS-IS** — no rule added |
| **CD-20b** | Is the Foundation long run capped correctly? | **CORRECT WITH AMENDMENT** — cap 50% → 35% of the week |

---

## CD-20a — Session spacing

**Today.** The Foundation block is easy Zone-2 running only — no quality, no
intervals, no strides. It puts the easy runs on the first available days of the
week and the long run on the runner's chosen day.

**Why it was in question.** The runs land on consecutive days, and the audit
observed four running days in a row.

**Ruling: CORRECT AS-IS.** No spacing rule is added.

Every seat agreed. Running easy days back-to-back at controlled, low volume is
ordinary base-building — it is how you build aerobic volume, and tissue tolerates
frequent low load better than one big dose (Willy). At three or four easy runs a
week there is no meaningful distribution to prescribe — the question is undefined
at that session count, exactly as it is for a two-run week (Seiler, echoing §5).
Adding a rule the runner has to *understand* — "your easy days must be spread
out" — for no demonstrated benefit is over-coaching, the thing this board exists
to prevent as much as under-coaching (McMillan, Hutchinson). The stronger version
of the original observation — a big long run sitting immediately after three easy
days — was largely an artefact of a separate placement bug (the long run was being
forced onto the wrong day), already fixed independently.

## CD-20b — Foundation long run

**Today (before this ruling).** The Foundation long run could be as large as half
the week's mileage. On a runner whose week has deliberately been scaled down —
this block often serves someone returning after a break — that means one run
carrying 50% of the week.

**Why it was in question.** The plan's own long-run principle (§9) says a long run
above **35% of weekly volume is a binge** — fatigue accumulates faster than
aerobic gain. The Foundation block is *before* the base phase; it should if
anything be gentler on the long run than base (which targets 28%), not nearly
double it.

**Ruling: CORRECT WITH AMENDMENT.** The cap drops from 50% to **35%** of the
week, bringing the Foundation block in line with §9's own threshold.

This is Willy's and Sims's finding, and they carried it. Foundation is precisely
where a runner's heart and lungs are ahead of their bones, tendons and connective
tissue — returning and novice runners with detrained structures. A long run at
half of a reduced week is a concentrated load spike into exactly that gap, and for
the peri- and post-menopausal women in this demographic it is a concentrated
bone-stress event early in a rebuild (Sims). Hutchinson framed it as an
internal-consistency fix rather than a new claim: the number simply contradicted
§9, and you cannot hold both. The absolute guard — the long run never exceeds the
runner's own recent longest run — stays in place, so this only stops the long run
*dominating* the week; it does not shorten a long run that was already within
recent experience.

---

## Conflict scan (recorded)

- **§9** — the amendment brings §57 into agreement with §9's 35% binge threshold;
  resolves a live contradiction.
- **§7** (48h quality↔long spacing) — does not apply; Foundation has no quality.
- **§5** (distribution undefined at low session counts) — supports CD-20a.
- **Zone model** — Foundation is all Z2 *easy*; consecutive easy days are not a
  "too much Zone 2/grey-zone" problem. Checked, not a conflict.

## Artifacts (shipped, `f9d609f`)

1. **Principle** — §57 long-run line 50% → 35%, with the why.
2. **Numeric** — `GENERATION_CONFIG.FOUNDATION_LONG_RUN_MAX_PCT` 50 → 35.
3. **Invariant** — `INV-PLAN-FOUNDATION-BLOCK` gains a long-run-fraction arm
   (longest run ≤ 35% of the week, scoped to ≥3-run weeks) + `plan-invariants.md`
   row. Tests in `lib/plan/foundationLongRunCap.test.ts`.

## SLT escalation

None — correctness fix, no tier/cost/data-collection implication.

## Follow-ups (engineering, not board matters)

Two pre-existing defects were surfaced while implementing this and are **not**
coaching questions:

- `INV-PLAN-FOUNDATION-BLOCK`'s volume arm rejects `> current_weekly_km`, but §57
  permits growth to `baseline × 1.10`. Too strict — false-flags a legitimate
  multi-week block.
- Foundation weeks are assembled client-side after the API returns and are never
  re-run through `validatePlan`, so `INV-PLAN-FOUNDATION-BLOCK` is dormant in the
  live path. The config change protects runners via the generator regardless; the
  invariant is a backstop that needs wiring in.

Both tracked in the onboarding audit and fixed as an engineering follow-up.
