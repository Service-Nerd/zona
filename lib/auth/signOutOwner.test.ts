import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

// ONBOARD-EXIT-01 — the gate behind `lib/auth/signOut.ts`.
//
// WHY THIS EXISTS. The sign-out sequence forked once already and nothing
// noticed: `ConnectRunsScreen` carried a hand-rolled copy that omitted
// `clearWidgetState()`, so signing out there left the previous account's race
// countdown on the iOS widget. Nobody had to be careless for that — the second
// copy was written months after the first, by reading the screen next to it.
//
// A comment saying "use the helper" is not a mechanism. This walks the source.

const ROOTS = ['app', 'components']

/** Call sites allowed to run their own sign-out, each with its reason. */
const ALLOWED: Record<string, string> = {
  'lib/auth/signOut.ts':
    'the owner',
  'app/auth/signout/route.ts':
    'server route — @supabase/ssr cookie client, no browser session or widget to clear',
  'app/dashboard/DashboardClient.tsx#handleDelete':
    'DeleteAccountScreen.handleDelete — account DELETION, not sign-out. The sign-out is ' +
    'cleanup after /api/delete-account succeeds, and the failure path must stay on the screen ' +
    'to show the error rather than navigating away.',
}

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.(ts|tsx)$/.test(entry)) out.push(p)
  }
  return out
}

describe('sign-out has one owner', () => {
  const files = ROOTS.flatMap(walk)

  it('finds source to scan (the walker itself can silently return nothing)', () => {
    expect(files.length).toBeGreaterThan(50)
  })

  it('no screen calls auth.signOut() outside the owner', () => {
    const offenders: string[] = []
    for (const f of files) {
      const rel = f.replace(`${process.cwd()}/`, '')
      if (ALLOWED[rel]) continue
      const src = readFileSync(f, 'utf8')
      src.split('\n').forEach((line, i) => {
        if (!/\bauth\s*\.\s*signOut\s*\(/.test(line)) return
        // The delete-account flow is allowed, and lives in a 12k-line file, so
        // it is exempted by the nearest preceding `function X(` rather than by
        // whole-file allowlisting — which would exempt the Me screen too.
        const enclosing = src
          .slice(0, src.split('\n').slice(0, i).join('\n').length)
          .match(/function\s+(\w+)/g)
          ?.slice(-1)[0]
          ?.replace('function ', '')
        if (enclosing && ALLOWED[`${rel}#${enclosing}`]) return
        offenders.push(`${rel}:${i + 1}${enclosing ? ` (in ${enclosing})` : ''}`)
      })
    }
    expect(
      offenders,
      `hand-rolled sign-out found. Use signOutAndReturnToLogin() from ` +
      `lib/auth/signOut.ts, or add the site to ALLOWED with a reason:\n  ` +
      offenders.join('\n  ')
    ).toEqual([])
  })

  it('every ALLOWED entry still exists (a stale exemption is a hole)', () => {
    for (const key of Object.keys(ALLOWED)) {
      const [rel, fn] = key.split('#')
      const src = readFileSync(join(process.cwd(), rel), 'utf8')
      expect(/\bauth\s*\.\s*signOut\s*\(/.test(src), `${rel} no longer signs out`).toBe(true)
      if (fn) expect(src.includes(`function ${fn}`), `${rel} has no ${fn}`).toBe(true)
    }
  })

  it('never navigates with window.location — that is the Safari escape', () => {
    // 🔴 FOUND ON DEVICE. Capacitor iOS treats a full-document load to any URL
    // that does not literally start with `server.url` as an EXTERNAL link and
    // hands it to Safari. `server.url` is 'https://www.zonna.run/dashboard',
    // so '/auth/login' failed that prefix test and signing out threw the user
    // out of the app into a browser — still signed in. A history navigation
    // never reaches `decidePolicyFor`, so `router.replace` cannot escape.
    // capacitor.config.ts also allow-lists our host now, but that needs a
    // NATIVE BUILD; this file ships over the air, so the rule lives here too.
    for (const rel of ['lib/auth/signOut.ts', 'components/shared/SignOutLink.tsx']) {
      const src = readFileSync(join(process.cwd(), rel), 'utf8')
        .split('\n').filter(l => !l.trim().startsWith('*') && !l.trim().startsWith('//')).join('\n')
      expect(src, `${rel} navigates with window.location`).not.toMatch(/window\s*\.\s*location/)
    }
  })

  it('the owner clears widget state BEFORE ending the session', () => {
    const src = readFileSync(join(process.cwd(), 'lib/auth/signOut.ts'), 'utf8')
    expect(src.indexOf('clearWidgetState')).toBeLessThan(src.indexOf('auth.signOut'))
  })
})
