import { describe, it, expect, beforeAll } from 'vitest'
import { signStravaState, verifyStravaState } from './oauthState'

// The helper reads a signing key from env; set a deterministic one for tests.
beforeAll(() => {
  process.env.STRAVA_OAUTH_STATE_SECRET = 'test-signing-secret-abc123'
})

describe('strava oauth state (finding 7)', () => {
  it('round-trips a signed web state', () => {
    const state = signStravaState('user-1', null)
    expect(verifyStravaState(state)).toEqual({ userId: 'user-1', platform: null })
  })

  it('round-trips a signed native state', () => {
    const state = signStravaState('user-2', 'ios')
    expect(verifyStravaState(state)).toEqual({ userId: 'user-2', platform: 'ios' })
  })

  it('rejects a tampered userId (signature no longer matches)', () => {
    const state = signStravaState('victim', null)
    const [b64, sig] = state.split('.')
    const payload = Buffer.from(b64, 'base64url').toString('utf8').replace('victim', 'attacker')
    const forged = `${Buffer.from(payload).toString('base64url')}.${sig}`
    expect(verifyStravaState(forged)).toBeNull()
  })

  it('rejects an unsigned plaintext state (the old format)', () => {
    expect(verifyStravaState('some-user-id')).toBeNull()
    expect(verifyStravaState('some-user-id|ios')).toBeNull()
  })

  it('rejects a state signed with a different key', () => {
    const state = signStravaState('user-3', null)
    process.env.STRAVA_OAUTH_STATE_SECRET = 'a-different-secret'
    expect(verifyStravaState(state)).toBeNull()
    process.env.STRAVA_OAUTH_STATE_SECRET = 'test-signing-secret-abc123'
  })

  it('rejects an expired state (older than the TTL)', () => {
    const realNow = Date.now
    // Mint 11 minutes in the past (TTL is 10 minutes).
    Date.now = () => realNow() - 11 * 60 * 1000
    const stale = signStravaState('user-4', null)
    Date.now = realNow
    expect(verifyStravaState(stale)).toBeNull()
  })

  it('rejects null / malformed input', () => {
    expect(verifyStravaState(null)).toBeNull()
    expect(verifyStravaState('')).toBeNull()
    expect(verifyStravaState('no-dot-separator')).toBeNull()
    expect(verifyStravaState('.onlysig')).toBeNull()
  })
})
