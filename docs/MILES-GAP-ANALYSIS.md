# Miles teardown — Phase 1 gap analysis

**Produced:** 2026-09-20 · **Against:** `docs/competitor/miles-teardown-brief.md` §3, and
`docs/ONBOARDING-AUDIT.md` (Phase 0) · **Commit:** `c179860`

All twenty items, T-01 to T-20. Every item marked **ALREADY DONE / PARTIAL / GAP** with code
evidence. Every PARTIAL and GAP carries the full §3A impact block — every field, no exceptions.

**All 17 screenshots viewed.** Visual judgements are stated as observations from the image, not
inferred from the brief's prose.

> **Nothing here is a proposal.** Phase 2 writes proposals. This document assesses.

---

## Summary

| | Items |
|---|---|
| **ALREADY DONE** (2) | T-05 · T-18 |
| **PARTIAL** (12) | T-01 · T-03 · T-04 · T-07 · T-08 · T-09 · T-10 · T-11 · T-12 · T-14 · T-16 · T-20 |
| **GAP** (6) | T-02 · T-06 · T-13 · T-15 · T-17 · T-19 |

**Priority shape.** Two items are P0. Seven are P1. The rest are P2/P3.

### Four findings that change how the brief should be read

**1. Their palette is ours.** Miles's background is a warm off-white within a shade of `--bg`
`#F3F0EB`, their accent a muted green within a shade of `--moss` `#6B8E6B`, their cards white with
a soft warm shadow. **Warm-neutral-plus-single-green is not our differentiator — it is the category
default**, and the screenshots prove it rather than suggest it. This is the strongest available
argument for P-01, and it is an argument from evidence rather than taste.

**2. Their progress indicator is also a line with no number.** `IMG_7174`, `7175`, `7176`, `7177`,
`7178`, `7179` all show a thin green fill with no step count. P-05's "add Step 3 of 7" would
therefore not be copying Miles; it would be reversing our own CI-1 decision *and* diverging from
the competitor.

**3. Their projection cites a source it does not have.** `IMG_7187` reads **"PROJECTED FINISH
1:04:37 – 1:10:01 · Projected from your logged runs"** while `IMG_7185` shows **0 runs**. The
brief credits them for stating the source. They state it; it is false. Our hard rule 8 says never
state a projection without stating what it is derived from — this screenshot shows the rule needs
a second half: *and the derivation must exist.*

**4. Their exit offer undercuts their own paywall by £24.** `IMG_7183` sells yearly at £79.99
under a "SAVE 49%" badge. `IMG_7184`, one tap later, sells the same thing at £55.99. The first
price was not the best price, and the user now knows it.

---

# ONBOARDING

## T-01 · Launch screen — `IMG_7172.PNG`

**Verdict:** PARTIAL
**Evidence:** `app/auth/login/page.tsx`. `Wordmark` component, Apple + Google buttons, email form
"disclosed, not displayed" (UX-AUTH-02, line 53). No `backgroundImage`, no `<video>`, no `<img>` —
grep returns none. So: wordmark-led on flat `--bg`, not full-bleed.
**Ours vs theirs:** Theirs is more arresting and less legible. Observed in the image: "PLAN" and
"IMPROVE" at low opacity sit directly over dappled foliage and are close to unreadable; only "RUN."
carries. The model is face-on and mid-shot — the exact case Section 6 flags as a model-release risk.
Ours is legible and safe and says nothing.

- **UX change:** First screen before auth becomes a looping desaturated video with a three-word
  stack. Same buttons, same positions. One screen, one change; no flow position moves.
- **UI / design:** New pattern — full-bleed media with a bottom scrim. Tokens: `--ink` for the
  scrim terminus, `--moss` for the accent full stop and the Apple button, `--font-brand` at hero
  weight 800 / −0.02em. **The scrim is the load-bearing part** — without it we reproduce their
  legibility failure. No new colour tokens; the scrim is an alpha ramp on `--ink`, which must be
  tokenised, not inlined (GAP-08).
- **Data points:** None. No schema change, no migration.
- **Engine impact:** **None.** This screen renders before authentication; the engine is not
  reachable from it.
- **Copy / voice:** Three words plus a line. The brief proposes **EASY. HARD. EASY.** That is a
  pattern-setting copy decision and a brand surface → **RUSS**.
- **Upstream:** Stock footage sourced and licensed per Section 6; licence pages stored under
  `/docs/licences/`. Video asset budget on a Capacitor `server.url` app — the clip loads over the
  network on first launch, so it needs a poster frame and a size ceiling.
- **Downstream:** Login is the only pre-auth screen; nothing else consumes it. First-launch
  perceived performance is the risk: a heavy clip in front of the sign-in button is worse than a
  wordmark.
- **Free vs Pro:** Pre-auth. Neither.
- **Backlog:** **NEW.** No existing item covers the login visual. (`BRAND-*` tech-debt items cover
  rebrand residue, not this.)
- **Approval:** **RUSS** — brand surface, hero typography, and pattern-setting copy.
- **Priority:** **P3.** Highest visible polish per unit of code, but it changes nothing for a
  runner who is already in, and it is gated on asset sourcing. Do it when the product behind it is
  worth the door.

---

## T-02 · Name capture — `IMG_7173.PNG`

**Verdict:** GAP
**Evidence:** `grep -c "athlete_name\|What should I call you\|first_name" app/dashboard/GeneratePlanScreen.tsx` → **0**.
The wizard never asks. `first_name` arrives from OAuth metadata (`DashboardClient.tsx:495–505`
writes `user.user_metadata.full_name` into `user_settings`) or is typed later in Profile.
`app/api/generate-plan/route.ts:96` injects it server-side as `athlete_name`.

- **UX change:** One new screen at the top of the wizard, or — the alternative the audit favours —
  **no new screen, because we usually already have the name.** Apple and Google both return it on
  first authorization, and `PROFILE-NAME-01` shipped the plumbing. The real gap is the **case where
  we don't**: an Apple user who chose "Hide My Email" and declined name sharing, or a
  reset-password user. Today that runner is silently nameless and the ceremony's personalised lines
  and the reveal both degrade.
- **UI / design:** If built: `TextField` (exists), `STEP_META` entry, one more step in
  `getStepSequence`. No new component. If built as a fallback-only ask, it needs a conditional step,
  which `getStepSequence` already supports (it branches on goal and tier).
- **Data points:** None new. `user_settings.first_name` already exists and is already the single
  owner. No migration.
- **Engine impact:** **None on prescription.** `athlete_name` reaches `meta` and the enricher
  prompt only. ⚠️ **It is, however, in scope for `ENRICH-PII-MINIMISE-01`** (SLT 2026-09-20), which
  proposes we stop sending the name to Anthropic at all and resolve it client-side. Adding a
  capture screen for a value we are about to stop transmitting would be incoherent. **These two
  items must be sequenced together.**
- **Copy / voice:** "What should I call you?" is theirs. Ours would need its own line, and it is
  pattern-setting → **RUSS**.
- **Upstream:** `ENRICH-PII-MINIMISE-01` decision first.
- **Downstream:** Ceremony personalised lines (`ceremonyLines.ts`), the reveal heading, `voiceRules.ts`
  lines 98/116/144, and every coach surface that uses `firstName`.
- **Free vs Pro:** FREE. It is identity, not intelligence.
- **Backlog:** **NEW**, and it should be filed as *"the nameless-runner fallback"*, not
  *"add a name screen"* — the general case is already solved.
- **Approval:** **RUSS** (copy).
- **Priority:** **P3.** Affects only the minority who decline name sharing, and the fix is one
  conditional step. But it is cheap and it removes a silent degradation.

---

## T-03 · Goal selection with plan length — `IMG_7174.PNG`

**Verdict:** PARTIAL
**Evidence:** `GeneratePlanScreen.tsx:80–87` — `DISTANCES` carries `label`, `value`, `paid`.
**No length.** Observed in `IMG_7174`: each of their four cards reads "8–12 week plan",
"10–16 week plan", "12–20 week plan", "16–24 week plan" as a subtitle.
**Ours vs theirs:** We offer **six** distances to their four (5K, 10K, Half, Marathon, **50K,
100K**) and lock the paid ones on the tile. They show ranges; we show nothing.

- **UX change:** Each distance tile gains a second line: the plan-length range. The runner learns
  the commitment before choosing, and learns that length is *calculated* rather than fixed.
- **UI / design:** No new component — the tile already supports a subtitle pattern (`CardSelect`
  renders title + sub elsewhere in the wizard). Tokens: `--mute` for the subtitle, 12–13px/400.
