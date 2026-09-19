# Coaching review round — 2026-09-19 — RULING

26 cases (4 canonical + 22 personas: 16 charity, 6 engine). 0 error violations,
1 refused by design (M4). Reviewed by the Coaching Board against the founder's
standard: *would we be proud to hand this to the person it is for; will they
adhere; will it get them there?*

> ⚠️ **The round was widened before it was reviewed.** `coaching-review-round.ts`
> iterated `CHARITY_PERSONAS`, which `PERSONA-CORPUS-01` had derived that same
> day as "every persona EXCEPT the six engine ones". So the six personas added
> because no grid could reach their cells were invisible to the one review a
> coaching seat actually reads — including **E6, the only ultra in the round**.
> Now iterates `PLAN_PERSONAS`.

## Verdicts

| | plan | proud to hand over? |
|---|---|---|
| M1/E1 | never-run beginner marathon, 20wk | ✅ — **Sims records a fuelling objection** (a 3h28 session off a 5–8 km base, no fuelling guidance anywhere) |
| E2 | beginner marathon, TIME 4:30 | ✅ |
| M2 | charity marathon, compressed 12wk, 3 days | ✅ — honest notes, "get you round" is true here |
| M3 | returning marathon + knee | ✅ **with Willy's reservation recorded** — will finish, will walk a good part of the last 10 km, and is not told so |
| M5 | masters 58 charity marathon | ✅ **top of Willy's range**; Sims adds a separate bone ceiling that is not the same ceiling |
| M1d | first-timer who declares experienced | ✅ |
| **E5** | **intermediate marathon, 3 days + 30-min weekday cap** | ❌ **would not hand over** — 15 warns, `INV-PLAN-LR-MAX-WEEKLY-PCT` repeatedly: the long run is 29.5 km of a 43 km week. Arithmetically compliant, not a training week (McMillan) |
| H1 / H2 / H3 / E3 | half marathons | ✅ |
| T1 / T2 / T3 | 10Ks | ✅ |
| E4 | experienced 10K time goal | ✅ — **the plan to show a sceptic** (Hutchinson) |
| E6 | experienced 50K ultra | ✅ |
| M4 | sub-4:00, 3 days, 45-min cap | ⛔ refused by design, §44-compliant |

## Rulings

**F1 — CORRECT, unanimous. SHIPPED.** §79 Amendment 5. "You are coming back"
reached 21% of experienced-runner plans and **80% of those were `early_onset`** —
the cohort ADR-021 §89 certifies as *not* returning. Now 120 → 24 plans, **0 of
them non-returning**.

**F2 — CORRECT WITH AMENDMENT. SHIPPED.** §44 Amendment. The submitted framing
("the band should read training load") was ruled **INCORRECT** — §44 point 3 is
Willy's own constraint and the band must stay blind to the produced plan. What
shipped is narrower: **a plan that declares a shortfall may not read
`comfortable`**, §44's own definition of that rung being "plan reaches its
target". 751 → 0. Cohort grid `difficultyComfortablePct` **54.5% → 22.7%**.

**F3 — not a correctness finding.** All-easy for the beginner marathoner was
ruled CORRECT AS IS earlier the same day and is not reopened.

## Open, referred on

- **Sims — fuelling guidance on any session over ~2 hours.** No principle covers
  it; no seat contradicted her. New scope, needs its own sitting. Hutchinson carries.
- **McMillan — non-intensity variety** in the beginner block (terrain, named
  strides focus). Seiler will object to anything that costs Z3 time.
- **E5** — the long run is 69% of the week behind a 30-minute weekday cap.
- **M3** — the plan knows the runner will not have run past 20 km and does not say so.

## What this review does not prove

17 plans is a sample. The engine has **no adherence or dropout data at all**, so
every "will they stick to it" answer above is a coaching judgement, not an
empirical one — McMillan's included, and his is the one most likely to be acted on.
