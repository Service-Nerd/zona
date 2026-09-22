# The open coaching items, measured before any board spoke — 2026-09-22

The founder's instruction: *"Do any SLT or coach sittings before anything. Document everything
then build through this list."*

**The board's own rule is that a sitting run without an available measurement produces a ruling
about impressions.** So every open item was measured first. **Three were measured; all three
corrected their own filing.** One of the three corrected it twice, because my first instrument
was wrong.

---

## 0. First, what was already shipped

🔴 **Two items on the open list were already done**, and the backlog still described them as
blocked. Checked against `coaching-rulings.md` and the feature registry rather than from memory:

| Item | Backlog said | Reality |
|---|---|---|
| `HM-ANCHOR-VS-GOAL-01` / §120 | *"NOTHING SHIPPED"* | ✅ **SHIPPED** — §120 + Amendment 1, bounded against CV pace. The board **rejected the constant it had itself named** (`RACE_PACE_ANCHOR_MAX_STRETCH_PCT`): right question, wrong unit |
| `RACE-WEEK-VOLUME-01` / §121 | *"ruled by the Coaching Board, **not built**"* | ✅ **SHIPPED** |

⚠️ **`audit-docs.sh` reads ALL CLEAN on both**, because the stale text sits inside narrative
paragraphs rather than in an item's status field. **The records the hooks check were right every
time; the prose was wrong.** Same asymmetry `state-block-check.py` was built for.

---

## 1. `MARATHON-READINESS-GAP-01` — the premise is FALSE, and the real defect is one level down

**As filed** (Seiler and McMillan, Willy insisting it be separable): *"a beginner whose largest
training week is 25 km is being sent to race 42.2 km."*

**Measured** — `scripts/measure-marathon-readiness.ts`, **10,576 generated marathon plans**
(1,840 refusals, all the designed *"3 days a week is under the 4 a time goal needs"* refusal):

| | |
|---|---|
| Peak week below the race distance | 🟢 **0 of 10,576.** Minimum peak week **46.7 km**, median 54.7 (beginner) to 57.7 (intermediate/experienced) |

**The filed concern does not reproduce.** But the worst cases exposed a different one:

| Peak LONG RUN, as a share of the runner's own race | |
|---|---|
| below 50% | **8.2%** (872) |
| below 45% | **5.3%** (564) |
| **beginner** | min **42.7%**, p5 **42.7%**, median 61.6% |
| intermediate | min 58.1%, median 64.0% |
| experienced | min 54.5%, median 64.0% |

🔴 **A first-time marathoner can reach the start line having never run beyond 18 km** — 42.7% of
the race, so on the day they run **2.3× their longest ever run**. It is **entirely a beginner
tail**: the beginner median (61.6%) is fine, and no intermediate or experienced plan goes below
54.5%. ⚠️ **The existing fitness harness reports `medianMarathonLrPctOfRace` ≈ 62% and is
therefore blind to this by construction — a median cannot show a tail.**

**For the board:** this is §114 / `S114-GET-YOU-ROUND-01` territory and Willy's seat.

---

## 2. `RACE-WEEK-SHAKEOUT-VOLUME-01` — does not reproduce as filed; a different question is real

**As filed:** *"a 59 km race week against a 42.2 km race — 16.8 km of shakeouts, which no coach
would prescribe against §30's cap."* The filing itself said: *"this may be an artefact of the
sweep's inputs. Reproduce against a single named input before treating it as a defect."*

**Reproduced, and the framing is wrong.** The worst race week in 10,576 plans:

```
sat  race   42.2km   Race — Test
tue  easy    9.0km   Race-week easy      <- this
mon  easy    5.0km   Easy shakeout
wed  easy    3.0km   Pre-race shakeout
                     weekly_km field = 17   (§121 is correct: the race is not training volume)
```

**17 km, not 16.8 km of shakeouts.** The shakeouts are **8 km across two sessions** and are well
inside §30. The 9 km is a **plain easy run on the Tuesday of race week**. So §30's cap is not
breached and the board's question is a different one: **should race week carry a 9 km easy run
three days out?** 7.9% of plans exceed 16.8 km of total race-week volume.

### ⚠️ My first instrument was wrong twice, and it would have reached the board

1. It generated **0 plans and refused 12,416**, then printed a clean `0%` table. The call
   signature was wrong. This repo's recorded *"measurement scripts are checks too"* class — four
   grids in one day printed clean tables from plans that never generated.
