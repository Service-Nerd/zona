import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dashboardSource } from '@/lib/testing/dashboardSources'

// FAQ-TITLE-INVERTED-01 — a door's row label IS the screen's title.
//
// 👤 Founder: *"The common questions page. I think title and subtitle are the wrong way
// round."* They were. `FAQ_TITLE` ("Common questions") rendered as a tiny uppercase eyebrow
// and `FAQ_SUBTITLE` ("The ones people actually ask.") rendered as the 26px screen title, so
// the runner tapped a door labelled *Common questions* and landed on a screen headlined
// *The ones people actually ask.*
//
// 🔴 `ME-DOORS-01` STATES THIS RULE IN AS MANY WORDS AND NOTHING ENFORCED IT:
// *"A door's row label and the screen's own title are the same string by definition: the
// runner taps a word and expects to arrive at it. Written out twice they drift, and the
// drift is invisible because each surface reads correctly on its own."*
//
// ⚠️ That last clause is exactly why it survived. Both surfaces DID read correctly alone —
// the Me row said "Common questions / The ones people actually ask.", and the screen looked
// like a screen. Only the JOURNEY between them was wrong, and no check walks a journey.

const code = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')
     .filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n')

/** Every door whose label and screen title are the same constant, and the screen that owns it. */
const DOORS: { label: string; screen: string }[] = [
  { label: 'FAQ_TITLE',              screen: 'components/shared/FaqScreen.tsx' },
  { label: 'HEART_RATE_TITLE',       screen: 'components/shared/HrCalibrationSheet.tsx' },
]

describe('FAQ-TITLE-INVERTED-01 — you arrive at the word you tapped', () => {
  it('🔴 the door label is rendered as the screen TITLE, not as an eyebrow', () => {
    for (const { label, screen } of DOORS) {
      const src = code(readFileSync(screen, 'utf8'))
      // 🔴 THE RENDERED occurrence, not the first one. The first cut took `indexOf` and
      // landed on `ariaLabel={HEART_RATE_TITLE}` — an accessibility attribute, not the
      // visible title — so the arm inspected a `<Sheet>` tag and failed for the wrong
      // reason. A constant used in three places needs the one in JSX TEXT position, which
      // is the occurrence immediately preceded by `>`.
      const rendered = Array.from(src.matchAll(new RegExp(`\\{${label}\\}`, 'g')))
        .map(m => m.index!)
        .filter(idx => />\s*$/.test(src.slice(Math.max(0, idx - 80), idx)))
      expect(rendered.length, `${screen} does not RENDER ${label} as text (only as an attribute?)`)
        .toBeGreaterThan(0)
      const i = rendered[0]!
      // Bound to the element that CONTAINS it: walk back to its opening tag.
      const open = src.lastIndexOf('<', i)
      const tag = src.slice(open, i)
      expect(tag, `${label} is rendered as something other than the screen title in ${screen}`)
        .toMatch(/screen-header__title|font-brand.*2[0-9]px|fontSize: '2[0-9]px'/)
      expect(tag, `${label} is rendered as a micro-label eyebrow — that is the inversion`)
        .not.toContain('MICRO_LABELS')
    }
  })

  it('🔴 the SUBTITLE is not rendered larger than the title', () => {
    // The other half of the inversion: it is not enough for the title to be big if the
    // subtitle is bigger. On FaqScreen the sub must use the documented sub role.
    const src = code(readFileSync('components/shared/FaqScreen.tsx', 'utf8'))
    const i = src.indexOf('{FAQ_SUBTITLE}')
    expect(i, 'FaqScreen no longer renders its subtitle').toBeGreaterThan(-1)
    const open = src.lastIndexOf('<', i)
    expect(src.slice(open, i), 'the subtitle must take the documented sub role')
      .toContain('screen-header__sub')
  })

  it('🔴 the Me door and the screen use the SAME constant, not two strings', () => {
    // The drift this rule exists to prevent: a door label typed out again on the screen.
    const me = code(dashboardSource())
    expect(me, 'the Me door stopped using the shared constant').toContain('title={FAQ_TITLE}')
    expect(me, 'the door hardcodes the label beside the constant')
      .not.toMatch(/title="Common questions"/)
    const faq = code(readFileSync('components/shared/FaqScreen.tsx', 'utf8'))
    expect(faq, 'the screen hardcodes its title instead of taking the constant')
      .not.toMatch(/>\s*Common questions\s*</)
  })
})
