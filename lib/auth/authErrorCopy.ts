/**
 * Supabase auth errors, said the way a person would say them (UX-AUTH-02).
 *
 * `signInWithPassword` / `signUp` return GoTrue's own strings, and the login
 * screen rendered them verbatim. The two that matter are dead ends for exactly
 * the cohort arriving with a charity code:
 *
 *   "Invalid login credentials"  — what a FIRST-TIME runner gets for typing
 *                                  their real email and a new password while the
 *                                  form is on Sign in. Nothing in that sentence
 *                                  tells them the account does not exist yet.
 *   "User already registered"    — the mirror image, on Sign up.
 *
 * Same failure class as UX-BEGINNER-01: a true statement in the system's
 * vocabulary, useless in the runner's. Anything unrecognised is passed through
 * unchanged — a message we have not thought about is still better than a
 * generic one that hides it.
 */

export type AuthMode = 'signin' | 'signup'

export function authErrorCopy(raw: string, mode: AuthMode): string {
  const m = raw.toLowerCase()

  if (mode === 'signin' && (m.includes('invalid login credentials') || m.includes('invalid credentials'))) {
    return 'That email and password do not match an account. If you have not signed up yet, switch to Sign up.'
  }
  if (mode === 'signup' && (m.includes('already registered') || m.includes('already exists'))) {
    return 'That email already has an account. Switch to Sign in, or reset the password if you have forgotten it.'
  }
  if (m.includes('email not confirmed')) {
    return 'Check your inbox and confirm your email address, then sign in.'
  }
  return raw
}
