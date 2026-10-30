# COACH-READ-AUTO-01: SLT sitting (2026-10-30)

**Brief:** the main Coach card asks the runner to press "Generate report" to get the coaching they pay for. The Design
Board overturned that (Coach review, `coach-review-2026-10-30.md`). Should the read generate itself, at what tier and
cost, and in what order?

**Tier: PAID** (Coach, `activity_intelligence`). Unchanged.

## Measured first

| | |
|---|---|
| Cost of one weekly read | **~$0.004** (Sonnet, ~1,000 tokens in / 80 out, `ops_events.ai_call`, surface `weekly-report`) → **~2 cents per runner per month** |
| Weekly reads in 56 days | 5, for 2 runners, all by hand (the Sunday cron was dead until `WEEKLY-REPORT-CRON-AUTH-01`, today) |
| What the route does without `force` | returns the week's existing read, else generates one (`weekly-report/route.ts:139`); `force` is capped once a day |

🔴 **Found while preparing the sitting: the two triggers collide.** The Sunday cron calls the route WITHOUT `force`. So
once a runner has a read from earlier in the week (by hand today; by opening Coach after this item), Sunday's push
carries that earlier, thinner headline instead of the week's. The fix belongs in this item: the cron asks for a fresh read.

## The board

🧠 **Sutherland:** *"Making someone press a button to receive the thing they paid for is friction in the wrong place. The
right friction in this product is on the run, not on the advice."*

📦 **Fried:** *"Two cents a month. This is not a cost question. It is the product doing its job. Build it."*

🏃 **Hutchinson:** *"A Monday read built on one run says little, and that is honest as long as it says so. The prompt
already frames a week in flight. The Sunday read is the one that must be complete, which is the cron point."*

🔬 **Wood:** *"The habit cue is Sunday evening: the push, then the read. If Coach on Monday already shows a read, Sunday
must not repeat it. Fresh on Sunday, or the cue teaches people the push is stale. That is my condition."*

🧭 **Zhuo:** *"Two changes, both invisible: the card fills on open, and Sunday is fresh. The button's label and place
are a visible change, so they go to a mockup first, per the founder's rule. Ship the behaviour now."*

## ⚡ Conflicts

None on whether. Wood's condition (a fresh Sunday read) is adopted as part of the item, not as a follow-up.

## ✅ Recommendation: build, PAID, now (before items 5–7)

1. When a paid runner opens Coach and the current week has no read, Coach requests one (no `force`): **at most one
   model call per runner per week** from this path. Loading state is the card's existing shimmer.
2. The Sunday cron requests a fresh read (`force`), so the push and the card reflect the whole week.
3. The "Generate report" / "Refresh" button stays exactly as it is until the mockup (founder rule, 2026-10-30).

**Order:** this, then the mockups for items 5 and 7 and the copy fixes in `COACH-CODE-HYGIENE-01`, then item 6 after
the Coaching Board sets its thresholds.

🚨 **MUST/NEVER:** AI call through the route only (never the client); AIMark already on the read; no new notification;
silent degradation unchanged (ADR-006): a failed generation leaves the existing empty state.

⚠️ **Risks to existing features:** the route's rate limit (`enforceAiRateLimit`) applies to user calls; a runner who
opens Coach repeatedly before a read exists must not loop. One request per mount, and a cached read thereafter.
⚠️ **Traynor's seat is vacant:** nobody priced the retention effect. The test is Coach opens per non-admin runner per
week, before and after.
