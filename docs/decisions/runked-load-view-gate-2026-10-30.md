# RUNKED-LOAD-VIEW-01: the gate, steps 1–3 (2026-10-30)

Plan: `docs/plans/COMPETITOR-RUNKED-01.md`. Founder: *"yes"* to starting the gate. **No board has sat yet; nothing is
built.** Steps 1–3 are done; step 2 closed on the eight App Store screenshots, which are all there is (below).

## Step 1: our own surfaces that do any part of this job (counted from the code)

| Surface | Where / who sees it | What it actually computes | Note |
|---|---|---|---|
| **`LoadShape`** (`components/shared/LoadShape.tsx`) | Coach, *"This week's load"* tile; paid (`activity_intelligence`) | This week vs the runner's 4-week average, from `weekly_reports.acute_chronic_ratio`, drawn as a marker on a band (`LOAD_RATIO.under`…`watch`) | **A5 (Design Board 2026-09-22): "SHAPE, never SCORE"**. Settled ground: a Runked-style "58 · Solid" reverses it |
| `acuteChronicRatio` (`lib/coaching/loadCalc.ts`) | Weekly report, plan adjustment | **km**, this week over the mean of up to 4 prior weeks; no stress weighting, no 42/7-day decay | Fed by `weeklyActualLoad.linkedKm` |
| `weeklyActualLoad` (`lib/coaching/weeklyActualLoad.ts`) | Single owner of "how far in week N" | `linkedKm` (matched runs) and `offPlanKm`; **the ratio reads `linkedKm` only**, by Coaching Board choice (LOG-OFFPLAN-01) | 2026-09-27: 20.4% of km were off-plan; `LOG-OFFPLAN-03`: 5 of 239 activities linked |
| `TrendCard` | Coach + Today; paid | Avg HR on same-effort easy runs, then and now, with a sparkline | The nearest thing we have to a *fitness* line |
| `ZoneRings` | Coach, "this week in zones" | Share of the week in each zone | The *intensity* half; Runked has none |
| `ZoneWeekBlock` | Plan, *"This week"* | Runs that held the zone, in words | |
| `LedgerCard` | Me | Weeks within the lines | Discipline, not load |
| Readiness card (`readinessData`, `TdReadyHero`) | Today | HRV / resting HR against baseline (`/api/pre-session-readiness`) | The nearest thing we have to *fatigue* |
| `watchedSignals` | Plan checks (Me) | The 8 adjustment triggers with ratified thresholds | |

**Reach, measured in production (read-only, 2026-10-30):** in the last 56 days, **5 weekly reports for 2 runners**
(against 23 active subscriptions). `LoadShape` has had a value for **two people**.

## Step 2: comparative screens

**Ours** (rendered at phone width from real components, `docs/investigations/runked-load-view/`):
- `ours-coach-load-and-ledger.png`: the Coach load tile at no data / 0.70 / 1.00 / 1.35 / 1.60, and the ledger.
- `ours-coach-zonerings-trendcard.png`: zone rings and every `TrendCard` state.
- `ours-plan-zoneweekblock.png`: every `ZoneWeekBlock` sentence.
- Not captured: the Today readiness card (its preview needs a click; to add).

