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

## The three "open" items, resolved

**M3 — WITHDRAWN. My premise was false, and no seat checked it either.**
I told the board *"the plan knows the runner will not have run past 20 km and
does not say so"*. It does say so. `long_run_shortfall_note` reads: *"Your
longest run tops out at 2h 20. For a race you'll likely be moving for around
4h 55 … Expect the last stretch of race day to be new territory; go out slower
than feels right and **take the walk breaks early rather than late**."* Willy's
reservation on the LOAD stands; the honesty complaint does not.

**E5 — CORRECT AS IS, McMillan's dissent recorded. CLOSED.**
Measured: only **5% of plans** contain a week where the long run exceeds 70% of
that week, worst case **74.1%**; §114 already took weeks above 90% to **0.00%**.
Both available levers are closed: capping the share was built, measured and
reverted **the same day** (`S52-LOPSIDED-BOUND-01` — shortening the long run
also shortens the week, so the share is a **fixed point**), and refusing the
runner is a dropout where the plan already names the binding constraint and the
lever (*"running 4 days instead of 3 is the lever"*). At three days a week with
a 30-minute weekday cap the long run is arithmetically most of the week; that is
the shape of the constraint, not a defect in the engine. **McMillan's "I would
not hand this over" stands as a recorded dissent, not a veto.**

**Sims's fuelling point — CORRECT, SHIPPED.** §24e Amendment, below.

## Also referred on

- ⚠️ **My conflict scan MISSED §24e.** I told the board "no fuelling principle
  exists". One did — `CAT-ULTRA-FUELLING-01`, Sims-led, 2026-09-13 — scoped to
  the **ultra** long run. I was one step from adding a second, parallel fuelling
  note. The real finding was better than the one I brought: **same hazard, same
  board member, same mechanism, excluded by a distance bucket.**
- **McMillan — non-intensity variety** in the beginner block (terrain, named
  strides focus). Seiler will object to anything that costs Z3 time.
- 🔎 **A step-back week has no structured marker** (`type: 'normal'`, no badge,
  `phase: 'peak'` — identical to the loading week beside it). Found because
  scoping the fuelling invariant on `badge === 'deload'` demanded a cue on a
  recovery week and failed the build. Filed, not fixed.

## What this review does not prove

17 plans is a sample. The engine has **no adherence or dropout data at all**, so
every "will they stick to it" answer above is a coaching judgement, not an
empirical one — McMillan's included, and his is the one most likely to be acted on.
