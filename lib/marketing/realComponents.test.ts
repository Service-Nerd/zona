// GTM-SITE-02 item 3 — the homepage must show the product, not a drawing of it.
//
// The homepage spent months rendering `MockSessionCard`, `MockReflectCard` and
// `MockCoachNoteCard`: hand-written CSS imitations of app surfaces. They drifted,
// which is the whole reason this item existed. The coach mock painted its rail
// in `--moss` while the real `CoachNoteBlock` uses `--warn`, so the marketing
// site was showing a coach note in the colour that does not mean "coach".
//
// Nothing stops the next person re-adding one, which is what this guards.
// It also pins the two places the site states the SAME session twice: the
// device shot (`PhoneFrame`, hand-built by necessity) and the SessionCard on
// the homepage. Those are two hand-maintained copies of one claim, and that is
// exactly the shape of every content drift this repo has shipped.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { formatDistance } from '@/lib/format'
import { DEMO_WEEK, DEMO_ZONE_WEEK } from './demoSurfaces'

const ROOT = process.cwd()
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')

/** HTML entities the marketing pages use for characters JSX cannot hold bare. */
function decode(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&nbsp;/g, ' ')
    .replace(/&middot;/g, '·')
}

describe('the homepage renders real app components', () => {
  const page = read('app/page.tsx')

  it.each([
    ['SessionCard', '@/components/shared/SessionCard'],
    ['CoachNoteBlock', '@/components/shared/CoachNoteBlock'],
    ['ZoneRings', '@/components/shared/ZoneRings'],
  ])('imports the real %s', (name, from) => {
    expect(
      page.includes(from),
      `app/page.tsx no longer imports ${name} from ${from}. If the product visual ` +
      `was replaced with hand-written markup, that is the drift this item removed.`,
    ).toBe(true)

    // An import that nothing mounts is the same as no import.
    expect(page, `${name} is imported but never rendered`).toMatch(new RegExp(`<${name}[\\s/>]`))
  })

  it('has no hand-drawn imitation of an app surface', () => {
    const mocks = page.match(/^function Mock\w+/gm) ?? []
    expect(
      mocks,
      `app/page.tsx defines ${mocks.join(', ')}. Marketing surfaces render the real ` +
      `shared component instead: none of them is a client component and none needs a ` +
      `handler, so a server page can mount them directly. See lib/marketing/demoSurfaces.ts.`,
    ).toEqual([])
  })
})

describe('the two stills of the same session agree', () => {
  it('the device shot and the homepage card show the same run', () => {
    const frame = decode(read('components/marketing/PhoneFrame.tsx'))
    const tuesday = DEMO_WEEK[0]

    expect(
      frame.includes(tuesday.detail),
      `PhoneFrame no longer contains "${tuesday.detail}". The device shot and the ` +
      `SessionCard beside it are presented as the same runner's session, so if one ` +
      `changes the other has to. Update DEMO_WEEK[0] or PhoneFrame, not just one.`,
    ).toBe(true)

    // Deliberately NOT a literal. ADR-015 makes lib/format.ts the sole owner of
    // every distance string a runner reads, and this still is hand-built, so it
    // is the file most likely to drift away from it. It did: it read "8 km"
    // while the app renders "8km".
    const distance = formatDistance(tuesday.distanceKm, 'km')!
    expect(
      frame.includes(distance),
      `PhoneFrame does not show "${distance}" for the same session. That is what ` +
      `formatDistance() emits, and the device shot is a picture of a screen that ` +
      `calls it. Do not hand-write a different distance format here.`,
    ).toBe(true)

    // The check above is not enough on its own and was briefly wrong: the still
    // shows the same distance TWICE (the 56px hero and the session card), so
    // "the correct string appears somewhere" still passed while one of the two
    // had drifted back to "8 km". Only the absence of the wrong shape catches
    // that, so assert on every renderable line instead.
    const strays = frame
      .split('\n')
      .map((text, i) => ({ text, line: i + 1 }))
      .filter(l => !l.text.trim().startsWith('//'))
      .filter(l => /\d\s+(km|mi)\b/.test(l.text))
      .map(l => `  PhoneFrame.tsx:${l.line}  ${l.text.trim().slice(0, 100)}`)

    expect(
      strays,
      `PhoneFrame hand-writes a distance with a space before the unit:\n${strays.join('\n')}\n` +
      `formatDistance() emits "8km", never "8 km" (ADR-015).`,
    ).toEqual([])
  })
})

describe('the demo data is coherent', () => {
  it('the zone week sums to 100%', () => {
    const { z1, z2, z3, z45 } = DEMO_ZONE_WEEK.pct
    expect(z1 + z2 + z3 + z45).toBe(100)
  })

  // The product's argument is that the grey middle is hard to stay out of. A
  // demo week with zero Z3 would be showing a week nobody has.
  it('is an honest week, not a perfect one', () => {
    expect(DEMO_ZONE_WEEK.pct.z2).toBeGreaterThan(60)
    expect(DEMO_ZONE_WEEK.pct.z3).toBeGreaterThan(0)
  })

  it('uses more than one session colour', () => {
    expect(new Set(DEMO_WEEK.map(s => s.type)).size).toBeGreaterThan(1)
  })
})
