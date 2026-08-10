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
