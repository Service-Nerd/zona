# Design Board — `SITE-FREE-COLUMN-COPY-01`: which retained-from-trial gates the free column should name

**Date:** 2026-11-20 · **Board:** Design Board
**Trigger:** backlog item; `/pricing` copy placement (whether a string exists and where it sits is this
board's; its tone is `brand.md`'s; the tier line is the SLT's and is not in question)
**Question as filed:** `GRANTED_AT_TRIAL_RETAINED_IN_FREE` holds six things a free account keeps and
the free column names none of them. Which of the six, if any, does a reader choosing between tiers
need named?
**Tier:** n/a (marketing)

## Analysis, before any seat spoke

### Re-derived

| Item says | Re-measured 2026-11-20 |
|---|---|
| six gates in `GRANTED_AT_TRIAL_RETAINED_IN_FREE` | **6** (`lib/plan/featureGates.ts:22–29`), unchanged |
| the free column names none of them | **True of the column**: `FREE_FEATURES` has **5** rows, none carrying one of the six gates. All six sit in `OMITTED_FROM_PRICING` with a reason each saying the copy decision is "reserved" for this board |
| (implicit) /pricing does not say them | **False of the page.** The *"What happens on day fifteen"* card on `/pricing` (`app/pricing/page.tsx:202–212`) already reads: *"You keep the plan you built during the trial. Your zones, your paces, the coach notes already on your sessions: all of it stays. What stops is the ongoing part, the reading of new runs and the reshaping when a week goes sideways."* That names **four of the six** (`personalised_plan`, `vdot_pace_zones`, `hr_karvonen_zones`, `ai_coach_notes_existing`) in a sentence |

### What each of the six actually is, measured against the code

| Gate | Consumers outside `featureGates.ts` / `pricing.ts` | Does a reader's tier choice turn on it? |
|---|---|---|
| `personalised_plan` | **0** | Said in the day-fifteen card. Free plans are also built for the runner's date and days (FREE row 1) |
| `vdot_pace_zones` | **0** | Said ("your paces"). No tier branch found on the zone path; pace/HR targets are FREE per `CLAUDE.md` § Feature Tagging |
| `hr_karvonen_zones` | **0** | Said ("your zones") |
| `ai_coach_notes_existing` | **0** | Said, **in the only form that can carry the trap**: "the coach notes already on your sessions … What stops is the ongoing part". A four-word bullet cannot say *"no new ones"*; this sentence does |
| `session_catalogue_full` | **0** by name. The real mechanism is `is_free_tier` on catalogue rows: **27 free, 4 paid-only**, and all 4 are `ultra_specific` rows eligible only at **50K/100K** (`sessionCatalogueData.ts`), distances that are PAID anyway | **No.** It changes nothing a free reader can generate (5K/10K/HM); naming it would describe a difference with no effect |
| `injury_adaptations_initial` | **0**. The engine adapts on `input.injury_history` with no tier check, on every plan (`featureGates.ts` records `injury_adaptations_new` removed 2026-09-11 for exactly that reason; SLT ruled injury adaptation is never paid) | **No.** Both tiers get it, so it cannot separate them. It is a proposition point, and the homepage already says the wizard takes injury history (`app/page.tsx:1379`) |

Method: `grep` for each gate name across `lib app components` (non-test); `grep -c is_free_tier` and
the four paid rows' `distance_eligibility` in `lib/plan/sessionCatalogueData.ts`; read of
`app/pricing/page.tsx`. **Not measured:** a render of `/pricing`; any reader behaviour (no site
analytics exist, `SITE-SCROLL-DEPTH-01`).

### Settled-ground scan

- **Website "list of the eight things we look for" — DON'T SHIP, PERMANENT**, *"may not return as a
  list with better wording"*. A longer free column is that list (`SITE-CURRENCY-REVIEW-01` finding 7).
- **`PRICING-FREE-GATE-02` (2026-11-05)** — shipped as a gate, *"the page gains no rows in this
  wave"*; 🎓 Sierra's objection to a future *"free tier, now with more rows"* **stands and is not
  discharged.**
- **SLT 2026-09-11 / `WIZARD-INJURY-FREE-01`** — injury adaptation is never paid. Settles the tier;
  this sitting rules only whether it gets a pricing row.
- **`TT-PRICING-CLAIM-01` / `PRICING-ROW-TRUTH-01`** — a pricing row must be true on every path;
  a row for `session_catalogue_full` would be true and meaningless, which is the cousin of that defect.
- Token layer: none touched.

## The sitting

**🧭 Zhuo (chair).** The filing assumed the page says none of this. It says four of the six already,
in the one paragraph on the page whose job is "what do I keep". The question collapses to two
gates, and the table answers both: one has no effect at a free distance and the other is identical
at both tiers. A pricing column exists to separate tiers.

**🎓 Sierra.** My objection stands and the measurement agrees with it. The day-fifteen card is the
right instrument: it is the only place that says *what stops*, which is the thing a reader choosing
a tier actually needs. Adding *"VDOT pace zones"* as a row teaches a reader a word, not a decision.

**✋ Silvanto.** The free column has five rows and the paid has eight. Each row added to the free
side to say "you keep what you already had" dilutes the five that say what free *does*. Nothing to
veto.

**📱 Wroblewski.** One measurable thing: `ai_coach_notes_existing` as a bullet would mislead, and
it is already said correctly. A reader on a phone reads the card in one pass. No new input, no
new decision put in front of anyone. Agree.

**🎪 Collins.** Injury adaptation free at every tier is a stronger proposition than anything in the
free column today, and I would rather it were said somewhere a pricing reader looks. But the chair
is right that a tier column is the wrong place for a thing that is the same in both tiers. I am not
pressing it here; the homepage is where it belongs and it is there.

### ⚡ Recorded disagreement
None that reached a ruling. Collins' point (injury adaptation is an under-told proposition) is
recorded as a placement opinion for the homepage, not a pricing finding.

### ⛔ Veto check
None.

## ⚖️ Ruling — DON'T SHIP (no rows), not permanent

**None of the six gains a row in the free column.** Four are already named on `/pricing`, in the
day-fifteen card, in the only form that can say *"existing notes, no new ones"*;
`session_catalogue_full` has no effect at any free distance; `injury_adaptations_initial` is
identical at both tiers and cannot inform a tier choice.

**One consequence the build must carry (conformance, no new copy):** the six
`OMITTED_FROM_PRICING` reasons stop saying the copy decision is "reserved" and cite this ruling
instead, each with its measured reason (stated in the day-fifteen card × 4; no free-distance
effect × 1; same at both tiers × 1). A reason that names a pending decision after the decision is
taken is a stale record.

Not permanent: a row may return if a gate's behaviour changes so that a free reader's tier choice
turns on it (e.g. a paid-only catalogue row eligible at 5K/10K/HM), with that measurement.

### 📦 Artifacts
None to build beyond the reason text above (DON'T SHIP). Register row below. No new check:
`pricing.test.ts` already requires every one of the six to carry an omission reason.

### ↗️ Routing
None. The tier of each gate is settled and unchanged; nothing here prices anything.

### ⚠️ What this does not prove
- The day-fifteen card was read in source; `/pricing` was not rendered for this sitting.
- **No check binds the day-fifteen card to the four gates it now discharges.** If that paragraph
  is rewritten, the four are unnamed on the page again with every gate green (observed, not filed).
- "No tier branch on the zone path" is from a grep of the six gate names (0 consumers) and of
  `tier` in `ruleEngine.ts` (the branches found are catalogue `is_free_tier` and MP/HM row
  selection); it is not a proof that no zone computation reads tier anywhere.
- The six gate names have **zero runtime consumers**; they are declarative labels. That is outside
  this question (observed, not filed).