- **Data points:** **None new, and this is the important part — the numbers already exist.**
  `PLAN_SIGNATURES[distance]` holds the per-distance shape and `lib/plan/length.ts` computes
  length. The range must be **read from config, never typed into the component** (INV-CFG-001), or
  it becomes the homepage "four answers" defect again: prose about a rule drifting from the rule.
- **Engine impact:** **None.** Display only. The engine already computes length; this surfaces it.
  ⚠️ But see below — the honest range is not a constant.
- **Copy / voice:** "8–12 week plan". En dash in the range is correct and must be kept
  (`noEmDash.test.ts` allows en dashes; em dashes are banned).
- **Upstream:** A decision on **what the range means**. §97 lets a long runway earn a longer plan,
  and §44 refuses below a minimum. So the true range is `[prep-time minimum, max weeks]`, and it is
  runner-dependent. Showing a fixed "16–24" before we know their race date would be a claim the
  engine may not honour — **hard rule 7**. The honest version shows the range and, once the date is
  entered, the actual computed length.
- **Downstream:** Nothing. Tiles are read-only.
- **Free vs Pro:** FREE. It is information about what the product does, on the paywall tile itself.
- **Backlog:** **NEW.**
- **Approval:** **NONE** if the range is read from config and the copy is a bare range. **RUSS** if
  any framing sentence is added.
- **Priority:** **P2.** Cheap, honest, and it makes the ultra distances legible as a differentiator
  — Miles cannot offer them at all.

---

## T-04 · Ability tiers — `IMG_7175.PNG`

**Verdict:** PARTIAL
**Evidence:** `GeneratePlanScreen.tsx` step `your-level`; `recommendFitnessLevel(weeklyKm,
longestRun, trainingAge)` in `lib/plan/fitnessAssessment.ts`; copy *"Based on what you told us.
Overrule it if we've got it wrong."* §79 splits `user_declared_level` (intensity-only upward) from
`fitness_level` (structural).
**Ours vs theirs — ours is better on the axis and worse on the door.**
Better: we **derive** the level from three answers and ask them to confirm, rather than asking them
to self-label cold. Our upward declarations cannot touch structure (§79 asymmetry), so a runner
flattering themselves cannot hurt themselves. And we have no "Elite" — hard rule 3.
Worse: observed in `IMG_7175`, their fifth option is a **dashed-border card with a leaf icon** —
*"I'm just getting started. Not running 5k yet. I'll switch you to a run-walk start."* We have no
equivalent. Our sub-threshold runner meets **`MARATHON-VOLUME-GATE-01`**, which refuses outright.

