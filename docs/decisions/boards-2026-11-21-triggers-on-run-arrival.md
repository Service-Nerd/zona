# Triggers on run arrival: Coaching Board, Design Board, SLT, 2026-11-21

**Item:** `TRIGGERS-ON-RUN-ARRIVAL-01` · 🏃 COACHING BOARD first (which triggers, on what evidence) → 🧭 DESIGN BOARD (what the runner experiences) → 💼 SLT (tier, build order).
**Input:** ADR-027 v1.2 `ARCH-ENG-018` (*"Triggers are evaluated when data arrives … the Coaching Board rules on the thresholds and the Design Board/SLT on the frequency"*), and the founder, approving the sittings on 2026-11-21: *"Yes. These are important moments."*
**Status:** RULED. Nothing built. The engine is frozen (ADR-027) except named hotfixes, so every artifact below is owed to B3/B4b, not to the current engine.

---

## 0. What the code does today (verified, not taken from the brief)

| Claim in the brief | Verified at | Result |
|---|---|---|
| Triggers run only on a Heavy/Wrecked/Cooked tag, RPE ≥ 8, or "Check now" | `DashboardClient.tsx:8022–8027`, `SessionPopupInner.tsx:250–255`, `ManualRunModal.tsx:255–260`, `ReshapeScreen` (`manual: true`); ingest and `autoAnalyse.ts` never call the engine | ✅ true. Plus skip and reorder, which are runner-initiated |
| Low magnitude auto-applies silently, high becomes a tile + push | `adjust-plan/route.ts`: `auto_applied` → `recordNotification` only (title `BRAND.push.planAdjusted`); `pending` → `notifyUser` + inbox | ✅ true |
| Inline literals (RPE 8, trims 0.85, windows 4/10/4) | `planAdjustment.ts:199–201,376`; `adjustmentEngine.ts` `PRIOR_WEEKS_COUNT=4`, `RECENT_QUALITY_MAX=10`, `RECENT_LONG_RUN_MAX=4`; `loadCalc.ts` `slice(0,4)`; route `.limit(30)`/`.limit(10)` | ✅ true, and wider: **the client holds three copies of `>= 8` and three of `['Heavy','Wrecked','Cooked']`** (plus `TodayScreen`, `daily-coach-note`, `maintenance.ts`) beside `FATIGUE_HIGH_TAGS` |
| Shadow load fires on one week; `isShadowLoadTriggered` (2 weeks) exists | `planAdjustment.ts:290`; `loadCalc.ts:58` | ✅ true. `isShadowLoadTriggered` has **0 callers** |
| `LOAD_RATIO.flag` "2 consecutive weeks" not implemented | `constants.ts:174` | ✅ true, and **worse than unimplemented**: the builder's `requiresConfirmation: ratio >= flag` is **ignored** (ADR-012 §1: the magnitude rule is the only decision point), so `flag` decides nothing in the trigger path at all |

🔴 **Found while verifying, not in the brief: the runner-facing disclosure is false about this trigger.** `lib/coaching/watchedSignals.ts` (rendered by `PlanAdjustmentsScreen`) tells the runner the load trigger is **`1.4×`** and *"Two weeks running at that ratio, not one."* The engine acts at **1.3× on one week** and trims silently. Claim/computation mismatch, the `zona-debug` class.

🔴 **Also found: a no-change observation is announced as a change.** Every `auto_applied` row writes an inbox row titled *"Plan's been shifted."* `shadow_load` is `flag_for_review` with `sessionsAfter` byte-identical to `sessionsBefore`, and its own summary says *"Flagged, no auto-change applied."* — so the title and body contradict each other. A repeat `zone_drift` in the same week (notes already present, de-duped) does the same.

---

## 1. Measurement (production, read-only, aggregates only)

Scripts (throwaway, scratchpad, never committed):
```
NODE_PATH=node_modules NODE_ENV=production npx tsx <scratch>/boards/perRunBacktest.ts [--genuine] [--external] [--arrival]
NODE_PATH=node_modules NODE_ENV=production npx tsx <scratch>/boards/arrival.ts
```
`perRunBacktest.ts` replays each live `run_analysis` row (or, with `--arrival`, each arriving run in `strava_activities`) at its own `created_at = T`, truncating every input to what existed at T: analyses `created_at ≤ T` (route's 30), completions `updated_at ≤ T` with a tag or skip reason (route's 10), the activity log `created_at ≤ T` bucketed by the engine's own pure `bucketLoadByPlanWeek`. It calls the live `buildAdjustmentSignals` → `runAdjustmentEngine` (so magnitude, status and the §134 refusal are the real ones). Foundation weeks (`n ≤ 0`) are dropped so `weeks[n-1].n === n`, which sidesteps `ADJUST-WEEK-COORD-01` rather than reproducing it. `--genuine` drops analyses written more than 3 days after the run started (backfills). `--external` drops `is_internal`.

