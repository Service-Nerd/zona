// ADR027-B3-VERIFIER — a predicate's comment may only cite the principles the catalogue gives that rule.
// Batches 10 and 11 each shipped comments citing the wrong § (found by review both times): prose that restates a
// catalogue fact drifts from it. This compares every § in the comment block above a predicate with the rule's
// principle_ref and related_refs. A comment with no § passes; the catalogue stays the single owner.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { RULES } from '@/lib/engine/catalogue/rules'

const SRC = readFileSync(join(process.cwd(), 'lib/engine/verifier/verifyPlan.ts'), 'utf8').split('\n')
const base = (ref: string) => /^§(\d+[a-z]?)/.exec(ref)?.[1] ?? null

describe('ADR027-B3-VERIFIER — predicate comments cite the catalogue\'s principles', () => {
  it('🔴 every § cited above a predicate belongs to that rule', () => {
    const wrong: string[] = []
    let checked = 0
    SRC.forEach((line, i) => {
      const m = /^ {2}'((?:INV|S)-[A-Z0-9-]+)':/.exec(line)
      if (!m) return
      const rule = RULES.find(r => r.id === m[1])
      if (!rule) return
      const allowed = new Set([rule.principle_ref, ...(rule.related_refs ?? [])].map(base).filter(Boolean))
      const block: string[] = []
      for (let k = i - 1; k >= 0 && /^\s*\/\//.test(SRC[k]); k--) block.push(SRC[k])
      for (const c of Array.from(block.join(' ').matchAll(/§(\d+[a-z]?)/g), x => x[1])) {
        checked++
        if (!allowed.has(c)) wrong.push(`${m[1]}: comment cites §${c}, catalogue gives ${Array.from(allowed).map(x => '§' + x).join(', ') || 'none'}`)
      }
    })
    expect(checked, 'no cited § was found at all, so the scan is not reading the file').toBeGreaterThan(0)
    expect(wrong).toEqual([])
  })
})
