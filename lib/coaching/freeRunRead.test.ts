// ACT-FREE-TEASE-01 — the free post-run read. SLT + Design Board 2026-11-12.
//
// 🔴 TWO OF THESE ARMS GUARD A RULING RATHER THAN A BEHAVIOUR, and they are the ones that matter
// in six months. Hutchinson's SLT condition was *"show the fact, withhold the claim, and do not
// let the fact be WORDED as a claim"* — a condition on COPY, which is the least durable thing in
// a codebase. So the word list is mechanical, and the band spellings are asserted against the
// strings `kitReceipts` actually emits rather than against a second copy of them here.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { freeRunRead, FREE_RUN_READ_BANDS } from './freeRunRead'
import { BRAND } from '@/lib/brand'
import type { RunEffortRow } from './runEffort'

const row = (z1: number, z2: number, z3: number, z45: number): RunEffortRow =>
  ({ hr_pct_z1: z1, hr_pct_z2: z2, hr_pct_z3: z3, hr_pct_z4_5: z45 })

const EASY  = row(22, 70, 8, 0)
const GREY  = row(3, 10, 64, 23)
const HARD  = row(5, 10, 20, 65)
/** `COACH_EFFORT_SPLIT_MIN_PCT` on both sides: a warm-up plus real reps. */
const SPLIT = row(30, 25, 10, 35)
const NO_HR = row(null as never, null as never, null as never, null as never)

describe('freeRunRead — which number, and whose', () => {
  it('no linked run is ABSENT, not a zero', () => {
    expect(freeRunRead(null)).toEqual({ state: 'absent' })
  })

  it('a run with no heart rate is a MISSING SENSOR, and offers nothing to buy', () => {
    const r = freeRunRead(NO_HR)
    expect(r.state).toBe('no_hr')
    // 🔴 THE HONESTY ARM. An iPhone-only runner (ADR-011 §5) cannot buy heart rate from us, so
    // this state must carry no CTA. The type is what enforces it — `cta` does not exist on
    // `no_hr` — and this asserts the type was not widened to "simplify" the component.
    expect('cta' in r).toBe(false)
    if (r.state !== 'no_hr') throw new Error('unreachable')
    expect(r.sentence).toContain('No heart rate')
    expect(r.sub).toContain(BRAND.coachName)
  })

  it('an easy run quotes the EASY share', () => {
    const r = freeRunRead(EASY)
    if (r.state !== 'measured') throw new Error('expected measured')
    expect(r.band).toBe('easy')
    expect(r.pct).toBe(92)                       // 22 + 70
    expect(r.sentence).toBe('of this run was in Zones 1–2.')
  })

  it('a grey run quotes the ZONE 3 share — the number the brand exists for', () => {
    const r = freeRunRead(GREY)
    if (r.state !== 'measured') throw new Error('expected measured')
    expect(r.band).toBe('grey')
    expect(r.pct).toBe(64)
    expect(r.sentence).toBe('of this run was in Zone 3.')
  })

  it('a hard run quotes the HARD share', () => {
    const r = freeRunRead(HARD)
    if (r.state !== 'measured') throw new Error('expected measured')
    expect(r.pct).toBe(65)
    expect(r.sentence).toBe('of this run was in Zones 4–5.')
  })

  it('🔑 a SPLIT run quotes the hard share, not the easy one', () => {
    // A session with a warm-up and real reps is not described by its easy share. Same for a run
    // that COMPLETED a hard session: the easy percentage is a true number about nothing.
    const r = freeRunRead(SPLIT)
    if (r.state !== 'measured') throw new Error('expected measured')
    expect(r.band).toBe('hard')
    expect(r.pct).toBe(35)
  })

  it('🔴 the band is what the run DID, and the planned type is not consulted at all', () => {
    // 🔴 THIS ARM USED TO ASSERT THE OPPOSITE, AND IT WAS WRONG IN THE ONE WAY THAT REACHES A
    // RUNNER. It passed `'intervals'` to prove a planned-hard session quoted its Z4–5 share —
    // and `sessionRole.ts` measures that **`intervals` and `tempo` occur in no generated or
    // stored plan** (5,664 cohort, 36 production). The live member of `isHardEffortType` is
    // `quality`, whose prescribed band is Z3, so a correctly-executed threshold session read
    // *"10% of this run was in Zones 4–5"* — a true number about the wrong band. **My fixture
    // used a value the product never produces, which is the recorded rule it broke.**
    //
    // The special case was also unnecessary: an intervals run lands in Z4–5 and classifies
    // `hard` unaided; a tempo lands in Z3 and classifies `grey`. Both already correct.
    const tempoish = row(5, 20, 64, 11)     // a threshold session, run properly: Z3-dominant
    const t = freeRunRead(tempoish)
    if (t.state !== 'measured') throw new Error('expected measured')
    expect(t.band, 'a quality/tempo session must not be described by its Z4–5 share').toBe('grey')
    expect(t.pct).toBe(64)

    const intervalish = freeRunRead(row(5, 10, 20, 65))
    if (intervalish.state !== 'measured') throw new Error('expected measured')
    expect(intervalish.band, 'an intervals run reaches the hard band on its own').toBe('hard')
  })

  it('rounds, and never reports more than it measured', () => {
    const r = freeRunRead(row(49.6, 50.2, 0.2, 0))
    if (r.state !== 'measured') throw new Error('expected measured')
    expect(r.pct).toBe(100)
    expect(r.pct).toBeLessThanOrEqual(100)
  })
})