2. Fixed, it subtracted a **hardcoded 42.195** from every race week and divided every long run by
   it, on a grid filtered to `race_distance_km > 40`. That reported a **13 km median** of
   race-week shakeouts. The real figure is **7 km on the plan I then inspected by hand**. *(The
   grid turned out to hold only 42.2 km races, so the long-run figures were unaffected — but the
   instrument was wrong either way and I could not have known that in advance.)* **The
   denominator is where a claim fails.**

---

## 3. `COACH-BEHIND-DAY-TWO-01` — the filing UNDERSTATES it

**As filed:** the `done / dueRef >= 0.7` softener is unreachable *at the start of a plan*, so the
first missed session of any plan is always a `--warn` verdict.

**Measured exhaustively** — it is pure arithmetic on `sessionsContext(done, planned, dueToDate)`,
so no grid is needed:

```
dueRef=1: softener fires at done = NEVER
dueRef=2: NEVER
dueRef=3: NEVER
dueRef=4: done=3      dueRef=5: done=4      dueRef=6: done=5      dueRef=7: done=5,6
```

🔴 **The softener cannot fire below four sessions due.** And `dueRef` never exceeds the sessions
planned in that week, so:

**For a runner training 3 days a week, the softener can NEVER fire — in any week, at any point in
any plan. Miss one session and the verdict is amber, always.** Across the grid that is
**13,824 of 47,616 inputs — 29.0%.**

The filing said *"unreachable at the start of a plan"*. It is unreachable **permanently** for
nearly a third of the population, and that population is the one with the least slack.

---

## 4. `RACE-ANCHOR-CV-OVERRIDE-01` — a genuine deadlock, no measurement outstanding

92 of 2,401 single-anchor quality sessions (**3.8%**), all at HM and marathon; worst case a
`cv_intervals` session renamed *"Marathon-pace reps"* with a header **69 s/km** from its own work
steps. §85 shields `CV` from §22's goal-pace override in terms; §22 requires a second-half peak
row to be goal-paced. **The obvious fix was built and reverted the same hour — it turns §22's own
ownership arm red on 100 tests.** Same shape as the §111/§57 deadlock. Visible meanwhile:
`INV-PLAN-HEADER-PACE-MATCHES-WORK` emits `warn`, not `error`, and names the item.

---

## 5. `TAPER-OVER-PEAK-01` — already re-ruled; this is a BUILD, not a sitting

**CORRECT WITH AMENDMENT**, 2026-09-22, first ruling vacated. The defect belongs to **ADR-022**,
not §1: a week whose delivered volume falls materially below its own curve target absorbs the
shortfall in its remaining easy running. **Willy's bound is binding** — capped by §9's long-run
share and §45's progression cap; a week that still cannot reach its target runs under, honestly.

---

## 6. `GTM-REDEEM-PLACEMENT-01` — SLT, and no measurement is outstanding

**No charity code has ever been redeemed** (`GTM-CHARITY-04`), and the redeem screen sits on
**Me** — the surface the SLT itself called *"the lowest-frequency surface in the product, so the
worst place for a conversion moment."* The competitor puts the referral code **in the onboarding
flow**, between the wizard and the plan, while a code is still in the runner's hand. It costs one
screen position, not a build.

⚠️ **Traynor's seat is vacant and this is his question.** His recall trigger is *a redeemed-code
funnel* — which is precisely what does not exist. The board must rule knowing no seat prices
conversion.

---

# The sittings, 2026-09-22

**Four items went in. Two closed on the conflict scan or the measurement without a seat
speaking, one was ruled, and one was dissolved by a production query.**

## A. `MARATHON-READINESS-GAP-01` — 🔴 CLOSED ON THE SCAN

The premise is false (0 of 10,576). **And my reformulated finding — the beginner long-run tail at
42.7% of race distance — is §114, ratified by FOUNDER DECISION on 2026-09-19** after the board
reached a genuine trilemma, with McMillan's position carrying. §114 names this exact trade in its
own words: *"A runner who does a 17 km longest run and run-walks the last stretch finishes. A
runner handed a 26 km run off an 8 km/week base is injured in week 15 and does not start."*

⚠️ **The mandatory conflict scan caught this before any seat spoke, which is the second time it
has done so this month.** Without it I would have taken a ratified founder decision to the board
as a defect.

§114's obligation — *"the long run yields **and the plan says so**"* — **is built and gated both
ways** (`meta.volume_constraint_note`; `planReviewCB01.test.ts` asserts the note appears when
§114 binds and does NOT appear when it does not). **Nothing to rule. Do not re-file.**

