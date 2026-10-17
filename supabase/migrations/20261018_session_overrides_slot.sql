-- SESSION-SLOTS-01 Phase 1 (ADR-025) -- an AM / PM slot on a move, and the key the table never had.
--
-- 1. new_slot: which half of the day a MOVED session sits in when it shares the day with another.
--    NULL means "the day's only session", which is every row today. Additive: no existing row
--    changes. Nothing writes it until Phase 3 (the move UI), and the app ignores it until Phase 2
--    (the Coaching Board's doubles rules: docs/decisions/same-day-doubles-coaching-2026-10-17.md).
--
-- 2. The unique key. "One live row per (user, week, original day)" has been a CONVENTION, kept by
--    the client deleting before it inserts (lib/plan/overrideMoves.ts). Measured before this
--    migration: 7 live rows in production, 0 duplicate keys, so it applies cleanly.
--    Partial on superseded_at IS NULL, matching every other week-keyed table
--    (20260918_supersede_week_keyed_rows.sql): rows from a replaced plan may repeat a key.

alter table public.session_overrides
  add column if not exists new_slot text check (new_slot in ('am', 'pm'));

create unique index if not exists session_overrides_live_key
  on public.session_overrides (user_id, week_n, original_day)
  where superseded_at is null;
