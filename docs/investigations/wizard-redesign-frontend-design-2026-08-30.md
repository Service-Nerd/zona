# WIZARD-REDESIGN — frontend-design pass

**Date:** 2026-08-30 · **Status:** design spec (feeds the WIZARD-REDESIGN epic)
**Basis:** Option A (day *selection*, existing `GeneratorInput` — no engine change to ship first)
**Backs:** `docs/investigations/competitive-ux-scope-2026-08-29.md` · SLT `slt-2026-08-29-planzy-ux.md` · Coaching Board `coaching-board-2026-08-29-competitive-ux.md`
**Design authority:** `ui-patterns.md`, `CLAUDE.md` (Warm Slate + voice), `brand.md`
**Trigger:** `frontend-design` skill (this doc is its output)

> This is the screen-by-screen shape, per-question copy, teaching interstitials, and the tactile control for every question. It does **not** design Option B (per-day time budget) — that stays behind the Coaching Board ruling. Everything here maps onto the **existing** `GeneratorInput` so it can ship without touching the engine, with one clearly-flagged exception (weekday long-run day).

---

## 1. The frame (CI-1) — one question per screen

Every wizard screen shares one anatomy. This is the Zonna reading of Planzy's shape — calmer, no gamification.

```
┌───────────────────────────────────────┐
│ [←]              ▁▁▁▁▁▂▂▂▂▂░░░░░░       │  ← back arrow + thin moss progress line (no %)
│                                        │
│  HOLD THE ZONE                         │  ← eyebrow, optional (10px 700 --mute uppercase 0.08em)
│  How far?                              │  ← the question — 26px 800 --ink
│  Start with the finish line.           │  ← the "why we ask" — 14px 400 --mute, ONE line
│                                        │
│                                        │
│  [ the tactile control ]               │  ← one control, the screen's whole job
│                                        │
│                                        │
│                                        │
│  [           Continue           ]      │  ← sticky moss CTA, full-width, 52px
└───────────────────────────────────────┘
```

**Rules that make it Zonna, not Planzy:**
- **Progress = a thin moss line, never a number.** "Step 7 of 12" turns setup into a chore and invites drop-off. The line reassures without counting. (`--moss` fill on `--line` track, 3px, under the back row.)
- **No auto-advance.** Design system: *"No auto-dismiss. User controls every transition."* Selecting a card highlights it instantly; **Continue** commits. One deliberate tap, not a yank. This is the principled divergence from Planzy's tap-to-advance.
- **Back arrow top-left, always.** Back = previous question. Preserves the D6 fix ("Adjust inputs" → first step).
- **One question per screen** — the multi-field steps (`fitness`, `schedule`, `constraints`) split into single questions. The only exception is a genuinely-secondary optional field riding along with its primary (race name under race date) — flagged inline.
- **"Why we ask" is one sentence, dry, honest.** Most already exist as today's subtitles — reused, tightened.

---

## 2. The full sequence

Legend: **[wheel]** [ruler] [day-grid] = new CI-2 primitives · (card) (chip) (time) (text) = existing/near-existing · ⓘ = teaching interstitial · ★ = new screen vs today · ⬥ = PAID-only

