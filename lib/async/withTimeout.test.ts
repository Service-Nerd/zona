// BOOT-STALL-DIAGNOSE-01 (2026-11-04). The boot's seven-query `Promise.all` had no bound, so a supabase-js
// fetch that never settled left the launch screen up until the 12s watchdog rescued it — 105 production
// `gate: 'settings'` rows with no attributable cause. These arms hold the bound shut.
//
// BEHAVIOURAL, not source assertions: this module is pure async and `vitest` runs `environment: 'node'`, so
// the real property ("a promise that NEVER settles still lets the caller continue") is directly testable.
import { describe, it, expect, vi } from 'vitest'
import { withTimeout, withTimeoutFallback, TimeoutError } from './withTimeout'

/** The case the whole module exists for: a promise with no resolve path, like a killed iOS fetch. */
const never = () => new Promise<string>(() => {})
const after = <T,>(ms: number, v: T) => new Promise<T>(r => setTimeout(() => r(v), ms))

describe('withTimeout — rejects, for a caller whose failure path is real', () => {
  it('passes the value through when the promise wins', async () => {
    await expect(withTimeout(after(1, 'ok'), 200, 'x')).resolves.toBe('ok')
  })
  it('🔴 a promise that NEVER settles rejects, rather than hanging the caller for good', async () => {
    await expect(withTimeout(never(), 20, 'boot.settings')).rejects.toThrow(TimeoutError)
  })
  it('the rejection names the await and the bound, so a log says WHICH one stalled', async () => {
    const err = await withTimeout(never(), 20, 'boot.settings').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(TimeoutError)
    expect((err as TimeoutError).label).toBe('boot.settings')
    expect((err as TimeoutError).ms).toBe(20)
    expect((err as Error).name).toBe('TimeoutError')
    expect((err as Error).message).toContain('boot.settings')
  })
  it('a real rejection from the promise is propagated, never turned into a timeout', async () => {
    const boom = new Error('permission denied for table user_settings')
    await expect(withTimeout(Promise.reject(boom), 200, 'x')).rejects.toBe(boom)
  })
  it('🔴 Promise.all semantics hold: the slowest member decides, and an unsettling member still times out', async () => {
    const p = Promise.all([after(1, 'a'), never(), after(2, 'c')])
    await expect(withTimeout(p, 20, 'boot.settings')).rejects.toThrow(TimeoutError)
  })
  it('clears its timer once the race settles, so it leaves no open handle behind', async () => {
    vi.useFakeTimers()
    try {
      const p = withTimeout(Promise.resolve('fast'), 10_000, 'x')
      await expect(p).resolves.toBe('fast')
      expect(vi.getTimerCount(), 'a live timer would hold a node process open and fire into a settled race').toBe(0)
    } finally { vi.useRealTimers() }
  })
})

describe('withTimeoutFallback — resolves, for a caller where absence is a legitimate answer', () => {
  it('passes the value through when the promise wins', async () => {
    await expect(withTimeoutFallback(after(1, 'real'), 200, 'fb')).resolves.toBe('real')
  })
  it('🔴 a promise that NEVER settles resolves with the fallback', async () => {
    await expect(withTimeoutFallback(never(), 20, 'fb')).resolves.toBe('fb')
  })
  it('null is a usable fallback (the benchmark estimate passes exactly that)', async () => {
    await expect(withTimeoutFallback<string | null>(never(), 20, null)).resolves.toBeNull()
  })
  it('clears its timer once the race settles', async () => {
    vi.useFakeTimers()
    try {
      await expect(withTimeoutFallback(Promise.resolve('fast'), 10_000, 'fb')).resolves.toBe('fast')
      expect(vi.getTimerCount()).toBe(0)
    } finally { vi.useRealTimers() }
  })
})

describe('the owner has both call sites, so neither re-rolls its own bound', () => {
  it('the boot rejects and the benchmark estimate falls back — two semantics, one module', async () => {
    const { readFileSync } = await import('node:fs')
    const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    const dash = strip(readFileSync('app/dashboard/DashboardClient.tsx', 'utf8'))
    const gen = strip(readFileSync('app/dashboard/GeneratePlanScreen.tsx', 'utf8'))
    expect(dash).toContain("from '@/lib/async/withTimeout'")
    expect(gen).toContain("from '@/lib/async/withTimeout'")
    // 🔴 the twin: a second local copy of the bound is how the boot came to have none at all
    expect(gen, 'GeneratePlanScreen must not re-declare its own withTimeout').not.toMatch(/const withTimeout(Fallback)? =/)
    expect(dash).not.toMatch(/const withTimeout(Fallback)? =/)
  })
})
