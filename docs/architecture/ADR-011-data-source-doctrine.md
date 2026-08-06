# ADR-011 — Data Source Doctrine: System of Record and Source Priority

**Status**: Amended 2026-06-24  
**Date**: 2026-05-30 (original) · 2026-06-24 (amendment)  
**Releases**: Applied retroactively to all current integrations; governs all future data sources.

---

## Amendment Note (2026-06-24)

The original 2026-05-30 decision landed on **"co-equal"** — Strava and HealthKit as peer sources with Strava holding priority 1 on activity metadata. This was internally contradictory (§2 said "neither is primary" while §3 ranked Strava first) and has been superseded by practice.

The amended position:

- **HealthKit is the System of Record for all run-derived data on iOS.**
- **Strava is an optional supplement**, only when the user has connected it, and only as a patch to an existing HealthKit row. Strava never inserts a primary record.
- **Apps that write to Apple Health (Strava, Garmin, Wahoo, etc.) feed our SOR transitively** — we read from HealthKit, we don't reach back to the originating provider.
- **Strava API approval is still pending.** This doctrine is therefore both architectural preference and current operational reality.

Sections §2, §3, §4, §5, §Alternatives, and §New Architectural Invariants have been rewritten. The original sections §1, §6, §7, and §Gaps remain materially correct and are retained.

---

## Amendment Note (2026-07-30) — Manual entry realised (DS-06)

The §Gaps "manual run entry with distance + optional avg HR" near-term item shipped. A runner with no device (web/Android, or an iPhone-only runner with no Apple Watch / chest strap) can now hand-enter a run's distance, duration, and optional average HR. See §4b (manual insert path) and the updated §5 manual-only row. The `source='manual'` arm of the activity log — long documented in §2 — is now actually written.

---

## Context

Zonna ingests run data from two external sources today: **Strava** (OAuth webhook) and **Apple HealthKit** (Capacitor plugin on iOS). A third path — **manual completion** (RPE + fatigue tag only) — exists for users without any device integration.

During a data source audit (2026-05-30) we found:

1. The coaching engine is architecturally source-agnostic — both Strava and HealthKit activities flow through the same analysis pipeline and land in the same `strava_activities` table (a misnomer; the table is source-agnostic, see §Decision below).
2. Despite this, **Strava was treated operationally as the primary source and HealthKit as a fallback** — in onboarding messaging, empty states, and feature copy. This creates a false impression that Strava is required for paid value.
3. **No documented SOR** existed for each data type. When the same metric is available from multiple sources, there was no written rule for which wins.
4. On iOS with an Apple Watch, HealthKit provides equivalent run data to Strava (HR stream, distance, pace, duration, elevation). **There is no coaching feature that requires Strava when HealthKit HR data is present.** Strava is not a hard blocker for paid users.
5. The `distance` HealthKit permission is requested in auth but never queried as a standalone sample (distance comes from `HKWorkout.totalDistance`). This is wasted consent friction.

---

## Decision

### 1. No Single External Data Dependency for Core Paid Value

No paid feature may be gated on a specific external data provider. Features may degrade gracefully when data is absent — but the degradation must be:
- **Source-neutral**: the same degradation applies whether the missing data is Strava or HealthKit.
- **Visible**: the UI explains what's missing and how to get it, using source-agnostic language.
- **Never blocking**: paid users who choose not to connect any external provider must still receive meaningful coaching output at a reduced confidence level.

**HealthKit is the System of Record for run-derived data on iOS.** Strava is an optional supplement, available only when the user has connected it, and only as a patch onto an existing HealthKit row. Strava never inserts a primary record. If a Strava activity arrives and no matching HealthKit row exists, it is ignored — not stored.

Rationale:
- HealthKit is the single ingestion point for all device-sourced run data on iOS. Apps that write to Apple Health (Strava, Garmin, Wahoo, Polar, etc.) feed our SOR transitively. We read once, from one place.
- Strava API approval is not guaranteed. The product cannot architecturally depend on a provider whose access we don't fully control.
- This eliminates source-conflict logic on the read path. Coaching reads one row per run, source-tagged for provenance.

### 2. The Activity Log Is Source-Agnostic

The `strava_activities` table is **the canonical activity log for all run sessions regardless of source**. Its name is a misnomer inherited from v1 — it must be treated, documented, and queried as a source-agnostic store. The `source` column (`'strava' | 'apple_health' | 'manual'`) is the discriminator. All coaching logic reads from this table without source filtering unless source-specific behaviour is explicitly justified.

