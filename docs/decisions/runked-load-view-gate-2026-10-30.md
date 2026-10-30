# RUNKED-LOAD-VIEW-01: the gate, steps 1–3 (2026-10-30)

Plan: `docs/plans/COMPETITOR-RUNKED-01.md`. Founder: *"yes"* to starting the gate. **No board has sat yet; nothing is
built.** Step 2 still needs Runked's other screens (below).

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

**Runked:** one screenshot so far (Fitness 58 ▲10, Fatigue 36 ▲9, the dual-line chart, the coloured scale, "Solid").
**Needed from the founder:** their Fatigue view, Training Balance, Load Ratio, the scale's full list of bands, and the
screen a runner lands on from Today, so the comparison is screen for screen.

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

## Next (step 4, in order)

🏃 Coaching Board: what the picture measures (linked vs total km, km vs a stress score, the disputed ratio) and why
reports are rare → 🧭 Design Board: the trajectory against A5 → 💼 SLT: tier and reach (Coach is paid). Then `/build`.
