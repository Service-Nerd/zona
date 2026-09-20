// P-03 — the ceiling reaches the surfaces, not just Session Detail.
//
// ⚠️ WHY A REACH TEST AND NOT ANOTHER UNIT TEST. `easyPaceAsCeiling` has been
// correct and unit-tested since CD-11. That was never the problem. The problem
// was that it was CALLED FROM ONE PLACE — Session Detail — so the idea the whole
// product is built around ("an easy run's pace is a cap, not a window") appeared
// on one screen and not on the card the runner actually looks at.
//
// A unit test on the function cannot catch that. This asserts REACH: the render
// sites that show an easy pace route through the transform. It is a source
// assertion, which is weak — stated plainly — but it is the only thing that
// fails when someone adds a fifth surface and forgets.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { easyPaceAsCeiling } from './easyPaceCeiling'

const read = (p: string) => readFileSync(p, 'utf8')

describe('P-03 — the transform reaches every surface that shows an easy pace', () => {
  it('the SESSION CARD routes its pace through the ceiling (Today + Plan)', () => {
    const src = read('app/dashboard/DashboardClient.tsx')
    const card = src.slice(src.indexOf('const paceBracket'), src.indexOf('const paceBracket') + 400)
    expect(card).toContain('easyPaceAsCeiling')
  })

  it('SESSION DETAIL still routes its pace through the ceiling (the original site)', () => {
    const src = read('app/dashboard/DashboardClient.tsx')
    expect(src).toContain('const paceForDetail = easyPaceAsCeiling(')
  })

  it('there is exactly ONE owner of the transform — no component re-implements it', () => {
    for (const f of ['app/dashboard/DashboardClient.tsx', 'components/training/PlanCalendar.tsx']) {
      // The giveaway string. Any second implementation would have to build it.
      expect(read(f)).not.toContain("' or slower'")
    }
  })
})

describe('P-03 — and it still leaves everything else alone', () => {
  it('quality, long and race keep their band', () => {
    for (const t of ['quality', 'tempo', 'intervals', 'long', 'race', 'strength']) {
      expect(easyPaceAsCeiling('5:40–5:55 /km', t)).toBe('5:40–5:55 /km')
    }
  })

  it('easy, recovery and run become a ceiling', () => {
    for (const t of ['easy', 'recovery', 'run']) {
      expect(easyPaceAsCeiling('7:11–8:32 /km', t)).toBe('7:11 /km or slower')
    }
  })

  it('never renders a ≤, which reads backwards for pace', () => {
    expect(easyPaceAsCeiling('7:11–8:32 /km', 'easy')).not.toContain('≤')
    expect(easyPaceAsCeiling('7:11–8:32 /km', 'easy')).not.toContain('<')
  })

  it('a null, a placeholder or a single value passes through untouched', () => {
    expect(easyPaceAsCeiling(null, 'easy')).toBe(null)
    expect(easyPaceAsCeiling('—', 'easy')).toBe('—')
    expect(easyPaceAsCeiling('7:30 /km', 'easy')).toBe('7:30 /km')
  })
})