| # | Screen | Question | Control | Maps to `GeneratorInput` |
|---|---|---|---|---|
| 0 | **Connect runs** ★ (CI-4) | "Start from real runs." | HealthKit connect + skip | (pre-fills benchmark, §4) |
| 1 | Race distance | "How far?" | **card-select** | `race_distance_km` |
| 2 | Race date (+ name) | "When's the race?" | **[wheel]** date · optional name (text) | `race_date`, `race_name?` |
| 3 | Goal | "What matters most?" | **card-select** | `goal` |
| 4 | Target time *(if time goal)* | "What's the target?" | (time) DurationPicker | `target_time` |
| — | **ⓘ A — "This will feel too easy."** | teaching | — | — |
| 5 | Weekly volume | "How much are you running now?" | **[ruler]** ★control | `current_weekly_km` |
| 6 | Longest run | "Longest run, last 6 weeks?" | **[ruler]** ★control | `longest_recent_run_km` |
| 7 | Training age | "How long have you been at this?" | (chip) | `training_age?` |
| 8 | Year of birth | "What year were you born?" | **[wheel]** ★control · skippable | `age` (→ max-HR estimate) |
| 9 | Benchmark | auto-estimate confirm **or** manual ask | confirm-card + (time) / (chip) | `benchmark?` |
| — | **ⓘ B — the easy-day lesson** (CI-7 keystone) | teaching | — | — |
| 10 | Your week | "Which days do you run?" | **[day-grid]** ★control (Option A) | `days_available`, `preferred_long_run_day`, `days_cannot_train` |
| 11 | Weekday ceiling | "How long on a weekday?" | (chip) | `max_weekday_mins?` |
| 12 ⬥ | Hard sessions | "You and hard sessions." | **card-select** | `hard_session_relationship` |
| 13 ⬥ | Terrain | "Where do you run?" | **card-select** | `terrain` |
| 14 ⬥ | Injuries | "Anything to flag?" | (chip, multi) | `injury_history` |
| 15 | **Generating ceremony** | — | existing `GeneratingCeremony` | — |
| 16 | **Plan ready** | reveal | existing reveal + `PlanIntroCard` | — |

FREE = screens 0–11 + 15–16. PAID adds 12–14. Distance gating (Marathon+ = paid) unchanged on screen 1.

**Why this order:** the race first (what/when/goal — the thing they came for), then *you* (fitness → benchmark — honest inputs), then *your week* (schedule). The two teaching moments sit at the seams: ⓘA reframes expectations right after they've stated a goal (the moment ambition peaks); ⓘB lands the easy-day lesson once we know their pace, right before they commit their week.

---

## 3. Per-screen copy + control

All copy is draft-final, Warm Slate voice — honest, dry, one sentence where possible, never cheerleader. Reuses today's strings where they already hit the bar.

### 0 · Connect runs ★ (CI-4)
- **Eyebrow:** — · **Header:** "Start from real runs."
- **Why:** "So the plan begins where you actually are — not a guess."
- **Control:** primary moss **"Connect Apple Health"** · secondary text link **"I'll start fresh →"** (always visible — D5 / Apple 5.1.1).
- **iOS reality:** HealthKit only (ADR-011). No Garmin; Strava CTA stays out until API approval. On web this screen is skipped (no HK) → wizard starts at screen 1, benchmark is manual.
- **On connect:** kicks off the FREE `/api/race-times` estimate in the background so screen 9 can pre-fill. **On skip/deny:** proceed; screen 9 becomes the manual ask. Never a dead end.
- **Non-regression:** preserve `connect_runs_seen` / `healthkit_connected_at` semantics and the always-visible skip.

### 1 · Race distance (card-select)
- **Header:** "How far?" · **Why:** "Start with the finish line. Work back from there."
- **Control:** 6 cards — 5K · 10K · Half · Marathon · 50K · 100K. Marathon+ carry a small **PAID** tag for free users; tapping a locked card routes to upgrade. Below grid (free only): "Marathon and longer need a paid plan. Start free trial →". *(Unchanged from today, restyled as the canonical card-select.)*

### 2 · Race date + name (wheel + optional text)
- **Header:** "When's the race?" · **Why:** "The date sets the plan length. Everything works back from it."
- **Control:** **[wheel]** date picker (day / month / year columns). A secondary, muted **"Name it? (optional)"** text field sits below the wheel — the one allowed ride-along, because a race name is genuinely secondary and low-stakes.
- **Edge:** date in the past or < minimum prep weeks → inline warn under the wheel ("That's very soon — the plan will be short."), never a block unless below the hard floor.

### 3 · Goal (card-select)
- **Header:** "What matters most?" · **Why:** "Crossing the line, or hitting a number. Both are valid."
- **Control:** 2 cards — **"Just finish."** / "Get to the line in one piece. That's the job." · **"Hit a time."** / "A number on the clock. You'll earn it." *(Existing copy — keeps.)*

