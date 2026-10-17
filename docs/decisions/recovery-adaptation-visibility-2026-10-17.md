# Making more of recovery-driven plan changes — Design Board + SLT (2026-10-17)

**Founder (verbatim, in substance):** *"Do we make enough noise about how we adapt the plan due to changing recovery
signals? … is this something we promote on our website? When it happens is it providing a real wow moment (as it
should). Is there narrative in our push notifications. Do we show it somewhere on a metric? Maybe show something on
the closed session or in the coach screen. … it's a real sell. Maybe the session tile colour changes etc."*

## 📐 Evidence (measured 2026-10-17: code + production)
- **It has never fired.** `plan_adjustments` holds **0** `readiness_signal` rows of 19 changes ever. In the last 30
  days **20** runners sent resting HR, **12** HRV, **15** sleep. Most plans have not started (December cohort), it
  only checks quality and long days, needs a 14-day baseline, and is paid.
- 🔴 **It would write the WRONG DAY.** `pre-session-readiness` sends the engine ONE session; `confirm-adjustment` and
  `revert-adjustment` write the list back by position (`mon` first). Accepting the ease puts the easy session on
  **Monday** and leaves today hard, unless today is Monday. Filed **P0 `READINESS-WRONG-DAY-01`**. Latent only because
  it has never fired.
- **What the runner sees when it fires:** the amber `TdReadyHero` ("Readiness · easing today", reason chips, the
  summary, *Ease the session* / *Run it anyway*). Steady days show `ReadinessSteadyChip` with the numbers on tap.
- **Nowhere else:** no push (the 06:30 push can announce the hard session the app then eases), no notification row, no
  mark on the tile or the Plan row, not in "Changed this week" (only lists `auto_applied`), nothing on Coach, no
  recovery metric beyond the steady chip.
- **Website:** no HRV, sleep or readiness claim anywhere. Only generic "the plan adjusts". The App Store copy says
  "Your runs and recovery sync automatically"; the iOS permission text names RHR, HRV and sleep.
- ⚠️ **A structural limit the board must price:** recovery data reaches us from the phone when the app opens (or warm
  in the background). The morning push fires before that, so it cannot know today's recovery for a runner who has
  not opened the app since waking.

## 🧭 Design Board
**Settled ground:** semantic pair (moss = held, amber = coaching/cooked) · type accent, not flood · no celebration, no
confetti, no streaks · the easing card's *"Run it anyway"* stays equally visible (never a coercive gate) · *"Showing
adaptation"* was rated INSUFFICIENT EVIDENCE: "claimed and shown nowhere". **That last row is the founder's point,
measured.**

- **Zhuo (chair):** The success condition first: *a runner who had a session eased can say, a week later, that the
  app changed their plan because of how they slept or recovered.* Today nothing outlives the card, so they cannot.
- **Silvanto:** The moment deserves weight, and the weight is the **number**, not colour: *"HRV 38, your normal is 52.
  Easy today."* A runner believes a specific reading. ⛔ **No full tile flood** (type accent rule). A metric dashboard
  of HRV and sleep is the Oura failure: data without context produces anxiety. Show recovery numbers only on the day
  they changed something, plus the steady chip.
- **Sierra:** This is the one feature that makes the runner better: it teaches them to feel the difference between
  a recovered morning and a cooked one. Make the **record** visible so they learn the pattern, not a badge.
- **Wroblewski:** The tile keeps its type colour (an eased quality session simply becomes an easy one, which already
  recolours it), plus a small **"Eased for recovery"** text mark on Today's card, the Plan row and the finished
  session. Text, not colour alone.
- **Collins:** Quiet here is SAFE, not right. This is the thing Runna cannot say. It deserves a **home on the
  website**, and the eased card should open with the reading in large type. Pushed for an amber tile; **lost** on the
  type-accent rule, and agreed the text mark plus the big reading does the work.

**Ruling: SHIP WITH AMENDMENT (direction; each surface builds against it):**
1. **Fix `READINESS-WRONG-DAY-01` first.** Nothing is promoted until the ease lands on the right day.
2. **The moment (Today):** `TdReadyHero` leads with the reading in large type (the runner's number against their own
   normal), then the change. Copy is the founder's.
3. **The record:** an **"Eased for recovery"** text mark on the session card, the Plan row and the finished session;
   confirmed recovery changes listed in **Changed this week**.
4. **Coach:** one quiet line in the weekly read when recovery changed something that week ("Eased Tuesday: sleep was
   4h 40"). Not a new card, not a score, not a streak.
5. **Push:** when the app has opened and eased today's session, a push or notification saying so is allowed **only
   if the runner has not already seen the card**; the morning push may not claim recovery it has not read.
6. **No HRV/sleep dashboard.** **No tile colour flood.**

## 💼 SLT
- **Tier:** stays PAID (`activity_intelligence`); the Today card remains, Free sees nothing new.
- **Sutherland:** "It listened to your body" is the most persuasive sentence we own, and it is *costly*: a coach that
  tells you to do LESS is the opposite of every other app. Lead with it on the website.
- **Fried:** Earned feature, but not before it works. It has fired zero times and would write Monday. Fix, then make
  noise.
- **Hutchinson:** Any website or push sentence about what HRV/RHR/sleep *mean* is a physiology claim: **Coaching Board
  first (W-03).** Say what the app DOES ("When your resting heart rate, HRV or sleep are off your normal, it eases the
  hard session. You decide.") and never what it prevents. And be honest that it needs a watch.
- **Wood:** The record (point 3) is habit-forming: it changes the runner's cue. A streak of "eased" would be
  gamification; **no count, no streak.**
- **Zhuo:** Carries the Design Board ruling; no overturn.
- ⚠️ **No commercial seat** (Traynor stood down): whether this lifts trial-to-paid is unpriced.

**Recommendation: BUILD, in this order:** (1) `READINESS-WRONG-DAY-01` (P0 defect, no board) · (2)
`READINESS-SURFACE-01` Today moment + record marks + Changed this week (Design Board ruled) · (3) Coach line ·
(4) website section, **Coaching Board on the words first** · (5) the post-open push. Measure: share of fired eases
accepted, and whether runners who saw one keep the plan the next week.

## ⚠️ Not settled
The words (founder; website words also Coaching Board) · whether a background (closed-app) read can make the morning
push recovery-aware (native work; `HealthObserverPlugin` runs warm, not killed) · the eased-day push design.
