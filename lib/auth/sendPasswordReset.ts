import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Send a password-reset email — the single owner of `redirectTo` (UX-AUTH-03).
 *
 * `redirectTo` is derived from the window's own origin rather than a constant.
 * The Capacitor webview is loaded from the canonical host, so the link inherits
 * it; a hardcoded apex URL would land the runner outside `allowNavigation` and
 * Capacitor would bounce them to Safari.
 *
 * Supabase returns success for addresses with no account, on purpose — it will
 * not confirm who is registered. Callers must show the same neutral message
 * either way; this helper deliberately does not report "not found", because
 * there is nothing to report.
 */
export const RESET_LANDING_PATH = '/auth/reset'

/** The one message shown after a send, whether or not the address has an account. */
export const RESET_SENT_MESSAGE =
  'If that email has an account, a reset link is on its way. Check your inbox.'

export async function sendPasswordReset(
  supabase: SupabaseClient,
  email: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}${RESET_LANDING_PATH}`,
  })
  return { error: error?.message ?? null }
}