### 4 · Target time (time) — conditional
- **Header:** "What's the target?" · **Why:** "Be honest. Optimistic goals make bad plans."
- **Control:** DurationPicker (HH:MM). Only shown when goal = "Hit a time."

### ⓘ A · "This will feel too easy." (teaching)
- **Eyebrow:** HOLD THE ZONE
- **Headline:** "This plan will feel too easy at first."
- **Body:** "That's on purpose. Most runners live in a grey middle — too hard to recover, too easy to improve. We're going to pull those apart."
- **CTA:** "Got it →" · No control. Distinct from questions: no progress advance visible, more vertical breathing (56px), moss eyebrow.

### 5 · Weekly volume (ruler ★)
- **Header:** "How much are you running now?" · **Why:** "Last four weeks, roughly. Real numbers only."
- **Control:** **[ruler]** — a horizontal draggable ruler in the user's units (km/mi), tick marks, value read out large above the thumb (metric-pair pattern). Snaps to sensible increments. **Default:** if connected (screen 0) pre-set to the measured 4-week average; else a neutral mid value.
- **Note:** replaces today's 6-chip bucket with a continuous ruler — finer signal, more tactile.

### 6 · Longest run (ruler ★)
- **Header:** "Longest run in the last six weeks?" · **Why:** "Tells us how much you can already hold."
- **Control:** **[ruler]** — same primitive, distance units. Default from connected data's longest recent run, else mid value.

### 7 · Training age (chip)
- **Header:** "How long have you been at this?" · **Why:** "Consistent months, not total years."
- **Control:** 4 chips — "< 6 months" · "6–18 months" · "2–5 years" · "5+ years". Optional (skippable).

### 8 · Year of birth (wheel ★) — skippable
- **Header:** "What year were you born?" · **Why:** "Only to estimate your max heart rate, if you haven't set one. Kept private."
- **Control:** **[wheel]** single year column. **"Skip — I'll set heart rate later →"** text link (App Store 5.1.1: never required).

### 9 · Benchmark (confirm-card OR manual ask)
Two states, decided by whether screen 0's estimate returned:

**9a · Auto-estimated (CI-4 payoff):**
- **Header:** "Looks like a {10K} in about {55:52}." · **Why:** "Estimated from your recent runs. Close?"
- **Control:** **"That's about right"** (moss) · **"Let me adjust"** → reveals a DurationPicker + distance chip inline.
- **Provenance:** this estimate is the FREE `/api/race-times` calc — **rule-derived, no AIMark**, and must **not** surface the PAID `RaceTimesCard`. Keep the tier line exactly where it is.

**9b · Manual ask (no estimate / skipped connect):**
- **Header:** "Raced recently?" · **Why:** "Gives us precise paces. Skip if not — we'll estimate."
- **Control:** type chip **Race result / 30-min time trial** → then distance chip + DurationPicker (race) or distance field (TT). Optional date. Skip-friendly (all optional). *(Existing benchmark logic, re-housed one-question-per-screen.)*

### ⓘ B · The easy-day lesson (CI-7 keystone)
- **Eyebrow:** THE EASY DAY
- **Headline:** "Easy should feel easy."
- **Body:** "Most runners push their easy days and coast their hard ones — so every run lands in the same tiring middle. Even elites spend about 80% of their time truly easy. Your easy runs build the engine. Let them."
- **Payoff line (moss):** "Hold the zone." *(the locked `BRAND.voiceAnchor` — correct in-product surface)*
- **CTA:** "Continue →" · This is the most on-brand screen in the flow. It earns its place; it is the reason we'd out-teach Planzy here.

### 10 · Your week (day-grid ★ — Option A) — **the keystone control**
Absorbs today's two scheduling steps (`schedule` + `constraints`) into one tactile grid.
- **Header:** "Which days do you run?" · **Why:** "Tap the days you'll train. Long-press one to make it your long run."
- **Control:** **[day-grid]** — a row of 7 day cells (Mon–Sun). Each cell cycles **Rest → Run**; one Run day is marked **Long** (moss-filled, "L" glyph) via long-press or a dedicated "long run" toggle. Selected-count drives the distance-threshold gate (below).
  - **Rest** = empty cell (`--bg-soft`).
  - **Run** = moss outline.
  - **Long** = moss fill + subtle `--s-long` accent.
