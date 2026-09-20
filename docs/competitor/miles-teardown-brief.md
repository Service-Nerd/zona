# Miles teardown → Zonna backlog brief

**For:** Claude Code, Zonna repo
**Date:** 20 September 2026
**Competitor:** Miles: AI Running Coach (Appmetric Software Private Limited, v1.0.18)
**Screenshots:** `/docs/competitor/miles/` — referenced by filename throughout

### Screenshot index

| File | Screen | Item |
|---|---|---|
| `IMG_7172.PNG` | Launch / sign-in | T-01 |
| `IMG_7173.PNG` | Name capture | T-02 |
| `IMG_7174.PNG` | Goal selection | T-03 |
| `IMG_7175.PNG` | Ability tiers | T-04 |
| `IMG_7176.PNG` | 5K benchmark | T-05 |
| `IMG_7177.PNG` | Sex / identity | T-06 |
| `IMG_7178.PNG` | Run days + cross-train | T-07 |
| `IMG_7179.PNG` | Referral code | T-08 |
| `IMG_7180.PNG` | "Building your plan" | T-09 |
| `IMG_7181.PNG` | Card-stack reveal | T-10 |
| `IMG_7182.PNG` | Plan preview + wall | T-11, T-20 |
| `IMG_7183.PNG` | Paywall | T-12 |
| `IMG_7184.PNG` | Exit offer | T-13 |
| `IMG_7185.PNG` | Profile | T-16, T-20 |
| `IMG_7186.PNG` | Settings | T-17, T-18, T-19 |
| `IMG_7187.PNG` | Plan screen | T-14, T-20 |
| `IMG_7188.PNG` | Modify plan sheet | T-15 |

Filenames are camera-roll originals and are not in flow order. Use this table, not the numbering.

---

## 0. What this document is

These are **screenshots of a competitor's shipped app** — Miles, a rival AI running coach.
They are not Zonna, not a design spec, and not something we are copying wholesale.

Section 3 is **our assessment**, recorded during a walkthrough by the product owner. Each item
carries three judgements, all of them opinions rather than facts:

- **TAKE** — what we think they do well and want to adopt the principle of
- **LEAVE** — what we think they do badly, either because we already beat it or because we can
- **BEAT** — what we think the Zonna version should be

Treat TAKE / LEAVE / BEAT as proposals to be tested against the actual codebase, not as
requirements. If the audit shows our existing implementation is already better, say so and say
why — that is a valid and useful outcome.

**Nothing here is a decision.** Every recommendation goes through impact analysis (Section 3A)
and approval (Section 4A) before it becomes work.

## 0.1 How to use this document

Work in three phases, in order. Do not skip Phase 0.

- **Phase 0 — Discovery.** Audit what Zonna already does. No code changes.
- **Phase 1 — Assessment.** Reconcile this teardown against the audit. Produce a gap list.
- **Phase 2 — Proposals.** Write backlog items against existing release conventions.

Nothing in Phase 2 gets built until the proposals are reviewed.

**The project context docs in this repo are known to be stale** — the design system section
was two generations out of date as of September 2026. Trust the code and Section 1 below
over any prose doc you find.

---

## 1. Brand guardrails — non-negotiable

Every proposal must conform. Palette regression is the single biggest source of wasted
development time on this project. All values resolve from CSS custom properties in
`globals.css`. Nothing hardcoded in components, ever.

### Type — Inter only, weights 300–900

| Role | Size | Weight | Notes |
|---|---|---|---|
| Hero / cover headline | 56px equiv | 800 | letter-spacing −0.02em |
| Screen title | 26px | 800 | |
| Body | 14px | 400 | line-height 1.55 |
| Supporting | 12–13px | 400 | mute grey |
| Eyebrow label | 10px | 700 | UPPERCASE, letter-spacing 0.08em |
| Big numbers | — | 800 | tabular figures, value first and large, label small underneath — never above |

### Surfaces

- Page `#F3F0EB` (warm off-white, default background)
- Inset `#EDE9E1`
- Card `#FFFFFF`

### Ink

- `#1A1A1A` headings
- `#3D3A36` body
- `#8A857D` muted
- `#B5B0A7` faintest

### Accent — the only one

- Moss `#6B8E6B` — CTAs, active, completion

### Semantic — use sparingly

