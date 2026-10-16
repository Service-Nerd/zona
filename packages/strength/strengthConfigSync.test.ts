import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { STRENGTH_CONFIG } from './config'

/** STRENGTH-ENGINE-01 — a strength numeric without a principle is a defect (as configPrincipleSync is for the run engine). */
describe('STRENGTH_CONFIG ↔ StrengthPrinciples.md', () => {
  const doc = readFileSync('docs/canonical/StrengthPrinciples.md', 'utf8')
  it('every key is explained by a section', () => {
    expect(Object.keys(STRENGTH_CONFIG).filter(k => !doc.includes('`' + k + '`'))).toEqual([])
  })
  it('every check code the doc names exists in the validator', () => {
    const src = readFileSync('packages/strength/validate.ts', 'utf8')
    const named = Array.from(new Set(Array.from(doc.matchAll(/`(S-[A-Z0-9-]+)`/g)).map(m => m[1])))
    expect(named.length).toBeGreaterThan(20)
    expect(named.filter(c => !src.includes(`'${c}'`))).toEqual([])
  })
})
