# Email programme — when we write to a runner, and why

**Owner: the Design Board, Sierra's seat standing.** Ratified 2026-09-24. Scope and seams
in `ownership-map.md`; this file is the single source of truth for what we send by email.

Before this file existed, **nothing owned email**: no doctrine, no row in the ownership
map, no pattern in `ui-patterns.md`, no voice section in `brand.md`. Two emails had
shipped and a third of the people who received them got a countdown with nothing in it.

---

## The one rule

> **No email without a fact about the runner, except the one whose job is to earn that
> fact.**

Everything below is a consequence of it. It is the restraint positioning applied to the
inbox: a company whose product is *"you can't outrun your easy days"* does not send a
newsletter.

🔴 **Why it is the rule, measured 2026-09-24.** Of 30 trial users, **8 had any logged
activity**. The run paragraph is the only personalised element in either live email, so
**22 of 30 received a countdown headline, one sentence about what they were losing, and a
button**. Five received *"Your coaching pauses today"* as the first and only email Zonna
had ever sent them. **We advertised our own inattention at the moment we asked for money.**

---

## The architecture: three phases, keyed to one event

The first analysed run is the hinge. Before it we know nothing and must not pretend
otherwise; after it, everything we send can be true about them.

| Phase | Trigger | What we know | Job |
|---|---|---|---|
| **A — Earn the fact** | signup, no analysed run yet | nothing | get one run in |
| **B — Say something true** | first analysed run, then meaningful events | their actual running | be worth reading |
| **C — The trial ends** | day 11, day 14 | varies | be honest about what changes |
| **D — After** | conversion, or lapse | — | **almost nothing.** See § What we do not send |

⚠️ **Phase A is the only place a generic email is allowed, and it is allowed because its
job is to stop being necessary.** It must be short, must not fake familiarity, and must
not claim we have noticed anything.

---

## When we send

**Triggers, never dates.** A calendar send tells the runner our clock matters more than
their running. The existing day-11 and day-14 emails are dated because a trial is a
contract, which is the one legitimate exception.

| # | Email | Trigger | Phase |
|---|---|---|---|
| 1 | **Connect** | 48h after signup, no HealthKit data | A |
| 2 | **First read** | first run analysed | B |
| 3 | **Pattern** | a real, observed pattern across ≥3 runs | B |
| 4 | **3 days left** | trial day 11 | C |
| 5 | **Trial ends today** | trial day 14 | C |

**Two suppression rules, and they are the point:**
- **#4 does not send with no analysed run.** Nothing to say, so we say nothing. Silence is
  cheaper than advertising that we were not watching.
- **#2 and #3 cannot fire without their fact.** They are defined by it.

⚠️ **One email per runner per week, hard ceiling.** #4 and #5 are three days apart and
that is already the densest we go.

**Send window: not 08:00 UTC.** The current time is where a cron slot was free. An email
about running should arrive when the runner can act on it or reflect on it, not during the
commute.

---

## The channel seam — push vs email

Push already carries the daily coach note, run analysis, the weekly report, plan
adjustments and the day-3 trial insight. It is the high-frequency, in-the-moment channel
and it should stay that way.

> **Push is for the run that just happened or the one happening today. Email is for what
> needs more than a sentence, or for the people push cannot reach.**

🔴 **Push reaches 27% of trial users — 8 of 30, all iOS** (measured 2026-09-24). `HOOK-02`,
the day-3 insight, has fired **once, ever**, because its "≥2 analysed runs in trial days
3–5" window almost never opens. **Email is not a second copy of push; for three quarters of
our trial users it is the only channel that exists.**

**Never send the same thing on both.** If a message qualifies for push, it does not go by
email as well.

---

## What the message is

Each email does **one** job and says so in its first line.

| Email | The job | The shape of the message |
|---|---|---|
| **Connect** | one run in | You are set up; we cannot coach what we cannot see. One action |
| **First read** | prove we are paying attention | What we saw in their run, in their numbers. **The one email that earns "valued"** |
| **Pattern** | make them better | A pattern they did not notice, and what it means. Links a guide |
| **3 days left** | honest notice | Their running first, the deadline second |
| **Trial ends today** | close well | **What they gained**, then what pauses |

**Voice is `brand.md` and is not this board's.** Honest, slightly sarcastic, self-aware,
never motivational. One sentence beats two. The voice anchor *"Hold the zone"* is available
where the message is about zone commitment.

⚠️ **Any sentence characterising how their training is going is a COACHING claim and routes
to the Coaching Board before it is written** (W-03 precedent). The existing string *"HR held
in zone for most of it. That's the plan working."* is one. So is every line in **Pattern**.

---

