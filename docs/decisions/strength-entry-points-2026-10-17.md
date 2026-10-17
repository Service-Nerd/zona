# Strength entry points, icons, the paywall and Coach — Design Board + SLT (2026-10-17)

**Founder (verbatim, in substance):** *"How do I add strength sessions? Is it from the Me menu? Is it obvious? Should
it be there? We have adjust plan from the plan page, we have the setup wizard (I think it should definitely be
there) and all gates on admin for now. … ensure the entry points are clear and we are shouting about them. I like
the idea of a weight icon. I do want icons to be introduced to our menus or screens where they work. We also need to
consider how we paywall it and feasibility of it. Also … what it adds to the coach screen, what metrics do our
runners want to see and what will show them progress."*

## 📐 Evidence (code, 2026-10-17)
- **Today's only way in:** Me → Your training → *Strength* (admin-only). Me's ruled job is *"find the thing you want
  to change, and go there"*: a door for configuring, not for discovering. **Not obvious, and not where a runner
  looks for "add to my training".**
- **The wizard** is already **19 steps** (`getStepSequence`: 16 for free, +3 paid). Its last training step is
  *"Which days do you run?"* then the weekday cap.
- **Plan's one action** is *"Change your plan"* (`ActionRow` → `ModifyPlanSheet`: days, long-run day, hard sessions,
  terrain). Plan owns the training arc, and strength already shows on its weeks.
- **Coach** (CO-ONE) carries ONE Kit read, then unvoiced evidence (rings, stats, trend, ledger). Strength appears
  nowhere on it. The strength SLT's success measure was *"share of starters doing ≥1 session a week over 4 weeks"*.
- **Upgrade screen** sells five lines; strength is not one. `/pricing` deliberately omits it until release.
- **Icons:** ICON-RULE-01 lets a glyph in where it carries **meaning** or aids **location** on a list of 8+ rows (Me,
  the modify sheet), one family, one size, one tinted container, tint never semantic. **Founder, 2026-09-22: "not
  doing" the Me row icons.** Nav icons are inline line SVGs (`IconToday` etc.), so a dumbbell in that family is cheap.

## 🧭 Design Board
**Settled ground:** Me is an index (door yes, inline no) · Plan owns the arc and its one action · the wizard is a
question-per-screen flow with optional steps defaulted · ICON-RULE-01 (meaning / location, Silvanto's four
constraints) · the founder's 2026-09-22 icon decision · STRENGTH-APP-01 (strength beside the run, never twice).

- **Zhuo (chair):** Success, stated first: *a runner building a plan meets strength without looking for it, and a
  runner mid-plan finds it where they change their plan.* Me alone fails both.
- **Wroblewski:** The wizard needs **one** step, not seven: *"Add strength around your runs?"* with three answers
  (**No** · **Yes, at home** · **Yes, at a gym**) and sessions defaulting to the engine's two. Home and gym map to
  equipment presets; everything else is defaulted and editable later. Place it **after "Which days do you run?"**,
  because that is the moment the runner is thinking about their week. Optional, so *"Not now"* is one tap.
- **Silvanto:** On Plan, strength belongs **in "Change your plan"** as a row, with the week strip already showing it.
  A separate "Add strength" card on Plan competes with the arc. On Today, an invitation is not Today's job, **except
  the rest card**, which has nothing to execute: one quiet line there (*"Strength fits on days like this"* → setup)
  is the right place to meet it mid-plan. Never more than once a week.
- **Sierra:** Coach should show what makes the runner better at the habit, not a vanity number: **"Strength: 2 of 2
  this week"** beside the run stats, and **the plan's own progression** stated plainly (*"Technique block ends next
  week. Heavier from week 5."*). That needs no logging: the engine already knows it. Real progress in load waits for
  Phase 4's logging; **do not fake it before then.**
- **Collins:** This is the thing Runna does outside its plan and we do inside it. **Shout it in the wizard and on the
  upgrade screen**, where people decide. On icons: the dumbbell **earns it by meaning** on the strength session card
  and the Today strength row (it tells a run from a lift at a glance, which the rail colour alone cannot for a
  colour-blind runner). Pushed to put icons on every Me row too; **the board agreed, as the founder now asks** (it
  qualifies under the location rule; ICON-RULE-01 always allowed it).

**Ruling: SHIP WITH AMENDMENT (direction; NOT BUILT):**
1. **Wizard:** one optional step after *"Which days do you run?"*: **No / Yes, at home / Yes, at a gym** (sessions =
  engine default 2). Builds strength right after the run plan saves.
2. **Plan:** a **Strength** row in *"Change your plan"* (the modify sheet), opening the setup.
3. **Today:** one quiet line on the **rest card** only, for runners without strength, at most once a week.
4. **Me:** the door stays (configuration home).
5. **Icons:** a **dumbbell** glyph (nav line family) on the strength session card, the Today strength row and the
  Strength rows (Me, modify sheet). **Me rows and the modify sheet get one glyph each**, Silvanto's constraints:
  one family, one size, one neutral tinted container. **Founder reversal recorded** of 2026-09-22's "not doing it".
  Not on wizard steps, Plan rows or other session cards (no meaning gained).
6. **Coach:** evidence, not a second voice: **"Strength · 2 of 2 this week"** in the stats, and one line of the
  plan's own progression. No streak, no badge, no fake load chart.

## 💼 SLT
- **Tier and paywall:** strength is **included in the existing subscription**, not an add-on. A separate add-on is
  **not feasible now**: a second App Store product, a second RevenueCat entitlement, a second price on `/pricing`, and
  the Make-A-Wish offer codes would each need to know about it. The **reverse trial is the free taste**: every new
  runner gets 14 days with strength.
- **Free runners after the trial** see the wizard step and the modify-sheet row **with a lock**, which open the
  Upgrade screen; strength becomes an Upgrade line (*"Strength around your runs"*) and a `/pricing` row **at release**.
- **Sutherland:** the wizard step is the best paywall we will ever have: the runner asks for it before they pay.
- **Fried:** fine, as long as the free plan is untouched: strength is richness, never access (*"Free users are never
  abandoned"*).
- **Wood:** "2 of 2 this week" changes the cue; a streak would not. Agreed with the board.
- **Hutchinson:** any marketing sentence about what strength does for runners goes past the Coaching Board (no
  injury or performance claim).
- **Zhuo:** carries the Design Board ruling; no overturn.
- ⚠️ No commercial seat: whether strength lifts trial-to-paid is unpriced; the measure stays *≥1 session a week*.
- **Release gate unchanged:** every entry point renders only behind `canUseStrength` until the switch flips.

**Recommendation: BUILD, in this order:** (1) icons (the dumbbell + the Me/modify-sheet glyph set) · (2) the wizard
step · (3) the modify-sheet row · (4) Coach evidence · (5) the rest-card line · (6) at release: Upgrade line,
`/pricing` row, locked states for free.

## ⚠️ Not settled
The words (founder) · the icon set's exact glyphs (a frontend-design pass against Silvanto's constraints) · how the
wizard step behaves when the plan is generated but the strength save fails (it must not block the run plan).
