-- COMPLETION-ACTIVITY-DUPE-01 (2026-11-04)
--
-- One run may satisfy exactly one session. Nothing enforced that, so the same
-- HealthKit workout could be linked to two different days, and was.
--
-- MEASURED BEFORE THIS MIGRATION, on 156 live completions across 8 runners with
-- any linked activity: 2 activities each linked to 2 sessions, both on one user.
-- The effect is silent and one-directional — weekly volume, the acute:chronic
-- ratio and every "load from the last few sessions" judgement count the run
-- twice, and no screen shows a contradiction.
--
-- WHY AN INDEX AND NOT A CHECK IN THE WRITE PATH. `upsertCompletion` is already
-- the single owner of this write, and an application guard there would need a
-- read-then-write with a race between them. A partial unique index is the
-- mechanism; the owner is where the error is surfaced. This repo's own rule:
-- a list in application code is a promise, a constraint is a mechanism.
--
-- ── STEP 1: the two existing pairs ─────────────────────────────────────────
-- The surviving row is NOT the earlier one — it is the one whose session day
-- matches the day the activity actually started. Derived per pair, not assumed:
--
--   9DCEE865… started 2026-10-31 11:14. Week 6 begins Mon 2026-10-26, so that
--   date is SATURDAY. Keep `sat`, supersede `fri` (which was written first).
--
--   D6670D38… started 2026-09-29 15:15. Week 2 begins Mon 2026-09-28, so that
--   date is TUESDAY. Keep `tue`, supersede `wed`.
--
-- Superseded, never deleted: COMPLETION-TOMBSTONE-01 made `superseded_at` the
-- way a completion leaves the live set, and every read already filters on it.
update public.session_completions
   set superseded_at = now(), updated_at = now()
 where superseded_at is null
   and user_id = '60d4bdd5-ce82-4d99-9a77-c3c54b48ca59'
   and ( (apple_health_uuid = '9DCEE865-0C35-4659-B932-2E7BE0FE49AE' and week_n = 6 and session_day = 'fri')
      or (apple_health_uuid = 'D6670D38-16D8-4366-8CE9-2C3239C3AFCE' and week_n = 2 and session_day = 'wed') );

-- ── STEP 2: the constraint ─────────────────────────────────────────────────
-- Partial, matching `session_completions_live_key`'s existing shape: a
-- superseded row is out of the live set and must not block a re-link. An
-- unlink/relink therefore still works — the old row is tombstoned first.
create unique index if not exists session_completions_live_hk_uuid_key
  on public.session_completions (user_id, apple_health_uuid)
  where superseded_at is null and apple_health_uuid is not null;

create unique index if not exists session_completions_live_strava_id_key
  on public.session_completions (user_id, strava_activity_id)
  where superseded_at is null and strava_activity_id is not null;

-- No GRANT block: MIGRATION-GRANTS-01 applies to migrations that CREATE a
-- table. This creates indexes on an existing one, whose grants are unchanged.
