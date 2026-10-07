-- ANALYSIS-SUPERSEDE-PATTERN-01 (Coaching Board, 2026-10-07) — a run analysis
-- carries the session type it was scored against.
--
-- §71 Amendment 1 ruled that a cohort comparison MAY cross a race boundary for
-- DISCIPLINE fields (`hr_in_zone_pct`, `hr_above_ceiling_pct`, `hr_below_floor_pct`),
-- because those ask "did you hold the zone you were told to hold" and the zone was
-- recomputed for whoever the runner was at the time. The build was held at
-- INSUFFICIENT EVIDENCE; this sitting lifted it on a measured number.
--
-- 🔴 WHY A COLUMN AND NOT JUST LIFTING THE FILTER. The zone drift detector keeps only
-- easy/recovery runs -- above the Z2 ceiling is DRIFT on an easy run and CORRECT on a
-- tempo (§12) -- and it resolved that type by joining the row's `week_n` against the
-- CURRENT plan's weeks. Measured on the founder: his hidden analyses are weeks 15-35,
-- his current plan is weeks 1-12, ZERO OVERLAP. So lifting the filter alone recovers
-- 42 rows and then drops every one of them at the join: a perfectly inert build, which
-- is this repo's most expensive failure class.
--
-- ADR-018 IS THE PRECEDENT. A generated session stamps `catalogue_id` at construction
-- because re-joining by label broke the moment the enricher renamed things, and the
-- label match survives only as a legacy fallback. Same shape here: a row must carry
-- its own meaning rather than depend on a plan that may be gone.
--
-- ⚠️ It stamps the RAW `session.type`, deliberately, NOT `coachingSessionType()`.
-- The stamp has to answer the same question as the legacy plan-join it replaces, or
-- the two paths become a parallel classifier and drift -- the class that made
-- `type === 'long'` dead everywhere. Changing the classifier is a separate decision.
--
-- ⚠️ NULLABLE AND NOT BACKFILLED. Every existing row keeps `null` and keeps the
-- legacy join. Willy's binding condition on this ruling is that it READS FORWARD: a
-- runner must not open the app and be told they have drifted for eight months because
-- a filter changed. Backfilling from `plan_archive` is possible (the archives do cover
-- weeks 15-35) and is filed separately as ANALYSIS-TYPE-BACKFILL-01.

alter table public.run_analysis
  add column if not exists session_type text;

comment on column public.run_analysis.session_type is
  'ANALYSIS-SUPERSEDE-PATTERN-01: the raw session.type this run was scored against, stamped at write time so cross-plan readers do not depend on a plan that may be archived. NULL on rows written before 2026-10-07, which fall back to the current-plan join.';
