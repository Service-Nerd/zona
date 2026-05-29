-- Migration: admin_user_directory view
-- An internal people-directory so we can see who is using the app by name.
-- Joins auth.users (authoritative email + signup time) to user_settings
-- (first/last name). Names fall back to the OAuth full_name on user_metadata
-- when first_name/last_name are blank — most rows never populate the
-- user_settings.email/name fields unless the user edits their profile, so we
-- read identity from the reliable source and only use user_settings to enrich.
--
-- Read this from the Supabase SQL/Table editor (postgres / service-role only).
-- It exposes PII (email, name), so SELECT is REVOKEd from anon + authenticated:
-- it must never be reachable from the browser client. There is no app surface
-- for it — if we later want it on mobile, gate a route behind user_settings.is_admin.
--
-- security_invoker is intentionally left OFF (the default): the view runs with
-- its owner's privileges so it can read auth.users when queried in the dashboard.

CREATE OR REPLACE VIEW public.admin_user_directory AS
SELECT
  u.id,
  COALESCE(
    NULLIF(s.first_name, ''),
    NULLIF(split_part(u.raw_user_meta_data->>'full_name', ' ', 1), '')
  ) AS first_name,
  COALESCE(
    NULLIF(s.last_name, ''),
    NULLIF(split_part(u.raw_user_meta_data->>'full_name', ' ', 2), '')
  ) AS last_name,
  u.email,
  u.created_at        AS signed_up,
  u.last_sign_in_at,
  s.trial_started_at,
  s.is_admin
FROM auth.users u
LEFT JOIN public.user_settings s ON s.id = u.id
ORDER BY u.created_at DESC;

-- PII guard: keep this view off the client. Only postgres / service_role read it.
REVOKE ALL ON public.admin_user_directory FROM anon, authenticated;
