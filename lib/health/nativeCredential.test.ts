import { describe, it, expect } from 'vitest'
import { buildNativeCredential } from './nativeCredential'

// HK-NATIVE-BG-INGEST-01 — the pure half of the credential owner.
//
// `publishNativeCredential` touches the Supabase client and the Capacitor
// bridge, neither of which exists under `environment: 'node'`, so the decision
// it delegates to lives here and is tested directly. That split is the point:
// the thing worth asserting is WHAT COUNTS as publishable.

describe('buildNativeCredential', () => {
  const origin = 'https://www.zonna.run'

  it('publishes a session that has both halves', () => {
    expect(buildNativeCredential({ access_token: 'jwt', expires_at: 1_900_000_000 }, origin))
      .toEqual({ base_url: origin, access_token: 'jwt', expires_at: 1_900_000_000 })
  })

  it('publishes nothing when there is no session', () => {
    expect(buildNativeCredential(null, origin)).toBeNull()
    expect(buildNativeCredential(undefined, origin)).toBeNull()
  })

  it('publishes nothing without an access token', () => {
    expect(buildNativeCredential({ access_token: '', expires_at: 1_900_000_000 }, origin)).toBeNull()
    expect(buildNativeCredential({ expires_at: 1_900_000_000 }, origin)).toBeNull()
  })

  // ⚠️ THE ARM THAT MATTERS. `expires_at` is OPTIONAL on a Supabase session.
  // Without it native cannot judge freshness, and a credential native would
  // always reject reads exactly like a credential that was never written — the
  // feature would look wired and ingest nothing, forever, with no error.
  // Absence must not be published as a value.
  it('publishes nothing when expiry is absent or not a finite number', () => {
    expect(buildNativeCredential({ access_token: 'jwt' }, origin)).toBeNull()
    expect(buildNativeCredential({ access_token: 'jwt', expires_at: null }, origin)).toBeNull()
    expect(buildNativeCredential({ access_token: 'jwt', expires_at: NaN }, origin)).toBeNull()
    expect(buildNativeCredential({ access_token: 'jwt', expires_at: Infinity }, origin)).toBeNull()
  })

  it('publishes nothing for an origin native could not POST to', () => {
    const session = { access_token: 'jwt', expires_at: 1_900_000_000 }
    expect(buildNativeCredential(session, '')).toBeNull()
    expect(buildNativeCredential(session, 'capacitor://localhost')).toBeNull()
    expect(buildNativeCredential(session, 'www.zonna.run')).toBeNull()
  })

  it('keeps a LAN dev origin, so local development needs no native change', () => {
    const c = buildNativeCredential({ access_token: 'jwt', expires_at: 1_900_000_000 }, 'http://192.168.0.9:3000')
    expect(c?.base_url).toBe('http://192.168.0.9:3000')
  })

  // 🔴 THE PHASE-2 BOUNDARY, HELD MECHANICALLY. Supabase rotates refresh
  // tokens on use, so a native refresher racing supabase-js's own would sign
  // runners out at random. The blob must never carry one.
  it('never carries a refresh token', () => {
    const c = buildNativeCredential(
      { access_token: 'jwt', expires_at: 1_900_000_000, refresh_token: 'rt' } as never,
      origin,
    )
    expect(Object.keys(c!).sort()).toEqual(['access_token', 'base_url', 'expires_at'])
  })
})