**Runked:** their eight App Store screenshots, which are all the founder has (2026-10-30: *"these are the only screen
shots i have"*). Saved as `runked-appstore-1-5.webp` and `runked-appstore-6-8.png`. **Step 2 closes on these.**

| What the set shows for this item | What it does not show |
|---|---|
| One screen, *"train hard. rest smart."*: Fitness 58 ▲10 and Fatigue 36 ▲9 as two lines over ~6 weeks, a shaded "Solid" band behind them, a **six-colour** scale (grey, blue, green, yellow, orange, purple) with a marker, the number **58** and the word **Solid**, then band descriptions starting *"Starting: below 20. Early stage fitness. Consistency matters most here."* and a second cut off at *"Buildi…"* | Fatigue on its own, Training Balance, Load Ratio, the other band names and cut-offs, and how a runner reaches the screen. Their guide (`runked.com/guides/training-load-fitness-fatigue`) is the only source for those, and it gives windows, not a formula |

⚠️ **These are marketing images, not the app.** Each is a chosen frame with a headline over it. The boards rule on what
the screen claims to show, not on how it behaves.

**Seen in the same set, outside this item (crossover noted, nothing filed; each checked against the code):**

| Theirs | Ours, verified 2026-10-30 |
|---|---|
| A session screen drawing each rep as a bar | ✅ **We already do this.** `SessionSilhouette` (`SESSION-PRERUN-DETAIL-01`, shipped 2026-10-22, FREE) draws every step as a bar, width by minutes and height by zone, under *Session structure* on Session Detail. ⚠️ **I first wrote "we show rep structure, just not as bars". That was wrong, and the founder caught it** |
| An Apple Watch workout | None: `ios/App` has no watch target and no `WorkoutKit`/`HKWorkoutSession` code |
| A plan week list | Plan's week strip and session rows |
| "Runner DNA", a six-axis radar | No equivalent |
| Ranks, trophies, streaks, chests | Out of scope by the plan |

**Reach and linkage, re-measured in production 2026-10-30 (read-only, last 56 days):**

| | Figure |
|---|---|
| Runs logged | **334 runs, 1,777 km, 24 runners** |
| Runs matched to a session (`run_analysis`, live) | **8 runs, 78.5 km, 3 runners** by an activity join; 21 analyses, 92.5 km, 5 runners counted from `run_analysis` itself (3 carry no activity id, so the join cannot see them) |
| Share of distance the ratio can see | **about 4–5%** |
| Weekly reports with a ratio | **5, for 2 runners** |

⚠️ **This replaces "5 of 239", a figure from 6 October counted against session completions, not the `run_analysis`
match the ratio actually reads (`weeklyActualLoad.linkedKm`).** Same conclusion, measured the right way.

## Step 3: adapt, improve or new (provisional, for the boards)

**Extends `LoadShape`; not a new screen.** What Runked's chart has that ours lacks is **time**: ours is one week
against a band, theirs is weeks of fitness and fatigue as lines. The improvement to put to the boards is the
**trajectory** (how the week has moved against the runner's normal over the block), in our shape language.

**Before any of that, three findings the boards must see:**
1. **Reach.** Two runners have ever seen it. A better picture nobody reaches is decoration. Why weekly reports are so
   rare comes first.
2. **What it counts.** Linked km only, while most runs are not linked (`LOG-OFFPLAN-03`). A trajectory drawn from
   that would show an off-plan runner as fresher than they are: Coaching Board, before the picture.
3. **A colour defect.** At ≥ `LOAD_RATIO.watch` (1.3) the verdict renders *"above your recent normal"* in
   `var(--danger)`, red, against *"No red in the training UI"* (`ux-principles.md`). Filed as `LOAD-VERDICT-RED-01`
   (a defect fix restoring a documented rule; no board). `loadRatioContext` is also private to `DashboardClient`, so
   no other surface can reuse the verdict.

## Step 4, Coaching Board (2026-10-30): CORRECT WITH AMENDMENT

Full sitting in `docs/canonical/coaching-rulings.md`. In one line each: measure **total** distance against the runner's
own recent weeks (the trim ratio stays linked-only and is never shown as "your load"); **no verdict without 3 of 4 prior
weeks**; describe, never predict (no injury risk, no Gabbett 1.5); no fitness score or "fatigue" from kilometres; a
planned easy week below normal is not a warning; a trajectory over the block is allowed. Found on the way: `LOAD_RATIO`
has no principle section, and 2 of 5 reports showed the no-history default as "right on your normal"
(`LOAD-SHAPE-NO-HISTORY-01`).

## Next (step 4, in order)

🏃 Coaching Board: what the picture measures (linked vs total km, km vs a stress score, the disputed ratio) and why
reports are rare → 🧭 Design Board: the trajectory against A5 → 💼 SLT: tier and reach (Coach is paid). Then `/build`.
