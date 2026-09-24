# PROPOSAL — the email programme

> 🔴 **THIS IS A PROPOSAL, NOT DOCTRINE. Two of the five emails below exist; everything
> else is unbuilt.** It sat in `docs/canonical/` for one commit and was moved here, because
> canonical means *this is how the system behaves* and a canonical file describing
> mostly-unbuilt behaviour is how a doc starts lying. It graduates back a section at a time,
> as things ship.
>
> **Status: SLT APPROVED 2026-09-24, in order, with conditions.** Ruling in full at the
> foot of this document. **One item was killed and one gate was added that nobody had
> raised.** Nothing is built.

| | Live today | In this proposal |
|---|---|---|
| **1 Connect** · **2 First read** · **3 Pattern** | ✗ none exist | new |
| **4 3 days left** (15 sent) · **5 Trial ends today** (20 sent) | ✓ live, unamended | re-led, suppressed, deep-linked |
| Trigger-based, suppression, weekly ceiling, deep links, named colours, guide links | ✗ none | all proposed |

**Proposed owner: the Design Board, Sierra's seat standing.** Scope and seams in
`ownership-map.md`.

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

## The five emails in full — copy, design, CTA

⚠️ **Every line below is a DRAFT for approval, not a locked string.** Voice is `brand.md`
and belongs to the founder. **Every sentence marked 🏃 characterises training and routes to
the Coaching Board before it is written** (W-03). Braces are interpolated; `{name}` omits
cleanly when absent, which is already how the live emails behave.

---

### 1 · Connect — *"We can't coach what we can't see."*

**Fires:** 48h after signup with no health data. Once. Never again.
**Job:** one run in. Nothing else.

> **Subject:** Nothing to read yet.
> **H1:** Nothing to read yet{, name}.
> **Body:** Zonna reads your runs and tells you when you went too hard. Right now it has
> nothing to read, so it has nothing to say.
> **Body:** Connect Apple Health and the next run you do gets read.
> **CTA:** Connect Apple Health →

**Design:** no run paragraph, obviously. **This is the one email in the programme with no
fact about the runner in it**, and it is allowed because its entire job is to earn one.
**Deliberately unfriendly to the ego** and on-brand: it does not say welcome, it does not
thank them for joining, it states a problem and one fix.

---

### 2 · First read — *the email that earns "valued"*

**Fires:** the first run is analysed. Within the hour, not on a cron.
**Job:** prove somebody is paying attention.

> **Subject:** Read your first run.
> **H1:** {km}km on {day}.
> **🏃 Body (verdict, engine-derived):** {verdict line — the existing `verdictLine()` output}
> **Body:** That is the number Zonna will hold you to. Every run from here gets read the
> same way.
> **CTA:** See the full read →  *(deep link to that session)*

**Design:** **the numbers are the headline.** 22px is too small for this one; the distance
and day carry the email and should be the largest thing in it. This is the only email where
the fact is the H1 rather than sitting under it.

🔴 **This is the highest-value email in the programme and the one that does not exist.**
It is the moment the product stops being a claim.

---

### 3 · Pattern — *the only content email*

**Fires:** a real observed pattern across **≥3 analysed runs**. At most once a fortnight.
**Job:** make them better. Not engagement. Sierra's test: *what can they do after three
weeks that they could not before?*

