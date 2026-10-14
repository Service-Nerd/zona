import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import BASELINE from './__fixtures__/enginePurityBaseline.json'

/**
 * ENGINE-PURITY-GATE-01 — the engine may not import the app.
 *
 * 🎯 THE GOAL, so this is not read as tidying. The founder intends to lift the coaching
 * engine out of the app and host it centrally, so the app calls it as a service, and
 * possibly to monetise it. **This file is not that extraction.** It makes the extraction
 * mechanical instead of a rebuild, and it pays for itself immediately: the purity below is
 * TRUE TODAY and was enforced by NOTHING.
 *
 * 📐 MEASURED 2026-10-14 before this existed. `lib/plan` is 98 files / ~79,000 lines and
 * `lib/coaching` 130 files, and between them they import `next/` ZERO times, `react` once,
 * `@/app/` zero and `@/components/` zero. Four files reach a Supabase client. That is a
 * boundary already standing; nobody had ever been stopped from walking through it.
 *
 * ⚠️ THIS GUARDS THE OPPOSITE DIRECTION FROM `BUNDLE-BOUNDARY-01`. That one stops the
 * ENGINE leaking into a CLIENT bundle (the homepage went 110 kB -> 249 kB when
 * `PlanCalendar` imported the `@/lib/plan` barrel). This one stops the APP leaking into the
 * ENGINE. Same discipline, opposite arrow, and neither substitutes for the other.
 *
 * ⚠️ THE BASELINE IS NOT A LIST OF EXCEPTIONS. Every entry is a file that should MOVE OUT
 * of the engine, not one that has earned its place inside it. Four of the five are leaves —
 * nothing in the engine imports them — so moving them is a path change, not a refactor. The
 * count may only fall; a new offender fails the build.
 */

const ENGINE_DIRS = ['lib/plan', 'lib/coaching']

/** What the engine may not reach for, and why each one matters once it is a service. */
const FORBIDDEN: ReadonlyArray<{ pattern: RegExp; what: string; why: string }> = [
  { pattern: /from\s+['"]next\//, what: 'next/',
    why: 'a hosted engine has no Next runtime — headers(), cookies(), NextRequest all vanish' },
  { pattern: /from\s+['"]react['"]/, what: 'react',
    why: 'a hook cannot run in a service; it also drags React into every consumer' },
  { pattern: /from\s+['"]@\/app\//, what: '@/app/',
    why: 'the app is the CALLER. An engine importing its caller cannot be lifted at all' },
  { pattern: /from\s+['"]@\/components\//, what: '@/components/',
    why: 'presentation. Same reason, and it would pull JSX into a server package' },
  { pattern: /from\s+['"]@supabase\//, what: '@supabase/',
    why: 'persistence. The engine takes inputs and returns a plan; who stores it is the caller’s' },
]

function engineFiles(): string[] {
  return execSync(`git ls-files ${ENGINE_DIRS.map(d => `'${d}/**/*.ts'`).join(' ')} ${ENGINE_DIRS.map(d => `'${d}/*.ts'`).join(' ')}`,
    { encoding: 'utf8' })
    .trim().split('\n')
    .filter(f => f && !f.includes('.test.') && !f.includes('__fixtures__'))
}

/** A comment is prose. `strip` keeps line count so positions still line up. */
function strip(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length))
}

function offences(file: string): string[] {
  const src = strip(readFileSync(file, 'utf8'))
  return FORBIDDEN.filter(f => f.pattern.test(src)).map(f => f.what)
}


/** The baseline carries a `_why` string beside the file rows. Keys starting with `_` are
 *  metadata, not paths — the first cut of this file read `_why` as a filename and the
 *  stale arm failed on it. Filtered in ONE place so the two arms cannot disagree. */
function fileEntries(b: Record<string, unknown>): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(b).filter(([k]) => !k.startsWith('_')) as [string, string[]][],
  )
}

const FILES = engineFiles()
const found: Record<string, string[]> = {}
for (const f of FILES) {
  const o = offences(f)
  if (o.length) found[f] = o
}

describe('ENGINE-PURITY-GATE-01 — the engine may not import the app', () => {
  it('the population is real', () => {
    // An empty or collapsed population passes every other arm silently. Four of this
    // repo's measured check defects were a short population.
    expect(FILES.length).toBeGreaterThan(150)
    expect(FILES.some(f => f.startsWith('lib/plan/'))).toBe(true)
    expect(FILES.some(f => f.startsWith('lib/coaching/'))).toBe(true)
    // the engine's own heart must be in the set, or the gate is pointed at the wrong place
    expect(FILES).toContain('lib/plan/ruleEngine.ts')
    expect(FILES).toContain('lib/plan/invariants.ts')
  })

  it('the matcher finds a real import and ignores prose', () => {
    // Both directions. A stripper that blanks too much turns the gate green on everything.
    const probe = (src: string) => FORBIDDEN.filter(f => f.pattern.test(strip(src))).map(f => f.what)
    expect(probe("import { x } from 'next/headers'")).toEqual(['next/'])
    expect(probe("import { createClient } from '@supabase/supabase-js'")).toEqual(['@supabase/'])
    expect(probe("// we deliberately do not import from 'next/headers' here")).toEqual([])
    expect(probe("/* a comment about @supabase/supabase-js */")).toEqual([])
    expect(probe("const s = 'next/headers'")).toEqual([])          // a string is not an import
    expect(probe("import { x } from './nextWeek'")).toEqual([])    // not a false prefix match
  })

  it('🔴 no engine file imports the app, beyond the declared baseline', () => {
    const base = fileEntries(BASELINE as Record<string, unknown>)
    const news: string[] = []
    for (const [f, o] of Object.entries(found)) {
      const allowed = base[f] ?? []
      const extra = o.filter(x => !allowed.includes(x))
      if (extra.length) news.push(`${f} → ${extra.join(', ')}`)
    }
    expect(news, news.length
      ? `THE ENGINE REACHED INTO THE APP.\n${news.join('\n')}\n\n`
        + FORBIDDEN.map(f => `  ${f.what} — ${f.why}`).join('\n')
        + '\n\nThe engine takes inputs and returns a Plan. If it needs data, the CALLER fetches it.'
      : 'ok').toEqual([])
  })

  it('a baseline entry that has been PAID is removed, not left to rot', () => {
    const base = fileEntries(BASELINE as Record<string, unknown>)
    const stale: string[] = []
    for (const [f, allowed] of Object.entries(base)) {
      const actual = found[f] ?? []
      const gone = allowed.filter(x => !actual.includes(x))
      if (gone.length) stale.push(`${f}: no longer imports ${gone.join(', ')} — drop it from the baseline`)
    }
    expect(stale, stale.length ? `BASELINE IS STALE.\n${stale.join('\n')}` : 'ok').toEqual([])
  })

  it('the baseline says these files should MOVE, not that they are allowed', () => {
    // A baseline read as an exception list is a boundary with a hole in it. The reason
    // lives beside the data so it cannot be separated from it.
    // ⚠️ PARSE IT, do not substring the raw text. The first cut was
    // `expect(raw).toContain('_why')`, which `hollowTestShapes.test.ts` rejects on sight:
    // a bare identifier matched against source would also pass on `_whyever`, or on the
    // word appearing in a comment. My own lint caught my own test.
    const parsed = JSON.parse(
      readFileSync('lib/plan/__fixtures__/enginePurityBaseline.json', 'utf8'),
    ) as Record<string, unknown>
    expect(Object.keys(parsed)).toContain('_why')
    expect(typeof parsed._why).toBe('string')
    expect(parsed._why as string).toMatch(/move out/i)
  })
})