## B. `RACE-WEEK-SHAKEOUT-VOLUME-01` — 🔴 CLOSED, DOES NOT REPRODUCE

Its own filing required reproduction first. Reproduced: the worst race week across 10,576 plans
is **17 km** — 8 km of shakeouts (inside §30's 35-minute cap) plus a 9 km easy run **four days
out**. Against a 54.7–57.7 km peak that is a **~30% race week**, conservative taper volume. **§30
is not breached and the 59 km figure was the artefact the filing suspected it might be.**

## C. `RACE-ANCHOR-CV-OVERRIDE-01` — ⚖️ CORRECT WITH AMENDMENT

**Conflict scan:** §22 · §85 · §33 · §120 Am.1.

🔴 **§22 ALREADY HAS AN EXEMPTION CLASS, AND THE REVERTED FIX EXEMPTED AT THE WRONG MOMENT.** §22
reads: *"the engine MUST prescribe goal pace on the build/peak quality slot, **with VO2max
sessions exempt**."* The fix built and reverted on 2026-09-22 excluded the CV row from the
**override**, leaving it **selected into** a slot §22 requires to be goal-paced. Of course §22's
ownership arm went red on 100 tests: the slot was still there and still empty of goal-pace work.

**The board:** Hutchinson — the question is not whether a CV row may be re-priced, §85 settles
that in terms; it is whether a CV row should ever be **chosen** for that slot. Seiler — it should
not: a CV row and a goal-pace row are different intensities, and §22's window is about exposure.
Willy — no injury vector either way; a labelling and selection question. McMillan — 3.8%, all HM
and marathon, worst case a **69 s/km** divergence between a card's header and its own work steps,
which the runner cannot reconcile. Sims — no objection from this seat.

**Ruling: a CV-anchored row is NOT ELIGIBLE for §22's second-half goal-pace slot**, rather than
being exempted from the override after selection. ⚠️ **Safe by §22's own construction:** §22
already requires that *"a distance whose race pace is physiologically distinct from I-pace MUST
own a `race_specific` catalogue session"*, and HM and marathon both do — so a goal-paced
alternative is guaranteed to exist and the slot is filled rather than emptied.

**Artifacts required in one commit:** principle amendment (§85 or §22, naming the selection
seam) · the eligibility rule in the selection path · `INV-PLAN-HEADER-PACE-MATCHES-WORK`
promoted from `warn` toward `error` for this class once the count reaches zero.
⚠️ **`npm run measure:fitness` on the changed engine before the commit — the board's own
procedure — and `verify:parity` will move.**

## D. `GTM-REDEEM-PLACEMENT-01` — 💼 SLT: DON'T BUILD. The blocker is not a screen position.

🔴 **Two of the filing's premises are false, and the second dissolves the item.** Queried against
production:

| Filed | Measured |
|---|---|
| *"No charity code has EVER been redeemed"* | **2 of 3 claimed**, 2026-09-11 and 2026-09-18, both with a real user attached. **The redemption flow works end to end** |
| *"Our redeem screen lives on Me"* | **Three doors.** Me, **the wizard's first question** (`GeneratePlanScreen:1813`, gated `isOnboarding \|\| !hasPaidAccess`), and Upgrade — the code comment says *"the one the OTHER TWO doors use"* |

**And the decisive fact: the only batch in the database is `partner_name = 'TEST'`, cap 3,
created 2026-09-11. No real charity batch has ever been created; Make-A-Wish has never been
issued codes.**

So there is no funnel to reposition. **Sutherland:** a zero with no codes behind it is not a
signal, it is an empty set. **Fried:** the door already sits on the wizard's first question;
moving it buys nothing until someone is holding a code. **Wood:** the two TEST claims tell us the
mechanism works, which is what the filing quietly doubted. **Zhuo:** the only live design question
is prominence — it is a 12px `--mute` underlined link — and that cannot be answered without
traffic either. **Hutchinson (chair):** we would be designing a funnel nobody has observed, which
is the three-card proof band's error on this board's own record.

**🔻 FOUNDER ACTION, not a build: create the Make-A-Wish batch.** It is the only thing that can
produce the evidence this item needs.

⚠️ **Traynor's recall trigger is "a redeemed-code funnel". It still does not exist** — the two
claims are the founder's own TEST batch. **His seat stays vacant, and that is now a measured fact
rather than an assumption.**