- **UX change:** Two changes, and the second is the one that matters.
  (a) The level step gains a visually separate escape hatch for the runner below our floors.
  (b) That hatch routes to **something**, rather than to a refusal. Today the equivalent journey is:
  answer everything → generating → **refusal screen** (`REFUSAL-SCREEN-01`: "a deliberate coaching
  decision is presented as a crash").
- **UI / design:** Dashed-border card variant of `CardSelect`. Tokens: `--line` at dashed, `--mute`
  for the icon, `--ink-2` for the body. Visually subordinate to the four solid cards — the point of
  the pattern is that it reads as *a different kind of answer*, not a fifth tier.
- **Data points:** Potentially a new value. If the hatch means "run-walk start", that is a
  prescription concept we do not have. `run_walk_strategy` exists on `Session` (`types/plan.ts`) as
  an **AI-DEPTH-07 reserved field the engine does not populate**. Making it real is a coaching
  change, not a UI change.
- **Engine impact:** **Yes, and it is the largest in this document.** A run-walk on-ramp is a new
  prescription shape. It interacts with §111 (base-build ratio), §2 (ramp cap), §44 (prep-time),
  `MARATHON-VOLUME-GATE-01` and `S111-SUBFLOOR-VOLUME-01` — the last of which the board already
  sat on and returned **INSUFFICIENT EVIDENCE**, escalated to the SLT. **This must go to the
  Coaching Board before it is scoped**, and it is not for me or the SLT to decide.
  What the engine does today: refuses. What it would do: prescribe a run-walk progression to the
  floor, then hand over to the normal generator.
- **Copy / voice:** The hatch copy is pattern-setting → **RUSS**. It must not flatter and must not
  promise a marathon it cannot deliver.
- **Upstream:** Coaching Board ruling. `S111-SUBFLOOR-VOLUME-01` resolution.
  `REFUSAL-SCREEN-01` — without it the hatch leads to a crash-looking screen anyway.
- **Downstream:** `validatePlan` gains invariants. `cohortGrid` cannot currently express this
  runner (`GRID-MARATHON-CAPABLE-01`), so **we could not measure the change** — that is a blocker,
  not a footnote.
- **Free vs Pro:** **FREE, unambiguously.** This is the least-able cohort and the one most likely
  to be on free. Same reasoning that deleted `injury_adaptations_new` from the paid gates.
- **Backlog:** **UPDATE `S111-SUBFLOOR-VOLUME-01`** (it is the same question, already escalated)
  and **UPDATE `MARATHON-VOLUME-GATE-01`** (it is the refusal this replaces). Do **not** file a new
  engine item — two exist.
- **Approval:** **RUSS** for copy; **Coaching Board** for the prescription. Not SLT-first.
- **Priority:** **P0 — but as the existing items, not as a teardown item.** ~500 Make-A-Wish
  runners arrive in October, a large share of them first-time marathoners below our volume floor.
  The brief has independently rediscovered our own P0. That convergence is the finding.

**The Strava half of the brief's BEAT — "don't ask, tell them"** ("Nine of your last ten runs were
above easy pace") — is **not buildable at wizard time on web and only partly on native.**
Phase 0 Q4: on native, HealthKit connects before the wizard (CI-4) and we read HR; on web nothing
connects at all. And "nine of ten above easy pace" needs per-run HR-zone analysis, which is
`activity_intelligence` — **PAID**. Gating the *level question* behind a paid signal is not
possible. Realistic scope: native-only, and only where a zone history exists.

---

## T-05 · Benchmark + reassurance copy — `IMG_7176.PNG`

**Verdict:** **ALREADY DONE** — and the shipped version is the brief's own BEAT.
**Evidence:** CI-4, shipped 2026-08-30, `feature-registry.md:99`.
`app/api/wizard-benchmark-estimate/route.ts` → `lib/plan/aerobicEstimate.ts`.
`GeneratePlanScreen.tsx:792` calls it; line 1522 renders
``Looks like a ${label} in about ${benchEstimate.formattedTime}.`` as the frame title; `benchMode`
flips to `'manual'` on "Let me adjust" or when no estimate exists.

**Ours vs theirs:**

| | Miles | Zonna |
|---|---|---|
| Source | none — always asks | HealthKit aerobic runs, HR-qualified |
| Skippable | **no** | yes, and the skip cost is stated |
| Wheel picker | yes (min + sec) | yes — `DurationPicker`, the single owner of every time entry (FORMS-PRIM-01) |
| Reassurance | "A rough guess is fine" | *"Without a benchmark we use population estimates for your fitness level. Still works — just less personal."* (line 1968) |
| Developer leak | **yes** — *"It just replaces the old hardcoded defaults until we have better data from a run"* (observed, `IMG_7176`) | none |

Their unskippable step is the worse defect: it forces a guess even when better data exists.
**No action. Nothing to take.**

---

## T-06 · Sex — `IMG_7177.PNG`

**Verdict:** GAP — tracked and deliberately parked
**Evidence:** `grep -rn -w -i "sex\|gender" types lib/plan app` → 3 hits, all prose comments in
`generationConfig.ts`. No field in `GeneratorInput`. Tracked as **`INPUT-SEX-01`**
(`backlog.md:1555`), P2, *"a QUESTION to take, not a build"*, **founder decision 2026-09-16: not
being introduced now.**
**Observed:** their framing is *"How do you identify?"* / *"For a more personalised plan."* with
Female / Male / Prefer not to say and a "Skip for now" link. The brief's LEAVE is accurate: identity
language on a physiological input, a vague benefit claim, and **no stated consequence for skipping**.

- **UX change:** One optional step. Four values per the filed shape:
  **male / female / prefer not to say / undisclosed**, where `undisclosed` is a first-class value
  the engine handles, never a null it guesses around.
- **UI / design:** `CardSelect`, existing pattern. No new component, no new token.
- **Data points:** New field on `GeneratorInput` and on `user_settings`. Migration required.
  **Special-category data under UK GDPR** — which is precisely the open question in
  `LEGAL-COUNSEL-01` (SLT 2026-09-20). It would also need to be disclosed in the privacy policy
  (`LEGAL-PRIVACY-01`) and is in scope for `ENRICH-PII-MINIMISE-01` if it ever reached a prompt.
- **Engine impact:** ⚠️ **None today, and the brief's proposed copy would therefore overclaim.**
  The brief's BEAT is *"Sex — used for heart rate and pace modelling."* `INPUT-SEX-01` records the
  opposite, from the board: *"knowing the runner is female changes no pace, zone or volume formula
  we currently hold."* Max HR is Tanaka (age only). Zones are Karvonen or %MaxHR. VDOT is Daniels,
  not sex-adjusted (`generationConfig.ts:1868` says so explicitly). **Shipping that copy would be
  hard rule 7 — claiming something the engine does not enforce.**
  The honest case for the field is (a) honesty about whose data the numerics come from, and (b) a
  precondition for RED-S / energy-availability work. Without (b) it is collected and unread, which
  is the defect `configConsumer.test.ts` exists to prevent.
- **Copy / voice:** Any copy here is **RUSS**, and must not state a use we do not have.
- **Upstream:** `LEGAL-COUNSEL-01`. Then a Coaching Board answer to *what changes*.
- **Downstream:** Every existing user has no value → `undisclosed`. **Existing plans do not
  regenerate** — live-plan policy is new plans only, and there is nothing to regenerate *for*,
  since no formula reads it.
- **Free vs Pro:** FREE. Never gate an input.
- **Backlog:** **UPDATE `INPUT-SEX-01`.** Add: the teardown independently reached the same
  conclusion on framing; the four-value shape is confirmed as right; the stated-consequence pattern
  is ours (we already do it for the benchmark skip) and is the one thing worth taking from their
  screen — they do not state one.
- **Approval:** **RUSS** — already his decision, already parked by him.
- **Priority:** **P2, unchanged.** Nothing in the teardown moves it. The blocker is legal and
  scientific, not design.

---

## T-07 · Day picker + cross-train — `IMG_7178.PNG`

**Verdict:** PARTIAL — days already beaten, cross-train entirely absent
**Evidence:** `components/shared/WeekGrid.tsx` (+ `.logic`, `.test`). Copy: *"Tap the days you
train. Tap a weekend day again to make it your long run."* `weekPlanToInputs` derives
`days_available`, `days_cannot_train`, `preferred_long_run_day` and `max_weekday_mins` from one
grid — single owner, 18 unit tests.
**Ours vs theirs — ours is materially better on days.** Theirs captures availability and a live
count ("3 days available"). Ours captures availability **plus which days are impossible** plus the
long-run day **plus a per-day time budget** (`day_budgets`, UX-WIZARD-01 Stage C), and the engine
sizes each day to its own ceiling. Observed: theirs has no time dimension at all.
**Cross-train: we have nothing.** Their toggle reveals five chips (Strength/Gym, Yoga/Mobility,
Cycling/Swimming, HIIT/CrossFit, Team Sports).

- **UX change:** A toggle on `your-week` (or a new step) revealing activity-type chips, and — the
  half the brief rightly stresses — **it must be re-editable in-app**, which today means it has
  nowhere to live (GAP-10: no modify surface exists).
- **UI / design:** `Chip` exists. Toggle pattern exists. No new component.
- **Data points:** New optional field, e.g. `cross_training?: {types: string[], days?: DayKey[]}`.
  Migration on `user_settings` if it is to be re-editable independently of the plan.
- **Engine impact:** **This is the whole point, and it is a Coaching Board question.** The brief's
  argument is strong: *cross-training days are days the runner is not recovering*, which is a direct
  input to a zone-discipline engine. Today the engine's load model sees running only. Adding
  non-run load touches the acute/chronic side of the same calculation **`R26` (background load from
  HealthKit steps)** was filed for, and `R26` carries an explicit calibration warning: *"active job
  vs recovery walks vs cross-train all look the same"*. Declared cross-training is **better data
  than step count** — the runner tells us what it was. That is a genuine argument for doing this
  before `R26`, and it is the board's call, not mine.
  What the engine does today with a cross-trainer: nothing. It cannot distinguish them.
- **Copy / voice:** Chip labels and the toggle line are new copy → **RUSS** (pattern-setting).
- **Upstream:** Coaching Board on whether declared cross-training modifies load. A modify surface
  (T-15) if it is to be re-editable, which the brief requires.
- **Downstream:** If it reaches load, it touches `validatePlan`, the reshape triggers, and
  `cohortGrid` (which does not vary it → another `GRID-COVERAGE-02` entry). If it does **not** reach
  load, it is a collected-and-unread field — the exact defect `configConsumer.test.ts` guards.
  **There is no safe "capture it now, use it later" version**: `motivation_type` is what that looks
  like three years on (GAP-02).
- **Free vs Pro:** Capture FREE. Load modelling is *accuracy*, so also FREE by the brief's own
  default rule — anything that keeps a plan accurate is free.
- **Backlog:** **UPDATE `R21`** (strength sessions — same domain, currently "flesh out stubs") and
  **cross-reference `R26`**. The supplementary-session-slots entry in *Scoped but unscheduled*
  already contains a detailed model for a second session per day, including the wizard question
  *"Do you do strength or cross-training? We'll fit it around your runs"* — **this is not new
  scope, it is already specified there.** Do not duplicate it.
- **Approval:** **RUSS** (copy) + **Coaching Board** (load).
- **Priority:** **P2.** Real, well-argued, and already partly specified. Blocked behind the board
  and behind having somewhere to edit it.

---

## T-08 · Referral code screen — `IMG_7179.PNG`

**Verdict:** PARTIAL
**Evidence:** `app/dashboard/RedeemCodeScreen.tsx` exists (GTM-CHARITY-04) and is reachable from
the wizard — `GeneratePlanScreen.tsx:1686`, rendered when `isOnboarding || !hasPaidAccess`.
`/api/charity/redeem`, `lib/charity/code.ts` owns the format.
**Ours vs theirs:** We have the screen and the redemption path. Two differences.
(a) **Position.** Theirs is the last wizard step — progress bar full, after every question, before
generation (observed, `IMG_7179`). Ours is an entry point *within* the wizard chrome rather than a
step at peak intent.
(b) **One behaviour, not two.** Ours handles charity grants only. There is no referral-code concept.

- **UX change:** Promote redemption to a final wizard step, and make one field accept two kinds of
  code: a charity grant (full access) or a referral (extended trial). Clear "I don't have a code".
- **UI / design:** `TextField` + existing screen. No new component. Their disabled-CTA-plus-text-
  link pattern is already ours.
- **Data points:** A referral-code concept does not exist — new table or a `kind` column on
  `charity_codes`, plus a trial-extension path. `resolveTier` is the **single owner** of
  `admin → subscription → grant → trial → free` and already returns `{tier, reason}`; a referral
  extension changes the **trial** arm, not a new arm. It must go through `resolveTier` or it becomes
  the fourth copy of the ladder — which `GTM-CHARITY-05` is already filed to fix for the third.
- **Engine impact:** **None.** Tier affects gating, not prescription.
- **Copy / voice:** The screen's copy is written and SLT-ruled — *"this is a gift from a charity,
  not a transaction"*, and **we never name the charity back to the runner**
  (`RedeemCodeScreen.tsx:13–15`). Any referral copy is new → **RUSS**.
- **Upstream:** `GTM-CHARITY-08` (mint and field-test the 500-code batch) carries a known ordering
  problem — **tell runners to redeem BEFORE choosing a distance**, or the first thing a comped
  marathon runner meets is a paywall. Moving redemption to the *end* of the wizard would make that
  worse, not better. **This is a direct conflict between the brief's proposal and a filed P1.**
- **Downstream:** `admin_user_tiers` (GTM-CHARITY-05), trial emails (`decideTrialEmails` takes a
  required access argument), `v_trial_conversion`.
- **Free vs Pro:** FREE — it is the door.
- **Backlog:** **UPDATE `GTM-CHARITY-08`** with the placement conflict. **NEW** for referral codes,
  which nothing covers.
- **Approval:** **RUSS** (copy).
- **Priority:** **P1 for the placement question** (October-dated, ~500 runners, and the brief's
  proposal and the filed item disagree — that needs resolving before the codes go out).
  **P3 for referral codes** — no referral programme exists to feed them.

---

## T-09 · "Building your plan" narration — `IMG_7180.PNG`

**Verdict:** PARTIAL — ours is better written, theirs is better drawn
**Evidence:** `components/GeneratingCeremony.tsx` (340 lines) + `lib/plan/ceremonyLines.ts`.
Free: 4 lines, 1,800 ms minimum. Paid: 5 lines, 3,600 ms minimum. Lines rotate every 1,800 ms.
Skeleton card shows the plan's shape; reveal draws phase-by-phase.
**Ours vs theirs:**
Ours wins on substance. `ceremonyLines.ts` builds **personalised** lines from the runner's own
answers and puts them first — *"the app proving it listened"* — with generic copy backfilling.
Theirs shows the same four steps to everyone (observed: "Marking your finish line / Planning around
your week / Setting how far and how fast / Making recovery part of the plan").
Ours is also honest about latency: the file sizes the paid enrichment window at 28–35 s, so the
3.6 s floor is nowhere near staged. For free there is no enrichment and the 1.8 s floor **is** a
deliberate hold — a decision on the record.
**Theirs wins on craft.** Observed in `IMG_7180`: a line-art illustration of five stick figures
running a rising-and-falling curve — *which is the volume curve* — with the last crossing a finish
point. Completed steps tick and fade; the active one carries a spinner. We have a skeleton, which
is functional and cold.

- **UX change:** None to the flow. An illustration replaces or sits above the skeleton.
- **UI / design:** **New asset class — a line-art illustration style, used consistently across
  transitional and empty states.** This is the substance of P-13 and it is the single biggest
  visual gap. Tokens: line weight and colour from `--moss` / `--ink-2`; no new colour.
- **Data points:** None.
- **Engine impact:** **None.** The ceremony renders while the engine runs and reads only inputs.
  ⚠️ `ceremonyLines.ts` carries a standing constraint that governs anything added here:
  *"NO LINE MAY CLAIM ANYTHING THE PLAN DOES NOT DO."*
- **Copy / voice:** The brief proposes renaming the steps after our principles (*reading your last
  12 weeks → finding your easy pace → setting the ceilings → building the weeks*). ⚠️ **"Reading
  your last 12 weeks" would be false for most runners** — we read HealthKit only on native, only if
  connected, and the wizard's aerobic estimate uses a **6-week** window (`WINDOW_WEEKS = 6`). A
  named step must be one that actually ran. → **RUSS**, and it must be checked against the code
  line by line.
- **Upstream:** An illustration style decision (P-13).
- **Downstream:** If the style is adopted it should also serve the Coach empty states, which are
  currently text-only.
- **Free vs Pro:** FREE. Everyone sees this screen.
- **Backlog:** **NEW** (illustration system). The ceremony itself is shipped
  (FIRSTRUN-MOMENTS-01c).
- **Approval:** **RUSS** — illustration style is a design-system change, and the step copy is
  pattern-setting.
- **Priority:** **P2.** It is the difference between "considered" and "waiting", on the one screen
  every runner sees at maximum attention. But it changes no behaviour.

---

## T-10 · Card-stack reveal — `IMG_7181.PNG`

**Verdict:** PARTIAL
**Evidence:** We have reveal components — `RunwayRevealCard`, `PlanScaleCard`, `FirstRunCard`,
`PlanIntroCard`, `CharityCohortCard`, all rendered in the wizard preview, plus `PlanArc`. We do
**not** have a swipeable stack, a position counter, or annotations.
**Observed, in detail:** dark-green front card with a tonal wave, "THE SHAPE" eyebrow and a
**"3 / 5"** counter, five page dots, a weekly-volume bar chart where deload weeks are desaturated
and the final week is **amber**, and **handwritten-style annotations** — *"easier on purpose"* with
a hand-drawn underline pointing at the two down weeks, *"10K week"* under W8, and a tiny
arms-raised figure at the finish. Heading: **"Russell, your plan is ready."**

- **UX change:** The reveal becomes a paced, swipeable sequence with a visible position, rather
  than a scroll of cards. The runner is walked through the shape before the detail.
- **UI / design:** New pattern: horizontally-paged card stack with depth (two cards visible
  behind), page dots, counter. **Plus a handwriting annotation layer** — a second typeface, which
  is a **typography decision and therefore gated**. Our type rule is *Inter only, weights 300–900*.
  A handwritten annotation font is an explicit exception to the one type rule the brand has.
- **Data points:** None. Everything shown is derived from the generated plan.
- **Engine impact:** **None.** ⚠️ **But every annotation is a claim.** *"easier on purpose"* over a
  down week is only true if that week is genuinely a deload — which `isDeloadWeek()` /
  `computeDeloadWeeks()` can answer authoritatively (single owner, DELOAD-OWNER-01). The brief's own
  CAUTION applies and our hard rule 7 enforces it: **each annotation must be driven by a plan field,
  never by position.**
- **Copy / voice:** The brief's suggested annotations — *this is where you'd normally blow up* /
  *nothing above easy here* / *the only hard day this week* — are good and in voice. The first is a
  prediction about the runner and needs care. → **RUSS**.
- **Upstream:** P-01 (the bar colours are semantic), and a typography exception for handwriting.
- **Downstream:** `GeneratingCeremony`'s reveal currently hands off to the preview; inserting a
  stack changes that handoff. `FIRSTRUN-MOMENTS-01a/b` deliberately placed the runway line and the
  first-run card at specific points in that sequence — **a stack would re-sequence shipped,
  SLT-approved moments.** Reconcile, do not overwrite.
- **Free vs Pro:** FREE. It is the reveal of a plan both tiers get.
- **Backlog:** **UPDATE `FIRSTRUN-MOMENTS-01`** — that item owns this moment and has four shipped
  sub-items. A new item would duplicate it.
- **Approval:** **RUSS** — typography exception, plus pattern-setting copy.
- **Priority:** **P2.** High charm, real differentiation in the one place a runner is paying full
  attention. Below the items that change what the plan *is*.

---

## T-11 · Plan preview + paywall placement — `IMG_7182.PNG`

**Verdict:** PARTIAL
**Evidence:** Our preview (`GeneratePlanScreen` `preview` step) renders `PreviewPhaseStrip`,
`PhaseSummaryCard`, `ConfidenceBadge`, `DifficultyCard`, `TeaserCard`, plus the FIRSTRUN cards.
`easyPaceAsCeiling` is **not** called here — sole call site is `DashboardClient.tsx:7881`.
**Observed:** a dark-green hero panel with a tonal wave and four metrics (Total distance ≈119 mi in
amber, Run sessions 24, Long runs 8, Quality runs 7); a **ticket-notch divider**; an adaptation
card with two scenarios, closing on *"Either way, the goal stays put."* and *"No make-up runs."*;
then Week 1 with phase name **and** rationale, and the Monday session showing **"Not faster than
13:12/mi"** as a grey subtitle; then the wall.

- **UX change:** Three things, separable:
  (a) a hero metric panel summarising the whole block;
  (b) the adaptation promise, stated before the wall;
  (c) **the ceiling as a first-class line rather than a subtitle.**
- **UI / design:** Hero panel is a new treatment — deep ink rather than green per the brief, tonal
  depth. Ticket-notch divider is a new component. Big numbers per our rule: **value first and
  large, label small underneath** — note theirs puts the label *above* on this screen (`IMG_7182`)
  and *below* on Profile (`IMG_7185`); ours is consistent and already specified.
- **Data points:** None. Totals are derived from `plan.weeks` — and must be derived, not stored, or
  they go stale (the repo's recorded stale-mid-pipeline class).
- **Engine impact:** **None for (a) and (b).** For (c), **none either** — `easyPaceAsCeiling` is a
  pure display transform over `session.pace_target`, already written and tested. Surfacing it is a
  render change. ⚠️ **INV-PLAN-007 constrains the shape:** `zone`, `hr_target` and `pace_target` are
  always **strings** (`lib/plan/schema.ts:38–41`), and `PlanSchema` now runs on the save path
  (SAVE-VALIDATE-01). A ceiling stored as a number would be caught at save. Keep it a string, or
  keep it derived at display — the latter is what we already do and is cheaper.
- **Copy / voice:** *"No make-up runs."* is excellent and is a **coaching claim** — we would have to
  check it is true of our reshaper before saying it. ADR-012 governs reshape; §67 and the missed-
  session prompt govern what happens after a miss. **Do not adopt the sentence without verifying it
  against `lib/plan/effectiveSessions.ts` and the missed-session path.** → **RUSS** + verification.
- **Upstream:** Nothing for (c). (a) and (b) need the hero-panel treatment (P-13).
- **Downstream:** The preview is also the first-plan reveal, so it interacts with T-10 and the
  FIRSTRUN moments. Adding a hero panel above them re-sequences a shipped, approved order.
- **Free vs Pro:** FREE. The preview is pre-conversion by definition.
- **Backlog:** **NEW** for the hero panel. **The ceiling half belongs with T-14 as one item** — the
  same one-line change surfaces it in both places, and splitting it would create two items for one
  `easyPaceAsCeiling` call.
- **Approval:** **RUSS** for the hero treatment and the adaptation copy.
- **Priority:** **P1 for the ceiling. P3 for the hero panel.** The ceiling is our thesis made
  visible and costs almost nothing; the panel is polish.

---

## T-12 · Paywall — `IMG_7183.PNG`

**Verdict:** PARTIAL
**Evidence:** `app/dashboard/UpgradeScreen.tsx` renders `PRICING.monthly.display`,
`PRICING.annual.display`, `PRICING.annual.savingLabel` ("Save 37% / year"),
`PRICING.annual.perMonthDisplay` ("£5 / month"). **No per-week figure. No trial timeline.**
`grep -n "per week\|/wk\|Day 1\|Day 14\|timeline"` → 0 hits.
**Observed on theirs:** "4.9 ★ avg rating" in laurels, "Join 1,000+ runners", a three-card review
carousel, yearly £79.99 with **"£1.54 per week"** and a "SAVE 49%" badge, monthly £12.99 with
"£3.25 per week", and a two-row timeline: *Today — Full access to every Miles feature* /
*Day 5 — Reminder that your trial ends soon*.

- **UX change:** Add a per-week line under each price. Add a three-row trial timeline. Nothing
  moves.
- **UI / design:** No new components. Tokens: `--mute` for the per-week line, `--moss` for the
  timeline markers.
- **Data points:** **A derived display value, and it must live in `lib/brand.ts`.** `PRICING`
  already holds `perMonthEquiv` / `perMonthDisplay`; a per-week pair belongs beside them, never
  computed in the component (ADR-015 / INV-CFG-001). **Our real numbers:** annual £59.99 → **£1.15
  / week**; monthly £7.99 → **£1.84 / week**. ⚠️ **The brief's "~80p per week" is wrong** — that
  would imply £41.60/year. Our annual is already cheaper per week than theirs (£1.15 vs £1.54),
  which is a fact worth using and does not require a price change.
- **Engine impact:** **None.**
- **Copy / voice:** Timeline rows are pattern-setting → **RUSS**. Our trial is **14 days**
  (`PRICING.trialDays`), so the rows are Day 1 / Day 11 / Day 14, not their Day 5.
- **Upstream:** ⚠️ **`TIER-TRIAL-CONFIDENCE-01` (filed, P2) says the 14-day reverse trial is *not
  literally full access*.** Writing "Today — full access to everything" would therefore be an
  overclaim on our side, exactly as their "4.9 rating" is on theirs. **That item must be resolved
  before this copy is written**, or we ship the defect we are criticising.
- **Downstream:** `/pricing` on the marketing site must match, and it is covered by
  `lib/marketing/pricing.test.ts` — **a paid feature with no pricing-page row fails the build.**
  Any new marketing surface must also be added to `noEmDash.test.ts`'s `SURFACES` list.
- **Free vs Pro:** The paywall itself.
- **Backlog:** **NEW** for per-week + timeline. **UPDATE `TIER-TRIAL-CONFIDENCE-01`** as the
  blocking prerequisite. Cross-reference `GTM-11` (pricing review — our 37% annual discount vs the
  category's 44–49%, which their 49% confirms).
- **Approval:** **RUSS** — paywall copy is pattern-setting, and pricing display is brand.
- **Priority:** **P2.** Cheap and likely conversion-positive. Held behind one honesty item.

**DO NOT TAKE, and this is a hard rule, not a preference:** "4.9 avg rating" and "Join 1,000+
runners". The brief records that their App Store listing states it has not received enough ratings
to display an overview. **Hard rule 1.** A real review count or nothing.

---

## T-13 · Exit offer — `IMG_7184.PNG`

**Verdict:** GAP — we have nothing in this slot
**Evidence:** `UpgradeScreen.tsx` — the back/close handlers at lines 180, 222, 424 all call
`onBack` directly. No interception, no alternative offer.
**Observed, and it is worse than the brief describes:** display **serif** type ("SAVE 64%",
"Before you go, Russell.") on an otherwise all-sans product; amber/tan palette entirely outside
their green system; struck-through **£155.88/year** (a monthly-equivalent nobody would pay as an
annual); "£99 YOU SAVE"; a red-dot clock and **"It expires when you leave this screen."**; a
"Claim 64% off" CTA. And the price is **£55.99 — £24 less than the £79.99 the previous screen
called a 49% saving.**

- **UX change:** Intercept the dismiss on the Upgrade screen once, and offer **the free tier**
  rather than a discount: *the free plan is a real plan; keep it as long as you want.* Converts an
  abandoned paywall into an activated user.
- **UI / design:** Full screen, not a modal — **our UI principle is "no popups; all interactions
  navigate to full screens."** A modal here would breach it. Two actions of equal weight; no
  countdown, no strike-through, no second typeface.
- **Data points:** One flag so it fires once per user, not every dismiss. `user_settings` column,
  migration, and **the migration must be appended to `.claude/state/applied-migrations.txt`** or
  every session warns.
- **Engine impact:** **None.**
- **Copy / voice:** *"Not ready to pay? The free plan is a real plan. Full weeks, ceilings on every
  easy run. Keep it as long as you want."* ⚠️ Two checks before that ships: **"full weeks"** — a
  free user's plan *is* full (free = rule-engine plan, gating is on richness not access), so this is
  true; **"ceilings on every easy run"** — `pace_target` comes from VDOT, and `vdot_pace_zones` is
  *granted at trial and retained*, so a never-trialled free user may have population-estimate paces.
  **Verify before asserting.** → **RUSS**.
- **Upstream:** `GTM-FREE-HOOK-01` (P2, filed) asks the adjacent question — the free tier's only AI
  touchpoint is unreachable by the users meant to convert. Same subject: what the free tier is
  actually worth. Answer that first or the offer is hollow.
- **Downstream:** Trial-email logic (`decideTrialEmails` takes a required access argument) and the
  day-15 downgrade UI both describe the free tier. They must say the same thing.
- **Free vs Pro:** It *is* the free tier.
- **Backlog:** **NEW.** Cross-reference `GTM-FREE-HOOK-01`.
- **Approval:** **RUSS** — pattern-setting copy and a monetisation surface.
- **Priority:** **P2.** Genuinely on-brand — it is the one place where doing the honest thing is
  also the commercially better thing, because a discount cannot be retracted and an activated free
  user can still convert later.

**DO NOT TAKE:** every mechanic on that screen. Hard rules 1 and 2. And note for the record that
the discount **undercuts their own headline price by £24**, which teaches the user the first two
prices were theatre — a lesson they cannot unlearn.

---

# IN-APP

## T-14 · Plan screen hierarchy — `IMG_7187.PNG`

**Verdict:** PARTIAL
**Evidence:** `PlanScreen`, `DashboardClient.tsx:8191`. Seven blocks: header → race name → Plan arc
→ plan intro (AI) → why this plan (rule engine) → plan voice (AI) → plan calendar. **No projected
finish. No completion or compliance metric. No modify entry. No ceiling.**
**Observed on theirs:** four blocks in descending time horizon — This week (0 / 22.4 km, 0 km,
**0%**) → Pace progression (current 11:45/mi → race day 10:49/mi, **projected finish 1:04:37 –
1:10:01**, "Projected from your logged runs") → **Modify plan** card with a consequence subtitle →
Weekly view with per-week counters (0/3, 0 / 22.4km) and left-accent session rows.

**Ours vs theirs on structure:** theirs answers *"am I on track"* before *"what's on Thursday"*.
Ours answers *"why is this plan like this"* first — which is a defensible different choice, and
`PLAN-NOTE-PLACEMENT-01` (P2, filed by the SLT 2026-09-17) is **already asking exactly this
question**: does the rationale belong at the top of the Plan screen at all? The teardown
independently arrives at the same doubt.

- **UX change:** Up to four separable additions. In priority order:
  (a) **the zone-compliance block** — *"This week: 3 of 4 runs held the zone. One drifted."*;
  (b) **the ceiling on the week card**;
  (c) a projected finish **as a range, with its real source**;
  (d) a modify entry point (T-15).
- **UI / design:** (a) needs no new component — `ZoneBar` and `ZoneRings` exist, and moss/amber
  already carry this meaning on the Coach screen. (c) needs a two-value row. Left-accent session
  rows we already have.
- **Data points:** (a) reads `run_analysis.hr_in_zone_pct` / `hr_above_ceiling_pct`, which exist and
  are already fetched into `runAnalysisMap` on this client. **No new data.** (c) reads VDOT +
  aerobic pace, both existing.
- **Engine impact:** **None for (a) and (b)** — both read fields the engine already emits.
  **(c) is different.** A projected finish is `race_time_estimates`, which is **PAID**. And
  `TT-PRICING-CLAIM-01` (filed) records that `/pricing` already sells this projection as coming
  from "your real running" when **on 58% of plans there is none**. Putting a projection on the Plan
  screen would widen that exposure.
- **Copy / voice:** *"3 of 4 runs held the zone. One drifted."* is in voice and is the product
  thesis in one line. The limiter sentence the brief proposes — *"the limiter is your easy runs
  averaging Zone 3, so aerobic base isn't building"* — is a diagnosis; we have `disciplineLedger`
  and the limiter concept on Coach already. → **RUSS** for the Plan-screen wording.
- **Upstream:** (a) requires `activity_intelligence` data, which is **PAID**, so the free tier sees
  an empty state — the design must answer what a free user sees here. (c) requires
  `TT-PRICING-CLAIM-01` resolved.
- **Downstream:** Adding blocks to Plan re-opens `PLAN-NOTE-PLACEMENT-01`. Adding a fourth
  AI-adjacent block risks the Coach/Plan overlap the CO-ONE work deliberately collapsed.
- **Free vs Pro:** (b) ceiling **FREE** — it is on the plan the free user already has.
  (a) compliance **PAID** — it needs run analysis. (c) projection **PAID** — already gated.
  ⚠️ **This is uncomfortable and should be said plainly: the compliance metric is the brand thesis,
  and it is paid.** A free runner sees the ceiling but never learns whether they held it. That is
  defensible under "gate richness, never access" — but it is worth the SLT looking at, because it
  means the free tier can state the rule and never score it.
- **Backlog:** **(b) is one item with T-11** — one `easyPaceAsCeiling` call, two surfaces.
  **(a) is NEW.** **(c) UPDATE `TT-PRICING-CLAIM-01`.**
  **UPDATE `PLAN-NOTE-PLACEMENT-01`** with the teardown's independent agreement.
- **Approval:** **RUSS** for copy.
- **Priority:** **(b) P1** — trivial, and it is the thesis. **(a) P1** — highest differentiation in
  the document; no competitor can ship "you went too hard" as a beginner app. **(c) P3** —
  blocked and already over-claimed elsewhere. **(d) see T-15.**

**On their "every metric is volume" weakness:** confirmed, and it is the single clearest opening
in the whole teardown. Their Plan screen shows distance, distance, pace, distance. An app whose
marketing argues runners go too fast has no intensity metric anywhere in its main view.

---

## T-15 · Modify plan sheet — `IMG_7188.PNG` — **highest-leverage item**

**Verdict:** GAP — nothing of this exists
**Evidence:** Phase 0 Q13. `ReshapeScreen` (`DashboardClient.tsx:6397`) is not an editor — it calls
`/api/adjust-plan` and renders whatever the engine proposes. `MeScreen → "Your training"`
(line 11829) is four rows: Race benchmark, Plan history, Distance units, Session display. The last
two are display preferences (ADR-015). **The only way to change a training parameter is to re-run
the wizard, which archives the old plan.**
**Observed on theirs:** a sheet titled *"What do you want to change?"* with
*"Edit settings, then apply them together."*; group **TRAINING LOAD** → Intensity [🔒 Pro],
"Balance of easy vs hard sessions", **Balanced** ›; group **GOAL & SCHEDULE** → Race date ("Shift
the whole plan forward or back") 16 Nov ›, Runs per week [🔒 Pro] 3× / week ›, Running days
("Which days of the week you run") Mon · Thu · Sun ›, Long run day ("Anchor your weekly endurance
run") Sun ›; and a separate amber-tinted card, **Start a new plan** ("Different goal, distance, or
race"). Current value on the right of every row; a consequence subtitle on every row.

- **UX change:** The largest in this document. A runner whose life changes can keep their plan
  accurate instead of starting over. Today: wizard, 14 screens, plan archived. After: sheet, two
  taps, diff, accept.
- **UI / design:** `Sheet` exists. Row pattern exists. ⚠️ **Two of our own rules bite.**
  (1) Their sheet puts *Cancel* top-right; our principle is **"slide-up sheets: mirrored nav bar at
  bottom, not top."** Ours must differ.
  (2) *"Start a new plan"* quarantined in amber is the pattern we already call **"Careful Now"** on
  MeScreen — reuse it, do not invent a second treatment.
  Per-row Pro locks are a new small component (padlock + "Pro" pill).
- **Data points:** No new *plan* fields — every parameter already exists on `GeneratorInput`. What
  is new is **a persisted edit set**: the batched, not-yet-applied changes. That is a new table or a
  JSON column, plus a migration. It must not become a second copy of `GeneratorInput`
  (D-16); the natural shape is a sparse overlay applied to the stored `meta.generator_input`, which
  already exists for byte-exact replay (PV2-A).
- **Engine impact:** **Yes, and this is the item's real cost.** Re-running generation from edited
  inputs is not new — that is `generateRulePlan`. What is new:
  - **`plan_archive` and ADR-013.** Today "change something" means archive-and-overwrite. A
    parameter edit that preserves completions is a different operation, and
    **`PLAN-WEEK-COLLISION-01` is exactly the failure this class produces** — a new plan arrived
    94% pre-completed because `week_n` is a within-plan coordinate that seven tables used as a
    cross-plan key. **Any modify-and-regenerate path walks straight into that.** Read that item
    first.
  - **ADR-012 magnitude-calibrated confirmation** already defines which changes need a tile:
    day-of-week moves, session-type swaps, >15% trims, >15% week-volume changes. A modify sheet is
    the *user-initiated* twin of that, and should reuse the thresholds rather than invent new ones.
  - **`sessionKmSelfPaced` / `reshapeMagnitude`.** SESSION-KM-01/02 records that ADR-012's >15%
    threshold was **unreachable for beginners** because their sessions are duration-anchored. Fixed
    — but it means the magnitude path must be exercised for duration-anchored plans here too.
  - **Intensity as a free primary control** (the brief's BEAT) is a **Coaching Board question**.
    Expressing it as 80/20 → 90/10 with a stated consequence touches §1 (`INTENSITY_DISTRIBUTION`,
    measured in **sessions**, plan-wide — CD-19) and §110 (the quality ceiling, where
    `hard_session_relationship: 'avoid'` is a floor, not an off switch, after the §110 fix). Letting
    a runner set the ratio directly is a new authority over a constitutional numeric. **Do not scope
    it without the board.**
- **Copy / voice:** Every row needs a consequence subtitle — that is the pattern worth taking, and
  it is a lot of new copy → **RUSS** (pattern-setting).
- **Upstream:** `PLAN-WEEK-COLLISION-01` understood. ADR-012 thresholds reused. Coaching Board on
  intensity. **`AdjustmentDiff` already exists** and already does diff-before-apply — the brief's
  "always show the diff" is **half-built**, and its two call sites prove the pattern.
- **Downstream:** `session_completions`, `session_overrides`, `run_analysis` all key on
  `{week_n, session_day}`. `plan_archive`. The reshape triggers. Notifications that reference
  sessions. This is the widest blast radius of any item here.
- **Free vs Pro:** **Sharper than the brief's framing.** Their split (intensity Pro, runs-per-week
  Pro) is wrong for us and the brief says so. Applying our default — *accuracy free, intelligence
  paid* — gives:
  **FREE:** race date, running days, long-run day, runs per week, blockout days, weekday caps.
  All of these keep a plan **accurate**; a free user whose life changes and cannot say so gets a
  wrong plan and churns.
  **PAID:** nothing obvious, honestly. Regeneration is `rule_engine_regeneration`, which is
  FREE_ALWAYS by the R23-D6 lenient reading. **The AI re-enrichment** of the changed weeks is
  `ai_coach_notes_new` — already PAID. That is the natural line: everyone can change the plan,
  only paid users get the new coaching voice on it.
  **Intensity is the open question** and belongs to the board before the tier.
- **Backlog:** **SUPERSEDES the standalone framing of `R22`** (blockout days becomes a row here).
  **ABSORBS part of `R21`** (strength sessions as a row) and **part of `R20`**'s user-initiated
  reshape. **UPDATE all three rather than filing a fourth.** Phase 2's P-02 must reconcile them
  explicitly.
- **Approval:** **RUSS** for copy; **Coaching Board** for intensity-as-a-control.
- **Priority:** **P1, and the sequencing matters more than the rank.** It is the biggest build in
  the set and it absorbs three backlog items. It should not start until
  `PLAN-WEEK-COLLISION-01`'s lesson is written into its design, because that defect is precisely
  what this feature does for a living.

---

## T-16 · Profile — `IMG_7185.PNG`

**Verdict:** PARTIAL — the LEAVE is already satisfied, the TAKE is not
**Evidence:** `grep -rn -i "streak" app components lib` → marketing copy asserting the absence
(`app/page.tsx:449,543`), one comment *"Counter, not a streak"* (`DashboardClient.tsx:9058`), and
internal `streakDist`/`streakCount` locals in `ruleEngine.ts:5572–5592` for §45 long-run repeats.
**No user-facing streak exists.** MeScreen's top card is *"What Kit knows about you"* — a read-only
input synthesis with moss/warn/mute state dots.
**Observed on theirs:** headline row **"0 WEEK STREAK · 0.0 mi TOTAL DISTANCE · 0 RUNS"**, then a
plan card: *Free Plan / Basic access* → what's included → *MILES PRO ADDS* (three items with
icons) → *Upgrade to Miles Pro* → *"From £1.54/wk, billed yearly. Cancel anytime."* → Restore
Purchase.

**Ours vs theirs:** we are right where it counts (no streak — hard rule 4; no zeroed vanity row).
They are better on the **plan card**: stating what you already have before listing what you don't is
a genuinely good, non-manipulative upsell, and we have no equivalent — our Subscription section is
a row, not a value statement.

- **UX change:** (a) a plan card on Me in their structure; (b) discipline-shaped headline numbers —
  *weeks on plan*, *easy runs held*, *longest zone-clean streak*.
- **UI / design:** Card + section pattern exists. Big numbers per our rule (value large first,
  label small underneath — which theirs does correctly on this screen).
- **Data points:** (b) is derived: `weeks on plan` from plan start; `easy runs held` from
  `run_analysis.hr_above_ceiling_pct`; `longest zone-clean streak` is new derivation over the same
  rows. **No new storage.**
- **Engine impact:** **None.** All read-side.
- **Copy / voice:** ⚠️ **"Longest zone-clean streak" is a streak.** The brief calls it *"a streak
  worth chasing"*, and I think that is right in substance — it rewards restraint, which is the
  opposite behaviour from a run-every-day streak. But **hard rule 4** says *no streak mechanic that
  rewards running on a day the plan says rest*, and this one does not. It is compatible with the
  letter of the rule. It is in tension with the marketing page that says flatly **"No streaks."**
  **That is a brand call, not mine** → **RUSS**, and it is worth flagging to the SLT precisely
  because Wood's kill mandate exists for features that feel like progress.
- **Upstream:** (b) needs `activity_intelligence` (PAID) for two of the three numbers. *Weeks on
  plan* is free.
- **Downstream:** The plan card duplicates information in the Subscription section — one must go,
  or they will drift.
- **Free vs Pro:** Card FREE (it *is* the upsell). Metrics: *weeks on plan* FREE; the two
  zone-derived ones PAID by data dependency.
- **Backlog:** **NEW** for the plan card. **Fold the metrics into T-14 (a)** — same data, same
  derivation; two items would mean two owners for one calculation.
- **Approval:** **RUSS** — the streak question is brand.
- **Priority:** **P2** for the plan card. **P3** for the metrics, behind T-14(a) which creates them.

---

## T-17 · Settings — Coach Personality — `IMG_7186.PNG`

**Verdict:** GAP
**Evidence:** `grep -rn -i "coach_personality\|tone.*setting\|blunt"` across `lib` and `app` →
nothing. No register dimension anywhere. Voice is fixed and lives in
`lib/coaching/prompts/*` + `voiceRules.ts` + `docs/canonical/brand.md`.
**Observed:** *"Coach Personality — How Miles talks about your training — Supportive"* as a chevron
row, alongside Voice Coaching and Haptic Cues toggles (we have neither of those either).

- **UX change:** A setting that changes the register of coaching output. Straight (default) /
  Blunt, with the DHTB register as a later paid option.
- **UI / design:** One row in MeScreen → "Your training", one picker screen. Existing patterns.
- **Data points:** `user_settings.coach_register`, migration, default `'straight'`.
- **Engine impact:** **None on prescription — and that separation must be enforced, not assumed.**
  The register changes voice only. ⚠️ The real risk is the one ADR-006 and `ENRICH-ATTRIB-01`
  already name: **the enricher cannot touch any numeric.** A "Blunt" register that rewrites a
  session label is fine; one that changes a pace is a defect. `EnrichedWeekSchema` already exposes
  only `label` and `coach_notes`, which is the structural guarantee — the register rides on top of
  it and inherits the protection. That is the argument for doing it *this* way rather than by
  swapping prompts wholesale.
- **Copy / voice:** **This is the most brand-loaded item in the document.** It borrows DHTB's
  personality as an opt-in tone without putting the founder in the product — which is exactly the
  line `brand.md` and the launch-scope note draw ("Zonna is the product, DHTB is the person; the app
  must outlive the personal brand"). Two registers means **every** coaching string needs two
  versions, and the golden-case suite (`docs/canonical/reframe-golden-cases.md`, cases A–D) would
  need a register axis. → **RUSS**, and this is the clearest "propose and stop" in the set.
- **Upstream:** **`R19`** — coaching tips in Supabase. Its filed scope says *"don't pick up without
  a product trigger"* because migrating copy to a table unlocks nothing while there is no
  segmentation. **A register IS that trigger** — it is the first real second axis on coaching copy.
  The teardown has supplied the product trigger `R19` has been waiting for. That is the most useful
  single sentence in this analysis for backlog purposes.
- **Downstream:** Every AI surface: daily coach note, post-run reframe (voice locked in
  `brand.md` § Reframe Voice, regression suite in `reframe-golden-cases.md`), weekly report, phase
  summary, plan intro, maintenance debrief. **Twelve AI routes.** Doubling the register doubles the
  voice-review surface and the golden-case matrix.
- **Free vs Pro:** Straight/Blunt **FREE** — it is tone, not intelligence, and gating tone reads
  as mean. DHTB register **PAID**, later, if ever.
- **Backlog:** **UPDATE `R19`** — add the register dimension and record that the product trigger
  has arrived. Do not file a new item; `R19` is the item.
- **Approval:** **RUSS** — voice decision *and* it touches the Zonna/DHTB relationship. Section 4A
  names this explicitly.
- **Priority:** **P2 as a concept, P3 as a build.** Cheap to add as a setting, expensive to honour
  across twelve surfaces and a golden-case suite. The value is real but it is a long tail of copy
  work, and the founder is the only possible author of the Blunt register.

---

## T-18 · Settings — zones are buried

**Verdict:** **ALREADY DONE** — this is an observation about them, and we are the contrast
**Evidence:** zones surface in at least seven places in our app:
`ZoneBar` on session cards (`DashboardClient.tsx:4569`, `7962`), `ZoneInfoSheet` (`5228`, `11166`),
`ZoneRings` on Coach (`9833`, `9850`), the zone promotion on MeScreen (HOLD-THE-ZONE-01), and the
post-plan zone intro. `BRAND.voiceAnchor` is *"Hold the zone."*
**Observed on theirs:** *Training Zones — "Heart rate & pace zones"* sits between **Language** and
**Push Notifications**, with a red heart-rate icon that is the only red on the screen and outside
their own palette.

**No action, and no backlog item.** The brief's own framing is right: this is positioning contrast
for comparison-page copy. Note it is usable — `GTM-SEO-COMPARE-01` is a weekly founder-written drip
and this is a concrete, screenshot-backed observation for one of pages 2–8. **It is founder-written
by standing decision; I should not draft it.**

---

## T-19 · Review prompt placement

**Verdict:** GAP — we have neither half
**Evidence:** `grep -rn -i "leave a review\|requestReview\|SKStoreReview"` across `app`,
`components`, `lib`, `ios/App` → **0 hits.** No passive row, no StoreKit prompt, no plugin.
**Observed:** a passive list row in SUPPORT — *"Enjoying Miles? Leave a review"* with a star icon.
The brief notes their App Store shows no ratings overview, so a passive prompt alone clearly
underperforms.

- **UX change:** (a) a passive row in MeScreen → Support, beside the existing Help / Contact rows;
  (b) a native `SKStoreReviewController` prompt triggered after a genuine win.
- **UI / design:** (a) is an existing row pattern, zero new UI. (b) is an OS-owned sheet — **and
  note that our "no popups" principle does not apply**, because it is Apple's, not ours.
- **Data points:** (b) needs a flag so it fires once. Apple already rate-limits to three per year;
  our own trigger state still needs storing.
- **Engine impact:** **None.**
- **Copy / voice:** (a) one row label. Low-stakes, but still a new string.
- **Upstream:** (b) needs a Capacitor plugin for `SKStoreReviewController` — **a new native
  dependency**, which means `npm run sync:ios`, `scripts/local-ios-plugins.mjs` if it is a local
  bridge, and the `verify:ios-plugins` gate. Not free.
  (b) also needs **a defined win**. The brief proposes *"first week where every easy run held the
  zone"* — which is perfect for the brand and **requires `activity_intelligence` (PAID)**. So the
  ideal trigger only ever fires for paid users. A free-tier trigger would have to be something
  weaker: first completed week, or first plan generated.
- **Downstream:** Nothing.
- **Free vs Pro:** Both free. Asking for a review is not a feature.
- **Backlog:** **NEW.** Nothing covers it.
- **Approval:** **NONE** for (a) — one row, existing pattern, no new claim. **RUSS** only if the
  row's copy gets any brand framing.
- **Priority:** **(a) P2 — it is a one-line row and we have literally nothing.** (b) **P3** — a
  native dependency and a trigger that is paid-only in its best form.
  ⚠️ Worth stating plainly: we are pre-ratings. A passive row shipped now costs nothing and starts
  accumulating. Their example shows it is *insufficient*, not that it is *worthless*.

---

## T-20 · Cold start / empty states

**Verdict:** PARTIAL — much better than theirs, with three specific holes
**Evidence:** Phase 0 Q17. No-plan **routes into the wizard** (`DashboardClient.tsx:931`) rather
than rendering a zeroed dashboard; nav is hidden during onboarding. Coach has a deliberate
four-branch state machine (`9572`) naming the one blocking action. `PreRunBandCard` renders
**nothing** rather than an empty shell. Session-detail pace shows `'—'` to reserve the slot.
**Observed on theirs:** three zeroed screens — `IMG_7185` "0 WEEK STREAK / 0.0 mi / 0 RUNS";
`IMG_7187` "0 / 22.4 km", "0 km", "0%" and an empty bar; `IMG_7182` the preview.

**Ours vs theirs:** we are substantially ahead. The no-plan case — their worst — does not exist for
us by construction.

**The three holes:**

1. **`PlanProgressBar` renders `"0 of N sessions complete · 0%"`** with an empty bar, guarding
   `totalSessions === 0` but not `doneSessions === 0` — **but it is dead code**
   (`grep -rn "<PlanProgressBar"` → 0 hits). `RestraintCard` is likewise never rendered. So this is
   **dead code to delete, not a live defect to fix.** Stated this way deliberately: the opposite
   reading would put a non-existent bug into Phase 2.
2. **Web users see no connect prompt, ever** (GAP-04). On web, `CONNECT-FIRST` returns early
   off-native and the post-plan CONNECT-01 path is also native-gated. A web runner has no route to
   connect a source and no screen says so.
3. **Day-one Today/Plan has not been observed.** I read the JSX; I did not run it. Whether our week
   counters render a bare zero on day one is **not established** — the audit says so and this
   inherits that limit.

- **UX change:** Delete dead components. Give web users a source prompt or an honest line saying
  iOS is required for it.
- **UI / design:** No new patterns.
- **Data points:** None.
- **Engine impact:** **None.**
- **Copy / voice:** One line for the web case → **RUSS** if it makes a platform claim.
- **Upstream:** None.
- **Downstream:** Deleting `RestraintCard` removes a Phase-2-era component named in
  `docs/alignment/` — check before deleting, or a doc goes stale.
- **Free vs Pro:** FREE.
- **Backlog:** **NEW**, small: dead-code removal + the web connect gap (GAP-04, GAP-12).
- **Approval:** **NONE** for deletion. **RUSS** for the web line.
- **Priority:** **P3.** Real but small, and we are already the better product here.

---

## Backlog reconciliation summary

**No duplicates created.** Every item below is the existing one unless marked NEW.

| Teardown | Action | Existing item |
|---|---|---|
| T-04 | **UPDATE** | `S111-SUBFLOOR-VOLUME-01` + `MARATHON-VOLUME-GATE-01` |
| T-06 | **UPDATE** | `INPUT-SEX-01` |
| T-07 | **UPDATE** | `R21` + supplementary-slots entry; cross-ref `R26` |
| T-08 | **UPDATE** + NEW | `GTM-CHARITY-08` (placement conflict); referral codes NEW |
| T-10 | **UPDATE** | `FIRSTRUN-MOMENTS-01` |
| T-11(c)/T-14(b) | **NEW, one item** | ceiling surfacing — one `easyPaceAsCeiling` call, two screens |
| T-12 | NEW + **UPDATE** | `TIER-TRIAL-CONFIDENCE-01` blocks it; cross-ref `GTM-11` |
| T-14(a) | **NEW** | zone-compliance block; T-16 metrics fold into it |
| T-14(c) | **UPDATE** | `TT-PRICING-CLAIM-01` |
| T-14 structure | **UPDATE** | `PLAN-NOTE-PLACEMENT-01` |
| T-15 | **SUPERSEDES / ABSORBS** | `R22` (blockout days), part of `R21`, part of `R20` |
| T-17 | **UPDATE** | `R19` — **the product trigger it has been waiting for has arrived** |
| T-13, T-19, T-01, T-02, T-03, T-16 card, T-20 | **NEW** | nothing covers these |

**Not proposed:** T-05 and T-18 need nothing.

---

## Priority roll-up

| P | Items | Why |
|---|---|---|
| **P0** | T-04 (as `S111-SUBFLOOR-VOLUME-01` / `MARATHON-VOLUME-GATE-01`) | October, ~500 charity runners, many below our volume floor. The brief independently rediscovered our own P0. |
| **P1** | T-11(c)+T-14(b) ceiling · T-14(a) compliance · T-15 modify · T-08 placement | The thesis made visible, and the biggest build. |
| **P2** | T-03 · T-07 · T-09 · T-10 · T-12 · T-13 · T-16 card · T-17 · T-19(a) | Real value, no blocker of consequence. |
| **P3** | T-01 · T-02 · T-06 · T-14(c) · T-16 metrics · T-19(b) · T-20 | Small, blocked, or already better than theirs. |

**Where I deviated from the brief's sequencing** (§5 is: P-01 → P-03/P-04 → P-02 → P-05/P-06 →
rest):

- **T-04 jumps to P0.** The brief treats it as an onboarding-polish item. In our codebase it is
  the run-walk on-ramp question, which is an open P0 with ~500 runners attached.
- **T-08 splits.** Placement is P1 and October-dated; referral codes are P3 with no programme
  behind them.
- **T-01 (P-11) drops to P3**, below where §5 implies. It is gated on asset licensing and changes
  nothing for a runner already inside.

---

## What this analysis does not prove

- **No code was run.** Every verdict is a static read plus the screenshots. Nothing was exercised
  on a device or in a browser, so "renders X" means "the JSX says X".
- **Priorities are my reasoning, not a board's.** You chose sequence B — SLT after Phase 1 — so no
  seat has seen any of this. Wood, Traynor and Sutherland would all plausibly move T-13, T-15 and
  T-17.
- **Three items need a Coaching Board ruling before they can be scoped**, not just approved:
  T-04 (run-walk on-ramp), T-07 (cross-training as load), T-15 (intensity as a user control).
  **I have not run that board.**
- **Effort is not estimated.** The brief's impact block does not ask for it, and I have not
  guessed. T-15's blast radius is described, not sized.
- **Two engine claims I did not measure.** That the ceiling change is display-only (read from
  `easyPaceCeiling.ts`, not proven by running it on a plan corpus), and that the compliance block
  needs no new data (read from the `runAnalysisMap` select list, not proven by rendering it).
- **I did not verify "No make-up runs."** applies to our reshaper. It is flagged in T-11 as
  requiring verification before the sentence is used.
