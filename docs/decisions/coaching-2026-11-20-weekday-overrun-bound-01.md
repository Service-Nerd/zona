# Coaching Board — 2026-11-20 — `WEEKDAY-OVERRUN-BOUND-01` · ⏸️ NOT READY (not sat)

**The item's own gate:** *"Neither [a magnitude bound nor a share bound] can be answered without knowing what a bound
COSTS — how many lose their quality session entirely, what the selector substitutes in its place, and
`measure:fitness` on the affected cohort."* (INSUFFICIENT EVIDENCE, 2026-10-06; merged with `SESSION-WEEK-SHARE-01`
2026-10-11; 2026-11-12 triage: *"what a magnitude bound and a share bound COST"*.)

## 📐 What was re-measured (read-only)

**The population** — `npx tsx scripts/board-evidence-weekday-overrun-bound-01.ts` (same sweep as
`lib/plan/weekdayOverrunDeclared.test.ts`: cohortGrid stride 53, structured weekday sessions, not long runs):

| | item (2026-10-06) | 2026-11-20 |
|---|---|---|
| capped plans | 499 | **500** |
| with a structured weekday session over the stated cap | 246 (49.3%) | **241 (48.2%)** |
| past the ratified 50% tolerance | 182 (36.5%) | **175 (35.0%)** |
| sessions past tolerance | **675** | **560** |
| caps involved | all 30 min | **all 30 min** |
| worst | 86 vs 30 (+187%), `HM-pace intervals` | **83 vs 30 (+177%), `HM-pace reps`** |
| top labels | CV intervals 109 · Progressive tempo 59 · HM-pace reps 50 · Threshold ladder 50 | **CV intervals 104 · Progressive tempo 79 · Threshold ladder 71 · Hill reps 52 · Cruise intervals 49 · Pyramid 47** |

**The share question** — `npx tsx scripts/measure-session-week-share.ts` (stride 53, 750 plans): share of the
delivered week median 18.5%, p99 37.8%, **max 50.0%**; Willy's cohort (≤ 25 km/wk, cap ≤ 30) 1,586 sessions, **7 above
40%**. The five printed are all **`Easy shakeout`** (5.0 of 10.0 km), not the CV-intervals cell (47.9%) the item
carries; the other two of the seven are not printed and **were not measured**.

So the population shrank (675 → 560) but the shape is unchanged: every case is a 30-minute weekday cap, the worst is
still close to +180%, and CV intervals is still the largest single row — which is exactly Seiler's point that a bound
would remove the most time-efficient session from the runners with the least time.

## ⛔ Why the board did not sit

The cost of a bound is **what the selector does under it**: which row it picks instead, or whether the week loses its
quality session, and what that does to `measure:fitness`. None of that exists without the selector honouring a bound,
i.e. a prototype engine build. Measuring "what a 45-minute ceiling would cut" by filtering these sessions after the
fact would answer a different question (what disappears), not the one the item asks (what replaces it), and
Hutchinson's 2026-10-06 position stands: *"I will not make the mirror-image error of setting a number because I
happen to have one."*

**Precisely what is missing:** a prototype selector (behind a flag, not shipped) that, for weekday structured sessions
at a stated cap, refuses rows whose duration exceeds a candidate bound (e.g. cap × 1.5 for magnitude; a share of the
delivered week for share), run on the cohortGrid capped population, reporting (1) quality sessions lost entirely per
plan, (2) the substitution distribution by catalogue row, (3) `measure:fitness` before/after on the affected cohort,
(4) the share distribution after. With that in front of it, the board can sit in one session.

## ⚠️ What this does not prove
Nothing about whether a bound is right; only that the evidence the item names does not exist yet and cannot be
produced without engine code.
