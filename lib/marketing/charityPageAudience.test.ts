import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// CHARITY-FAQ-RUNWAY-01 — /charity-runners IS FOR ANY CHARITY'S RUNNERS, AND IT
// HAD ALREADY BEEN FIXED FOR THIS ONCE.
//
// 🔴 THE REGRESSION, AND IT WAS MINE. On 2026-10-01 I added an FAQ answer reading
// "if you are setting this up in October for an April race there is no reason for a
// MARATHON BLOCK to start yet" — the timeline and the distance of the one charity
// whose codes happened to go out that morning. The page's own header records it
// being rewritten TWICE IN ONE DAY on founder calls, 2026-09-11, for exactly this:
//
//   "It was marathon-only in its URL, title, FAQs and CTAs. Charity places are most
//    often 10K and half marathon, with marathons and the odd ultra on top, so a
//    distance-shaped page turned most of its own audience away at the headline."
//
// ⚠️ THAT FIX WAS PROSE WITH NO CHECK, so it held exactly as long as someone
// remembered, which this repo records as not being a rule at all. Three weeks.
//
// ⚠️ IT GUARDS THE ANSWERS, NOT THE WHOLE FILE. The page legitimately links to a
// `marathon-16-week` plan and offers a "Half marathon" card: naming the distances it
// SUPPORTS is the opposite of assuming the reader's. What must not happen is an
// ANSWER telling a 10K runner about their marathon.

const PAGE = join(__dirname, '..', '..', 'app', 'charity-runners', 'page.tsx')

/** Every FAQ answer, derived from the source rather than hand-listed. */
function answers(): string[] {
  const src = readFileSync(PAGE, 'utf8')
  // Array.from, not spread: this repo's tsconfig names no `target` (CLAUDE.md
  // § TypeScript). No `s` flag either, so `.` cannot cross a line: one answer, one
  // source line, which is how the file is written.
  return Array.from(src.matchAll(/^    a: '(.*)',$/gm)).map(m => m[1])
}

/**
 * The one answer allowed to name a month or a season, with its reason.
 *
 * ⚠️ It illustrates the TWELVE-MONTH MECHANIC ("redeem in December and it runs to the
 * following December"), not the reader's own race. An exemption without a reason
 * becomes a place to hide the next one, so it matches a specific phrase rather than
 * an index: re-ordering the FAQ must not silently widen it.
 */
const CALENDAR_EXEMPT = 'Redeem in December and it runs to the following December'

describe('/charity-runners does not assume the reader’s distance', () => {
  it('finds the answers at all — an empty population passes every arm below', () => {
    expect(answers().length).toBeGreaterThanOrEqual(9)
  })

  it('no answer speaks of THE reader’s marathon', () => {
    // "half marathon" is a distance name and stays legal. "your marathon", "a
    // marathon block", "the marathon" presume what the reader signed up for.
    const bad = answers()
      .filter(a => /\b(your|a|the)\s+marathon\b/i.test(a.replace(/half\s+marathon/gi, '')))
      .map(a => a.slice(0, 90))
    expect(bad, 'charity places are most often 10K and half marathon').toEqual([])
  })

  it('no answer dates the reader’s race to a month or a season', () => {
    const MONTHS = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/i
    const SEASONS = /\b(spring|summer|autumn|winter)\b/i
    const bad = answers()
      .filter(a => !a.includes(CALENDAR_EXEMPT))
      .filter(a => MONTHS.test(a) || SEASONS.test(a))
      .map(a => a.slice(0, 90))
    expect(bad, 'a charity runner’s race can be in any month; say "months off", not "April"').toEqual([])
  })

  it('the calendar exemption still matches something, so it cannot rot into a blanket pass', () => {
    // If the illustrative sentence is reworded, the exemption must be re-examined
    // rather than silently covering a new offender.
    expect(answers().some(a => a.includes(CALENDAR_EXEMPT)),
      `the exempt phrase is gone from the page; delete the exemption or update it`).toBe(true)
  })
})