- **Threshold gating (re-keyed from count):** the existing `DAYS_AVAILABILITY_THRESHOLDS[distance]` logic now reads the number of selected days. Too few → inline block ("Not enough for a marathon — needs 3+ days."); below `ok` on a time goal → amber warn ("Will train for completion, not time."). Same config, new driver.
- **⚠️ The one engine touch (flagged):** mapping —
  - Selected count → `days_available`.
  - Un-selected days → `days_cannot_train`.
  - Long day → `preferred_long_run_day`. **If the long day is Sat/Sun, this maps to today's contract unchanged (pure UI, ship now).** If the user picks a **weekday** long run, that needs the small `preferred_long_run_day` widening the scope doc flagged (Light Coaching Board). **First ship: constrain the Long marker to Sat/Sun** (matches current engine); weekday-long-run lands with the widening in a fast-follow. UI is built for both; the constraint is a one-line guard.
- **Why a grid, not a count:** Sutherland's point — "which days, honestly" is answered better than "how many days, aspirationally," and it folds two screens into one tactile moment.

### 11 · Weekday ceiling (chip)
- **Header:** "How long on a weekday?" · **Why:** "Your cap Monday–Friday. Weekends stay open."
- **Control:** chips — 30 min · 45 min · 60 min · 90 min · 2 hrs · 3 hrs · No limit. Single-select, deselect = No limit. *(Existing field; note tightened.)*
- **Free teaser** sits below (existing): "Add terrain, injuries, and hard-session preferences with a paid plan → ".

### 12–14 · PAID (card-select / chip)
Unchanged content, re-housed one-per-screen:
- **12 Hard sessions:** "You and hard sessions." — 4 cards (Avoid / Fine either way / Bring it on / I overdo it).
- **13 Terrain:** "Where do you run?" — 3 cards (Road / Trail / Mixed).
- **14 Injuries:** "Anything to flag?" — 6 chips multi-select (Achilles / Knee / Back / Hip / Shin splints / Plantar fasciitis) + "Skip — I'm clean →".

