-- Migration: auto-create user_settings on signup
--
-- Problem: user_settings rows were created lazily inside
-- DashboardClient.tsx's useEffect. A user who signed up and went
-- straight to plan generation without the dashboard's effect
-- completing would have no user_settings row, so getUserTier()
-- saw no trial_started_at, returned 'free', and the AI enricher
-- (PAID/TRIAL only) was skipped — even though the user is
-- supposed to be on a 14-day trial.
--
-- Fix: a database trigger on auth.users INSERT that creates the
-- user_settings row with trial_started_at = NOW(). Fires on every
-- signup path (email, OAuth, magic link) and runs regardless of
-- which screen the user lands on next.
--
-- This supersedes the lazy upsert in DashboardClient.tsx:301; that
-- code remains in place as a no-op safety net (ON CONFLICT DO
-- NOTHING in the trigger preserves the original trial_started_at).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_settings (id, trial_started_at, updated_at)
  VALUES (NEW.id, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Backfill: any existing auth.users without a user_settings row
-- (likely the user who hit this bug, plus any historical accidents).
-- Sets trial_started_at to NOW() — gives those users a fresh trial
-- rather than a back-dated one, since we can't reconstruct when they
-- actually signed up.
INSERT INTO public.user_settings (id, trial_started_at, updated_at)
SELECT u.id, NOW(), NOW()
FROM auth.users u
LEFT JOIN public.user_settings us ON us.id = u.id
WHERE us.id IS NULL
ON CONFLICT (id) DO NOTHING;