- Warn / coaching amber `#B8853A`, on background `#F5EBD4`, text on amber `#3D2600`
- Danger `#B84545` — form errors only, never training content
- Strava `#FC4C02` — only when referencing Strava

### Proposed new rule — semantic colour pair

This is a **proposal for review**, not a decision. See P-01.

- **Moss = held the zone.** Completion where intensity was correct.
- **Amber = cooked it.** Completion where intensity drifted above target.

Rationale: currently moss means "done" and amber means "warning", which is category-generic.
Making the pair mean *zone discipline* encodes the product thesis in the design system, makes
Zonna screenshots instantly distinguishable from a category that has converged on warm-neutral
+ single-green, and is structurally unavailable to a beginner-first competitor — a beginner app
cannot ship a colour that means "you ran too hard."

### Voice

Plain, direct, honest. States consequences rather than hiding them. Never motivational cliché,
never influencer polish, never overclaiming. If a number is uncertain, say so. If a skip has a
cost, name the cost.

---

## 2. Phase 0 — Discovery

Produce `/docs/ONBOARDING-AUDIT.md`. **Read-only. Change no code.**

### 2.1 Onboarding and plan generation

1. Every screen in order, with route/component path, exact question copy and helper copy.
2. Every input collected: schema name, required or skippable, which part of the rule engine consumes it.
3. Inputs the rule engine **can** accept but onboarding never asks for.
4. Whether Strava is connected before or after plan generation, and whether any Strava-derived
   value seeds the plan.
5. Behaviour with no Strava history — hardcoded defaults? named constants? where?
6. Plan generation: synchronous or async? typical wall time? loading state, and what it says.
7. Does the generated plan carry a phase name and a per-week rationale string? Reference the
   `Phase` type (`{ name, start_week, end_week }`).
8. Does any session carry a pace **ceiling** ("not faster than") as distinct from a target?
   Note INV-PLAN-007 — zone/HR targets remain strings.
9. Every reusable input component already built (selection tile, toggle, day picker, numeric
   entry, wheel picker) with paths.
10. Confirm all colour / shadow / radius values resolve from `globals.css`. Flag anything hardcoded.

### 2.2 In-app surfaces

11. Current tab structure. Is planned work and completed work split across tabs?
12. Plan screen: what blocks exist, in what order?
13. Is there a modify-plan surface? If so, does it batch changes or regenerate per change?
14. Does anything show a diff before applying a plan change?
15. Profile screen: what headline metrics are shown? Is a streak among them?
16. Free vs paid gating: what is currently behind the paywall, enumerated.
17. Every empty / cold-start state in the app, and what it currently renders.

### 2.3 Output format

Table per section. Flag gaps as `GAP-01`, `GAP-02`. For each gap note whether it maps to an
existing backlog item (R15b, R17, R18, R19, R20, R21, R22, R23, R24) or is new.

---

## 3. Phase 1 — The teardown

