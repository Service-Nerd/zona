# API Contract — /api/daily-coach-note

**Method:** GET  
**Auth:** Supabase session required. Returns 401 if unauthenticated.  
**Gate:** `activity_intelligence` (PAID_ONLY_ONGOING). Returns 403 for free users. Client-side gate skips the fetch entirely for free users.

## Query parameters

| Param | Required | Description |
|-------|----------|-------------|
| `date` | No | User's local date `YYYY-MM-DD`. Defaults to UTC date if absent. |
| `force` | No | `true` to regenerate even if a cached note exists for this date. |

## Response — 200

```json
{ "note": "Hard day tomorrow. Keep today genuinely easy." }
```

## Error responses

| Status | Condition |
|--------|-----------|
| 401 | Missing or invalid session |
| 403 | Free tier user |
| 404 | No plan found for user |

## Caching behaviour

- One row per `(user_id, note_date)` in the `daily_coach_notes` table.
- On a cache hit (and `force` not set), returns the cached note immediately — no AI call.
- On a cache miss or `force=true`, generates via Claude (claude-haiku), upserts the row, returns the note.
- Silent fallback: if AI generation fails, returns `null` note rather than erroring. Client handles `null` gracefully (no note shown).

## Notes

- `date` should be the user's local calendar date, not UTC — pass `new Date().toLocaleDateString('en-CA')` from the client.
- Strength sessions are excluded from coaching context (feature not fully built).
- Prompt source: `lib/coaching/prompts/dailyCoachNote.ts`.

## Data scoping — PLAN-WEEK-COLLISION-01 (2026-09-18)

Every read this route makes against a **week-keyed** table
(`session_completions`, `run_analysis`, `session_overrides`,
`session_metric_overrides`, `session_reflections`) filters
`superseded_at IS NULL`, so it sees the LIVE plan only.

`week_n` is a within-plan coordinate: a new race plan restarts `week.n` at 1 and
would otherwise resolve against the previous plan's rows. No request or response
shape changes — this is a scoping guarantee, and the route's output for a runner
on their first plan is byte-identical to before.

⚠️ Reads that resolve a **RUN** rather than a week (`apple_health_uuid`,
`strava_activity_id`) are deliberately NOT filtered: `run_analysis` is
`UNIQUE (user_id, apple_health_uuid)`, so hiding a superseded row would make the
caller believe none exists and the follow-up insert would violate the constraint.

Enforced by `lib/plan/supersedeCoverage.test.ts`.

---

## 2026-09-20 — ENRICH-PII-MINIMISE-01: the runner's name is not in the prompt

**Request and response shapes are unchanged.** What changed is what leaves our servers.

The prompt no longer interpolates the runner's first name. `buildVoiceHeader` emits the literal
token `{{RUNNER}}` (`lib/coaching/nameToken.ts`, the single owner) and the route substitutes the
real name with `resolveRunnerName` **immediately after the model replies and before anything is
persisted or returned**.

⚠️ **Callers must not resolve the token themselves.** Resolution happens at this boundary
precisely so no downstream surface can miss it and render a literal `{{RUNNER}}`.

⚠️ **No name means the token is removed with its surrounding punctuation**, never replaced with
`"Athlete"` — that is the `PROFILE-NAME-01` defect.

Guarded by `lib/coaching/nameToken.test.ts`, which reads every prompt builder and fails if any
interpolates `${firstName}` or `${athlete_name}` into a template.

---

## 2026-10-01 — KIT-EXEMPLAR-LEAK-01: `buildVoiceHeader` takes a REQUIRED `units`

**Request and response shapes are unchanged.** What changed is what the model is shown.

A live paid runner on miles was told *"hold the zone today from the first km"*, in a sentence
carrying an em dash. Both are banned for runner-facing copy. The numbers were already correct
(`promptDistanceFormatters`); what leaked was the PROSE around them, because the prompt's
few-shot **examples** hardcoded `km` and an em dash, and a model imitates a demonstration far
more strongly than it follows a stated rule. Measured: **36 of 42 exemplars demonstrated an em
dash; 1 of 4 prompts banned it, and that one contradicted itself 283 lines apart.**

`buildVoiceHeader` now emits both rules for all **10** call sites, and takes:

```ts
units: DistanceUnits   // REQUIRED, not defaulted
```

⚠️ **Required, and the first cut of this got it wrong.** It shipped optional-with-`'km'`, which
means a new surface silently tells a miles runner KILOMETRES: the exact defect the field exists
to close, reintroduced through its own default. `post-run-reframe.md` already carried the rule
from **UNITS-DURATION-01** — *"`units` is required, not defaulted: a rate restated in the wrong
unit is silently wrong"* — and making it required immediately surfaced a tenth call site a
directory-scoped grep had missed (`lib/plan/freeIntro.ts`, which already HELD units and simply
never passed them).

⚠️ **One site passes `'km'` explicitly and says why** (`planAdjustment.ts`): nothing on the
plan-adjustment path has the runner's units. Filed as `PROMPT-UNITS-ADJUST-01`. **Do not close
it by re-defaulting the parameter.**

Guarded by `lib/coaching/prompts/exemplarHygiene.test.ts`: no exemplar may contain an em dash or
a unit, every call site must supply `units`, and the call-site population is **derived by walking
`lib/`, `app/` and `components/`** rather than hand-listed — the grep that missed `freeIntro` was
scoped to one directory.