A future rename to `run_activities` or `activity_log` is a backlog item. Until then, all internal documentation refers to it as **the activity log**.

### 3. System of Record (SOR) by Data Type

| Data Type | System of Record | Source Priority | Notes |
|---|---|---|---|
| **Run session (distance, pace, duration)** | Activity log (`strava_activities`) | 1: HealthKit · 2: Manual entry · (Strava — supplement only) | A Strava webhook that finds no matching HK row is **discarded**, not stored |
| **HR stream (per-second or per-sample)** | Activity log | 1: HealthKit HR samples · 2: Absent · (Strava — supplement only when HK row exists and has no HR) | Strava does **not** push HR into HealthKit — iPhone-only runners (no Apple Watch / chest strap) have no HR stream available |
| **Average HR per run** | Activity log | 1: HealthKit average of HR samples · 2: Absent (75 neutral) · (Strava — supplement only) | |
| **HR-in-zone %** | `run_analysis` (computed) | Single path: `bucketHRSamples()` on HealthKit HR stream | Source-blind algorithm |
| **Aerobic efficiency (EF)** | `run_analysis` (computed) | Single path: pace + HR from activity log | Degrades to 75 neutral when HR absent |
| **Elevation gain** | Activity log | 1: HealthKit metadata key `HKMetadataKeyElevationAscended` · (Strava — supplement only) | |
| **Splits per km** | Activity log | 1: Absent (HealthKit doesn't expose) · (Strava — supplement only, populates `splits_metric` on an existing HK row) | Pace-fade analysis degrades silently when absent |
| **Temperature** | Activity log | 1: Absent (HealthKit doesn't expose) · (Strava — supplement only, populates `avg_temp_c` on an existing HK row) | Reframe heat-context degrades silently when absent |
| **Resting HR (baseline)** | `health_daily_samples` | HealthKit only (HKQuantityTypeIdentifierRestingHeartRate) | User can override in user_settings |
| **HRV (baseline)** | `health_daily_samples` | HealthKit only (HKQuantityTypeIdentifierHeartRateVariabilitySDNN) | |
| **Sleep duration** | `health_daily_samples` | HealthKit only | |
| **Sleep quality (stages)** | `health_daily_samples` | HealthKit only (deep/REM/light/awake breakdown, iOS 16+) | Shipped 2026-06-22 (DS-05) |
| **RPE** | `session_completions` | User input always | Never overridden by device data. **A completion without any signal (no RPE, no fatigue tag, no activity link) is not a verified session** — see § 4b. |
| **Fatigue tag** | `session_completions` | User input always | Never overridden by device data |
| **Plan session definitions** | GitHub Gist JSON | Single source | Always fetched `cache: 'no-store'` |
| **HR zones (user's 5-zone model)** | `user_settings` (computed from RHR + MaxHR) | User input → Karvonen → %MaxHR → Tanaka estimate → %estimated max | Fallback hierarchy defined in CoachingPrinciples §50 |
| **Race/goal** | `user_settings` / plan JSON | User input always | |
| **Active energy burn per run** | Activity log | 1: HealthKit `totalEnergyBurned` · 2: Absent | **Currently not forwarded to coaching engine — see §Gaps** |

**Strava supplement rule.** When Strava is connected and approval is in place, the Strava webhook may *patch* an existing HealthKit-sourced row with fields HealthKit doesn't expose (`splits_metric`, `avg_temp_c`) or fields HealthKit has but at lower fidelity (HR stream from chest strap recorded only in Strava). The patch never changes `source` to `'strava'` — the row stays HK-canonical, with `strava_activity_id` set as provenance. If no matching HK row exists, the Strava activity is **discarded**.

### 3b. Verified-Completion Rule (RESHAPE-FIX-WAVE2B, 2026-06-26)

A `session_completions` row with `status='complete'` is **verified** only when it carries at least one of:

- An activity link (`strava_activity_id` OR `apple_health_uuid`)
- An RPE input
- A fatigue tag

A row with `status='complete'` and none of the above is a **bare stub** — the user tapped "done" but the system has no signal about the run. The 2026-06-26 reshape incident's phantom completion (id `5d13a19b`, week 23, session_day `sun`) had exactly this shape: no link, no RPE, no fatigue tag, no HR. The override-driven UI then displayed it as "Long run done on Thursday" — verified-looking, but the run had not happened.

**Doctrine consequence:**
- **Write boundary**: the user-facing "Mark as done" / "Confirm complete" buttons in `DashboardClient.tsx` are gated to route through the reflect view first, so RPE is collected before the row is created. Going forward, the write path cannot produce a bare stub except via direct DB tampering.
- **Read boundary**: the six AI-DEPTH-01 coaching surfaces (daily coach note, session feedback, weekly report, phase summary, race readiness, plan-adjustment explanation) must filter bare stubs out of analytics consumption. The helper `lib/coaching/completionVerification.ts → isVerifiedCompletion(c)` is the single source of truth for the check. UI display (binary done/not-done) does not filter — a bare stub still reads as "the user marked it done" for the runner.
- **Existing historical bare stubs are not migrated** — they sit in the DB with `status='complete'` and null metadata. The read-boundary filter neutralises them.

A surface-by-surface audit of the six AI-DEPTH-01 consumers is tracked as `RESHAPE-FIX-WAVE2B-AUDIT` in `backlog.md`; current state of each consumer is documented there.

### 4. Conflict Resolution When Multiple Sources Present

The HK-SOR doctrine collapses most conflict logic. There is no peer-vs-peer arbitration; HealthKit is canonical and Strava patches onto it.

1. **Match window**: `healthkitConsolidate.ts → tryEnrichHealthKitRow` matches a Strava activity to an HK row within ≤15 min start-time overlap and ≤15% distance tolerance.
2. **HK row stays canonical**: `source` remains `'apple_health'`, `apple_health_uuid` is preserved. The Strava match attaches `strava_activity_id` as provenance only.
3. **Strava-only fields lift onto the HK row when present**: `splits_metric`, `avg_temp_c`, and any HR-stream-derived summary fields the HK row was missing. These are pure supplements — no conflict, because HealthKit doesn't expose them.
4. **HR conflict**: if both the HK row and the Strava activity have HR data, keep the HK-derived HR (canonical). The Strava HR may be more granular, but the doctrine prioritises one source of truth over fidelity-shopping.
5. **No matching HK row**: the Strava activity is **discarded**. It is not stored as a Strava-canonical row. Coaching for that run runs from manual completion data only.
6. **HealthKit-only data types** (RHR, HRV, sleep, sleep stages, active energy): no Strava path exists; nothing to resolve.
7. **RPE and fatigue tag**: always user input, never inferred from device data.

**The canonical owner of this logic is `lib/coaching/healthkitConsolidate.ts`.** No other code path may insert or merge run data. Direct writes to `strava_activities` outside of `/api/health/ingest` and the consolidate helper are doctrine violations.

### 4b. Manual Entry Insert Path (DS-06, 2026-07-30)

A hand-entered run enters the activity log as a `source='manual'` row. This preserves INV-DATA-008's single-gateway rule: the insert goes through **`/api/health/ingest`** (a manual branch that returns before any HealthKit machinery), not a new route. Migration `20260730_manual_activity_source.sql` widens the `strava_activities` source CHECK to admit `'manual'` and adds a client-generated `manual_uuid` dedupe key (deterministic per session — `manual-w{week}-{day}` — so re-logs/edits upsert one row).

- **FREE to log, PAID to score.** Storing the row (distance/duration/avg-HR) is free — it makes the run count in history, R25 cohorts, and load. The richer scoring (distance/pace + coarse avg-HR read) is gated on `activity_intelligence` and computed by `/api/analyse-run/manual` via the pure `scoreSession` scorer. Free users keep the RPE-only manual verdict.
- **Coarse HR, honestly.** A hand-typed average HR is a single number, not a stream — so `hr_in_zone_pct` and the zone histogram stay **null**. The coarse "avg HR vs the session's band" read is `scoreSession`'s existing `hr_target`-ceiling fallback. Copy never claims time-in-zone.
- **No cross-source dedup (accepted limitation).** The manual branch does not run `consolidateIncomingHealthKitRow`. Manual entry targets users with **no device**, so a colliding Strava/HK row for the same run is not the expected case. If a device is later added and a real duplicate appears, it is a known, low-frequency edge — not silently merged.

### 5. Expected Experience by Configuration

Under HK-SOR, the deciding question is **"does HealthKit have HR samples for the run window?"** — not "is Strava connected?". Strava connection only adds `splits_metric` + `avg_temp_c` on top of an existing HK row.

| User Configuration | Run Analysis | Zone Discipline | Recovery Signal | Adjustment Triggers |
|---|---|---|---|---|
| iOS + Apple Watch (worn during run) | ✅ Full (HR stream, distance, pace) | ✅ Full | ✅ Full (RHR, HRV, sleep) | ✅ All triggers fire |
| iOS + Apple Watch + Strava connected | ✅ Full + splits + temp | ✅ Full | ✅ Full | ✅ All triggers fire |
| iOS + HR chest strap (writes to HealthKit) | ✅ Full | ✅ Full | ⚠️ Only what the device writes to HK | ✅ Triggers fire |
| iOS + no HR device (Strava-on-phone only) | ⚠️ Workout shell only (distance, duration) — **no HR** | ❌ Absent (Strava does not push HR into HealthKit) | ⚠️ RHR/HRV/sleep if passive HR exists | ⚠️ Load + fatigue triggers only |
| iOS + no HR device + Strava connected | ⚠️ Workout shell + splits + temp — **still no HR** | ❌ Absent (same root cause) | ⚠️ As above | ⚠️ Load + fatigue triggers only |
| iOS + no Apple Health connection (manual only) | ⚠️ RPE + fatigue, or hand-entered distance/duration/avg-HR (DS-06) | ⚠️ Coarse avg-HR-vs-band read if HR entered (PAID); else absent | ❌ Absent | ⚠️ Fatigue triggers only |
| Web / Android | ⚠️ Manual entry only (DS-06) — distance/duration/avg-HR by hand; no passive ingest. | ⚠️ Coarse avg-HR read (PAID) if entered | ❌ Absent | ⚠️ Fatigue triggers only |

**The hard truth this table makes explicit**: an iPhone-only runner using Strava on the phone (no Apple Watch, no chest strap) gets **no HR-based coaching**, even with Strava connected. This is a doctrine-driven choice: HealthKit is the single ingestion point, and Strava's Apple Health write does not include the HR stream. Apple controls what Strava writes; we don't reach back to Strava's own API to compensate. The product trade — clean architecture and no third-party data dependency — is paid for by these users in HR-less plans.

**Rule**: every cell that shows ⚠️ or ❌ must have a corresponding UI state that explains the gap honestly and offers a specific action ("Wear your Apple Watch for HR-based coaching" / "Connect a chest strap that writes to Apple Health"). Never a generic "connect Strava" prompt — connecting Strava does not solve the no-HR case.

### 6. UI and Copy Rules for Data Source States

- **Never** use "connect Strava" as the default empty state on iOS. Offer "sync Apple Health" as the primary CTA on iOS, Strava as secondary.
- **Never** describe a feature as "Strava-powered" in product copy. Data comes from "your runs" or "your training data".
- Empty states must be source-aware: iOS shows HealthKit CTA; web shows Strava CTA (or manual entry CTA if no Strava).
- When a metric is absent (e.g. zone discipline score is null), the UI must explain *why* in one line — not render a blank or muted placeholder with no context.

### 7. HealthKit Permission Hygiene

The HealthKit consent prompt is friction. Every permission requested must have a corresponding active query.

**Current permission list (after this ADR):**

| Permission | Requested? | Queried? | Justified? |
|---|---|---|---|
| `workouts` | ✅ | ✅ | Core run ingest |
| `heartRate` | ✅ | ✅ | HR stream per workout → zone analysis |
| `restingHeartRate` | ✅ | ✅ | HR zone baseline → readiness |
| `heartRateVariability` | ✅ | ✅ | Recovery signal |
| `sleep` | ✅ | ✅ | Recovery signal |
| `distance` | ✅ | ❌ | **Remove — distance comes from `HKWorkout.totalDistance`, not standalone samples** |
| `calories` (active energy) | ❌ | ❌ | **Add — active energy per workout is a load signal; currently ignored** |

**Defect logged**: the `distance` permission is wasted consent friction and must be removed from `requestHealthKitAuth()` in `lib/health/clientSync.ts`.

**Enhancement logged**: add `calories` (active energy) to the permission list and ingest it alongside workouts. This populates a caloric-load signal that today is absent for all users.

---

## Gaps (Known, Accepted)

*Note (2026-06-24): several of the "plugin limitation" gaps below are unblocked by the Swift HealthKit bridge committed in backlog **HR-SYNC-03**. The bridge enables the *data path*; whether to build features on top of each unlocked data type is a separate prioritisation, captured in **HR-SYNC-FUTURES** in the backlog. Gaps that the bridge does not address (e.g. plugin-fundamental cross-platform constraints) remain accepted as written.*


| Gap | Impact | Resolution |
|---|---|---|
| **VO2max not available in `@capgo/capacitor-health`** | Pace/fitness inference is weaker; no direct VO2max readiness signal | Plugin limitation — would require a fork or custom Swift bridge. Not prioritised; VDOT proxy is sufficient for race-time estimation. |
| **GPS routes not available in plugin** | No polyline, no pace-per-km breakdowns | Plugin limitation. Zone-discipline product doesn't need GPS; this is a route-replay feature we've explicitly not built. Accept. |
| **Running cadence / stride / power not available in plugin** | Advanced biomechanics signals absent | Plugin limitation. Out of scope for current product. |
| ~~Sleep stages not consumed~~ ✅ CLOSED (DS-05, 2026-06-22) | ~~Recovery signal duration-only~~ → now quality-weighted | Shipped: `health_daily_samples.sleep_stages` JSONB + `isPoorSleepQuality` readiness sub-signal (deep < 10% of staged sleep). See feature-registry DS-05 / CoachingPrinciples §59. |
| **Active energy not ingested** | Caloric load signal absent | See permission hygiene above. Backlog item to add query and schema column. |
| **Web/Android users have no passive data ingest** | Manual completions only → coaching is RPE/fatigue based only | ✅ Near-term addressed 2026-07-30 (DS-06): manual run entry with distance + duration + optional avg HR → distance/pace + coarse avg-HR scoring (PAID). Long-term: Health Connect (Android). |
| **`strava_activities` table name** | Misleads new contributors into treating it as Strava-specific | Cosmetic rename to `run_activities` is a backlog item. Low urgency; aliased in docs until renamed. |

---

## Alternatives Considered

**Alternative A: Make Strava the SOR, HealthKit a secondary enricher** *(rejected — original 2026-05-30)*  
Creates a paid-tier dependency on a free third-party API with a history of tightening developer access. Disadvantages iOS users who track runs with Apple Watch natively.

**Alternative B: Separate tables per source** *(rejected — original 2026-05-30)*  
The coaching engine is analysis-on-run-data, not source-attribution. Separate tables would require all coaching queries to be unioned across sources, creating drift risk. A single table with a `source` discriminator is simpler and already in place.

**Alternative C: Mirror all HealthKit data into Strava format via a local proxy API** *(rejected — original 2026-05-30)*  
Unnecessary complexity. The current adapter pattern (`lib/health/adapter.ts`) maps HealthKit payloads to the activity log schema on ingest. The result is already source-agnostic.

**Alternative D: Co-equal sources, Strava-first priority on activity metadata** *(originally accepted 2026-05-30; superseded 2026-06-24)*  
The original decision. Treated Strava and HealthKit as peers with Strava holding priority 1 on activity metadata (distance, pace, HR stream, elevation). Superseded because:
1. The "co-equal but Strava wins" position was internally contradictory.
2. Strava API approval remains pending, making any "Strava-first" priority operationally meaningless on day one.
3. Two ingestion paths writing primary records created merge/dedup complexity (`tryEnrichHealthKitRow` + `consolidateIncomingHealthKitRow`) for a benefit (slightly higher HR-stream resolution from Strava) that the coaching engine could not measurably exploit.
4. A single ingestion point is the simplest defensible architecture and matches how Apple intends third-party fitness apps to interoperate on iOS.

**Alternative E: HK-SOR with a narrowly-scoped Strava direct-ingest exception for web/Android** *(deferred — 2026-06-24)*  
Web and Android do not have HealthKit; some form of Strava direct-ingest would be required to support them. Out of scope for v1 (iOS-only). Revisit when web/Android coverage is a release goal.

---

## Consequences

1. `strava_activities` must be documented everywhere as **the activity log** — a source-agnostic store. Code comments that describe it as "Strava data" are defects.
2. All race-times, zone-discipline, and weekly-report queries must be verified to not filter by source (no `WHERE source = 'strava'`). If any such filter exists, it is a bug.
3. iOS onboarding must promote HealthKit sync as the primary data path, not a backup to Strava.
4. Empty states on iOS must offer HealthKit CTAs, not Strava CTAs.
5. The `distance` HealthKit permission must be removed from the auth request in `lib/health/clientSync.ts`.
6. `calories` (active energy) must be added to the HealthKit auth request and ingest pipeline.
7. Sleep stages support (iOS 16+) shipped 2026-06-22 (DS-05) — `health_daily_samples.sleep_stages` JSONB column + quality-weighted readiness sub-signal.
8. Manual run entry with distance + optional avg HR is a backlog item for web/Android coverage.

---

## New Architectural Invariants

These invariants are appended to the `zona-architectural-principles` skill as section **17. Data Source Invariants**.

| ID | Invariant |
|---|---|
| INV-DATA-001 | No paid feature may require a specific external data provider. Features degrade gracefully when data is absent; degradation is source-neutral. |
| INV-DATA-002 | The `strava_activities` table is the source-agnostic activity log. All coaching queries read from it without source filtering unless source-specific behaviour is explicitly justified and documented. |
| INV-DATA-003 | Every HealthKit permission requested in `requestHealthKitAuth()` must have a corresponding active query. Unused permissions are consent friction and must be removed. |
| INV-DATA-004 | iOS onboarding and empty states must offer HealthKit as the primary data source CTA. Strava is offered as a secondary option, not the default. |
| INV-DATA-005 | When a coaching metric is absent (null), the UI must render a one-line explanation of why — not a blank, muted placeholder, or silent omission. |
| INV-DATA-006 | Conflict resolution when the same run arrives from multiple sources is defined in ADR-011 §4. Callers must not implement their own conflict logic. `healthkitConsolidate.ts` is the single owner of dedup and merge. |
| INV-DATA-007 | The SOR for each data type is the table in ADR-011 §3. No code may treat a different source as authoritative without updating that table and this ADR. |
| INV-DATA-008 | HealthKit is the System of Record for all run-derived data on iOS. Strava data may only enter as a supplement that patches an existing HealthKit row via `lib/coaching/healthkitConsolidate.ts → tryEnrichHealthKitRow`. If no matching HealthKit row exists, the Strava activity is discarded — never stored as a primary record. Direct writes to `strava_activities` outside of `/api/health/ingest` (insert), the consolidate helper (patch), and `/api/recalibrate-hr` (HR-zone re-bucket — patch-only `.update()` on existing rows, never inserts; registered 2026-08-06 GEN-FIX-11) are doctrine violations. |

---

## References

- `lib/health/clientSync.ts` — HealthKit sync, permission request
- `lib/health/adapter.ts` — HealthKit payload → activity log row
- `lib/coaching/healthkitConsolidate.ts` — dedup and merge logic
- `lib/strava.ts` — Strava API calls, HR stream bucketing
- `app/api/health/ingest/route.ts` — HealthKit ingest endpoint
- `app/api/health/samples/route.ts` — Recovery samples ingest
- `app/api/race-times/route.ts` — Race time estimation (States 1–5)
- `lib/coaching/constants.ts` — Scoring weights, verdict bands
- `docs/canonical/CoachingPrinciples.md` §50 — HR zone fallback hierarchy

---

## Amendment 2026-08-06 — HealthKit runs are re-bucketable (N7)

`/api/recalibrate-hr` could re-bucket Strava runs by re-fetching the raw HR stream from Strava's API, but not HealthKit runs: the device sends raw samples to `/api/health/ingest`, the server buckets them against the user's zones, and discarded them. Correcting a user's HR zones therefore left every HealthKit-sourced run scored against the **old** zones, permanently — for the source this ADR designates as the system of record.

That was found when a real user's max HR was corrected by 40 bpm and their seven logged runs could not be re-scored (`docs/incidents/2026-08-06-plan-defects/analysis.md`, N7).

`strava_activities.hr_bpm_histogram` (migration `20260806_hr_bpm_histogram.sql`) stores a bpm → sample-count map at ingest. This is **lossless for zone bucketing** — bucketing depends only on how many samples fall in each band, never on their order — at roughly 1 KB per run instead of thousands of raw values. `bucketHRHistogram()` in `lib/strava.ts` is now the sole implementation of the zone maths; `bucketHRSamples()` delegates to it, so the raw-stream and histogram paths cannot drift.

**Rows ingested before this migration have no histogram and remain un-re-bucketable.** They are not made worse, and there is no backfill — the raw samples were never stored, so none is possible. This is a known, permanent gap for pre-2026-08-06 HealthKit activity.
