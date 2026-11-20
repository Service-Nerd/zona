# Coaching Board — 2026-11-20 (follow-up). `TUNE-UP-CALLOUT-INERT-01`: may the §32 tune-up land on a ramp-flagged week?

**Trigger:** soft, qualifies — the answer changes which week the engine offers a race-effort suggestion on
(`lib/plan/ruleEngine.ts` §32 stamp, `INV-PLAN-TUNE-UP-CALLOUT`), and amends §32. Hand-off from the Design Board
(`design-2026-11-20-tune-up-callout-inert-01.md`, ruling 3) — **settled ground, not re-ruled**.
**Proposed change:** the §32 tune-up is never offered on a week that carries a ramp violation; it moves to the latest
non-deload build week that carries none, or is not offered.
**Question (b) is NOT sat:** the SLT approved the surface this afternoon (`slt-2026-11-20-tune-up-callout-inert-01-followup.md`),
so §32's enforcement claim is not amended to say "not surfaced".
Seats: Hutchinson (chair), Seiler, McMillan, Willy, Sims. Blagrove silent (no strength content).

---

## 📐 Analysis — the "13 in 58" re-derived

Command: `NODE_ENV=production npx tsx scripts/board-evidence-tune-up-callout-inert-01-followup.ts <stride> both`
(read-only; engine plans in memory through `generateRulePlan` + `composePlanWithFoundation`, the producer's own path;
ramp weeks read from `validatePlan()` filtered by `RAMP_RESIDUAL_CODES`, the list the note itself reads). Two odd strides.

| Figure | Morning note | Stride 131 | Stride 97 |
|---|---|---|---|
| Plans generated (threw) | 304 (13) | **304 (13)** | **413 (15)** |
| Carry the tune-up | 304 | **304** | **413** |
| Carry the ramp note (`load_residual_week`) | 58 | **58** | **74** |
| **Tune-up week = the note's week** | **13 of 58** | **13 of 58 (22%)** ✅ | **13 of 74 (18%)** |
| Tune-up week carries ANY ramp violation | not measured | **18 of 304 (5.9%)**; 5 where the note names a different week | **17 of 413 (4.1%)**; 4 |
| Rise on that week (min / median / max) | — | 20.3 / 27.3 / 56.7 % | 20.3 / 29.0 / 40.0 % |
| Collisions' phase; weeks to first peak week | — | build 13; **1** on all 13 | build 13; **1** on all 13 |
| Quality sessions already in that week | — | 1 on 11, 0 on 2 | 1 on 9, 0 on 4 |
| Race distance of the collisions | — | HM 11, 10K 1, 5K 1 | HM 13 |
| An earlier non-deload build week with no ramp violation exists | — | **13 of 13, one week earlier on all 13** | **13 of 13, one week earlier on all 13** |
| **Production** (43 live plans) | 1 carries both, not same week | **1 carries both, same week 0** | — |

**What moved:** nothing in the item's figure — 13 of 58 reproduces exactly. The question was asked about the one week the
note names; the population that matters is wider (any ramp-violated tune-up week: 18, not 13). The collisions are
structural, not random: §32 picks the week immediately before peak, and that is where a half-marathon build's delivered
volume rises past §2's cap.

**What the evidence cannot show:**
- **The injury cohort is not in this population.** `cohortGrid` does not vary injury (CLAUDE.md), so every collision is
  `INV-PLAN-DELIVERED-RAMP`; `INV-PLAN-INJURY-CAP-DELIVERED` on a tune-up week is **not measured**.
- Whether a runner who sees both lines would race the week anyway. No outcome data. Nothing on a device.
- Relocation distance was measured on the 26 note-named collisions only, not on the 9 where only another ramp check fires.
- `measure:fitness` was **not run**: the change moves an optional text field and adds or removes no session. The build
  must prove that with parity (sessions identical; only `tune_up_callout` moves), not this note.

---

## 🔍 Conflict scan (sections and amendments)

| § | Bearing |
|---|---|
| **§32** (no amendments) | Places the callout on *"the latest non-deload build week — the week immediately before peak"*. **Directly amended** by this ruling. Its *why* — *"enough training has accumulated … enough plan remains to act on the result"* — holds one week earlier, so the amendment keeps the purpose and changes only the week. ⚠️ §32 also **quotes the old copy** (*"parkrun PB … not a race effort"*) which the founder replaced today; the amendment must quote the approved line |
| **§2** + **§2 Am. 2** | The week is flagged because delivered volume rises past the cap. §2 Am. 2 freezes the ramp predicate pending outcome data. **Not touched**: this ruling moves a suggestion off a flagged week; it relaxes and tightens no ramp threshold |
| **§90 Am. 3 / §34** | The residual is *stated*, and the stated instruction is *"keep the easy days easy that week"*. **A tune-up offered in the same week contradicts it** — the conflict this sitting resolves |
| **§7** | 48 h between stressors. A parkrun at check effort is a stressor; on 11 of 13 collisions the week already holds a quality session. Supports the change; placement within the week is the runner's, so not mechanically checkable here |
| **§78** | *"Distinct from §32"* — §78's time trial is prescribed on a deload week; untouched. The relocated tune-up stays on a non-deload build week, so it cannot land on a §78 week |
| **§3 / DELOAD-OWNER-01** | The deload exclusion stays through `isDeloadWeek` / `deloadCadence.ts`. No second cadence expression |
| §1 / CD-19 | No session added, so the session-count distribution cannot move. No conflict |
| Zone model | No zone reasoning involved |

