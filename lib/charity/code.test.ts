// GTM-CHARITY-04 — code parsing.
//
// Every avoidable rejection here is a runner who was promised free access and
// did not get it, so the forgiving-input cases are the ones that matter.

import { describe, it, expect } from 'vitest'
import { mintCode, normaliseCode, formatCode, CODE_PREFIX } from './code'

describe('normaliseCode — forgiving about presentation', () => {
  // All of these are the SAME code as a runner might actually type it.
  it.each([
    'ZONNA-4K7M-9PQR',
    'zonna-4k7m-9pqr',
    'ZONNA 4K7M 9PQR',
    '  ZONNA-4K7M-9PQR  ',
    'zonna4k7m9pqr',
    '4K7M-9PQR',          // prefix omitted
    '4k7m9pqr',
  ])('resolves %s to the same stored form', input => {
    expect(normaliseCode(input)).toBe('4K7M9PQR')
  })

  it('returns null for nothing usable', () => {
    for (const bad of ['', '   ', '---', null, undefined]) {
      expect(normaliseCode(bad)).toBeNull()
    }
  })

  // Guards the prefix-stripping branch: a code whose BODY happens to start with
  // the prefix letters must not have them eaten twice.
  it('strips the prefix once, not repeatedly', () => {
    expect(normaliseCode('ZONNAZONNA')).toBe('ZONNA')
  })
})

describe('mintCode', () => {
  it('emits the documented shape', () => {
    expect(mintCode()).toMatch(new RegExp(`^${CODE_PREFIX}-[0-9A-Z]{4}-[0-9A-Z]{4}$`))
  })

  // The whole point of the restricted alphabet: a runner copying a code off a
  // phone screen must not have to distinguish O from 0 or I from 1.
  it('never emits a character that can be misread', () => {
    const random = (() => { let i = 0; return () => ((i++ * 7919) % 1000) / 1000 })()
    for (let n = 0; n < 400; n++) {
      const body = mintCode(random).slice(CODE_PREFIX.length + 1)
      expect(body).not.toMatch(/[ILOU01]/)
    }
  })

  it('round-trips through normalise and format', () => {
    const code = mintCode()
    const stored = normaliseCode(code)!
    expect(formatCode(stored)).toBe(code)
  })
})
