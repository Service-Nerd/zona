-- GTM-08 — Marketing-site waitlist capture.
-- Pre-launch email capture for the one-pager at zonna.run. Anonymous visitors
-- submit an email; the /api/waitlist route writes here with the service-role
-- client (RLS stays locked — no public read/write). One row per email.

CREATE TABLE IF NOT EXISTS waitlist (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'marketing_site',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Case-insensitive uniqueness so "A@x.com" and "a@x.com" don't both land.
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_email_lower_idx
  ON waitlist (lower(email));

-- Lock it down: no anon/auth access. Only the service-role key (used by the
-- API route, which bypasses RLS) can read/write. Mirrors the delete-account
-- route's service-role pattern.
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
