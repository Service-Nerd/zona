# Runbook — the one question to ask Make-A-Wish

**Why this exists.** `S111-SUBFLOOR-VOLUME-01` is a P0 that cannot be decided
inside the repo. The SLT ruled on 2026-09-19 that the first step is not to build
anything — it is to **ask the charity what their runners actually run**. This is
that ask, written so it can be sent as-is.

**Owner: founder.** Nothing in the engine moves until an answer comes back.

---

## What we need and why

§111 refuses a marathon plan when the delivered peak is more than 4× the
runner's current weekly volume. **Measured, the door sits at exactly
12 km/week** for the London-2027 profile (29-week runway, finish goal, 4 days,
first-timer). A runner at 8, 10 or 11 km/week gets no plan — only a "not yet"
screen telling them to build to 12 km/week first.

**We do not know what share of the 500 that affects.** There is no data: no
charity code has ever been redeemed, and one analytics event exists in the whole
app. Every estimate we could make would be an assumption dressed as a number,
and the SLT explicitly refused to size a build on one.

**One number changes the decision.** If almost none of their runners are under
12 km/week, this is a non-issue and we stop. If a large share are, it justifies
a base-building plan type before October — which is weeks of work and a
Coaching Board sitting, and Wood has already used her kill mandate against
building it blind.

---

## The message to send

> Hi [name],
>
> One question that will shape what we build for your runners before the codes
> go out.
>
> When someone accepts a London place with you, roughly how much are they
> running at that point? Specifically: **what proportion are running less than
> about 12 km (7.5 miles) a week, or not running at all yet?**
>
> A rough split is genuinely enough — something like "most are already running
> a few times a week", or "about half are starting from nothing". We do not
> need names or individual data.
>
> The reason: our plans are built to stop people overtraining, so for someone
> starting from very little the honest first step is a few weeks of base
> building before a marathon block begins. We want to know whether that is the
> common case for your runners or the rare one, because it changes what we
> build for them and we would rather ask you than guess.
>
> No rush if it takes a while to find out — but it would be useful before
> [date the codes go out].
>
> Thanks,
> [founder]

---

## What each answer triggers

| Answer | What we do |
|---|---|
| **Few are under 12 km/week** | Nothing. `S111-SUBFLOOR-VOLUME-01` closes. The refusal screen already handles the tail honestly. |
| **A meaningful share are (say 20%+)** | Re-open the base-building plan type with the SLT, now with a size. Wood's objection was to building it blind, not to building it. |
| **Most are starting from nothing** | Escalate hard — the refusal is then the primary experience for the cohort, and the October date is at risk. |
| **They don't know** | Also an answer: it means we ship the current behaviour and instrument the redemption flow to find out (folds into `GTM-CHARITY-06`). |

---

## What this does NOT ask, deliberately

- **Not their training history in detail.** We need one proportion, not a survey.
  A long questionnaire gets a slow answer or none.
- **Not a commitment from them.** This is intelligence, not a negotiation.
- **Not about injuries or goals.** Those change the plan but not this decision.

---

## Related

- `S111-SUBFLOOR-VOLUME-01` — the blocked item (roadmap engine table)
- `docs/decisions/slt-2026-09-19-base-building.md` — the ruling that produced this
- `GTM-CHARITY-08` — the code batch this should travel with
- `GTM-CHARITY-06` — instrumentation, if the answer is "we don't know"
- §111 *Recorded limitation* in `CoachingPrinciples.md` — why the door is where it is
