# SLT — SESSION-JOURNEY-01: don't build, with a date and a number

**2026-10-07.** Founder instruction, widening `POSTRUN-JOURNEY-01` the same day the Design
Board ruled it: *"consider the whole experience from I get my session, I understand what I need
to do, to I've now logged it, to oh I can look at those metrics… from end to end."*

## The measurement that reframed it

**The funnel, production, 2026-10-07:**

| Step | Users |
|---|---|
| Have a plan | **30** |
| Connected a health source | 28 |
| Ever had a run ARRIVE | **16** |
| Logged a session | **6** |
| Got a scored read | 3 |
| Logged anything in the last 14 days | **3** |

43 accounts; 15 signed in within 7 days. **18 distinct users have opened the Coach screen while
3 have any scored runs.** 16 subscriptions active or trialing, **zero paying — every one comped.**

🔴 **The arc breaks at steps 3 and 4, not at step 6.** The aggregation the founder keeps asking
for would serve **three people**, while 24 of 30 plan-holders have never logged a session.

⚠️ **AND THAT FUNNEL WAS MEASURED THROUGH FOUR DEFECTS FIXED THE SAME DAY** —
`COMPLETION-CLAIM-UUID-01` (no auto-link wrote a completion for ANYONE 09-24 → 10-07),
`AUTOLINK-OVERRIDE-BLIND-01` (a moved session could never link: 54.4% of all sessions),
`POSTRUN-POLL-WEEK-BLIND-01` (17 minutes of fake loading over data written in 127 ms), and the
free-tier ingest 403. **"Nobody logs sessions" may be a measurement of a broken product rather
than of demand, and that cannot be told apart from here.**

## Ruling — DON'T BUILD, deferred on a measurement

1. **No step-6 aggregation.** 📦 Fried: *"That is not an absence of aggregation. That is seven
   aggregations nobody can see."* Coach already renders ZoneRings, a drift detector, three
   TrendCards, LoadShape, weekly reports and phase summaries. The binding constraint is **supply,
   not analysis**.
2. **No step-3 surface yet.** 🔬 Wood, exercising the kill mandate: aggregation is the
   **illusion-of-progress class** — it makes the APP look like it understands the runner and
   changes no context at the moment of the behaviour. And a mid-run intervention designed for
   three users with no device testing is a guess.
3. **RE-MEASURE 2026-11-04.** The deciding number is **users who log a session: 6 today.** If it
   has not moved materially four weeks after the fixes, the problem was never the aggregation and
   this item changes shape entirely.
4. **Fix Coach's empty state now** → Design Board. 🧠 Sutherland: *"fifteen people have had the
   experience of opening the cleverest screen in your product and finding a room with no furniture
   in it. You did not fail to impress them, you taught them the thing is hollow."*
5. **Rule `HK-FREE-INGEST-LINE-01` separately and now.** 🏃 Hutchinson called it a doctrine breach
   rather than a trade: *"we are deleting an athlete's training history to enforce a price."*

## Recorded conflicts

**Sutherland vs Fried on Coach's empty state** — Fried: fix the pipe, leave Coach alone.
Sutherland: the pipe fix is invisible to the fifteen already burned. **Both right about different
populations.**

**Wood vs the founder on where the arc breaks** — he keeps arriving at step 6; Wood holds that
step 3 is the only point where behaviour can change, and step 6 is the comfortable one to build
because it is a screen rather than an intervention.

## ⚠️ Nobody priced it

**Traynor's commercial seat is stood down and the recall trigger is NOT met** — revenue is zero
and every subscription is comped. The question *"what does not building this cost us in churn"*
got **silence, not an answer.** Recorded so the silence is not read as consensus.

🧭 **Zhuo's condition on any future sitting:** *"you cannot review a journey nobody has walked."*
Every board sitting on record is screen-by-screen, because that is the only evidence that exists.
**The deliverable worth funding is a walked journey — one runner, one device, one block, observed.**
Nothing has run on a device.
