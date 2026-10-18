# API Contract — /api/strength/plan

**Item:** `STRENGTH-ENGINE-01` (ADR-024). **Route:** `app/api/strength/plan/route.ts`.
**Auth:** Bearer token. **Gate:** `canUseStrength` (`lib/strength-bridge/release.ts`), server-side.
While `STRENGTH_RELEASE = 'admin'` only `user_settings.is_admin` accounts pass; everyone else gets **404**
(the feature is not advertised by a 403). At release (`'paid'`), paid and trial pass.
**Tier:** PAID (`strength_sessions_tailored`). **AI:** none.

## GET

Returns the plan and its completions. **If the run week has moved under it** (`run_context_sig`, a sha256 of the
RunContext, differs from the current run plan plus live move/swap overrides) **it is re-placed silently first**
from the stored profile, validated and saved (Design Board `STRENGTH-APP-01` H).

```json
{ "plan": StrengthPlan, "profile": StrengthProfile, "completions": { "YYYY-MM-DD": "done" | "skipped" },
  "completions_ok": true, "replaced": boolean, "stale": false | null,
  "recovery_eases": { "YYYY-MM-DD": "eased" | "declined" } }
```

**Recovery eases (STRENGTH-RECOVERY-01, 2026-10-18).** The stored plan stays as generated; each session on an
`"eased"` date is served through `easeForRecovery` on the way out (`applyRecoveryEases`). The answers are read on
their own select and a failed read is `{}`, so the plan still loads before `20261018_strength_recovery_eases.sql`
is applied (applied 2026-10-18; the tolerance stays as a guard). POST returns `recovery_eases` too and applies them the same way. Written by
`docs/contracts/api/strength-ease.md`.

**Lift logs (STRENGTH-PROGRESSION-01, 2026-10-18).** GET also returns `lift_logs: [{ date, exercise_id, load_kg,
feel, counts }]`, the last 120 days oldest first, read on their own select; a failed read is `[]` (suggestions then
say "start light"), so the plan loads before `20261018_strength_lift_logs.sql` is applied (applied 2026-10-18; the tolerance stays as a guard). Written by
`docs/contracts/api/strength-log.md`; read by `liftSuggestionsFor` (`lib/strength-bridge/progressionView.ts`).

A **failed run-plan read never re-places** (that would place strength blind to the runner's hard days): the stored
plan is returned and `stale` is `null`. `{ "plan": null }` when nothing is stored. Completions: see
`docs/contracts/api/strength-completion.md`.

## POST

```json
{ "profile": {
  "focus": "running" | "general",
  "session_minutes": 30 | 45 | 60,
  "sessions_per_week": 1 | 2 | 3 | 4,
  "equipment": ["bodyweight" | "bands" | "dumbbells" | "kettlebell" | "bench" | "box" | "pullup_bar" | "barbell" | "rack" | "cable" | "machines"],
  "experience": "new" | "some" | "regular",
  "injury_tags"?: ["knee" | "itb" | "achilles" | "shin" | "calf" | "plantar" | "hip" | "hamstring" | "back" | "shoulder"],
  "bone_health_flag"?: boolean,
  "unavailable_days"?: ["mon" … "sun"],  // at most 6
  "available_days"?: ["mon" … "sun"]     // PINNED-DAYS-01: 1–4 chosen days
} }
```

**Preview (SAVE-PATTERN-01, 2026-10-18).** `{ "profile": …, "preview": true }` builds and validates the plan exactly as a
save does and **writes nothing**; **200** `{ "plan" }`. `preview` must be the literal `true`; anything else saves. A
validator failure is refused (**500**) in a preview too, so the runner is never shown a plan that would not save.

**Chosen days (PINNED-DAYS-01, S1 Am.2, 2026-10-18).** When `available_days` is present it wins: the parser sets
`sessions_per_week` to its length and `unavailable_days` to the other days, whatever the request said (`withChosenDays`),
so sessions stay on those days. Empty or more than 4 → **422** (`field: "available_days"`). Absent → the engine picks
the days, as before. Checked by `S-PINNED-DAYS`.

Parsed only by `parseStrengthProfile` (whitelist; **unknown keys refused**; lists de-duplicated and bounded; empty
equipment → `["bodyweight"]`). The run plan is read from the runner's **own stored plan** (`readPlanJson`) plus live
`session_overrides`, never from the request. No run plan → a standalone plan starting next Monday.

**200** `{ "plan": StrengthPlan }` — validated clean by `validateStrengthPlan()` and upserted to `strength_plans`.

**Start date (STRENGTH-START-WEEK-01):** a runner with no strength plan starts **today** (server date); any later POST
or GET re-place keeps the stored `plan_json.start_date` (legacy rows: the date they were generated), so the technique
block is served once. A failed read of the existing row returns **500**, never a reset start.

## Errors

| Status | When | Saved? |
|---|---|---|
| 401 | no valid token | no |
| 404 | not permitted by the release gate | no |
| 413 | body over 4,096 bytes | no |
| 400 | body is not JSON | no |
| 422 | `{ error, field }` — the first invalid profile field (`unknown` for an unrecognised key) | no |
| 500 | run plan could not be READ (never falls back to a standalone plan placed blind) | no |
| 500 | the plan failed its own validator → `strength_generate_failed` ops event (codes only) | no |
| 500 | the write failed → `strength_save_failed` ops event (first error line only) | no |

Error bodies never carry database detail.

## Storage

`strength_plans (user_id PK → auth.users ON DELETE CASCADE, plan_json, profile_json, run_context_sig, generated_at)`,
RLS on with own-row policies; the route writes with the service role scoped to the verified user id.
Migration: `supabase/migrations/20261016_strength_plans.sql`.

Engine shapes (`StrengthProfile`, `StrengthPlan`, `RunContext`): `docs/contracts/strength-engine.md`.
