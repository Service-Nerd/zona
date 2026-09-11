# ADR-015 — Display formatting & preference singularity

**Status:** Accepted (2026-08-10)
**Related:** ADR-011 (data source doctrine), INV-PLAN-005 (primary_metric), M-007 (lifted overrides), M-013 (config singularity)

## Context

A daily push read **"Easy 79m today"** for a plan whose sessions are duration-keyed (`primary_metric: 'duration'`, `duration_mins` only, no `distance_km`). The founder could not tell whether "79m" meant minutes, miles, or metres. Investigation found the ambiguity was not one bug but a **singularity failure across three axes**:

1. **Time formatting is re-implemented 5+ ways** and already inconsistent. The same 78-minute session renders as `78m` (push), `1h 18min` (session card), `1h 18` (session detail), `1h18` (diff). The "≥60 → hours" rule the founder wanted *already existed in three of them* — each re-derived with a different glyph.
2. **Unit / metric preference is honoured on-screen but ignored off-screen.** The client lifts `preferred_units` / `preferred_metric` in `DashboardClient` and passes them as props (M-007 satisfied). But every **server** path hardcodes `'km'` because it never fetches the preference: the daily push (`voiceLines.ts`), the weekly report, all coaching prompts.
3. **The per-session metric toggle lived in `localStorage`** (`rts_metric_*`) — device-local and invisible to the server, so it could never "change everywhere".

## Decision

**One owner for every metric display string: `lib/format.ts`.** No time, distance, or metric string is produced anywhere else.

### 1. Duration formatting — `formatDuration(mins)` (INV-FMT-002)

The single rule, locked with the founder:

| Input | Output |
|---|---|
| `< 60` | `45 min`, `59 min` |
| whole hour | `1h`, `2h` |
| hour + minutes | `1h 18`, `1h 30`, `1h 05` (minutes zero-padded, **no unit suffix** — the `h` anchors it) |

There is **no bare `m`/`min` after the hour, and never a lone `78m`.** That glyph ambiguity (minutes vs miles vs metres) is the defect this retires. Minutes are stored everywhere; this is the only place a minute count becomes a string.

### 2. One metric summary — `formatSessionMetric(session, metric, units)`

The single entry point for "the one-line distance-or-duration for this session". Takes the **already-resolved** metric (`resolveSessionMetric`: per-session override → plan `primary_metric` → global preference) and formats it, falling back to the other metric when the preferred value is absent. Cards, plan, session detail, and the push all call this — they are mechanically incapable of disagreeing.

Pace (`m:ss/km`) and race-clock (`h:mm:ss`) stay separate formatters — genuinely different domains (D-17). Duplicate copies of those are de-duped, not merged.

### 3. Preference — one source, two sinks

- **Source of truth:** `user_settings.preferred_units` / `preferred_metric`.
- **Client sink:** already lifted in `DashboardClient` (M-007). Remaining hardcoded-`km` stragglers consume the prop.
- **Server sink:** new `getUserDisplayPrefs(supabase, userId) → { units, metric }` (`lib/userPrefs.ts`). Every cron/route/prompt fetches it and hands it to the formatters. **No send path may format a distance/duration without it** (INV-PREF-001).

### 4. Per-session override → database

Per-session overrides move from `localStorage` to a **new `session_metric_overrides` table** (`user_id, week_n, session_key, metric`), so a toggle syncs across devices and is visible to server sends. A one-time read-through backfill (`backfillAndLoadSessionMetricOverrides`) migrates existing localStorage entries so no user loses their toggles (D-18).

**Why a new table, not a column on `session_overrides`:** that table is a day-**move** record (`original_day`/`new_day`, both `NOT NULL`) — a different concern. Conflating them violates one-owner-per-concern (D-08). The new table is keyed to mirror the `resolveSessionMetric` map shape.

## Consequences

- Every duration the user sees is identical across surfaces, and the "≥60 → hours" rule is defined exactly once.
- Changing units or metric — global or per-session — propagates to every surface **including notifications**, across devices.
- New invariants gate this before ship: **INV-FMT-001** (all time/distance/metric strings come from `lib/format.ts`), **INV-FMT-002** (the ≥60→hours rule is defined once), **INV-PREF-001** (no hardcoded `km`/`mi`; server fetches prefs). Added to the `zona-architectural-principles` skill with a pre-ship checklist.
- Rollout is phased: Phase 1 lands the core (`formatDuration`, `formatSessionMetric`, `getUserDisplayPrefs`, the migration + backfill helper) additively — no user-facing change. Phases 2+ migrate call sites surface-by-surface (diff-verified identical), wire the server prefs, and run the AI-prompt unit conversion last (behind the reframe golden suite, the one spot that can shift golden output).

---

## Amendment — 2026-09-11 (BUG-KIT-DECIMALS-01): the model is a display surface

The Phase-2 rollout carved one exemption. `formatDistanceForPrompt()` keeps full
precision on the km path, and its comment said:

> *"Do not use this for anything the user reads directly — that is formatDistance's job."*

That sentence is true about the function and false about the system. **A number
handed to the model becomes user-facing the moment the model repeats it**, and Kit
repeats distances constantly. The exemption made the AI layer a second owner of
distance strings — precisely what INV-FMT-001 exists to prevent — and the two
owners disagreed on **50.4% of prescribed session distances** (measured over the
648-input cohort grid: 13,093 of 25,959 sessions across 621 plans; every
half-kilometre session, which is half of them). The runner saw `6km` on the card
and read `5.5km` in Kit's note on the same screen.

**The rule now, and it is about what the number IS, not which layer it is in:**

| The number | Formatter | Why |
|---|---|---|
| A distance the engine PRESCRIBED, referenced on its own | `fmtPlanned` → `formatDistance(km, units)` | It is on the card in front of the runner |
| A race distance | `fmtRace` → `formatDistance(km, units, { exact: true })` | The race card keeps the iconic decimal — `21.1km`, never `21.0975km` |
| A MEASURED or analytical value | `fmtDist` → `formatDistanceForPrompt(km, units, dp)` | The engine's own arithmetic runs on it |
| **Both sides of a planned-vs-actual COMPARISON** | `fmtDist(km, 1)` on each | See below — this is the exemption's real and only job |

**The surviving exemption is narrow and load-bearing.** On a comparison, both
numbers must carry the same precision. Quote a 5.5 km session as "6km" beside an
actual of "5.5km" and the model narrates a shortfall that did not happen — its own
few-shot example is *"Cut it 2km short."* One decimal is also exactly what the app
renders on that surface (`manualSessionFeedback.ts` and the `DashboardClient`
distance line both use `{ exact: true }` for planned AND actual), so the prompt and
the screen still agree. Measured: every session distance the engine emits is at
most 1dp, so this is lossless.

**Owner:** `lib/coaching/prompts/promptFormat.ts → promptDistanceFormatters(units)`.
Ten builders share it; nine previously declared an identical `const fmtDist = …`
closure, so the classification could be right in one file and wrong in the next.
`formatDistanceForPrompt` now has exactly one caller in the prompts layer.

**Enforcement:** `lib/coaching/prompts/promptDistanceParity.test.ts` — the
formatters must equal `formatDistance` for the surface they mirror; real builders
are asserted end-to-end; and a source scan permits `fmtDist` only on an explicit
measured allowlist, so a new prompt fails until someone classifies its number.