## Design of the content

The shell is settled and correct; what follows makes it a pattern rather than an accident.

| | |
|---|---|
| Ground | `--bg` warm slate, 520px white card, 12px radius |
| Eyebrow | brand name, uppercase, `--moss`, 13px |
| H1 | 22px/700, the runner's fact or the one job |
| Body | 16px/1.6, `--ink` for the fact, `--ink-2` for the consequence |
| Footer | 12px `--mute`, why they are receiving it, and that their email is never shared |
| CTA | one, `--moss`, 14×28 padding |

🔴 **The five colours are currently HARDCODED as hex literals in `lib/email/`**, legal only
because the pre-commit hex hook scopes to `app/` and `components/`. They become named
constants; the hook extends to `lib/email/`.

**Rules:**
- **One CTA. Never two.** A second button is an admission we did not decide.
- **No images, no logo lockup, no hero.** It is a note, not a campaign.
- **The fact goes above the ask**, every time.
- **Dark mode is not a thing here** (ADR-008) but mail clients invert anyway: the design
  must survive it, which is the one place email diverges from the app.

---

## CTAs

**One per email, and it is the single action that email exists to cause.**

🔴 **The live CTA is broken.** *"Keep the coaching →"* points at the marketing homepage, so
the journey is email → homepage → find the App Store badge → open app → find Upgrade.
**Four steps, two of them guesses**, on a phone, from an inbox.

| Email | The one action |
|---|---|
| Connect | open the app to the health-connect screen |
| First read | open that run |
| Pattern | read the guide |
| 3 days left / Trial ends today | upgrade, deep-linked |

Deep links land on the screen named, never a hub. Universal Links are the mechanism; until
they ship, the App Store link is the honest fallback and the extra step is a known cost.

---

## Do we send useful content? Nutrition tips and the like

**Yes, as a POINTER, never as content written in the email. And not nutrition, yet.**

**Why a pointer.** `/guides` already exists: articles carrying `principleRefs`, so every
claim names the `CoachingPrinciples.md` section it rests on. That citation is the whole
reason a Zonna guide is worth reading. **An email that restates the content loses the
citation and becomes a tip from an app.** Link the guide.

**Why only when it is about them.** A generic tip makes us look like every other running
app. *"Your last three easy runs drifted into Zone 3. Here is why that feels right and
isn't."* is a thing only we can send, because only we measured it. That is the **Pattern**
email and it is the only content email in the programme.

🔴 **Nutrition specifically: NOT YET, and this is a Coaching Board item before it is a
writing task.** `CoachingPrinciples.md` contains **no nutrition doctrine at all**, so we
would be making physiology claims with nothing behind them, on the open web, under a Zonna
byline. The gap is real and was named by Sims at the 2026-09-24 sitting: under-fuelling is
the other common reason a plateau holds, and the product currently says nothing about it.
**That is a principle to author, not an email to write.**

---

## What we do not send

Recorded so it is not re-proposed, with the reason:

| | Why |
|---|---|
| **A welcome sequence** | We know nothing at signup. A welcome email is a company talking about itself |
| **Post-day-14 re-engagement** | Wood, 2026-09-24: *"a lapsed user emailed repeatedly is a lapsed user who unsubscribes"* |
| **A newsletter or digest** | Not a content business. `/guides` is the content asset and it is pull, not push |
| **Streaks, milestones, "you're on fire"** | Gamification. Banned product-wide |
| **Anything with no fact about the runner in it** | The one rule |

---

## Ownership and routing

| Question | Owner |
|---|---|
| Does this email exist, when does it fire, what does it look like | **Design Board** (Sierra's seat standing) |
| Any sentence about their training, physiology or outcomes | **Coaching Board** — route before writing (W-03) |
| FREE or PAID, cost, sequencing | **SLT** |
| How it sounds; locked brand strings | **`brand.md` / the founder** |

⚠️ **This file is not yet a hard trigger for `design-guard.py`.** Doctrine without a guard
is this repo's most-recorded failure. Wiring it is the mechanical half of this ownership
and has not been done.

---

## Status

**Nothing in this plan is built.** The live programme is emails #4 and #5 only, unamended.
Tranche 1 (fix the CTA, suppress the empty #4, re-lead #4 and #5) and tranche 2 (#2, the
first-read email) are recorded in `docs/decisions/design-2026-09-24-email-programme.md`.
Emails #1 and #3 are new here and have not been through a board.

**No email instrumentation exists.** There is no open rate, no click rate, no unsubscribe
count. Every claim in this document about what an email will achieve is inference from
content and reach, never from behaviour. **The first thing to build alongside tranche 1 is
the ability to tell whether any of it worked.**
