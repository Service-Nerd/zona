import { describe, it, expect } from 'vitest'
import { isUserCancelled, purchaseOutcome } from './analytics'

// OPS-FUNNEL-01. The reason this is tested at all: `cancelled` and `failed` lead to
// OPPOSITE conclusions about whether the purchase path works, and the rule deciding
// between them previously existed twice in UpgradeScreen with two different
// predicates. `app/**` is not collected by vitest (see vitest.config.ts), so the
// rule has to live in lib/ to be testable at all.

describe('isUserCancelled — strict, on purpose', () => {
  it('is true only for the literal boolean true', () => {
    expect(isUserCancelled({ userCancelled: true })).toBe(true)
  })

  it('is false for a real failure', () => {
    expect(isUserCancelled(new Error('No offering available.'))).toBe(false)
    expect(isUserCancelled({ userCancelled: false })).toBe(false)
  })

  it('survives null, undefined and non-objects without throwing', () => {
    expect(isUserCancelled(null)).toBe(false)
    expect(isUserCancelled(undefined)).toBe(false)
    expect(isUserCancelled('userCancelled')).toBe(false)
    expect(isUserCancelled(0)).toBe(false)
  })

  // THE DRIFT THIS OWNER EXISTS TO CLOSE. `handleRestore` used a truthy test, which
  // would call these cancellations. A truthy value that is not `true` is far more
  // likely to be a malformed error than a deliberate dismissal, and classifying it
  // as "the user changed their mind" hides a broken purchase path completely.
  it('does NOT treat a truthy non-boolean as a cancellation', () => {
    expect(isUserCancelled({ userCancelled: 'yes' })).toBe(false)
    expect(isUserCancelled({ userCancelled: 1 })).toBe(false)
    expect(isUserCancelled({ userCancelled: {} })).toBe(false)
  })
})

describe('purchaseOutcome', () => {
  it('maps a dismissal to cancelled and everything else to failed', () => {
    expect(purchaseOutcome({ userCancelled: true })).toBe('cancelled')
    expect(purchaseOutcome(new Error('network'))).toBe('failed')
    expect(purchaseOutcome(undefined)).toBe('failed')
  })

  it('never returns success — that path does not throw', () => {
    const outcomes = [{ userCancelled: true }, new Error('x'), null, 'str'].map(purchaseOutcome)
    expect(outcomes).not.toContain('success')
  })
})

// ── OPS-ATTRIB-01 ───────────────────────────────────────────────────────────
import {
  ATTRIBUTION_SOURCES, ATTRIBUTION_STORAGE_KEY,
  attributionAnswered, markAttributionAnswered,
} from './analytics'

/** A minimal localStorage, plus the two hostile variants the real one has. */
function stubStorage(mode: 'ok' | 'throws' | 'absent') {
  const store = new Map<string, string>()
  if (mode === 'absent') { delete (globalThis as any).window; return store }
  ;(globalThis as any).window = {
    localStorage: {
      getItem: (k: string) => { if (mode === 'throws') throw new Error('blocked'); return store.get(k) ?? null },
      setItem: (k: string, v: string) => { if (mode === 'throws') throw new Error('blocked'); store.set(k, v) },
    },
  }
  return store
}

describe('ATTRIBUTION_SOURCES — the vocabulary every future query groups by', () => {
  it('has unique ids and a label for every one', () => {
    const ids = ATTRIBUTION_SOURCES.map(s => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const s of ATTRIBUTION_SOURCES) expect(s.label.length).toBeGreaterThan(0)
  })

  // Wroblewski's condition: one tap, zero typing. A source whose label asks the
  // runner to specify something is a keyboard outdoors.
  it('offers no free-text option', () => {
    for (const s of ATTRIBUTION_SOURCES) {
      expect(s.label.toLowerCase()).not.toContain('specify')
      expect(s.label).not.toContain('…')
    }
  })

  it('covers the channels that actually exist for Zonna', () => {
    const ids = ATTRIBUTION_SOURCES.map(s => s.id)
    // LinkedIn is the founder's own channel and charity is the Make-A-Wish route;
    // if either is missing the whole point of the row is gone.
    expect(ids).toContain('linkedin')
    expect(ids).toContain('charity')
  })
})

describe('attribution suppression — never throws, fails toward showing the row', () => {
  it('is false before anything is stored, and true after', () => {
    stubStorage('ok')
    expect(attributionAnswered()).toBe(false)
    markAttributionAnswered()
    expect(attributionAnswered()).toBe(true)
  })

  it('writes exactly the exported key', () => {
    const store = stubStorage('ok')
    markAttributionAnswered()
    expect(store.get(ATTRIBUTION_STORAGE_KEY)).toBe('1')
  })

  // THE DIRECTION THAT MATTERS. Private browsing throws on access; SSR has no
  // window. Both must resolve to "not answered" — a row that reappears is
  // recoverable, a thrown error on Today is not.
  it('returns false rather than throwing when storage throws', () => {
    stubStorage('throws')
    expect(() => attributionAnswered()).not.toThrow()
    expect(attributionAnswered()).toBe(false)
    expect(() => markAttributionAnswered()).not.toThrow()
  })

  it('returns false rather than throwing when there is no window at all', () => {
    stubStorage('absent')
    expect(() => attributionAnswered()).not.toThrow()
    expect(attributionAnswered()).toBe(false)
  })
})