### 15–16 · Generate + reveal
Unchanged: `GeneratingCeremony` (skeleton → reveal → "There it is. Don't ruin it.") then plan reveal with `PlanIntroCard` (FREE first taste of Kit's voice).

---

## 4. New CI-2 primitives this flow needs

These are the CI-2 subset the wizard depends on — the ones to build (and the moment to bring in **Claude Design** as a rendered component library):

| Primitive | Powers screens | Notes |
|---|---|---|
| **WheelPicker** ★ | 2 (date), 8 (year of birth) | Column wheel, no keyboard, no zoom. Could also back DurationPicker later. |
| **Ruler** ★ | 5 (volume), 6 (longest run) | Horizontal draggable ruler, unit-aware, big value readout above thumb. |
| **DayGridSelector** ★ | 10 (your week) | 7 day cells, Rest/Run/Long states, count → threshold gate. |
| **CardSelect** (formalise) | 1, 3, 12, 13 | Today's `OptionCard`/distance grid → one canonical select-card. |

Existing primitives reused as-is: `Chip` (7, 11, 14, benchmark), `TextField` (2 name, benchmark TT), `PlanIntroCard` (16). All keep the ≥16px iOS-zoom guard.

### Time control — WheelPicker replaces the stepper, APP-WIDE (decided 2026-08-30)

The current time input is `DurationPicker` — a **+/– stepper**. Rejected: the thumb sits over the number while it changes, so you can't read the value you're setting. Replacement is a **WheelPicker** (hour:minute columns, selected value locked in a fixed centre band, flick-and-release — Planzy's easy-pace pattern, `planzy-wiz-11`). It also unifies with the date + year-of-birth wheels, so every wheel-shaped input in the wizard feels the same.

**This is not a wizard-local change — it is the forms-singularity doctrine (`ui-patterns.md` § Form Fields & Pickers).** One canonical control per quantity; changing it changes it everywhere:
- Update the canonical entry in `ui-patterns.md` — WheelPicker becomes (or joins) the canonical time control; note the relationship to `DurationPicker`.
- Migrate **every** `DurationPicker` call site to the wheel, or re-implement `DurationPicker` internally as a wheel so call sites don't change: wizard target time (4), wizard benchmark (9), and **`RaceResultSheet`** post-race finish time (`showSeconds` variant — keep the seconds column for short-race PBs).
- Re-verify each migrated surface (post-race finish time is the highest-emotion one; keep its anchored pre-fill from `plan.meta.target_time`).
- iOS ≥16px + Warm Slate tokens enforced inside the primitive.

**Cleanest implementation:** rebuild `DurationPicker`'s internals as a wheel (keeping its existing props/`showSeconds`), so it's a single-file change and all call sites inherit it. This preserves the singularity and avoids a scattered migration. Decide during the CI-2 build.

### Auto-advance — highlight-then-Continue (decided 2026-08-30)

Confirmed: single-choice screens **highlight** on tap and require an explicit **Continue** — no Planzy-style jump-on-tap. Honours "user controls every transition"; no accidental skips.

---

## 5. States (Complete bar) — every screen

- **Loading:** skeleton only (no spinner). Screen 0 estimate runs in background — screen 9 shows a shimmer confirm-card until `/api/race-times` resolves, then fills.
- **Empty / skipped:** connect skipped → manual benchmark; benchmark skipped → population estimate ("Still works — just less personal."); training age / birth year skipped → engine defaults.
- **Error:** HealthKit denied → proceed to manual, no dead end; estimate API fails → fall back to manual ask (9b) silently.
- **Edge:** race date too soon → warn not block; day-grid below distance floor → inline block with the exact requirement; distance changed to a stricter tier after picking days → re-validate the grid (existing `daysAvailable` clear-on-stricter logic, re-keyed).
- **Back / exit:** back from screen 1 (or 0) exits the wizard cleanly; every intermediate back = previous question; "Adjust inputs" from preview → screen 1 (D6).
- **Free vs paid:** single file, conditional render (Tier-Divergent doctrine) — PAID screens 12–14 appended, distance gate + teaser as today. Free variant complete and lovable on its own.

---

## 6. Non-regression contract (from the scope doc — carried here)

Any slice must keep these intact — re-verify before ship:
- **D6 / D7 / D10:** "Adjust inputs" → first step; sticky CTA clears Peak/Taper; ceremony has no dead gap.
- **D3 HR hydration** + `user_settings` persist preserved.
- **`zona_wizard_draft`:** write/read/deps + `validSubSteps` stay in lockstep as steps change; legacy drafts degrade gracefully (restore guards no-op on missing keys). New keys: none required for Option A beyond re-mapping schedule/constraints into the grid's state.
- **Tier line:** auto-estimate is FREE and must not expose the PAID `RaceTimesCard`.
- **Warm Slate + hooks:** no hardcoded hex/fonts (pre-commit blocks); light theme only; translate Planzy's dark/yellow, never copy it. iOS inputs ≥16px.
- **Engine untouched for first ship** except the Sat/Sun long-run constraint on the day-grid (pure mapping). Weekday-long-run widening = separate fast-follow behind the Light Coaching Board note.
- **Pre-ship gate:** `tsc` clean · vitest green · D6/D7/D10 re-verified · draft round-trips · no hex/font violations · `frontend-design` pass (this doc) · property sweep only if the engine is touched.

---

## 7. What this pass deliberately does NOT decide

- **Option B** (per-day *time* budget) — still behind the Coaching Board ruling. The day-grid here is selection-only; if B is approved later, the grid gains a per-cell time value and the engine work follows.
- **The full FORMS-PRIM-01 migration** of non-wizard screens — separate, later pass. This spec only needs the four primitives above.
- **CI-4 onboarding gate state-machine** — the *placement* (connect before wizard) is designed here; the exact `orientation_seen` / `connect_runs_seen` / `push` ordering pin is a small state-machine task to confirm against the current onboarding router.
