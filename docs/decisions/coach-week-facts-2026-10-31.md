# Coach: the Sessions and Strength cards — Design Board (2026-10-31)

**Input:** founder screenshot, 2026-10-31: *"Look at the sessions and strength cards. Is there an opportunity to make
these two more consistent or on the same line? Are they positioned in the right place on the coach screen… These are
just numbers. What do they show? Are they in the right place? What does it mean to the runner?"*

**Trigger:** soft, qualifies (a runner would notice). **Tier:** PAID (Coach). **Mockups:**
`coach-week-mockups.png`, sent to the founder 2026-10-31. Nothing built.

## What the two cards show (read from the code)

| Card | Source | Shows | Verdict |
|---|---|---|---|
| Sessions `2/3 on track` | `liveSessionsCompleted / liveSessionsPlanned` (`DashboardClient.tsx`) | **Run** sessions done of the week's planned **runs**. Strength is not counted | `sessionsContext`: judged against sessions **due by yesterday** (§65), one outstanding is never a judgement |
| Strength `2 of 2 this week` | `strengthWeek` (STRENGTH-ENTRY-01) | Strength sessions done of planned | None. A progression line ("Heavier lifts from week N") only when the plan has a next step |

Measured differences: two layouts (one-line vs stacked), two number formats (`2/3` vs `2 of 2`), two type treatments
(17px/800 vs 15px/700), one verdict vs none. **"Sessions" counts runs only**, which was true before strength existed and
is ambiguous now that strength sessions are sessions too.

## Settled ground touched

- **A5** — Sessions *"deliberately keeps its number"*: `3/5` means something without a tap. Every option keeps it.
- **RUNKED-LOAD-VIEW-01** — Sessions became a row under the full-width load card (founder-approved mockup, 2026-10-30).
- **STRENGTH-ENTRY-01** — Coach shows *"Strength · 2 of 2 this week"* + one progression line; no streak, no load chart.
- **UX-COACH-01** — block order (read + rings, race arc, stats, trend). Option C re-orders it; **priced, not reversed**.
- **Pattern 32** — no tile that restates a chart. Option B removes a tile rather than adding one.

## The sitting

🧭 **Zhuo:** *"The founder asked 'what do they mean'. Today: two receipts, typeset differently. The decision is whether
they are their own thing or part of 'this week'. They are part of this week."*

✋ **Silvanto:** *"Now before over time. Load, runs and strength are this week; the race arc is months. It sits between
Kit's read and this week's facts, so the screen goes now, later, now, later."* Proposes C's order.

🎓 **Sierra:** *"'2 of 3' alone teaches nothing. Next to the load bars it does: you ran more than usual AND you did the
work, or you ran more than usual from fewer sessions. That pairing is the meaning."* Prefers B.

📱 **Wroblewski:** *"Two cards, two formats, one fact each, 200px of scroll. And 'Sessions' is now a wrong word."* Accepts
A or B; **requires "runs" not "sessions"**.

🎪 **Collins:** *"A is two cards wearing one coat. B removes one. The quiet here was safe, not right."* Backs B, and C's order.

## Recommendation — founder picked C, 2026-10-31 · built the same day

**C** = B (runs and strength as one line at the foot of the load card, renamed "This week") + race times moved below
the trend. Unanimous on renaming Sessions to **runs**. A is the safe fallback.

**Not settled:** whether the load card's eyebrow "This week's load" becomes "This week" (copy); whether strength gets a
verdict word; the strength progression line's place in B (proposed: after the strength count, same line, wraps).
Nobody has seen any option on a device. Order change C is the founder's call before build.
