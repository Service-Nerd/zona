import { describe, it, expect, vi, beforeEach } from 'vitest'

// ONBOARD-EXIT-01 — does pressing it actually DO the thing?
//
// The first two verification passes proved this file compiles and that the
// button renders. Neither proved the sequence RUNS: `signOutOwner.test.ts`
// asserts the ORDER by comparing string positions in the source, which is a
// claim about text, not about execution. A `finally` that never fired, an
// await in the wrong place, or a throw that skipped the navigation would all
// have passed everything shipped so far.

const clearWidgetState = vi.fn()
/** The navigation is injected, so a test can see it happen without a DOM. */
const nav = vi.fn()
const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
const signOut = vi.fn()
const calls: string[] = []

vi.mock('@/lib/native/sharedStore', () => ({
  clearWidgetState: (...a: unknown[]) => { calls.push('clearWidgetState'); return clearWidgetState(...a) },
}))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut: (...a: unknown[]) => { calls.push('signOut'); return signOut(...a) } } }),
}))

import { signOutAndReturnToLogin } from './signOut'

/** Kept only so the module's environment looks like a browser. Navigation is
 *  asserted through the injected `nav`, never through `window`. */
function stubWindow() { (globalThis as any).window = {} }

describe('signOutAndReturnToLogin', () => {
  beforeEach(() => {
    calls.length = 0
    clearWidgetState.mockReset().mockResolvedValue(undefined)
    signOut.mockReset().mockResolvedValue({ error: null })
    warn.mockReset()
    nav.mockReset()
  })

  it('clears the widget store BEFORE ending the session', async () => {
    stubWindow()
    await signOutAndReturnToLogin(nav)
    expect(calls).toEqual(['clearWidgetState', 'signOut'])
  })

  it('lands on the login page', async () => {
    stubWindow()
    await signOutAndReturnToLogin(nav)
    expect(nav).toHaveBeenCalledTimes(1)
  })

  it('navigates even when signOut REJECTS — the user must not be stranded', async () => {
    stubWindow()
    signOut.mockRejectedValue(new Error('network'))
    // The whole point of the `finally`. Without it a runner on a flaky
    // connection presses Sign out, nothing happens, and they are still stuck
    // on the screen that has no other way out.
    await expect(signOutAndReturnToLogin(nav)).rejects.toThrow('network')
    expect(nav).toHaveBeenCalledTimes(1)
  })

  it('navigates even when the widget clear REJECTS', async () => {
    stubWindow()
    // clearWidgetState swallows its own errors today, so this can only happen
    // if that changes. It must not become a way to trap the user.
    clearWidgetState.mockRejectedValue(new Error('app group missing'))
    await expect(signOutAndReturnToLogin(nav)).rejects.toThrow('app group missing')
    expect(nav).toHaveBeenCalledTimes(1)
    expect(calls).toEqual(['clearWidgetState'])
  })

  it('awaits the session teardown before navigating (a hard load kills pending work)', async () => {
    stubWindow()
    let released!: () => void
    // Must resolve to the real `{ error }` shape — the caller destructures it.
    signOut.mockReturnValue(new Promise(res => { released = () => res({ error: null }) }))
    const done = signOutAndReturnToLogin(nav)
    await Promise.resolve()
    expect(nav, 'navigated while signOut was still in flight').not.toHaveBeenCalled()
    released()
    await done
    expect(nav).toHaveBeenCalledTimes(1)
  })
})

describe('signOut FAILED but resolved — the case supabase-js leaves signed in', () => {
  // ⚠️ THIS IS THE REALISTIC FAILURE, and it is not a rejection.
  // `GoTrueClient._signOut` revokes the token first and, on any error that is
  // not 401/403/404/session-missing (a flat network failure), `return`s BEFORE
  // `_removeSession()`. The promise RESOLVES with `{ error }`. So the default
  // is: the user lands on the login page still holding a live session cookie.
  // The earlier tests only covered a REJECTION, which this call does not do.

  function stubStorage(cookies: string[]) {
    const store = { value: cookies.join('; ') }
    const removed: string[] = []
    ;(globalThis as any).document = {
      get cookie() { return store.value },
      set cookie(v: string) {
        const name = v.split('=')[0]
        if (!/Max-Age=0/.test(v)) return
        removed.push(name)
        store.value = store.value.split('; ').filter(c => c.split('=')[0] !== name).join('; ')
      },
    }
    // A session key and a non-session key, so "clears the right thing" and
    // "leaves everything else alone" are both observable.
    const ls: Record<string, string> = { 'sb-abc-auth-token': 'x', 'zona_wizard_draft': 'keep' }
    const localStorage = {
      ...ls,
      removeItem(k: string) { delete (this as Record<string, unknown>)[k] },
    }
    ;(globalThis as any).localStorage = localStorage
    return { removed, store, localStorage }
  }

  beforeEach(() => {
    calls.length = 0
    clearWidgetState.mockReset().mockResolvedValue(undefined)
    warn.mockReset()
    nav.mockReset()
  })

  it('clears the auth COOKIE when the revoke errors', async () => {
    stubWindow()
    const { removed } = stubStorage(['sb-wkppmpsvqkaxbekdgzdm-auth-token=live', 'other=keep'])
    signOut.mockResolvedValue({ error: { message: 'Failed to fetch' } })
    await signOutAndReturnToLogin(nav)
    expect(removed).toEqual(['sb-wkppmpsvqkaxbekdgzdm-auth-token'])
    expect(nav).toHaveBeenCalledTimes(1)
  })

  it('clears the auth key from localStorage too (a plain browser client uses it)', async () => {
    stubWindow()
    const { localStorage } = stubStorage([])
    signOut.mockResolvedValue({ error: { message: 'Failed to fetch' } })
    await signOutAndReturnToLogin(nav)
    expect(localStorage['sb-abc-auth-token' as keyof typeof localStorage]).toBeUndefined()
  })

  it('touches nothing that is not an auth key', async () => {
    stubWindow()
    const { store, localStorage } = stubStorage(['sb-x-auth-token=live', 'other=keep'])
    signOut.mockResolvedValue({ error: { message: 'boom' } })
    await signOutAndReturnToLogin(nav)
    expect(store.value).toBe('other=keep')
    expect(localStorage['zona_wizard_draft' as keyof typeof localStorage]).toBe('keep')
  })

  it('leaves the reason where a bug report can find it', async () => {
    stubWindow(); stubStorage([])
    signOut.mockResolvedValue({ error: { message: 'Failed to fetch' } })
    await signOutAndReturnToLogin(nav)
    expect(warn).toHaveBeenCalled()
  })

  it('does NOT touch storage on the happy path', async () => {
    stubWindow()
    const { store } = stubStorage(['sb-x-auth-token=live'])
    signOut.mockResolvedValue({ error: null })
    await signOutAndReturnToLogin(nav)
    expect(store.value).toBe('sb-x-auth-token=live')
    expect(warn).not.toHaveBeenCalled()
  })
})
