import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  CONNECTION_STALE_DAYS, connectionFreshness, connectionStaleCopy,
  connectionToneVar, daysSince, type ConnectionFreshness,
} from './connectionFreshness'

const NOW = new Date('2026-10-07T12:00:00.000Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString()
const ALL: ConnectionFreshness[] = ['fresh', 'stale', 'never', 'not_connected']

describe('HEALTH-SYNC-STALENESS-01 — a row reports arrival, not authorisation', () => {
  it('authorised with NOTHING ever arrived is `never` — the five 93-day runners', () => {
    // 13 of 28 connected users, measured in production 2026-10-07. The row said
    // "Connected" to all of them.
    expect(connectionFreshness('2026-06-06T00:00:00Z', null, NOW)).toBe('never')
    expect(connectionFreshness('2026-06-06T00:00:00Z', undefined, NOW)).toBe('never')
  })

  it("the founder's 17 silent days read as stale", () => {
    expect(connectionFreshness('2026-05-01T00:00:00Z', daysAgo(17), NOW)).toBe('stale')
  })

  it('a working pipe is fresh, and the threshold is the boundary', () => {
    expect(connectionFreshness('x', daysAgo(1), NOW)).toBe('fresh')
    expect(connectionFreshness('x', daysAgo(CONNECTION_STALE_DAYS), NOW)).toBe('fresh')
    expect(connectionFreshness('x', daysAgo(CONNECTION_STALE_DAYS + 1), NOW)).toBe('stale')
  })

  it('never authorised is not a staleness question', () => {
    expect(connectionFreshness(null, null, NOW)).toBe('not_connected')
    expect(connectionFreshness(undefined, daysAgo(1), NOW)).toBe('not_connected')
  })

  it('an unparseable arrival degrades to `never`, never to `fresh`', () => {
    // The dangerous default is claiming it works.
    expect(connectionFreshness('x', 'not-a-date', NOW)).toBe('never')
  })

  // ⛔ SILVANTO'S BINDING AMENDMENT. If this arm goes green on a string, the
  // ruling has been reversed and the row has started confirming its own health.
  it('SILENCE WHEN FRESH: no sub-line for a working connection', () => {
    expect(connectionStaleCopy('fresh', daysAgo(1), 'Apple Health', NOW)).toBeNull()
    expect(connectionStaleCopy('not_connected', null, 'Apple Health', NOW)).toBeNull()
  })

  // 🎓 SIERRA'S AMENDMENT. `@capgo/capacitor-health` resolves a DENIED read as an
  // EMPTY RESULT, so nothing on the device can tell "permission off" from "has not
  // run". Claiming either would be a guess.
  it('STATES THE FACT, NEVER THE CAUSE', () => {
    const never = connectionStaleCopy('never', null, 'Apple Health', NOW)!
    const stale = connectionStaleCopy('stale', daysAgo(17), 'Apple Health', NOW)!
    for (const copy of [never, stale]) {
      expect(copy).not.toMatch(/permission|denied|off|disabled|blocked|error|failed/i)
      expect(copy).not.toMatch(/you have not|havent|haven't run|lazy/i)
    }
    expect(stale).toBe('Last run synced 17 days ago.')
    expect(never).toContain('Nothing has synced yet')
  })

  it('names its own source, so the Strava twin does not say Apple Health', () => {
    expect(connectionStaleCopy('never', null, 'Strava', NOW)).toContain('Strava')
    expect(connectionStaleCopy('never', null, 'Strava', NOW)).not.toContain('Apple Health')
  })

  it('no em dash in any sentence the runner reads', () => {
    for (const f of ALL) {
      const c = connectionStaleCopy(f, daysAgo(40), 'Apple Health', NOW)
      if (c) expect(c).not.toContain('—')
    }
  })

  it('tone follows the ruled §17c scale and never invents a colour', () => {
    expect(connectionToneVar('fresh')).toBe('var(--moss)')
    expect(connectionToneVar('stale')).toBe('var(--warn)')
    expect(connectionToneVar('never')).toBe('var(--warn)')
    expect(connectionToneVar('not_connected')).toBe('var(--text-muted)')
    // --danger is errors-only (CLAUDE.md); a dead pipe is not a form error.
    for (const f of ALL) expect(connectionToneVar(f)).not.toContain('--danger')
  })

  it('a future-dated run reads as today, never as negative days', () => {
    expect(daysSince(new Date(NOW.getTime() + 86_400_000).toISOString(), NOW)).toBe(0)
  })
})

// ⚠️ THE ARMS THAT MATTER, and the reason they are source-shaped: `vitest.config.ts`
// is `environment: 'node'` with no jsdom, so these three components cannot be
// mounted. The owner above can be correct, tested and reach nothing — the inert
// class this repo has paid for in `--s-long`, decorative config and
// `getLastSyncIso` itself. Narrow by construction: each asserts a CALL, and the
// one thing each would have had to lose to regress.
describe('HEALTH-SYNC-STALENESS-01 — the three surfaces actually call it', () => {
  const read = (p: string) => readFileSync(p, 'utf8')

  it('the Apple Health row resolves tone and renders the stale line', () => {
    const src = read('components/dashboard/AppleHealthConnectionRow.tsx')
    expect(src).toContain('connectionFreshness(connectedAt, lastArrival)')
    expect(src).toContain('{staleCopy}')
    // The System-B alias is gone from the status line.
    expect(src).not.toContain("connected ? 'var(--teal)'")
  })

  it('the ME-ATHLETE Recovery row no longer hardcodes its state', () => {
    const src = read('components/dashboard/MeScreen.tsx')
    // It was an unconditional 0.4-opacity moss dot plus "Connect below" for everyone.
    expect(src).toContain('connectionToneVar(hkFreshness)')
    expect(src).not.toContain("background: 'var(--moss)', flexShrink: 0, opacity: 0.4")
  })

  it('the Strava twin got the same mechanism', () => {
    const src = read('components/dashboard/MeScreen.tsx')
    expect(src).toContain('{stravaStaleCopy}')
    expect(src).toContain('<StravaConnectionRow lastArrival={lastStravaArrival} />')
  })

  it('the parent derives arrivals from the activity list, NOT from localStorage', () => {
    const src = read('app/dashboard/DashboardClient.tsx')

    // 🔴 BOUND THE REGION, NEVER GREP THE FILE. The first version of this arm
    // asserted the WHOLE FILE did not contain `getLastSyncIso`, and it went red
    // on THE COMMENT I HAD JUST WRITTEN explaining why the derivation does not use
    // it. That is the "an ownership arm matching its own comment" class recorded
    // on 2026-10-01, repeated six days later. The region is the memo body.
    const start = src.indexOf('const lastArrivalBySource = useMemo(')
    expect(start).toBeGreaterThan(-1)
    const body = src.slice(start, src.indexOf('}, [stravaRuns])', start))

    // Server-side truth, read off the list already in memory.
    expect(body).toContain('stravaRuns')
    expect(body).toContain("'apple_health'")
    expect(body).toContain("'strava'")
    // 📱 Wroblewski: localStorage answers "this device", not "this runner".
    expect(body).not.toMatch(/localStorage|getLastSyncIso/)
  })
})
