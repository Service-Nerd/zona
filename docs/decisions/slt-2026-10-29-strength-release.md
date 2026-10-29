# SLT: opening strength to paid and trial runners (2026-10-29, STRENGTH-RELEASE-01)

**Brief:** flip `STRENGTH_RELEASE` from `'admin'` to `'paid'` now that all six STRENGTH-SESSION-REDESIGN-01 builds have
shipped. **Founder:** take it to the SLT now and try it on his phone first. **Tier: PAID** (SLT 2026-10-16, included in
the subscription, not an add-on; trial runners get it through the reverse trial).

**Measured 2026-10-29 (production, read-only):** 23 active or trialing subscriptions (plus reverse-trial runners, who
also reach it); **1 strength plan in the database (the founder's), 2 completions, 2 lift logs.** The whole feature has
two real sessions behind it, and none of the guided flow has run on a phone. `/pricing` lists strength under
`OMITTED_FROM_PRICING` as *"Not built"*. The 2026-10-16 condition was a date (*"when the December cohort is mid-plan"*),
not a readiness test.

⚠️ **No commercial seat** (Traynor stood down): nobody here can say what strength does to trial-to-paid or churn, and
there is no data to read. The reach is small (23 subscriptions), so the cost of being wrong is small too.

## Seats

- **Sutherland.** The timer is the thing people will mention, so the first impression is the guided session on a real
  phone. Do not let 23 people discover a broken wake lock before the founder does. And the Make-A-Wish runners hold
  Apple offer codes, so they resolve to paid: flipping the switch puts strength in front of a charity cohort mid-plan
  without anyone choosing that. Choose it.
- **Fried.** It is built; shipping it is the point. But one row on the pricing page still says "Not built", and a free
  runner who taps the wizard step today hits nothing. Finish item 6, then flip. That is an afternoon, not a programme.
- **Hutchinson.** Coaching is ruled end to end. One live constraint for the release copy: **no injury-prevention claim
  anywhere** (Blagrove's own meta-analysis), and no toning claim (guarded). The pricing row's words go to the Coaching
  Board, as any outcome claim on any surface must (W-03).
- **Wood.** A new two-a-week habit landing in the middle of someone's race block competes with the running. The setup
  already places it around the run week, which is the right context. What has never been decided: what a trial runner
  sees on day 15, when strength disappears. A habit that vanishes without a word teaches the runner the app is
  unreliable. That state must be designed before release, not discovered after.
- **Zhuo.** Two undesigned states, both Design Board: the **lapsed trial** (a strength plan that stops being reachable)
  and the **locked rows** for free runners (item 6). The success condition for the phone check should be written
  before the founder runs it, so "it worked" means something.

## Recorded disagreement

- **Fried vs Sutherland on the charity cohort.** Fried: paid is paid, no special case. Sutherland: a cohort that did not
  ask for strength should not get it by side effect mid-plan. **Unresolved here; it is the founder's partner
  relationship** (👤), so it goes to him.

## Recommendation

**BUILD DIFFERENTLY: release behind four conditions, in order, not a date.**
1. **Phone check by the founder** (two guided sessions): Start → every page → End → Done; screen stays awake; rest and
   timers right after locking the phone; the keypad does not cover the stepper; the completion has its times and the
   logs their reps (verified in production). Written as a checklist before he starts.
2. **Migration `20261029_strength_session_times_and_reps` applied and verified** (3 columns).
3. **Item 6 built:** the `/pricing` row (words through the Coaching Board, no outcome claim), the Upgrade line, locked
   wizard step and modify row for free runners, opening Upgrade.
4. **The lapsed-trial state designed and built** (Design Board): what a runner with a strength plan sees when the trial
   ends.

Then flip `STRENGTH_RELEASE` to `'paid'`. The charity cohort question is the founder's before step 4 ships.

## MUST/NEVER

No streak, badge or celebration added; no hardcoded price; no claim of injury prevention or toning; free runners are not
abandoned (the run plan, session card and log action stay free; only strength is gated).

## Risks to existing features

`canUseStrength` is the single release owner and every strength route enforces it server-side; the flip touches nothing
else. A trial runner's strength data survives the trial (rows are kept; the route answers 404), so a later subscription
brings it back.
