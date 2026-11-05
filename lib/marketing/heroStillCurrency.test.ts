// The hero device still may not show a control the app does not have.
//
// 🔴 FOUND BY THE FOUNDER, NOT BY A CHECK: *"main screen shot on web page is
// not current."* The homepage's device drew `‹ WEEK 6 OF 16 ›` with working
// chevrons — a week navigator the Design Board removed from Today on
// **2026-09-22** (ruling **A1**, sitting three, `APP-REVIEW-W3`):
//
//     "Today is ONE DAY; Plan owns weeks. This strip used to carry
//      `‹ Week 4 of 12 ›` with working arrows ... `weekIndex` / `onWeekChange`
//      are gone from the props rather than defaulted: a prop nobody passes is
//      how the drift comes back."
//
// It came back on the website instead, and sat on the main screenshot for
// **45 days**. The app had been corrected; the picture of the app had not.
//
// ⚠️ WHY NO EXISTING GATE COULD SEE IT, which is the whole reason this file
// exists. `realComponents.test.ts` stops the marketing site HAND-DRAWING an app
// surface — and it exempts `PhoneFrame` by name, because that file draws a
// simulated iPhone and genuinely cannot mount the real screen inside a frame it
// is also drawing. **So the one surface allowed to hand-copy the app is the one
// surface with nothing checking the copy.** Every other still on the site is
// the real component and cannot drift; this one can only drift.
//
// ⚠️ AND THE COMMENT THAT JUSTIFIED THE HAND-COPY IS HOW IT SURVIVED. It read
// *"the real one is a client component with swipe handlers, so its markup is
// reproduced by hand here"* — true when written, and A1 removed both the swipe
// handlers and the header. The sentence explaining the copy had quietly become
// the explanation for copying something that no longer existed. A stale
// justification reads exactly like a live one.
//
// SCOPE, stated so this is not mistaken for more than it is. This cannot
// mechanically prove the still MATCHES the app — no check can, for a drawing.
// What it can do is assert that controls the board has explicitly REMOVED do
// not reappear here, and that the still keeps naming the real screen's parts.
// It is a ratchet on known rulings, not a likeness test.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')

/** Blank comments: this file's own rationale quotes the markup it forbids, and
 *  so does the still's. Sixth time this repo has met that shape. */
const code = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, m => ' '.repeat(m.length))
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, m => ' '.repeat(m.length))
    .split('\n')
    .map(l => (l.trim().startsWith('//') ? '' : l))
    .join('\n')

const STILLS = [
  'components/marketing/PhoneFrame.tsx',
  'components/marketing/TabbedPhone.tsx',
]

describe('the hero device still shows only controls the app has', () => {
  it('is reading real files, with their comments stripped', () => {
    // Guards the guard. If `code()` ever returns empty, every arm below passes
    // vacuously — the exact way three checks in this repo were dead on arrival.
    for (const f of STILLS) {
      const c = code(read(f))
      expect(c.length, `${f} stripped to nothing`).toBeGreaterThan(2_000)
      expect(c).toMatch(/<div/)
    }
  })

  it('A1 — Today does not navigate weeks, on the website either', () => {
    // The ruling is about Today. `TabbedPhone`'s Plan tab legitimately shows
    // weeks, so this arm reads the Today still only.
    const still = code(read('components/marketing/PhoneFrame.tsx'))
    const offenders: string[] = []

    // The header A1 removed, in any of the shapes it was written in.
    if (/Week \{?\w+\}? of \{?\w+\}?/.test(still)) offenders.push('a "Week N of M" header')
    // Its chevrons. The real DateStrip has no week affordance at all, so a
    // left/right arrow inside the Today still is navigation by definition.
    const arrows = still.match(/d="M1?3 4L7 10L1?3 16"|d="M7 4L13 10L7 16"/g) ?? []
    if (arrows.length) offenders.push(`${arrows.length} week-nav chevron path(s)`)

    expect(
      offenders,
      'The hero still is advertising week navigation on Today. Design Board A1 '
      + '(2026-09-22) removed it from the app: "Today is ONE DAY; Plan owns '
      + 'weeks." The seven day cells stay; the header and arrows do not.\n  '
      + offenders.join('\n  '),
    ).toEqual([])
  })

  it('still shows the parts of Today the app actually leads with', () => {
    // The inverse direction, and it is the one that matters more over time: a
    // still can go stale by LOSING the screen as easily as by keeping a dead
    // control. These are the blocks `TodayScreen.tsx` renders above the fold.
    const still = code(read('components/marketing/PhoneFrame.tsx'))
    for (const [what, re] of [
      ['the phase + week line (PHASE-ON-TODAY-01)', /Week \{weekN\}/],
      ['the race countdown', /COUNTDOWN|formatRaceCountdown/],
      ['the seven day cells', /DAYS\.map/],
      ['the session card', /Today&apos;s session/i],
    ] as const) {
      expect(still, `the Today still no longer shows ${what}`).toMatch(re)
    }
  })

  it('the countdown comes from the owner, not a hand-typed string', () => {
    // S5 (APP-REVIEW-W3) moved time-to-race into lib/format.ts and found the
    // WEBSITE mirroring the format by hand with a comment promising it matched.
    const still = read('components/marketing/PhoneFrame.tsx')
    expect(still, 'the still must call formatRaceCountdown, not re-type its output')
      .toMatch(/formatRaceCountdown/)
    expect(code(still), 'a hand-typed "N weeks out" has returned to the still')
      .not.toMatch(/'\d+ weeks out'|"\d+ weeks out"/)
  })
})