### 1a. The population is small, and most of the analysis table is a backfill

| | count |
|---|---|
| `user_settings` | 56 (18 `is_internal`; 22 with `timezone` UTC/unset; 0 with auto-adjust disabled) |
| live analysed runs replayed (all) | 112 events, 11 runners, 40 runner-weeks |
| of those, written > 3 days after the run | **94 of 112** (72 are one internal account's single-day backfill) |
| **genuine, external** | **17 analysed-run events, 6 runners, 10 runner-weeks** |

### 1b. If the engine ran after every analysed run (genuine, external)

| trigger | fires | runners | runner-weeks (of 10) | auto-applied | pending (push) | refused (§134) | repeat fire, same week |
|---|---|---|---|---|---|---|---|
| `zone_drift` | 8 | 4 | 5 | 8 | 0 | 0 | 3 |
| `acute_chronic_high` | 2 | 2 | 2 | 0 | 1 | 1 | 0 |
| `shadow_load` | 0 | | | | | | |
| `ef_decline` | 0 (inputs present on 6 events) | | | | | | |
| `fatigue_accumulation` | 0 (present on 7) | | | | | | |
| `long_run_shortfall` | 0 (present on 5) | | | | | | |
| `fitness_signal` | 0 (inputs present on 0, STARVED) | | | | | | |
| `readiness_signal` | 0 (UNFED: `buildAdjustmentSignals` never emits it) | | | | | | |
| **total, uncapped** | **10 = 0.59 per analysed run** | | | 8 | 1 | 1 | |
| **total, with `MAX_ADJUSTMENTS_PER_WEEK` = 2** | **8 = 0.47 per run** | | | 8 | **0** | | cap suppressed 1 |

- 🔴 **7 of the 8 `zone_drift` fires rest on ONE analysed run with ceiling data** in the week (`[1,1,1,1,1,1,2,1]`). Per run, the week's mean is one run.
- **Per run vs per week:** taking only the verdict on the last analysed run of each runner-week gives **6 verdicts on 10 runner-weeks** (4 drift, 2 load) against **10 per-run fires**. Per-run evaluation adds repeats, not detections.
- Fires per runner-week that fired, uncapped: `{1: 3, 2: 2, 3: 1}`.

### 1c. If the engine ran at ingest, before the arriving run is analysed (`--arrival --genuine --external`)

56 run arrivals, 17 runners, 22 runner-weeks → **12 fires (0.21 per run), all auto-applied, 0 pushes**: `zone_drift` 8 (2 runners, **5 repeats**), `shadow_load` 4 (1 runner, 2 repeats). Capped: 9. **11 of 12 fires come from two runners.** 🔴 **Every arrival-time `zone_drift` fire was decided by the PREVIOUS run's analysis** (the arriving run has none yet), so a runner who just ran easy would be told about the run before it.

### 1d. What actually fired (all time, `plan_adjustments`, incl. superseded)

27 rows, 5 runners: `session_reorder` 15, `zone_drift` 8 (5 auto, 3 reverted), `skip_with_reason` 3, `shadow_load` 1 (auto). Since 2026-10-01: 9 rows, 6 detected. Detected firings per runner-week: `{1: 3, 2: 3}`. `notifications` of type `plan_adjustment`: **5, ever**. So per-run evaluation would move this from "almost never" to roughly **one plan touch per analysed run in two**, on the thin population above.

### 1e. Runs, timing and channel

| | |
|---|---|
| unique runs (10-minute de-dup) | 544 from 27 runners (HK 496, manual 27, Strava 21) |
| arrival lag, end of run → row | ≤ 1 h **136** · 1–12 h **103** · 12–72 h **73** · > 72 h (backfill) **232** |
| genuine (≤ 72 h) | 312 runs; **44% arrive within an hour, 33% within 1–12 h, 23% the next day or later** |
| runs per active runner-week | **mean 2.62**; `{1:28, 2:30, 3:37, 4:11, 5:11, 6:1, 8:1}` over 119 runner-weeks (external 2.66) |
| local hour, 19 runners with a real zone (290 runs) | start `00–05:17 · 05–09:34 · 09–12:78 · 12–17:88 · 17–21:71 · 21–24:2`; arrival `00–05:5 · 05–09:24 · 09–12:54 · 12–17:118 · 17–21:64 · 21–24:25` → **30 of 290 (10.3%) arrive 21:00–05:00** |
| UTC/unset zone | 2 runners, 22 runs: their local hour is **not known** |
| channel (`health_sync_swept` since 10-07) | 32,343 sweeps, 7,283 posted ≥ 1 workout; known app state **hidden 3,399 vs visible 518 (87% hidden)**. 🔻 A per-run join found the carrying sweep for only 54 of 184 HK runs (46 of those carry no state), so **per-run channel is NOT measured**; the 87% is per sweep and sweeps repost |
| can be pushed | 16 of 21 runners with a genuine run hold an iOS push subscription (32 subs, all iOS) |
| tier now, runners with a genuine run in 60 days | 21: **13 paid/trial, 8 free** (3 internal) |

**Read:** a run mostly arrives while the app is backgrounded, so a prompt on arrival is a lock-screen push or nothing; a quarter of arrivals are next-day, so "you just ran" is false for them; one in ten lands at night.

---

## 2. Coaching Board — `TRIGGERS-ON-RUN-ARRIVAL-01`

**Trigger:** soft (`lib/coaching/*`), qualifies: moving evaluation from "when the runner reports cost" to "every run" changes how often the engine prescribes.
**Proposed change:** evaluate the automatic triggers when a run arrives, with thresholds and windows fit for a per-run cadence.

### 🔍 Conflict scan
§124 (*"a reshape must be rare"*, `MAX_ADJUSTMENTS_PER_WEEK`, EF window, Sims' clause) **governs directly**. §2 Am.4 clause 2 (an off-plan run never reaches the ratio) and Am.5 (shadow = observation, never a trim). §12 Am.1/2/5 (drift is directional, carries the ceiling, prescribed-day eligibility). §69 / ADR-012 (magnitude is the only confirmation decision). §59 (readiness is pre-session). §66 Am.1 (shortfall on the anchored axis). §109 Am.1 (`ZONE_BLOCK_VERDICT_MIN_RUNS` 3: a pattern needs three). §112 (fatigue window). §129 (`LOAD_RATIO` are description bands, not risk thresholds; *"flag is where that trim asks"*). §130 (`COACH_EASY_SHARE_MIN_RUNS` 2). 🔴 **§129 states `flag` asks; the code cannot ask at `flag`; `watchedSignals` says it takes two weeks.** Three statements, one rule, no two agree.

### 🏃 Hutchinson (chair)
The measurement answers the question the brief asked. Per run, the engine does not see more: it sees the same thing again. Six verdicts in ten weeks become ten fires, and seven of eight drift fires are one run. A reshape driven by one run is the thing §124 exists to forbid. On load, §129 already says these are description bands, and the predictive claims behind 1.3 have not survived re-analysis. I will accept acting on them only because the act is a 15% trim the runner can revert. The disclosure telling runners "1.4×, two weeks" while the engine trims at 1.3× in one is the most serious finding here, and it is not a threshold question.

### 📊 Seiler
Distribution is not in play. What is: a per-run zone-drift reading on one run is measurement, not behaviour. A hilly route, heat, a strap. §109 already set three runs as the floor for "how the block went". I want three here.

### 🎯 McMillan
Three runs is a Sunday-only trigger for a three-run runner (the median is 2.6 a week). The drift action is a note on the next easy run, not a trim. Two is enough for a note. On load: a runner who has a big week once is living their life. Asking them the second week at 1.4 is what I would do as a coach; trimming quietly at 1.3 the first week is fine because they never notice 15%.

### 🩹 Willy
Shadow load 15% over, two weeks running, is the commonest path into my clinic. One week is an observation and should stay one. Two consecutive weeks should be allowed to ask, not trim, which §2 Am.4 permits because asking is not silent. And readiness and fatigue must not run on arrival: neither has its input yet at that moment.

### ⚕️ Sims
Sims' clause in §124 binds harder per run: more fires means more chances to state a cause. No new surface may say why. EF decline is the trigger most entangled with low energy availability and it is the noisiest; it must not run per run.

### 💪 Blagrove
No objection from this seat.

### ⚡ Recorded disagreements
1. **Drift minimum evidence: Seiler 3 (consistency with §109) vs McMillan 2 (cadence, and the action is a note).** Chair rules **2**, because §130 uses 2 to *describe* a week and drift's act is a note. **What moves it:** the replay re-run on December's cohort; if more than a third of 2-run drift fires are contradicted by the week's third run, it becomes 3.
2. **Shadow two-week escalation (Willy) vs keep it an observation (Hutchinson).** INSUFFICIENT EVIDENCE: shadow has fired once in production and 0 times on genuine external analysed runs. **What settles it:** ≥ 10 runner-weeks of shadow firings with the following week's load. `isShadowLoadTriggered` is not doctrine and has no caller: delete it (⚙️ no board) rather than wire it.
3. **Whether the load trim should exist at all (Hutchinson) vs early action (Willy).** Not reopened; recorded.

### ⚖️ Ruling: CORRECT WITH AMENDMENT (§124 Amendment 1)
1. **The evaluation event is `run_analysed`, never raw ingest.** Arrival-time evaluation judges the previous run (1c). A runner with no analysis (free, or a manual log) is evaluated on `run_logged` for the **activity-log triggers only** (`shadow_load`; `acute_chronic_high` reads linked km and is meaningless without linking).
2. **Which triggers run on `run_analysed`:**

   | trigger | on `run_analysed`? | condition added |
   |---|---|---|
   | `long_run_shortfall` | ✅ only when the analysed run is the week's long run | none (already consecutive) |
   | `fitness_signal` | ✅ only when the analysed run is a quality session | none |
   | `zone_drift` | ✅ | **≥ `ZONE_DRIFT_MIN_RUNS` (2) drift-eligible runs with ceiling data in the week** |
   | `shadow_load` | ✅ (and on `run_logged`) | observation only, unchanged (§2 Am.5) |
   | `acute_chronic_high` | ✅ | trims silently at `watch` on one week; **asks** only when the ratio is ≥ `flag` this week **and** the prior week (`LOAD_RATIO_FLAG_CONSECUTIVE_WEEKS` 2), as an always-high case in `computeReshapeMagnitude` (an ADR-012 §2 row) |
   | `ef_decline` | ❌ **week close only**: evaluated once on the closed week, needing ≥ `EF_DECLINE_MIN_RUNS` (2) runs with an EF trend | §124, §108, Sims |
   | `fatigue_accumulation`, RPE disconnect | ❌ **never on arrival**: their input is the runner's report, which comes after; they stay on `fatigue_reported` / RPE log | |
   | `readiness_signal` | ❌ **never on arrival**: pre-session (§59) | |
3. **One firing per trigger type per runner-week** (`TRIGGER_FIRES_PER_TYPE_PER_WEEK` 1), except the load escalation in row 5. A proposal whose diff is empty and which is not an observation trigger is not an adjustment and writes nothing. Measured repeats: 3 of 8 (analysis), 5 of 8 (arrival).
4. **`MAX_ADJUSTMENTS_PER_WEEK` stays 2** (§124, unchanged).
5. **The disclosure is wrong, not the engine** (meaning ruled here; words → 👤 founder): it must say the load trim happens at `watch` in one week and asks at `flag` two weeks running, once row 5 is built. Until then it must not say *"two weeks"*. **This is a live defect fix (claim/computation mismatch, ⚙️ no board for the fix) and can ship before B3.**
6. **Inline literals move into one catalogue in `GENERATION_CONFIG.ADJUSTMENT_TRIGGERS`** (not `lib/coaching/constants.ts`, which `configPrincipleSync` and the coaching guard cannot see; the `peakKmByLevel` lesson), re-exported by `constants.ts` as `READINESS` already is:

   | new key | value | replaces | principle |
   |---|---|---|---|
   | `LOAD_TRIM_PCT` | 0.85 | `planAdjustment.ts:376` | §69 table already cites it |
   | `LOAD_RATIO_CHRONIC_WEEKS` | 4 | `PRIOR_WEEKS_COUNT`, `loadCalc` `slice(0,4)` | §129 (four windows) |
   | `LOAD_RATIO_FLAG_CONSECUTIVE_WEEKS` | 2 | (unimplemented) | §124 Am.1 |
   | `RPE_DISCONNECT_MIN` | 8 | `RPE_DISCONNECT_THRESHOLD` + 3 client `>= 8` | §124 Am.1 (owed: no § explains 8) |
   | `SKIP_INJURY_TRIM_PCT` | 0.85 | `SKIP_INJURY_VOLUME_REDUCTION` | **no principle found: debt, filed** |
   | `ZONE_DRIFT_MIN_RUNS` | 2 | new | §124 Am.1 |
   | `EF_DECLINE_MIN_RUNS` | 2 | new | §124 Am.1 |
   | `TRIGGER_FIRES_PER_TYPE_PER_WEEK` | 1 | new | §124 Am.1 |
   | `FITNESS_SIGNAL_WINDOW` | 10 | `RECENT_QUALITY_MAX` | ENGINE-01 § (owed) |
   | `LONG_RUN_SHORTFALL_WINDOW` | 4 | `RECENT_LONG_RUN_MAX` | §66 |

   **Exempt as structural** (tunability test): the route's fetch bounds (30, 10) and the `coach_notes` `slice(-3)` (a three-note type). The client stops holding the tag list and the RPE number: under `ARCH-ENG-018` the server evaluates on the completion write.

### 📦 Required artifacts (owed to B3; one commit)
1. **Principle:** `CoachingPrinciples.md §124 Amendment 1 — when the engine looks` (the table in ruling 2, rulings 1, 3, 5, the literal table).
2. **Numeric:** `GENERATION_CONFIG.ADJUSTMENT_TRIGGERS` (keys above), each with a principle row so `configPrincipleSync` passes without a baseline entry.
3. **Mechanical check:** not a `validatePlan()` invariant, because it governs **when the engine acts**, not plan shape (precedent §129). Instead `lib/coaching/triggerCatalogue.test.ts`: every catalogue entry declares `evaluateOn` from a closed set; `readiness_signal`, `fatigue_accumulation` and RPE disconnect are never on `run_analysed`; `zone_drift` returns null below `ZONE_DRIFT_MIN_RUNS`; a second same-type fire in a week returns null; `ef_decline` is unreachable from `run_analysed`; a literal sweep over the builders finds no bare coaching numeric. Plus `--per-run` folded into `scripts/backtest-adjustment-triggers.ts` (this sitting's harness) as the measurement gate. **Falsify each arm before trusting it.**

### ↗️ SLT escalation
Yes, two: (a) the moment's tier, (b) build order inside the freeze.

---

## 3. Design Board — `TRIGGERS-ON-RUN-ARRIVAL-01`

**Trigger:** hard (a new screen state on post-run, a new delivery rule).
**Change:** what the runner sees and hears when a run arrives and a trigger fires.
**Tier:** PAID (the reshape); a FREE observation is the SLT's (§4).

### 🔍 Settled-ground scan
- **ADR-012 / §69 + `RESHAPE-FIX-WAVE3-PHASE2` NOTIF quietness:** auto-applies do not push; the inbox row and the Me *"Changed this week"* audit row (ui-patterns § 10c) are how a silent change stays discoverable. **Upheld.**
- **`screen-architecture.md` Today:** *"Pending adjustment banner (affects today)"* belongs on Today. **Upheld; the tile stays on Today.**
- **`SESSION-LOGGED-HERO-01` (2026-10-22):** post-run order is *how did it feel → card → …*. **Not reversed; the new line goes last.**
- **POST-RUN-01 link push:** exactly one push per linked run (`claimAutoLink`), and the habit rule not to re-trigger the post-run loop. **Extended, not reversed.**
- **`THRESHOLD-BAND-ANCHOR-01`:** a plan-change notice reuses `PendingAdjustmentBanner`; do not author a new screen. **Applied.**
- **`ux-principles` "Calm guidance, not alerts":** *"the user decides when to act."* **Governs.**
- **Precedent (not a ruling):** `ACT-EMAIL-POSTTRIAL-01` quiet hours, and its trap: a quiet-hours guard on a sender that does not run again is suppression, not deferral.
- Token layer: nothing new; no colour, no type change.

### 📐 Evidence
§1 above, all on production via read-only scripts. **Not measured:** per-run app state (join failed), how a lock-screen line reads on a device (nothing has been seen on a device), whether runners open post-run before analysis completes.

### 🧭 Zhuo (chair)
The decision is not "push or not". It is: **one run, one moment.** We already send one push per linked run and take the runner to post-run. A second push seconds later about the same run is two moments competing for one. The success condition, stated before the design: **no runner receives more than one push per run, and no more than one plan-change push per week; a pending change is seen on Today within a day of the run.** Observable from `notifications` and `plan_adjustments`.

### ✋ Silvanto
Now before over time. Post-run is *how did this run go*. A plan change is the next days. It goes **beneath**, as one line, quieter than the card. The decision itself lives on Today, which is the screen about the days ahead. And I will not have a *"Plan's been shifted."* row for a change that did not happen. That is the screen lying in its quietest voice.

### 🎓 Sierra
The one thing this moment can do that nothing else can is connect **this run** to **this change**. That is perceptual expertise: the runner learns what drift feels like because the plan answered it the same afternoon. So the post-run line must name the cause in the run's terms. But measured, a quarter of runs arrive the next day; the line must never say "just now".

### 📱 Wroblewski
The run arrives while the app is closed 87% of the time by sweep. So the push is the only channel at the moment, and we already spend it on the link. Taps: link push → post-run → RPE → card → one line → Today banner → confirm. If the confirm sits inside post-run it saves one tap and makes post-run a two-job screen. I want it inside. And at night: 10% arrive after 21:00. Do not push then. Do not defer either: a deferral needs a sender that runs again, and a morning push about last night's run lands on top of the daily training push.

### 🎪 Collins
This is the thing a competitor selling encouragement cannot ship: **the plan answered your run.** One muted line at the bottom of post-run is being quiet because it is safe. I want a card.

### ⚡ Recorded disagreements
1. **Collins lost: a full post-run card.** The room's reason is Silvanto's horizon rule and one job per screen. **Not a rebuttal of his point.** Reopens on a device test where the line goes unseen.
2. **Wroblewski lost: confirm inside post-run.** One tap saved against a second job on the screen. Reopens if Today-banner confirmation within 24 h is under half of pending changes.
3. **Sierra vs Silvanto on prominence:** settled as "one line, last, naming the cause". 

### ⛔ Veto check
Silvanto: none. No palette or type regression.

### ⚖️ Ruling: SHIP WITH AMENDMENT
1. **One push per run, ever.** A trigger fired by `run_analysed` never sends its own push when that run's link push has been sent. The pending change appears on **Today** (existing `PendingAdjustmentBanner`) and as **one line at the end of post-run** naming the cause in the run's terms, linking to Today. No AIMark on the line (rule-engine); the existing AI explanation keeps its own.
2. **`planNeedsReview` push only when no link push went for that run** (manual log, medium-confidence match), and **at most one adjustment push per runner per week** (`ADJUSTMENT_PUSH_MAX_PER_WEEK` 1).
3. **Quiet hours 21:00–07:00 local: drop, do not defer.** The change waits on Today and in the inbox. An unknown or UTC-default zone uses the UTC window (the email precedent; `ARCH-ENG-019` flags it `unknown`) and the drop is logged.
4. **Auto-applied (low) stays silent** (ADR-012): inbox + Me audit row. **An observation with no change writes no "Plan's been shifted." row.** Its only surfaces are the observation line on post-run/Today and the coach note itself. The replacement wording → 👤 founder.
5. **Never a modal**; never "just now"; no streak, count or badge on the bell (NOTIF-01, unchanged).

### 📦 Required artifacts
1. **Pattern:** `ui-patterns.md` § 10d *Run-arrival plan line* (post-run, last; both states) and `ux-principles.md` § Notification budget (one per run, one adjustment push a week, quiet hours drop).
2. **Constant:** `lib/notifications/budget.ts → NOTIFICATION_BUDGET { PUSHES_PER_RUN: 1, ADJUSTMENT_PUSH_MAX_PER_WEEK: 1, QUIET_FROM: 21, QUIET_UNTIL: 7 }`, reusing `localHourIn` (lifted out of `lib/email/trialEmailWindow.ts` to one time owner, not copied).
3. **Mechanical check:** a pure `decideAdjustmentDelivery({ status, diffEmpty, linkPushSentForRun, localHour, tzKnown, adjustmentPushesThisWeek })` → `push | inbox | today_only | none`, tested both directions (`adjustmentDelivery.test.ts`), plus a gate that no adjustment path calls `notifyUser`/`recordNotification` except through it, plus a post-run markup test for the line. Falsified before trusted.
4. **Register row:** §6b below.

### 🖼️ Mockups owed to the founder (before build)
1. **Post-run, end of screen:** the plan line, pending state.
2. **Post-run:** the plan line, auto-applied state (the note already on the next easy run).
3. **Post-run / Today:** the shadow-load observation state, which today renders as *"Plan's been shifted."* (wording owed).
4. **Today:** the pending banner after a run-arrival trigger, including the runner who never opened post-run.
5. **Lock screen + inbox:** the one case a `planNeedsReview` push still fires (manual log), and the quiet-hours case (no push, inbox row only).

### ↗️ Routing
SLT: tier of the moment, and the build order. Coaching meaning settled in §2.

### 🚨 MUST/NEVER
No modal ✅. No em dash in runner copy (new strings to be checked by `noEmDashApp.test.ts`, which does **not** see `lib/coaching/` strings: the engine summaries are outside its population, `BRAND-EMDASH-LIB-01`) ✅. No gamification ✅. Brand strings via `BRAND.push` ✅.

### ⚠️ What this ruling does not settle
How any of it feels on a device; whether runners reach post-run before the analysis finishes (if not, the line is never seen and Today carries it alone); the wording.

---

## 4. SLT — `TRIGGERS-ON-RUN-ARRIVAL-01`

**One-line brief:** evaluate the reshape triggers when a run is analysed, and deliver the result inside the existing post-run moment.
**Tier:** **PAID** (`dynamic_reshape_r20`) for the reshape. **FREE** for one observation (below).
**Registry check:** R20 triggers exist (`feature-registry.md`, PAID); evaluation on arrival does not.

### 🧠 Sutherland
The curiosity push, *"Kit noticed something."*, is the only adjustment message that gets opened. Folding it into the link push spends that. I would keep it. (Lost to the push budget; recorded.)

### 📦 Fried
The data says this fires on one run in two for six people. Build it inside B4b, not beside it, and do not build a free trigger engine. One shared evaluator, two outputs.

### 🏃 Hutchinson
Coaching settled downstairs. The disclosure fix ships now; nothing else is a hotfix.

### 🔬 Wood
Free runners are the ones with no feedback loop at all: their runs land, nothing links, nothing speaks. A single factual line when the week runs 15% over plan changes the context without a reward. That is habit, not engagement. Free.

### 🧭 Zhuo
Agree with Wood, on one condition: it reuses the post-run/Today line, no push, no AI, no change to the plan. Richness gated, access not.

### ⚡ Conflicts
Fried (no free form) vs Wood/Zhuo (one free observation). Sutherland (keep the curiosity push) vs Design Board (one push per run). ⚠️ **No seat prices conversion or churn** (Traynor stood down): whether the free observation pulls runners to paid is unpriced.

### ✅ Recommendation: BUILD DIFFERENTLY, inside ADR-027
- **Free:** the `shadow_load` observation only (the only activity-log trigger that is meaningful without linking: free runs are never auto-linked, so their `linkedKm` is 0), on `run_logged`, as a line on Today. No push, no reshape, no AI. Built **after** the paid path, on the same evaluator.
- **Paid:** everything in §2 and §3.
- **Build order:**
  0. **Now (no freeze conflict):** the `watchedSignals` disclosure fix (⚙️, words 👤). `isShadowLoadTriggered` deletion (⚙️).
  1. **Hotfix 5 `ADJUST-WEEK-COORD-01` first.** Per-run evaluation multiplies firings, and on 7 of 43 plans they land three weeks late.
  2. **B2:** `assembleRunnerFacts` with the timezone owner (`ARCH-ENG-019`); quiet hours depend on it.
  3. **B3:** the trigger catalogue as L2 data with `evaluateOn` and the `ADJUSTMENT_TRIGGERS` keys, landing the §124 Am.1 artifacts.
  4. **B4b step 1 (B7 brought forward):** the one server writer. A server-side auto-apply fired from analysis races the browser's whole-row save (`ARCH-ENG-016`).
  5. **B4b step 2:** adjustments as the `run_analysed` / `run_logged` event; `decideAdjustmentDelivery`; the post-run line (after the founder approves the mockups).
  6. **Then** the free observation.
  - ⚠️ ADR-027's event list has `run_logged` but no `run_analysed`; the catalogue needs it (architecture amendment, ⚙️).

### 🚨 MUST/NEVER
Free users not abandoned ✅ (access to plan and log unchanged; one observation added). No AI call from the client ✅ (evaluation moves server-side). Single ingestion gateway untouched ✅ (evaluation reads, never writes `strava_activities`). No notification pressure ✅ (budget caps it).

### ⚠️ Risks to existing features
POST-RUN-01/02 link push and post-run order; `PendingAdjustmentBanner` on Today; `PlanAdjustmentsScreen` disclosure; the Me audit row (10c); `MAX_ADJUSTMENTS_PER_WEEK` now reached more often; `adjust-plan` remains for Check now, skip and reorder.

---

## 5. What this does not prove
- **Population:** 17 genuine analysed-run events from 6 external runners, 10 runner-weeks. Every rate here is a description of six people, not a frequency. Three triggers (`fitness_signal`, `readiness_signal`, and in this population `shadow_load` on analysed runs) produced no evidence at all.
- **Replay fidelity:** the plan is the CURRENT `plan_json`, already carrying earlier adjustments and rebuilds, so a repeat `zone_drift` may be a no-op against notes that are already there. Completion tags use `updated_at ≤ T`, an approximation of when the tag existed. Foundation-week runs (4) and plans whose race weeks do not index from 1 were skipped. Tier at the time of each run is not reconstructed; the route's tier gate and opt-out were not replayed (0 runners have opted out).
- **Correctness:** nothing here says whether any firing was **right**.
- **Channel:** per-run app state was not measured (54 of 184 joined); the 87% hidden is per sweep.
- **Local hour:** 22 of 56 accounts carry a UTC or unset zone; 2 of the runners with genuine runs are among them and their hours are unknown.
- **Falsification:** none of the proposed checks exists yet, so none has been falsified. The backtest itself was checked only by reproducing the known shapes (`readiness` UNFED, `fitness` STARVED, the 72-row backfill) that `TRIGGER-BACKTEST-02` recorded.

---

## 6. Register text (to append at build, not written here)

### 6a. `coaching-rulings.md`

```
## 2026-11-21 — TRIGGERS-ON-RUN-ARRIVAL-01 · CORRECT WITH AMENDMENT (§124 Am.1). The engine looks when a run is analysed, never at raw ingest, and a single run is not a pattern

ADR-027 `ARCH-ENG-018` moves trigger evaluation onto data arrival. **Measured first** (production replay at each
analysis's own `created_at`, genuine and external: 17 events, 6 runners, 10 runner-weeks): per-run evaluation gives
**10 fires (0.59 per run)** against **6 per-week verdicts**; **7 of 8 `zone_drift` fires rest on one run**; 3 are
repeats in the same week. At raw ingest every `zone_drift` fire was decided by the PREVIOUS run's analysis.
**Ruled:** evaluate on `run_analysed` (free/manual: `run_logged`, `shadow_load` only); `zone_drift` needs
`ZONE_DRIFT_MIN_RUNS` (2); `ef_decline` at week close with `EF_DECLINE_MIN_RUNS` (2); fatigue, RPE and readiness never on
arrival; one fire per trigger type per week; the load trim stays silent at `watch` on one week and ASKS at `flag` two weeks
running (an ADR-012 always-high row). 🔴 **`watchedSignals` tells runners "1.4×, two weeks" while the engine trims at
1.3× in one: the disclosure is wrong, fixed now as a defect.** Literals move into `GENERATION_CONFIG.ADJUSTMENT_TRIGGERS`;
`SKIP_INJURY_TRIM_PCT` has no principle (debt). ⚡ Seiler 3 vs McMillan 2 on drift (chair: 2); Willy's two-week shadow
escalation INSUFFICIENT EVIDENCE (≥10 shadow runner-weeks). Not a `validatePlan()` invariant: it governs when the engine
acts (precedent §129); `triggerCatalogue.test.ts`. **Nothing built (ADR-027 freeze); owed to B3.** Sitting:
`docs/decisions/boards-2026-11-21-triggers-on-run-arrival.md`.
```

### 6b. `design-rulings.md`

```
## 2026-11-21 — `TRIGGERS-ON-RUN-ARRIVAL-01` · 🟢 SHIP WITH AMENDMENT. One run, one moment: a plan change rides the post-run push, it never adds one

| Ruling | |
|---|---|
| **One push per run, ever; a trigger fired by the run's analysis sends no push of its own when the link push went** | 🟢 **SHIP** |
| **The pending change lives on Today (`PendingAdjustmentBanner`); post-run carries one line, last, naming the cause** | 🟢 **SHIP WITH AMENDMENT** — never "just now": 23% of runs arrive the next day |
| **At most one adjustment push per runner per week; none 21:00–07:00 local, dropped not deferred** | 🟢 **SHIP** — 10.3% of arrivals land at night; deferral needs a sender that runs again (the email trap) |
| **An observation that changes nothing writes no "Plan's been shifted." row** | 🟢 **SHIP** — wording → founder |
| **A full post-run card (Collins)** | 🔴 **LOST** — horizon rule and one job per screen; reopens on a device test where the line goes unseen |
| **Confirm inside post-run (Wroblewski)** | 🔴 **LOST** — reopens if under half of pending changes are confirmed on Today within 24 h |

Measured on production (read-only): 87% of posting sweeps run with the app hidden (per sweep; per-run not measured);
2.62 runs per active runner-week; 16 of 21 recent runners can be pushed. Constant `NOTIFICATION_BUDGET`; check
`adjustmentDelivery.test.ts` (to be falsified before trusted). Mockups owed: post-run line ×3 states, Today banner,
lock screen/inbox. Note: `docs/decisions/boards-2026-11-21-triggers-on-run-arrival.md`. Not felt on a device.
```