No contradiction with an existing section outside §32 itself.

---

## 🏃 Alex Hutchinson (Chair)
*"The re-run matters more than the opinion: 13 of 58 again, and a population of 18 once you ask about every ramp check,
not just the one the note names. The case is narrow and clean. §32's own justification is about timing in the build, and
one week earlier satisfies it on every collision we generated. What I will not accept is a plan that says 'this week
rises past what we normally allow, keep the easy days easy' and, in the same week, 'go and run a parkrun'. That is two
instructions that cannot both be followed. Move it."*

## 📊 Stephen Seiler
*"Translate the effort first: 'a check, not a race' at parkrun distance is still hard running for a recreational runner,
above threshold. On nine to eleven of the thirteen there is already a quality session that week. Stacking a second
intensity day onto the week with the biggest volume rise is how recreational runners end up looking like threshold
athletes. I support moving it. I would go further, and say so below."*

## 🎯 Greg McMillan
*"On a Tuesday this is simple: a coach looking at that calendar would say 'do the parkrun the week before, this week is
already a big one'. The runner never has to understand a rule; they just see the offer on a sensible week. And if a plan
has no clean week to put it on, say nothing. An optional offer that is missing costs nothing."*

## 🩹 Rich Willy
*"The tissue question is the whole question. A 20 to 57 percent rise is the acute spike; a 5K at check effort adds the
fastest, highest-impact running of the week on top of it. Bone and tendon do not care that it was 'optional'. Two
conditions. First, read every ramp check, not the one week the note names, and read them from `RAMP_RESIDUAL_CODES`, so
the injury cap is covered the day the injury cohort hits it. Second, the injury cohort is unmeasured here because the
grid does not vary injury; the build measures it on the injury grid before it ships."*

## ⚕️ Stacy Sims
*"Recovery from high-intensity efforts is slower for many peri- and post-menopausal runners, which only strengthens not
stacking one onto the heaviest week. No objection from this seat, and nothing here was derived from a male cohort that
I need to challenge."*

---

## ⚡ Recorded disagreements
- **Seiler: §32 should also say the tune-up REPLACES that week's quality session** (otherwise it is additive intensity
  on every tune-up week, flagged or not). **Hutchinson and McMillan:** outside the question handed down, and it changes
  the meaning of copy the founder approved this morning. **Not ruled; not filed** (founder: don't invent work). Seiler
  would need measured tune-up weeks carrying two hard efforts, or a sitting asked the question, to change the record.

## ⚖️ Ruling — **CORRECT WITH AMENDMENT**

1. **§32 is offered on the latest non-deload build week that carries no ramp violation** — no
   `RAMP_RESIDUAL_CODES` warning (`INV-PLAN-DELIVERED-RAMP`, `INV-PLAN-INJURY-CAP-DELIVERED`) on that week, read from the
   checks' own verdict at the engine's single exit, the same way `reconcileLoadResidualNote` reads it (and again after
   `composePlanWithFoundation`, ADR-020). **Not** only the week the note names.
2. **If no such week exists, no callout is offered**, and `INV-PLAN-TUNE-UP-CALLOUT`'s "offers no callout anywhere"
   arm accepts that case rather than warning on it.
3. **§32 quotes the founder-approved line** (`founder-2026-11-20-copy-approvals.md`) in place of the retired
   *"parkrun PB … not a race effort"* sentence.
4. **Condition (Willy):** before shipping, measure the injury grid: tune-up weeks carrying
   `INV-PLAN-INJURY-CAP-DELIVERED`, and that each still finds a clean week or is omitted.
5. **Condition:** parity shows sessions byte-identical; only `tune_up_callout` moves (expected ~4–6% of long plans).

The Design Board's precedence (warning › offer on one card) **stays** as defence in depth; for new plans it becomes
unreachable by construction. **Live remediation: none** — 0 of 43 live plans collide.

## 📦 Required artifacts (land with the build, in one commit)
1. **Principle** — §32 Amendment 1: the tune-up avoids a ramp-flagged week, omission is allowed, the quoted copy is the
   approved line. The *"UI consumers render this"* sentence becomes true only in the same change as the SLT-approved
   WeekCard line; it must not merge ahead of it.
2. **Numeric** — **none new.** `TUNE_UP_MIN_PLAN_WEEKS` unchanged; the ramp codes come from `RAMP_RESIDUAL_CODES`
   (already one list, read by the engine and its test). Stated explicitly, as §90 Am. 3 did.
3. **Invariant** — `INV-PLAN-TUNE-UP-CALLOUT` gains an arm: the callout's week carries no `RAMP_RESIDUAL_CODES`
   violation (severity `error`: the producer can always comply by omitting). Row in `plan-invariants.md`. Falsified by
   stamping the callout on a ramp-violated week (arm fires) and by restoring the old placement on a colliding input.
   A liveness mutation must wake it.

## ↗️ Hand-offs
- **SLT:** none. **Design Board:** none (precedence unchanged). **Founder:** none (copy already approved).
- Build sequencing is the SLT's: with or after `PLAN-NOTE-HEAVIER-WEEK-PLACEMENT-01`.

## ⚠️ What this ruling does not prove
- Not that relocation is safe for injury plans (unmeasured; condition 4).
- Not that runners take the offer, or that offering it reduces self-scheduled racing.
- Two strides of one grid; the "one week earlier" result is 26 of 26 note-named collisions, not every ramp case.
- Nothing has run on a device.
