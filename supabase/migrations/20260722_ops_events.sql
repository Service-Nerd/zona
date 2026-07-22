-- OPS-01: internal operational event log (SLT roadmap W1).
--
-- Postmortem track from the 2026-06-26 reshape incident: a live paid feature
-- was broken for nine days with founder dogfooding as the only detection. This
-- table is the owned-in-Supabase telemetry sink (no third-party monitoring;
-- same doctrine as INSTRUMENT-01's analytics_events — don't buy a vendor before
-- the traffic). Two producers write here:
--   1. recordOpsEvent() at server write-failure sites (e.g. savePlanForUser throw).
--   2. The daily integrity probe (/api/ops/reshape-integrity) that detects the
--      broken STATE by observation, independent of where the write failed.
--
-- `kind` has no CHECK constraint — new event kinds ship without a migration.
-- The union is enforced in TS (lib/ops/recordOpsEvent.ts → OpsEventKind),
-- mirroring notifications.type / analytics_events.event.

CREATE TABLE IF NOT EXISTS ops_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        TEXT        NOT NULL,                       -- event kind; union in lib/ops/recordOpsEvent.ts
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE,  -- nullable: some events are system-wide
  detail      JSONB       NOT NULL DEFAULT '{}'::jsonb,   -- structured context; no PII beyond the user id
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Read patterns: newest-of-a-kind (dashboards) and per-user dedup (the probe).
CREATE INDEX IF NOT EXISTS ops_events_kind_created ON ops_events (kind, created_at DESC);
CREATE INDEX IF NOT EXISTS ops_events_user_kind_created ON ops_events (user_id, kind, created_at DESC);

-- Internal log: fully locked. RLS on with NO policies denies anon + authenticated
-- entirely; only the service-role key (server) bypasses RLS to read/write.
-- Same posture as the waitlist table (20260603_waitlist.sql).
ALTER TABLE ops_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ops_events FROM anon, authenticated;