Twenty entries. Each has **TAKE** (the principle worth adopting), **LEAVE** (what's weak),
**BEAT** (the Zonna version). Reconcile each against the audit and mark as
`ALREADY DONE` / `PARTIAL` / `GAP`.

### Onboarding

**T-01 · Launch screen** — `IMG_7172.PNG`
- TAKE: Full-bleed photo, zero chrome. Three-word rotating stack (PLAN / RUN / IMPROVE) with
  only the current word at full opacity. Single accent full stop on the lit word.
  "Keep the promise you made to yourself."
- LEAVE: Stock model, face-on, anonymous. Legibility marginal against foliage. Google sign-in
  on an iPhone-only app.
- BEAT: Looping 3–4s video, desaturated. Three-word stack carrying the thesis:
  **EASY. HARD. EASY.** Moss full stop on the lit word. Bottom scrim, transparent → `#1A1A1A`
  at ~55% over the lower third. Apple sign-in only, full width, moss.
- Stock footage: see Section 6.

**T-02 · Name capture** — `IMG_7173.PNG`
- TAKE: "What should I call you?" + helper "So I know who I'm coaching." Turns a form field
  into a relationship; sets up later "Russell, your plan is ready."
- BEAT: Same pattern, Zonna register — plain and warm, not jokey. Zonna is the product;
  DHTB is the person.

**T-03 · Goal selection with plan length** — `IMG_7174.PNG`
- TAKE: Each goal tile shows its plan length range (5K 8–12 weeks, 10K 10–16, Half 12–20,
  Marathon 16–24). Sets expectation before commitment and signals the length is calculated.
- BEAT: Same, using R23's auto-calculated length. Add ultra if the engine supports it.

**T-04 · Ability tiers** — `IMG_7175.PNG`
- TAKE: Four tiers in solid cards, plus a visually separate **dashed** escape hatch
  ("I'm just getting started — I'll switch you to a run-walk start"). The least confident user
  gets their own door instead of having to self-label as "Beginner".
- LEAVE: Axis is distance. Top rung is "Elite", which is flattery — the one thing this brand
  refuses.
- BEAT: Axis is **intensity discipline**, not distance. And if Strava is connected, don't ask —
  *tell them*. "Nine of your last ten runs were above easy pace. That's what we're fixing."
  Keep the dashed escape hatch pattern.

**T-05 · Benchmark + reassurance copy** — `IMG_7176.PNG`
- TAKE: "A rough guess is fine" plus "You're not locking yourself into this pace." Defuses fear
  of answering wrong, which is the main wizard abandonment cause. Wheel picker for approximate
  values (min + sec columns).
- LEAVE: Copy leaks developer language ("replaces the old hardcoded defaults"). Unskippable even
  when better data exists.
- BEAT: **Fallback, not a step.** Strava connected → confirm the real number
  ("Your last 5K was 26:14, three weeks ago. Right?"). No Strava → ask, with reassurance copy in
  Zonna voice. Wheel picker for approximate values only, never for precise entry.

**T-06 · Sex** — `IMG_7177.PNG`
- TAKE: The input. It changes HR-max estimation, pace modelling and fuelling.
- LEAVE: Framed as "How do you identify?" — identity language on a physiological input, then
  made skippable, so the data is soft and the question is confused about its own purpose.
- BEAT: Ask for what's used and say why. "Sex — used for heart rate and pace modelling."
  Allow skip, but **state the consequence**: "we'll use population defaults."

**T-07 · Day picker + cross-train** — `IMG_7178.PNG`
- TAKE: "Which days can you run? Pick every day you're available, we'll schedule your 3 runs
  within these." Better constraint data than "how many days a week". Plus a cross-train toggle
  revealing activity-type chips.
- BEAT: Day picker → R22. Cross-train matters **more** for Zonna than for them: cross-training
  days are days the runner isn't recovering, which is a direct input to a zone-discipline engine.
  Feeds R21. Must be re-editable in-app, not onboarding-only.

**T-08 · Referral code screen** — `IMG_7179.PNG`
- TAKE: Placed after all questions, before generation. Clear "I don't have a code" out.
- BEAT: **One field, two behaviours.** Make-A-Wish / WishHeroes codes unlock full access;
  ordinary referral codes extend the trial. Surfaces the charity partnership at peak intent.
  See `/projects/.../areas/make-a-wish-partnership.md`.

**T-09 · "Building your plan" narration** — `IMG_7180.PNG`
- TAKE: Four named steps, each planting a value: *marking your finish line → planning around
  your week → setting how far and how fast → making recovery part of the plan.* Line art
  illustration. Makes a generated plan feel considered.
- CAUTION: If the rule engine returns in 400ms this is staged latency. That's acceptable only as
  a deliberate decision.
- BEAT: 2–3s, steps named after Zonna's principles: *reading your last 12 weeks → finding your
  easy pace → setting the ceilings → building the weeks.* The last one is uniquely ours.

**T-10 · Card-stack reveal** — `IMG_7181.PNG`
- TAKE: Five swipeable cards with an "3/5" counter before the plan itself. Bar chart of weekly
  volume with **handwritten annotations** — "easier on purpose" over the down weeks, "10K week"
  on W8. Pre-empts "why is week 4 lighter" before it reads as a bug.
- BEAT: Same pattern. Zonna annotations: *this is where you'd normally blow up* /
  *nothing above easy here* / *the only hard day this week*.
- CAUTION: Every claim on a card must be something the engine actually enforces. Slick
  onboarding that overpromises is worse than plain onboarding that doesn't.

**T-11 · Plan preview + paywall placement** — `IMG_7182.PNG`
- TAKE: Hero panel (total distance, sessions, long runs, quality runs) with tonal wave graphic
  and a ticket-notch divider. Then "Your plan adapts to how you're progressing" with two
  scenarios. Then **"Either way, the goal stays put"** and **"No make-up runs."** Then Week 1
  with phase name *and rationale* ("Base — the focus this week is consistency…"), and the actual
  Monday session — including **"Not faster than 13:12/mi."** Then the wall.
- NOTE: That pace ceiling is the most Zonna-shaped idea in their entire app, and they've buried
  it in a beginner product behind a paywall.
- BEAT: Same value-first sequencing. Ceiling is a first-class, visible concept, not a subtitle.
  Deep ink hero panel rather than green.

**T-12 · Paywall** — `IMG_7183.PNG`
- TAKE: Per-week price framing (£1.54/wk reads as nothing; £79.99/yr reads as commitment).
  Explicit trial timeline — "Today: full access" / "Day 5: reminder that your trial ends soon."
  Removes fear of a surprise charge.
- **DO NOT TAKE:** "4.9 avg rating" and "Join 1,000+ runners". Their App Store listing states it
  has not received enough ratings or reviews to display an overview. Unverifiable social proof.
  Zonna does not overclaim, ever.
- BEAT: 14-day timeline (Day 1 / Day 11 reminder / Day 14). ~80p per week framing. Real review
  count or none at all.

**T-13 · Exit offer** — `IMG_7184.PNG`
- TAKE: The **placement only**. Catching the user at the X rather than letting them leave.
- **DO NOT TAKE:** "SAVE 64%", "It expires when you leave this screen", struck-through £155.88
  (a monthly-equivalent nobody would have paid), serif type borrowed from discount retail.
  Fake urgency. Tells the user the first two prices were theatre.
- BEAT: Same slot, opposite move. Offer the **free tier** instead of a discount:
  > **Not ready to pay?**
  > The free plan is a real plan. Full weeks, ceilings on every easy run. Keep it as long as you want.
  > [Use Zonna free] [See Pro again]
  Converts an abandoned paywall into an activated user rather than a discount that can't be
  retracted. Alternative honest save: "keep your trial, we'll remind you before it ends" +
  notification opt-in.

### In-app

**T-14 · Plan screen hierarchy** — `IMG_7187.PNG`
- TAKE: Four blocks, descending time horizon — **this week → the whole arc → change it → the
  detail.** Answers "am I on track" before "what's on Thursday". Projected finish as a **range**
  (1:04:37–1:10:01) with source stated ("projected from your logged runs"). Current pace → race
  day pace with an arrow. Modify entry is a card with a reason: *"Adjust volume, pacing, or
  recovery when life changes"* — a churn intervention disguised as a subtitle. Week header
  carries two counters (sessions 0/3, distance 0/22.4km).
- LEAVE: **Every metric is volume.** Not one intensity metric anywhere, in an app whose own
  marketing argues runners go too fast. Projection is pace-only with no diagnosis. Pace ceiling
  never surfaces on the summary. Progress bar renders 0% on day one.
- BEAT: Add a fourth block: **"This week — 3 of 4 runs held the zone. One drifted."** Moss and
  amber, glanceable, no number to read. Projection carries the **limiter**: "projected 44:10;
  the limiter is your easy runs averaging Zone 3, so aerobic base isn't building." Ceiling on
  the week card. Cold start shows plan shape, not 0%.

**T-15 · Modify plan sheet** — `IMG_7188.PNG` — **HIGHEST LEVERAGE ITEM**
- TAKE:
  - Settings and plan are the same thing — parameters edited *from* the plan, in a sheet, with
    current value on the right of every row. Whole configuration readable in three seconds.
  - **Batched, then applied.** "Edit settings, then apply them together." One regeneration, one
    diff. Not regenerate-per-toggle.
  - Grouped by **consequence** (Training Load / Goal & Schedule), not alphabetically.
  - Every row states its blast radius — "Shift the whole plan forward or back", "Anchor your
    weekly endurance run".
  - Destructive-ish action ("Start a new plan") visually quarantined, separate card, amber.
  - Pro locks on **specific rows**, not the whole screen — a better upsell than a wall.
- LEAVE: Intensity is a paywalled preset picker ("Balanced") in a beginner app — their weakest
  link and our core. Runs-per-week behind Pro means a free user whose life changes can't keep
  the plan accurate, so it goes wrong and they churn.
- BEAT:
  - Intensity is the **primary control, free**, expressed as a ratio with a consequence
    (80/20 → 90/10, with a line saying what it does to the week).
  - Add rows nobody else has: **easy pace ceiling** (editable, warns if raised above what the
    data supports), **blockout days** (R22 — specific dates, not a weekly pattern),
    **strength sessions** (R21).
  - **Always show the diff before applying** — "long run moves Sun → Sat, week 3 drops 4km,
    race date unchanged" — and require accept.
- Maps to: R20 + R22 + R21. This screen changes the R20 architecture decision.

**T-16 · Profile** — `IMG_7185.PNG`
- TAKE: Plan card structure — what's included → what Pro adds → price per week. States what you
  already have before listing what you don't.
- LEAVE: **Week streak as a headline metric.** Streaks are a habit mechanic; for a product about
  restraint they push the wrong behaviour. Third cold-start screen rendering zeroes.
- BEAT: Discipline-shaped headline numbers — *weeks on plan*, *easy runs held*,
  *longest zone-clean streak*. That last one is a streak worth chasing.

**T-17 · Settings — Coach Personality** — `IMG_7186.PNG` — **STEAL THIS**
- TAKE: *"Coach Personality — how Miles talks about your training — Supportive."* A selectable
  register for coaching output. Underexploited in a beginner app where every option is presumably
  some flavour of nice.
- BEAT: Better idea for Zonna than for them, because there's a real house voice available.
  - **Straight** — plain, factual, no framing. Default.
  - **Blunt** — says the thing. *"You cooked Tuesday. Again."*
  - Later, paid: the DHTB register.
  This lets Zonna borrow DHTB's personality as an opt-in tone of voice without putting the
  founder into the product or merging the two brands.
- Maps to: R19 (coaching tips in Supabase) — tips need a register dimension.

**T-18 · Settings — zones are buried**
- Observation, not a copy. "Training Zones" sits between Language and Push Notifications with an
  off-palette red icon. For Zonna, zones are the product. Positioning contrast worth noting in
  comparison-page copy.

**T-19 · Review prompt placement**
- TAKE: Passive list row in Support ("Enjoying Miles? Leave a review"), non-intrusive.
- NOTE: Their App Store shows no ratings overview, so a passive prompt alone clearly
  underperforms.
- BEAT: Keep the row **and** trigger a proper prompt after a genuine win — e.g. first week where
  every easy run held the zone.

**T-20 · Cold start / empty states**
- Across `IMG_7182.PNG`, `IMG_7187.PNG`, `IMG_7185.PNG`: zeroes everywhere. 0%, 0.0 mi, 0 runs, empty progress bar. Empty
  states are visibly undesigned. Cheap, broad win.
- BEAT: Audit every empty state (Phase 0, item 17). First-run renders what's coming, not what
  hasn't happened.

### Corrections to earlier assumptions — do not propagate

- **Miles DOES have a free tier** (run tracking, Apple Health import, training history). The
  differentiator is narrower than "we have a free tier, they don't": theirs is a tracker, ours
  is a real generated plan.
- **Miles DOES take Strava** (profile screen, integrations row). The edge is not *having* Strava
  — it's using it to diagnose intensity discipline rather than as another distance/pace import.
  Keep this claim narrow so it survives scrutiny.

---

## 3A. Required impact analysis — every recommendation, no exceptions

A recommendation is never "just a UX change". Each one is a change to what the user sees, what
we store, what the engine computes, and what we say. Phase 1 produces this block for **every**
item T-01 to T-20 that is marked PARTIAL or GAP. No item is carried into Phase 2 without it.

```
### T-xx · <name>
Verdict:        ALREADY DONE | PARTIAL | GAP
Evidence:       <file paths and code that justify the verdict>
Ours vs theirs: <if already done — is ours better or worse, and why>

UX change:      What the user does differently. Which screens, which flow position.
UI / design:    New components? New tokens? Does it fit the existing design system,
                or does it need a new pattern? Name the tokens used.
Data points:    New fields captured or derived. Schema changes. Migrations.
                Where it is stored. Whether it is user-entered or derived.
Engine impact:  Does this change plan generation? Specifically how — which rule,
                which calculation, which output. If it is a new input, state what
                the engine does with it and what it did before. If it changes
                nothing in the engine, say so explicitly.
Copy / voice:   New strings required. Flag anything that is a voice decision.
Upstream:       What must exist before this can be built.
Downstream:     What this breaks or forces. Other screens affected. Existing data
                that needs backfilling or defaulting.
Free vs Pro:    Which side of the paywall, and the reasoning. Default position:
                anything that keeps a plan ACCURATE is free; anything that makes it
                SMARTER is Pro.
Backlog:        UPDATE <R-item> | NEW | SUPERSEDES <R-item> | ABSORBED BY <P-item>
Approval:       NONE | RUSS (see Section 4A)
Priority:       With reasoning — differentiation value against build cost.
```

### Backlog reconciliation — do not create duplicates

Before proposing anything new, read the existing backlog (R15b, R17, R18, R19, R20, R21, R22,
R23, R24) and any items in the repo's tracker. For each recommendation, decide:

- **UPDATE an existing item** — the capability is already scoped; this adds a data point,
  a constraint, or a UI detail to it.
- **SUPERSEDE an existing item** — the recommendation replaces the original scope.
- **NEW item** — nothing existing covers it.

**Worked example — T-06, the sex question.** We already capture this, or have it scoped. So this
is not a new backlog item; it is an update. But the update is not just "add a field". The analysis
must answer: what does the engine currently do without this value? What does it do with it —
HR-max estimation, pace modelling, fuelling guidance, or all three? What happens to existing users
who have no value stored? Does adding it change any already-generated plan, and if so do we
regenerate or leave it? Does the skip path need a stated default, and what is that default?
That is the level of answer required for every item.

### UX and UI are first-class, not an afterthought

Every proposal must state its UX and UI implications explicitly, in the block above. A
recommendation that improves a data model but degrades the experience is not an improvement.
Where a recommendation changes a flow, describe the flow before and after. Where it changes a
screen, describe what is added, removed and moved.

Quality of visual execution is itself a requirement, not a nice-to-have. Two things the product
owner specifically flagged as worth matching or beating:

- **Imagery and depth.** Their screens do not look flat — layered cards with soft shadows, a
  hero panel with a tonal wave graphic, a ticket-notch divider, full-bleed photography on the
  launch screen. Zonna should not ship flat rectangles on a beige background.
- **Illustration in transitional states.** The "Building your plan" screen carries a line-art
  illustration of figures running a curve. It makes a waiting state feel designed rather than
  empty. Note for accuracy: that specific screen is line-art illustration, not photography —
  the photography is on the launch screen. Both are wanted, in their respective places.

See P-13.

---

## 4. Phase 2 — Proposals to write up

Draft each as a backlog item in the repo's existing format. Do not build.

- **P-01 · Semantic colour pair (moss = held zone, amber = drifted).** Design system change.
  Touches every completion state. Must go through `globals.css` tokens. Highest brand leverage,
  lowest code risk. Needs explicit sign-off before anything depends on it.
- **P-02 · Modify-plan sheet.** T-15. Batched edits, grouped by consequence, per-row Pro locks,
  diff-before-apply. Supersedes/absorbs parts of R20, R21, R22.
- **P-03 · Pace ceiling as a first-class concept.** Session-level "not faster than", editable in
  P-02, surfaced on the plan screen and week card. Check INV-PLAN-007 compatibility.
- **P-04 · Zone-compliance metric on the plan screen.** T-14. The fourth block.
- **P-05 · Onboarding rework.** T-02 to T-07. Strava-first: confirm rather than ask. Collapse
  steps where Strava data exists. Add an interim payoff mid-wizard (e.g. "your easy pace is
  6:42/km") so the wizard is a diagnosis, not an interrogation. Add "Step 3 of 7" labelling.
- **P-06 · Plan reveal sequence.** T-09 to T-11. Narrated generation → card stack with
  annotations → preview with phase rationale → wall.
- **P-07 · Coach register setting.** T-17. Straight / Blunt, with R19 tips carrying a register
  dimension.
- **P-08 · Referral + charity code screen.** T-08. One field, two behaviours.
- **P-09 · Paywall and exit offer.** T-12, T-13. Per-week framing, 14-day timeline, free-tier
  exit offer. No fake urgency, no unverifiable social proof.
- **P-10 · Cold-start states.** T-20. Sweep.
- **P-11 · Launch screen.** T-01. Depends on stock footage sourcing.
- **P-12 · Profile headline metrics.** T-16. Replace streak with discipline metrics.
- **P-13 · Visual depth and imagery system.** Cross-cutting. Card elevation tokens (warm shadow
  on warm ground — a neutral grey-blue drop on `#F3F0EB` goes muddy; roughly
  `0 1px 2px rgba(26,26,26,0.04), 0 4px 12px rgba(26,26,26,0.05)`, tokenised, never inline).
  A hero-panel treatment with tonal depth. An illustration style for transitional and empty
  states, consistent across the app. Photography rules for the launch screen per Section 6.
  This is the item that stops Zonna looking like flat cards on beige. Depends on P-01.

### 4A. Approval gates — do not proceed past these

**Anything touching brand, palette, typography, tone of voice, or product naming requires
explicit sign-off from Russ before it is built.** Claude Code proposes; it does not decide.

Items that carry an automatic approval gate:

- **P-01** — semantic colour pair. Changes what moss and amber mean across the whole app.
- **P-07** — coach register. A voice decision, and it touches the relationship between Zonna
  and the DHTB brand.
- **P-13** — elevation, illustration style, photography. Design system change.
- **Any new copy that establishes a pattern** — onboarding questions, empty states, coaching
  strings, paywall copy. Individual strings within an approved pattern do not need re-approval.
- **Any proposed addition or change to the tokens in Section 1.**

For each gated item, produce a one-page decision note: what is proposed, what it changes, what
the alternatives were, and what it costs to reverse. Present it and stop. Do not build ahead of
approval on the assumption it will be granted.

Brand voice reminder for all proposed copy: plain, direct, honest. States consequences rather
than hiding them. Never motivational cliché, never influencer polish, never overclaiming.
Off-voice shipping copy is a failure of the SLC standard, not a cosmetic issue.

### Open decision — needs Russ, do not decide in code

**Merge Plan and Activities into one timeline?** Miles splits planned and completed across two
tabs, which separates the comparison that matters most ("did I do what I was meant to"). A merged
timeline — past and future in one list, completed sessions showing planned vs actual in the same
row, moss or amber — frees a tab and makes the compliance question unavoidable. This is the
largest architectural call in the set. Surface the trade-offs from the Phase 0 audit; do not act.

---

## 5. Sequencing recommendation

1. **P-01** — everything visual depends on the token decision.
2. **P-03** then **P-04** — the ceiling and the compliance metric are the product thesis made
   visible. Highest differentiation per unit of work.
3. **P-02** — biggest single build, absorbs three backlog items.
4. **P-05**, **P-06** — onboarding, once the above exists to show off.
5. **P-07** through **P-12** — in whatever order fits.

One release shipped completely before starting the next. Every release updates documentation,
decisions, patterns, principles and backlog. SLC over MVP — shipping copy that doesn't match the
brand voice is a failure of the SLC standard.

---

## 6. Stock footage and imagery — for P-11

Founder imagery is deliberately excluded. Zonna is the product, DHTB is the person; the app must
outlive the personal brand.

**Primary — Pexels.** Attribution not required; photos and videos may be modified; free for
commercial use including in a product. No account needed, up to 4K.

**Secondary — Mixkit** (every clip professionally reviewed, higher hit rate, smaller library).
**Third — Pixabay** (similar terms). **Coverr** is built specifically for hero backgrounds, so
clips are composed with text overlay in mind.

**Avoid:** Videvo and Videezy free tiers (attribution required on many clips), Dareful (CC BY,
credit required). Not worth the licence admin.

**Risk — read this.** Clips featuring identifiable people may require a model release for
commercial use, and Pexels does not guarantee releases are in place. A launch screen on a paid
app is exactly that use.

**Mitigation, which is also the better creative choice:** use clips where the runner is **not
identifiable** — rear view, distance, silhouette, motion blur, feet and legs only, over the
shoulder. Removes the release problem entirely and reads as *any runner*, which is the point.
Miles used a face-on mid-shot and got a model nobody remembers.

Search terms returning usable vertical footage: `running trail rear view`,
`runner silhouette sunrise`, `running feet path`, `runner back view forest`. Filter to vertical,
4K. Screenshot each clip's licence page and store under `/docs/licences/`.

---

## 7. Hard rules — things this project will not do

1. No unverifiable social proof. No rating or user-count claim without a real source.
2. No fake urgency. No countdown, no expiring discount, no struck-through price that was never
   charged.
3. No flattery tiers. No "Elite" label.
4. No streak mechanic that rewards running on a day the plan says rest.
5. No colour outside the tokens in Section 1.
6. No hardcoded colour, shadow or radius values in components.
7. Nothing claimed in onboarding that the engine does not enforce.
8. Never state a projection without stating what it's derived from.
