# ADR-010 — Session Catalogue (Selection over Generation)

**Status**: Accepted
**Date**: 2026-04-25
**Releases**: R23 (rebuild)

---

## Context

The R23 rule engine builds a quality session by composing fields inline:

```ts
const qualLabelMap: Record<PhaseType, string> = {
  base:  'Tempo run',
  build: 'Tempo run',
  peak:  fitness === 'experienced' ? 'Tempo run' : 'Cruise intervals',
  taper: 'Tempo run — short',
}
```

This works for one-quality-per-week plans across three distances. It does not work for the rebuild because:

- The same string `Tempo run` covers continuous tempo, cruise intervals, and progressive tempo — three different sessions with different purposes.
- A 5K peak phase needs `intervals_short` (8–12×400m); a marathon peak needs `mp_long_run` (long run with MP segment); the existing engine outputs `Cruise intervals` for both.
- 50K and 100K need `back_to_back_long`, `time_on_feet`, `ultra_race_sim` — sessions that have no natural place in the inline composer.
- The text "5×3 min Z4–Z5 / 2 min jog" lives nowhere; it would need to be hardcoded in the AI enricher prompt or composed at runtime from session-type strings.

Two taxonomies are colliding inside one structure:

- **`SessionType`** — the *slot type* (`easy`, `quality`, `long`, `intervals`, `recovery`, `strength`, `race`, `rest`, `cross-train`). Drives card colour and the user's quick read of "what kind of day is this." Stays as it is in `types/plan.ts`.
- **Session category** — the *coaching category* (`aerobic`, `threshold`, `vo2max`, `race_specific`, `ultra_specific`). Drives selection logic: which session goes in which phase for which distance. Has no current home.

We need a place for the second taxonomy and a place for the concrete sessions that instantiate it.

---

## Decision

Introduce a Supabase table `session_catalogue` that holds the concrete sessions the generator may schedule. The rule engine becomes a **selector** over the catalogue, not a generator of session strings.

### Table shape

```sql
CREATE TABLE session_catalogue (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  category              TEXT NOT NULL,
  purpose               TEXT NOT NULL,
  phase_eligibility     TEXT[] NOT NULL,
  distance_eligibility  TEXT[] NOT NULL,
  fitness_level_min     TEXT NOT NULL,
  difficulty_tier       INT NOT NULL,
  main_set_structure    JSONB NOT NULL,
  intensity_zones       TEXT[] NOT NULL,
  typical_duration_min  INT NOT NULL,
  typical_duration_max  INT NOT NULL,
  is_free_tier          BOOLEAN DEFAULT true,
  coach_voice_notes     TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
```

### Selection rules

The rule engine selects a catalogue row when it has decided a quality session is due in a given week. Inputs to the selector:

- The user's race distance → must appear in `distance_eligibility`
- The current phase (`base | build | peak | taper`) → must appear in `phase_eligibility`
- The user's fitness level → must be ≥ `fitness_level_min`
- The user's tier → if `is_free_tier = false`, only paid users may receive this session

Among eligible rows, selection is **deterministic** for a given week so that two regenerations of the same plan produce the same output. Phase 1 specifies the ordering rule: hash `(planId, weekN)` → modulo eligible-row count, scoped to the catalogue category that fits the phase's specificity target.

### Two taxonomies, kept separate

| | Owns | Drives | Lives in |
|---|---|---|---|
| **`SessionType` union** | The slot kind | Card colour, user's at-a-glance read | `types/plan.ts` (unchanged) |
| **Catalogue `category`** | The coaching content | Which session goes where | `session_catalogue.category` column |

A scheduled session row in the plan JSON carries a `SessionType` (e.g. `quality`, `intervals`) **and** a reference to the catalogue row that produced its main-set content. The catalogue row's `coach_voice_notes` becomes the session's `coach_notes` if the AI enricher is unavailable; the enricher may overwrite with longer-form copy when running for paid/trial.

### Why a database table, not a TypeScript constant

- Voice notes need editing without redeploys. Catalogue rows are coaching content; coaching content is not code.
- Future paid feature: alternative session catalogues per coach style, per terrain bias, per injury history. The table is the natural extension point.
- Seed migration owns the v1 14 sessions; future content additions are migrations.

---

## Consequences

### Positive

- Generator stops being a string-formatter and becomes a small selector.
- Each session is named and addressable. Coaching audits inspect 14 rows, not the engine source.
- Voice notes are versioned through migrations and editable via Supabase dashboard.
- Adding a new session (e.g. hill repeats, threshold ladders) is a migration plus an entry in eligibility arrays — no engine change.
- AI enricher gets richer input (`name`, `purpose`, `main_set_structure`) instead of synthesising from a label string.

### Constraints

- Generator now requires a Supabase fetch during plan generation. Cached at request scope; the catalogue is small (<100 rows expected lifetime). RLS is read-anonymous for catalogue rows tagged `is_free_tier = true`; paid-only rows require the user's session.
- Catalogue rows tagged `is_free_tier = false` (50K/100K-specific sessions) are visible only to paid users. Free users requesting an ultra plan are blocked at the API layer (Phase 6 feature gate), not by an empty catalogue at the engine layer.
- `coach_voice_notes` must be in ZONA voice. Phase 1 drafts all 14 strings for explicit approval before seeding. Voice changes are a content task, not an engineering task — but they still go through the migration mechanism for auditability.

---

## Alternatives rejected

| Alternative | Reason rejected |
|---|---|
| Inline session catalogue as a TypeScript const | Voice notes need editing without redeploys; future per-coach catalogues need a database. |
| Combine `SessionType` and `category` into one enum | Violates separation: `SessionType` drives display; `category` drives selection. Merging them would force every consumer to know about both concerns. |
| Generate session strings via AI for paid users only | Free users would receive worse sessions, violating the "free users are never abandoned" brand position. The catalogue applies equally to both tiers. |
| Store catalogue in plan JSON | Plans become uncomparable; the catalogue is a shared coaching asset, not a per-plan one. |