describe('🔴 Hutchinson’s binding condition, mechanically', () => {
  /**
   * The SLT ruling withholds the INTERPRETATION, so no evaluative word may reach the free path.
   * A reviewer reading the copy once cannot keep this true; a list can.
   *
   * ⚠️ "easy" is NOT on this list and must not be: `Zones 1–2` is a band name and "an easy run"
   * is the product's own vocabulary for a prescription. The forbidden words are the ones that
   * grade the runner.
   */
  const VERDICT_WORDS = [
    'good', 'great', 'well done', 'nice', 'perfect', 'nailed', 'held', 'clean',
    'too hard', 'too fast', 'should have', 'should’ve', 'bit keen', 'ease it back',
    'cooked', 'overdid', 'wrong', 'poor', 'bad',
  ]

  const everySentence = (): string[] => {
    const out: string[] = []
    for (const r of [freeRunRead(EASY), freeRunRead(GREY), freeRunRead(HARD), freeRunRead(SPLIT), freeRunRead(NO_HR), freeRunRead(EASY)]) {
      if (r.state === 'measured') out.push(r.sentence, r.locked, r.cta)
      if (r.state === 'no_hr') out.push(r.sentence, r.sub)
    }
    return out
  }

  it('there are sentences to check — the arm is not vacuous', () => {
    expect(everySentence().length).toBeGreaterThan(8)
  })

  it('no sentence on the free path grades the runner', () => {
    const offenders = everySentence().flatMap(s =>
      VERDICT_WORDS.filter(w => s.toLowerCase().includes(w)).map(w => `"${w}" in: ${s}`))
    expect(offenders, 'the SLT withheld the verdict; this sentence delivers one').toEqual([])
  })

  it('and no em dash in a sentence the runner reads, while the EN dash in the band stays', () => {
    // CLAUDE.md: em dashes banned in runner-facing sentences; en dashes in ranges are correct.
    for (const s of everySentence()) expect(s, s).not.toContain('—')
    expect(FREE_RUN_READ_BANDS.easy).toContain('–')
    expect(FREE_RUN_READ_BANDS.hard).toContain('–')
  })
})

describe('🔑 the band names cannot drift from the ones Coach already shows', () => {
  // `kitReceipts` writes these same bands as prose on free Coach and the Upgrade screen. Two
  // spellings of one band inside one product is the duplication class this repo keeps paying for,
  // so this reads ITS source rather than holding a second copy of the strings.
  const receipts = readFileSync('lib/coaching/kitReceipts.ts', 'utf8')

  it('every band label appears verbatim in kitReceipts.ts', () => {
    const missing = Object.values(FREE_RUN_READ_BANDS).filter(b => !receipts.includes(b))
    expect(missing, 'rename it in both places, or neither').toEqual([])
  })

  it('and the sentence shape is the same one, narrowed from the week to the run', () => {
    expect(receipts).toContain('of it in Zone 3')
    const r = freeRunRead(GREY)
    if (r.state !== 'measured') throw new Error('expected measured')
    expect(r.sentence).toContain('in Zone 3')
  })
})
