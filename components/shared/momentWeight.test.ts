// UI-PATTERNS-MOMENTS-01 — the three moment-weight mechanisms are REAL (2026-10-05).
//
// 🎪 Collins filed this as "the document has no vocabulary for weight". Measured, the
// product has THREE — time, voice, provenance — each invented privately by whoever
// built that screen. `ui-patterns.md` § Moment weight now names them.
//
// 🔴 THIS GATE EXISTS BECAUSE THE SECTION IS NOTHING BUT THREE MEASUREMENTS. If
// `minDelay` goes to 0, or `SessionCompleteCard` drops a brand line, or the rail
// comes off the coach note, the section is LYING — and a doctrine section that
// describes a mechanism the code no longer has is worse than no section, because the
// next reader builds against it.
//
// ⚠️ It asserts MECHANISMS, never feelings — Sierra's binding condition. "The runner
// should feel understood" is unfalsifiable; "this surface spends 3.6 seconds" is not.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(p, 'utf8')

describe('UI-PATTERNS-MOMENTS-01 — the three mechanisms still exist', () => {
  it('TIME — the plan arriving is held on purpose', () => {
    const src = read('components/GeneratingCeremony.tsx')
    const m = src.match(/minDelay\s*=\s*hasPaidAccess\s*\?\s*(\d+)\s*:\s*(\d+)/)
    expect(m, 'the ceremony no longer declares a minimum hold — § Moment weight cites it').not.toBeNull()
    const [, paid, free] = m!.map(Number) as unknown as [number, number, number]
    // The documented values. A change is allowed; changing them silently is not,
    // because the section quotes them as the measurement.
    expect({ paid, free }, 'the hold changed — update ui-patterns.md § Moment weight with the new number')
      .toEqual({ paid: 3600, free: 1800 })
    expect(paid, 'a hold of zero is not a moment').toBeGreaterThan(0)
  })

  it('VOICE — the first run logged is the only card carrying BOTH locked brand lines', () => {
    const src = read('components/shared/SessionCompleteCard.tsx')
    expect(src, 'the voice anchor left the completion card').toContain('BRAND.voiceAnchor')
    expect(src, 'the brand statement left the completion card').toContain('BRAND.brandStatement')
  })

  it('PROVENANCE — the coach verdict carries the byline and the rail', () => {
    const src = read('components/shared/CoachNoteBlock.tsx')
    expect(src, 'the coach note lost its byline').toContain('CoachByline')
    expect(src, 'the 3px warn rail is the provenance accent and it is gone')
      .toMatch(/3px[\s\S]{0,80}--warn|--warn[\s\S]{0,80}3px/)
  })

  it('🔴 SIZE IS NOT A MECHANISM — the obvious wrong answer, asserted', () => {
    // The section says so explicitly because it is the thing a future reader will
    // reach for. An ORDINARY card renders the same 44px numeral as a moment does.
    expect(read('components/dashboard/LedgerCard.tsx'), 'the comparison that makes the point')
      .toMatch(/fontSize:\s*'44px'/)
    expect(read('components/shared/SessionCompleteCard.tsx')).toMatch(/fontSize:\s*'44px'/)
  })

  it('the section names all three mechanisms and the default', () => {
    const doc = read('docs/canonical/ui-patterns.md')
    const i = doc.indexOf('## Moment weight')
    expect(i, '§ Moment weight was removed').toBeGreaterThan(-1)
    const sec = doc.slice(i, doc.indexOf('\n## ', i + 5))
    for (const k of ['TIME', 'VOICE', 'PROVENANCE', 'EVERYTHING ELSE GETS NONE']) {
      expect(sec, `§ Moment weight no longer names ${k}`).toContain(k)
    }
  })
})
