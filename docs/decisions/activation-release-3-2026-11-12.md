# Activation programme, Release 3 — SLT + Design Board, 2026-11-12

**Input:** founder brief *"Zonna: Activation & Conversion Programme"*, items 6, 8 and 9, plus the
founder's instruction on 2026-11-12: *"do release 3"*.

**Items:** `ACT-FIRSTRUN-01` (🧭 Design), `ACT-FREE-TEASE-01` (💼 SLT then 🧭 Design),
`ACT-PAYWALL-01` (🧭 Design + 💼 SLT on price presentation).

---

## 📐 Every premise re-measured first, and all three had moved

Population throughout: `user_settings` where **not** `is_admin` and **not** `is_internal` —
**37 users, all 37 trialists, 33 past day 14.** Measured against production 2026-11-12.

### The one number that governs all three items

| | n of 37 |
|---|---|
| A **trainable plan week inside the trial** | **13** |
| No trainable week inside the trial | **24** |
| A trainable week inside **days 1–3** | **6** |
| Ran during the trial | 15 |
| **A run read during the trial** | **1** |
| Saw the paywall | 7 |
| Tried to buy | 3 |

🔴 **Items 6, 8 and 9 all assume the runner is training inside their trial. Twenty-four of
thirty-seven are not.** `ACT-TRIAL-AT-FIRST-READ-01` is the fix for that and it is built, behind
`TRIAL_STARTS_AT_FIRST_READ = false`, awaiting the founder's written sign-off. **Nothing in this
sitting substitutes for it**, and every ruling below is bounded by that sentence.

### Item 6 — `ACT-FIRSTRUN-01`

Two acceptance criteria, and they measure very differently.

