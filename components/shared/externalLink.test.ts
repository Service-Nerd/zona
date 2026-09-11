import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * UX-AUTH-01 — the app shell must never render the marketing site.
 *
 * Reported from a device as "signing out lands the app on the marketing
 * website". The login screen links to `/privacy` and `/terms`, which are
 * MARKETING pages carrying `SiteHeader` / `SiteFooter`. On the web
 * `target="_blank"` opens a tab; inside the Capacitor webview there is no tab,
 * so the same link REPLACED the app with the full website — Plans, Pricing,
 * Comparisons, "Get the app" — and left no way back.
 *
 * Two mechanical claims here, neither of which needs a device:
 *   1. The marketing route list is DERIVED from which pages actually render
 *      `SiteHeader`, so a new marketing page joins this guard on the day it
 *      ships rather than when someone remembers.
 *   2. No file in the app shell may link to one of those routes with a bare
 *      anchor. `ExternalLink` is the only way out, and it hands native to
 *      SFSafariViewController, which cannot navigate the app anywhere.
 */

const ROOT = process.cwd()

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(full) && !/\.test\.tsx?$/.test(full)) out.push(full)
  }
  return out
}

/** Every route whose page renders marketing chrome, derived from the source. */
const MARKETING_ROUTES = (() => {
  const routes: string[] = []
  for (const file of walk(join(ROOT, 'app'))) {
    if (!/[\\/]page\.tsx$/.test(file)) continue
    if (!readFileSync(file, 'utf8').includes('SiteHeader')) continue
    const route = '/' + relative(join(ROOT, 'app'), file).replace(/[\\/]page\.tsx$/, '')
    routes.push(route === '/' ? '/' : route)
  }
  return routes
})()

/** The surfaces that live INSIDE the app shell, where marketing chrome is a defect. */
const APP_SHELL_DIRS = ['app/auth', 'app/dashboard', 'components/shared', 'components/ui']

describe('UX-AUTH-01 — no in-app route can reach the marketing site', () => {
  it('found the marketing pages by reading them, not from a list', () => {
    // If this ever empties, the guard below passes vacuously.
    expect(MARKETING_ROUTES.length).toBeGreaterThan(5)
    expect(MARKETING_ROUTES).toContain('/privacy')
    expect(MARKETING_ROUTES).toContain('/terms')
  })

  it('every app-shell link to a marketing page goes through ExternalLink', () => {
    const offenders: string[] = []
    for (const dir of APP_SHELL_DIRS) {
      for (const file of walk(join(ROOT, dir))) {
        const src = readFileSync(file, 'utf8')
        for (const route of MARKETING_ROUTES) {
          if (route === '/') continue // handled by its own case below
          const pattern = new RegExp(`href=["'\`]${route}["'\`]`, 'g')
          for (const m of Array.from(src.matchAll(pattern))) {
            // Walk back to the opening tag of this element.
            const open = src.lastIndexOf('<', m.index!)
            const tag = src.slice(open + 1).match(/^[A-Za-z][A-Za-z0-9]*/)?.[0]
            if (tag !== 'ExternalLink') {
              offenders.push(`${relative(ROOT, file)}: <${tag} href="${route}">`)
            }
          }
        }
      }
    }
    expect(offenders, [
      'An app-shell surface links straight at a page that renders SiteHeader.',
      'Inside the Capacitor webview that REPLACES the app with the marketing site',
      'and the runner has no way back. Use <ExternalLink href="…"> — it opens',
      'native in SFSafariViewController, which has its own Done button.',
    ].join('\n')).toEqual([])
  })

  it('ExternalLink decides native-ness synchronously', () => {
    // `preventDefault()` after an `await` is too late: the webview has already
    // begun the navigation, so the marketing page loads AND the sheet opens.
    // The static import is the fix, so guard it rather than a comment.
    const src = readFileSync(join(ROOT, 'components/shared/ExternalLink.tsx'), 'utf8')
    expect(src).toMatch(/^import \{ Capacitor \} from '@capacitor\/core'$/m)
    const handler = src.slice(src.indexOf('const onClick'), src.indexOf('return ('))
    const guard = handler.indexOf('isNativePlatform()')
    const prevent = handler.indexOf('preventDefault()')
    const firstAwait = handler.indexOf('await')
    expect(guard).toBeGreaterThan(-1)
    expect(prevent).toBeGreaterThan(guard)
    expect(prevent).toBeLessThan(firstAwait)
  })

  it('never builds an absolute URL from a hardcoded host', () => {
    // `allowNavigation` lists www only, so an apex URL would send the runner out
    // to Safari — the other reported symptom. Deriving from the webview's own
    // origin cannot get the host wrong.
    const src = readFileSync(join(ROOT, 'components/shared/ExternalLink.tsx'), 'utf8')
    expect(src).toContain('window.location.origin')
    expect(src).not.toMatch(/https?:\/\/[a-z]/)
  })
})
