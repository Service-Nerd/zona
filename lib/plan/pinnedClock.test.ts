// PINNED-CLOCK-01 (2026-10-26). `noteNamesBindingLever.test.ts` fixed `TODAY = '2026-09-21'` and a race 16 weeks
// later, but called `generateRulePlan(input, 'paid')`, so the engine measured prep time from the WALL CLOCK. On
// 2026-10-26 the race fell inside the 10-week marathon floor and three tests started failing with no code change.
// Three more files had the same shape and dates that would have run out within weeks.
//
// Rule: a test that declares a fixed date constant (`TODAY` / `START`) must hand it to `generateRulePlan` as the
// third argument. `input.plan_start` alone does not pin the engine's clock.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

function tests(dir: string): string[] {
  return readdirSync(dir).flatMap(n => {
    const p = join(dir, n)
    if (n === 'node_modules' || n.startsWith('.')) return []
    return statSync(p).isDirectory() ? tests(p) : /\.test\.tsx?$/.test(n) ? [p] : []
  })
}

/** Calls to generateRulePlan with only two arguments, in a file that pins a date constant. */
export function unpinnedCalls(src: string): string[] {
  if (!/^const (TODAY|START)\s*=\s*'\d{4}-\d{2}-\d{2}'/m.test(src)) return []
  return Array.from(src.matchAll(/generateRulePlan\(\s*[^,()]+,\s*'(?:paid|free)'\s*\)/g)).map(m => m[0])
}

const files = ['lib', 'app', 'packages'].flatMap(d => tests(join(process.cwd(), d)))

describe('PINNED-CLOCK-01 — a pinned test pins the engine', () => {
  it('the population is derived', () => expect(files.length).toBeGreaterThan(300))
  it('🔴 no test with a fixed date lets the engine read the wall clock', () => {
    const bad = files.flatMap(f => unpinnedCalls(readFileSync(f, 'utf8')).map(c => `${f.replace(process.cwd() + '/', '')}: ${c}`))
    expect(bad).toEqual([])
  })
  it('the detector', () => {
    expect(unpinnedCalls("const TODAY = '2026-09-21'\ngenerateRulePlan(input, 'paid')")).toHaveLength(1)
    expect(unpinnedCalls("const TODAY = '2026-09-21'\ngenerateRulePlan(input, 'paid', TODAY)")).toEqual([])
    expect(unpinnedCalls("generateRulePlan(input, 'paid')"), 'no fixed date → the clock is the intent').toEqual([])
  })
})