> **Subject:** Your easy runs aren't easy.
> **H1:** Three runs, same problem{, name}.
> **🏃 Body:** {pattern, engine-derived — e.g. "Your last three easy runs all drifted into
> Zone 3. That is the grey zone: too hard to recover from, not hard enough to build
> anything."}
> **Body (conditional):** {guide link, if one exists — see § Conditional links}
> **CTA:** {the guide, if it exists. Otherwise: See your zones →}

**Design:** the pattern is the content. No tips, no list, no "5 ways to".

⚠️ **The pattern set must be authored by the Coaching Board and bounded.** An engine that
can describe any pattern will eventually describe a coincidence as a finding, and this
email carries a Zonna byline into an inbox.

---

### 4 · 3 days left — *re-led*

**Fires:** trial day 11. **Does not fire without an analysed run.**

> **Subject:** {verdict-led when a run exists, e.g. "You held the zone on Tuesday."}
> **H1:** {km}km on {day}. Three days left.
> **🏃 Body:** {verdict line}. Kit has read {n} of your runs.
> **Body:** After day 14 the daily read and the Coach tab pause. Your plan stays.
> **CTA:** Keep the coaching →  *(deep link to Upgrade)*

**What changed:** the runner's fact is the subject and the first half of the H1; the
deadline is the second half. Today the clock leads and the runner is a conditional
paragraph three lines down.

---

### 5 · Trial ends today — *ends on what they gained*

**Fires:** trial day 14. Sends regardless, because a contract ending is notice we owe them.

> **Subject:** Fourteen days, {n} runs read.
> **H1:** {n} runs read{, name}.
> **🏃 Body:** {trial summary — e.g. "You held Zone 2 on 9 of 12 easy runs. When you
> started it was 4."}
> **Body:** From midnight the daily read and the Coach tab pause. Your plan stays, and
> everything above stays true.
> **CTA:** Keep the coaching →  *(deep link to Upgrade)*

**What changed:** it opens on what they built, not on what switches off. ⚠️ **When there is
no data, it must degrade honestly** — *"Fourteen days, no runs read"* is the truthful
version and it is a better email than a padded one.

---

## 🔗 Conditional links — build the mechanism now, light it up later

**Founder proposal, 2026-09-24:** *"we can have conditions in email to send certain links
if they exist. If we build that now it would just work when the pages arrive."*

**This is the right shape and it costs almost nothing, because the catalogue already
exists.** `lib/marketing/articles.ts` exposes `getArticle(slug)`, `guideArticles()`,
`articlePath()` and `guidesArePublished()`. An email asks the catalogue for a guide; if it
is there, the paragraph and the CTA render; if not, they are omitted and the email is
shorter. **No template edit when a guide ships — the email changes the day the page does.**

| | |
|---|---|
| **Mechanism** | `guideLinkFor(topic)` → `{ href, title } \| null`, reading the live catalogue |
| **Rule** | a `null` **removes the paragraph**. It never degrades to a generic line, and never links a hub as a consolation |
| **Gate** | respects `guidesArePublished()`, so an email cannot link a page behind a closed hub |
| **Check** | a test asserting that with an empty catalogue the email renders with no link and no empty paragraph |

⚠️ **The failure mode to design against:** a conditional that silently falls back to the
homepage. That is how the current CTA ended up pointing at nothing in particular.

**Only guides are eligible.** A guide carries `principleRefs`, so every claim names the
principle behind it. **A marketing page has no such citation and does not go in a coaching
email.**

---

## ⭐ Asking for a review

**Founder proposal:** *"we could get them to write a review."*

**Yes, and the timing decides whether it works or costs us.**

🔴 **Not in emails 1, 4 or 5.** Asking for a review inside a countdown, or on the day
coaching pauses, reads as asking for a favour while withdrawing a service. It would be the
single most off-brand thing in the programme.

**The right moment is after a win the runner can feel**, and the two real candidates are
**after their goal race** and **after a genuine measured improvement** — both of which are
the Pattern email's territory, not the trial's.

⚠️ **And the mechanism is probably not email.** Apple's `SKStoreReviewController` puts the
prompt in the app at the moment of the win, needs no deep link, and is the only path that
reaches the App Store rating that actually matters. **An email asking someone to go and
find us on the App Store is four steps and two guesses again.**

**Recommendation: SLT decides the moment; build it in-app, not in an inbox.** Recorded here
because it was proposed here, and because the moment it attaches to (post-race) does not
exist as a surface yet either.

---

## Instrumentation — the thing to build first

**There is no open rate, no click rate, no unsubscribe count, for any email ever sent.**

Every claim in this proposal about what an email will achieve is inference from content and
reach. **If the SLT approves the programme and not the measurement, we will be back here in
three months with the same absence of evidence and a larger surface.** Minimum: a per-email
send/open/click record, and an unsubscribe path, which we are also required to have.


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

---

# ⚖️ SLT ruling — 2026-09-24

**Approved in order, with conditions. One kill. One new blocking gate.**
Tier: **FREE** — every recipient is pre-conversion. ⚠️ Exposes an incoherence: `HOOK-02`,
the existing day-3 push doing a near-identical job, is **PAID and skips free users**.

## 🔴 Tranche 0, which nobody had raised and which blocks everything

**There is no unsubscribe link in any email, no `List-Unsubscribe` header, and no
marketing-consent column in the schema.** The live footer says only *"You're receiving this
because you're in a Zonna trial."* **35 emails have been sent on that basis.**

Emails 4 and 5 are contractual notices and defensible. **Email 3 is marketing and is not.**
Tranche 0 is unsubscribe, the header, a consent column, **and instrumentation** — approving
a programme with no way to tell whether it worked is how this sitting happens again in three
months with a larger surface. Connects to the open founder item `LEGAL-COUNSEL-01`.

## The order, and why it is not the order the proposal was written in

| | What | Gate before build |
|---|---|---|
| **0** | Unsubscribe · `List-Unsubscribe` · consent column · instrumentation | **Blocks everything below** |
| **1** | **Email 1 (Connect)** + fix the CTA on 4 and 5 | Design Board has never seen email 1 |
| **2** | Emails 4 and 5 re-led + suppression | Coaching Board on the 🏃 lines |
| **3** | **Email 2 (First read)** | Coaching Board on the verdict line |
| **4** | Email 3 (Pattern) + conditional links | Coaching Board authors the **bounded pattern set**; marketing consent required |
| — | **The review ask** | ❌ **NOT APPROVED** |

**Wood moved email 1 to the front and won on evidence.** Sutherland's position was that
email 2 *is* the programme and he would fund it alone — *"the only thing here that does
something no competitor can"*. Wood's counter is the measurement: **22 of 30 people never
reach the state email 2 requires.** Email 1 targets the actual friction point and removes a
step rather than adding motivation, which is the structure that changes behaviour. Email 2
is second, not diminished.

## Rulings on the two founder proposals

**🔗 Conditional guide links — APPROVED without reservation** (Fried: *"less code than the
alternative and it deletes a future edit"*). Build against the live `articles.ts` catalogue.
**A `null` removes the paragraph; it never degrades to a generic line and never links a hub
as a consolation.**

**⭐ The review ask — NOT APPROVED. Killed by Wood, opposed by Sutherland, from opposite
directions.**
- **Wood (kill mandate):** *"the purest illusion-of-progress item on the page — it moves a
  number that flatters us and changes nothing for the runner."*
- **Sutherland:** *"a request for a review is a request for a favour, and we are a product
  whose whole posture is that we are doing the runner a favour by holding them back. The
  moment you ask, you invert that."*

**Recorded as a loss for the proposal, not softened.** If it is ever built it belongs to a
post-race surface that does not exist, in-app via `SKStoreReviewController`, never in an
inbox.

## Conditions carried by named seats

**Fried, on email 3:** approved **only bounded in doctrine, not in a comment** — one
pattern, one guide link, one CTA, and it cannot exist without an observed fact. *"Today it
is one honest sentence about their zones. In six months somebody adds a second paragraph,
then a monthly edition, then it has a name."*

**Hutchinson, carried to the Coaching Board:** the pattern set for email 3 must be
**authored and bounded** — an engine that can describe any pattern will eventually describe
a coincidence as a finding, under a Zonna byline. And email 5's summary is a **claim about
improvement** that needs a floor: twelve runs supports it, three does not.

**Zhuo:** **emails 1 and 3 have never been through the Design Board.** They were written
after that sitting, at the founder's request for a full plan. SLT approval does not
substitute for the design ruling. **And the success condition is still unstated** — for
email 1 it is observable and easy: the share of signups with a connected data source, today
**8 of 30**. State the target before building, or we declare victory by looking at it.

**Sutherland, on email 1's tone:** *"deliberately unfriendly and that is why it will work.
The only signup email I have seen that treats the reader as an adult with a job to do. Do
not let anyone warm it up."*

## What nobody at the table could answer

**Conversion.** Traynor's seat is stood down; nobody prices churn or trial-to-paid. Wood
was explicit that emails 4 and 5 **change no behaviour** and should be funded as courtesy
and never reported as conversion work.
