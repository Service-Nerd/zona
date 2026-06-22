# ADR-011 — Data Source Doctrine: System of Record and Source Priority

**Status**: Accepted  
**Date**: 2026-05-30  
**Releases**: Applied retroactively to all current integrations; governs all future data sources.

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

Strava and HealthKit are co-equal data sources for run sessions. Neither is "primary".

### 2. The Activity Log Is Source-Agnostic

The `strava_activities` table is **the canonical activity log for all run sessions regardless of source**. Its name is a misnomer inherited from v1 — it must be treated, documented, and queried as a source-agnostic store. The `source` column (`'strava' | 'apple_health' | 'manual'`) is the discriminator. All coaching logic reads from this table without source filtering unless source-specific behaviour is explicitly justified.

A future rename to `run_activities` or `activity_log` is a backlog item. Until then, all internal documentation refers to it as **the activity log**.

### 3. System of Record (SOR) by Data Type

| Data Type | System of Record | Source Priority | Notes |
|---|---|---|---|
| **Run session (distance, pace, duration)** | Activity log (`strava_activities`) | 1: Strava · 2: HealthKit · 3: Manual entry | Dedup by time window overlap when both sources present |
| **HR stream (per-second or per-sample)** | Activity log | 1: Strava · 2: HealthKit HR samples · 3: Absent | Zone bucketing runs identically for both |
| **Average HR per run** | Activity log (computed from stream or Strava field) | 1: Strava `average_heartrate` · 2: HealthKit average of HR samples · 3: Absent (75 neutral) | |
| **HR-in-zone %** | `run_analysis` (computed) | Single path: `bucketHRSamples()` on whichever stream is present | Source-blind algorithm |
| **Aerobic efficiency (EF)** | `run_analysis` (computed) | Single path: pace + HR from activity log | Degrades to 75 neutral when HR absent |
| **Elevation gain** | Activity log | 1: Strava · 2: HealthKit metadata key `HKMetadataKeyElevationAscended` | |
| **Resting HR (baseline)** | `health_daily_samples` | HealthKit only (HKQuantityTypeIdentifierRestingHeartRate) | User can override in user_settings |
| **HRV (baseline)** | `health_daily_samples` | HealthKit only (HKQuantityTypeIdentifierHeartRateVariabilitySDNN) | |
| **Sleep duration** | `health_daily_samples` | HealthKit only | |
| **Sleep quality (stages)** | `health_daily_samples` | HealthKit only (deep/REM/light/awake breakdown, iOS 16+) | **Currently unused — see §Gaps** |
| **RPE** | `session_completions` | User input always | Never overridden by device data |
| **Fatigue tag** | `session_completions` | User input always | Never overridden by device data |
| **Plan session definitions** | GitHub Gist JSON | Single source | Always fetched `cache: 'no-store'` |
| **HR zones (user's 5-zone model)** | `user_settings` (computed from RHR + MaxHR) | User input → Karvonen → %MaxHR → Tanaka estimate → %estimated max | Fallback hierarchy defined in CoachingPrinciples §50 |
| **Race/goal** | `user_settings` / plan JSON | User input always | |
| **Active energy burn per run** | Activity log | 1: HealthKit `totalEnergyBurned` · 2: Absent | **Currently not forwarded to coaching engine — see §Gaps** |

### 4. Conflict Resolution When Multiple Sources Present

When the same run arrives from both Strava and HealthKit (most common on iOS with Apple Watch):

1. **Dedup by time window**: `healthkitConsolidate.ts` matches activities with ≤5-minute start-time overlap and similar duration. The matched pair is merged into one `strava_activities` row.
2. **Strava wins on activity metadata** (distance, pace, elevation) where both are present — Strava's GPS-derived values are typically more accurate than HealthKit's accelerometer-derived estimates.
3. **HealthKit wins on recovery metrics** (RHR, HRV, sleep) — these are always HealthKit-only, never from Strava.
4. **HR stream**: prefer the denser stream. Strava provides 1Hz GPS-synced HR; HealthKit provides 4–5 second samples. Strava stream wins when present; HealthKit stream used when Strava is absent.
5. **RPE and fatigue tag**: always user input, never inferred from device data.

### 5. Expected Experience by Configuration

| User Configuration | Run Analysis | Zone Discipline | Recovery Signal | Adjustment Triggers |
|---|---|---|---|---|
| iOS + Apple Watch + HealthKit sync | ✅ Full (HR stream, distance, pace) | ✅ Full | ✅ Full (RHR, HRV, sleep) | ✅ All triggers fire |
| iOS + Apple Watch + Strava connected | ✅ Full | ✅ Full | ✅ Full | ✅ All triggers fire |
| iOS + Apple Watch + both connected | ✅ Full (richer via merge) | ✅ Full | ✅ Full | ✅ All triggers fire |
| iOS + no Apple Watch (manual only) | ⚠️ RPE + fatigue only | ⚠️ Absent (no HR) | ⚠️ RHR/HRV/sleep if phone HR exists | ⚠️ Load + fatigue triggers only |
| iOS + no Apple Watch + Strava connected | ✅ Full via Strava | ✅ Full via Strava | ⚠️ RHR/HRV/sleep if available | ✅ All triggers fire |
| Web / Android + Strava connected | ✅ Full via Strava | ✅ Full via Strava | ❌ No HealthKit | ⚠️ Load + zone + EF; no readiness |
| Web / Android + no Strava | ⚠️ Manual completions only | ❌ Absent | ❌ No HealthKit | ⚠️ Fatigue triggers only |

**Rule**: every cell in this table that shows ⚠️ or ❌ must have a corresponding UI state that explains the gap and offers a specific action — not a generic "connect Strava" prompt.

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

| Gap | Impact | Resolution |
|---|---|---|
| **VO2max not available in `@capgo/capacitor-health`** | Pace/fitness inference is weaker; no direct VO2max readiness signal | Plugin limitation — would require a fork or custom Swift bridge. Not prioritised; VDOT proxy is sufficient for race-time estimation. |
| **GPS routes not available in plugin** | No polyline, no pace-per-km breakdowns | Plugin limitation. Zone-discipline product doesn't need GPS; this is a route-replay feature we've explicitly not built. Accept. |
| **Running cadence / stride / power not available in plugin** | Advanced biomechanics signals absent | Plugin limitation. Out of scope for current product. |
| ~~Sleep stages not consumed~~ ✅ CLOSED (DS-05, 2026-06-22) | ~~Recovery signal duration-only~~ → now quality-weighted | Shipped: `health_daily_samples.sleep_stages` JSONB + `isPoorSleepQuality` readiness sub-signal (deep < 10% of staged sleep). See feature-registry DS-05 / CoachingPrinciples §59. |
| **Active energy not ingested** | Caloric load signal absent | See permission hygiene above. Backlog item to add query and schema column. |
| **Web/Android users have no passive data ingest** | Manual completions only → coaching is RPE/fatigue based only | Near-term: manual run entry with distance + optional avg HR. Long-term: Health Connect (Android). Backlog items. |
| **`strava_activities` table name** | Misleads new contributors into treating it as Strava-specific | Cosmetic rename to `run_activities` is a backlog item. Low urgency; aliased in docs until renamed. |

---

## Alternatives Considered

**Alternative A: Make Strava the SOR, HealthKit a secondary enricher**  
Rejected. This creates a paid-tier dependency on a free third-party API with a history of tightening developer access. It also disadvantages iOS users who track runs with Apple Watch natively.

**Alternative B: Separate tables per source**  
Rejected. The coaching engine is analysis-on-run-data, not source-attribution. Separate tables would require all coaching queries to be unioned across sources, creating drift risk. A single table with a `source` discriminator is simpler and already in place.

**Alternative C: Mirror all HealthKit data into Strava format via a local proxy API**  
Rejected. Unnecessary complexity. The current adapter pattern (`lib/health/adapter.ts`) maps HealthKit payloads to the activity log schema on ingest. The result is already source-agnostic.

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
