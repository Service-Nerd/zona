# SLT: what direct Garmin sync would add (2026-11-20, RUNKED-GARMIN-01)

**Input:** founder, 2026-11-20: one relevant sitting per item. Item filed 2026-10-30 (Runked advertises Garmin sync).
Its own default: **measure first** what a direct Garmin API would add over HealthKit (workout export, HR streams,
non-iPhone users) before anyone sizes it. ADR-011 makes HealthKit the system of record.

**One-line brief:** Garmin runs already reach us through Apple Health; is a direct Garmin integration worth building?
**Tier:** would be PAID if built (integrations are PAID per the Feature Tagging table); not built.

## Analysis, before any seat spoke

Evidence script (read-only, selects only): `scripts/board-evidence-runked-garmin-01.ts`
(`npx tsx scripts/board-evidence-runked-garmin-01.ts`). Production, 2026-11-20.

| Item says (2026-10-30) | Re-measured 2026-11-20 |
|---|---|
| 107 stored rows written by Garmin Connect, named `Run (Connect)` | **178 rows, 9 runners.** The name count is now **103** and frozen: since ACTIVITY-NAME-WRITER-01 (2026-10-08) every HealthKit row is named `Run`, so the name **stopped recording the writer app** and undercounts. The writer survives in `raw_payload.sourceName` (`Connect` on 56 of 225 rows since 10-08) |
| (implicit) Garmin is a meaningful share | **9 of 26 runners with HealthKit rows** (27 with any activity; 56 auth users). **6 of the 9 ran since 2026-10-21.** Garmin is the single largest writer app: 178 of 518 HealthKit rows (34%) |

**What a Garmin-written HealthKit row carries, against other writers:**

| | Garmin (`Connect`) | Apple Watch writers (each) |
|---|---|---|
| `avg_hr` present | **171 / 178 (96%)** | 100% on most |
| HR zone split (`hr_pct_z2`) present (name-matched 103) | 97 / 103 (94%) | n/a (all-HealthKit 381 / 518, 74%) |
| **median HR samples per run** | **21** | **~330 to ~810** |
| elevation gain | 0 / 103 | all HealthKit rows **3 / 518** |
| per-km splits | 0 / 103 | all HealthKit rows **3 / 518** |

So the one gap that is **Garmin's**, measured: Garmin Connect writes a **sparse HR series** into Apple Health (median
21 samples a run against hundreds from a Watch). Summary HR is there. Elevation and splits are missing for **every**
writer, Apple Watch included, so that is our ingest, not Garmin, and a Garmin API would not be the fix for it.

**Non-iPhone demand: none found.** Push registrations: **27 users, all `ios`**. `waitlist`: **0 rows**. No feedback
table exists to search. Runked itself is iPhone-only. Nothing measured says a non-iPhone runner is waiting.

**Ingest friction already fixed:** 6 `health_ingest_rejected` events, all `source_name: Connect` (zero-distance
treadmill runs), the HK-ZERO-DISTANCE-RUN-01 class, fixed 2026-10-08.

**Not measured:** whether 21 samples a run changes any verdict the engine or analysis gives (in-zone %, HR drift for the
reframe risk gate); the cost of Garmin's developer-programme approval and integration; Garmin fields beyond HR
(cadence, power, running dynamics), since HealthKit's plugin does not carry those for any writer (CLAUDE.md, ADR-011).

## The board

🧠 **Sutherland.** Runked advertising Garmin sync is a badge on the box. Our Garmin runners already arrive; a third of
the run log is theirs and they did nothing to make it happen. The best integration is the one the user never notices
they needed. Building a second front door for people already inside is reassurance theatre.

📦 **Fried.** Nine runners, all already syncing, nobody waiting at a non-iPhone door. An integration is a permanent
maintenance commitment, a second ingestion path ADR-011 and INV-DATA-008 would both have to be amended for, and an
external approval process we have not even priced. No. Not now. Fix what is ours: elevation and splits are missing for
everybody.

🏃 **Hutchinson.** The 21 samples are the only real finding, and it is a coaching question, not a sync question. A zone
split from 21 points across a 40-minute run is coarse; an HR-drift figure from it may be noise. Before anyone sizes an
API to get the full stream, someone should ask whether the coarse stream changes a verdict the runner sees. If it does
not, the API buys precision nobody reads.

🔬 **Wood.** Nothing in this changes behaviour. The runner's behaviour, finishing a run on the watch, already produces
the data with zero extra steps. That is the ideal habit structure, and a direct integration would add a connection step
to fix a problem the runner does not have.

🧭 **Zhuo.** The item asked a question and the measurement answered it: what a direct API would add is **HR resolution
for nine runners**, and nothing for non-iPhone users because there are none on record. That is not a feature brief.

## Conflicts

None on the verdict. **Hutchinson and Fried disagree on what the open thread is:** Fried names our own missing
elevation/splits; Hutchinson names whether sparse Garmin HR degrades a verdict. Both are outside this item and are
recorded below as observations, not filed.

## Ruling

**DON'T BUILD (direct Garmin sync), on the measurement.** HealthKit already brings Garmin runs for 9 runners (178 rows,
96% with summary HR). The only Garmin-specific gap is HR sample density (median 21 per run). No non-iPhone demand exists
in any table.

**Re-open triggers** (any one): (a) a measurement shows Garmin's sparse HR changes a runner-visible verdict
(in-zone %, drift, risk gate), which is a Coaching Board measurement; (b) evidence of non-iPhone runners asking for
access; (c) Traynor's recall trigger is met and Garmin owners are shown to convert or churn differently.

**Hand-offs:** none required. Re-open (a) would go to the 🏃 Coaching Board first.

## MUST/NEVER check
The ruling keeps ADR-011 intact (HealthKit SOR, single ingestion gateway INV-DATA-008). Nothing proposed.

## Risks to existing features
None. ⚠️ Note for whoever measures Garmin next: **count by `raw_payload->>'sourceName'`, not by `name`**; the name has
said `Run` for every HealthKit row since 2026-10-08.

## What this does not prove
That sparse HR is harmless (not measured). The cost of a Garmin integration (not measured). Demand from people who
never signed up because they have no iPhone (unobservable from our tables).
