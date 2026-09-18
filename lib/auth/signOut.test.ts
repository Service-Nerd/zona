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
const signOut = vi.fn()
const calls: string[] = []

vi.mock('@/lib/native/sharedStore', () => ({
  clearWidgetState: (...a: unknown[]) => { calls.push('clearWidgetState'); return clearWidgetState(...a) },
}))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut: (...a: unknown[]) => { calls.push('signOut'); return signOut(...a) } } }),
}))

import { signOutAndReturnToLogin } from './signOut'

function stubWindow() {
  const loc = { href: '' }
  // The module reads `window.location.href`; the node environment has none.
  ;(globalThis as any).window = {
    get location() { return loc },
    set location(v: any) { loc.href = v },
  }
  return loc
}

describe('signOutAndReturnToLogin', () => {
  beforeEach(() => {
    calls.length = 0
    clearWidgetState.mockReset().mockResolvedValue(undefined)
    signOut.mockReset().mockResolvedValue({ error: null })
  })

  it('clears the widget store BEFORE ending the session', async () => {
    stubWindow()
    await signOutAndReturnToLogin()
    expect(calls).toEqual(['clearWidgetState', 'signOut'])
  })

  it('lands on the login page', async () => {
    const loc = stubWindow()
    await signOutAndReturnToLogin()
    expect(loc.href).toBe('/auth/login')
  })

  it('navigates even when signOut REJECTS — the user must not be stranded', async () => {
    const loc = stubWindow()
    signOut.mockRejectedValue(new Error('network'))
    // The whole point of the `finally`. Without it a runner on a flaky
    // connection presses Sign out, nothing happens, and they are still stuck
    // on the screen that has no other way out.
    await expect(signOutAndReturnToLogin()).rejects.toThrow('network')
    expect(loc.href).toBe('/auth/login')
  })

  it('navigates even when the widget clear REJECTS', async () => {
    const loc = stubWindow()
    // clearWidgetState swallows its own errors today, so this can only happen
    // if that changes. It must not become a way to trap the user.
    clearWidgetState.mockRejectedValue(new Error('app group missing'))
    await expect(signOutAndReturnToLogin()).rejects.toThrow('app group missing')
    expect(loc.href).toBe('/auth/login')
    expect(calls).toEqual(['clearWidgetState'])
  })

  it('awaits the session teardown before navigating (a hard load kills pending work)', async () => {
    const loc = stubWindow()
    let released!: () => void
    signOut.mockReturnValue(new Promise<void>(res => { released = res }))
    const done = signOutAndReturnToLogin()
    await Promise.resolve()
    expect(loc.href, 'navigated while signOut was still in flight').toBe('')
    released()
    await done
    expect(loc.href).toBe('/auth/login')
  })
})
