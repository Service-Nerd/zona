import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join } from 'path'

// AUTH-BEARER-MISSING-01 — the gate behind `lib/supabase/authedFetch.ts`.
//
// WHY THIS EXISTS. `getUserFromRequest` reads the Authorization header and only
// falls back to cookies, and @supabase/ssr cookie sync to the server is
// unreliable on native (Capacitor). So every client call to an authenticated
// route MUST send the bearer explicitly. Two sites forgot — the foundation add
// and `/api/recalibrate-zones` (a PAID feature, ADR-014) — and nothing noticed
// because a 401 there is silent: the paid runner just sees "it didn't work".
//
// A comment saying "use authedFetch" is not a mechanism. This walks the source:
// for every bare `fetch('/api/…')`, it resolves the route and, if the route is
// authenticated, requires the call to carry an Authorization header. The clean
// way to satisfy it is `authedFetch` (which does not match the bare-fetch scan);
// a hand-rolled inline bearer also passes, for the one site (wizard-benchmark)
// that wraps getSession() in its own native timeout authedFetch cannot provide.

const ROOTS = ['app', 'components']

/**
 * Bare-fetch sites to a `/api/` route that are allowed to send NO bearer, each
 * with its reason. Public routes (no getUserFromRequest) pass automatically and
 * do not need listing — this is only for an authed route deliberately called
 * without a token, which should essentially never happen.
 */
const ALLOWED: Record<string, string> = {}

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

/** The full text of a `fetch(...)` call, read from its `(` until parens balance. */
function callText(src: string, fetchIdx: number): string {
  const open = src.indexOf('(', fetchIdx)
  if (open === -1) return ''
  let depth = 0
  for (let i = open; i < src.length; i++) {
    if (src[i] === '(') depth++
    else if (src[i] === ')') { depth--; if (depth === 0) return src.slice(open, i + 1) }
  }
  return src.slice(open)
}

/** Does the route at `/api/<subpath>` authenticate via getUserFromRequest? */
function routeNeedsAuth(subpath: string): boolean | null {
  for (const ext of ['ts', 'tsx']) {
    const routeFile = join(process.cwd(), 'app', 'api', subpath, `route.${ext}`)
    if (existsSync(routeFile)) return /getUserFromRequest/.test(readFileSync(routeFile, 'utf8'))
  }
  return null // route file not found (dynamic segment / rewrite) — can't judge
}

// `fetch('/api/x'` / `fetch("/api/x"` / `fetch(`/api/x` — captures the subpath up
// to a quote, backtick, `?`, whitespace or `)`. `authedFetch(` cannot match: it
// has no lowercase "fetch(" boundary, and it passes the url as its first arg.
const BARE_API_FETCH = /\bfetch\(\s*[`'"]\/api\/([^`'"?\s)]+)/g

describe('every authenticated /api fetch sends a bearer', () => {
  const files = ROOTS.flatMap(walk)

  it('finds source to scan (the walker itself can silently return nothing)', () => {
    expect(files.length).toBeGreaterThan(50)
  })

  it('no bare fetch to an authed route omits the Authorization header', () => {
    const offenders: string[] = []
    const unresolved: string[] = []
    for (const f of files) {
      const rel = f.replace(`${process.cwd()}/`, '')
      const src = readFileSync(f, 'utf8')
      BARE_API_FETCH.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = BARE_API_FETCH.exec(src)) !== null) {
        const subpath = m[1]
        const line = src.slice(0, m.index).split('\n').length
        const site = `${rel}:${line} (/api/${subpath})`
        const needsAuth = routeNeedsAuth(subpath)
        if (needsAuth === null) { unresolved.push(site); continue }
        if (!needsAuth) continue
        if (ALLOWED[site.split(' ')[0]]) continue
        if (!/Authorization/i.test(callText(src, m.index))) offenders.push(site)
      }
    }
    expect(
      offenders,
      `bare fetch to an authenticated route with no bearer — getUserFromRequest ` +
      `will 401 silently on native. Use authedFetch() from lib/supabase/authedFetch.ts:\n  ` +
      offenders.join('\n  ')
    ).toEqual([])
    // Surface routes we could not resolve so the guard cannot rot into a no-op.
    expect(
      unresolved,
      `these /api fetch sites could not be resolved to a route file — the guard ` +
      `did not check them; add the route or adjust the resolver:\n  ` +
      unresolved.join('\n  ')
    ).toEqual([])
  })

  it('every ALLOWED entry still exists (a stale exemption is a hole)', () => {
    for (const site of Object.keys(ALLOWED)) {
      const [rel] = site.split(':')
      expect(existsSync(join(process.cwd(), rel)), `${rel} no longer exists`).toBe(true)
    }
  })
})
