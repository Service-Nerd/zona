// REFRAME-NOTE-LOSS-01 regression.
//
// The runner wrote a reflection, the AI call failed, and their words were
// thrown away — then the screen returned to an empty box with no message.
//
// ⚠️ The AI call fails THREE ways and only two are outages: the API not being
// ok (credit, rate limit), fetch throwing (network), and `BAD_OUTPUT_RE`
// rejecting a cheerleading answer we were billed for. The third is not an
// outage at all, and it discarded the note just the same.

import { describe, it, expect } from 'vitest'
import { viewForReframeResponse, viewForStoredReflection } from './ReflectionInput.logic'

describe('REFRAME-NOTE-LOSS-01 — a fallback response never returns the runner to a blank box', () => {
  it('THE REGRESSION: no reframe and no silence resolves to `saved`, not `input`', () => {
    expect(viewForReframeResponse({ reframe: null, fallback: true })).toBe('saved')
  })

  it('holds for every shape the route can return with a null reframe', () => {
    expect(viewForReframeResponse({})).toBe('saved')
    expect(viewForReframeResponse({ reframe: null })).toBe('saved')
    expect(viewForReframeResponse({ reframe: '' })).toBe('saved')
    expect(viewForReframeResponse({ fallback: true, silenced: false })).toBe('saved')
  })

  it('a real reframe still wins', () => {
    expect(viewForReframeResponse({ reframe: 'Kept it under control.' })).toBe('reframe')
  })

  it('the risk gate still wins, and needs BOTH the flag and the message', () => {
    expect(viewForReframeResponse({ silenced: true, silencedMessage: 'HR went high.' })).toBe('silenced')
    // A flag with no message would render an empty warning card.
    expect(viewForReframeResponse({ silenced: true, silencedMessage: null })).toBe('saved')
  })

  it('silenced outranks a reframe if both somehow arrive', () => {
    expect(viewForReframeResponse({ reframe: 'x', silenced: true, silencedMessage: 'y' })).toBe('silenced')
  })
})

describe('REFRAME-NOTE-LOSS-01 — hydration surfaces a stored note with no reframe', () => {
  it('THE NEW ROW: note with no reframe hydrates to `saved`', () => {
    // Unreachable before the fix — the route returned before writing this row.
    expect(viewForStoredReflection({ note_text: 'legs felt heavy', reframe_text: null })).toBe('saved')
  })

  it('no row at all is still `input`', () => {
    expect(viewForStoredReflection(null)).toBe('input')
    expect(viewForStoredReflection(undefined)).toBe('input')
    expect(viewForStoredReflection({})).toBe('input')
  })

  it('an empty note is not a saved note', () => {
    expect(viewForStoredReflection({ note_text: '' })).toBe('input')
  })

  it('stored reframe and stored silence still resolve as before', () => {
    expect(viewForStoredReflection({ note_text: 'a', reframe_text: 'b' })).toBe('reframe')
    expect(viewForStoredReflection({ note_text: 'a', reframe_silenced: true, reframe_silenced_reason: 'hr_drift' })).toBe('silenced')
  })

  it('silenced WITHOUT a reason falls through rather than rendering an empty card', () => {
    expect(viewForStoredReflection({ note_text: 'a', reframe_silenced: true })).toBe('saved')
  })
})
