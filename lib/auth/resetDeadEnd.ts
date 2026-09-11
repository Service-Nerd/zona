/**
 * The three ways a password-reset link can fail to open, and what each one says
 * (UX-AUTH-03).
 *
 * All three used to render "This reset link is invalid or has already been
 * used. Request a fresh one and try again." That is true of exactly one of them.
 * For the other two it is false AND it is a loop: when the Supabase recovery
 * template is not configured for `token_hash`, the link carries a PKCE `?code=`
 * whose verifier lives in the browser that asked for it, so a fresh link fails
 * identically, forever. On iOS-native it can never succeed at all — the request
 * is made inside the Capacitor webview and the email opens in Safari, which are
 * two different browsers on the same device.
 *
 * Lives here rather than in the page so the copy is reviewable and testable on
 * its own, in the pattern of `WeekGrid.logic.ts`.
 *
 * The durable fix is a dashboard setting only the account owner can make; see
 * `docs/runbooks/password-reset.md`. This file is what the runner sees until
 * then, and what keeps them from being told something untrue afterwards.
 */

/** The reset page's whole state machine — three of these are dead ends. */
export type ResetPhase =
  | 'verifying' | 'ready' | 'expired' | 'wrong_browser' | 'no_credential' | 'saving' | 'done'

export type DeadEnd = Extract<ResetPhase, 'expired' | 'wrong_browser' | 'no_credential'>

export const isDeadEnd = (p: ResetPhase): p is DeadEnd =>
  p === 'expired' || p === 'wrong_browser' || p === 'no_credential'

/**
 * One sentence of what happened, one of what to do. All three used to share
 * "This reset link is invalid or has already been used", which is only true of
 * the first — and telling someone to request a fresh link when the problem is
 * the browser sends them round the same loop forever.
 */
export const DEAD_END_COPY: Record<DeadEnd, { heading: string; body: string }> = {
  expired: {
    heading: 'Link expired',
    body: 'This one has already been used, or it has been sitting too long. Send yourself a new one.',
  },
  wrong_browser: {
    heading: 'This link cannot finish here',
    body: 'A reset link only works in the browser that asked for it. Open the email in that browser, or send yourself a new link from this screen and open it from here.',
  },
  no_credential: {
    heading: 'Something is missing from that link',
    body: 'The link arrived without the part that proves it is yours, which usually means an email app clipped it. Send yourself a new one and tap it rather than copying it across.',
  },
}
