// BOOT-HANG-01 (2026-10-25). The founder's phone sat on the loading screen (wordmark + "Hold the zone.") until it was
// force-closed. The boot was one-shot: a session that would not verify returned silently, the WHOLE boot sat inside a
// `} catch {}`, and nothing timed out. These arms hold each dead end shut.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BOOT_STALL_MS, BOOT_STALL_GATES, stalledGate, BOOT_STALLED_TITLE, BOOT_STALLED_ACTION } from './bootWatchdog'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const dash = read('app/dashboard/DashboardClient.tsx')
/** The boot function, bounded on its own declaration and the comment that follows it. */
const boot = dash.slice(dash.indexOf('async function fetchSettingsOnce()'), dash.indexOf('// Use onAuthStateChange rather than calling fetchSettings()'))

const all = { authResolved: true, appReady: true, runAnalysisReady: true, stravaGateOpen: true }

describe('stalledGate — the first gate still holding, in boot order', () => {
  it('booted → null', () => expect(stalledGate(all)).toBeNull())
  it('each gate, alone and with every later gate also shut', () => {
    expect(stalledGate({ ...all, authResolved: false, appReady: false, runAnalysisReady: false, stravaGateOpen: false })).toBe('auth')
    expect(stalledGate({ ...all, appReady: false, runAnalysisReady: false, stravaGateOpen: false })).toBe('settings')
    expect(stalledGate({ ...all, runAnalysisReady: false, stravaGateOpen: false })).toBe('run_analysis')
    expect(stalledGate({ ...all, stravaGateOpen: false })).toBe('strava')
  })
  it('every gate stalledGate can return is one the route accepts', () => {
    for (const g of ['auth', 'settings', 'run_analysis', 'strava']) expect(BOOT_STALL_GATES).toContain(g)
  })
  it('the stall limit sits past the native splash timeout, so a slow cold start is never called a stall', () => {
    const splash = Number(/launchShowDuration:\s*(\d+)/.exec(read('capacitor.config.ts'))![1])
    expect(BOOT_STALL_MS).toBeGreaterThan(splash)
  })
})

describe('the dashboard boot has no dead end', () => {
  it('🔴 no `} catch {}` swallows the boot', () => {
    expect(boot.length).toBeGreaterThan(1000)
    const topLevel = boot.split('\n').filter(l => /^      \} catch/.test(l))
    expect(topLevel, 'a top-level catch inside the boot hides every throw before setAppReady').toEqual([])
  })
  it('🔴 a session that will not verify goes to login, never a bare return', () => {
    const at = boot.indexOf('await supabase.auth.getUser()')
    const line = boot.slice(at, boot.indexOf('setUserId(user.id)', at))
    expect(line).toMatch(/if \(!user\) \{ router\.replace\('\/auth\/login'\); return \}/)
  })
  it('every release of the loading screen is marked, so a post-boot throw is not called a stall', () => {
    const code = dash.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    const sites = code.match(/setAppReady\(true\)/g) ?? []
    const marked = code.match(/appReleasedRef\.current = true; setAppReady\(true\)/g) ?? []
    expect(sites.length).toBeGreaterThan(0)
    expect(marked.length).toBe(sites.length)
  })
  it('🔴 the loading screen yields to Try again once stalled', () => {
    const at = dash.indexOf('if (!bootReady) {')
    expect(dash.slice(at, at + 400)).toContain('if (bootStall) return <BootStalled')
  })
  it('🔴 the watchdog reads the CURRENT gates (a ref written every render), not the mount-time closure', () => {
    expect(dash).toMatch(/bootGatesRef\.current = \{ authResolved, appReady, runAnalysisReady, stravaGateOpen \}/)
    const t = dash.indexOf('stalledGate(bootGatesRef.current)')
    expect(t).toBeGreaterThan(-1)
    expect(dash.slice(t, t + 300)).toContain('BOOT_STALL_MS')
  })
})

describe('BootStalled renders the §8 Empty State with its one action', () => {
  it('the approved words, one button', async () => {
    const React = (await import('react')).default
    const { renderToStaticMarkup } = await import('react-dom/server')
    ;(globalThis as { React?: unknown }).React = React
    const { BootStalled } = await import('@/components/dashboard/BootStalled')
    const html = renderToStaticMarkup(React.createElement(BootStalled, { onRetry: () => {} }))
    expect(html).toContain(BOOT_STALLED_TITLE)
    expect(html.match(/<button/g) ?? []).toHaveLength(1)
    expect(html).toContain(BOOT_STALLED_ACTION)
  })
})

const R = vi.hoisted(() => ({ events: [] as unknown[][], allow: true, user: null as null | { id: string } }))
vi.mock('@/lib/ops/recordOpsEvent', () => ({ recordOpsEvent: async (...a: unknown[]) => { R.events.push(a) } }))
vi.mock('@/lib/ai/rateLimit', () => ({ checkRateLimit: async () => R.allow }))
vi.mock('@/lib/supabase/getUserFromRequest', () => ({ getUserFromRequest: async () => R.user }))
const post = async (body: unknown) => {
  const { POST } = await import('@/app/api/ops/boot-report/route')
  const res = await POST(new Request('https://x/api/ops/boot-report', { method: 'POST', body: JSON.stringify(body) }) as never)
  return res.status
}
beforeEach(() => { R.events = []; R.allow = true; R.user = null })

describe('POST /api/ops/boot-report', () => {
  it('🔴 records without a session, because a stalled auth is one of the things it reports', async () => {
    expect(await post({ gate: 'auth', elapsed_ms: 12000, native: true })).toBe(200)
    expect(R.events).toEqual([['boot_stalled', { gate: 'auth', elapsed_ms: 12000, native: true }, null]])
  })
  it('attributes the row when a valid bearer came with it', async () => {
    R.user = { id: 'u1' }
    await post({ gate: 'settings', elapsed_ms: 12000 })
    expect(R.events[0][2]).toBe('u1')
  })
  it('🔴 an unknown gate writes nothing', async () => {
    expect(await post({ gate: 'drop table', elapsed_ms: 1 })).toBe(400)
    expect(R.events).toEqual([])
  })
  it('rate-limited writes nothing', async () => {
    R.allow = false
    expect(await post({ gate: 'auth' })).toBe(429)
    expect(R.events).toEqual([])
  })
})
