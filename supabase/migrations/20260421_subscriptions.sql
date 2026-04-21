-- Migration: subscriptions table
-- Source of truth for all subscription state (RevenueCat + Stripe).
-- Gating logic reads ONLY from this table — no direct provider API calls.
--
-- A user is active if:
--   status IN ('trialing', 'active') AND current_period_end > now()

CREATE TABLE IF NOT EXISTS subscriptions (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider           TEXT        NOT NULL CHECK (provider IN ('revenuecat', 'stripe')),
  status             TEXT        NOT NULL CHECK (status IN ('trialing', 'active', 'cancelled', 'expired')),
  current_period_end TIMESTAMPTZ NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per user — upserted on every webhook event
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_user_id_idx ON subscriptions(user_id);

-- RLS: users can read their own row; webhooks write via service role (bypasses RLS)
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own subscription"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);