**(a) "A push on the first planned run day" — ALREADY SATISFIED BY CONSTRUCTION.**
`/api/push/send-daily` sends on **every** day that resolves a session (route header: *"on every
planned day"*); `isDateBeforePlan` is the only lower bound and there is no skip-day-one branch, so
the first planned day is included by construction. A second sender for that day would reach
**nobody new**.

📐 What actually binds, measured:

| | n of 37 |
|---|---|
| `daily_push_enabled` (the default) | **37** |
| Holds a `push_subscriptions` row at all | **23** |
| Ever received a `daily_training` push | **10** |
| Received one in trial days 1–3 | **3** |
| Mean days from signup to first push | **4.4** (min 1.2, max 8.6) |

So the gap is not a missing sender. It is **14 runners with no push subscription** and **31 with no
planned session inside days 1–3.**

**(b) "A sample run read in onboarding, so the value is seen before it is earned" — GENUINELY
UNBUILT.** `OrientationScreen` renders the race, the block length, the first upcoming session and
the zones. **There is no read on it.** And it reaches **4 of 37** so far (`orientation_seen`),
because its trigger is first-ever plan generation and it shipped recently (B-002).

⚠️ **(b) is the half that does not depend on a plan or a run**, which is why it is the half worth
building: it reaches all 37 regardless of the 24.

### Item 8 — `ACT-FREE-TEASE-01`

**The content premise is largely FALSE; the MOMENT premise is true, and it is a breach of a
standing ruling.**

Already shipped on the **Coach** screen for a free runner (`CoachTeaser`, `COACH-KIT-CAUGHT-01`
2026-10-31 + `KIT-TASTE-01`): `KitReceipts` — the runner's own numbers, rule-based — plus
`EffortRecord` (the every-run picture, §132, free), plus the free weekly insight, plus the risk
warning, with the lock stated in words: *"Kit's weekly read turns this into one thing to do next.
That part is Pro."* That is the item's acceptance criterion, on that screen.

🔴 **But the item says "after a run", and the post-run moment shows a free runner NOTHING.** In
`PostRunScreen` the entire read cluster sits behind `{hasPaidAccess && (…)}`, and so does
`SessionScreen`'s (three sites). A free runner logs their run, answers RPE and fatigue — both
free, DS-06 — and then the screen simply stops. **That contradicts the standing ruling *"Gate
richness, never access. A locked row stays visible and readable"*** (`design-rulings.md`), which is
a defect against doctrine rather than a new feature.

📐 **And the data to fill it is already on the free runner's own row.** `hr_in_zone_pct`,
`hr_above_ceiling_pct` and `hr_pct_z1…z4_5` are written at **ingest** by `lib/health/adapter.ts`,
the Strava webhook and `link-activity` — none of them tier-gated (`HK-FREE-INGEST-LINE-01` moved
the gate to the analysis). Measured:

| band | activities | carrying the zone split |
|---|---|---|
| subscribed | 231 | 169 |
| **free / trial** | **146** | **122 (83.6%)** |

`runEffortKind` (§132) is a pure function of those four columns. **No new computation, no model
call, no cost.**

⚠️ **AND THAT IS STILL A TIER DECISION, so the item's SLT-first routing is correct and my first
read of it was wrong.** The line today is coherent, not self-contradictory: `activity_intelligence`
is PAID and `ZoneWeekBlock`'s own locked copy states the consequence in as many words — *"a free
runner can see the ceiling and never learn whether they held it."* Showing the split would move
that line. `HK-FREE-INGEST-LINE-01` is **not** the precedent it looked like: there the route
contradicted a ruling forty lines above it, so the fix was a defect fix. Here there is nothing to
restore.

So item 8 splits:

- **(a)** a locked card in the post-run moment, naming what the read would say — **no tier move**,
  a defect fix against *"gate richness, never access"*.
- **(b)** putting the runner's **own measured number** in it — **moves the FREE/PAID line. SLT.**

### Item 9 — `ACT-PAYWALL-01`

**Both criteria are substantially already shipped, and the majority cohort is not in the item.**

- *"Lead with the annual price shown alongside its monthly equivalent"* — the annual card already
  reads **£59.99** · *per year · £5 / month* · *£1.15 / week* · *Save 37% / year*, every string from
  `BRAND.PRICING`. The only unmet word is **lead**: annual is the right-hand card of two, so
  monthly is read first.
- *"Show the runner's own data instead of a feature list"* — **already ruled and built**:
  `COACH-KIT-CAUGHT-01` put `KitReceipts` under the headline and above the feature list, ≤3
  receipts, no taps. Re-proposing it would be re-proposing settled ground.

📐 **The cohort the item does not mention is the majority.** At the moment their trial ended:

| | n of 33 past day 14 |
|---|---|
| Would have had own data to show | **13** |
| **Feature list only — nothing of their own** | **20 (60.6%)** |

(≤13, since a receipt also needs a trigger to fire. Today, 8 of 37 would see receipts at all.)

---

## 💼 SLT — item 8(b): does a free runner see the zone split of their own run?

Seats: Sutherland, Fried, Hutchinson (coaching chair), Wood, Zhuo (design chair). Traynor's
commercial seat stood down 2026-09-22 and is not recalled — there is still no revenue, no
trial-to-paid rate and no funnel, so his own standing objection (*"what is the traffic?"*) holds.

**🧠 Sutherland.** *"The asymmetry is the whole argument and it is the same shape as the
HealthKit one. We already paid for this number — it is sitting in the row. Withholding it costs us
nothing to withhold and buys us nothing either, because the thing a free runner cannot do is the
thing that matters: they cannot be told what to do about it. A number with no instruction is an
itch. Give them the itch."*

**🏃 Hutchinson.** *"Correct, with one condition I will not bend on. The split is a measurement and
the advice is an interpretation. `78% in Zone 2` is a fact about a run; `that was the right easy
run` is a coaching claim and needs the plan, the phase and the week's load. Show the fact, withhold
the claim, and do not let the fact be WORDED as a claim. No verdict words on free — not 'good', not
'held', not 'too hard'."*

**🎓 Wood.** *"Behaviourally this is the only one of the three items that touches the loop at the
moment the behaviour happens. The Coach screen version requires navigating to Coach, which is a
decision; this arrives because they ran. That is the right shape."*

**💰 Fried.** *"I want to be the one objecting and I cannot find the objection. This adds no
surface area — it fills a hole we already render. And the paid thing stays genuinely paid: the read,
the reshape, the weekly score. If the free tier becomes good enough that nobody upgrades, that is a
real risk, and it is not this. **0 of 37 are paying.** We are not protecting revenue, we are
protecting a hypothesis."*

**🧭 Zhuo.** *"State the success condition before we build it, because otherwise we will call this
done and never know. Mine: a free runner who finishes a run sees a number about that run, and the
paywall view rate from the post-run surface becomes measurable. `ACT-FUNNEL-01` shipped, so it is
measurable now, which it was not a week ago."*

### ⚖️ SLT ruling — **BUILD, FREE, with Hutchinson's condition binding**

The zone split of a runner's own run is **FREE**. The read, the verdict, the advice, the weekly
score and the reshape stay **PAID**. `activity_intelligence` is unchanged: this is not the analysis,
it is the four columns ingest already wrote.

**Binding condition (Hutchinson):** the free surface states the **measurement** and never a
**verdict**. No evaluative word on the free path.

⚠️ **Recorded, and it bounds the ruling:** this reaches a free runner **with a heart-rate source**.
122 of 146 free/trial activities carry the split — the other 24 do not, and an iPhone-only runner
never will (ADR-011 §5). That state must read as absence of a sensor, never as a failure or as a
lock.

---

## 🧭 Design Board — three questions

Settled-ground scan run against `design-rulings.md` before any seat spoke. Rows this touches:
**"Gate richness, never access — a locked row stays visible and readable"** (standing, one lock
language); **"Marketing stills must be the REAL components"** (standing); **"All five states ship
together"** (standing); **"Upgrade prompts are behaviour-triggered, never calendar-triggered"**
(SLT / `ux-principles.md`); **`COACH-KIT-CAUGHT-01`** (receipts under the headline, above the
feature list, ≤3, no taps); **`COACH-SIGNOFF-01`** (effort record under Kit's read, order holds
until Coach opens are measured); **empty-state illustration KILLED 2026-09-22**; and the
`FOUNDER-PLAN-DIFF-01` row declining *"a chart, an illustration, a ceremony, a progress
animation"*. Nothing here reverses a row; Q3(b) is **governed** by two of them.

### Q1 — the post-run moment on free (item 8)

**✋ Silvanto.** *"This is the clearest of the three because the screen already has the hole in it.
Today a free runner reaches the bottom of that screen and it ends — that is not restraint, it is a
truncation, and the two look identical in a screenshot which is why nobody caught it. Pattern 11's
locked state is the treatment and it is already documented: `--bg-soft`, muted number, body in
`--mute`, one moss text link. **The one thing I will not accept is inventing a second lock
language.** We have one."*

⚠️ **Silvanto's correction to the pattern, and it is a real one.** Pattern 11's locked state
renders the percent as **`—%` at 0.4 opacity** *"because the live percent is HR-derived from
`run_analysis` — paid"*. **That premise is false at ingest.** With the SLT ruling above, the free
post-run card shows the **real number**. *"So this is not the locked state. It is a THIRD state:
measured, unadvised. Do not dress a real number in the withheld-number treatment — that teaches the
runner the number is fake."*

**📱 Wroblewski.** *"One card, no tap, below the RPE block and above nothing. It must not be a
button: the moss link belongs at the bottom of the card and goes to Upgrade, and `source` is already
a required prop on that screen so the funnel will say this door sent them. And the no-HR state is
not an edge case — 24 of 146 — so it ships in the same commit, worded as a missing sensor."*

**🎓 Sierra.** *"The number has to teach something or it is a tease in the pejorative sense. `78%
of this run was in Zone 2` is a fact the runner can act on without us — they can go out tomorrow and
try to beat it. That is perceptual expertise, and it is the one thing in this whole programme that
makes the RUNNER better rather than the app stickier. Keep the sentence declarative."*

**🎪 Collins.** *"Agreed and I want the number big. Not a row of four percentages — nobody feels a
histogram. One number, the one the brand is about, and the Zone 3 share if it is the story. If we
show all four zones on free we have built a dashboard, and we killed dashboards."*

**🧭 Zhuo.** *"Settled. One card, one number, no verdict, one link. The success condition is the
one I stated at the SLT."*

**⚖️ SHIP WITH AMENDMENTS (4).**
1. **A third state, not the locked state.** Real number at metric weight; `--card`, not `--bg-soft`.
   The withheld-number treatment stays for genuinely withheld numbers.
2. **One number, chosen by what the run was** (Collins) — the easy share, or the Zone 3 share when
   Zone 3 led. Never four.
3. **No evaluative word** (Hutchinson, binding from the SLT).
4. **All five states in the same commit** (standing rule): measured · no HR · no run linked ·
   loading · paid (unchanged).

### Q2 — a sample read in onboarding (item 6b)

**🎓 Sierra.** *"The value of this is not that it shows a feature. It is that it shows the runner
what the product will say ABOUT THEM, in a sentence, before they have done anything. That is the
whole proposition in one card. But if they mistake it for their own data we have lied to them on
screen one, and this is the screen where trust is cheapest to lose."*

**✋ Silvanto.** *"Then the label is not a caption, it is part of the card. Not grey small print
under it — grey small print is what every app uses to disclaim something it hopes you read as real."*

**🎪 Collins.** *"And it must be the real component. There is a standing rule for exactly this on
the marketing site and the reason is on the record: a hand-copied imitation drifted and shipped
wrong. `lib/marketing/demoSurfaces.ts` is already the single owner of one coherent demo runner and
already feeds real app components on the website. Use it. The app and the site then describe the
same runner, which is a feature."*

**📱 Wroblewski.** *"`OrientationScreen` scrolls and its CTA is already at risk of clipping — the
component says so in a comment. One card, and measure the height before shipping it."*

**🧭 Zhuo.** *"And it is ONE decision, not five. We are not redesigning onboarding. One card, in an
existing screen, from existing data."*

**⚖️ SHIP WITH AMENDMENTS (3).**
1. **The example is declared IN the card, not beneath it** (Silvanto) — the eyebrow carries it, so
   it cannot be read as the runner's own.
2. **The real component with `demoSurfaces` data** (Collins, and the standing marketing-stills
   rule). A new consumer of that module, declared in its header.
3. **One card** (Zhuo/Wroblewski), and the screen's scroll height re-checked at 375px.

### Q3 — the paywall (item 9)

**(a) Does annual lead?**

**📱 Wroblewski.** *"Two equal cards in a left-to-right row: the left one is read first. Annual is
on the right. The only thing giving it precedence is the badge pinned above it, which is
decoration doing a hierarchy job."*

**✋ Silvanto.** *"Which is my objection to it in one sentence. Care should be visible in the thing,
not applied on top of it. Put the recommended option first and let the badge confirm the choice
rather than announce it."*

**💰 Fried (advisory, price presentation).** *"No theatre. No strike-through, no countdown, no
'was'. Ordering the options so the better one is first is not a dark pattern; it is a
recommendation, and ours is honest — £1.15 a week against £1.84."*

**⚖️ SHIP.** Annual first, monthly second. Badge kept. No copy change, no price change, no new
string. 📐 *This is a two-element reorder and is recorded as such — it is not a redesign.*

**(b) What does the paywall say to the 20 of 33 with nothing of their own?**

**🎪 Collins.** *"Nothing. And I want that recorded as an argument, not a shrug. The empty third
of a layout is usually the best part of it, and this board has killed an illustration, a chart, a
ceremony and a progress animation on exactly this reasoning. A card that says 'we never read a run
of yours' on the BUY screen is us explaining our own failure at the moment we ask for money."*

**🎓 Sierra.** *"Agreed, and the SLT already settled the principle for the same card in October:
one true sentence beats an empty card, and a padded one is worse than none."*

**🧭 Zhuo.** *"Then the honest finding is that this is not a design problem. Sixty-one per cent of
runners reach the buy screen with nothing to show because the product never ran for them inside
their trial, and the fix for that is item 7, which is built and waiting on the founder. **Designing
a nicer empty paywall would be treating the symptom and would make the cause harder to see.**"*

**⚖️ DON'T SHIP — recorded, with the cause named.** No card, no copy, no treatment for the
no-data cohort. The paywall behaves as it does today: no receipts, straight to the feature list.
**The cause is `ACT-TRIAL-AT-FIRST-READ-01`**, built, flag off, founder's call. 🔻 This row exists so
a later sitting does not re-propose an empty-state card for this cohort without first asking whether
the cohort still exists.

### ⚡ Recorded disagreement

None unresolved. **Collins got what he asked for twice** (one big number on Q1, nothing on Q3b) and
it is recorded as agreement rather than a win, because the measurement carried it both times.

⛰️ **Veto not exercised.** Silvanto's amendment on Q1 is a **correction to a pattern's stated
premise**, not a palette or type regression, and he said so: *"the pattern was right about the
treatment and wrong about where the number comes from. That is debt, not a regression."* His veto
remains untested.

---

## 📦 What ships

| # | Item | Ruling | Artifacts |
|---|---|---|---|
| 1 | `ACT-FREE-TEASE-01` | SLT **BUILD/FREE** + Design **SHIP** (4 amendments) | pattern (`ui-patterns.md` third state) · component + constant · markup check |
| 2 | `ACT-FIRSTRUN-01` (b) | Design **SHIP** (3 amendments) | pattern · `demoSurfaces` consumer · markup check |
| 3 | `ACT-PAYWALL-01` (a) | Design **SHIP** | reorder · markup check asserting order |
| — | `ACT-FIRSTRUN-01` (a) | **DECLINED on measurement** — already satisfied by construction; reaches nobody new | register row |
| — | `ACT-PAYWALL-01` (b) | **DON'T SHIP** — cause is item 7 | register row |

## ⚠️ What this sitting does not settle

- **Nothing has run on a device.** Every measurement here is production data and source.
- **It does not fix the 24 of 37** with no trainable week inside their trial. Item 7 does, and it is
  the founder's decision.
- **It does not give an iPhone-only runner a number.** 24 of 146 free activities carry no split and
  never will without a heart-rate source (ADR-011 §5).
- **`orientation_seen` is 4 of 37**, so Q2's card reaches new runners from here, not the existing 33.
