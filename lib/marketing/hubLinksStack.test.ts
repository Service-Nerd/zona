import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * HUB-LINKS-STACK-01 (founder, 2026-10-16). On /comparisons and /guides, "See the plans →"
 * trailed the closing sentence INLINE and wrapped wherever the line ran out, right above
 * "Read the guides →" on a line of its own. Each link now sits in its own paragraph.
 *
 * Bounded source check: vitest runs in node with no DOM, so this asserts the markup shape,
 * not the rendered wrap. Comments stripped so the note above the link cannot satisfy it.
 */
const src = readFileSync('components/marketing/ArticleHub.tsx', 'utf8')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

describe('HUB-LINKS-STACK-01 — the hub links each sit on their own line', () => {
  it('the closing sentence ends its paragraph before the plans link', () => {
    const at = src.indexOf('free to read before you pay anyone for anything.')
    expect(at, 'the sentence moved, re-anchor').toBeGreaterThan(-1)
    const after = src.slice(at)
    expect(after.indexOf('</p>'), 'the plans link is inline with the sentence again')
      .toBeLessThan(after.indexOf('href="/plans"'))
  })

  it('the plans link is the only thing in its paragraph', () => {
    const link = src.indexOf('href="/plans"')
    const open = src.lastIndexOf('<p', link)
    const between = src.slice(src.indexOf('>', open) + 1, src.lastIndexOf('<Link', link)).trim()
    expect(between, 'text shares the line with the link').toBe('')
  })
})
