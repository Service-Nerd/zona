-- WEEK-KEY-PLAIN-UNIQUE-SURVIVORS-01 — the last two week_n-keyed uniques become live-scoped.
--
-- ── HOW THESE WERE FOUND ───────────────────────────────────────────────────────────────
-- By `week_key_uniqueness()` (CHECK-DB-LIVE-KEY-ARM-01) on its FIRST run, 2026-11-02 —
-- before the arm that calls it was even wired up. The query was written to prove the RPC
-- worked; it returned two keys nobody knew were there:
--
--   session_overrides.session_overrides_user_id_week_n_original_day_key  predicate NONE
--   run_analysis.run_analysis_manual_uniq                   predicate (source = 'manual')
--
-- Both LATENT when measured: 0 colliding keys, 9 live / 13 superseded overrides, 87 / 13
-- manual analyses. That is how COMPLETION-TOMBSTONE-01 read the day before it fired.
--
-- ── session_overrides: A TRAP SET FOR WHOEVER FIXES THE OBVIOUS BUG ────────────────────
-- `20261018_session_overrides_slot.sql` added the partial index on the stated premise that
-- *"'One live row per (user, week, original day)' has been a CONVENTION, kept by the client
-- deleting before it inserts"*. **Production has carried a real constraint all along.**
--
-- It does not bite today only because the client's delete is NOT filtered to live rows: it
-- removes the superseded row too, which is what frees the key for the insert four lines
-- later. So the plain constraint is invisible, AND the archived plan's overrides are
-- destroyed on every Move. Filter the delete — the obvious correctness fix, and the one
-- shipped for `clearSessionMetricOverride` the same morning — and the insert starts failing
-- 23505. **Both halves or neither**, which is why the code change ships with this file.
--
-- ── run_analysis_manual_uniq: the same shape, one condition short ──────────────────────
-- `UNIQUE (user_id, week_n, session_day) WHERE source = 'manual'` is week-keyed, so a new
-- plan's week-1 manual entry collides with the previous plan's. Its job is real — stopping
-- two manual analyses for the same session — so it is made DOUBLY partial rather than
-- dropped (founder, 2026-11-02): live rows only, and the job is preserved.
--
-- ⚠️ Nothing upserts on this key. `analyse-run` conflicts on `user_id,strava_activity_id`
-- or `user_id,apple_health_uuid`; `health/ingest` on `user_id,manual_uuid`; the manual route
-- does a plain INSERT. Verified before writing this, because dropping an index something
-- names as a conflict target is a different and much worse change.

begin;

-- 1. session_overrides — the plain constraint goes; the partial index from 20261018 stays
--    and becomes the only uniqueness, which is what that migration believed it already was.
alter table public.session_overrides
  drop constraint if exists session_overrides_user_id_week_n_original_day_key;

-- 2. run_analysis — replace, not add. Inside the transaction, so there is no window in which
--    the table has no manual uniqueness at all.
drop index if exists public.run_analysis_manual_uniq;

create unique index if not exists run_analysis_manual_live_uniq
  on public.run_analysis (user_id, week_n, session_day)
  where source = 'manual' and superseded_at is null;

comment on index public.run_analysis_manual_live_uniq is
  'WEEK-KEY-PLAIN-UNIQUE-SURVIVORS-01 — at most one LIVE manual analysis per (user, week, day). Replaces run_analysis_manual_uniq, which was partial on source alone and so collided across plans (week_n is a within-plan coordinate, ADR-013).';

commit;

-- ── VERIFICATION, to run after applying ────────────────────────────────────────────────
--   select table_name, index_name, kind, columns, predicate
--     from public.week_key_uniqueness() order by table_name;
--
--   EXPECT 7 rows, all kind='index', every predicate containing 'superseded_at IS NULL':
--     the five %_live_key indexes, plus run_analysis_manual_live_uniq, plus
--     plan_weekly_notes_pkey — which is OUT OF SCOPE and will still show predicate NULL:
--     it carries no `superseded_at` column, and `savePlanForUser` deletes every row on every
--     save. `check:db`'s arm derives that exemption from WEEK_KEYED_TABLES, so it is not
--     counted as a finding.
--
--   Or simply: `npm run check:db` → "✓ 6 week_n-keyed unique(s), every one partial on
--   superseded_at IS NULL." and exit 0. It exits 1 today with 2 findings.
