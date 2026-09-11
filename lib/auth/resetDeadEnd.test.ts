import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { DEAD_END_COPY, isDeadEnd, type DeadEnd, type ResetPhase } from './resetDeadEnd'

/**
 * UX-AUTH-03 — a password reset that cannot work must not claim it can.
 *
 * The regression this locks: every dead end rendered "This reset link is invalid
 * or has already been used. Request a fresh one and try again." For two of the
 * three cases that is false, and following it produces an identical failure every
 * time. On iOS-native the PKCE path can never succeed — the request is made in
 * the Capacitor webview and the email opens in Safari — so a runner could follow
 * that instruction indefinitely.
 */

const ALL: DeadEnd[] = ['expired', 'wrong_browser', 'no_credential']

/** Words that assert the LINK is at fault. Only `expired` may use them. */
const BLAMES_THE_LINK = /\b(invalid|expired|already been used)\b/i

describe('reset dead ends — three causes, three answers', () => {
  it('classifies only the dead ends', () => {
    for (const p of ALL) expect(isDeadEnd(p)).toBe(true)
    for (const p of ['verifying', 'ready', 'saving', 'done'] as ResetPhase[]) {
      expect(isDeadEnd(p)).toBe(false)
    }
  })

  it('says something different in each case', () => {
    const bodies = ALL.map(k => DEAD_END_COPY[k].body)
    expect(new Set(bodies).size).toBe(ALL.length)
    const headings = ALL.map(k => DEAD_END_COPY[k].heading)
    expect(new Set(headings).size).toBe(ALL.length)
  })

  it('only blames the link when the link is actually the problem', () => {
    expect(BLAMES_THE_LINK.test(DEAD_END_COPY.expired.body + DEAD_END_COPY.expired.heading)).toBe(true)
    for (const k of ['wrong_browser', 'no_credential'] as DeadEnd[]) {
      const text = `${DEAD_END_COPY[k].heading} ${DEAD_END_COPY[k].body}`
      expect(BLAMES_THE_LINK.test(text), `${k} tells the runner the link is invalid; it is not`).toBe(false)
    }
  })

  it('every case ends in something the runner can actually do', () => {
    for (const k of ALL) {
      expect(DEAD_END_COPY[k].body.length, k).toBeGreaterThan(40)
      expect(DEAD_END_COPY[k].body, k).toMatch(/send yourself a new|open the email/i)
    }
  })

  it('the page offers the new link in place rather than sending them away', () => {
    // The old dead end's only control was "Back to sign in", which is where the
    // loop restarted. The resend form has to be ON this screen.
    const page = readFileSync('app/auth/reset/page.tsx', 'utf8')
    expect(page).toContain('handleResend')
    expect(page).toContain('sendPasswordReset(supabase, resendEmail)')
  })

  it('redirectTo has one owner, derived from the running origin', () => {
    // A hardcoded apex URL is outside Capacitor's allowNavigation and would send
    // the runner out to Safari — the other half of UX-AUTH-01.
    const helper = readFileSync('lib/auth/sendPasswordReset.ts', 'utf8')
    expect(helper).toContain('window.location.origin')
    expect(helper).not.toMatch(/https?:\/\/[a-z]/)
    for (const f of ['app/auth/login/page.tsx', 'app/auth/reset/page.tsx']) {
      const src = readFileSync(f, 'utf8')
      expect(src, `${f} calls resetPasswordForEmail directly instead of the helper`)
        .not.toContain('resetPasswordForEmail')
    }
  })
})
