import { describe, it, expect, vi, beforeEach } from 'vitest'
import { writeUserSettings, updateUserSettings, settingsWriteFailureMessage } from './userSettingsWrite'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * USER-SETTINGS-UNREAD-WRITE-01 (2026-11-08) — the error policy, under test for the first time.
 *
 * 🔴 ELEVEN OF EIGHTEEN WRITES TO THIS TABLE DROPPED THEIR ERROR, and the reason they shipped
 * green is structural: they live in `DashboardClient.tsx`, and `vitest.config.ts` is
 * `environment: 'node'` with no jsdom, so **nothing inside that component is reachable by a
 * test**. The only gate was a source-scanning arm, and a source arm cannot tell you what
 * happens when the write fails. Extracting the owner is what makes this behavioural.
 */

const ok = () => ({ error: null })
const failed = (message: string) => ({ error: { message } })

/** A client that is only ever asked for this one chain, so a wrong chain throws rather than
 *  silently returning undefined — the `absence written as a value` class. */
function client(result: unknown, verb: 'upsert' | 'update' = 'upsert') {
  const call = vi.fn().mockResolvedValue(result)
  const eq = vi.fn().mockResolvedValue(result)
  const from = vi.fn((table: string) => {
    if (table !== 'user_settings') throw new Error(`unexpected table ${table}`)
    return verb === 'upsert'
      ? { upsert: call }
      : { update: vi.fn(() => ({ eq })) }
  })
  return { sb: { from } as unknown as SupabaseClient, call, eq, from }
}

const log = vi.spyOn(console, 'error').mockImplementation(() => {})
beforeEach(() => { log.mockClear() })

describe('writeUserSettings — the happy path', () => {
  it('upserts the patch with the id, and reports success', async () => {
    const { sb, call } = client(ok())
    const onError = vi.fn()
    const landed = await writeUserSettings(sb, 'u1', { preferred_units: 'mi' },
      { what: 'unit preference', severity: 'tell_the_runner', onError })
    expect(landed).toBe(true)
    expect(call).toHaveBeenCalledWith({ id: 'u1', preferred_units: 'mi' })
    expect(onError, 'a successful write must say nothing').not.toHaveBeenCalled()
    expect(log).not.toHaveBeenCalled()
  })

  it('does NOT invent columns — the patch passes through verbatim', async () => {
    // The owner owns the ERROR POLICY, not the columns. 15 of the 18 sites stamped
    // `updated_at` and three did not; stamping it here would be a quiet behaviour change on
    // those three, in an item about error handling.
    const { sb, call } = client(ok())
    await writeUserSettings(sb, 'u1', { orientation_seen: true }, { what: 'x', severity: 'log' })
    expect(call).toHaveBeenCalledWith({ id: 'u1', orientation_seen: true })
  })
})

describe('writeUserSettings — a RETURNED { error }', () => {
  it('🔴 returns false, so an optimistic caller can revert', async () => {
    // The boolean is the point. Eleven sites set React state before awaiting and then threw
    // the error away, which is why the screen and the table could disagree indefinitely.
    const { sb } = client(failed('permission denied for table user_settings'))
    const landed = await writeUserSettings(sb, 'u1', { max_hr: 150 }, { what: 'heart rate', severity: 'log' })
    expect(landed).toBe(false)
  })

  it('always logs, whatever the severity — `log` is the floor, not an option', async () => {
    const { sb } = client(failed('boom'))
    await writeUserSettings(sb, 'u1', {}, { what: 'dismissal', severity: 'log' })
    expect(log).toHaveBeenCalledWith('[user_settings] dismissal write failed:', 'boom')
  })

  it('🔴 `tell_the_runner` calls onError with the one sentence', async () => {
    const { sb } = client(failed('boom'))
    const onError = vi.fn()
    await writeUserSettings(sb, 'u1', {}, { what: 'heart rate', severity: 'tell_the_runner', onError })
    expect(onError).toHaveBeenCalledWith(settingsWriteFailureMessage('heart rate'))
    // The voice is decided ONCE, in the owner, not eleven times at the call sites.
    expect(settingsWriteFailureMessage('heart rate')).toBe(
      "Couldn't save your heart rate. It's still set on this device, not on your account.")
  })

  it('`log` does NOT call onError even when one is passed — the severity decides, not the arg', async () => {
    // The vacuity arm in the other direction: without it, "always call onError" passes above.
    const { sb } = client(failed('boom'))
    const onError = vi.fn()
    await writeUserSettings(sb, 'u1', {}, { what: 'dismissal', severity: 'log', onError })
    expect(onError).not.toHaveBeenCalled()
  })
})

describe('writeUserSettings — a THROWN error is the same failure', () => {
  it('🔴 a rejected promise is caught, logged and reported as false', async () => {
    // supabase-js does both, and the eleven swallowed sites split between the two spellings:
    // some `void …`, some inside a bare `try {} catch {}`. A guard that handles only the
    // returned `{ error }` would leave half the class open — which is `MATCH THE EFFECT, NOT
    // THE SPELLING` exactly.
    const from = vi.fn(() => ({ upsert: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) }))
    const sb = { from } as unknown as SupabaseClient
    const onError = vi.fn()
    const landed = await writeUserSettings(sb, 'u1', {}, { what: 'heart rate', severity: 'tell_the_runner', onError })
    expect(landed).toBe(false)
    expect(log).toHaveBeenCalledWith('[user_settings] heart rate write failed:', 'Failed to fetch')
    expect(onError).toHaveBeenCalled()
  })
})

describe('updateUserSettings — the verb is preserved', () => {
  it('🔴 it UPDATEs and filters by id — it does not upsert', async () => {
    // Collapsing the two verbs would have been tidier and would have changed behaviour: an
    // `update` no-ops when the row is absent, an `upsert` CREATES it.
    const { sb, eq } = client(ok(), 'update')
    const landed = await updateUserSettings(sb, 'u1', { timezone: 'Europe/London' }, { what: 'timezone', severity: 'log' })
    expect(landed).toBe(true)
    expect(eq).toHaveBeenCalledWith('id', 'u1')
  })

  it('and it reads its error on the same policy', async () => {
    const { sb } = client(failed('nope'), 'update')
    const onError = vi.fn()
    expect(await updateUserSettings(sb, 'u1', { birth_year: 1988 },
      { what: 'year of birth', severity: 'tell_the_runner', onError })).toBe(false)
    expect(onError).toHaveBeenCalledWith(settingsWriteFailureMessage('year of birth'))
  })
})
