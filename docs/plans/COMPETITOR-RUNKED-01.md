# Plan: responding to Runked (COMPETITOR-RUNKED-01)

**Input:** founder, 2026-10-30: *"I want you to get things documented in backlog and create a plan. Nothing gets built
without going to the relevant [board] and full analysis of our own app and comparative screens for cross over to ensure we
adapt and improve what we have, not duplicate if we already have something we can improve."*
Analysis: `docs/investigations/competitor-runked-2026-10-30.md`.

## The gate: every item passes it before any code

No item below is built until all five steps are written into its backlog entry or a linked decision note.

| # | Step | What it produces |
|---|---|---|
| 1 | **Our own surfaces, measured.** Every screen, component, route, engine function and published page that does any part of the job, found by search, not memory. For each: where it renders, who can reach it (tier), and what it actually computes | A crossover table naming files and screens |
| 2 | **Comparative screens, side by side.** Runked's screen (founder screenshots: we cannot install it) beside ours, captured from the preview pages or a device. Same job, same moment | Paired screenshots in the decision note |
| 3 | **Adapt, improve or new: decided and argued.** The default is **improve what we have**. A new surface needs a written reason why no existing one can carry the job | One line: *"extends X"* / *"replaces X"* / *"new, because…"* |
| 4 | **The relevant board rules**, in the order the item names: Coaching (meaning, claims, physiology), Design (what the runner sees, settled ground in `design-rulings.md`), SLT (tier, cost, order), founder (words, positioning) | A register row per ruling |
| 5 | **Only then `/build`**, with the ruling as its named input | The usual build, checks and records |

⚠️ **Why the gate is shaped like this:** this repo's most expensive defects are duplicates that drifted (TIER-OWNER-01,
OPS-AI-OWNER-01, DELOAD-OWNER-01), and a competitor screenshot is the most likely way to start one: it shows a finished
feature with no hint of what we already have. Step 1 is a **count from the code**, not a read of this plan, which will go
stale.

## The items, with the crossover found on 2026-10-30

| Item | Board order | What we already have (step 1, first pass) | Default |
|---|---|---|---|
| `RUNKED-LOAD-VIEW-01` a readable load picture | 🏃 Coaching → 🧭 Design → 💼 SLT | `LoadShape` on Coach (A5 2026-09-22: **"SHAPE, never SCORE"**, settled), `acuteChronicRatio` (km, 4-week), `LOAD_RATIO`, `TrendCard`, `ZoneWeekBlock`, `LedgerCard`. ⚠️ Off-plan runs reach load only if linked: 5 of 239 (`LOG-OFFPLAN-03`) | **Improve `LoadShape`**, after `LOG-OFFPLAN-03` |
| `RUNKED-COMPARE-PAGE-01` a page answering gamified apps | 🏃 Coaching (claims) → 👤 Founder (copy, naming a competitor) | The comparison series (7 live, page 8 pending), `ArticlePage`, `COMPETITOR_FACTS`, the price and claims gates | **A catalogue entry**; whether it is page 8 or 9 is the founder's |
| `RUNKED-GUIDES-01` easy-running guide series | 🏃 Coaching (each claim cites a principle) → 👤 Founder (reads) | Guide 1 `/guides/should-easy-runs-feel-this-slow`; page 6 `/why-your-easy-runs-arent-easy` (zone 2, talk test, HR limits) | **Extend and interlink**; no guide repeats page 6 |
| `RUNKED-EFFORT-MESSAGE-01` "effort, not pace" in our voice | 👤 Founder | Locked taglines in `lib/brand.ts`; voice in `brand.md` | **A line inside existing copy**, never a new tagline |
| `RUNKED-GARMIN-01` Garmin | 💼 SLT | Garmin runs already arrive through Apple Health (107 stored rows written by Garmin Connect) | **Measure first**: what a direct sync would add over HealthKit |

## Order

1. `RUNKED-LOAD-VIEW-01` is the one the founder asked for and the one most likely to be built twice. Its first step is the
   crossover and the screenshots, then the Coaching Board on **what the picture measures** (km against stress, the
   disputed ratio, and the off-plan runs it cannot see today), then the Design Board against A5.
2. `RUNKED-COMPARE-PAGE-01` and `RUNKED-GUIDES-01` follow the comparison cadence: Claude drafts, the founder edits and
   reads (SLT 2026-09-21).
3. `RUNKED-EFFORT-MESSAGE-01` and `RUNKED-GARMIN-01` wait for the founder and the SLT.

## Not in this plan

Ranks, streaks, chests, leaderboards, a mascot: they reward the behaviour Zonna exists to correct. Re-proposing one needs
named new evidence and the Design Board.
