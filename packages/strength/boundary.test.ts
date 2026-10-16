import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

/**
 * STRENGTH-ENGINE-01 (ADR-024 §1) — the package is isolated, pure and AI-free.
 *
 * 🔴 The isolation IS the standalone-app path: a second app calls the engine with
 * `null`. One `import … from '@/lib/plan'` and that path is gone, silently.
 */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n')
const files = (glob: string) => execSync(`git ls-files --cached --others --exclude-standard ${glob}`, { encoding: 'utf8' }).split('\n').filter(f => /\.tsx?$/.test(f))
const pkg = files('packages/strength').filter(f => !f.includes('.test.'))

describe('the strength package boundary', () => {
  it('the population is real', () => { expect(pkg.length).toBeGreaterThanOrEqual(9) })

  it('imports only its own files: no app code, no third-party modules', () => {
    const bad = pkg.flatMap(f => Array.from(strip(readFileSync(f, 'utf8')).matchAll(/from\s+['"]([^'"]+)['"]/g))
      .map(m => m[1]).filter(spec => !spec.startsWith('./')).map(spec => `${f}: ${spec}`))
    expect(bad).toEqual([])
  })

  it('is pure: no clock, randomness, environment, network or model calls', () => {
    const banned = [/process\.env/, /\bfetch\(/, /Date\.now\(/, /new Date\(\)/, /Math\.random/, /anthropic/i, /supabase/i, /require\(/]
    const bad = pkg.flatMap(f => { const s = strip(readFileSync(f, 'utf8')); return banned.filter(r => r.test(s)).map(r => `${f}: ${r}`) })
    expect(bad).toEqual([])
  })

  it('the run engine never imports strength (one direction of dependency)', () => {
    const bad = files('lib/plan types').filter(f => /packages\/strength|strength-bridge/.test(strip(readFileSync(f, 'utf8'))))
    expect(bad).toEqual([])
  })

  it('outside the package, code imports the index, never a file inside it', () => {
    const outside = files('app lib components scripts').filter(f => !f.includes('.test.'))
    const bad = outside.filter(f => /from\s+['"]@\/packages\/strength\/[^'"]+['"]/.test(strip(readFileSync(f, 'utf8'))))
    expect(bad).toEqual([])
  })
})
