// BOOT-HANG-01 (2026-10-25). The founder's phone sat on the loading screen (wordmark + "Hold the zone.") until it was
// force-closed. The boot was one-shot: a session that would not verify returned silently, the WHOLE boot sat inside a
// `} catch {}`, and nothing timed out. These arms hold each dead end shut.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  BOOT_STALL_MS, BOOT_STALL_GATES, stalledGate, BOOT_STALLED_TITLE, BOOT_STALLED_ACTION,
  BOOT_QUERY_TIMEOUT_MS, BOOT_ERR_KINDS, BOOT_ELAPSED_MAX_MS, BOOT_STAGES, BOOT_GATE_DISTRIBUTION_2026_11_04,
  bootErrKind,
} from './bootWatchdog'
import { TimeoutError } from '@/lib/async/withTimeout'

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
    const at = boot.indexOf('supabase.auth.getUser()')
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
    // Bounded on the timer's literal closing edge, not a character count: the body grew when the report
    // gained its measured elapsed, and a slice length is a silent way for an arm to stop reaching its subject.
    expect(dash.slice(t, dash.indexOf('}, BOOT_STALL_MS)', t) + 20)).toContain('BOOT_STALL_MS')
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
    expect(R.events).toEqual([['boot_stalled', { gate: 'auth', elapsed_ms: 12000, native: true, hidden: false }, null]])
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

// ── BOOT-STALL-DIAGNOSE-01 (2026-11-04) ─────────────────────────────────────────────────────────────────
// 125 production stalls arrived under BOOT-HANG-01 and none could say why: `elapsed_ms` was handed the
// CONSTANT `BOOT_STALL_MS` (109 of 125 rows read exactly 12000), there was no way to tell a backgrounded
// iOS launch from a hang, and 16 `gate: 'error'` rows named no cause. These arms hold all three shut.
//
// ⚠️ The DashboardClient arms are source assertions, because `vitest` runs `environment: 'node'` with no
// jsdom and this component cannot be rendered here. Each one strips comments first — this repo has recorded
// twice that a source assertion otherwise passes on a comment that merely describes the intent.

const stripped = dash.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
/** Boot start → the `setAppReady(true)` that releases the MAIN path. Everything in here runs while the
 *  launch screen is up, so everything in here reports as `gate: 'settings'` when it stalls. */
const criticalPath = (() => {
  const ls = stripped.split('\n')
  const start = ls.findIndex(l => l.includes('async function fetchSettingsOnce()'))
  const rel = ls.findIndex((l, i) => i > start + 200 && l.includes('appReleasedRef.current = true; setAppReady(true)'))
  if (start < 0 || rel < 0) throw new Error('boot critical path not found — the arms below would silently pass')
  return ls.slice(start, rel).join('\n')
})()
/** The watchdog's own timer body, bounded on its two literal edges rather than grepped from the whole file. */
const watchdogBody = stripped.slice(
  stripped.indexOf('stalledGate(bootGatesRef.current)'),
  stripped.indexOf('}, BOOT_STALL_MS)'),
)

describe('elapsed_ms is a measurement, not the constant it used to be', () => {
  it('🔴 the watchdog reports a MEASURED elapsed, never BOOT_STALL_MS', () => {
    expect(watchdogBody.length).toBeGreaterThan(100)
    expect(watchdogBody).toContain('Date.now() - bootStartedAtRef.current')
    expect(
      watchdogBody,
      'passing the constant is the original defect: the field then measures nothing and every row reads 12000',
    ).not.toContain('elapsedMs: BOOT_STALL_MS')
  })
  it('🔴 the error path reports elapsed too, instead of a hardcoded 0', () => {
    const at = stripped.indexOf("gate: 'error',")
    expect(at).toBeGreaterThan(-1)
    const body = stripped.slice(at, at + 400)
    expect(body).toContain('Date.now() - bootStartedAtRef.current')
    expect(body).not.toMatch(/elapsedMs:\s*0/)
  })
  it('the boot start is latched once per mount, at mount', () => {
    expect(stripped).toMatch(/bootStartedAtRef = useRef\(Date\.now\(\)\)/)
  })
})

