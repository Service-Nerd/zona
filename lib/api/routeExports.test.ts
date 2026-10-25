// BOOT-HANG-01 follow-up (2026-10-25). `app/api/ops/boot-report/route.ts` exported two constants, `npm run verify` and
// `tsc` were green, and the PRODUCTION build failed: Next.js type-checks a route file's exports and allows only the
// HTTP handlers and route segment config. `verify` does not run `next build`, so this is that check, cheaply.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ALLOWED = new Set([
  'GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS',
  'dynamic', 'dynamicParams', 'revalidate', 'fetchCache', 'runtime', 'preferredRegion', 'maxDuration', 'generateStaticParams',
])

function routes(dir: string): string[] {
  return readdirSync(dir).flatMap(n => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? routes(p) : /^route\.(ts|tsx|js)$/.test(n) ? [p] : []
  })
}
const files = routes(join(process.cwd(), 'app'))

describe('a route file exports only what Next.js allows', () => {
  it('the population is derived, and is not empty', () => expect(files.length).toBeGreaterThan(50))
  it('🔴 no route exports a name Next.js would reject at build time', () => {
    const bad: string[] = []
    for (const f of files) {
      const src = readFileSync(f, 'utf8')
      for (const m of Array.from(src.matchAll(/^export\s+(?:async\s+)?(?:const|let|function|class)\s+(\w+)/gm))) {
        if (!ALLOWED.has(m[1])) bad.push(`${f.replace(process.cwd() + '/', '')}: ${m[1]}`)
      }
      for (const m of Array.from(src.matchAll(/^export\s*\{([^}]*)\}/gm))) {
        for (const name of m[1].split(',').map((x: string) => x.trim().split(/\s+as\s+/).pop()!).filter(Boolean)) {
          if (!ALLOWED.has(name)) bad.push(`${f.replace(process.cwd() + '/', '')}: ${name}`)
        }
      }
    }
    expect(bad).toEqual([])
  })
})
