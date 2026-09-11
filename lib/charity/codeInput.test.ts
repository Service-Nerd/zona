// UX-REDEEM-01 — the code box must not ask for work the parser does not want.
//
// Reported from a real device: the runner typed the `ZONNA-` prefix and counted
// out the hyphens, because the placeholder read `ZONNA-XXXX-XXXX`. None of that
// was ever required — `normaliseCode` has always accepted the code "lowercase,
// spaced, hyphenated, with or without the prefix, with stray whitespace from a
// copy-paste". A box that IMPLIES a strict format the parser is forgiving about
// makes a person feel they got a gift wrong, on the last screen before their
// free access.
//
// `formatCodeInput` runs the SAME normalisation forwards, so the box and the
// parser cannot disagree about what a code is.

import { describe, it, expect } from 'vitest'
import { formatCodeInput, normaliseCode, mintCode, CODE_PREFIX, CODE_BODY_LENGTH } from './code'

describe('what the runner can type', () => {
  it.each([
    ['bare',                 'X7K29MQF'],
    ['lowercase',            'x7k29mqf'],
    ['with the prefix',      'ZONNA-X7K2-9MQF'],
    ['prefix, no hyphens',   'zonnax7k29mqf'],
    ['spaced, as pasted',    ' zonna x7k2 9mqf '],
    ['hyphens in odd places','X-7K2-9M-QF'],
  ])('%s lands as the same formatted code', (_label, typed) => {
    expect(formatCodeInput(typed)).toBe('X7K2-9MQF')
  })

  it('formats progressively, so the separator appears as you type', () => {
    expect(formatCodeInput('X')).toBe('X')
    expect(formatCodeInput('X7K2')).toBe('X7K2')
    expect(formatCodeInput('X7K29')).toBe('X7K2-9')
    expect(formatCodeInput('X7K29MQF')).toBe('X7K2-9MQF')
  })

  it('never grows past a real code, however much is pasted', () => {
    const out = formatCodeInput('X7K29MQFEXTRAJUNK')
    expect(normaliseCode(out)!.length).toBe(CODE_BODY_LENGTH)
  })

  it('is empty for input with nothing usable in it', () => {
    for (const junk of ['', '   ', '---', 'ZONNA', 'zonna-']) {
      expect(formatCodeInput(junk)).toBe('')
    }
  })
})

describe('the box and the parser agree', () => {
  // The whole point of sharing normaliseCode. If these two ever diverge, a
  // runner can type something the box accepts and the server rejects.
  it('anything the box formats still normalises to the same code', () => {
    let rand = 12345
    const rng = () => (rand = (rand * 1103515245 + 12345) % 2147483648) / 2147483648
    for (let i = 0; i < 50; i++) {
      const minted = mintCode(rng)                 // ZONNA-XXXX-XXXX
      const body = normaliseCode(minted)!
      expect(normaliseCode(formatCodeInput(minted))).toBe(body)
      expect(normaliseCode(formatCodeInput(body))).toBe(body)
      expect(normaliseCode(formatCodeInput(body.toLowerCase()))).toBe(body)
    }
  })

  it('a minted code round-trips through the box unchanged', () => {
    const minted = mintCode()
    expect(`${CODE_PREFIX}-${formatCodeInput(minted)}`).toBe(minted)
  })
})
