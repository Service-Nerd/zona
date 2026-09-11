-- GTM-CHARITY-04 — charity access codes.
--
-- Delivers "we give the app away free" to a partner's runners. A charity is
-- issued a capped batch of unique single-use codes and decides who gets one;
-- possession of a code IS the verification, because the partner is the only
-- party that knows who holds a place with them. We never identify the runners.
--
-- WHY NOT A `subscriptions` ROW (which the spec originally proposed):
--   1. `subscriptions.provider` has CHECK (provider IN ('revenuecat','stripe')),
--      so 'charity_grant' would fail on insert outright.
--   2. That table is upserted `onConflict: user_id` by the RevenueCat webhook,
--      so a later RC event would silently overwrite a grant. The SLT flagged
--      exactly that risk.
--   3. A comp is not a subscription. Conflating an entitlement with billing
--      state is the two-writer class this codebase keeps getting bitten by.
-- `getUserTier` reads this table directly instead. One extra query, no shared
-- writer, and billing data stays clean and auditable.

-- ── Batches — one per partner issuance ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS charity_batches (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_name TEXT        NOT NULL,
  -- Cap is recorded rather than enforced by the DB: the mint script issues
  -- exactly this many codes. Stored so per-partner exposure and ROI are
  -- measurable without counting rows (Traynor: never issue open-ended).
  cap          INTEGER     NOT NULL CHECK (cap > 0),
  notes        TEXT,
  -- Batch-level kill switch for the leaked-code case. Revoking a batch stops
  -- UNCLAIMED codes being redeemed; it deliberately does NOT revoke grants
  -- already made, because taking access back from a runner mid-block is the
  -- cliff the whole grant design exists to avoid.
  revoked_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Codes — the redeemable token, and the grant once claimed ────────────────
CREATE TABLE IF NOT EXISTS charity_codes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id   UUID        NOT NULL REFERENCES charity_batches(id) ON DELETE CASCADE,
  -- Stored normalised (uppercase, no separators) so lookup is exact and the
  -- runner can type it however they like. See lib/charity/code.ts.
  code       TEXT        NOT NULL,
  claimed_by UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  -- The grant's end date. Set to now + 90 days on redemption, then re-anchored
  -- to race_date + 7 days when the runner saves a plan. Extend-only, with an
  -- 18-month ceiling. Rules live in lib/charity/grantWindow.ts, which is the
  -- single owner of this date.
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS charity_codes_code_idx ON charity_codes(code);

-- One grant per user, enforced by the database rather than by route logic.
-- A partial index so the many unclaimed rows (claimed_by NULL) do not collide.
CREATE UNIQUE INDEX IF NOT EXISTS charity_codes_one_grant_per_user_idx
  ON charity_codes(claimed_by) WHERE claimed_by IS NOT NULL;

-- getUserTier's hot path: "does this user have a live grant?"
CREATE INDEX IF NOT EXISTS charity_codes_claimed_lookup_idx
  ON charity_codes(claimed_by, expires_at) WHERE claimed_by IS NOT NULL;

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Codes are secrets until redeemed: an unauthenticated or wrong user must never
-- be able to SELECT the code column and harvest the batch. There is therefore
-- NO public read policy. Redemption goes through /api/charity/redeem using the
-- service role, which bypasses RLS; the route is the auth boundary (ADR-003).
-- The one thing a user may read is their OWN claimed row, so the app can show
-- them when their access ends.
ALTER TABLE charity_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE charity_codes   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own claimed code"
  ON charity_codes FOR SELECT
  USING (auth.uid() = claimed_by);
