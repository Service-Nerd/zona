import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * OPS-AI-OWNER-01 — the gate that keeps the single owner single.
 *
 * `lib/ai/callAnthropic.ts` is the only place allowed to name Anthropic's
 * endpoint. Without this, the owner is a convention, and this repo has its own
 * record of what happens to conventions: `deloadCadence` existed in five
 * places and they agreed only by accident, `raceDistanceKey` in three.
 *
 * It matters more here than usual because the owner is what makes BOTH ops
 * items true. A fifteenth call site written by hand would be invisible to
 * spend accounting and to failure alerting at the same time, and nothing
 * about the product would look wrong.
 */
const OWNER = 'lib/ai/callAnthropic.ts'
const ROOTS = ['app', 'lib', 'components', 'scripts']
const SKIP = new Set(['node_modules', '.next', '.git', 'ios'])

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) sourceFiles(p, out)
    else if (/\.(ts|tsx|mjs|js)$/.test(entry)) out.push(p)
  }
  return out
}

describe('no raw Anthropic calls outside the single owner', () => {
  it('names the endpoint in exactly one file', () => {
    const offenders: string[] = []
    for (const root of ROOTS) {
      for (const file of sourceFiles(join(process.cwd(), root))) {
        const rel = relative(process.cwd(), file)
        if (rel === OWNER) continue
        if (rel.endsWith('.test.ts') || rel.endsWith('.test.tsx')) continue
        if (readFileSync(file, 'utf8').includes('api.anthropic.com')) offenders.push(rel)
      }
    }
    expect(
      offenders,
      `these call Anthropic directly instead of through ${OWNER}, so their ` +
      `spend and their failures are invisible:\n  ${offenders.join('\n  ')}`,
    ).toEqual([])
  })
})