describe('hidden separates a backgrounded launch from a hang', () => {
  it('🔴 both reports carry the hidden latch', () => {
    const reports = stripped.match(/reportBootStall\(\{[\s\S]*?\}\)/g) ?? []
    expect(reports).toHaveLength(2)
    for (const r of reports) expect(r).toContain('hidden: bootEverHiddenRef.current')
  })
  it('🔴 it is a LATCH over the whole boot, not visibilityState read at fire time', () => {
    expect(stripped).toContain("document.addEventListener('visibilitychange'")
    expect(watchdogBody, 'reading the state at fire time calls every resumed launch a hang').not.toContain('visibilityState')
  })
  it('it is seeded from the current state, for a launch straight into the background', () => {
    expect(stripped).toMatch(/bootEverHiddenRef = useRef\([\s\S]{0,120}visibilityState === 'hidden'\)/)
  })
  it('the listener is removed on unmount', () => {
    expect(stripped).toContain("document.removeEventListener('visibilitychange', onHide)")
  })
})

describe('the boot awaits are bounded — the mechanism behind 105 settings rows', () => {
  it('🔴 getUser is bounded', () => {
    expect(boot).toMatch(/withTimeout\(supabase\.auth\.getUser\(\), BOOT_QUERY_TIMEOUT_MS/)
  })
  it('🔴 the seven-query Promise.all is bounded — its slowest member decides the whole launch', () => {
    expect(boot).toContain('await withTimeout(Promise.all([')
    expect(boot).toContain("]), BOOT_QUERY_TIMEOUT_MS, 'settings')")
  })
  it('🔴 NOTHING on the critical path to setAppReady is unbounded — all six awaits, not the two obvious ones', () => {
    // 🔴 THE POPULATION IS THE WHOLE CRITICAL PATH, derived from the code. The first version of this fix
    // bounded the two awaits at the TOP of the boot and left four more below it (the plan load, pre-session
    // readiness, the second seven-query batch, taper recalibration) — every one of them before `appReady`
    // is set, so every one of them reports as the same uninformative `settings`.
    expect(criticalPath.length).toBeGreaterThan(2000)
    for (const [name, re] of [
      ['Promise.all', /await Promise\.all\(/g],
      ['authedFetch', /await authedFetch\(/g],
      ['fetch', /await fetch\(/g],
      ['fetchPlanForUser', /await fetchPlanForUser\(/g],
      // 🔴 `fetch` resolves on HEADERS. An unbounded `.json()` is a second await per call and hangs the
      // boot exactly as the request does — the first version of this arm could not see either site.
      ['response .json()', /await \w+Res\.json\(\)/g],
    ] as const) {
      expect(criticalPath.match(re) ?? [], `unbounded await ${name}() can hang the launch screen for good`).toEqual([])
    }
  })
  it('🔴 every stage label the boot passes is one the route will accept', () => {
    // The route drops an unrecognised stage rather than storing it, so a plausible-but-wrong label is
    // silently lost — `'boot.settings'` type-checked and would have recorded no stage at all.
    const used = Array.from(criticalPath.matchAll(/BOOT_QUERY_TIMEOUT_MS, '([^']+)'/g), m => m[1])
    expect(used.length).toBe(8)   // six awaits + the two response-body reads
    for (const u of used) expect(BOOT_STAGES, `stage '${u}' is not in BOOT_STAGES`).toContain(u)
  })
  it('🔴 all six stages are covered, and a body read reuses its own request\'s stage', () => {
    const used = Array.from(criticalPath.matchAll(/BOOT_QUERY_TIMEOUT_MS, '([^']+)'/g), m => m[1])
    expect(new Set(used).size).toBe(BOOT_STAGES.length)
    expect(Array.from(new Set(used)).sort()).toEqual(Array.from(BOOT_STAGES).sort())
  })
  it('🔴 the bound must sit WELL BEYOND the watchdog, or it destroys BOOT-HANG-01 self-heal', () => {
    // Two wrong answers before this one. `BOOT_STALL_MS - 2_000` (so an error row beats the watchdog) and
    // then `BOOT_STALL_MS` ("can only fire on a boot already lost") BOTH break the self-heal: the watchdog
    // shows Try again at 12s but does not abandon the boot, so a launch settling at 16s still renders the
    // dashboard on its own. A bound at or under 12s rejects that boot and strands a runner who was fine.
    expect(BOOT_QUERY_TIMEOUT_MS).toBeGreaterThan(BOOT_STALL_MS * 2)
  })
  it('🔴 the self-heal the bound must not break: the stall screen yields the moment the boot finishes', () => {
    // `if (!bootReady)` guards the stall screen, so it stops applying as soon as the boot completes.
    const at = stripped.indexOf('if (!bootReady) {')
    expect(at).toBeGreaterThan(-1)
    expect(stripped.slice(at, at + 200)).toContain('if (bootStall) return <BootStalled')
  })
  it('attribution comes from the in-flight stage ref, NOT from the bound winning a race it cannot win', () => {
    // The bound is PER-AWAIT and the watchdog is ABSOLUTE from mount, so for any stage after the first the
    // watchdog fires first by construction. The ref is what makes its row attributable.
    expect(criticalPath.match(/bootStageRef\.current = '/g) ?? []).toHaveLength(6)
    expect(watchdogBody).toContain('stage: bootStageRef.current')
  })
})

describe('one row per boot failure', () => {
  it('🔴 both reporters latch, so a timeout cannot write an error row AND a settings row', () => {
    // Measured 2026-11-04: 10 of 16 production `error` rows had a `settings` row from the same runner
    // within 3s. The error path reported, the boot stayed un-ready, the watchdog reported it again.
    expect(stripped.match(/bootReportedRef\.current = true/g) ?? []).toHaveLength(2)
    const guards = stripped.match(/if \(bootReportedRef\.current\) return/g) ?? []
    expect(guards, 'each reporter must bail when the other already reported').toHaveLength(2)
  })
  it('the latch is checked BEFORE the report in both places', () => {
    for (const m of Array.from(stripped.matchAll(/reportBootStall\(\{/g))) {
      const before = stripped.slice(Math.max(0, m.index! - 400), m.index!)
      expect(before).toContain('bootReportedRef.current = true')
    }
  })
})

describe('the plan-read-failed screen is reachable', () => {
  it('🔴 the PlanReadError path opens EVERY boot gate, or its screen never renders', () => {
    const at = stripped.indexOf('setPlanLoadFailed(true)')
    expect(at).toBeGreaterThan(-1)
    const path = stripped.slice(at, stripped.indexOf('return', at) + 6)
    // bootReady = appReady && runAnalysisReady && stravaGateOpen — releasing only appReady leaves the
    // splash up and sends the runner to Try again at 12s instead of PlanLoadFailed.
    expect(path).toContain('setRunAnalysisReady(true)')
    expect(path).toContain('setAppReady(true)')
  })
})

describe('bootErrKind — why the boot threw, as an enum', () => {
  it('a TimeoutError from the bound classifies as timeout', () => {
    expect(bootErrKind(new TimeoutError('boot.settings', 10000))).toBe('timeout')
  })
  it('the postgrest/RLS shape classifies as denied', () => {
    expect(bootErrKind(new Error('permission denied for table user_settings'))).toBe('denied')
    expect(bootErrKind(new Error('JWT expired'))).toBe('denied')
  })
  it('the iOS webview fetch failure classifies as network', () => {
    expect(bootErrKind(new TypeError('Load failed'))).toBe('network')
    expect(bootErrKind(new TypeError('Failed to fetch'))).toBe('network')
  })
  it('anything else is unknown, never a guess', () => {
    expect(bootErrKind(new Error('something odd'))).toBe('unknown')
    expect(bootErrKind(undefined)).toBe('unknown')
    expect(bootErrKind({})).toBe('unknown')
  })
  it('every kind it can return is one the route accepts', () => {
    const cases = [new Error('timeout'), new Error('permission denied'), new Error('Load failed'), null]
    for (const c of cases) expect(BOOT_ERR_KINDS).toContain(bootErrKind(c))
  })
})

describe('POST /api/ops/boot-report — the new facts, and the enum-only property', () => {
  it('records hidden', async () => {
    await post({ gate: 'settings', elapsed_ms: 4321, native: true, hidden: true })
    expect(R.events[0][1]).toEqual({ gate: 'settings', elapsed_ms: 4321, native: true, hidden: true })
  })
  it('records a valid err_kind', async () => {
    await post({ gate: 'error', elapsed_ms: 900, err_kind: 'timeout' })
    expect((R.events[0][1] as { err_kind?: string }).err_kind).toBe('timeout')
  })
  it('🔴 an err_kind outside the enum is DROPPED, not stored — auth here is optional, so free text is a hole', async () => {
    expect(await post({ gate: 'error', err_kind: '<script>alert(1)</script>' })).toBe(200)
    expect(R.events[0][1]).not.toHaveProperty('err_kind')
  })
  it('🔴 elapsed_ms is clamped, so one absurd client value cannot distort the field being fixed', async () => {
    await post({ gate: 'auth', elapsed_ms: 99 * 60 * 60 * 1000 })
    expect((R.events[0][1] as { elapsed_ms: number }).elapsed_ms).toBe(BOOT_ELAPSED_MAX_MS)
  })
  it('a nonsense elapsed_ms is null, never 0 — 0 would read as an instant boot', async () => {
    for (const bad of [-1, NaN, Infinity, 'soon', null]) {
      R.events = []
      await post({ gate: 'auth', elapsed_ms: bad })
      expect((R.events[0][1] as { elapsed_ms: number | null }).elapsed_ms, String(bad)).toBeNull()
    }
  })
})

describe('the measured gate distribution is recorded as an observation, not a proof', () => {
  it('🔴 a zero is never claimed as "unreachable" — run_analysis WAS reachable, by a bug', () => {
    const d = BOOT_GATE_DISTRIBUTION_2026_11_04
    expect(Object.keys(d).sort()).toEqual(Array.from(BOOT_STALL_GATES).sort())
    expect(Object.values<number>(d).reduce((a, b) => a + b, 0)).toBe(125)
    expect(d.run_analysis).toBe(0)
  })
  it('every gate it names is one stalledGate or the error path can produce', () => {
    for (const g of Object.keys(BOOT_GATE_DISTRIBUTION_2026_11_04)) expect(BOOT_STALL_GATES).toContain(g)
  })
})

describe('POST /api/ops/boot-report — the stage', () => {
  it('records a valid stage', async () => {
    await post({ gate: 'error', elapsed_ms: 10_000, err_kind: 'timeout', stage: 'plan' })
    expect((R.events[0][1] as { stage?: string }).stage).toBe('plan')
  })
  it('🔴 a stage outside the enum is DROPPED — the route takes no free text from an optional-auth caller', async () => {
    expect(await post({ gate: 'error', stage: 'boot.settings' })).toBe(200)
    expect(R.events[0][1]).not.toHaveProperty('stage')
  })
  it('every stage the enum declares round-trips through the route', async () => {
    for (const st of BOOT_STAGES) {
      R.events = []
      await post({ gate: 'error', err_kind: 'timeout', stage: st })
      expect((R.events[0][1] as { stage?: string }).stage).toBe(st)
    }
  })
})
