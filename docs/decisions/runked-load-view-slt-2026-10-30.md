# RUNKED-LOAD-VIEW-01: SLT sitting (2026-10-30)

**Brief:** the Coach load picture, as both boards ruled it today (total distance against the runner's own weeks, no
verdict without 3 of 4 prior weeks; `LoadShape` gains up to 8 weekly bars; under-normal neutral unless planned). The SLT
rules on tier, reach and order. Gate: `runked-load-view-gate-2026-10-30.md`.

**Tier: PAID** (stays on Coach, `activity_intelligence`). ⚠️ The registry row `APP-REVIEW-W4` tags A5 FREE because it
bundles A5 with A6 (Me) and A8 (Session Detail), which are free. A5 has only ever rendered inside the paid/trial Coach
screen (`DashboardClient.tsx`, `screen === 'coach' && (hasPaidAccess ? …`). A bundled record, not a leak; the row now
says so.

## Measured first (production, read-only, 56 days)

| | |
|---|---|
| Coach opened | **235 times by 18 people** (`analytics_events.coach_open`) |
| Of them, ever shown a load value | **2** (5 weekly reports) |
| Runners who logged runs | **24**: ~1 admin, 10 with an active subscription, up to 2 in a trial window (an approximation of `resolveTier`, not a call to it) |
| Share of logged distance the current ratio sees | **~4–5%** |

So the tile Coach users open most often says *"Not enough runs yet"* to nearly all of them, while they are running.
**The defect is reach, not looks.**

## The board

🧠 **Sutherland:** *"The valuable thing on this screen is permission: a week that is lighter on purpose, said by the app
that is supposed to want you to do more. A streak product cannot say it. I would give that sentence away free, because
the brand is the sentence. But I accept it sits on Coach, and I accept nobody here can price the conversion either way."*

📦 **Fried:** *"Eighteen people open this screen and two ever see the thing on it. That is the build. Switch the source,
let the tile show a real answer, then see if anyone needs eight bars. Do not build the pretty half first."*

🏃 **Hutchinson:** *"The Coaching Board already ruled the source: total distance. That also takes `LOG-OFFPLAN-03` off the
critical path, because the picture no longer needs runs to be linked. The trim trigger stays on linked distance."*

🔬 **Wood:** *"The verdict is the behaviour lever: one line, at the moment they open Coach. Eight bars of the past are
memory, and memory charts are where the illusion of progress lives, which is Runked's product. I will not kill the bars,
because the Design Board's version shows the planned dip and that is context, not reward. But they wait until the verdict
is reaching people. Measure that first."*

🧭 **Zhuo:** *"Two items, not one. The source switch plus the 3-of-4 rule plus the neutral colour is one afternoon and
fixes what most people see. The bars are a second build with a condition. Success for the first: most Coach openers who
have run for three weeks see a real verdict, not the empty state."*

## ⚡ Conflicts

- **Tier.** Sutherland would make the restraint sentence free; Fried, Wood and Zhuo keep Coach whole. **PAID stands.**
  Sutherland's dissent is recorded and returns when Traynor's recall data exists (no seat prices conversion today).
- **Order of the bars.** Sutherland wants them with step 1 (the planned dip is the signature); Wood and Fried want the
  verdict to reach people first. **Wood and Fried carry it.**

## ✅ Recommendation: build differently, in two steps

1. **`LOAD-SOURCE-TOTAL-01` (build now, PAID):** the tile reads total weekly distance from the activity log
   (`weeklyActualLoad.totalKm`), not `weekly_reports`; no verdict below 3 of 4 prior weeks
   (`LOAD_PICTURE_MIN_PRIOR_WEEKS`); the Design Board's colour scheme (under normal neutral unless planned; two unplanned
   low weeks amber); the Coaching Board's principle for `LOAD_RATIO` lands with it. The trim trigger is untouched.
2. **`RUNKED-LOAD-VIEW-01` bars (after step 1):** build when step 1 is live and **a majority of Coach openers with 3+
   weeks of runs see a real verdict** in production. Measured, not assumed.

🚨 **MUST/NEVER:** no streaks, scores or rewards; tokens only; no AI call; source-agnostic (the activity log, not a
source filter, ADR-011); no claim of injury prediction anywhere, marketing included.

⚠️ **Risks to existing features:** `weekly_reports.acute_chronic_ratio` and the report's AI prompt keep the linked ratio
(the report is the trigger's context); the tile and the report will then show different figures for the same week, by
design, and the tile must not be labelled as the report's number. `appReviewWave4.test.ts` and the `LoadShape` contract
change with step 1.
