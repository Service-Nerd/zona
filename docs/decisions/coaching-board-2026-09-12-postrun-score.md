# Coaching Board — UX-POSTRUN-01, 2026-09-12

**Trigger:** `lib/coaching/constants.ts` (`SCORE_WEIGHTS`, `VERDICT_BANDS`) — soft, qualifies.
**Question as filed:** "four numbers after a run; should it be one?" (founder: *"4 numbers
which can be confusing… should we make this one clear number (percentage), Garmin does
that. If we do, it needs to be known what that means."*)
**Ruling:** SPLIT — **INSUFFICIENT EVIDENCE** on the filed question, **CORRECT** on what
the conflict scan found. Artifacts: §108.

---

## The conflict scan changed the question

**1. The filed premise could not be verified.** `SessionCompleteCard` renders **one**
44px headline — zone % once the `run_analysis` row lands, RPE while it is still polling —
plus a fatigue chip. There is no four-number display anywhere in the post-run flow, and
the item never says which four the founder saw.

**2. The thing being proposed already exists.** `scoreSession()` has always collapsed
four axes into a single 0–100 number on a fixed ratio:

| axis | weight |
|---|---|
| `hr_discipline` | **0.50** |
| `distance` | 0.25 |
| `pace` | 0.15 |
| `ef` | 0.10 |

→ `total_score` → `deriveVerdict()` → nailed ≥80 · close ≥60 · off_target ≥40 ·
concerning <40. Persisted on every `run_analysis` row today.

**3. Hutchinson's recorded objection applies to a different proposal than the live one.**
He named *zone %, RPE and fatigue*. The engine's four are all **objective and
device-derived from the same run**. RPE and fatigue are runner-reported and are **not in
the score at all**. The thing he vetoed is not the thing that shipped.

**4. 🔴 The singularity was bypassed by a file path, for the second time.** These
numerics had **no principle and no mechanical check** — `configPrincipleSync.test.ts`
read only `GENERATION_CONFIG`, and they live in `lib/coaching/constants.ts`. That is
`peakKmByLevel` verbatim (§106), the lesson CLAUDE.md already records: *"every governance
layer this project has, bypassed by a table being in the wrong place."* Nobody could say
why HR discipline is 0.50 rather than 0.4, or what `< 40` is for — and both decide whether
a runner is told their session was **nailed** or **concerning**.

## The seats

- **Hutchinson (chair)** — the objection stands but must be read precisely. Weighting four
  *objective* measures of one run is a modelling choice a coach makes. Folding *subjective*
  RPE and fatigue into the same number asserts an exchange rate between how hard it felt
  and how disciplined the HR was. No such rate is known. He will not ratify one.
- **Seiler** — 0.50 on HR discipline is the defensible half and the right half to weight;
  it is the only axis that speaks to intensity distribution. His objection is that nobody
  can say *why* 0.50. "A number that governs what a runner is told, with no stated
  reasoning behind it, is not a model. It is a habit."
- **McMillan** — the runner never sees the score. They see one big number and a word,
  which is already the Garmin thing being asked for. Somebody must point at the actual
  screen that felt confusing before anyone builds.
- **Willy** — no objection on weighting. Flags that "concerning" is a strong word produced
  by an ungoverned `< 40` boundary; move the band and the number of runners told that moves
  with it.
- **Sims** — keeping RPE and fatigue *out* should be a recorded decision, not an accident.
  Subjective load carries signal the device does not, particularly across the menstrual
  cycle and in under-fuelled runners, and averaging it into a composite is how that signal
  stops being actionable. **Beside the score, never inside it.**

**Recorded disagreements:** none on the ruling. Hutchinson and Sims converge on "keep RPE
and fatigue out" from opposite directions — modelling grounds and signal-preservation
grounds. Convergence, not synthesised consensus.

## Ruling

**INSUFFICIENT EVIDENCE — the filed question.** What would settle it: the founder pointing
at the screen, by screenshot or step name.

**CORRECT — govern the numerics.** Ratifies the values that already ship. **No
runner-visible change.**

**NOT ratified:** any exchange rate between RPE/fatigue and the objective axes. A future
proposal to fold them in is a new board question, not an extension of §108.

## Artifacts

1. **Principle** — §108, naming the literal keys, why HR discipline carries half, why pace
   sits below distance, what the bands are for, and that subjective inputs stay outside.
2. **Numeric** — `SCORE_WEIGHTS`, `VERDICT_BANDS`, unchanged, brought under governance.
3. **Check** — `configPrincipleSync.test.ts` now reads `lib/coaching/constants.ts` as well
   as `GENERATION_CONFIG`, matching on `GROUP.key` so a group name cannot document four
   decisions with one word. Plus: the weights must sum to 1.0 (a weighting that does not
   silently rescales every score and moves every band without changing a band value), and
   the bands must descend within 0–100.

**The widened check proved it can go red in the act of being written:** it failed until
§108 actually named `hr_discipline` and the rest, rather than describing them in prose.

## Still open

UX-POSTRUN-01 remains open at INSUFFICIENT EVIDENCE, waiting on the founder to identify
the screen. It is no longer blocked on a board sitting.
