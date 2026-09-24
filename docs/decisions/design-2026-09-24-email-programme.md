# The customer email programme — Design Board, then SLT

**2026-09-24.** Founder brief: *"I want this to be a great experience and all customers to
feel valued and related to."* Register row: `design-rulings.md` § 2026-09-24.

**Nothing was built.** This is research before build, and it ends with one tranche ready
to start and one unblocked by a measurement taken after the sitting.

---

## What exists today, measured rather than described

Two emails. Both about the trial ending. Fired by a single GitHub Actions cron at 08:00
UTC, stamped once each in `user_settings`, excluding paid and charity-grant users
(`decideTrialEmails`, whose access argument is **required** — the dangerous default is
*send*, so the compiler makes every call site answer).

| | Day 11 | Day 14 |
|---|---|---|
| Subject | *"3 days left."* | *"Your coaching pauses today."* |
| H1 | *"3 days left{, name}."* | *"Trial ends today{, name}."* |
| Optional para | last analysed run: km, day, zone verdict, count of runs read | same, past tense, across the trial |
| Body | *"After day 14, daily analysis and the Coach tab pause. Your plan stays."* | *"Daily analysis and the Coach tab pause from midnight. Your plan stays."* |
| CTA | *"Keep the coaching →"* → **the marketing homepage** | same |

**Nothing else exists.** No welcome, no onboarding, no post-race, no re-engagement,
nothing after day 14 ever.

### The measurement that decided the sitting

| | |
|---|---|
| Users, all with a trial | **30** |
| Day-11 emails sent | **15** |
| Day-14 emails sent | **20** |
| Users with **any** logged activity | **8 of 30** |

🔴 **The run paragraph is the only personalised element and it can reach at most 8 of 30
people.** For the other 22 both emails render as a countdown, one sentence about what is
being withdrawn, and a button.

⚠️ **20 received day-14 and only 15 received day-11**, so five people got *"Your coaching
pauses today"* as the **first and only email Zonna has ever sent them**.

---

## Design Board — SHIP WITH AMENDMENT (4)

Full ruling in the register. The four amendments: **(1)** one new email, triggered by the
first analysed run and not by a date, which does not send if there is no run; **(2)** day
11 leads with the runner rather than the clock; **(3)** day 14 ends on what they gained;
**(4)** fix the CTA target.

The board **refused to design eight emails**, and Zhuo asked for that to be protected in
the minute, because *"customers feel valued"* is the brief most likely to be answered with
volume.

---

## SLT — build differently, in two tranches

**Tier: FREE.** Every recipient is pre-conversion by definition; a PAID gate on a trial
email is incoherent. ⚠️ **This exposes a tier incoherence to resolve:** `HOOK-02`, the
existing day-3 trial push, is tagged **PAID and skips free users**.

### 🔴 The registry check changed the item

**A day-3 trial touch already exists.** `HOOK-02` — *"Kit noticed something."* — is the
same job as amendment 1 (early, triggered by real analysis, does not fire without it),
delivered by **push**, gated on **≥2 analysed runs in trial days 3–5**, and requiring push
permission. **Fried's position: two systems doing one job is the thing he kills.** He
asked why the push had not done the job before anyone wrote an email template.

### The measurement that answers it, taken after the sitting

| | |
|---|---|
| Trial users holding a push subscription | **8 of 30 — 27%**, all iOS |
| `push_subscriptions` rows | 11 |
| **HOOK-02 sends, ever** | **1** |
| `run_analysis` rows with feedback | 143 |

**Push cannot carry the early touch.** 73% of trial users cannot receive it at all, and
among the 8 who can it has fired **once**, because the ≥2-runs-in-days-3-to-5 window
almost never opens. **Tranche 2 resolves to: build the email, do not fix the push.**

### Tranche 1 — uncontested, cheap, no new surface
- **Fix the CTA.** The single action we ask for costs four steps and two guesses.
- **Amendments 2 and 3.** ⚠️ **Copy routes to the Coaching Board first** — Hutchinson's
  boundary, W-03 precedent: *"HR held in zone for most of it. That's the plan working."*
  is a claim about training working, and so is any new sentence characterising a trial.
- **Suppress the empty variant.** No analysed run, no day-11 send.

### Tranche 2 — now unblocked by the measurement above
Build the board's early email. **Do not build both channels.**

### Not funded
Any welcome sequence, any post-day-14 re-engagement, any "programme". Wood: *"a lapsed
user emailed repeatedly is a lapsed user who unsubscribes."*

---

## Conflicts, recorded rather than synthesised

**Sierra vs Wroblewski — should day 11 send when there is nothing to say?** Sierra: it
advertises that we have nothing. Wroblewski: silence then a cliff is worse. The board could
not settle it because **no open or click data exists**. Sutherland resolved it at the SLT
on a different argument: an email whose personalised sentence is empty is *"worth less than
nothing"* at the moment we ask for money, and **not sending is on-brand for the restraint
company**. Tranche 1 takes the suppression.

**Fried vs the board on channel** — resolved by measurement, above, in the board's favour.

---

## What nobody at the table could answer

**Conversion.** Traynor's commercial seat was stood down 2026-09-22 and nobody now prices
churn or trial-to-paid. Wood was explicit that amendments 2, 3 and 4 **change how a person
feels about a decision they have already made, not their behaviour** — and that an email
arriving at 8am cannot make anyone hold a zone at 6pm. **Fund this as courtesy, which is
what was asked for. It should not be claimed as conversion work.**

---

## Open, not actioned

- **Five hardcoded hex values in `lib/email/`**, outside the pre-commit hook's `app/` +
  `components/` scope. Pre-existing; amendment 2 of the artifacts list.
- **Tier incoherence:** HOOK-02 PAID and free-skipping vs these emails FREE.
- **`waitlist` is dead** — 0 rows, no send path has ever existed. Founder has flagged it
  for a cleanup activity, deliberately out of scope here.
- **No email instrumentation at all.** Every claim about effect in this note is inference
  from content and reach, never from behaviour.
